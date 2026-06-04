from __future__ import annotations

import json
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.orm import Session as OrmSession

from api.db.database import get_session_factory
from api.deps import get_llm_client
from api.errors import friendly_llm_error
from api.repositories.sqlite import SQLiteSessionRepository
from api.schemas import (
    CreateSessionResponse,
    CsatRequest,
    DemoContextResponse,
    MessageRequest,
    MessageResponse,
    SessionResponse,
)
from api.services.mock_ticket import create_mock_ticket
from workflow.context import load_demo_account
from workflow.engine import TurnOutcome, cleanup_session, process_turn, process_turn_stream
from workflow.llm import GeminiClient
from workflow.routes import ESCALATE_COMMAND, EXIT_VALUES

router = APIRouter(prefix="/api/sessions", tags=["sessions"])


def get_db():
    factory = get_session_factory()
    db = factory()
    try:
        yield db
    finally:
        db.close()


def get_repo(db: OrmSession = Depends(get_db)) -> SQLiteSessionRepository:
    return SQLiteSessionRepository(db)


def _outcome_name(outcome: TurnOutcome) -> str:
    return outcome.name.lower()


def _message_response(stored, result) -> MessageResponse:
    state = stored.state
    transcript_path = None
    if result.outcome == TurnOutcome.SESSION_ENDED and result.message:
        for part in result.message.split():
            if part.endswith(".txt"):
                transcript_path = part
                stored.transcript_path = transcript_path
                break
    return MessageResponse(
        outcome=_outcome_name(result.outcome),
        message=result.message,
        assigned_route=state.assigned_route.value if state.assigned_route else None,
        is_escalated=state.is_escalated,
        turn_count=state.turn_count(),
        ticket_id=stored.ticket_id,
        transcript_path=transcript_path or stored.transcript_path,
    )


@router.post("", response_model=CreateSessionResponse)
def create_session(repo: SQLiteSessionRepository = Depends(get_repo)):
    stored = repo.create()
    return CreateSessionResponse(session_id=stored.id)


@router.get("/demo-context", response_model=DemoContextResponse)
def demo_context():
    account = load_demo_account()
    return DemoContextResponse(**account)


@router.get("/{session_id}", response_model=SessionResponse)
def get_session(session_id: str, repo: SQLiteSessionRepository = Depends(get_repo)):
    stored = repo.get(session_id)
    if stored is None:
        raise HTTPException(status_code=404, detail="Session not found")
    state = stored.state
    messages = []
    for entry in state.conversation_history:
        role = entry.get("role", "user")
        parts = entry.get("parts", [""])
        text = parts[0] if parts else ""
        ui_role = "assistant" if role == "model" else "user"
        messages.append({"role": ui_role, "content": text})
    return SessionResponse(
        session_id=stored.id,
        assigned_route=state.assigned_route.value if state.assigned_route else None,
        is_escalated=state.is_escalated,
        turn_count=state.turn_count(),
        ticket_id=stored.ticket_id,
        messages=messages,
    )


@router.post("/{session_id}/messages", response_model=MessageResponse)
def post_message(
    session_id: str,
    body: MessageRequest,
    repo: SQLiteSessionRepository = Depends(get_repo),
    db: OrmSession = Depends(get_db),
):
    stored = repo.get(session_id)
    if stored is None:
        raise HTTPException(status_code=404, detail="Session not found")

    content = body.content.strip()
    client = get_llm_client()
    try:
        result = process_turn(stored.state, content, client=client)
    except Exception as exc:
        raise HTTPException(status_code=503, detail=friendly_llm_error(exc)) from exc

    if result.outcome == TurnOutcome.ESCALATED and stored.ticket_id is None:
        stored.ticket_id = create_mock_ticket(db, session_id, stored.state)

    if result.outcome == TurnOutcome.SESSION_ENDED:
        summary = cleanup_session(stored.state)
        for part in summary.split():
            if part.endswith(".txt"):
                stored.transcript_path = part
                break
        result.message = summary

    repo.save(stored)
    return _message_response(stored, result)


