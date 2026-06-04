from fastapi import APIRouter, HTTPException, Request
from datetime import datetime, timezone
from bson import ObjectId
from database import db
from auth import get_current_user, require_roles, hash_password
from models import (
    UserCreate, UserUpdate,
    AnnouncementCreate, AnnouncementUpdate,
    AIConfigUpdate, TicketUpdate,
)

router = APIRouter(prefix="/api/admin", tags=["admin"])

ADMIN_ROLES = ("super_admin",)
MANAGER_ROLES = ("super_admin", "knowledge_manager", "support_manager")


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


# ── User Management ──
@router.get("/users")
async def list_users(request: Request):
    await require_roles(*ADMIN_ROLES)(request)
    docs = await db.users.find({}, {"password_hash": 0}).sort("created_at", -1).to_list(500)
    return [serialize(d) for d in docs]


@router.post("/users")
async def create_user(body: UserCreate, request: Request):
    await require_roles(*ADMIN_ROLES)(request)
    email = body.email.strip().lower()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(400, "Email already exists")
    doc = {
        "email": email,
        "password_hash": hash_password(body.password),
        "name": body.name.strip(),
        "role": body.role,
        "is_active": True,
        "created_at": datetime.now(timezone.utc),
    }
    result = await db.users.insert_one(doc)
    doc["_id"] = result.inserted_id
    doc.pop("password_hash")
    return serialize(doc)


