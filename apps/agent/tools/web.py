"""Web search tool — Tavily API."""

from __future__ import annotations

import logging
from typing import Any

import httpx

from agents.types import AgentEvent
from config import TAVILY_API_KEY
from tools.registry import register_tool

logger = logging.getLogger(__name__)

TAVILY_API = "https://api.tavily.com"


async def _web_search(
    input_data: dict[str, Any],
    project_id: str,
    user_id: str,
    working_copies: dict[str, str],
    _api_bearer_token: str | None,
) -> tuple[str, list[AgentEvent]]:
    query = input_data.get("query", "")
    if not query:
        return "Error: 'query' is required", []

    if not TAVILY_API_KEY:
        return "Web search is not configured (TAVILY_API_KEY not set).", []

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                f"{TAVILY_API}/search",
                json={
                    "api_key": TAVILY_API_KEY,
                    "query": query,
                    "search_depth": "basic",
                    "max_results": 5,
                    "include_answer": True,
                },
            )
            resp.raise_for_status()
            data = resp.json()
    except httpx.HTTPError as exc:
        return f"Web search failed: {exc}", []

    parts: list[str] = []

    answer = data.get("answer")
    if answer:
        parts.append(f"Summary: {answer}\n")

    results = data.get("results", [])
    if results:
        parts.append("Sources:")
        for i, r in enumerate(results, 1):
            title = r.get("title", "")
            url = r.get("url", "")
            content = r.get("content", "")
            parts.append(f"{i}. {title}")
            parts.append(f"   URL: {url}")
            if content:
                parts.append(f"   {content[:300]}")
            parts.append("")

    if not parts:
        return f"No results found for '{query}'.", []

    return "\n".join(parts), []


register_tool(
    name="web_search",
    description=(
        "Search the web for information using Tavily. "
        "Use this for finding documentation, blog posts, tutorials, "
        "or non-academic information that isn't in academic paper databases."
    ),
    input_schema={
        "type": "object",
        "properties": {
            "query": {
                "type": "string",
                "description": "Search query",
            },
        },
        "required": ["query"],
    },
    handler=_web_search,
)
