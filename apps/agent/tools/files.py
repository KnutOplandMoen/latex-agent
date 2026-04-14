"""File tools — read_file, list_files, create_file, search_in_files."""

from __future__ import annotations

from typing import Any

from agents.types import AgentEvent, FileCreated
from db import create_file as db_create_file
from db import get_all_file_contents, get_file_by_path
from db import list_files as db_list_files
from tools.registry import register_tool

MAX_READ_LINES = 500


async def _read_file(
    input_data: dict[str, Any],
    project_id: str,
    user_id: str,
    working_copies: dict[str, str],
    _api_bearer_token: str | None,
) -> tuple[str, list[AgentEvent]]:
    path = input_data.get("path", "")
    if not path:
        return "Error: 'path' is required", []

    # Check working copies first (in-memory edits from this session)
    if path in working_copies:
        content = working_copies[path]
        lines = content.splitlines()
        total = len(lines)
        if total > MAX_READ_LINES:
            content = "\n".join(lines[:MAX_READ_LINES])
            return f"[Showing {MAX_READ_LINES}/{total} lines — from working copy]\n\n{content}", []
        return f"[{total} lines — from working copy]\n\n{content}", []

    file = await get_file_by_path(project_id, path)
    if file is None:
        available = await db_list_files(project_id)
        paths = [f["path"] for f in available]
        return f"No file at '{path}'. Available files:\n" + "\n".join(paths[:30]), []

    content = file.get("content") or ""
    lines = content.splitlines()
    total = len(lines)
    if total > MAX_READ_LINES:
        content = "\n".join(lines[:MAX_READ_LINES])
        return f"[Showing {MAX_READ_LINES}/{total} lines]\n\n{content}", []
    return f"[{total} lines]\n\n{content}", []


async def _list_files(
    input_data: dict[str, Any],
    project_id: str,
    user_id: str,
    working_copies: dict[str, str],
    _api_bearer_token: str | None,
) -> tuple[str, list[AgentEvent]]:
    files = await db_list_files(project_id)
    if not files:
        return "No files in this project.", []
    lines = [f"{f['path']} ({f['type']})" for f in files]
    return "\n".join(lines), []


async def _create_file(
    input_data: dict[str, Any],
    project_id: str,
    user_id: str,
    working_copies: dict[str, str],
    _api_bearer_token: str | None,
) -> tuple[str, list[AgentEvent]]:
    path = input_data.get("path", "")
    content = input_data.get("content", "")
    if not path:
        return "Error: 'path' is required", []

    # Infer type from extension
    ext = path.rsplit(".", 1)[-1].lower() if "." in path else ""
    file_type = {"tex": "tex", "bib": "bib", "sty": "other", "cls": "other"}.get(ext, "other")

    existing = await get_file_by_path(project_id, path)
    if existing:
        return f"Error: file '{path}' already exists. Use edit_file to modify it.", []

    await db_create_file(project_id, path, file_type, content)
    working_copies[path] = content
    return f"Created file '{path}' ({len(content)} chars)", [FileCreated(file=path)]


async def _search_in_files(
    input_data: dict[str, Any],
    project_id: str,
    user_id: str,
    working_copies: dict[str, str],
    _api_bearer_token: str | None,
) -> tuple[str, list[AgentEvent]]:
    query = input_data.get("query", "")
    if not query:
        return "Error: 'query' is required", []

    all_files = await get_all_file_contents(project_id)
    results: list[str] = []
    max_results = 50

    for f in all_files:
        path = f["path"]
        content = working_copies.get(path) or f.get("content") or ""
        for i, line in enumerate(content.splitlines(), 1):
            if query.lower() in line.lower():
                results.append(f"{path}:{i}: {line.strip()}")
                if len(results) >= max_results:
                    break
        if len(results) >= max_results:
            break

    if not results:
        return f"No matches found for '{query}'.", []

    header = f"Found {len(results)} matches"
    if len(results) >= max_results:
        header += f" (showing first {max_results})"
    return header + ":\n\n" + "\n".join(results), []


# --- Register all file tools ---

register_tool(
    name="read_file",
    description=(
        "Read a file's content from the project. Returns the file text, "
        "truncated to 500 lines for large files. Use this to understand "
        "existing content before making edits."
    ),
    input_schema={
        "type": "object",
        "properties": {
            "path": {
                "type": "string",
                "description": "Relative path within the project, e.g. 'main.tex' or 'sections/intro.tex'",
            },
        },
        "required": ["path"],
    },
    handler=_read_file,
)

register_tool(
    name="list_files",
    description="List all files in the project with their paths and types.",
    input_schema={
        "type": "object",
        "properties": {},
    },
    handler=_list_files,
)

register_tool(
    name="create_file",
    description="Create a new file in the project. Cannot overwrite existing files.",
    input_schema={
        "type": "object",
        "properties": {
            "path": {
                "type": "string",
                "description": "Relative path for the new file, e.g. 'sections/methods.tex'",
            },
            "content": {
                "type": "string",
                "description": "Initial content of the file",
            },
        },
        "required": ["path", "content"],
    },
    handler=_create_file,
)

register_tool(
    name="search_in_files",
    description=(
        "Search for a text query across all files in the project. "
        "Returns matching lines with file paths and line numbers. Case-insensitive."
    ),
    input_schema={
        "type": "object",
        "properties": {
            "query": {
                "type": "string",
                "description": "Text to search for",
            },
        },
        "required": ["query"],
    },
    handler=_search_in_files,
)
