"""Iteration 2 tests: password reset, trained answers, unanswered Qs, fallback config, delete ticket"""
import os
import uuid
import json
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
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
    s.headers.update({"Authorization": f"Bearer {r.json()['access_token']}"})
    return s


@pytest.fixture(scope="module")
def user_session():
    s = requests.Session()
    unique = uuid.uuid4().hex[:8]
    email = f"TEST_iter2_{unique}@example.com"
    r = s.post(f"{BASE_URL}/api/auth/register",
               json={"email": email, "password": "User@1234", "name": f"TEST User {unique}"}, timeout=15)
    assert r.status_code == 200, r.text
    s.headers.update({"Authorization": f"Bearer {r.json()['access_token']}"})
    s.email = email
    return s


# ── Password Reset Flow ──
def test_forgot_password_unknown_email_returns_ok():
    """Should not reveal whether email exists"""
    r = requests.post(f"{BASE_URL}/api/auth/forgot-password",
                      json={"email": "nonexistent_xyz@example.com"}, timeout=10)
    assert r.status_code == 200
    assert "reset_token" not in r.json()


def test_password_reset_full_flow():
    """Register user, forgot pwd, reset, login w/ new pwd"""
    s = requests.Session()
    email = f"TEST_resetflow_{uuid.uuid4().hex[:8]}@example.com"
    reg = s.post(f"{BASE_URL}/api/auth/register",
                 json={"email": email, "password": "OldPass@123", "name": "Reset User"}, timeout=10)
    assert reg.status_code == 200

    # Forgot password
    fp = requests.post(f"{BASE_URL}/api/auth/forgot-password", json={"email": email}, timeout=10)
    assert fp.status_code == 200
    token = fp.json().get("reset_token")
    assert token, "Expected reset_token in dev mode"

    # Reset with token
    rp = requests.post(f"{BASE_URL}/api/auth/reset-password",
                       json={"token": token, "new_password": "NewPass@123"}, timeout=10)
    assert rp.status_code == 200

    # Old password should now fail
    lf = requests.post(f"{BASE_URL}/api/auth/login",
                       json={"email": email, "password": "OldPass@123"}, timeout=10)
    assert lf.status_code == 401

    # New password should work
    ls = requests.post(f"{BASE_URL}/api/auth/login",
                       json={"email": email, "password": "NewPass@123"}, timeout=10)
    assert ls.status_code == 200

    # Token cannot be reused
    rp2 = requests.post(f"{BASE_URL}/api/auth/reset-password",
                        json={"token": token, "new_password": "Another@123"}, timeout=10)
    assert rp2.status_code == 400


def test_reset_password_invalid_token():
    r = requests.post(f"{BASE_URL}/api/auth/reset-password",
                      json={"token": "garbage_token", "new_password": "Whatever@1"}, timeout=10)
    assert r.status_code == 400


def test_admin_password_safety():
    """Sanity check that admin login still works (will reset at end if needed)"""
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=10)
    assert r.status_code == 200


# ── Trained Answers CRUD ──
@pytest.fixture(scope="module")
def created_trained_answer(admin_session):
    payload = {
        "question_pattern": f"TEST_TA How do I reset my password {uuid.uuid4().hex[:6]}",
        "answer": "Use the forgot password link on the login screen.",
        "keywords": ["password", "reset", "forgot"],
    }
    r = admin_session.post(f"{BASE_URL}/api/admin/trained-answers", json=payload, timeout=10)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["question_pattern"].startswith("TEST_TA")
    assert "password" in data["keywords"]
    yield data
    admin_session.delete(f"{BASE_URL}/api/admin/trained-answers/{data['_id']}", timeout=10)


def test_list_trained_answers(admin_session, created_trained_answer):
    r = admin_session.get(f"{BASE_URL}/api/admin/trained-answers", timeout=10)
    assert r.status_code == 200
    ids = [d["_id"] for d in r.json()]
    assert created_trained_answer["_id"] in ids


def test_update_trained_answer(admin_session, created_trained_answer):
    r = admin_session.put(
        f"{BASE_URL}/api/admin/trained-answers/{created_trained_answer['_id']}",
        json={"answer": "Updated answer body"}, timeout=10,
    )
    assert r.status_code == 200
    assert r.json()["answer"] == "Updated answer body"


def test_user_cannot_create_trained_answer(user_session):
    r = user_session.post(f"{BASE_URL}/api/admin/trained-answers",
                          json={"question_pattern": "x", "answer": "y", "keywords": []}, timeout=10)
    assert r.status_code == 403


# ── Fallback Config ──
def test_get_fallback_config_requires_auth():
    r = requests.get(f"{BASE_URL}/api/chat/fallback-config", timeout=10)
    assert r.status_code == 401


def test_get_fallback_config_authed(user_session):
    r = user_session.get(f"{BASE_URL}/api/chat/fallback-config", timeout=10)
    assert r.status_code == 200
    data = r.json()
    for k in ["fallback_message", "fallback_button_text", "fallback_button_link", "show_raise_ticket"]:
        assert k in data


def test_update_fallback_config(admin_session):
    new_msg = f"TEST_fallback msg {uuid.uuid4().hex[:6]}"
    r = admin_session.put(f"{BASE_URL}/api/admin/ai-config", json={
        "fallback_message": new_msg,
        "fallback_button_text": "Open Ticket",
        "fallback_button_link": "/support",
        "show_raise_ticket": True,
    }, timeout=10)
    assert r.status_code == 200
    cfg = admin_session.get(f"{BASE_URL}/api/admin/ai-config", timeout=10).json()
    assert cfg["fallback_message"] == new_msg
    assert cfg["fallback_button_text"] == "Open Ticket"


