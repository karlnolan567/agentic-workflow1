from enum import Enum


class Route(str, Enum):
    BILLING = "billing"
    TECH = "tech"
    FEATURE = "feature"
    MISC = "misc"


VALID_ROUTES = frozenset(r.value for r in Route)

LOCKOUT_MESSAGE = (
    "Your session is currently queued for a human support representative. "
    "Notes added."
)

ESCALATE_COMMAND = "escalate"
EXIT_VALUES = frozenset({"exit", "Exit"})
