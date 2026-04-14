# LaTeX IDE Build Roadmap

A detailed, phase-by-phase plan for building a collaborative web-based LaTeX IDE with Cursor-style AI agents. Each phase has concrete deliverables, the exact tech to install, the order to build things in, and a "definition of done."

**Total estimated time:** ~20 weeks for solo dev to functional MVP. Faster with a small team.

---

## Progress

| Phase | Status | Summary |
|---|---|---|
| Phase 0 — Foundation | **DONE** | Monorepo, Docker Compose, DB schema, API skeleton, shared types |
| Phase 1 — The editor | **DONE** | CodeMirror 6 with LaTeX support, IDE layout, command palette, outline view |
| Phase 2 — Backend, persistence, projects | **DONE** | Auth (Clerk + dev bypass), project CRUD, file persistence via Postgres, dashboard, API-backed editor |
| Phase 3 — Realtime collaboration | Not started | Yjs + Hocuspocus + awareness |
| Phase 4 — LaTeX compilation | Not started | TeX Live Docker, compile worker, PDF preview |
| Phase 5 — AI agent layer | Not started | Python FastAPI agent, tools, chat UI |
| Phase 6 — History, diff, polish | Not started | Version history, comments, sharing, import/export |
| Phase 7 — Hosting and launch | Not started | Deployment, observability, launch |

### What exists today

**Monorepo structure (pnpm workspaces + Turborepo):**
- `apps/web/` — Next.js 15 + React 19 + Tailwind CSS 4 + Clerk auth
- `apps/api/` — Fastify with Clerk JWT auth (dev bypass), Drizzle DB plugin, project + file CRUD routes
- `apps/collab/` — placeholder
- `apps/compile/` — placeholder
- `apps/agent/` — Python placeholder with `pyproject.toml`
- `packages/shared-types/` — Zod schemas for User, Project, ProjectMember, File (with content), UpdateFile
- `packages/db/` — Drizzle ORM schema (users, projects, projectMembers, files with content, yjsUpdates), migrations, client, seed script
- `packages/latex-lang/` — placeholder for custom CM6 extensions

**Editor (API-backed):**
- CodeMirror 6 wrapped in a React component (mount-once pattern, `next/dynamic` with `ssr: false`, imperative handle for external control)
- `codemirror-lang-latex` with auto-close tags, linting, tooltips, autocomplete, bracket matching
- One Dark theme, JetBrains Mono font (self-hosted via `next/font/google`)
- Three-pane resizable layout (`react-resizable-panels`): file tree + outline | editor with tabs | PDF placeholder
- Outline view parsing `\section` / `\subsection` hierarchy — click to navigate to line
- Command palette (`cmdk`) on Ctrl+K with file switching, toggle panels, symbol/operator insertion into editor
- Files loaded from Postgres via API, debounced auto-save (2s) with retry on failure
- Lazy file content loading with error state and retry UI
- File creation and deletion from the file tree (with confirmation)
- Error boundaries at root and project level

**Backend:**
- Fastify API with `fastify-type-provider-zod` for end-to-end typed routes
- Project CRUD: `POST/GET /projects`, `GET/DELETE /projects/:id`
- File CRUD: `GET/POST /projects/:id/files`, `GET/PUT/DELETE /files/:id`
- Service layer pattern: routes → services → Drizzle, with project membership checks
- RBAC: viewers cannot create, edit, or delete files
- Clerk JWT authentication with dev bypass (gated on `NODE_ENV !== 'production'`)
- Auto user upsert on first authenticated request (no separate webhook needed for basic usage)
- Configurable CORS origin via `CORS_ORIGIN` env var
- Graceful DB pool shutdown on Fastify close

**Dashboard:**
- `/dashboard` page with project list, create project dialog, delete project (with confirmation)
- `/project/[id]` page loads real project files and opens the editor
- `/` redirects to `/dashboard`

