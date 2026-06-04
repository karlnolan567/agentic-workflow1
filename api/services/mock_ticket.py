from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone

from sqlalchemy.orm import Session as OrmSession

from api.db.models import EscalationRecord
from workflow.escalation import build_triage_payload
from workflow.session import SessionState


def create_mock_ticket(
    db: OrmSession,
    session_id: str,
    state: SessionState,
) -> str:
    ticket_id = f"DEMO-{uuid.uuid4().hex[:8].upper()}"
    payload = build_triage_payload(state)
    payload["ticket_id"] = ticket_id
    payload["session_id"] = session_id
    record = EscalationRecord(
        session_id=session_id,
        ticket_id=ticket_id,
        payload_json=json.dumps(payload, indent=2),
    )
    db.add(record)
    db.commit()
    return ticket_id
