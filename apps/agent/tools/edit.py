"""Edit tool — search/replace with 4-layer matching fallback.

This is the highest-leverage piece of agent reliability. The layered
fallback handles common LLM mistakes: wrong whitespace, wrong indentation,
and slight paraphrasing.
"""

from __future__ import annotations

import difflib
import re
from typing import Any

from agents.types import AgentEvent, EditProposed
from db import get_file_by_path
from tools.registry import register_tool


class EditApplyError(Exception):
    def __init__(self, message: str, file_excerpt: str, search_attempted: str):
        self.message = message
        self.file_excerpt = file_excerpt
        self.search_attempted = search_attempted
        super().__init__(message)


def apply_edit(file_content: str, search: str, replace: str) -> str:
    """Apply a search/replace edit with layered fallback.

    Layer 1: Exact string match
    Layer 2: Whitespace-normalized match
    Layer 3: Indentation-flexible match
    Layer 4: Fuzzy match (difflib, threshold 0.85)

    Raises EditApplyError with diagnostic info if all layers fail.
    """
    # Layer 1: Exact match
    if search in file_content:
        return file_content.replace(search, replace, 1)

    # Layer 2: Whitespace-normalized match
    result = _try_whitespace_normalized(file_content, search, replace)
    if result is not None:
        return result

    # Layer 3: Indentation-flexible match
    result = _try_flexible_indent(file_content, search, replace)
    if result is not None:
        return result

    # Layer 4: Fuzzy match
    result = _try_fuzzy_match(file_content, search, replace, threshold=0.85)
    if result is not None:
        return result

    # All layers failed — build diagnostic
    similar = _find_similar_region(file_content, search)
    excerpt = similar if similar else file_content[:2000]
    raise EditApplyError(
        message="Could not find the search block in the file.",
        file_excerpt=excerpt,
        search_attempted=search,
    )


def _normalize_ws(s: str) -> str:
    """Collapse all whitespace runs to a single space."""
    return re.sub(r"\s+", " ", s).strip()


def _try_whitespace_normalized(content: str, search: str, replace: str) -> str | None:
    """Match after collapsing whitespace, then replace in the original."""
    norm_content = _normalize_ws(content)
    norm_search = _normalize_ws(search)

    if norm_search not in norm_content:
        return None

    # Find the match location by scanning through the original content
    # with a sliding window approach
    search_lines = search.splitlines()
    content_lines = content.splitlines()

    if not search_lines:
        return None

    # Try to find a contiguous block of lines that matches when normalized
    search_len = len(search_lines)
    for start_idx in range(len(content_lines) - search_len + 1):
        candidate = "\n".join(content_lines[start_idx : start_idx + search_len])
        if _normalize_ws(candidate) == norm_search:
            before = "\n".join(content_lines[:start_idx])
            after = "\n".join(content_lines[start_idx + search_len :])
            parts = [p for p in [before, replace, after] if p]
            return "\n".join(parts)

    return None


def _try_flexible_indent(content: str, search: str, replace: str) -> str | None:
    """Match after stripping leading whitespace, then re-apply indentation."""
    search_lines = search.splitlines()
    content_lines = content.splitlines()

    if not search_lines:
        return None

    stripped_search = [line.lstrip() for line in search_lines]
    search_len = len(search_lines)

    for start_idx in range(len(content_lines) - search_len + 1):
        candidate_lines = content_lines[start_idx : start_idx + search_len]
        stripped_candidate = [line.lstrip() for line in candidate_lines]

        if stripped_candidate == stripped_search:
            # Calculate the indentation offset from the first non-empty line
            indent_offset = ""
            for orig_line, search_line in zip(candidate_lines, search_lines):
                orig_indent = len(orig_line) - len(orig_line.lstrip())
                search_indent = len(search_line) - len(search_line.lstrip())
                offset = orig_indent - search_indent
                if offset != 0 and orig_line.strip():
                    indent_offset = " " * abs(offset) if offset > 0 else ""
                    break

            # Apply the same indentation offset to the replacement
            if indent_offset:
                replace_lines = replace.splitlines()
                adjusted = []
                for rline in replace_lines:
                    if rline.strip():
                        adjusted.append(indent_offset + rline)
                    else:
                        adjusted.append(rline)
                replace = "\n".join(adjusted)

            before = "\n".join(content_lines[:start_idx])
            after = "\n".join(content_lines[start_idx + search_len :])
            parts = [p for p in [before, replace, after] if p]
            return "\n".join(parts)

    return None


