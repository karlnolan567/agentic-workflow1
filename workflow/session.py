from __future__ import annotations

from dataclasses import dataclass, field

from workflow.routes import Route


@dataclass
class SessionState:
    conversation_history: list[dict] = field(default_factory=list)
    assigned_route: Route | None = None
    is_escalated: bool = False
    operator_notepad: list[str] = field(default_factory=list)

    def turn_count(self) -> int:
        """Number of completed user/model exchanges in conversation_history."""
        return len(self.conversation_history) // 2