# ── Unanswered Questions / Gap Analysis ──
def test_chat_unknown_question_creates_unanswered(user_session, admin_session):
    # Create conv
    conv = user_session.post(f"{BASE_URL}/api/chat/conversations",
                             json={"title": "TEST_gap"}, timeout=10).json()
    unique_q = f"TEST_unanswered xyzqq_{uuid.uuid4().hex[:6]} totally unknown topic"
    fallback_seen = False
    with user_session.post(f"{BASE_URL}/api/chat/conversations/{conv['_id']}/messages",
                           json={"content": unique_q}, stream=True, timeout=60) as r:
        assert r.status_code == 200
        for raw in r.iter_lines(decode_unicode=True):
            if not raw or not raw.startswith("data: "):
                continue
            try:
                ev = json.loads(raw[6:])
            except Exception:
                continue
            if ev.get("type") == "done":
                if ev.get("fallback"):
                    fallback_seen = True
                break
    assert fallback_seen, "Expected fallback in done event for unknown topic"

    # Admin can see unanswered
    listing = admin_session.get(f"{BASE_URL}/api/admin/unanswered", timeout=10)
    assert listing.status_code == 200
    pending = listing.json().get("pending", [])
    matched = [p for p in pending if unique_q.lower() in p.get("normalized", "")]
    assert matched, "Unanswered question not tracked"

    qid = matched[0]["_id"]

    # Mark added
    ma = admin_session.put(f"{BASE_URL}/api/admin/unanswered/{qid}/mark-added", timeout=10)
    assert ma.status_code == 200

    # Reject (create another)
    unique_q2 = f"TEST_unanswered reject_{uuid.uuid4().hex[:6]} something obscure"
    with user_session.post(f"{BASE_URL}/api/chat/conversations/{conv['_id']}/messages",
                           json={"content": unique_q2}, stream=True, timeout=60) as r:
        for raw in r.iter_lines(decode_unicode=True):
            if raw.startswith("data: ") and '"done"' in raw:
                break
    listing2 = admin_session.get(f"{BASE_URL}/api/admin/unanswered", timeout=10).json()
    matched2 = [p for p in listing2.get("pending", []) if unique_q2.lower() in p.get("normalized", "")]
    assert matched2
    rj = admin_session.put(f"{BASE_URL}/api/admin/unanswered/{matched2[0]['_id']}/reject", timeout=10)
    assert rj.status_code == 200

    # Bulk delete: create 2 more, then delete
    ids_to_delete = []
    for i in range(2):
        uq = f"TEST_bulkdel_{uuid.uuid4().hex[:8]} foo bar"
        with user_session.post(f"{BASE_URL}/api/chat/conversations/{conv['_id']}/messages",
                               json={"content": uq}, stream=True, timeout=60) as r:
            for raw in r.iter_lines(decode_unicode=True):
                if raw.startswith("data: ") and '"done"' in raw:
                    break
        lst = admin_session.get(f"{BASE_URL}/api/admin/unanswered", timeout=10).json()
        m = [p for p in lst.get("pending", []) if uq.lower() in p.get("normalized", "")]
        if m:
            ids_to_delete.append(m[0]["_id"])
    if ids_to_delete:
        bd = admin_session.post(f"{BASE_URL}/api/admin/unanswered/bulk-delete",
                                json={"ids": ids_to_delete}, timeout=10)
        assert bd.status_code == 200
        assert bd.json()["deleted"] >= 1


# ── Delete Ticket ──
def test_delete_ticket(user_session, admin_session):
    # Create a ticket first
    conv = user_session.post(f"{BASE_URL}/api/chat/conversations",
                             json={"title": "TEST_del_ticket"}, timeout=10).json()
    tk = user_session.post(f"{BASE_URL}/api/chat/tickets",
                           json={"question": "TEST_delticket Q",
                                 "ai_response": "answer",
                                 "conversation_id": conv["_id"]}, timeout=10).json()
    tid = tk["_id"]
    # Delete via admin
    r = admin_session.delete(f"{BASE_URL}/api/admin/tickets/{tid}", timeout=10)
    assert r.status_code == 200
    # Confirm removed
    rest = admin_session.get(f"{BASE_URL}/api/admin/tickets", timeout=10).json()
    assert tid not in [t["_id"] for t in rest]


# ── Reset admin password back to original at end (safety) ──
def test_zzz_admin_password_unchanged():
    """Final test: ensure admin can still login w/ original password.
    If the e2e UI test changed it, restore here.
    """
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=10)
    if r.status_code != 200:
        # Restore via forgot password flow
        fp = requests.post(f"{BASE_URL}/api/auth/forgot-password",
                           json={"email": ADMIN_EMAIL}, timeout=10).json()
        token = fp.get("reset_token")
        assert token, "Cannot restore admin password"
        rr = requests.post(f"{BASE_URL}/api/auth/reset-password",
                           json={"token": token, "new_password": ADMIN_PASSWORD}, timeout=10)
        assert rr.status_code == 200
        r2 = requests.post(f"{BASE_URL}/api/auth/login",
                           json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=10)
        assert r2.status_code == 200
    else:
        assert r.status_code == 200