**Infrastructure:**
- `docker/docker-compose.yml` with PostgreSQL 16 + Redis 7
- `.env.example` with all expected environment variables
- `DECISIONS.md` with locked-in stack choices
- Root configs: `tsconfig.base.json` (strict), `.prettierrc`, `turbo.json`
- Drizzle migrations generated in `packages/db/migrations/`

### Known issues / next steps

- No compile functionality — PDF pane is a placeholder (Phase 4)
- Clerk auth requires credentials from clerk.com — set `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` to enable; without them, dev bypass is active (blocked in production via `NODE_ENV`)
- Run `docker compose up` then `pnpm --filter @latex-ide/db db:migrate` then `pnpm --filter @latex-ide/db db:seed` to set up the database
- Command palette "Compile Project" and "Find in Files" actions are stubs (Phase 4 / future)
- `packages/latex-lang/` is a placeholder — custom CM6 extensions not yet implemented

---

## Phase 0 — Foundation & decisions (Week 1) ✅ DONE

Before writing code, lock in the architecture so you don't have to undo work later.

### 0.1 Set up your dev environment

- Install Node.js 22+, pnpm (faster than npm), Docker Desktop, PostgreSQL 16, Redis 7
- Get a code editor set up (VS Code or Cursor itself — eat your own dog food eventually)
- Create a GitHub repo, set up a basic CI (GitHub Actions: lint + typecheck on PR)

### 0.2 Get API keys ready

- **Anthropic API key** (Claude) — primary LLM
- **OpenAI API key** — fallback / GPT-4 for comparison
- **Tavily API key** — web search for the research agent (free tier: 1,000 searches/mo)
- **Semantic Scholar** — no key needed for low-volume; request one for higher rate limits
- Create a `.env.example` and document every variable from day one

### 0.3 Lock in the stack

Write this down in a `DECISIONS.md` so you don't second-guess yourself in Week 8:

| Layer | Choice | Why |
|---|---|---|
| Frontend framework | Next.js 15 (App Router) + React 19 + TypeScript | SSR for landing pages, RSC for project lists, client components for editor |
| Editor | CodeMirror 6 | Lighter than Monaco, best collab story, mobile-friendly |
| LaTeX language support | `codemirror-lang-latex` | Already exists, based on Overleaf's grammar |
| Realtime collab | Yjs + `y-codemirror.next` + Hocuspocus | Modern CRDT, production-ready WebSocket server |
| PDF preview | Mozilla `pdf.js` | Industry standard, SyncTeX support |
| Backend | Fastify (Node.js/TS) | 2x faster than Express, schema validation built in |
| AI sidecar | Python FastAPI | Better LLM SDK ecosystem, async-first |
| Database | PostgreSQL 16 + Drizzle ORM | ACID, JSONB, modern TS-native ORM |
| Cache / pub-sub | Redis 7 | Sessions, BullMQ queues, Yjs update buffer |
| Object storage | Cloudflare R2 (or local MinIO/Garage in dev) | Zero egress fees, S3-compatible |
| Job queue | BullMQ | The standard for Node, dashboard included |
| Auth | Clerk (or Lucia for self-hosted) | Skip building auth, focus on the IDE |
| LaTeX runtime | TeX Live full in Docker | What Overleaf uses; safest |
| Container orchestration (early) | Docker Compose | Don't touch K8s until you have real users |

### 0.4 Sketch the data model

Open a notebook (or Excalidraw) and draw your core entities. Don't overthink — start with this:

- **User** (id, email, name, created_at)
- **Project** (id, owner_id, name, root_doc_id, created_at)
- **ProjectMember** (project_id, user_id, role: owner|editor|viewer)
- **File** (id, project_id, path, type: tex|bib|image|other, content_blob_id)
- **YjsUpdate** (id, file_id, update_bytes, created_at) — append-only log of CRDT updates
- **CompileJob** (id, project_id, status, root_file, output_pdf_url, log, created_at)
- **AgentSession** (id, project_id, user_id, messages_jsonb, created_at)

### 0.5 Build the monorepo skeleton

Use a monorepo from day one — you'll have multiple deployable services:

