from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware
from database import db, client
from auth import hash_password, verify_password
from routes.auth_routes import router as auth_router
from routes.knowledge_routes import router as knowledge_router
from routes.chat_routes import router as chat_router
from routes.admin_routes import router as admin_router
from datetime import datetime, timezone
import os
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = FastAPI(title="Astra - AI Knowledge Assistant")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth_router)
app.include_router(knowledge_router)
app.include_router(chat_router)
app.include_router(admin_router)


@app.get("/api")
async def root():
    return {"message": "Astra API is running"}


@app.on_event("startup")
async def startup():
    # Create indexes
    await db.users.create_index("email", unique=True)
    await db.login_attempts.create_index("identifier")
    await db.conversations.create_index([("user_id", 1), ("updated_at", -1)])
    await db.messages.create_index([("conversation_id", 1), ("created_at", 1)])
    await db.feedback.create_index([("message_id", 1), ("user_id", 1)])
    await db.knowledge_items.create_index([("module_id", 1)])
    await db.knowledge_items.create_index([("topic_id", 1)])
    await db.tickets.create_index([("user_id", 1)])

    # Seed admin
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@biziverse.com")
    admin_password = os.environ.get("ADMIN_PASSWORD", "Admin@123")

    existing = await db.users.find_one({"email": admin_email})
    if existing is None:
        hashed = hash_password(admin_password)
        await db.users.insert_one({
            "email": admin_email,
            "password_hash": hashed,
            "name": "Super Admin",
            "role": "super_admin",
            "is_active": True,
            "created_at": datetime.now(timezone.utc),
        })
        logger.info(f"Admin user seeded: {admin_email}")
    elif not verify_password(admin_password, existing["password_hash"]):
        await db.users.update_one(
            {"email": admin_email},
            {"$set": {"password_hash": hash_password(admin_password)}},
        )
        logger.info("Admin password updated")

    # Seed default AI config if not exists
    ai_config = await db.ai_config.find_one({})
    if not ai_config:
        await db.ai_config.insert_one({
            "provider": "openai",
            "model": "gpt-5.2",
            "api_key": "",
            "system_prompt": "",
            "created_at": datetime.now(timezone.utc),
        })
        logger.info("Default AI config seeded")

    # Write test credentials
    creds_dir = Path("/app/memory")
    creds_dir.mkdir(exist_ok=True)
    (creds_dir / "test_credentials.md").write_text(
        f"# Test Credentials\n\n"
        f"## Admin Account\n"
        f"- Email: {admin_email}\n"
        f"- Password: {admin_password}\n"
        f"- Role: super_admin\n\n"
        f"## Auth Endpoints\n"
        f"- POST /api/auth/login\n"
        f"- POST /api/auth/register\n"
        f"- POST /api/auth/logout\n"
        f"- GET /api/auth/me\n"
        f"- POST /api/auth/refresh\n"
    )
    logger.info("Startup complete")


@app.on_event("shutdown")
async def shutdown():
    client.close()
