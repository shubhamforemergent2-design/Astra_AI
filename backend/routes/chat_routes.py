from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from datetime import datetime, timezone
from bson import ObjectId
from database import db
from auth import get_current_user
from models import MessageCreate, FeedbackCreate, TicketCreate, ConversationCreate
import json
import os
import re
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/chat", tags=["chat"])


def serialize(doc):
    if doc is None:
        return None
    doc["_id"] = str(doc["_id"])
    for k, v in doc.items():
        if isinstance(v, datetime):
            doc[k] = v.isoformat()
        elif isinstance(v, ObjectId):
            doc[k] = str(v)
    return doc


async def search_knowledge_base(query: str):
    words = [w for w in query.lower().split() if len(w) > 2]
    if not words:
        return []
    conditions = []
    for word in words:
        escaped = re.escape(word)
        conditions.append({
            "$or": [
                {"keywords": {"$regex": escaped, "$options": "i"}},
                {"title": {"$regex": escaped, "$options": "i"}},
                {"question": {"$regex": escaped, "$options": "i"}},
                {"explanation": {"$regex": escaped, "$options": "i"}},
            ]
        })
    items = await db.knowledge_items.find({"$or": conditions}).limit(5).to_list(5)
    return items


def build_knowledge_context(items):
    if not items:
        return "No relevant knowledge base articles found for this question."
    parts = []
    for item in items:
        part = f"Article: {item.get('title', '')}\n"
        part += f"Type: {item.get('answer_type', '')}\n"
        if item.get("explanation"):
            part += f"Explanation: {item['explanation']}\n"
        if item.get("steps"):
            part += "Steps:\n" + "\n".join(f"  {i+1}. {s}" for i, s in enumerate(item["steps"])) + "\n"
        if item.get("suggestions"):
            part += "Suggestions:\n" + "\n".join(f"  - {s}" for s in item["suggestions"]) + "\n"
        parts.append(part)
    return "Knowledge Base Context:\n\n" + "\n---\n".join(parts)


def build_system_prompt(context: str, custom_prompt: str = "") -> str:
    base = """You are Astra, the AI Knowledge Assistant for Biziverse. You help users understand features, learn workflows, resolve common issues, and access training materials.

IMPORTANT RULES:
1. Answer ONLY from the provided knowledge base context when available.
2. If the knowledge base has relevant information, use it to construct your answer.
3. If no relevant knowledge is found, acknowledge this honestly and suggest the user create a support ticket.
4. Never invent workflows or procedures that aren't in the knowledge base.
5. Always structure your response in this format:

**Explanation**
[Short explanation of the topic]

**Steps**
[Step-by-step guidance if applicable, numbered list]

**Suggestions**
[Optional best practices or recommendations]

**Reference Materials**
[Mention any relevant videos, PPTs, or documents if referenced in the knowledge base]

If steps are not applicable (for conceptual questions), skip the Steps section.
If no reference materials exist, skip that section.
Be concise, professional, and helpful."""

    if custom_prompt:
        base = custom_prompt + "\n\n" + base

    return base + "\n\n" + context


# ── Conversations ──
@router.get("/conversations")
async def list_conversations(request: Request):
    user = await get_current_user(request)
    docs = await db.conversations.find({"user_id": user["_id"]}).sort("updated_at", -1).to_list(100)
    return [serialize(d) for d in docs]


@router.post("/conversations")
async def create_conversation(body: ConversationCreate, request: Request):
    user = await get_current_user(request)
    doc = {
        "user_id": user["_id"],
        "title": body.title,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
        "is_escalated": False,
    }
    result = await db.conversations.insert_one(doc)
    doc["_id"] = result.inserted_id
    return serialize(doc)


@router.get("/conversations/{conv_id}")
async def get_conversation(conv_id: str, request: Request):
    user = await get_current_user(request)
    conv = await db.conversations.find_one({"_id": ObjectId(conv_id), "user_id": user["_id"]})
    if not conv:
        raise HTTPException(404, "Conversation not found")
    messages = await db.messages.find({"conversation_id": conv_id}).sort("created_at", 1).to_list(500)
    # Attach feedback to messages
    for msg in messages:
        msg["_id"] = str(msg["_id"])
        if msg["role"] == "assistant":
            feedback = await db.feedback.find_one({"message_id": str(msg["_id"]), "user_id": user["_id"]})
            if feedback:
                msg["feedback"] = {"is_helpful": feedback["is_helpful"], "comment": feedback.get("comment")}
        for k, v in msg.items():
            if isinstance(v, datetime):
                msg[k] = v.isoformat()
    return {"conversation": serialize(conv), "messages": messages}


@router.delete("/conversations/{conv_id}")
async def delete_conversation(conv_id: str, request: Request):
    user = await get_current_user(request)
    result = await db.conversations.delete_one({"_id": ObjectId(conv_id), "user_id": user["_id"]})
    if result.deleted_count == 0:
        raise HTTPException(404, "Conversation not found")
    await db.messages.delete_many({"conversation_id": conv_id})
    await db.feedback.delete_many({"conversation_id": conv_id})
    return {"message": "Deleted"}


