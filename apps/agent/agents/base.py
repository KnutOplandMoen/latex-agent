"""The core agent loop — think, tool_call, observe, repeat.

This is the ~100-line heart of the agent. All modes share this loop;
differences live in prompts and tool sets.
"""

from __future__ import annotations

import logging
from typing import Any, AsyncIterator

from agents.types import (
    AgentError,
    AgentEvent,
    AgentMode,
    AgentRunRequest,
    Done,
    TextDelta,
    ToolResult,
    ToolStart,
)
from context.builder import build_context
from llm.client import build_system_blocks, get_client
from llm.router import pick_model
import tools  # noqa: F401 — triggers tool registration
from tools.registry import TOOLS_FOR, execute_tool, get_tool_schemas

logger = logging.getLogger(__name__)

MAX_ITERATIONS = 25


async def run_agent(
    request: AgentRunRequest,
    user_id: str,
    *,
    api_bearer_token: str | None = None,
) -> AsyncIterator[AgentEvent]:
    """Run the agent loop, yielding SSE events as they occur.

    The caller (the SSE endpoint) iterates over this and serialises each
    event as a Server-Sent Event line.
    """
    mode = request.mode
    project_id = request.project_id
    client = get_client()
    model = pick_model(mode)
    tool_schemas = get_tool_schemas(mode)
    role_prompt = _load_role_prompt(mode)
    project_context = await build_context(
        project_id=project_id,
        open_file=request.open_file,
        compile_errors=request.compile_errors,
    )
    system = build_system_blocks(role_prompt, project_context)

    # Convert incoming messages to Anthropic format
    messages = _to_anthropic_messages(request.messages)

    # In-memory working copies of files modified during this session.
    # Tools read from here first, falling back to DB.
    working_copies: dict[str, str] = {}

    tool_names = TOOLS_FOR.get(mode, TOOLS_FOR[AgentMode.GENERAL])

    for iteration in range(MAX_ITERATIONS):
        try:
            response = await client.messages.create(
                model=model,
                system=system,
                tools=tool_schemas,
                messages=messages,
                max_tokens=4096,
                stream=True,
            )
        except Exception as exc:
            logger.exception("Claude API error")
            yield AgentError(message=f"LLM error: {exc}")
            return

        text_parts: list[str] = []
        tool_calls: list[dict[str, Any]] = []
        current_tool: dict[str, Any] | None = None

        async for event in response:
            if event.type == "content_block_start":
                block = event.content_block
                if block.type == "text":
                    pass  # text streamed via deltas
                elif block.type == "tool_use":
                    current_tool = {"id": block.id, "name": block.name, "input_json": ""}
            elif event.type == "content_block_delta":
                delta = event.delta
                if delta.type == "text_delta":
                    text_parts.append(delta.text)
                    yield TextDelta(text=delta.text)
                elif delta.type == "input_json_delta" and current_tool is not None:
                    current_tool["input_json"] += delta.partial_json
            elif event.type == "content_block_stop":
                if current_tool is not None:
                    import json
                    try:
                        current_tool["input"] = json.loads(current_tool["input_json"]) if current_tool["input_json"] else {}
                    except json.JSONDecodeError:
                        current_tool["input"] = {}
                    tool_calls.append(current_tool)
                    current_tool = None
            elif event.type == "message_stop":
                pass

        # Build assistant content blocks for the message history
        assistant_content: list[dict[str, Any]] = []
        full_text = "".join(text_parts)
        if full_text:
            assistant_content.append({"type": "text", "text": full_text})
        for tc in tool_calls:
            assistant_content.append({
                "type": "tool_use",
                "id": tc["id"],
                "name": tc["name"],
                "input": tc["input"],
            })

        messages.append({"role": "assistant", "content": assistant_content})

        # If no tool calls, the agent is done
        if not tool_calls:
            yield Done()
            return

        # Execute each tool call and collect results
        tool_results: list[dict[str, Any]] = []
        for tc in tool_calls:
            yield ToolStart(tool=tc["name"], input=tc["input"])
            try:
                result, events = await execute_tool(
                    name=tc["name"],
                    input_data=tc["input"],
                    project_id=project_id,
                    user_id=user_id,
                    working_copies=working_copies,
                    api_bearer_token=api_bearer_token,
                )
                for ev in events:
                    yield ev
                yield ToolResult(tool=tc["name"], result=_truncate(result))
                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": tc["id"],
                    "content": _truncate(result),
                })
            except Exception as exc:
                logger.exception("Tool execution error: %s", tc["name"])
                error_msg = str(exc)
                yield ToolResult(tool=tc["name"], result=error_msg, is_error=True)
                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": tc["id"],
                    "content": error_msg,
                    "is_error": True,
                })

        messages.append({"role": "user", "content": tool_results})

    # Hit max iterations
    yield AgentError(message="Agent reached maximum iteration limit")
    yield Done()


def _to_anthropic_messages(messages: list[Any]) -> list[dict[str, Any]]:
    """Convert our AgentMessage list to Anthropic's message format."""
    result = []
    for msg in messages:
        result.append({"role": msg.role.value, "content": msg.content})
    return result


def _load_role_prompt(mode: AgentMode) -> str:
    """Load the markdown prompt file for a given mode."""
    from pathlib import Path
    prompt_dir = Path(__file__).resolve().parent.parent / "prompts"
    prompt_file = prompt_dir / f"{mode.value}.md"
    if prompt_file.exists():
        return prompt_file.read_text(encoding="utf-8")
    return "You are a helpful LaTeX assistant."


def _truncate(text: str, max_chars: int = 8000) -> str:
    """Truncate tool results to avoid bloating the context window."""
    if len(text) <= max_chars:
        return text
    return text[:max_chars] + f"\n\n[...truncated, showing {max_chars}/{len(text)} chars]"
