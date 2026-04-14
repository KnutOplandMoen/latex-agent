"""sketch_edit tool — Sketch+Apply two-model editing pipeline.

Sonnet calls this tool with a plain-English description of the change it wants
to make. Haiku translates that description into precise search/replace blocks
(via llm/apply.py), which are then applied using the same 4-layer fallback
logic as edit_file.

Use this tool for open-ended edits where Sonnet is deciding what to change.
Use edit_file when you already have the exact text to replace.
"""

from __future__ import annotations

from typing import Any

from agents.types import AgentEvent, EditProposed
from llm.apply import haiku_apply
from tools.edit import EditApplyError, apply_edit
from tools.registry import register_tool


async def _sketch_edit(
    input_data: dict[str, Any],
    project_id: str,
    user_id: str,
    working_copies: dict[str, str],
    _api_bearer_token: str | None,
) -> tuple[str, list[AgentEvent]]:
    path = input_data.get("path", "")
    description = input_data.get("description", "")

    if not path:
        return "Error: 'path' is required", []
    if not description:
        return "Error: 'description' is required", []

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

    # Ask Haiku to produce precise search/replace blocks
    try:
        edits = await haiku_apply(path, content, description)
    except RuntimeError as exc:
        return f"Apply model error: {exc}", []

    if not edits:
        return (
            f"The apply model produced no edits for '{path}'. "
            "Try rephrasing the description or use edit_file with the exact text."
        ), []

    # Apply each block using the existing 4-layer fallback
    current = content
    events: list[AgentEvent] = []
    applied = 0

    for edit in edits:
        search = edit.get("search", "")
        replace = edit.get("replace", "")
        if not search:
            continue
        try:
            current = apply_edit(current, search, replace)
            events.append(EditProposed(file=path, search=search, replace=replace))
            applied += 1
        except EditApplyError as exc:
            # Return the partial result + diagnostic so Sonnet can self-correct
            if applied > 0:
                working_copies[path] = current
            return (
                f"Applied {applied} of {len(edits)} edit(s) to '{path}', "
                f"then failed:\n{exc.message}\n\n"
                f"Failed search block:\n{exc.search_attempted}\n\n"
                f"Actual file content:\n{exc.file_excerpt}"
            ), events

    working_copies[path] = current
    noun = "edit" if applied == 1 else "edits"
    return f"Applied {applied} {noun} to '{path}' (proposed, pending user acceptance)", events


register_tool(
    name="sketch_edit",
    description=(
        "Edit a file by describing the change you want to make in plain English. "
        "A fast model will translate your description into precise search/replace edits. "
        "Prefer this over edit_file when you are deciding what to change — you don't need "
        "to reproduce the exact file content. "
        "The edit is proposed to the user for approval before being committed."
    ),
    input_schema={
        "type": "object",
        "properties": {
            "path": {
                "type": "string",
                "description": "Relative path to the file to edit",
            },
            "description": {
                "type": "string",
                "description": (
                    "Plain-English description of the change to make. "
                    "Be specific: name the section, command, or paragraph to change "
                    "and describe exactly what the new content should be."
                ),
            },
        },
        "required": ["path", "description"],
    },
    handler=_sketch_edit,
)
