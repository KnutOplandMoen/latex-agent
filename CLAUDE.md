# LaTeX IDE — Claude Code rules

This file is always loaded by Claude Code. It covers project overview, coding conventions, and general agent behaviour. More specific rules live in `CLAUDE.md` files co-located with the code they describe — Claude Code picks these up automatically when you open files in those directories.

---

# LaTeX IDE — project overview

A web-based collaborative LaTeX IDE with Cursor-style AI agents. Think "Overleaf meets Cursor."

## What this project is

- Multi-user real-time collaborative LaTeX editor (Overleaf-style)
- Browser-based, no install
- AI coding agent that can edit `.tex` files, fix compile errors, search papers
- Specialized agents: writing, citation checking, deep research, proofreading

## Architecture (monorepo)

```
apps/
  web/      Next.js 15 frontend (App Router, RSC, React 19)
  api/      Fastify main API (Node.js + TypeScript)
  collab/   Hocuspocus Yjs WebSocket server
  compile/  LaTeX compile worker (BullMQ → Docker → TeX Live)
  agent/    Python FastAPI agent service (LLM orchestration)
packages/
  shared-types/   Zod schemas + TS types shared by web and api
  db/             Drizzle ORM schema + migrations
  latex-lang/     Custom CodeMirror 6 LaTeX extensions
docker/
  texlive.Dockerfile
  docker-compose.yml
```

## The stack (do not change without explicit user approval)

| Layer | Choice |
|---|---|
| Frontend | Next.js 15 + React 19 + TypeScript |
| Editor | CodeMirror 6 + `codemirror-lang-latex` |
| Realtime | Yjs + `y-codemirror.next` + Hocuspocus |
| Backend | Fastify (Node/TS) |
| Agent service | Python FastAPI |
| DB | PostgreSQL 16 + Drizzle ORM |
| Cache/queue | Redis 7 + BullMQ |
| Object storage | Cloudflare R2 (S3-compatible) |
| Auth | Clerk |
| LaTeX runtime | TeX Live full in Docker |
| LLM APIs | Anthropic Claude (primary), OpenAI (fallback) |

## Important non-negotiables

- **Never** suggest replacing CodeMirror 6 with Monaco. The decision is locked.
- **Never** suggest replacing Yjs with Operational Transform. CRDTs are locked.
- **Never** run user LaTeX outside a Docker sandbox. This is a security boundary.
- **Never** put compile working directories on networked storage (NFS, EBS gp2). Local SSD only — Overleaf documented that this causes "unexpected compile errors."
- **Never** keep Y.Doc instances in the main API process memory. Yjs lives in the `collab` service.
- **Never** add browser storage (`localStorage`, `sessionStorage`) inside the editor — use Yjs + IndexedDB via `y-indexeddb`.

## Coding conventions

- TypeScript strict mode everywhere. No `any` without an `// eslint-disable-next-line` and a comment explaining why.
- Zod schemas live in `packages/shared-types` and are imported by both frontend and backend. Never duplicate type definitions.
- API responses always go through a Zod schema before being sent.
- Database access only through Drizzle. No raw SQL except in migrations.
- Async/await everywhere. No `.then()` chains.
- Error handling: throw typed errors, catch at the route boundary, return structured error responses.
- File naming: kebab-case for files, PascalCase for React components, camelCase for everything else.
- No default exports except for Next.js pages and React components.

## When the user asks "how should I do X"

1. Check if there's a more specific CLAUDE.md loaded for this area (codemirror, yjs, latex, agent, etc.) — those override this file.
2. Match the existing patterns in the codebase before inventing new ones.
3. If introducing a new dependency, justify why an existing one doesn't work.
4. Prefer boring technology. This project is already complex enough.

---

# General agent behaviour

## 1. Think Before Coding

Don't assume. Don't hide confusion. Surface tradeoffs.

Before implementing:

- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them — don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

Minimum code that solves the problem. Nothing speculative.

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.
- Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

Touch only what you must. Clean up only your own mess.

When editing existing code:

- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it — don't delete it.

When your changes create orphans:

- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.
- The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

Define success criteria. Loop until verified.

Transform tasks into verifiable goals:

- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:

1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

## 5. Always read documentation, and update / add documentation that clarifies what you have made so that another engineer can understand your thoughts.

## 6. Keep the Roadmap Up to Date

After completing a phase, feature, or meaningful chunk of work, update `roadmap.md`:

- Mark completed phases/items as done in the progress table.
- Update the "What exists today" section to reflect new capabilities.
- Move resolved items out of "Known issues / next steps" and add new ones.
- If a phase is partially done, note what's finished and what remains.

The roadmap is the single source of truth for project status. If it's stale, no one (including the AI) knows where the project stands.

---

# Testing strategy

Real talk: a project this size cannot have 100% test coverage. Test what matters, skip what doesn't. The goal is to ship without obvious regressions, not to win a coverage award.

## What to test (in priority order)

### 1. Permission boundaries — always, no exceptions

Any code that decides "can user X do action Y on project Z" gets tests. This is where security bugs live.

