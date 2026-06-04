import unittest
from unittest.mock import MagicMock

from workflow.engine import TurnOutcome, cleanup_session, process_turn
from workflow.llm import parse_triage_response as parse_from_llm
from workflow.routes import LOCKOUT_MESSAGE, Route
from workflow.routing_hints import looks_like_misc_question
from workflow.session import SessionState


class FakeLLM:
    def __init__(self, triage_route: str = "tech", reply: str = "Try restarting."):
        self.triage_route = triage_route
        self.reply = reply
        self.triage_calls = 0
        self.persona_calls = 0

    def triage(self, user_text: str) -> str:
        self.triage_calls += 1
        return f'{{"route": "{self.triage_route}"}}'

    def generate_persona(
        self, route: str, conversation_history: list, user_text: str
    ) -> str:
        self.persona_calls += 1
        return self.reply

    def stream_persona(
        self, route: str, conversation_history: list, user_text: str
    ):
        self.persona_calls += 1
        for word in self.reply.split():
            yield word + " "


class TestParseTriage(unittest.TestCase):
    def test_valid_route(self):
        self.assertEqual(parse_from_llm('{"route": "billing"}'), "billing")

    def test_invalid_json(self):
        self.assertIsNone(parse_from_llm("not json"))

    def test_invalid_route(self):
        self.assertIsNone(parse_from_llm('{"route": "legal"}'))


class TestPhaseA(unittest.TestCase):
    def test_exit_ends_session(self):
        session = SessionState()
        session.conversation_history.append(
            {"role": "user", "parts": ["hi"]}
        )
        llm = FakeLLM()
        result = process_turn(session, "exit", client=llm)
        self.assertEqual(result.outcome, TurnOutcome.SESSION_ENDED)
        self.assertEqual(llm.triage_calls, 0)
        self.assertEqual(llm.persona_calls, 0)

    def test_lockout_exact_message(self):
        session = SessionState(is_escalated=True)
        llm = FakeLLM()
        result = process_turn(session, "follow up note", client=llm)
        self.assertEqual(result.outcome, TurnOutcome.LOCKOUT)
        self.assertEqual(result.message, LOCKOUT_MESSAGE)
        self.assertEqual(session.operator_notepad, ["follow up note"])
        self.assertEqual(llm.triage_calls, 0)

    def test_escalate_sets_flag(self):
        session = SessionState()
        session.assigned_route = Route.TECH
        session.conversation_history = [
            {"role": "user", "parts": ["help"]},
            {"role": "model", "parts": ["ok"]},
        ]
        llm = FakeLLM()
        result = process_turn(session, "escalate", client=llm)
        self.assertEqual(result.outcome, TurnOutcome.ESCALATED)
        self.assertTrue(session.is_escalated)
        self.assertEqual(llm.persona_calls, 0)


class TestRouting(unittest.TestCase):
    def test_triage_on_first_turn(self):
        session = SessionState()
        llm = FakeLLM(triage_route="billing")
        result = process_turn(session, "invoice question", client=llm)
        self.assertEqual(result.outcome, TurnOutcome.RESPONDED)
        self.assertEqual(session.assigned_route, Route.BILLING)
        self.assertEqual(llm.triage_calls, 1)
        self.assertEqual(len(session.conversation_history), 2)

    def test_sticky_skips_triage(self):
        session = SessionState(assigned_route=Route.TECH)
        llm = FakeLLM()
        process_turn(session, "still broken", client=llm)
        self.assertEqual(llm.triage_calls, 0)
        self.assertEqual(llm.persona_calls, 1)

    def test_triage_failure(self):
        session = SessionState()
        llm = FakeLLM()
        llm.triage = lambda _: '{"route": "unknown"}'
        result = process_turn(session, "hello", client=llm)
        self.assertEqual(result.outcome, TurnOutcome.TRIAGE_FAILED)
        self.assertIsNone(session.assigned_route)
        self.assertEqual(session.conversation_history, [])

    def test_weather_question_routes_misc_and_responds(self):
        session = SessionState()
        llm = FakeLLM(
            triage_route="misc",
            reply="I cannot fetch live weather, but you can check weather.com for your city.",
        )
        result = process_turn(
            session, "What is the weather like in Boston today?", client=llm
        )
        self.assertEqual(result.outcome, TurnOutcome.RESPONDED)
        self.assertEqual(session.assigned_route, Route.MISC)
        self.assertEqual(llm.persona_calls, 1)
        self.assertIn("weather", result.message.lower())

    def test_weather_fallback_when_triage_invalid(self):
        session = SessionState()
        llm = FakeLLM(reply="Sunny and warm is typical for summer in many regions.")
        llm.triage = lambda _: "not valid json"
        result = process_turn(session, "What's the weather tomorrow?", client=llm)
        self.assertEqual(result.outcome, TurnOutcome.RESPONDED)
        self.assertEqual(session.assigned_route, Route.MISC)
        self.assertEqual(llm.persona_calls, 1)


class TestRoutingHints(unittest.TestCase):
    def test_weather_detected_as_misc(self):
        self.assertTrue(looks_like_misc_question("What is the weather today?"))

    def test_billing_not_misc(self):
        self.assertFalse(looks_like_misc_question("I need a refund on my invoice"))


class TestCleanup(unittest.TestCase):
    def test_cleanup_writes_summary(self):
        session = SessionState(assigned_route=Route.MISC)
        summary = cleanup_session(session, transcript_dir="/tmp/agentic_test_transcripts")
        self.assertIn("Transcript saved", summary)
        self.assertIn("route=misc", summary)


if __name__ == "__main__":
    unittest.main()
