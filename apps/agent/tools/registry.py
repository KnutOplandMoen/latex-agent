"""Tool registry — maps tool names to JSON schemas and async handlers.

Each tool handler receives:
  - input_data: dict parsed from the LLM's tool_use input
  - project_id: injected server-side, never trusted from the LLM
  - user_id: injected server-side
  - working_copies: mutable dict of in-memory file overrides for this session
And returns:
  - (result_string, list_of_extra_events)
"""

from __future__ import annotations

from typing import Any, Callable, Awaitable

from agents.types import AgentEvent, AgentMode

ToolHandler = Callable[
    [dict[str, Any], str, str, dict[str, str], str | None],
    Awaitable[tuple[str, list[AgentEvent]]],
]


class ToolDef:
    def __init__(
        self,
        name: str,
        description: str,
        input_schema: dict[str, Any],
        handler: ToolHandler,
    ):
        self.name = name
        self.description = description
        self.input_schema = input_schema
        self.handler = handler

    def to_anthropic_schema(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "description": self.description,
            "input_schema": self.input_schema,
        }


_ALL_TOOLS: dict[str, ToolDef] = {}


def register_tool(
    name: str,
    description: str,
    input_schema: dict[str, Any],
    handler: ToolHandler,
) -> None:
    _ALL_TOOLS[name] = ToolDef(name, description, input_schema, handler)


# Tool sets per mode — tool names allowed for each mode
TOOLS_FOR: dict[AgentMode, list[str]] = {
    AgentMode.GENERAL: [
        "read_file", "list_files", "create_file", "edit_file",
        "search_in_files", "compile_project", "search_papers", "add_to_bibliography",
        "web_search",
    ],
    AgentMode.DEBUG: [
        "read_file", "list_files", "edit_file",
        "search_in_files", "compile_project",
    ],
}


def get_tool_schemas(mode: AgentMode) -> list[dict[str, Any]]:
    """Return Anthropic-formatted tool schemas for a given mode."""
    allowed = TOOLS_FOR.get(mode, TOOLS_FOR[AgentMode.GENERAL])
    return [
        _ALL_TOOLS[name].to_anthropic_schema()
        for name in allowed
        if name in _ALL_TOOLS
    ]


async def execute_tool(
    name: str,
    input_data: dict[str, Any],
    project_id: str,
    user_id: str,
    working_copies: dict[str, str],
    api_bearer_token: str | None = None,
) -> tuple[str, list[AgentEvent]]:
    """Execute a tool by name and return (result_text, extra_events)."""
    tool = _ALL_TOOLS.get(name)
    if tool is None:
        raise ValueError(f"Unknown tool: {name}")
    return await tool.handler(
        input_data,
        project_id,
        user_id,
        working_copies,
        api_bearer_token,
    )
