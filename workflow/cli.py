from workflow.engine import ESCALATION_HINT, TurnOutcome, process_turn
from workflow.llm import configure_api
from workflow.session import SessionState


def run_session() -> None:
    configure_api()
    session = SessionState()
    print("Support Agent — describe your issue. Type exit or Exit to end.\n")

    while True:
        try:
            user_input = input("You: ").strip()
        except (EOFError, KeyboardInterrupt):
            print()
            from workflow.engine import cleanup_session

            print(cleanup_session(session))
            break

        if not user_input:
            continue

        result = process_turn(session, user_input)

        if result.outcome == TurnOutcome.SESSION_ENDED:
            print(result.message)
            break
        if result.outcome == TurnOutcome.LOCKOUT:
            print(result.message)
            continue
        if result.outcome == TurnOutcome.ESCALATED:
            print(result.message)
            continue
        if result.outcome == TurnOutcome.TRIAGE_FAILED:
            print(result.message)
            continue
        if result.outcome == TurnOutcome.RESPONDED:
            print(f"\nAssistant: {result.message}{ESCALATION_HINT}\n")


def main() -> None:
    run_session()


if __name__ == "__main__":
    main()
