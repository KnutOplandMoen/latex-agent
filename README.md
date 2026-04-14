# LaTeX IDE

A web-based collaborative LaTeX editor with Cursor-style AI agents. Think "Overleaf meets Cursor."

## Prerequisites

- **Node.js 22+** and **pnpm 9+**
- **Docker Desktop** (for PostgreSQL and Redis)

## Quick start

```bash
# 1. Install dependencies
pnpm install

# 2. Create your .env file
cp .env.example .env

# 3. Start Postgres + Redis
docker compose -f docker/docker-compose.yml up -d

# 4. Run database migrations and seed
pnpm --filter @latex-ide/db db:migrate
pnpm --filter @latex-ide/db db:seed

# 5. Start the dev servers (API + Web)
pnpm dev
```

The frontend runs at **http://localhost:3000** and the API at **http://localhost:3001**.

### AI Agent service (optional)

The agent service is a separate Python FastAPI process:

```bash
# Install Python dependencies (requires Python 3.11+)
cd apps/agent
pip install -e ".[dev]"

# Start the agent service (from apps/agent)
uv run uvicorn main:app --host 0.0.0.0 --port 3002 --reload
```

Set `ANTHROPIC_API_KEY` in `.env` to enable AI features. The agent runs at **http://localhost:3002** (`NEXT_PUBLIC_AGENT_URL` for the browser). The compile tool calls the Fastify API using the same Clerk JWT as the chat request, so ensure the API is reachable at `API_INTERNAL_URL` (default `http://localhost:3001`).

## Auth (optional for local dev)

Auth is handled by [Clerk](https://clerk.com). Without Clerk credentials the app runs in **dev bypass mode** — no login required, all requests use a built-in dev user.

To enable real auth, create a Clerk app and add your keys to `.env`:

```
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
```

## Project structure

```
apps/
  web/       Next.js 15 frontend
  api/       Fastify REST API
  collab/    Hocuspocus Yjs WebSocket server
  compile/   LaTeX compile worker (BullMQ + Docker)
  agent/     Python FastAPI AI agent service
packages/
  shared-types/  Zod schemas shared by web + api
  db/            Drizzle ORM schema + migrations
  latex-lang/    Custom CodeMirror 6 extensions (placeholder)
```

## Useful commands

| Command | What it does |
|---------|-------------|
| `pnpm dev` | Start all services in dev mode |
| `pnpm typecheck` | Typecheck the entire monorepo |
| `pnpm format` | Format all files with Prettier |
| `pnpm --filter @latex-ide/db db:generate` | Generate a new migration after editing the schema |
| `pnpm --filter @latex-ide/db db:migrate` | Apply pending migrations |
| `pnpm --filter @latex-ide/db db:studio` | Open Drizzle Studio (DB browser) |
| `pnpm --filter @latex-ide/db db:seed` | Seed the database with sample data |
