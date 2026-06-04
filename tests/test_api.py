import json
import os
import tempfile
import unittest

from fastapi.testclient import TestClient

from api.deps import set_llm_client
from api.db.database import get_engine, init_db
from api.main import app
from tests.test_engine import FakeLLM


class TestAPI(unittest.TestCase):
    def setUp(self):
        self._tmpdir = tempfile.TemporaryDirectory()
        os.environ["DATABASE_URL"] = f"sqlite:///{self._tmpdir.name}/test.db"
        os.environ["TESTING"] = "1"
        import api.db.database as db_mod

        db_mod._engine = None
        db_mod._SessionLocal = None
        init_db()
        set_llm_client(FakeLLM(triage_route="tech", reply="Try restarting the app."))
        self.client = TestClient(app)

    def tearDown(self):
        set_llm_client(None)
        self._tmpdir.cleanup()

    def test_health(self):
        r = self.client.get("/api/health")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["status"], "ok")

    def test_create_session_and_message(self):
        r = self.client.post("/api/sessions")
        self.assertEqual(r.status_code, 200)
        session_id = r.json()["session_id"]

        r2 = self.client.post(
            f"/api/sessions/{session_id}/messages",
            json={"content": "App crashes on login"},
        )
        self.assertEqual(r2.status_code, 200)
        data = r2.json()
        self.assertEqual(data["outcome"], "responded")
        self.assertEqual(data["assigned_route"], "tech")
        self.assertIn("restart", data["message"].lower())

    def test_escalate(self):
        r = self.client.post("/api/sessions")
        session_id = r.json()["session_id"]
        self.client.post(
            f"/api/sessions/{session_id}/messages",
            json={"content": "help"},
        )
        r_esc = self.client.post(f"/api/sessions/{session_id}/escalate")
        self.assertEqual(r_esc.status_code, 200)
        data = r_esc.json()
        self.assertEqual(data["outcome"], "escalated")
        self.assertTrue(data["is_escalated"])
        self.assertIsNotNone(data["ticket_id"])
        self.assertTrue(data["ticket_id"].startswith("DEMO-"))

    def test_lockout_after_escalate(self):
        r = self.client.post("/api/sessions")
        session_id = r.json()["session_id"]
        self.client.post(f"/api/sessions/{session_id}/escalate")
        r2 = self.client.post(
            f"/api/sessions/{session_id}/messages",
            json={"content": "extra note"},
        )
        self.assertEqual(r2.json()["outcome"], "lockout")

    def test_end_session(self):
        r = self.client.post("/api/sessions")
        session_id = r.json()["session_id"]
        r_end = self.client.post(f"/api/sessions/{session_id}/end")
        self.assertEqual(r_end.status_code, 200)
        self.assertEqual(r_end.json()["outcome"], "session_ended")

    def test_stream_message(self):
        r = self.client.post("/api/sessions")
        session_id = r.json()["session_id"]
        with self.client.stream(
            "POST",
            f"/api/sessions/{session_id}/messages/stream",
            json={"content": "login broken"},
        ) as resp:
            self.assertEqual(resp.status_code, 200)
            chunks = []
            for line in resp.iter_lines():
                if line.startswith("data: "):
                    chunks.append(json.loads(line[6:]))
            self.assertTrue(any(c.get("type") == "token" for c in chunks))
            done = [c for c in chunks if c.get("type") == "done"][-1]
            self.assertEqual(done["outcome"], "responded")

    def test_demo_context(self):
        r = self.client.get("/api/sessions/demo-context")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["account_name"], "Demo User")

    def test_csat(self):
        r = self.client.post("/api/sessions")
        session_id = r.json()["session_id"]
        r2 = self.client.post(
            f"/api/sessions/{session_id}/csat",
            json={"rating": "up", "comment": "Great demo"},
        )
        self.assertEqual(r2.status_code, 200)
        self.assertTrue(r2.json()["ok"])


if __name__ == "__main__":
    unittest.main()