def _try_fuzzy_match(
    content: str, search: str, replace: str, threshold: float = 0.85
) -> str | None:
    """Use difflib SequenceMatcher to find the closest matching block."""
    content_lines = content.splitlines()
    search_lines = search.splitlines()
    search_len = len(search_lines)

    if not search_lines or not content_lines:
        return None

    best_ratio = 0.0
    best_start = -1
    best_len = search_len

    # Search with some flexibility on block size (±20%)
    min_len = max(1, int(search_len * 0.8))
    max_len = int(search_len * 1.2) + 1

    for window_len in range(min_len, min(max_len, len(content_lines) + 1)):
        for start_idx in range(len(content_lines) - window_len + 1):
            candidate = "\n".join(content_lines[start_idx : start_idx + window_len])
            ratio = difflib.SequenceMatcher(None, search, candidate).ratio()
            if ratio > best_ratio:
                best_ratio = ratio
                best_start = start_idx
                best_len = window_len

    if best_ratio >= threshold and best_start >= 0:
        before = "\n".join(content_lines[:best_start])
        after = "\n".join(content_lines[best_start + best_len :])
        parts = [p for p in [before, replace, after] if p]
        return "\n".join(parts)

    return None


def _find_similar_region(content: str, search: str, context: int = 5) -> str:
    """Find the most similar region in the file for diagnostic purposes."""
    content_lines = content.splitlines()
    search_lines = search.splitlines()
    if not search_lines or not content_lines:
        return content[:2000]

    search_len = len(search_lines)
    best_ratio = 0.0
    best_start = 0

    for start in range(max(1, len(content_lines) - search_len + 1)):
        candidate = "\n".join(content_lines[start : start + search_len])
        ratio = difflib.SequenceMatcher(None, search, candidate).ratio()
        if ratio > best_ratio:
            best_ratio = ratio
            best_start = start

    # Show context around the best match
    region_start = max(0, best_start - context)
    region_end = min(len(content_lines), best_start + search_len + context)
    region = "\n".join(content_lines[region_start:region_end])
    return f"[Most similar region, lines {region_start + 1}-{region_end}, similarity {best_ratio:.0%}]\n\n{region}"


async def _edit_file(
    input_data: dict[str, Any],
    project_id: str,
    user_id: str,
    working_copies: dict[str, str],
    _api_bearer_token: str | None,
) -> tuple[str, list[AgentEvent]]:
    path = input_data.get("path", "")
    search = input_data.get("search", "")
    replace = input_data.get("replace", "")

    if not path:
        return "Error: 'path' is required", []
    if not search:
        return "Error: 'search' is required — must contain the text to find and replace", []

    # Get current content (working copy first, then DB)
    if path in working_copies:
        content = working_copies[path]
    else:
        from db import get_file_by_path
        file = await get_file_by_path(project_id, path)
        if file is None:
            from db import list_files as db_list_files
            available = await db_list_files(project_id)
            paths = [f["path"] for f in available]
            return f"No file at '{path}'. Available files:\n" + "\n".join(paths[:30]), []
        content = file.get("content") or ""

    try:
        new_content = apply_edit(content, search, replace)
    except EditApplyError as exc:
        return (
            f"Edit failed: {exc.message}\n\n"
            f"Your search block:\n{exc.search_attempted}\n\n"
            f"Actual file content:\n{exc.file_excerpt}"
        ), []

    # Store in working copy — the edit is proposed, not committed to DB yet
    working_copies[path] = new_content

    event = EditProposed(file=path, search=search, replace=replace)
    return f"Edit applied to '{path}' (proposed, pending user acceptance)", [event]


register_tool(
    name="edit_file",
    description=(
        "Edit a file by searching for an exact block of text and replacing it. "
        "The 'search' parameter must exactly match existing content in the file. "
        "Read the file first if you're unsure of the exact content. "
        "The edit is proposed to the user for approval before being committed."
    ),
    input_schema={
        "type": "object",
        "properties": {
            "path": {
                "type": "string",
                "description": "Relative path to the file to edit",
            },
            "search": {
                "type": "string",
                "description": "Exact text block to find in the file (must match existing content)",
            },
            "replace": {
                "type": "string",
                "description": "Text to replace the search block with",
            },
        },
        "required": ["path", "search", "replace"],
    },
    handler=_edit_file,
)