@router.put("/users/{user_id}")
async def update_user(user_id: str, body: UserUpdate, request: Request):
    await require_roles(*ADMIN_ROLES)(request)
    updates = {k: v for k, v in body.model_dump(exclude_none=True).items()}
    if not updates:
        raise HTTPException(400, "No fields to update")
    updates["updated_at"] = datetime.now(timezone.utc)
    result = await db.users.update_one({"_id": ObjectId(user_id)}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(404, "User not found")
    doc = await db.users.find_one({"_id": ObjectId(user_id)}, {"password_hash": 0})
    return serialize(doc)


@router.delete("/users/{user_id}")
async def delete_user(user_id: str, request: Request):
    current = await require_roles(*ADMIN_ROLES)(request)
    if current["_id"] == user_id:
        raise HTTPException(400, "Cannot delete yourself")
    result = await db.users.delete_one({"_id": ObjectId(user_id)})
    if result.deleted_count == 0:
        raise HTTPException(404, "User not found")
    return {"message": "Deleted"}


# ── AI Config ──
@router.get("/ai-config")
async def get_ai_config(request: Request):
    await require_roles(*ADMIN_ROLES)(request)
    config = await db.ai_config.find_one({})
    if not config:
        config = {
            "provider": "openai",
            "model": "gpt-5.2",
            "api_key": "",
            "system_prompt": "",
        }
    else:
        config = serialize(config)
        # Mask API key
        if config.get("api_key"):
            config["api_key_masked"] = config["api_key"][:8] + "..." + config["api_key"][-4:]
    return config


@router.put("/ai-config")
async def update_ai_config(body: AIConfigUpdate, request: Request):
    user = await require_roles(*ADMIN_ROLES)(request)
    updates = {k: v for k, v in body.model_dump(exclude_none=True).items()}
    if not updates:
        raise HTTPException(400, "No fields to update")
    updates["updated_at"] = datetime.now(timezone.utc)
    updates["updated_by"] = user["_id"]

    existing = await db.ai_config.find_one({})
    if existing:
        await db.ai_config.update_one({"_id": existing["_id"]}, {"$set": updates})
    else:
        await db.ai_config.insert_one(updates)

    config = await db.ai_config.find_one({})
    return serialize(config)


# ── Announcements ──
@router.get("/announcements")
async def list_announcements_admin(request: Request):
    await require_roles(*MANAGER_ROLES)(request)
    docs = await db.announcements.find().sort("created_at", -1).to_list(100)
    return [serialize(d) for d in docs]


@router.post("/announcements")
async def create_announcement(body: AnnouncementCreate, request: Request):
    user = await require_roles(*MANAGER_ROLES)(request)
    doc = {
        "title": body.title.strip(),
        "content": body.content.strip(),
        "is_active": body.is_active,
        "created_at": datetime.now(timezone.utc),
        "created_by": user["_id"],
    }
    result = await db.announcements.insert_one(doc)
    doc["_id"] = result.inserted_id
    return serialize(doc)


@router.put("/announcements/{ann_id}")
async def update_announcement(ann_id: str, body: AnnouncementUpdate, request: Request):
    await require_roles(*MANAGER_ROLES)(request)
    updates = {k: v for k, v in body.model_dump(exclude_none=True).items()}
    if not updates:
        raise HTTPException(400, "No fields to update")
    updates["updated_at"] = datetime.now(timezone.utc)
    result = await db.announcements.update_one({"_id": ObjectId(ann_id)}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(404, "Announcement not found")
    doc = await db.announcements.find_one({"_id": ObjectId(ann_id)})
    return serialize(doc)


@router.delete("/announcements/{ann_id}")
async def delete_announcement(ann_id: str, request: Request):
    await require_roles(*MANAGER_ROLES)(request)
    result = await db.announcements.delete_one({"_id": ObjectId(ann_id)})
    if result.deleted_count == 0:
        raise HTTPException(404, "Announcement not found")
    return {"message": "Deleted"}


# ── Public Announcements (for user portal) ──
@router.get("/public/announcements")
async def public_announcements():
    docs = await db.announcements.find({"is_active": True}).sort("created_at", -1).to_list(20)
    return [serialize(d) for d in docs]


# ── Analytics ──
@router.get("/analytics")
async def get_analytics(request: Request):
    await require_roles(*MANAGER_ROLES)(request)

    total_questions = await db.messages.count_documents({"role": "user"})
    total_users = await db.users.count_documents({"role": "end_user"})
    total_conversations = await db.conversations.count_documents({})
    total_feedback = await db.feedback.count_documents({})
    helpful = await db.feedback.count_documents({"is_helpful": True})
    not_helpful = await db.feedback.count_documents({"is_helpful": False})
    open_tickets = await db.tickets.count_documents({"status": "open"})
    total_tickets = await db.tickets.count_documents({})
    escalated = await db.conversations.count_documents({"is_escalated": True})
    total_modules = await db.modules.count_documents({})
    total_items = await db.knowledge_items.count_documents({})

    helpful_pct = round((helpful / total_feedback * 100), 1) if total_feedback > 0 else 0
    not_helpful_pct = round((not_helpful / total_feedback * 100), 1) if total_feedback > 0 else 0
    resolution_rate = round(((total_questions - escalated) / total_questions * 100), 1) if total_questions > 0 else 0
    escalation_rate = round((escalated / total_conversations * 100), 1) if total_conversations > 0 else 0

    return {
        "total_questions": total_questions,
        "active_users": total_users,
        "total_conversations": total_conversations,
        "resolution_rate": resolution_rate,
        "escalation_rate": escalation_rate,
        "helpful_pct": helpful_pct,
        "not_helpful_pct": not_helpful_pct,
        "open_tickets": open_tickets,
        "total_tickets": total_tickets,
        "total_modules": total_modules,
        "total_knowledge_items": total_items,
        "total_feedback": total_feedback,
        "helpful_count": helpful,
        "not_helpful_count": not_helpful,
    }


# ── Conversations (Admin) ──
@router.get("/conversations")
async def admin_conversations(request: Request):
    await require_roles(*MANAGER_ROLES)(request)
    pipeline = [
        {"$sort": {"updated_at": -1}},
        {"$limit": 100},
        {"$lookup": {"from": "users", "let": {"uid": "$user_id"}, "pipeline": [
            {"$match": {"$expr": {"$eq": [{"$toString": "$_id"}, "$$uid"]}}},
            {"$project": {"name": 1, "email": 1}}
        ], "as": "user_info"}},
        {"$unwind": {"path": "$user_info", "preserveNullAndEmptyArrays": True}},
    ]
    docs = await db.conversations.aggregate(pipeline).to_list(100)
    result = []
    for d in docs:
        d["_id"] = str(d["_id"])
        d["user_name"] = d.get("user_info", {}).get("name", "Unknown")
        d["user_email"] = d.get("user_info", {}).get("email", "Unknown")
        d.pop("user_info", None)
        for k, v in d.items():
            if isinstance(v, datetime):
                d[k] = v.isoformat()
        result.append(d)
    return result


# ── Tickets (Admin) ──
@router.get("/tickets")
async def admin_tickets(request: Request):
    await require_roles(*MANAGER_ROLES)(request)
    docs = await db.tickets.find().sort("created_at", -1).to_list(200)
    return [serialize(d) for d in docs]


@router.put("/tickets/{ticket_id}")
async def update_ticket(ticket_id: str, body: TicketUpdate, request: Request):
    await require_roles(*MANAGER_ROLES)(request)
    updates = {k: v for k, v in body.model_dump(exclude_none=True).items()}
    if not updates:
        raise HTTPException(400, "No fields to update")
    updates["updated_at"] = datetime.now(timezone.utc)
    result = await db.tickets.update_one({"_id": ObjectId(ticket_id)}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(404, "Ticket not found")
    doc = await db.tickets.find_one({"_id": ObjectId(ticket_id)})
    return serialize(doc)


# ── Feedback Analytics (Admin) ──
@router.get("/feedback")
async def admin_feedback(request: Request):
    await require_roles(*MANAGER_ROLES)(request)
    docs = await db.feedback.find().sort("created_at", -1).to_list(200)
    return [serialize(d) for d in docs]
