# Agentic Support Workflow

Tier 1 native Python implementation of the conversational support agent defined in [REQUIREMENTS.md](REQUIREMENTS.md).

Requires **Python 3.9+**.

## Setup

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Copy `.env.example` to `.env` (or edit the existing `.env`):

```
GEMINI_API_KEY=your-key-here
GEMINI_MODEL=gemini-2.5-flash-lite
```

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | Yes | API key (`GOOGLE_API_KEY` also works) |
| `GEMINI_MODEL` | No | Model for triage and persona (default: `gemini-2.5-flash-lite`) |

The app loads `.env` automatically on startup.

## Run

```bash
python main.py
```

## Types of messages this agent handles

On the **first message** of a session, the Triage Hub classifies your text into one of four support routes. That route stays fixed for all follow-ups in the same session (sticky context).

### Support topics (routed automatically)

| Route | Handles | Example user messages |
|-------|---------|-------------------------|
| **billing** | Invoices, payments, refunds, subscriptions, account charges | “Why was I charged twice?” · “How do I get a refund?” · “Update my payment method” |
| **tech** | Bugs, errors, login problems, product malfunctions | “The app crashes on login” · “I get a 500 error” · “This button does nothing” |
| **feature** | How-to questions, product workflows, feature availability, feature requests | “How do I export my data?” · “Do you support SSO?” · “Can you add dark mode?” |
| **misc** | General support, off-topic, and general-knowledge questions (including weather) | “What’s the weather in Boston?” · “I need help with my account” · “Who do I contact about partnerships?” |

Follow-up messages stay on the same route even if wording shifts slightly (e.g. a billing user asking a tangential question still goes to the billing persona, which will try its best to help).

If triage cannot classify a first message, you are asked to **rephrase**; no route is assigned until classification succeeds.

### Session control messages (not sent to the AI persona)

| Input | When to use |
|-------|-------------|
| `escalate` | Hand off to a human; AI stops replying and further text is logged as operator notes |
| `exit` or `Exit` | End the session and save a transcript (works anytime, including after escalation) |

After escalation, normal chat messages are **notes for a human operator**, not new AI requests. The agent replies with a fixed queue message until you end the session.

### Human handoff

When a user escalates, context is written to `triage_payloads/*.json` for a support agent to pick up outside this CLI. See [REQUIREMENTS.md](REQUIREMENTS.md) for the full lifecycle.

## CLI commands

| Input | Action |
|-------|--------|
| Your message | Routed through Triage Hub (first successful turn) then Persona (sticky route) |
| `escalate` | Escalate to a Human Specialist; writes Triage Payload under `triage_payloads/` |
| `exit` or `Exit` | End session; saves transcript under `transcripts/` |

After each assistant reply, you can continue chatting or type `escalate`.

## Layout

```
workflow/
  session.py      # Session state
  routes.py       # Route enum and constants
  prompts.py      # Domain system instructions
  llm.py          # Gemini Triage Hub + Persona
  engine.py       # Phases A–C orchestration
  escalation.py   # Background Triage Payload writer
  cli.py          # Interactive loop
main.py
tests/test_engine.py
```

## Tests

```bash
python -m unittest discover -s tests -v
```

Tests mock the LLM layer; no API key required for unit tests.

## Models

Uses the [Google Gen AI SDK](https://github.com/googleapis/python-genai) (`google-genai`), not the deprecated `google-generativeai` package.

- **Model ID:** `GEMINI_MODEL` from `.env` (default `gemini-2.5-flash-lite`) for both Triage Hub and Persona
- **Triage Hub:** temperature `0.0`, JSON response
- **Persona:** temperature `0.7`