@router.post("/{session_id}/messages/stream")
def post_message_stream(
    session_id: str,
    body: MessageRequest,
    repo: SQLiteSessionRepository = Depends(get_repo),
    db: OrmSession = Depends(get_db),
):
    stored = repo.get(session_id)
    if stored is None:
        raise HTTPException(status_code=404, detail="Session not found")

    content = body.content.strip()
    client = get_llm_client()

    def event_generator():
        try:
            for event_type, payload in process_turn_stream(
                stored.state, content, client=client
            ):
                if event_type == "token":
                    data = json.dumps({"type": "token", "content": payload})
                    yield f"data: {data}\n\n"
                else:
                    result = payload
                    if (
                        result.outcome == TurnOutcome.ESCALATED
                        and stored.ticket_id is None
                    ):
                        stored.ticket_id = create_mock_ticket(
                            db, session_id, stored.state
                        )
                    if result.outcome == TurnOutcome.SESSION_ENDED:
                        summary = cleanup_session(stored.state)
                        for part in summary.split():
                            if part.endswith(".txt"):
                                stored.transcript_path = part
                                break
                        result.message = summary
                    repo.save(stored)
                    resp = _message_response(stored, result)
                    data = json.dumps({"type": "done", **resp.model_dump()})
                    yield f"data: {data}\n\n"
        except Exception as exc:
            msg = friendly_llm_error(exc)
            code = "quota_exceeded" if "quota" in msg.lower() else "llm_error"
            data = json.dumps({"type": "error", "message": msg, "code": code})
            yield f"data: {data}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("/{session_id}/escalate", response_model=MessageResponse)
def escalate_session(
    session_id: str,
    repo: SQLiteSessionRepository = Depends(get_repo),
    db: OrmSession = Depends(get_db),
):
    stored = repo.get(session_id)
    if stored is None:
        raise HTTPException(status_code=404, detail="Session not found")
    result = process_turn(stored.state, ESCALATE_COMMAND, client=get_llm_client())
    if result.outcome == TurnOutcome.ESCALATED and stored.ticket_id is None:
        stored.ticket_id = create_mock_ticket(db, session_id, stored.state)
    repo.save(stored)
    return _message_response(stored, result)


@router.post("/{session_id}/end", response_model=MessageResponse)
def end_session(
    session_id: str,
    repo: SQLiteSessionRepository = Depends(get_repo),
):
    stored = repo.get(session_id)
    if stored is None:
        raise HTTPException(status_code=404, detail="Session not found")
    result = process_turn(stored.state, "exit", client=get_llm_client())
    if result.outcome == TurnOutcome.SESSION_ENDED:
        summary = cleanup_session(stored.state)
        for part in summary.split():
            if part.endswith(".txt"):
                stored.transcript_path = part
                break
        result.message = summary
    repo.save(stored)
    return _message_response(stored, result)


@router.post("/{session_id}/csat")
def submit_csat(
    session_id: str,
    body: CsatRequest,
    repo: SQLiteSessionRepository = Depends(get_repo),
):
    stored = repo.get(session_id)
    if stored is None:
        raise HTTPException(status_code=404, detail="Session not found")
    stored.csat_rating = body.rating
    stored.csat_comment = body.comment
    repo.save(stored)
    return {"ok": True}


@router.get("/{session_id}/transcript")
def download_transcript(
    session_id: str,
    repo: SQLiteSessionRepository = Depends(get_repo),
):
    stored = repo.get(session_id)
    if stored is None:
        raise HTTPException(status_code=404, detail="Session not found")
    path_str = stored.transcript_path
    if not path_str:
        raise HTTPException(status_code=404, detail="Transcript not available")
    path = Path(path_str)
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Transcript file missing")
    return FileResponse(path, filename=path.name, media_type="text/plain")
