from fastapi import APIRouter, HTTPException, Request
from datetime import datetime, timezone
from bson import ObjectId
from database import db
from auth import get_current_user, require_roles
from models import (
    ModuleCreate, ModuleUpdate,
    TopicCreate, TopicUpdate,
    KnowledgeItemCreate, KnowledgeItemUpdate,
    ResourceCreate, ResourceUpdate,
)
import re

router = APIRouter(prefix="/api/knowledge", tags=["knowledge"])

ADMIN_ROLES = ("super_admin", "knowledge_manager", "contributor")


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


# ── Modules ──
@router.get("/modules")
async def list_modules():
    docs = await db.modules.find().sort("name", 1).to_list(500)
    return [serialize(d) for d in docs]


@router.post("/modules")
async def create_module(body: ModuleCreate, request: Request):
    user = await require_roles(*ADMIN_ROLES)(request)
    doc = {
        "name": body.name.strip(),
        "description": body.description.strip(),
        "created_at": datetime.now(timezone.utc),
        "created_by": user["_id"],
    }
    result = await db.modules.insert_one(doc)
    doc["_id"] = result.inserted_id
    return serialize(doc)


@router.put("/modules/{module_id}")
async def update_module(module_id: str, body: ModuleUpdate, request: Request):
    await require_roles(*ADMIN_ROLES)(request)
    updates = {k: v for k, v in body.model_dump(exclude_none=True).items()}
    if not updates:
        raise HTTPException(400, "No fields to update")
    updates["updated_at"] = datetime.now(timezone.utc)
    result = await db.modules.update_one({"_id": ObjectId(module_id)}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(404, "Module not found")
    doc = await db.modules.find_one({"_id": ObjectId(module_id)})
    return serialize(doc)


@router.delete("/modules/{module_id}")
async def delete_module(module_id: str, request: Request):
    await require_roles(*ADMIN_ROLES)(request)
    result = await db.modules.delete_one({"_id": ObjectId(module_id)})
    if result.deleted_count == 0:
        raise HTTPException(404, "Module not found")
    # Clean up topics and items
    await db.topics.delete_many({"module_id": module_id})
    await db.knowledge_items.delete_many({"module_id": module_id})
    return {"message": "Deleted"}


# ── Topics ──
@router.get("/topics")
async def list_topics(module_id: str = None):
    query = {}
    if module_id:
        query["module_id"] = module_id
    docs = await db.topics.find(query).sort("name", 1).to_list(500)
    return [serialize(d) for d in docs]


@router.post("/topics")
async def create_topic(body: TopicCreate, request: Request):
    user = await require_roles(*ADMIN_ROLES)(request)
    doc = {
        "name": body.name.strip(),
        "description": body.description.strip(),
        "module_id": body.module_id,
        "created_at": datetime.now(timezone.utc),
        "created_by": user["_id"],
    }
    result = await db.topics.insert_one(doc)
    doc["_id"] = result.inserted_id
    return serialize(doc)


@router.put("/topics/{topic_id}")
async def update_topic(topic_id: str, body: TopicUpdate, request: Request):
    await require_roles(*ADMIN_ROLES)(request)
    updates = {k: v for k, v in body.model_dump(exclude_none=True).items()}
    if not updates:
        raise HTTPException(400, "No fields to update")
    updates["updated_at"] = datetime.now(timezone.utc)
    result = await db.topics.update_one({"_id": ObjectId(topic_id)}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(404, "Topic not found")
    doc = await db.topics.find_one({"_id": ObjectId(topic_id)})
    return serialize(doc)


@router.delete("/topics/{topic_id}")
async def delete_topic(topic_id: str, request: Request):
    await require_roles(*ADMIN_ROLES)(request)
    result = await db.topics.delete_one({"_id": ObjectId(topic_id)})
    if result.deleted_count == 0:
        raise HTTPException(404, "Topic not found")
    await db.knowledge_items.delete_many({"topic_id": topic_id})
    return {"message": "Deleted"}


# ── Knowledge Items ──
@router.get("/items")
async def list_items(topic_id: str = None, module_id: str = None):
    query = {}
    if topic_id:
        query["topic_id"] = topic_id
    if module_id:
        query["module_id"] = module_id
    docs = await db.knowledge_items.find(query).sort("created_at", -1).to_list(500)
    return [serialize(d) for d in docs]


@router.get("/items/{item_id}")
async def get_item(item_id: str):
    doc = await db.knowledge_items.find_one({"_id": ObjectId(item_id)})
    if not doc:
        raise HTTPException(404, "Item not found")
    # Attach resources
    if doc.get("resource_ids"):
        resources = await db.resources.find(
            {"_id": {"$in": [ObjectId(rid) for rid in doc["resource_ids"]]}}
        ).to_list(50)
        doc["resources"] = [serialize(r) for r in resources]
    return serialize(doc)


@router.post("/items")
async def create_item(body: KnowledgeItemCreate, request: Request):
    user = await require_roles(*ADMIN_ROLES)(request)
    doc = {
        **body.model_dump(),
        "created_at": datetime.now(timezone.utc),
        "created_by": user["_id"],
    }
    result = await db.knowledge_items.insert_one(doc)
    doc["_id"] = result.inserted_id
    return serialize(doc)


@router.put("/items/{item_id}")
async def update_item(item_id: str, body: KnowledgeItemUpdate, request: Request):
    await require_roles(*ADMIN_ROLES)(request)
    updates = {k: v for k, v in body.model_dump(exclude_none=True).items()}
    if not updates:
        raise HTTPException(400, "No fields to update")
    updates["updated_at"] = datetime.now(timezone.utc)
    result = await db.knowledge_items.update_one({"_id": ObjectId(item_id)}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(404, "Item not found")
    doc = await db.knowledge_items.find_one({"_id": ObjectId(item_id)})
    return serialize(doc)


@router.delete("/items/{item_id}")
async def delete_item(item_id: str, request: Request):
    await require_roles(*ADMIN_ROLES)(request)
    result = await db.knowledge_items.delete_one({"_id": ObjectId(item_id)})
    if result.deleted_count == 0:
        raise HTTPException(404, "Item not found")
    return {"message": "Deleted"}


# ── Resources ──
@router.get("/resources")
async def list_resources(resource_type: str = None):
    query = {}
    if resource_type:
        query["resource_type"] = resource_type
    docs = await db.resources.find(query).sort("created_at", -1).to_list(500)
    return [serialize(d) for d in docs]


@router.post("/resources")
async def create_resource(body: ResourceCreate, request: Request):
    user = await require_roles(*ADMIN_ROLES)(request)
    doc = {
        **body.model_dump(),
        "created_at": datetime.now(timezone.utc),
        "created_by": user["_id"],
    }
    result = await db.resources.insert_one(doc)
    doc["_id"] = result.inserted_id
    return serialize(doc)


@router.put("/resources/{resource_id}")
async def update_resource(resource_id: str, body: ResourceUpdate, request: Request):
    await require_roles(*ADMIN_ROLES)(request)
    updates = {k: v for k, v in body.model_dump(exclude_none=True).items()}
    if not updates:
        raise HTTPException(400, "No fields to update")
    updates["updated_at"] = datetime.now(timezone.utc)
    result = await db.resources.update_one({"_id": ObjectId(resource_id)}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(404, "Resource not found")
    doc = await db.resources.find_one({"_id": ObjectId(resource_id)})
    return serialize(doc)


@router.delete("/resources/{resource_id}")
async def delete_resource(resource_id: str, request: Request):
    await require_roles(*ADMIN_ROLES)(request)
    result = await db.resources.delete_one({"_id": ObjectId(resource_id)})
    if result.deleted_count == 0:
        raise HTTPException(404, "Resource not found")
    return {"message": "Deleted"}


# ── Search ──
@router.get("/search")
async def search_knowledge(q: str = ""):
    if not q or len(q.strip()) < 2:
        return []
    words = [w for w in q.lower().split() if len(w) > 2]
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
    items = await db.knowledge_items.find({"$or": conditions}).limit(10).to_list(10)
    return [serialize(i) for i in items]
