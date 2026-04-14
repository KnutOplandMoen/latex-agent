"""Pydantic models for agent requests, events, and internal types."""

from __future__ import annotations

import uuid
from enum import Enum
from typing import Any, Literal, Union

from pydantic import AliasChoices, BaseModel, ConfigDict, Field


class AgentMode(str, Enum):
    GENERAL = "general"
    DEBUG = "debug"


class MessageRole(str, Enum):
    USER = "user"
    ASSISTANT = "assistant"


class AgentMessage(BaseModel):
    role: MessageRole
    content: str


class AgentRunRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    project_id: str = Field(validation_alias=AliasChoices("project_id", "projectId"))
    mode: AgentMode = AgentMode.GENERAL
    messages: list[AgentMessage]
    open_file: str | None = Field(
        default=None,
        validation_alias=AliasChoices("open_file", "openFile"),
    )
    compile_errors: list[dict[str, Any]] | None = Field(
        default=None,
        validation_alias=AliasChoices("compile_errors", "compileErrors"),
    )


# --- SSE events streamed back to the frontend ---


class TextDelta(BaseModel):
    type: Literal["text_delta"] = "text_delta"
    text: str


class ToolStart(BaseModel):
    type: Literal["tool_start"] = "tool_start"
    tool: str
    input: dict[str, Any] = Field(default_factory=dict)


class ToolResult(BaseModel):
    type: Literal["tool_result"] = "tool_result"
    tool: str
    result: str
    is_error: bool = False


class EditProposed(BaseModel):
    type: Literal["edit_proposed"] = "edit_proposed"
    edit_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    file: str
    search: str
    replace: str


class FileCreated(BaseModel):
    type: Literal["file_created"] = "file_created"
    file: str


class Done(BaseModel):
    type: Literal["done"] = "done"


class AgentError(BaseModel):
    type: Literal["error"] = "error"
    message: str


AgentEvent = Union[
    TextDelta,
    ToolStart,
    ToolResult,
    EditProposed,
    FileCreated,
    Done,
    AgentError,
]
