"""Astra Backend API tests - covers auth, knowledge mgmt, admin, chat, tickets, feedback"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # Fallback to reading frontend .env if env var not propagated
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
                break

ADMIN_EMAIL = "admin@biziverse.com"
ADMIN_PASSWORD = "Admin@123"


# ── Fixtures ──
@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login",
               json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    data = r.json()
    assert "access_token" in data
    s.headers.update({"Authorization": f"Bearer {data['access_token']}"})
    return s


@pytest.fixture(scope="module")
def user_session():
    s = requests.Session()
    unique = uuid.uuid4().hex[:8]
    email = f"TEST_user_{unique}@example.com"
    r = s.post(f"{BASE_URL}/api/auth/register",
               json={"email": email, "password": "User@1234", "name": f"TEST User {unique}"},
               timeout=15)
    assert r.status_code == 200, f"User register failed: {r.status_code} {r.text}"
    data = r.json()
    s.headers.update({"Authorization": f"Bearer {data['access_token']}"})
    s.email = email
    return s


# ── Health ──
def test_root():
    r = requests.get(f"{BASE_URL}/api", timeout=10)
    assert r.status_code == 200
    assert "Astra" in r.json().get("message", "")


# ── Auth ──
def test_login_invalid():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": "nope@x.com", "password": "wrong"}, timeout=10)
    assert r.status_code == 401


def test_login_admin_success(admin_session):
    r = admin_session.get(f"{BASE_URL}/api/auth/me", timeout=10)
    assert r.status_code == 200
    user = r.json()["user"]
    assert user["email"] == ADMIN_EMAIL
    assert user["role"] == "super_admin"


def test_register_and_me(user_session):
    r = user_session.get(f"{BASE_URL}/api/auth/me", timeout=10)
    assert r.status_code == 200
    assert r.json()["user"]["role"] == "end_user"


def test_register_duplicate(user_session):
    r = user_session.post(f"{BASE_URL}/api/auth/register",
                          json={"email": user_session.email, "password": "x12345678", "name": "Dup"}, timeout=10)
    assert r.status_code == 400


# ── Knowledge Module/Topic/Item ──
@pytest.fixture(scope="module")
def created_module(admin_session):
    r = admin_session.post(f"{BASE_URL}/api/knowledge/modules",
                           json={"name": f"TEST_Module_{uuid.uuid4().hex[:6]}", "description": "test mod"},
                           timeout=10)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "_id" in data
    assert data["name"].startswith("TEST_Module_")
    yield data
    admin_session.delete(f"{BASE_URL}/api/knowledge/modules/{data['_id']}", timeout=10)


def test_list_modules_contains_created(admin_session, created_module):
    r = admin_session.get(f"{BASE_URL}/api/knowledge/modules", timeout=10)
    assert r.status_code == 200
    ids = [m["_id"] for m in r.json()]
    assert created_module["_id"] in ids


@pytest.fixture(scope="module")
def created_topic(admin_session, created_module):
    r = admin_session.post(f"{BASE_URL}/api/knowledge/topics",
                           json={"name": f"TEST_Topic_{uuid.uuid4().hex[:6]}",
                                 "description": "t", "module_id": created_module["_id"]},
                           timeout=10)
    assert r.status_code == 200, r.text
    return r.json()


def test_list_topics_filtered(admin_session, created_module, created_topic):
    r = admin_session.get(f"{BASE_URL}/api/knowledge/topics",
                          params={"module_id": created_module["_id"]}, timeout=10)
    assert r.status_code == 200
    ids = [t["_id"] for t in r.json()]
    assert created_topic["_id"] in ids


@pytest.fixture(scope="module")
def created_item(admin_session, created_module, created_topic):
    payload = {
        "title": "TEST_How to login",
        "answer_type": "how_to",
        "question": "How do I login?",
        "explanation": "Use credentials to login",
        "steps": ["Open page", "Enter creds", "Click submit"],
        "suggestions": ["Use strong password"],
        "keywords": ["login", "auth"],
        "topic_id": created_topic["_id"],
        "module_id": created_module["_id"],
        "resource_ids": [],
    }
    r = admin_session.post(f"{BASE_URL}/api/knowledge/items", json=payload, timeout=10)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["title"] == "TEST_How to login"
    return data


def test_get_item(admin_session, created_item):
    r = admin_session.get(f"{BASE_URL}/api/knowledge/items/{created_item['_id']}", timeout=10)
    assert r.status_code == 200
    assert r.json()["title"] == "TEST_How to login"


def test_search_knowledge(admin_session, created_item):
    r = admin_session.get(f"{BASE_URL}/api/knowledge/search", params={"q": "login"}, timeout=10)
    assert r.status_code == 200


# ── Resources ──
@pytest.fixture(scope="module")
def created_resource(admin_session):
    r = admin_session.post(f"{BASE_URL}/api/knowledge/resources",
                           json={"title": "TEST_Video", "description": "demo",
                                 "resource_type": "video", "url": "https://example.com/v"},
                           timeout=10)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["resource_type"] == "video"
    yield data
    admin_session.delete(f"{BASE_URL}/api/knowledge/resources/{data['_id']}", timeout=10)


def test_list_resources(admin_session, created_resource):
    r = admin_session.get(f"{BASE_URL}/api/knowledge/resources", timeout=10)
    assert r.status_code == 200
    ids = [x["_id"] for x in r.json()]
    assert created_resource["_id"] in ids


# ── Admin Users ──
def test_admin_list_users(admin_session):
    r = admin_session.get(f"{BASE_URL}/api/admin/users", timeout=10)
    assert r.status_code == 200
    users = r.json()
    assert any(u["email"] == ADMIN_EMAIL for u in users)
    # mongo _id must be serialized to string
    for u in users:
        assert isinstance(u["_id"], str)
        assert "password_hash" not in u


def test_user_cannot_list_users(user_session):
    r = user_session.get(f"{BASE_URL}/api/admin/users", timeout=10)
    assert r.status_code == 403


# ── AI Config ──
def test_get_ai_config(admin_session):
    r = admin_session.get(f"{BASE_URL}/api/admin/ai-config", timeout=10)
    assert r.status_code == 200
    data = r.json()
    assert "provider" in data
    assert "model" in data


# ── Announcements ──
@pytest.fixture(scope="module")
def created_announcement(admin_session):
    r = admin_session.post(f"{BASE_URL}/api/admin/announcements",
                           json={"title": "TEST_Announcement", "content": "Hello", "is_active": True},
                           timeout=10)
    assert r.status_code == 200, r.text
    data = r.json()
    yield data
    admin_session.delete(f"{BASE_URL}/api/admin/announcements/{data['_id']}", timeout=10)


def test_public_announcements_visible(created_announcement):
    r = requests.get(f"{BASE_URL}/api/admin/public/announcements", timeout=10)
    assert r.status_code == 200
    ids = [a["_id"] for a in r.json()]
    assert created_announcement["_id"] in ids


# ── Analytics ──
def test_admin_analytics(admin_session):
    r = admin_session.get(f"{BASE_URL}/api/admin/analytics", timeout=10)
    assert r.status_code == 200
    d = r.json()
    for k in ["total_questions", "active_users", "total_conversations",
              "open_tickets", "total_modules", "total_knowledge_items"]:
        assert k in d


# ── Chat (Conversations / Tickets / Feedback) ──
@pytest.fixture(scope="module")
def created_conv(user_session):
    r = user_session.post(f"{BASE_URL}/api/chat/conversations",
                          json={"title": "TEST_conv"}, timeout=10)
    assert r.status_code == 200, r.text
    return r.json()


def test_list_conversations(user_session, created_conv):
    r = user_session.get(f"{BASE_URL}/api/chat/conversations", timeout=10)
    assert r.status_code == 200
    ids = [c["_id"] for c in r.json()]
    assert created_conv["_id"] in ids


def test_send_message_sse(user_session, created_conv):
    """Verify streaming endpoint accepts request and yields events."""
    with user_session.post(f"{BASE_URL}/api/chat/conversations/{created_conv['_id']}/messages",
                           json={"content": "What is Biziverse?"}, stream=True, timeout=60) as r:
        assert r.status_code == 200
        got_done = False
        last_msg_id = None
        for raw in r.iter_lines(decode_unicode=True):
            if not raw:
                continue
            if raw.startswith("data: "):
                import json as _json
                try:
                    ev = _json.loads(raw[6:])
                except Exception:
                    continue
                if ev.get("type") == "done":
                    got_done = True
                    last_msg_id = ev.get("message_id")
                    break
        assert got_done, "Did not receive done event from SSE"
        assert last_msg_id
        # Store for feedback/ticket tests
        user_session.last_msg_id = last_msg_id
        user_session.last_conv_id = created_conv["_id"]


def test_submit_feedback(user_session):
    msg_id = getattr(user_session, "last_msg_id", None)
    conv_id = getattr(user_session, "last_conv_id", None)
    if not msg_id:
        pytest.skip("No message id from streaming test")
    r = user_session.post(f"{BASE_URL}/api/chat/feedback",
                          json={"message_id": msg_id, "conversation_id": conv_id,
                                "is_helpful": True, "comment": "Great"}, timeout=10)
    assert r.status_code == 200


def test_create_ticket(user_session):
    conv_id = getattr(user_session, "last_conv_id", None)
    r = user_session.post(f"{BASE_URL}/api/chat/tickets",
                          json={"question": "TEST_ticket question",
                                "ai_response": "AI said hi",
                                "conversation_id": conv_id}, timeout=10)
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "open"
    assert data["question"] == "TEST_ticket question"


def test_admin_sees_ticket(admin_session):
    r = admin_session.get(f"{BASE_URL}/api/admin/tickets", timeout=10)
    assert r.status_code == 200
    qs = [t.get("question", "") for t in r.json()]
    assert any("TEST_ticket question" in q for q in qs)
