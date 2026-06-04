from __future__ import annotations

from dataclasses import dataclass
from enum import Enum, auto

from workflow.escalation import spawn_triage_payload_writer
from workflow.kb import append_kb_citations
from workflow.llm import GeminiClient, LLMClient, parse_triage_response
from workflow.routes import ESCALATE_COMMAND, EXIT_VALUES, LOCKOUT_MESSAGE, Route
from workflow.routing_hints import looks_like_misc_question
from workflow.session import SessionState


class TurnOutcome(Enum):
    SESSION_ENDED = auto()
    LOCKOUT = auto()
    ESCALATED = auto()
    TRIAGE_FAILED = auto()
    RESPONDED = auto()


@dataclass
class TurnResult:
    outcome: TurnOutcome
    message: str | None = None


def cleanup_session(session: SessionState, transcript_dir: str = "transcripts") -> str:
    from datetime import datetime, timezone
    from pathlib import Path

    Path(transcript_dir).mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    path = Path(transcript_dir) / f"session_{stamp}.txt"
    lines = [
        f"Route: {session.assigned_route.value if session.assigned_route else 'none'}",
        f"Escalated: {session.is_escalated}",
        f"Turns: {session.turn_count()}",
        "",
        "--- Conversation ---",
    ]
    for entry in session.conversation_history:
        role = entry.get("role", "?")
        parts = entry.get("parts", [""])
        text = parts[0] if parts else ""
        lines.append(f"{role}: {text}")
    if session.operator_notepad:
        lines.extend(["", "--- Operator notes ---"])
        lines.extend(session.operator_notepad)
    content = "\n".join(lines)
    path.write_text(content, encoding="utf-8")
    summary = (
        f"Session ended. Transcript saved to {path} "
        f"({session.turn_count()} turn(s), "
        f"route={session.assigned_route.value if session.assigned_route else 'none'})."
    )
    return summary


def phase_a(
    session: SessionState, user_input: str
) -> TurnResult | None:
    """Returns TurnResult if the turn should stop; None to continue pipeline."""
    if user_input in EXIT_VALUES:
        summary = cleanup_session(session)
        return TurnResult(TurnOutcome.SESSION_ENDED, summary)

    if user_input.strip().lower() == ESCALATE_COMMAND:
        if not session.is_escalated:
            session.is_escalated = True
            spawn_triage_payload_writer(session)
            return TurnResult(
                TurnOutcome.ESCALATED,
                "You have been escalated to a human specialist. "
                "Further messages will be added as notes for the operator. "
                "Type exit or Exit when you are done.",
            )
        return TurnResult(
            TurnOutcome.ESCALATED,
            "You are already queued for a human specialist.",
        )

    if session.is_escalated:
        session.operator_notepad.append(user_input)
        return TurnResult(TurnOutcome.LOCKOUT, LOCKOUT_MESSAGE)

    return None


def phase_b(session: SessionState, user_input: str, client: LLMClient) -> TurnResult | str:
    """Returns route string on success, or TurnResult on triage failure."""
    if session.assigned_route is not None:
        return session.assigned_route.value

    raw = client.triage(user_input)
    route = parse_triage_response(raw)
    if route is None and looks_like_misc_question(user_input):
        route = Route.MISC.value
    if route is None:
        return TurnResult(
            TurnOutcome.TRIAGE_FAILED,
            "We could not classify your request. Please rephrase your question "
            "so we can route you to the right specialist.",
        )
    session.assigned_route = Route(route)
    return route


def phase_c(
    session: SessionState,
    user_input: str,
    route: str,
    client: LLMClient,
    *,
    append_citations: bool = True,
) -> str:
    reply = client.generate_persona(
        route, session.conversation_history, user_input
    )
    if append_citations:
        reply = append_kb_citations(reply, user_input)
    session.conversation_history.append(
        {"role": "user", "parts": [user_input]}
    )
    session.conversation_history.append(
        {"role": "model", "parts": [reply]}
    )
    return reply


def process_turn(
    session: SessionState, user_input: str, client: LLMClient | None = None
) -> TurnResult:
    early = phase_a(session, user_input)
    if early is not None:
        return early

    llm = client or GeminiClient()
    route_result = phase_b(session, user_input, llm)
    if isinstance(route_result, TurnResult):
        return route_result

    reply = phase_c(session, user_input, route_result, llm)
    return TurnResult(TurnOutcome.RESPONDED, reply)


def process_turn_stream(
    session: SessionState, user_input: str, client: LLMClient | None = None
):
    """Yield (event_type, payload) tuples for SSE. Phase C streams tokens."""
    early = phase_a(session, user_input)
    if early is not None:
        yield ("done", early)
        return

    llm = client or GeminiClient()
    route_result = phase_b(session, user_input, llm)
    if isinstance(route_result, TurnResult):
        yield ("done", route_result)
        return

    route = route_result
    chunks: list[str] = []
    for token in llm.stream_persona(
        route, session.conversation_history, user_input
    ):
        chunks.append(token)
        yield ("token", token)

    reply = "".join(chunks)
    reply = append_kb_citations(reply, user_input)
    session.conversation_history.append({"role": "user", "parts": [user_input]})
    session.conversation_history.append({"role": "model", "parts": [reply]})
    yield ("done", TurnResult(TurnOutcome.RESPONDED, reply))


ESCALATION_HINT = (
    "\n\n---\n"
    "Type escalate to Escalate to a Human Specialist, "
    "or continue with your next message. Type exit or Exit to end the session."
)
