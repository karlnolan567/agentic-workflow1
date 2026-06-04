from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field


class CreateSessionResponse(BaseModel):
    session_id: str


class MessageRequest(BaseModel):
    content: str = Field(..., min_length=1)


class MessageResponse(BaseModel):
    outcome: str
    message: Optional[str] = None
    assigned_route: Optional[str] = None
    is_escalated: bool = False
    turn_count: int = 0
    ticket_id: Optional[str] = None
    transcript_path: Optional[str] = None


class SessionResponse(BaseModel):
    session_id: str
    assigned_route: Optional[str] = None
    is_escalated: bool = False
    turn_count: int = 0
    ticket_id: Optional[str] = None
    messages: list = Field(default_factory=list)


class CsatRequest(BaseModel):
    rating: str = Field(..., pattern="^(up|down)$")
    comment: Optional[str] = None


class DemoContextResponse(BaseModel):
    account_name: str
    plan: str
    member_since: str
    email: str
    demo_label: str = "Demo account context — not live customer data"