```
latex-ide/
├── apps/
│   ├── web/                # Next.js frontend
│   ├── api/                # Fastify main API
│   ├── collab/             # Hocuspocus Yjs server
│   ├── compile/            # LaTeX compilation worker
│   └── agent/              # Python FastAPI agent service
├── packages/
│   ├── shared-types/       # Shared TS types
│   ├── db/                 # Drizzle schema + migrations
│   └── latex-lang/         # CodeMirror LaTeX extensions (custom additions)
├── docker/
│   ├── texlive.Dockerfile
│   └── docker-compose.yml
└── DECISIONS.md
```

Use **Turborepo** or **Nx** to manage the monorepo. pnpm workspaces work fine for smaller setups.

**Definition of done for Phase 0:** You can run `docker compose up` and get Postgres + Redis running locally. `pnpm dev` starts an empty Next.js app. You have written down which technologies you're using and why. ✅

---

## Phase 1 — The editor (Weeks 2–3) ✅ DONE

Goal: a single user can open a `.tex` file in the browser, edit it, and have it look like a real editor.

### 1.1 Bootstrap the Next.js app

```bash
pnpm create next-app@latest apps/web --typescript --tailwind --app
```

Install editor deps:

```bash
cd apps/web
pnpm add codemirror @codemirror/state @codemirror/view @codemirror/commands \
  @codemirror/language @codemirror/search @codemirror/autocomplete \
  @codemirror/lint @codemirror/lang-latex
```

