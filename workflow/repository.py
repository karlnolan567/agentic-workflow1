from __future__ import annotations

import uuid
from dataclasses import dataclass
from typing import Optional, Protocol

from workflow.routes import Route
from workflow.session import SessionState


@dataclass
class StoredSession:
    id: str
    state: SessionState
    ticket_id: Optional[str] = None
    csat_rating: Optional[str] = None
    csat_comment: Optional[str] = None
    transcript_path: Optional[str] = None


class SessionRepository(Protocol):
    def create(self) -> StoredSession: ...

    def get(self, session_id: str) -> Optional[StoredSession]: ...

    def save(self, stored: StoredSession) -> None: ...

    def delete(self, session_id: str) -> None: ...


class InMemorySessionRepository:
    def __init__(self) -> None:
        self._sessions: dict[str, StoredSession] = {}

    def create(self) -> StoredSession:
        session_id = str(uuid.uuid4())
        stored = StoredSession(id=session_id, state=SessionState())
        self._sessions[session_id] = stored
        return stored

    def get(self, session_id: str) -> Optional[StoredSession]:
        return self._sessions.get(session_id)

    def save(self, stored: StoredSession) -> None:
        self._sessions[stored.id] = stored

    def delete(self, session_id: str) -> None:
        self._sessions.pop(session_id, None)


def session_state_to_dict(state: SessionState) -> dict:
    return {
        "conversation_history": state.conversation_history,
        "assigned_route": state.assigned_route.value if state.assigned_route else None,
        "is_escalated": state.is_escalated,
        "operator_notepad": state.operator_notepad,
    }


def session_state_from_dict(data: dict) -> SessionState:
    route_val = data.get("assigned_route")
    assigned_route = Route(route_val) if route_val else None
    return SessionState(
        conversation_history=list(data.get("conversation_history", [])),
        assigned_route=assigned_route,
        is_escalated=bool(data.get("is_escalated", False)),
        operator_notepad=list(data.get("operator_notepad", [])),
    )
