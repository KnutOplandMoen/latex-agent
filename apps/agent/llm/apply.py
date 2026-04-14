"""Haiku-powered apply step for the Sketch+Apply pipeline.

The sketch step (Sonnet) describes a change in plain English.
This module handles the apply step: calling Haiku with the description
+ actual file content to produce precise search/replace blocks.

Haiku is forced to call the `apply_edits` tool, which gives structured
output without needing to parse free-form text.
"""

from __future__ import annotations

import logging

from llm.client import get_client
from llm.router import HAIKU

logger = logging.getLogger(__name__)

_APPLY_TOOL = {
    "name": "apply_edits",
    "description": "Apply the described changes as precise search/replace operations.",
    "input_schema": {
        "type": "object",
        "properties": {
            "edits": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "search": {
                            "type": "string",
                            "description": "Exact text block to find — must exist verbatim in the file",
                        },
                        "replace": {
                            "type": "string",
                            "description": "Text to replace it with",
                        },
                    },
                    "required": ["search", "replace"],
                },
            }
        },
        "required": ["edits"],
    },
}

_APPLY_SYSTEM = """\
You are a precise LaTeX editor. Given a file and a plain-English description of \
changes to make, produce exact search/replace operations.

Rules:
- Each search block must exist VERBATIM in the file — copy it character-for-character \
  including whitespace and indentation.
- Include 2–3 lines of surrounding context so each search block is unique in the file.
- Preserve indentation and whitespace exactly as it appears.
- Produce one edit block per logical change; group adjacent related lines into one block.
- For multiple independent changes, produce multiple edit blocks in document order.
"""


async def haiku_apply(
    file_path: str,
    file_content: str,
    description: str,
) -> list[dict[str, str]]:
    """Call Haiku to translate a plain-English description into search/replace blocks.

    Returns a list of {"search": str, "replace": str} dicts ready for apply_edit().
    Returns an empty list if Haiku produces no edits (caller should treat as an error).
    """
    client = get_client()
    try:
        response = await client.messages.create(
            model=HAIKU,
            max_tokens=4096,
            system=_APPLY_SYSTEM,
            tools=[_APPLY_TOOL],
            tool_choice={"type": "tool", "name": "apply_edits"},
            messages=[
                {
                    "role": "user",
                    "content": (
                        f"File: {file_path}\n\n"
                        f"<content>\n{file_content}\n</content>\n\n"
                        f"Changes to make: {description}"
                    ),
                }
            ],
        )
    except Exception as exc:
        logger.exception("Haiku apply call failed")
        raise RuntimeError(f"Haiku apply call failed: {exc}") from exc

    for block in response.content:
        if block.type == "tool_use" and block.name == "apply_edits":
            return block.input.get("edits", [])

    return []
