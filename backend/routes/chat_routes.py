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


async def find_trained_answer(query: str):
    """Check trained answers first - highest priority."""
    try:
        results = await db.trained_answers.find(
            {"$text": {"$search": query}},
            {"score": {"$meta": "textScore"}},
        ).sort([("score", {"$meta": "textScore"})]).limit(1).to_list(1)
        if results and results[0].get("score", 0) > 1.0:
            return results[0]
    except Exception:
        # Fallback: keyword overlap matching
        words = set(w.lower() for w in query.split() if len(w) > 2)
        if not words:
            return None
        cursor = db.trained_answers.find()
        best, best_score = None, 0
        async for ta in cursor:
            ta_words = set(k.lower() for k in ta.get("keywords", []))
            ta_words.update(w.lower() for w in ta.get("question_pattern", "").split() if len(w) > 2)
            overlap = len(words & ta_words)
            if overlap > best_score:
                best, best_score = ta, overlap
        if best_score >= 2:
            return best
    return None


async def search_knowledge_base(query: str):
    """Optimized search using MongoDB text index. Falls back to regex for small DBs."""
    try:
        results = await db.knowledge_items.find(
            {"$text": {"$search": query}},
            {"score": {"$meta": "textScore"}},
        ).sort([("score", {"$meta": "textScore"})]).limit(3).to_list(3)
        if results:
            return results
    except Exception:
        pass

    # Fallback: regex search (for when text index not ready)
    words = [w for w in query.lower().split() if len(w) > 2]
    if not words:
        return []
    # Use only top 5 most significant words (skip common ones)
    stop_words = {"the", "how", "what", "when", "where", "which", "does", "can", "will", "are", "was", "been", "being", "have", "has", "had", "for", "and", "but", "not", "you", "all", "this", "that", "with", "from"}
    words = [w for w in words if w not in stop_words][:5]
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
            ]
        })
    items = await db.knowledge_items.find({"$or": conditions}).limit(3).to_list(3)
    return items


def build_knowledge_context(items, trained_answer=None):
    """Build compact context for AI - optimized for token usage."""
    if trained_answer:
        return f"TRAINED ANSWER (use this as primary source):\nQ: {trained_answer.get('question_pattern', '')}\nA: {trained_answer.get('answer', '')}"

    if not items:
        return "NO RELEVANT KNOWLEDGE FOUND. Tell the user you don't have information about this in the knowledge base."

    parts = []
    for item in items:
        lines = [f"[{item.get('title', '')}]"]
        if item.get("explanation"):
            lines.append(item["explanation"])
        if item.get("steps"):
            lines.append("Steps: " + " | ".join(f"{i+1}. {s}" for i, s in enumerate(item["steps"])))
        if item.get("suggestions"):
            lines.append("Tips: " + " | ".join(item["suggestions"]))
        parts.append("\n".join(lines))
    return "KNOWLEDGE BASE:\n\n" + "\n---\n".join(parts)


def build_system_prompt(context: str, custom_prompt: str = "") -> str:
    base = """You are Astra, the AI Knowledge Assistant for Biziverse. You help users with features, workflows, troubleshooting, and training materials.

Rules:
- Answer ONLY from the provided knowledge base context
- If a TRAINED ANSWER is provided, use it as your primary response source
- Present step-by-step procedures as numbered steps when appropriate
- Include practical tips naturally when available
- Do NOT use forced section headers like "Explanation:", "Steps:", "Suggestions:" — write naturally
- Do NOT invent procedures, features, or workflows not present in the context
- Do NOT ask users to share screenshots or offer to help identify things outside the knowledge base
- If no relevant information is found, respond briefly: say you don't have this information and suggest raising a support ticket
- Keep responses concise, professional, and actionable
- Mention reference materials (videos/PPTs/docs) at the end if they exist in context"""

    if custom_prompt:
        base = custom_prompt + "\n\n" + base

    return base + "\n\n" + context


