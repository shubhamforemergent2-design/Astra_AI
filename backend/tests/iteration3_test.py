"""Iteration 3 tests: Recharts analytics, conversation review, suggestion config, zero-hallucination flow."""
import os
import json
import requests
import pytest

def _load_env():
    try:
        with open('/app/frontend/.env') as f:
            for line in f:
                if line.startswith('REACT_APP_BACKEND_URL='):
                    return line.split('=', 1)[1].strip()
    except Exception:
        pass
    return None

BASE_URL = (os.environ.get('REACT_APP_BACKEND_URL') or _load_env()).rstrip('/')
ADMIN_EMAIL = "admin@biziverse.com"
ADMIN_PWD = "Admin@123"


@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PWD})
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    return s


@pytest.fixture(scope="module")
def user_session():
    s = requests.Session()
    email = "test_iter3_user@example.com"
    s.post(f"{BASE_URL}/api/auth/register", json={
        "email": email, "password": "Pass@1234", "name": "Iter3 User"
    })
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": "Pass@1234"})
    assert r.status_code == 200
    return s


# ── Analytics Charts ──
class TestAnalyticsCharts:
    def test_charts_endpoint(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/admin/analytics/charts")
        assert r.status_code == 200
        data = r.json()
        assert "daily_questions" in data
        assert "daily_feedback" in data
        assert "ticket_status" in data
        assert "feedback_pie" in data
        assert isinstance(data["daily_questions"], list)
        assert isinstance(data["feedback_pie"], list)
        assert len(data["feedback_pie"]) == 2

    def test_charts_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/admin/analytics/charts")
        assert r.status_code in (401, 403)


# ── Admin Conversations ──
class TestAdminConversations:
    def test_list_conversations(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/admin/conversations")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        if data:
            c = data[0]
            assert "message_count" in c
            assert "review_status" in c
            assert "user_name" in c

    def test_review_flow(self, admin_session, user_session):
        # Create a conversation
        r = user_session.post(f"{BASE_URL}/api/chat/conversations", json={"title": "TEST_iter3_review"})
        assert r.status_code == 200
        conv_id = r.json()["_id"]

        # Get messages via admin
        r2 = admin_session.get(f"{BASE_URL}/api/admin/conversations/{conv_id}/messages")
        assert r2.status_code == 200
        assert "messages" in r2.json()

        # Mark reviewed
        r3 = admin_session.put(f"{BASE_URL}/api/admin/conversations/{conv_id}/review",
                               json={"review_status": "reviewed"})
        assert r3.status_code == 200

        # Mark flagged
        r4 = admin_session.put(f"{BASE_URL}/api/admin/conversations/{conv_id}/review",
                               json={"review_status": "flagged"})
        assert r4.status_code == 200

        # Invalid status
        r5 = admin_session.put(f"{BASE_URL}/api/admin/conversations/{conv_id}/review",
                               json={"review_status": "junk"})
        assert r5.status_code == 400

        # Verify via list
        r6 = admin_session.get(f"{BASE_URL}/api/admin/conversations")
        assert r6.status_code == 200
        found = next((c for c in r6.json() if c["_id"] == conv_id), None)
        assert found is not None
        assert found["review_status"] == "flagged"

        # Cleanup
        user_session.delete(f"{BASE_URL}/api/chat/conversations/{conv_id}")


# ── Suggestion / Confidence Config ──
class TestSuggestionConfig:
    def test_ai_config_has_suggestion_fields(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/admin/ai-config")
        assert r.status_code == 200
        cfg = r.json()
        # Defaults must exist
        assert "enable_suggestions" in cfg
        assert "max_suggestions" in cfg
        assert "confidence_threshold" in cfg

    def test_update_suggestion_config(self, admin_session):
        # Read current
        r0 = admin_session.get(f"{BASE_URL}/api/admin/ai-config")
        original = r0.json()
        try:
            r = admin_session.put(f"{BASE_URL}/api/admin/ai-config", json={
                "enable_suggestions": True,
                "max_suggestions": 4,
                "confidence_threshold": 2.0,
            })
            assert r.status_code == 200
            data = r.json()
            assert data["enable_suggestions"] is True
            assert data["max_suggestions"] == 4
            assert abs(data["confidence_threshold"] - 2.0) < 0.001
        finally:
            # restore
            admin_session.put(f"{BASE_URL}/api/admin/ai-config", json={
                "enable_suggestions": original.get("enable_suggestions", True),
                "max_suggestions": original.get("max_suggestions", 3),
                "confidence_threshold": original.get("confidence_threshold", 1.5),
            })


# ── Zero-Hallucination Chat Flow ──
class TestZeroHallucinationFlow:
    def _read_sse_types(self, resp, max_events=20):
        types = []
        count = 0
        for raw in resp.iter_lines(decode_unicode=True):
            if not raw:
                continue
            if raw.startswith("data:"):
                payload = raw[5:].strip()
                try:
                    obj = json.loads(payload)
                    types.append(obj)
                except Exception:
                    pass
            count += 1
            if count > 200:
                break
            if types and types[-1].get("type") == "done":
                break
        return types

    def test_no_kb_match_returns_fallback_event(self, user_session):
        # New conv
        r = user_session.post(f"{BASE_URL}/api/chat/conversations", json={"title": "TEST_iter3_fallback"})
        conv_id = r.json()["_id"]
        # Random question unlikely to match KB
        gibberish = "zxcvbnm qwerty hyperflux nonsenseword12345"
        resp = user_session.post(
            f"{BASE_URL}/api/chat/conversations/{conv_id}/messages",
            json={"content": gibberish}, stream=True,
        )
        assert resp.status_code == 200
        events = self._read_sse_types(resp)
        event_types = [e.get("type") for e in events]
        # If KB is totally empty, expect 'fallback'; otherwise we accept suggestions or fallback,
        # but explicitly NOT 'token' (no AI call).
        assert "token" not in event_types, f"AI was called for no/low KB match: {event_types}"
        assert ("fallback" in event_types) or ("suggestions" in event_types), \
            f"Expected fallback or suggestions, got {event_types}"
        # cleanup
        user_session.delete(f"{BASE_URL}/api/chat/conversations/{conv_id}")

    def test_fallback_config_endpoint(self, user_session):
        r = user_session.get(f"{BASE_URL}/api/chat/fallback-config")
        assert r.status_code == 200
        data = r.json()
        assert "fallback_message" in data
        assert "fallback_button_text" in data
        assert "show_raise_ticket" in data
