from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone

from sqlalchemy.orm import Session as OrmSession

from api.db.models import SessionRecord
from workflow.repository import (
    StoredSession,
    session_state_from_dict,
    session_state_to_dict,
)
from workflow.session import SessionState


class SQLiteSessionRepository:
    def __init__(self, db: OrmSession) -> None:
        self._db = db

    def create(self) -> StoredSession:
        session_id = str(uuid.uuid4())
        row = SessionRecord(
            id=session_id,
            history_json=json.dumps([]),
            operator_notepad_json=json.dumps([]),
        )
        self._db.add(row)
        self._db.commit()
        self._db.refresh(row)
        return self._to_stored(row)

    def get(self, session_id: str):
        row = self._db.get(SessionRecord, session_id)
        if row is None:
            return None
        return self._to_stored(row)

    def save(self, stored: StoredSession) -> None:
        row = self._db.get(SessionRecord, stored.id)
        if row is None:
            raise KeyError(f"Session {stored.id} not found")
        state = stored.state
        row.assigned_route = (
            state.assigned_route.value if state.assigned_route else None
        )
        row.is_escalated = state.is_escalated
        row.history_json = json.dumps(state.conversation_history)
        row.operator_notepad_json = json.dumps(state.operator_notepad)
        row.ticket_id = stored.ticket_id
        row.csat_rating = stored.csat_rating
        row.csat_comment = stored.csat_comment
        row.transcript_path = stored.transcript_path
        row.updated_at = datetime.now(timezone.utc)
        self._db.commit()

    def delete(self, session_id: str) -> None:
        row = self._db.get(SessionRecord, session_id)
        if row:
            self._db.delete(row)
            self._db.commit()

    def _to_stored(self, row: SessionRecord) -> StoredSession:
        data = {
            "conversation_history": json.loads(row.history_json or "[]"),
            "assigned_route": row.assigned_route,
            "is_escalated": row.is_escalated,
            "operator_notepad": json.loads(row.operator_notepad_json or "[]"),
        }
        return StoredSession(
            id=row.id,
            state=session_state_from_dict(data),
            ticket_id=row.ticket_id,
            csat_rating=row.csat_rating,
            csat_comment=row.csat_comment,
            transcript_path=row.transcript_path,
        )
