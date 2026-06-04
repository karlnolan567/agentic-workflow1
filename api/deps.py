from __future__ import annotations

import os

from workflow.llm import GeminiClient, LLMClient

from typing import Optional

_llm_override: Optional[LLMClient] = None


def get_llm_client() -> LLMClient:
    if _llm_override is not None:
        return _llm_override
    if os.environ.get("USE_DEMO_LLM", "").lower() in ("1", "true", "yes"):
        from workflow.demo_llm import DemoLLM

        return DemoLLM()
    return GeminiClient()


def set_llm_client(client: Optional[LLMClient]) -> None:
    global _llm_override
    _llm_override = client


def is_testing() -> bool:
    return os.environ.get("TESTING", "").lower() in ("1", "true", "yes")
