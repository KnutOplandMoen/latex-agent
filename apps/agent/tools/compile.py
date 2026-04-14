"""Compile tool — triggers LaTeX compilation via the Fastify API."""

from __future__ import annotations

import asyncio
import logging
from typing import Any

import httpx

from agents.types import AgentEvent
from config import API_INTERNAL_URL
from tools.registry import register_tool

logger = logging.getLogger(__name__)

MAX_POLL_ATTEMPTS = 60
POLL_INTERVAL_S = 2.0


async def _compile_project(
    input_data: dict[str, Any],
    project_id: str,
    user_id: str,
    working_copies: dict[str, str],
    api_bearer_token: str | None,
) -> tuple[str, list[AgentEvent]]:
    """Trigger a compile via the Fastify API and poll until complete."""
    root_file = input_data.get("root_file")

    if working_copies:
        uncommitted = list(working_copies.keys())
        note = (
            f"Note: {len(uncommitted)} file(s) have pending edits not yet accepted by the user: "
            f"{', '.join(uncommitted)}. The compile uses the last saved version, "
            "which may not reflect your latest edits."
        )
    else:
        note = ""

    headers: dict[str, str] = {"Content-Type": "application/json"}
    if api_bearer_token:
        headers["Authorization"] = f"Bearer {api_bearer_token}"

    body: dict[str, Any] = {}
    if root_file:
        body["rootFile"] = root_file

    async with httpx.AsyncClient(base_url=API_INTERNAL_URL, timeout=120.0) as client:
        try:
            resp = await client.post(
                f"/projects/{project_id}/compile",
                json=body,
                headers=headers,
            )
        except httpx.HTTPError as exc:
            return f"Failed to start compile: {exc}", []

        if resp.status_code == 401:
            return (
                "Compile request was not authorized. The agent could not forward your session "
                "to the API (missing token in dev, or invalid Clerk token).",
                [],
            )

        if resp.status_code != 202:
            return f"Compile request failed with status {resp.status_code}: {resp.text}", []

        job_id = resp.json().get("jobId", "")
        if not job_id:
            return "Compile started but no job ID returned", []

        for _ in range(MAX_POLL_ATTEMPTS):
            await asyncio.sleep(POLL_INTERVAL_S)

            try:
                status_resp = await client.get(
                    f"/projects/{project_id}/compile/{job_id}",
                    headers=headers,
                )
            except httpx.HTTPError:
                continue

            if status_resp.status_code != 200:
                continue

            result = status_resp.json()
            status = result.get("status", "")

            if status == "completed":
                return _format_compile_result(result, note), []
            if status == "failed":
                reason = result.get("error", "Unknown failure")
                return f"Compilation failed: {reason}", []

        return "Compilation timed out after polling", []


def _format_compile_result(result: dict[str, Any], note: str = "") -> str:
    """Format a compile result into a human-readable string for the LLM."""
    parts: list[str] = []

    errors = result.get("errors", [])
    warnings = result.get("warnings", [])
    pdf_url = result.get("pdfUrl")

    if not errors and pdf_url:
        parts.append("Compilation successful! PDF generated.")
    elif not errors:
        parts.append("Compilation completed with no errors (but no PDF found).")
    else:
        parts.append(f"Compilation completed with {len(errors)} error(s).")

    if errors:
        parts.append("\nErrors:")
        for err in errors[:15]:
            file_name = err.get("file", "?")
            line_num = err.get("line", "?")
            message = err.get("message", "?")
            parts.append(f"  {file_name}:{line_num} — {message}")

    if warnings:
        parts.append(f"\nWarnings ({len(warnings)}):")
        for warn in warnings[:10]:
            file_name = warn.get("file", "?")
            line_num = warn.get("line", "?")
            message = warn.get("message", "?")
            parts.append(f"  {file_name}:{line_num} — {message}")

    if note:
        parts.append(f"\n{note}")

    return "\n".join(parts)


register_tool(
    name="compile_project",
    description=(
        "Compile the LaTeX project and return any errors or warnings. "
        "Use this after making edits to verify they compile correctly. "
        "Returns structured output with error type, file, line number, and message."
    ),
    input_schema={
        "type": "object",
        "properties": {
            "root_file": {
                "type": "string",
                "description": "Main .tex file to compile (optional, uses project default if omitted)",
            },
        },
    },
    handler=_compile_project,
)