# ── Messages (with AI streaming) ──
@router.post("/conversations/{conv_id}/messages")
async def send_message(conv_id: str, body: MessageCreate, request: Request):
    user = await get_current_user(request)
    conv = await db.conversations.find_one({"_id": ObjectId(conv_id), "user_id": user["_id"]})
    if not conv:
        raise HTTPException(404, "Conversation not found")

    # Save user message
    user_msg = {
        "conversation_id": conv_id,
        "role": "user",
        "content": body.content,
        "created_at": datetime.now(timezone.utc),
    }
    user_msg_result = await db.messages.insert_one(user_msg)

    # Search knowledge base
    knowledge_items = await search_knowledge_base(body.content)
    context = build_knowledge_context(knowledge_items)

    # Get AI config
    ai_config = await db.ai_config.find_one({}) or {}
    provider = ai_config.get("provider", "openai")
    model = ai_config.get("model", "gpt-5.2")
    api_key = ai_config.get("api_key") or os.environ.get("EMERGENT_LLM_KEY", "")
    custom_prompt = ai_config.get("system_prompt", "")

    # Get resource info for knowledge items
    resource_refs = []
    for item in knowledge_items:
        if item.get("resource_ids"):
            resources = await db.resources.find(
                {"_id": {"$in": [ObjectId(rid) for rid in item["resource_ids"]]}}
            ).to_list(20)
            for r in resources:
                resource_refs.append({
                    "title": r.get("title", ""),
                    "type": r.get("resource_type", "document"),
                    "url": r.get("url", ""),
                })

    system_prompt = build_system_prompt(context, custom_prompt)

    if resource_refs:
        refs_text = "\n\nAvailable Reference Materials:\n" + "\n".join(
            f"- [{r['type'].upper()}] {r['title']}" + (f" ({r['url']})" if r['url'] else "")
            for r in resource_refs
        )
        system_prompt += refs_text

    async def event_generator():
        full_response = ""
        knowledge_ids = [str(i["_id"]) for i in knowledge_items]

        try:
            from emergentintegrations.llm.chat import LlmChat, UserMessage, TextDelta, StreamDone

            chat = LlmChat(
                api_key=api_key,
                session_id=f"astra-{conv_id}-{str(user_msg_result.inserted_id)}",
                system_message=system_prompt,
            )
            chat.with_model(provider, model)

            user_message = UserMessage(text=body.content)

            async for event in chat.stream_message(user_message):
                if isinstance(event, TextDelta):
                    full_response += event.content
                    yield f"data: {json.dumps({'type': 'token', 'content': event.content})}\n\n"
                elif isinstance(event, StreamDone):
                    break

        except Exception as e:
            logger.error(f"AI Error: {e}")
            full_response = f"I apologize, but I'm having trouble generating a response right now. Please try again or create a support ticket for assistance.\n\nError: {str(e)}"
            yield f"data: {json.dumps({'type': 'token', 'content': full_response})}\n\n"

        # Save assistant message
        assistant_msg = {
            "conversation_id": conv_id,
            "role": "assistant",
            "content": full_response,
            "knowledge_item_ids": knowledge_ids,
            "resource_refs": resource_refs,
            "created_at": datetime.now(timezone.utc),
        }
        result = await db.messages.insert_one(assistant_msg)

        # Update conversation title and timestamp
        msg_count = await db.messages.count_documents({"conversation_id": conv_id})
        update_fields = {"updated_at": datetime.now(timezone.utc)}
        if msg_count <= 2:
            update_fields["title"] = body.content[:60] + ("..." if len(body.content) > 60 else "")
        await db.conversations.update_one({"_id": ObjectId(conv_id)}, {"$set": update_fields})

        yield f"data: {json.dumps({'type': 'done', 'message_id': str(result.inserted_id), 'resources': resource_refs})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ── Feedback ──
@router.post("/feedback")
async def submit_feedback(body: FeedbackCreate, request: Request):
    user = await get_current_user(request)
    existing = await db.feedback.find_one({"message_id": body.message_id, "user_id": user["_id"]})
    if existing:
        await db.feedback.update_one(
            {"_id": existing["_id"]},
            {"$set": {"is_helpful": body.is_helpful, "comment": body.comment, "updated_at": datetime.now(timezone.utc)}},
        )
        return {"message": "Feedback updated"}
    doc = {
        "message_id": body.message_id,
        "conversation_id": body.conversation_id,
        "user_id": user["_id"],
        "is_helpful": body.is_helpful,
        "comment": body.comment,
        "created_at": datetime.now(timezone.utc),
    }
    await db.feedback.insert_one(doc)
    return {"message": "Feedback submitted"}


# ── Tickets ──
@router.post("/tickets")
async def create_ticket(body: TicketCreate, request: Request):
    user = await get_current_user(request)
    doc = {
        "user_id": user["_id"],
        "user_email": user["email"],
        "user_name": user.get("name", ""),
        "question": body.question,
        "ai_response": body.ai_response,
        "conversation_id": body.conversation_id,
        "status": "open",
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
    result = await db.tickets.insert_one(doc)
    doc["_id"] = result.inserted_id
    if body.conversation_id:
        await db.conversations.update_one(
            {"_id": ObjectId(body.conversation_id)},
            {"$set": {"is_escalated": True}},
        )
    return serialize(doc)


@router.get("/tickets")
async def list_user_tickets(request: Request):
    user = await get_current_user(request)
    docs = await db.tickets.find({"user_id": user["_id"]}).sort("created_at", -1).to_list(100)
    return [serialize(d) for d in docs]