Note: as of late 2025, `codemirror-lang-latex` (TeXlyre's package) is the better LaTeX grammar than the official one. Use that.

### 1.2 Build a basic editor component

Create `apps/web/components/Editor.tsx`:

- Wrap CodeMirror 6 in a React component
- Use `useEffect` to mount the editor on a `div` ref
- Set up basic extensions: line numbers, syntax highlighting, autocomplete, keymaps
- Expose `value` and `onChange` props
- Theme it (start with `@uiw/codemirror-themes` or write your own — the One Dark theme is a fine default)

**Trap to avoid:** Don't try to control CodeMirror's value via React state and `useEffect`. CodeMirror manages its own state — just listen to `onChange` and let it run.

### 1.3 Build the IDE layout

Three-pane layout (resizable):

- **Left:** file tree (start with hardcoded files)
- **Center:** the editor
- **Right:** PDF preview placeholder (just a gray box for now)

Use `react-resizable-panels` for the splitters. Don't fight CSS — this library is purpose-built for IDE layouts.

### 1.4 Add LaTeX-aware features

This is where you start to feel like Overleaf:

- **Snippets:** auto-expand `\beg<Tab>` to `\begin{}...\end{}`
- **Bracket matching:** for `{}`, `[]`, `\begin{}\end{}` pairs
- **Auto-closing:** typing `{` inserts `}`
- **Math-mode aware autocomplete:** detect `$...$` context and suggest math symbols
- **Outline view:** parse `\section`, `\subsection`, etc. into a sidebar

Most of these come from `codemirror-lang-latex` — wire them up rather than reinvent.

### 1.5 Add a command palette

Cmd+K opens a fuzzy-search command palette (insert symbol, switch file, run compile, etc.). Use `cmdk` (the library Vercel built — it's what Linear and Raycast use internally). This becomes critical later for invoking AI agents.

**Definition of done for Phase 1:** You can edit a `.tex` file with syntax highlighting, autocomplete, bracket matching, and an outline view. It looks and feels like a real editor. No backend yet — everything is in-memory. ✅

---

## Phase 2 — Backend, persistence, projects (Weeks 4–5) ✅ DONE

Goal: real users can sign up, create projects, save files, come back later.

### 2.1 Set up the database

```bash
pnpm add drizzle-orm pg
pnpm add -D drizzle-kit
```

Write your schema in `packages/db/schema.ts`. Generate migrations with `drizzle-kit generate`. Run them with a script.

Build a tiny seed script that creates a test user + a sample LaTeX project (the classic "hello world" template).

### 2.2 Build the Fastify API

```bash
pnpm add fastify @fastify/cors @fastify/jwt zod
```

Routes for the MVP:

- `POST /projects` — create a project
- `GET /projects` — list user's projects
- `GET /projects/:id` — get project metadata + file tree
- `GET /files/:id` — get file content
- `PUT /files/:id` — save file content (later replaced by Yjs sync)
- `POST /projects/:id/files` — create a new file
- `DELETE /files/:id` — delete a file

Use **Zod schemas** for request validation — Fastify integrates beautifully with `fastify-type-provider-zod`.

### 2.3 Wire up authentication

Sign up for **Clerk**, follow their Next.js quickstart (about 15 minutes). Wrap your app in `<ClerkProvider>`. Add middleware so `/dashboard/*` requires login. On the API side, validate Clerk JWTs in a Fastify hook.

If you'd rather self-host, use **Lucia v3 + Drizzle adapter** — same outcome, more code.

### 2.4 Build the project dashboard

A simple page at `/dashboard` listing the user's projects with "New Project" and "Open" buttons. When you open a project, you go to `/project/:id` which is the editor view from Phase 1, now wired to load real files from the API.

### 2.5 File storage decision

For the MVP, store `.tex` content **directly in Postgres** (a `text` column). It's simpler than juggling object storage for small text files. You can move to R2/S3 later when you have lots of binary assets (images, PDFs).

For the **compiled PDFs and uploaded images**, use Cloudflare R2 from day one — they're binary and possibly large.

**Definition of done for Phase 2:** You can sign up, create a project, add `.tex` files, edit them, save, refresh the browser, and your changes are still there. Single-user only. ✅

---

## Phase 3 — Realtime collaboration (Weeks 6–8) ⬜ UP NEXT

This is the hardest part. Take your time.

### 3.1 Understand Yjs first

Before writing any code, spend a day reading:

- The Yjs docs at `docs.yjs.dev`
- The y-codemirror.next README
- Hocuspocus docs at `tiptap.dev/docs/hocuspocus`

Build a tiny standalone demo: two browser windows editing the same Y.Doc via the public Yjs demo server. Watch the cursors move. Get an intuition for how it feels before you build it yourself.

### 3.2 Set up Hocuspocus

Create the `apps/collab` service. Hocuspocus is a Node.js server you configure with hooks:

- `onAuthenticate` — verify the user's Clerk token, check they have access to the project
- `onLoadDocument` — load Yjs updates from Postgres on first connection
- `onStoreDocument` — persist updates back to Postgres (debounced, every few seconds)

```bash
cd apps/collab
pnpm add @hocuspocus/server @hocuspocus/extension-database
```

Run it on its own port (e.g., 3030). In production it will be its own service behind a load balancer.

### 3.3 Decide on document granularity

**One Y.Doc per file**, not one per project. Lower memory, lazy loading, simpler permission checks. Document name format: `project:{projectId}:file:{fileId}`.

### 3.4 Wire CodeMirror to Yjs

Replace your editor's plain-text state with Yjs state:

```bash
cd apps/web
pnpm add yjs y-codemirror.next y-protocols @hocuspocus/provider
```

In your Editor component:

1. Create a `Y.Doc` per file
2. Connect a `HocuspocusProvider` to your collab server
3. Get the `Y.Text` for the file: `ydoc.getText('content')`
4. Add the `yCollab(ytext, provider.awareness)` extension to CodeMirror

Now open two browser windows pointed at the same file. You should see edits sync in real-time.

### 3.5 Add awareness (cursors, presence, names)

This is what makes it feel magic. The awareness protocol broadcasts ephemeral state (cursor positions, user info) without persisting it.

- Set the local user's info: name, color (assign from a palette based on user ID hash)
- Render remote cursors with floating name labels
- Show "X people in this file" pills at the top of the editor
- Show selections as semi-transparent colored backgrounds

`y-codemirror.next` handles most of this — you mostly style the CSS for cursors and labels.

### 3.6 Persistence layer

Your `onStoreDocument` hook needs to write Yjs updates to Postgres. Two options:

**Append-only log:** every update is a row. Simple, infinite history, but grows fast. Periodically compact.

**Snapshots + tail:** store a periodic full snapshot plus the updates since the last snapshot. Better for reads.

Start with append-only. Add a background job that compacts updates older than 24 hours into a snapshot.

### 3.7 Offline support

Add `y-indexeddb`:

```bash
pnpm add y-indexeddb
```

This persists each Y.Doc to the user's IndexedDB. They can edit offline; when they reconnect, Yjs syncs automatically. This is essentially free once you've set it up.

**Definition of done for Phase 3:** Two users can edit the same file simultaneously. They see each other's cursors and selections. Edits persist across reloads. One user can go offline, edit, come back, and changes merge.

---

## Phase 4 — LaTeX compilation (Weeks 9–11)

Goal: click a button (or save), get a PDF.

### 4.1 Build the TeX Live Docker image

```dockerfile
# docker/texlive.Dockerfile
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y \
    texlive-full latexmk biber \
  && rm -rf /var/lib/apt/lists/*

# Run as non-root
RUN useradd -m -u 1000 latex
USER latex
WORKDIR /workspace

ENTRYPOINT ["latexmk"]
```

Build it: `docker build -t latex-ide-texlive:2025 -f docker/texlive.Dockerfile .`

Yes, this image is ~2.3 GB. That's normal. For faster iterations, you can start with `texlive-base` and add packages as needed, but expect compatibility headaches.

**Optional:** also build a **Tectonic image** (~120 MB) for fast preview compiles. Offer both as a user setting.

### 4.2 Build the compile worker

Create `apps/compile`. It's a Node.js process that:

1. Listens on a BullMQ queue
2. For each job: extracts the project's files from Postgres/Yjs, writes them to a temp directory on **local SSD** (never NFS — Overleaf's docs warn about this explicitly)
3. Spawns the TeX Live container with strict limits:
   ```bash
   docker run --rm \
     --network none \
     --memory 2g \
     --cpus 1 \
     --pids-limit 256 \
     -v /tmp/job-{id}:/workspace \
     latex-ide-texlive:2025 \
     -pdf -interaction=nonstopmode -file-line-error main.tex
   ```
4. Captures stdout and the `.log` file
5. Uploads the resulting PDF to R2
6. Returns the PDF URL + parsed errors via a result on the queue

Key flags: `--network none` (no internet from inside the container), `--memory 2g` (OOM protection), CPU and PID limits to prevent fork bombs.

```bash
cd apps/compile
pnpm add bullmq dockerode
```

### 4.3 Trigger compiles from the API

Add a route: `POST /projects/:id/compile` enqueues a job, returns a job ID. The frontend polls or subscribes via WebSocket for the result.

Or smarter: trigger compiles **automatically on save** (debounced ~2 seconds after the last edit) — like Overleaf's "auto compile" mode. Gate this behind a setting.

### 4.4 Display the PDF

Install pdf.js in the frontend:

```bash
pnpm add pdfjs-dist
```

Build a PDF viewer component in the right pane. Stream the PDF from R2 via a signed URL. Use HTTP range requests so big PDFs load progressively.

Show compile errors inline in the editor: parse the `.log` file for `! LaTeX Error:` lines, extract file + line numbers, and display them as CodeMirror diagnostics (red squiggles).

### 4.5 Add SyncTeX

SyncTeX is what makes "click in PDF → jump to source" work, and vice versa. Compile with `latexmk -pdf -synctex=1`. The output `.synctex.gz` file maps PDF coordinates to source line numbers.

There's a JS library `synctex.js` that parses these files. Wire it up:
- Click anywhere in the PDF → jump to that line in the editor
- Cmd+click in the editor → highlight that part of the PDF

This single feature is probably the #1 thing Overleaf users would miss if it weren't there.

### 4.6 Caching

After the MVP works, add caching: keep the `.aux`, `.bbl`, `.toc` files between compiles. Only delete them when the user does "Recompile from scratch." This makes incremental compiles ~30–50% faster.

**Definition of done for Phase 4:** You can write LaTeX, hit save (or cmd-enter), and a PDF appears in the right pane within a few seconds. Errors show up inline. Click in PDF jumps to source.

---

## Phase 5 — The AI agent layer (Weeks 12–16)

This is where it gets fun. We're building Cursor for LaTeX.

### 5.1 Build the Python agent service

Create `apps/agent` as a FastAPI service:

```bash
cd apps/agent
pip install fastapi uvicorn anthropic openai sse-starlette pydantic
```

The Python service exposes a single streaming endpoint: `POST /agent/run` that takes a project context + a user message and streams back events via Server-Sent Events.

Why Python and not stay in Node? The LLM SDK ecosystem is meaningfully better in Python (LangChain, LlamaIndex, the official Anthropic SDK has more features there). It's a small, self-contained service — keep the boundary clean.

### 5.2 Define the agent loop

The basic structure (pseudocode):

```python
def run_agent(messages, project_context):
    while True:
        response = claude.messages.create(
            model="claude-sonnet-4-5",
            tools=TOOLS,
            messages=messages,
            system=build_system_prompt(project_context),
        )
        yield {"type": "text", "content": response.content}
        if response.stop_reason == "end_turn":
            break
        if response.stop_reason == "tool_use":
            for tool_call in response.tool_uses:
                result = execute_tool(tool_call)
                yield {"type": "tool_result", "tool": tool_call.name, "result": result}
                messages.append({"role": "tool", "content": result})
```

Stream every event over SSE so the UI can show "the agent is thinking / calling tool X / writing to file Y" in real time.

### 5.3 Define the tools

Start with a small but powerful set. Each tool is a function with a JSON schema the LLM understands:

| Tool | Purpose |
|---|---|
| `read_file(path)` | Read a file's current content from the project |
| `list_files()` | Return the project's file tree |
| `edit_file(path, search, replace)` | Replace a block of text. Use exact-match with whitespace fallback |
| `create_file(path, content)` | Make a new file |
| `compile_project()` | Run a compile and return errors |
| `search_in_files(query)` | Grep-style search across the project |
| `search_papers(query)` | Semantic Scholar API |
| `verify_citation(bibtex_entry)` | Check a `.bib` entry against CrossRef |
| `web_search(query)` | Tavily |

**Critical:** the `edit_file` tool is where most coding agents break. Use the layered fallback approach:

1. Try exact string match
2. If that fails, try whitespace-insensitive match
3. If that fails, try fuzzy match with `difflib`
4. If that fails, return an error to the LLM with the actual file content so it can retry

This single decision — robust edit application — is the difference between "useful agent" and "frustrating toy."

### 5.4 The Sketch + Apply pattern (recommended)

For higher reliability, separate **planning** from **applying**:

- **Sketch model:** Claude Sonnet — looks at the project, plans the change, returns a plain-English description of what to do
- **Apply model:** Claude Haiku (cheap, fast) — takes the sketch + the file content, returns the precise edit blocks

This is what Cursor does (with their custom Fast Apply model, but Haiku works fine). It's more reliable than asking one model to both think and produce perfect diffs.

### 5.5 Context management

Don't dump the whole project into the prompt. Build a context layer:

- Always include: file currently open, recent compile errors, project structure (file tree)
- On demand (via tools): file contents, search results, bib entries

Build a simple "section map" — parse `\section`/`\chapter` and create a tiny outline the agent gets in its system prompt. Like a mini repo map.

For very long projects, embed each section with `text-embedding-3-small` and store in pgvector. When the user asks something, retrieve the top 5 most relevant sections.

### 5.6 The chat UI

In the frontend, add a fourth pane (collapsible right sidebar) with the agent chat. It needs:

- Message list (user + assistant turns)
- An input box
- **Tool call cards:** when the agent calls `edit_file`, show a collapsible card with a diff preview and "Accept / Reject" buttons (Cursor-style)
- **Streaming text:** chars appear as the model generates them
- **Status indicator:** "Thinking…" → "Searching papers…" → "Editing main.tex…"

Use the **Vercel AI SDK** (`ai` package) on the frontend to handle SSE parsing and streaming UI — it saves you a lot of plumbing.

### 5.7 Build specialized agents

Once the writing agent works, you can add specialized "modes" that are just different system prompts + different tool subsets:

**Citation Checker Agent** — Tools: `read_file`, `verify_citation`, `search_papers`. System prompt: "Verify every `\cite{}` in the document has a corresponding bib entry, and that each bib entry is real and accurate."

**Deep Research Agent** — Tools: `web_search`, `search_papers`, `read_file`, `edit_file`. System prompt: "Help the user research a topic, find authoritative sources, and write a literature review section." Wire up Tavily for web and Semantic Scholar for academic.

**Proofreader Agent** — Tools: `read_file`, `edit_file`. System prompt: focused on grammar, style, LaTeX best practices.

These are basically the same engine with different tools/prompts. Let users pick from the command palette.

### 5.8 Safety: validate before applying

Before any agent edit lands in the actual Yjs doc:

1. Apply the edit to a *shadow copy* of the file
2. Run a quick `latexmk -draftmode` compile to check for fatal errors
3. Only then commit it to the real document

This is Cursor's "Shadow Workspace" idea. It catches the common failure mode of agents writing broken LaTeX. Skip if you want to ship faster — add it later.

**Definition of done for Phase 5:** You can ask the agent "add a section about X with citations from recent papers," and it actually does it: searches papers, drafts the section, edits the file, and the result compiles. Citations resolve to real papers.

---

## Phase 6 — History, diff, polish (Weeks 17–19)

The features that turn an MVP into something people will actually use.

### 6.1 Version history

Yjs doesn't give you human-friendly history out of the box, but it gives you the building blocks (snapshots).

- On every save (or every N minutes, or on user-triggered "Save version"), capture a Yjs snapshot
- Store snapshots with a label (auto-generated or user-named)
- Build a history panel: timeline of versions with timestamps, authors, and the option to "view at this point" or "restore"

For diffs between two versions: reconstruct both, run `diff-match-patch`, render in `@codemirror/merge`.

### 6.2 Track changes / suggested edits

Once history works, add **suggested edits** — like Google Docs' Suggesting Mode. When a collaborator (or the AI agent) makes a change, instead of applying it directly, mark it as a suggestion the document owner can accept or reject.

Implementation: store suggestions as a separate Yjs map keyed by edit ID, with original/proposed text. Render inline with strikethrough + colored insertion.

### 6.3 Comments

Inline comments tied to text ranges. Yjs has a `RelativePosition` API that's perfect for this — positions stay anchored to text even as it moves around.

UI: highlight selected text → click "comment" → bubble appears in the right margin. Threaded replies. Resolve / unresolve.

### 6.4 Project sharing & roles

UI for inviting collaborators by email. Role assignment (owner / editor / viewer). Public read-only links (like Overleaf's "share by link" mode).

Auth checks happen in two places: the API (for REST routes) and the Hocuspocus `onAuthenticate` hook (for Yjs sync).

### 6.5 Project import/export

- Import a `.zip` of an existing LaTeX project
- Import from a Git URL (use `isomorphic-git`)
- Import from arXiv (download the source `.tar.gz` for a paper)
- Export as a `.zip` or push to a Git repo

This is the one feature that lets people migrate from Overleaf to your tool, so it's high-leverage.

### 6.6 Templates gallery

A handful of starter templates: article, beamer slides, IEEE/ACM/Springer paper formats, thesis, CV. Just `.zip` files in your storage that the "New Project" flow can clone. This dramatically reduces the empty-state friction.

**Definition of done for Phase 6:** The product feels complete enough that you'd actually want to write a paper in it.

---

## Phase 7 — Hosting and launch (Week 20)

### 7.1 Pick your host

For your first 1,000 users, **Hetzner is unbeatable on price/perf**. Recommended:

- **1× CCX33** ($65/mo, 8 dedicated vCPU, 32 GB RAM) — runs everything via Docker Compose
- **Hetzner managed Postgres** ($20/mo) or self-host on the same box
- **Cloudflare R2** (~$0–5/mo for an MVP) — object storage
- **Cloudflare in front** for DNS, CDN, DDoS protection (free)

**Total: ~$100/month** for an MVP that can handle hundreds of concurrent users.

If you want easier deploys at the cost of money, **Railway** or **Fly.io** also work and have nicer UX. Avoid AWS/GCP for the first year — the bills will bite you.

### 7.2 Deployment setup

Write a single `docker-compose.prod.yml` that runs:
- Next.js (web)
- Fastify API
- Hocuspocus collab server
- Compile worker (with Docker socket mounted so it can spawn TeX containers — yes, this is a security tradeoff; consider Firecracker or gVisor later)
- Python agent service
- Postgres
- Redis
- Caddy as the reverse proxy (auto HTTPS via Let's Encrypt — way easier than nginx)

For deploys: build images in CI (GitHub Actions), push to GitHub Container Registry, SSH to the server and `docker compose pull && docker compose up -d`. This is plenty for an MVP — graduate to Kubernetes only when you actually need it.

### 7.3 Observability from day one

- **Sentry** (free tier) — error tracking for both frontend and backend
- **Plausible** or **PostHog** (free tier) — analytics, no cookie banners
- **Better Stack** or **Uptime Robot** — uptime monitoring, ping every minute
- **PostgreSQL slow query log** — turn it on, watch it
- **A `/health` endpoint** on every service — checked by your load balancer

### 7.4 Set spending limits

LLM costs are the #1 way to wake up to a $5,000 bill:

- Set hard monthly caps on your Anthropic and OpenAI accounts
- Implement per-user rate limits (e.g., 50 agent messages/day on free tier)
- Use **prompt caching** aggressively — Claude caches input tokens at 10% of normal cost when content repeats. For a project that's loaded into context many times, this is huge
- Route easy queries to **Haiku**, hard ones to **Sonnet**. A simple classifier (or just heuristics: "did the user ask a question vs. ask for an edit?") saves you 70% on costs

### 7.5 Launch

Honest advice: don't launch publicly until you've used it yourself for two weeks to write something real. Use it for your own writing — a blog post, a paper, a CV, anything. You will find dozens of papercuts that didn't show up in testing. Fix them.

When you do launch: post on Hacker News, the LaTeX subreddit, ML Twitter, and academic Mastodon. Have a Discord ready. Expect the first 100 users to find every bug.

---

## What not to build (resist the urge)

These are tempting but will eat months and add little value early:

- **Your own auth** — use Clerk
- **Your own collaboration protocol** — use Yjs
- **Your own LaTeX engine** — use TeX Live in Docker
- **Kubernetes** — Docker Compose is fine until ~10k users
- **A custom inference server** — use Anthropic / OpenAI APIs
- **Mobile native apps** — the PWA from a good responsive web build is plenty
- **A plugin system** — wait until users ask for it
- **Realtime collaborative cursors in the PDF preview** — no one needs this

---

## Reference repos to study (in priority order)

1. **`overleaf/overleaf`** — read the `services/clsi` (compilation), `services/document-updater` (collab) and `services/web` directories. The single best reference for everything LaTeX-IDE-shaped.
2. **`paul-gauthier/aider`** — best reference for edit application strategies and the Architect/Editor pattern
3. **`ueberdosis/hocuspocus`** examples — production Yjs WebSocket patterns
4. **`cline/cline`** — how an AI coding agent integrates into an IDE chat UI
5. **`All-Hands-AI/OpenHands`** — agent loop with sandboxed tool execution
6. **`yjs/y-codemirror.next`** examples — the canonical CM6 + Yjs integration

---