async def track_unanswered(query: str, user_id: str, conv_id: str):
    """Track questions with no knowledge base matches for gap analysis."""
    normalized = query.strip().lower()
    existing = await db.unanswered_questions.find_one({"normalized": normalized, "status": "pending"})
    if existing:
        await db.unanswered_questions.update_one(
            {"_id": existing["_id"]},
            {"$inc": {"asked_count": 1}, "$set": {"updated_at": datetime.now(timezone.utc)}},
        )
    else:
        await db.unanswered_questions.insert_one({
            "question": query.strip(),
            "normalized": normalized,
            "user_id": user_id,
            "conversation_id": conv_id,
            "asked_count": 1,
            "status": "pending",
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
        })


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


# ── Get fallback config (public for user portal) ──
@router.get("/fallback-config")
async def get_fallback_config(request: Request):
    await get_current_user(request)
    ai_config = await db.ai_config.find_one({}) or {}
    return {
        "fallback_message": ai_config.get("fallback_message", "I couldn't find relevant information in our knowledge base for your question."),
        "fallback_button_text": ai_config.get("fallback_button_text", "Raise Support Ticket"),
        "fallback_button_link": ai_config.get("fallback_button_link", ""),
        "show_raise_ticket": ai_config.get("show_raise_ticket", True),
    }


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

    # Check trained answers first
    trained_answer = await find_trained_answer(body.content)

    # Search knowledge base (only if no trained answer)
    knowledge_items = []
    if not trained_answer:
        knowledge_items = await search_knowledge_base(body.content)

    has_knowledge = bool(trained_answer or knowledge_items)
    context = build_knowledge_context(knowledge_items, trained_answer)

    # Track unanswered questions
    if not has_knowledge:
        await track_unanswered(body.content, user["_id"], conv_id)

    # Get AI config
    ai_config = await db.ai_config.find_one({}) or {}
    provider = ai_config.get("provider", "openai")
    model = ai_config.get("model", "gpt-5.2")
    api_key = ai_config.get("api_key") or os.environ.get("EMERGENT_LLM_KEY", "")
    custom_prompt = ai_config.get("system_prompt", "")

    # Get resource refs for knowledge items
    resource_refs = []
    for item in knowledge_items:
        if item.get("resource_ids"):
            resources = await db.resources.find(
                {"_id": {"$in": [ObjectId(rid) for rid in item["resource_ids"]]}}
            ).to_list(20)
            for r in resources:
                ref = {"title": r.get("title", ""), "type": r.get("resource_type", "document"), "url": r.get("url", "")}
                if ref not in resource_refs:
                    resource_refs.append(ref)

    system_prompt = build_system_prompt(context, custom_prompt)
    if resource_refs:
        refs_text = "\n\nReference Materials:\n" + "\n".join(
            f"- [{r['type'].upper()}] {r['title']}" + (f" ({r['url']})" if r['url'] else "")
            for r in resource_refs
        )
        system_prompt += refs_text

    # Build fallback config
    fallback_data = None
    if not has_knowledge:
        fallback_data = {
            "show": True,
            "message": ai_config.get("fallback_message", "I couldn't find relevant information in our knowledge base for your question."),
            "button_text": ai_config.get("fallback_button_text", "Raise Support Ticket"),
            "button_link": ai_config.get("fallback_button_link", ""),
            "show_raise_ticket": ai_config.get("show_raise_ticket", True),
        }

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
            full_response = "I'm having trouble generating a response right now. Please try again or raise a support ticket for assistance."
            yield f"data: {json.dumps({'type': 'token', 'content': full_response})}\n\n"

        # Save assistant message
        assistant_msg = {
            "conversation_id": conv_id,
            "role": "assistant",
            "content": full_response,
            "knowledge_item_ids": knowledge_ids,
            "resource_refs": resource_refs,
            "has_knowledge": has_knowledge,
            "created_at": datetime.now(timezone.utc),
        }
        result = await db.messages.insert_one(assistant_msg)

        # Update conversation title and timestamp
        msg_count = await db.messages.count_documents({"conversation_id": conv_id})
        update_fields = {"updated_at": datetime.now(timezone.utc)}
        if msg_count <= 2:
            update_fields["title"] = body.content[:60] + ("..." if len(body.content) > 60 else "")
        await db.conversations.update_one({"_id": ObjectId(conv_id)}, {"$set": update_fields})

        done_data = {
            "type": "done",
            "message_id": str(result.inserted_id),
            "resources": resource_refs,
        }
        if fallback_data:
            done_data["fallback"] = fallback_data
        yield f"data: {json.dumps(done_data)}\n\n"

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
