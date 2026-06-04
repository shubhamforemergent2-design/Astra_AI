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
    """Optimized search with scores. Returns (items, max_score)."""
    try:
        results = await db.knowledge_items.find(
            {"$text": {"$search": query}},
            {"score": {"$meta": "textScore"}},
        ).sort([("score", {"$meta": "textScore"})]).limit(5).to_list(5)
        if results:
            max_score = max(r.get("score", 0) for r in results)
            return results, max_score
    except Exception:
        pass

    # Fallback regex
    stop_words = {"the", "how", "what", "when", "where", "which", "does", "can", "will",
                  "are", "was", "been", "being", "have", "has", "had", "for", "and", "but",
                  "not", "you", "all", "this", "that", "with", "from", "do", "is", "it", "to", "in", "of", "a", "an"}
    words = [w for w in query.lower().split() if len(w) > 2 and w not in stop_words][:5]
    if not words:
        return [], 0
    conditions = []
    for word in words:
        escaped = re.escape(word)
        conditions.append({"$or": [
            {"keywords": {"$regex": escaped, "$options": "i"}},
            {"title": {"$regex": escaped, "$options": "i"}},
            {"question": {"$regex": escaped, "$options": "i"}},
        ]})
    items = await db.knowledge_items.find({"$or": conditions}).limit(5).to_list(5)
    # Assign a rough score based on field matches
    for item in items:
        score = 0
        for w in words:
            wl = w.lower()
            if any(wl in k.lower() for k in item.get("keywords", [])):
                score += 2
            if wl in item.get("title", "").lower():
                score += 1.5
            if wl in item.get("question", "").lower():
                score += 1.5
        item["score"] = score
    items.sort(key=lambda x: x.get("score", 0), reverse=True)
    max_score = items[0].get("score", 0) if items else 0
    return items, max_score


def build_knowledge_context(items):
    """Build compact context for AI."""
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
    return "KNOWLEDGE BASE CONTEXT:\n\n" + "\n---\n".join(parts)


SYSTEM_PROMPT_BASE = """You are Astra, the AI Knowledge Assistant for Biziverse.

ABSOLUTE RULES — FOLLOW STRICTLY:
1. Answer ONLY using the provided KNOWLEDGE BASE CONTEXT below. Nothing else.
2. Do NOT add any information not explicitly present in the context.
3. Do NOT speculate, guess, or make assumptions about Biziverse features.
4. Do NOT say "typically", "usually", "I believe", or "you might want to check".
5. Do NOT suggest the user share screenshots or look for things yourself.
6. Do NOT offer to help identify things outside the provided context.
7. Present ONLY what the context contains — clearly, concisely, and accurately.
8. If the context has steps, present them as numbered steps.
9. If the context has tips or suggestions, include them naturally.
10. Mention reference materials at the end only if they exist in the context.
11. Do NOT use forced section headers like "Explanation:" or "Steps:" — write naturally.
12. Keep the answer focused and practical."""


def build_system_prompt(context: str, custom_prompt: str = "") -> str:
    prompt = SYSTEM_PROMPT_BASE
    if custom_prompt:
        prompt = custom_prompt + "\n\n" + prompt
    return prompt + "\n\n" + context


async def track_unanswered(query: str, user_id: str, conv_id: str):
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
        "review_status": "pending",
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


@router.get("/fallback-config")
async def get_fallback_config(request: Request):
    await get_current_user(request)
    ai_config = await db.ai_config.find_one({}) or {}
    return {
        "fallback_message": ai_config.get("fallback_message", "Answer Not Found!"),
        "fallback_button_text": ai_config.get("fallback_button_text", "Raise Support Ticket"),
        "fallback_button_link": ai_config.get("fallback_button_link", ""),
        "show_raise_ticket": ai_config.get("show_raise_ticket", True),
    }


