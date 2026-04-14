"""FastAPI agent service — SSE endpoint for the AI agent loop."""

from __future__ import annotations

import logging

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from sse_starlette.sse import EventSourceResponse

from agents.base import run_agent
from agents.types import AgentRunRequest
from auth import verify_token
from config import AGENT_PORT, CORS_ORIGIN
from db import check_membership, close_pool

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

app = FastAPI(title="LaTeX IDE Agent", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGIN.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown() -> None:
    await close_pool()


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/agent/run")
async def agent_run(body: AgentRunRequest, request: Request) -> EventSourceResponse:
    # Authenticate
    token = (request.headers.get("authorization") or "").removeprefix("Bearer ").strip()
    try:
        user = await verify_token(token)
    except PermissionError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc

    # Authorise — check project membership
    role = await check_membership(body.project_id, user.id)
    if role is None:
        raise HTTPException(status_code=403, detail="Not a project member")
    if role == "viewer":
        raise HTTPException(status_code=403, detail="Viewers cannot use the agent")

    async def event_stream():
        async for event in run_agent(body, user_id=user.id, api_bearer_token=token or None):
            yield {"data": event.model_dump_json()}

    return EventSourceResponse(event_stream())


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=AGENT_PORT, reload=True)
