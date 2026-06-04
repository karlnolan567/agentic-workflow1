from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class SessionRecord(Base):
    __tablename__ = "sessions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    assigned_route: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    is_escalated: Mapped[bool] = mapped_column(Boolean, default=False)
    history_json: Mapped[str] = mapped_column(Text, default="[]")
    operator_notepad_json: Mapped[str] = mapped_column(Text, default="[]")
    ticket_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    csat_rating: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)
    csat_comment: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    transcript_path: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    escalations: Mapped[list[EscalationRecord]] = relationship(
        back_populates="session",
        cascade="all, delete-orphan",
    )


class EscalationRecord(Base):
    __tablename__ = "escalations"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    session_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("sessions.id"), nullable=False
    )
    ticket_id: Mapped[str] = mapped_column(String(64), nullable=False)
    payload_json: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )

    session: Mapped[SessionRecord] = relationship(back_populates="escalations")
