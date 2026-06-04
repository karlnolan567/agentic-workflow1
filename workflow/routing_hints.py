"""Heuristics when triage JSON fails but the message is clearly a general/misc question."""

from __future__ import annotations

# Substrings that suggest a general (non-product-support) question → misc
_MISC_TOPIC_MARKERS = (
    "weather",
    "forecast",
    "temperature",
    "going to rain",
    "going to snow",
    "will it rain",
    "will it snow",
    "how hot",
    "how cold",
    "humidity",
    "what day is",
    "what time is",
    "who is the president",
    "capital of",
)

# If present, prefer LLM triage over misc heuristic (product support context)
_SUPPORT_CONTEXT_MARKERS = (
    "invoice",
    "refund",
    "subscription",
    "payment",
    "charged",
    "bug",
    "error",
    "crash",
    "login",
    "password",
    "feature request",
    "how do i",
    "how to",
    "export",
    "account settings",
)


def looks_like_misc_question(user_text: str) -> bool:
    """True when the message is likely a general/off-topic question for route misc."""
    lower = user_text.lower()
    if any(marker in lower for marker in _SUPPORT_CONTEXT_MARKERS):
        return False
    return any(marker in lower for marker in _MISC_TOPIC_MARKERS)
