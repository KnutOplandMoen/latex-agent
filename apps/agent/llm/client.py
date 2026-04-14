"""Thin wrapper around the Anthropic async client with prompt caching."""

from __future__ import annotations

from typing import Any

import anthropic

from config import ANTHROPIC_API_KEY

_client: anthropic.AsyncAnthropic | None = None


def get_client() -> anthropic.AsyncAnthropic:
    global _client
    if _client is None:
        _client = anthropic.AsyncAnthropic(api_key=ANTHROPIC_API_KEY)
    return _client


def build_system_blocks(
    role_prompt: str,
    project_context: str,
) -> list[dict[str, Any]]:
    """Build system prompt blocks with cache_control on the stable prefix.

    The role prompt + tool descriptions are stable across turns and get cached.
    The project context (section map, compile errors) changes per turn.
    """
    blocks: list[dict[str, Any]] = []

    # Stable prefix — cacheable
    blocks.append({
        "type": "text",
        "text": role_prompt,
        "cache_control": {"type": "ephemeral"},
    })

    # Dynamic context — not cached
    if project_context:
        blocks.append({
            "type": "text",
            "text": project_context,
        })

    return blocks
