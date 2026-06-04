from __future__ import annotations

import json
from pathlib import Path

_KB_PATH = Path(__file__).resolve().parents[1] / "data" / "kb_articles.json"


def load_kb_articles() -> list[dict]:
    if not _KB_PATH.exists():
        return []
    return json.loads(_KB_PATH.read_text(encoding="utf-8"))


def find_kb_citations(user_text: str, limit: int = 2) -> list[dict]:
    lower = user_text.lower()
    matches: list[dict] = []
    for article in load_kb_articles():
        keywords = article.get("keywords", [])
        if any(kw in lower for kw in keywords):
            matches.append(article)
        if len(matches) >= limit:
            break
    return matches


def append_kb_citations(reply: str, user_text: str) -> str:
    citations = find_kb_citations(user_text)
    if not citations:
        return reply
    lines = ["", "---", "**Sources (demo KB):**"]
    for article in citations:
        title = article.get("title", "Article")
        url = article.get("url", "#")
        lines.append(f"- [{title}]({url})")
    return reply + "\n".join(lines)
