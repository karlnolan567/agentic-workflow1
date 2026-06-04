# Agentic Support Workflow

Tier 1 native Python orchestration with a **Phase 2 web app**: FastAPI backend, Next.js chat UI, SQLite persistence, SSE streaming, and portfolio demo features (mock account context, KB citations, CSAT).

Requires **Python 3.9+** and **Node 20+** for the web UI.

## Setup

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Copy `.env.example` to `.env`:

```
GEMINI_API_KEY=your-key-here
GEMINI_MODEL=gemini-2.5-flash-lite
```

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | Yes (web/API) | API key (`GOOGLE_API_KEY` also works) |
| `GEMINI_MODEL` | No | Model for triage and persona (default: `gemini-2.5-flash-lite`) |
| `DATABASE_URL` | No | SQLite path (default: `data/app.db`) |
| `CORS_ORIGINS` | No | Comma-separated origins (default: `http://localhost:3000`) |

## Run the web app (Phase 2)

**Terminal 1 — API**

```bash
source .venv/bin/activate
uvicorn api.main:app --reload --port 8000
```

**Terminal 2 — Web**

```bash
cd web
cp .env.local.example .env.local
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) → **Start conversation**.

### Docker (optional)

```bash
export GEMINI_API_KEY=your-key
docker compose up --build
```

## Run the CLI (Phase 1)

```bash
python main.py
```

| Input | Action |
|-------|--------|
| Your message | Triage (first turn) → Persona (sticky route) |
| `escalate` | Human handoff; writes `triage_payloads/*.json` |
| `exit` / `Exit` | End session; saves `transcripts/*.txt` |

## Web features

- Landing page and full-screen chat with markdown replies
- **SSE streaming** for assistant responses + typing indicator
- Route badge after triage (billing / tech / feature / misc)
- Escalate (confirm modal) → mock ticket ID (`DEMO-…`) + lockout notes mode
- End chat → CSAT (thumbs + comment) + transcript download
- Dark / light theme (system default)
- Collapsible **demo account context** panel
- **KB citations** appended from `data/kb_articles.json` when keywords match

## API endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check |
| POST | `/api/sessions` | Create session |
| GET | `/api/sessions/demo-context` | Demo account metadata |
| GET | `/api/sessions/{id}` | Session state + messages |
| POST | `/api/sessions/{id}/messages` | Send message (JSON response) |
| POST | `/api/sessions/{id}/messages/stream` | Send message (SSE) |
| POST | `/api/sessions/{id}/escalate` | Escalate to human |
| POST | `/api/sessions/{id}/end` | End session + transcript |
| POST | `/api/sessions/{id}/csat` | Submit CSAT |
| GET | `/api/sessions/{id}/transcript` | Download transcript file |

## Layout

```
workflow/           # Tier 1 engine (phases A–C), LLM, KB, demo context
api/                # FastAPI + SQLite repositories
web/                # Next.js 15 chat UI
data/               # demo_account.json, kb_articles.json, app.db
tests/              # Engine + API tests (mocked LLM)
main.py             # CLI entry
```

## Tests

```bash
python -m unittest discover -s tests -v
```

No API key required — tests use a mocked LLM.

## Models

Uses the [Google Gen AI SDK](https://github.com/googleapis/python-genai) (`google-genai`).

- **Triage Hub:** temperature `0.0`, JSON response
- **Persona:** temperature `0.7`, demo account prefix in system instruction

See [REQUIREMENTS.md](REQUIREMENTS.md) for the full Tier 1 behavioral spec.
