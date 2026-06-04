from __future__ import annotations

import json
import threading
from datetime import datetime, timezone
from pathlib import Path

from workflow.session import SessionState

TRIAGE_PAYLOAD_DIR = Path("triage_payloads")


def _serialize_history(history: list[dict]) -> list[dict]:
    lines = []
    for entry in history:
        role = entry.get("role", "unknown")
        parts = entry.get("parts", [])
        text = parts[0] if parts else ""
        lines.append({"role": role, "text": text})
    return lines


def build_triage_payload(session: SessionState) -> dict:
    return {
        "assigned_route": session.assigned_route.value if session.assigned_route else None,
        "turn_count": session.turn_count(),
        "conversation_history": _serialize_history(session.conversation_history),
        "operator_notepad": list(session.operator_notepad),
        "escalated_at": datetime.now(timezone.utc).isoformat(),
    }


def write_triage_payload(session: SessionState) -> None:
    TRIAGE_PAYLOAD_DIR.mkdir(parents=True, exist_ok=True)
    payload = build_triage_payload(session)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    path = TRIAGE_PAYLOAD_DIR / f"triage_{stamp}.json"
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def spawn_triage_payload_writer(session: SessionState) -> None:
    """REQ-ESC-03: write Triage Payload in a background thread."""
    thread = threading.Thread(
        target=write_triage_payload,
        args=(session,),
        daemon=True,
    )
    thread.start()
