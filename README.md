# LaTeX IDE

A web-based collaborative LaTeX IDE with Cursor-style AI agents. Think "Overleaf meets Cursor."

Multi-user real-time editing (Yjs), full LaTeX compilation in a sandboxed Docker container, and an AI agent that can read/edit files, fix compile errors, and search academic papers.

**Build status:** Phases 0–5 complete. See [`roadmap.md`](roadmap.md) for details.

---

## Prerequisites

- **Node.js 22+** and **pnpm**
- **Docker Desktop** — for PostgreSQL, Redis, and the TeX Live image
- **Python 3.11+** and **[uv](https://docs.astral.sh/uv/)** — for the agent service

---

## Quick start

```bash
# 1. Install Node dependencies
pnpm install

# 2. Configure environment
cp .env.example .env
# Edit .env — at minimum set ANTHROPIC_API_KEY for AI features
# and CLERK_SECRET_KEY + NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY for auth (see below)

# 3. Start Postgres + Redis
docker compose -f docker/docker-compose.yml up -d

# 4. Run database migrations and seed
pnpm --filter @latex-ide/db db:migrate
pnpm --filter @latex-ide/db db:seed

# 5. Build the TeX Live Docker image (~2.3 GB, one-time)
pnpm docker:build:texlive
```

Then start each service in a separate terminal:

```bash
# API — http://localhost:3001
cd apps/api && pnpm dev

# Realtime collab server — ws://localhost:3030
cd apps/collab && pnpm dev

# LaTeX compile worker (requires TeX Live image)
cd apps/compile && pnpm dev

# AI agent service — http://localhost:3002
cd apps/agent && uv run uvicorn main:app --host 0.0.0.0 --port 3002 --reload

# Frontend — http://localhost:3000
cd apps/web && pnpm dev
```

Open **http://localhost:3000**.

> **Port conflict?** If `pnpm dev` in `apps/web` prints `EADDRINUSE`, a stale Next.js process is holding port 3000. Find it with `netstat -ano | grep :3000` and kill it, then retry.

---

## Auth

Auth is handled by [Clerk](https://clerk.com). Without Clerk credentials the app runs in **dev bypass mode** — no login required.

To enable real auth, create a Clerk application and set both keys in `.env`:

```env
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
```

> **Important:** `CLERK_SECRET_KEY` (API) and `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (frontend) must both be set or both be blank. If only one is set, the API will require tokens the frontend never sends, causing auth failures on every request.

Dev bypass is blocked in production (`NODE_ENV=production`).

---

## Project structure

```
apps/
  web/       Next.js 15 frontend (App Router, React 19, Tailwind 4)
  api/       Fastify REST API (Node/TS, Drizzle, Clerk JWT)
  collab/    Hocuspocus Yjs WebSocket server — port 3030
  compile/   LaTeX compile worker (BullMQ + Docker + TeX Live)
  agent/     Python FastAPI AI agent (Claude, SSE streaming) — port 3002
packages/
  shared-types/  Zod schemas shared by web + api
  db/            Drizzle ORM schema + migrations
  latex-lang/    Custom CodeMirror 6 LaTeX extensions (placeholder)
docker/
  docker-compose.yml      Postgres 16 + Redis 7
  texlive.Dockerfile      Full TeX Live image (~2.3 GB)
```

---

## Useful commands

| Command | What it does |
|---------|-------------|
| `pnpm typecheck` | Typecheck the entire monorepo |
| `pnpm format` | Format all files with Prettier |
| `pnpm --filter @latex-ide/db db:generate` | Generate a migration after editing the schema |
| `pnpm --filter @latex-ide/db db:migrate` | Apply pending migrations |
| `pnpm --filter @latex-ide/db db:studio` | Open Drizzle Studio (DB browser) |
| `pnpm --filter @latex-ide/db db:seed` | Seed the database with sample data |
| `pnpm docker:build:texlive` | Build the TeX Live Docker image |

---

## Key decisions (locked)

- **Editor:** CodeMirror 6 — not Monaco
- **Collaboration:** Yjs CRDTs — not Operational Transform
- **LaTeX:** always runs inside Docker — never directly on the host
- **Yjs state:** lives only in the `collab` service — never in the API process
- **Browser storage:** `y-indexeddb` only — no `localStorage`/`sessionStorage` in the editor
