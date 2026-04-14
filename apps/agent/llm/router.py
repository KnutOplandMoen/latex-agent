"""Model selection based on agent mode and task complexity."""

from __future__ import annotations

from agents.types import AgentMode

# Models — update when new versions ship
SONNET = "claude-sonnet-4-20250514"
HAIKU = "claude-haiku-4-20250414"


def pick_model(mode: AgentMode, tool_call_count: int = 0) -> str:
    """Choose the right Claude model based on the agent mode.

    General mode uses Sonnet for quality writing and reasoning.
    Debug mode uses Sonnet too — error diagnosis needs reasoning.
    We may route simple follow-ups to Haiku in the future.
    """
    if mode == AgentMode.DEBUG:
        return SONNET

    return SONNET
