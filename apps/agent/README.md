# AI agent service

FastAPI app that runs a Claude tool loop and streams JSON events over SSE (`POST /agent/run`).

## Run locally

From repo root, ensure `.env` has `DATABASE_URL`, `ANTHROPIC_API_KEY`, and (for compile tool) `API_INTERNAL_URL` pointing at the Fastify API.

```bash
cd apps/agent
uv sync   # or: pip install -e ".[dev]"
uv run uvicorn main:app --host 0.0.0.0 --port 3002 --reload
```

The web app uses `NEXT_PUBLIC_AGENT_URL` (default `http://localhost:3002`). Auth matches the collab server: Clerk JWT in `Authorization: Bearer`, or dev bypass when `CLERK_SECRET_KEY` is unset and `NODE_ENV` is not production.

## Compile tool

`compile_project` calls `POST/GET /projects/:id/compile` on the Fastify API using the same Bearer token as the agent request so membership checks succeed when Clerk is enabled.
