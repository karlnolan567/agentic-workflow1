from __future__ import annotations

import json
from pathlib import Path

_DEMO_ACCOUNT_PATH = Path(__file__).resolve().parents[1] / "data" / "demo_account.json"


def load_demo_account() -> dict:
    if not _DEMO_ACCOUNT_PATH.exists():
        return {
            "account_name": "Demo User",
            "plan": "Pro",
            "member_since": "2024-03-15",
            "email": "demo.user@example.com",
        }
    return json.loads(_DEMO_ACCOUNT_PATH.read_text(encoding="utf-8"))


def demo_context_prompt_prefix() -> str:
    account = load_demo_account()
    return (
        "[Demo account context — not live customer data]\n"
        f"Account: {account.get('account_name', 'Demo User')}\n"
        f"Plan: {account.get('plan', 'Pro')}\n"
        f"Member since: {account.get('member_since', 'unknown')}\n"
        f"Email: {account.get('email', 'demo@example.com')}\n\n"
    )
