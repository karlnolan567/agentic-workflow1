"""Offline demo LLM for portfolio use when Gemini quota/key is unavailable."""

from __future__ import annotations

from workflow.prompts import PERSONA_BY_ROUTE
from workflow.routes import Route


class DemoLLM:
    """Rule-based responses — no external API calls."""

    def triage(self, user_text: str) -> str:
        lower = user_text.lower()
        if any(w in lower for w in ("invoice", "charge", "refund", "billing", "payment")):
            route = Route.BILLING.value
        elif any(w in lower for w in ("crash", "error", "login", "bug", "broken")):
            route = Route.TECH.value
        elif any(w in lower for w in ("export", "how do", "how to", "feature")):
            route = Route.FEATURE.value
        else:
            route = Route.MISC.value
        return f'{{"route": "{route}"}}'

    def generate_persona(
        self, route: str, conversation_history: list, user_text: str
    ) -> str:
        return self._reply(route, user_text)

    def stream_persona(
        self, route: str, conversation_history: list, user_text: str
    ):
        text = self._reply(route, user_text)
        for word in text.split():
            yield word + " "

    def _reply(self, route: str, user_text: str) -> str:
        lower = user_text.lower()
        if route == Route.TECH.value:
            if "login" in lower or "crash" in lower:
                return (
                    "Thanks for reporting the login issue. Try these steps:\n\n"
                    "1. Clear your browser cache and cookies\n"
                    "2. Disable browser extensions temporarily\n"
                    "3. Try an incognito/private window\n\n"
                    "Does the crash happen on a specific device or browser?"
                )
            return (
                "I'll help troubleshoot this technical issue. "
                "Can you tell me when the problem started and whether you see an error message?"
            )
        if route == Route.BILLING.value:
            return (
                "I can help with billing. Please check your latest invoice under "
                "Account → Billing. If you were charged twice, note the dates and amounts "
                "and I can walk you through a refund request."
            )
        if route == Route.FEATURE.value:
            return (
                "To export your data, go to Settings → Data → Export CSV. "
                "The file will be emailed to you within a few minutes."
            )
        if "weather" in lower:
            return (
                "I can't fetch live weather, but you can check weather.com or your "
                "device's weather app for Boston's current forecast."
            )
        return (
            f"I'm your {route} support specialist (demo mode). "
            "Tell me a bit more and I'll do my best to help."
        )