# ── Messages (ZERO HALLUCINATION AI) ──
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
    await db.messages.insert_one(user_msg)

    # Get AI config
    ai_config = await db.ai_config.find_one({}) or {}
    confidence_threshold = ai_config.get("confidence_threshold", 1.5)
    enable_suggestions = ai_config.get("enable_suggestions", True)
    max_suggestions = ai_config.get("max_suggestions", 3)

    # Search knowledge base
    knowledge_items, max_score = await search_knowledge_base(body.content)

    # Get fallback config
    fallback_message = ai_config.get("fallback_message", "Answer Not Found!")
    fallback_button_text = ai_config.get("fallback_button_text", "Raise Support Ticket")
    fallback_button_link = ai_config.get("fallback_button_link", "")
    show_raise_ticket = ai_config.get("show_raise_ticket", True)

    # ── CASE 1: NO MATCH → Return fallback directly, NO AI CALL ──
    if not knowledge_items:
        await track_unanswered(body.content, user["_id"], conv_id)

        assistant_msg = {
            "conversation_id": conv_id, "role": "assistant",
            "content": fallback_message, "has_knowledge": False,
            "created_at": datetime.now(timezone.utc),
        }
        result = await db.messages.insert_one(assistant_msg)
        msg_count = await db.messages.count_documents({"conversation_id": conv_id})
        update_fields = {"updated_at": datetime.now(timezone.utc)}
        if msg_count <= 2:
            update_fields["title"] = body.content[:60] + ("..." if len(body.content) > 60 else "")
        await db.conversations.update_one({"_id": ObjectId(conv_id)}, {"$set": update_fields})

        async def fallback_generator():
            yield f"data: {json.dumps({'type': 'fallback', 'message': fallback_message})}\n\n"
            yield f"data: {json.dumps({'type': 'done', 'message_id': str(result.inserted_id), 'resources': [], 'fallback': {'show': True, 'message': fallback_message, 'button_text': fallback_button_text, 'button_link': fallback_button_link, 'show_raise_ticket': show_raise_ticket}})}\n\n"

        return StreamingResponse(fallback_generator(), media_type="text/event-stream",
                                 headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})

    # ── CASE 2: LOW CONFIDENCE → Show suggestions, NO AI CALL ──
    if max_score < confidence_threshold and enable_suggestions:
        suggestions = []
        for item in knowledge_items[:max_suggestions]:
            q = item.get("question") or item.get("title", "")
            if q and q not in suggestions:
                suggestions.append(q)

        if suggestions:
            suggestion_text = "I found some related topics in our knowledge base. Are you asking about one of these?"
            assistant_msg = {
                "conversation_id": conv_id, "role": "assistant",
                "content": suggestion_text, "suggestions": suggestions,
                "has_knowledge": False, "created_at": datetime.now(timezone.utc),
            }
            result = await db.messages.insert_one(assistant_msg)
            msg_count = await db.messages.count_documents({"conversation_id": conv_id})
            update_fields = {"updated_at": datetime.now(timezone.utc)}
            if msg_count <= 2:
                update_fields["title"] = body.content[:60] + ("..." if len(body.content) > 60 else "")
            await db.conversations.update_one({"_id": ObjectId(conv_id)}, {"$set": update_fields})

            async def suggestion_generator():
                yield f"data: {json.dumps({'type': 'suggestions', 'questions': suggestions, 'message': suggestion_text})}\n\n"
                yield f"data: {json.dumps({'type': 'done', 'message_id': str(result.inserted_id), 'resources': [], 'suggestions': suggestions})}\n\n"

            return StreamingResponse(suggestion_generator(), media_type="text/event-stream",
                                     headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})

    # ── CASE 3: HIGH CONFIDENCE → Call AI with strict context ──
    provider = ai_config.get("provider", "openai")
    model = ai_config.get("model", "gpt-5.2")
    api_key = ai_config.get("api_key") or os.environ.get("EMERGENT_LLM_KEY", "")
    custom_prompt = ai_config.get("system_prompt", "")

    # Only use top 3 highest scoring items
    top_items = sorted(knowledge_items, key=lambda x: x.get("score", 0), reverse=True)[:3]

    resource_refs = []
    for item in top_items:
        if item.get("resource_ids"):
            resources = await db.resources.find(
                {"_id": {"$in": [ObjectId(rid) for rid in item["resource_ids"]]}}
            ).to_list(20)
            for r in resources:
                ref = {"title": r.get("title", ""), "type": r.get("resource_type", "document"), "url": r.get("url", "")}
                if ref not in resource_refs:
                    resource_refs.append(ref)

    context = build_knowledge_context(top_items)
    system_prompt = build_system_prompt(context, custom_prompt)
    if resource_refs:
        system_prompt += "\n\nReference Materials:\n" + "\n".join(
            f"- [{r['type'].upper()}] {r['title']}" + (f" ({r['url']})" if r['url'] else "")
            for r in resource_refs
        )

    async def ai_generator():
        full_response = ""
        knowledge_ids = [str(i["_id"]) for i in top_items]

        try:
            from emergentintegrations.llm.chat import LlmChat, UserMessage, TextDelta, StreamDone

            chat = LlmChat(
                api_key=api_key,
                session_id=f"astra-{conv_id}-{datetime.now(timezone.utc).timestamp()}",
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
            full_response = "I'm having trouble generating a response. Please try again or raise a support ticket."
            yield f"data: {json.dumps({'type': 'token', 'content': full_response})}\n\n"

        assistant_msg = {
            "conversation_id": conv_id, "role": "assistant",
            "content": full_response, "knowledge_item_ids": knowledge_ids,
            "resource_refs": resource_refs, "has_knowledge": True,
            "created_at": datetime.now(timezone.utc),
        }
        result = await db.messages.insert_one(assistant_msg)

        msg_count = await db.messages.count_documents({"conversation_id": conv_id})
        update_fields = {"updated_at": datetime.now(timezone.utc)}
        if msg_count <= 2:
            update_fields["title"] = body.content[:60] + ("..." if len(body.content) > 60 else "")
        await db.conversations.update_one({"_id": ObjectId(conv_id)}, {"$set": update_fields})

        yield f"data: {json.dumps({'type': 'done', 'message_id': str(result.inserted_id), 'resources': resource_refs})}\n\n"

    return StreamingResponse(ai_generator(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


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
        "message_id": body.message_id, "conversation_id": body.conversation_id,
        "user_id": user["_id"], "is_helpful": body.is_helpful,
        "comment": body.comment, "created_at": datetime.now(timezone.utc),
    }
    await db.feedback.insert_one(doc)
    return {"message": "Feedback submitted"}


# ── Tickets ──
@router.post("/tickets")
async def create_ticket(body: TicketCreate, request: Request):
    user = await get_current_user(request)
    doc = {
        "user_id": user["_id"], "user_email": user["email"],
        "user_name": user.get("name", ""), "question": body.question,
        "ai_response": body.ai_response, "conversation_id": body.conversation_id,
        "status": "open", "created_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc),
    }
    result = await db.tickets.insert_one(doc)
    doc["_id"] = result.inserted_id
    if body.conversation_id:
        await db.conversations.update_one({"_id": ObjectId(body.conversation_id)}, {"$set": {"is_escalated": True}})
    return serialize(doc)


@router.get("/tickets")
async def list_user_tickets(request: Request):
    user = await get_current_user(request)
    docs = await db.tickets.find({"user_id": user["_id"]}).sort("created_at", -1).to_list(100)
    return [serialize(d) for d in docs]
