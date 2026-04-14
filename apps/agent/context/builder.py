"""Build the dynamic project context that goes into the system prompt."""

from __future__ import annotations

import json
from typing import Any

from context.section_map import parse_section_map
from db import get_all_file_contents, list_files


async def build_context(
    project_id: str,
    open_file: str | None = None,
    compile_errors: list[dict[str, Any]] | None = None,
) -> str:
    """Assemble project context for the system prompt.

    Includes: file tree, document structure map, currently open file, and
    last compile errors (if any).
    """
    parts: list[str] = []

    # File tree
    files = await list_files(project_id)
    if files:
        tree_lines = [f"  {f['path']} ({f['type']})" for f in files]
        parts.append("Project files:\n" + "\n".join(tree_lines))

    # Section map (parse all tex/bib files)
    all_contents = await get_all_file_contents(project_id)
    tex_files = [f for f in all_contents if f.get("type") in ("tex", "bib")]
    if tex_files:
        section_map = parse_section_map(tex_files)
        parts.append(section_map)

    # Currently open file
    if open_file:
        parts.append(f"Currently open file: {open_file}")

    # Last compile errors
    if compile_errors:
        error_lines = []
        for err in compile_errors[:10]:
            file_name = err.get("file", "?")
            line_num = err.get("line", "?")
            message = err.get("message", "?")
            level = err.get("level", "error")
            error_lines.append(f"  [{level}] {file_name}:{line_num} — {message}")
        parts.append("Last compile errors:\n" + "\n".join(error_lines))

    return "\n\n".join(parts)