```ts
// apps/api/src/services/projects.test.ts
describe('getProject', () => {
  it('returns the project for a member', async () => {
    const { user, project } = await seed({ asMember: true });
    const result = await getProject(project.id, user.id);
    expect(result.id).toBe(project.id);
  });

  it('throws ForbiddenError for a non-member', async () => {
    const { user, project } = await seed({ asMember: false });
    await expect(getProject(project.id, user.id)).rejects.toThrow(ForbiddenError);
  });

  it('throws NotFoundError for a deleted project', async () => {
    // ...
  });
});
```

Test the same for every route that takes a project ID, file ID, or user ID from the request.

### 2. The agent edit-application logic

Layered fallback edit application is critical and has many edge cases. Cover them:

```python
# apps/agent/tests/test_apply.py
class TestEditApply:
    def test_exact_match(self):
        result = apply_edit("hello world", search="hello", replace="goodbye")
        assert result == "goodbye world"

    def test_whitespace_normalized(self):
        file = "def foo(  ):\n    return 1"
        result = apply_edit(file, search="def foo():\n    return 1", replace="def foo():\n    return 2")
        assert "return 2" in result

    def test_indentation_flexible(self):
        file = "    if x:\n        return 1"
        result = apply_edit(file, search="if x:\n    return 1", replace="if x:\n    return 2")
        assert "return 2" in result

    def test_fails_loudly_when_unfindable(self):
        with pytest.raises(EditApplyError) as exc_info:
            apply_edit("unrelated content", search="not present", replace="x")
        assert "not present" in str(exc_info.value)
        assert "unrelated content" in exc_info.value.file_excerpt
```

### 3. LaTeX log parsing

Real LaTeX logs are messy. Snapshot tests are perfect here:

```ts
it('parses a missing brace error', () => {
  const log = readFileSync('./fixtures/missing-brace.log', 'utf-8');
  expect(parseLog(log)).toMatchSnapshot();
});
```

Collect real log fixtures from broken compiles in dev. Add a new fixture every time a user reports a parsing bug.

### 4. Yjs persistence round-trips

```ts
it('round-trips a Yjs document through the database', async () => {
  const doc = new Y.Doc();
  doc.getText('content').insert(0, '\\section{Test}');
  const update = Y.encodeStateAsUpdate(doc);
  await saveYjsUpdate('test-doc', update);
  const loaded = await loadYjsState('test-doc');
  const restored = new Y.Doc();
  Y.applyUpdate(restored, loaded);
  expect(restored.getText('content').toString()).toBe('\\section{Test}');
});
```

### 5. End-to-end smoke tests

One per critical user path. Use Playwright. Don't try to be exhaustive — just catch broken pages.

- Sign up → create project → see editor
- Edit a `.tex` file → save → reload → changes are there
- Compile a project → PDF appears
- Two users in the same project see each other's edits
- Send an agent message → get a response

## What NOT to test

- ❌ React component snapshots. They break on every UI tweak and nobody reads the diffs.
- ❌ CodeMirror itself. It's tested upstream.
- ❌ Yjs itself. Same.
- ❌ Drizzle queries that just call `db.select`. Trust the ORM.
- ❌ Trivial getters and setters.
- ❌ Pure presentational components with no logic.
- ❌ Anything that requires mocking the LLM API extensively. Test the agent loop with a fake LLM, not by stubbing 50 lines of API responses.

## Test infrastructure

### Database

Each test gets a clean schema. Use **testcontainers** to spin up Postgres per test file:

```ts
// test/setup.ts
import { PostgreSqlContainer } from '@testcontainers/postgresql';

export async function setupTestDb() {
  const container = await new PostgreSqlContainer().start();
  const db = drizzle(container.getConnectionUri());
  await migrate(db, { migrationsFolder: './packages/db/migrations' });
  return { db, teardown: () => container.stop() };
}
```

### LLM calls

Build a fake Claude client that returns canned responses keyed by the input. Use it in tests:

```python
class FakeClaudeClient:
    def __init__(self, responses: dict[str, str]):
        self.responses = responses
        self.calls = []

    async def messages_create(self, **kwargs):
        self.calls.append(kwargs)
        key = hash_messages(kwargs['messages'])
        return MockResponse(text=self.responses[key])
```

Use real API calls only in a separate `tests/integration/` suite that runs nightly, not on every PR.

### Compile worker

Don't actually run TeX Live in unit tests. Mock the Docker call and feed canned log output. Run a real compile in one integration test.

## When NOT to write a test first

Greenfield exploration. If you're trying to figure out what the API should even look like, write the code, get it working, then write a test for the version you settled on. TDD is great for known shapes, slow for unknown ones.

## Coverage target

Aim for ~60% line coverage across the project, with the **critical paths above at 90%+**. A 60% project that covers the right things is safer than an 85% project that tests trivia.

## Anti-patterns

- ❌ Mocking the database. Use testcontainers.
- ❌ Sleeping in tests to wait for async work. Use proper awaiting.
- ❌ Tests that depend on each other or run order.
- ❌ Tests that hit real LLM APIs in CI (cost + flakiness).
- ❌ One giant integration test instead of small focused unit tests.
- ❌ Snapshot tests of UI components.
- ❌ Skipping a test instead of fixing or deleting it. `it.skip` rots.
