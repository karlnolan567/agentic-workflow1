from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Protocol

from dotenv import load_dotenv
from google import genai
from google.genai import types

from workflow.prompts import PERSONA_BY_ROUTE, TRIAGE_SYSTEM_PROMPT
from workflow.routes import VALID_ROUTES

DEFAULT_MODEL = "gemini-2.5-flash-lite"
TRIAGE_TEMPERATURE = 0.0
PERSONA_TEMPERATURE = 0.7

_ENV_LOADED = False
_client: genai.Client | None = None


def _ensure_env_loaded() -> None:
    global _ENV_LOADED
    if not _ENV_LOADED:
        load_dotenv(Path(__file__).resolve().parents[1] / ".env")
        _ENV_LOADED = True


def get_api_key() -> str:
    _ensure_env_loaded()
    return (
        os.environ.get("GEMINI_API_KEY", "").strip()
        or os.environ.get("GOOGLE_API_KEY", "").strip()
    )


def get_model_name() -> str:
    _ensure_env_loaded()
    return os.environ.get("GEMINI_MODEL", DEFAULT_MODEL).strip() or DEFAULT_MODEL


def get_client() -> genai.Client:
    global _client
    if _client is None:
        configure_api()
    return _client


def configure_api() -> None:
    global _client
    api_key = get_api_key()
    if not api_key:
        raise RuntimeError(
            "GEMINI_API_KEY (or GOOGLE_API_KEY) is required. Set it in .env or your environment."
        )
    _client = genai.Client(api_key=api_key)


def _entry_to_content(entry: dict) -> types.Content:
    role = entry.get("role", "user")
    parts = entry.get("parts", [])
    text = parts[0] if parts else ""
    return types.Content(
        role=role,
        parts=[types.Part.from_text(text=text)],
    )


def _build_persona_contents(
    conversation_history: list[dict], user_text: str
) -> list[types.Content]:
    contents = [_entry_to_content(entry) for entry in conversation_history]
    contents.append(
        types.Content(
            role="user",
            parts=[types.Part.from_text(text=user_text)],
        )
    )
    return contents


class LLMClient(Protocol):
    def triage(self, user_text: str) -> str: ...

    def generate_persona(
        self, route: str, conversation_history: list[dict], user_text: str
    ) -> str: ...


class GeminiClient:
    def triage(self, user_text: str) -> str:
        response = get_client().models.generate_content(
            model=get_model_name(),
            contents=user_text,
            config=types.GenerateContentConfig(
                system_instruction=TRIAGE_SYSTEM_PROMPT,
                temperature=TRIAGE_TEMPERATURE,
                response_mime_type="application/json",
            ),
        )
        return response.text or ""

    def generate_persona(
        self, route: str, conversation_history: list[dict], user_text: str
    ) -> str:
        system_instruction = PERSONA_BY_ROUTE[route]
        response = get_client().models.generate_content(
            model=get_model_name(),
            contents=_build_persona_contents(conversation_history, user_text),
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                temperature=PERSONA_TEMPERATURE,
            ),
        )
        return response.text or ""


def parse_triage_response(raw: str) -> str | None:
    """Return route string if valid, else None."""
    try:
        data = json.loads(raw.strip())
    except json.JSONDecodeError:
        return None
    if not isinstance(data, dict):
        return None
    route = data.get("route")
    if not isinstance(route, str):
        return None
    route = route.strip().lower()
    if route not in VALID_ROUTES:
        return None
    return route
