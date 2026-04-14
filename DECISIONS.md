# Architecture Decisions

Decisions locked in at project start. Don't change these without explicit discussion.

## Stack

| Layer | Choice | Why |
|---|---|---|
| Frontend framework | Next.js 15 (App Router) + React 19 + TypeScript | SSR for landing pages, RSC for project lists, client components for editor |
| Editor | CodeMirror 6 | Lighter than Monaco, best collab story, mobile-friendly |
| LaTeX language support | `codemirror-lang-latex` | Based on Overleaf's grammar, includes autocomplete + linting |
| Realtime collab | Yjs + `y-codemirror.next` + Hocuspocus | Modern CRDT, production-ready WebSocket server |
| PDF preview | Mozilla `pdf.js` | Industry standard, SyncTeX support |
| Backend | Fastify (Node.js/TS) | 2x faster than Express, schema validation built in |
| AI sidecar | Python FastAPI | Better LLM SDK ecosystem, async-first |
| Database | PostgreSQL 16 + Drizzle ORM | ACID, JSONB, modern TS-native ORM |
| Cache / pub-sub | Redis 7 | Sessions, BullMQ queues, Yjs update buffer |
| Object storage | Cloudflare R2 (local MinIO in dev) | Zero egress fees, S3-compatible |
| Job queue | BullMQ | Standard for Node, dashboard included |
| Auth | Clerk | Skip building auth, focus on the IDE |
| LaTeX runtime | TeX Live full in Docker | What Overleaf uses; safest |
| Container orchestration | Docker Compose (early) | Don't touch K8s until real users |
| Monorepo | pnpm workspaces + Turborepo | Fast installs, task caching |

## Non-negotiables

- CodeMirror 6 over Monaco. Decision locked.
- Yjs over Operational Transform. CRDTs locked.
- User LaTeX runs only inside Docker. Security boundary.
- Compile working directories on local SSD only. Never NFS/EBS.
- Y.Doc instances live in the collab service, never in the main API.
- No localStorage/sessionStorage in the editor. Yjs + IndexedDB only.
