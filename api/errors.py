from __future__ import annotations

from google.genai.errors import ClientError


def friendly_llm_error(exc: Exception) -> str:
    if isinstance(exc, ClientError):
        code = getattr(exc, "status_code", None)
        message = str(exc)
        if (code == 429 or "RESOURCE_EXHAUSTED" in message or "quota" in message.lower()):
            return (
                "Gemini API daily quota exceeded (free tier limit). "
                "Wait about a minute and retry, enable USE_DEMO_LLM=true in .env for offline demo mode, "
                "or upgrade your Google AI plan."
            )
        if code == 401 or code == 403 or "API key" in message:
            return (
                "The server API key is invalid or missing. "
                "Set GEMINI_API_KEY in .env and restart the API."
            )
        return f"The AI service returned an error. Please try again shortly."

    if isinstance(exc, RuntimeError) and "GEMINI_API_KEY" in str(exc):
        return (
            "The server is missing GEMINI_API_KEY. "
            "Add it to .env and restart: uvicorn api.main:app --reload"
        )

    return "The assistant could not respond right now. Please try again."
