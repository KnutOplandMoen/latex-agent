# AI agent service

Python FastAPI service that runs the agent loop. Talks to Claude (primary) and OpenAI (fallback). Streams events back to the frontend via Server-Sent Events.

## High-level structure

```
apps/agent/
├── main.py              FastAPI app + SSE endpoint
├── agents/
│   ├── base.py          Shared agent loop
│   ├── writing.py       LaTeX writing assistant
│   ├── citation.py      Bib verification
│   ├── research.py      Web + paper search
│   └── proofreader.py   Style and grammar
├── tools/
│   ├── files.py         read_file, edit_file, list_files, create_file
│   ├── compile.py       compile_project, get_errors
│   ├── papers.py        search_papers (Semantic Scholar), verify_citation (CrossRef)
│   └── web.py           web_search (Tavily)
├── llm/
│   ├── claude.py        Anthropic client wrapper
│   ├── openai.py        OpenAI client wrapper
│   └── router.py        Picks the right model for the task
├── context/
│   ├── builder.py       Builds the system prompt + initial context
│   └── section_map.py   Lightweight project outline
└── prompts/
    ├── writing.md
    ├── citation.md
    └── ...
```

## The agent loop

Every agent shares the same loop. Differences live in tools and prompts.

```python
# agents/base.py
async def run_agent(
    *,
    agent_type: str,
    project_id: str,
    user_id: str,
    messages: list[Message],
) -> AsyncIterator[AgentEvent]:
    tools = TOOLS_FOR[agent_type]
    system = build_system_prompt(agent_type, project_id)

    while True:
        response = await claude.messages.create(
            model=pick_model(agent_type, messages),
            system=system,
            tools=[t.schema for t in tools],
            messages=messages,
            max_tokens=4096,
            stream=True,
        )

        # Stream text tokens as they arrive
        text_blocks: list[str] = []
        tool_calls: list[ToolUse] = []
        async for chunk in response:
            if chunk.type == 'content_block_delta' and chunk.delta.type == 'text_delta':
                text_blocks.append(chunk.delta.text)
                yield TextDelta(text=chunk.delta.text)
            elif chunk.type == 'content_block_stop' and chunk.content_block.type == 'tool_use':
                tool_calls.append(chunk.content_block)
                yield ToolStart(tool=chunk.content_block.name, input=chunk.content_block.input)

        # Add assistant turn to history
        messages.append({'role': 'assistant', 'content': assemble_content(text_blocks, tool_calls)})

        # Stop conditions
        if not tool_calls:
            yield Done()
            return

        # Execute tools, append results, loop
        results = []
        for call in tool_calls:
            try:
                result = await execute_tool(call, project_id=project_id, user_id=user_id)
                yield ToolResult(tool=call.name, result=result)
                results.append({'type': 'tool_result', 'tool_use_id': call.id, 'content': result})
            except ToolError as e:
                yield ToolError(tool=call.name, error=str(e))
                results.append({'type': 'tool_result', 'tool_use_id': call.id, 'content': str(e), 'is_error': True})

        messages.append({'role': 'user', 'content': results})
```

### Why this loop

- Streaming text gives the user immediate feedback ("the agent is writing").
- Tool events let the UI show "calling tool X with args Y" — Cursor-style transparency.
- Errors are fed back to the model as tool results so it can self-correct.

## Tool design principles

1. **Tools are typed.** Use Pydantic models for inputs and outputs. The Anthropic SDK takes a JSON schema — generate it from Pydantic.

2. **Tools are project-scoped.** Every file tool takes a `project_id` injected by the agent service, never trusted from the LLM. The LLM only knows file paths within the project.

3. **Tools return concise results.** A `read_file` should not return a 50KB file — truncate to the first 500 lines and let the LLM ask for more if needed. Big results burn context.

4. **Tools are idempotent where possible.** `edit_file` is the exception — see `tools/files.py` and `llm/apply*.py` for the edit application rules.

5. **Tools fail loudly with helpful messages.** If `read_file` fails because the path is wrong, return the list of available paths so the LLM can self-correct.

```python
# tools/files.py
class ReadFileInput(BaseModel):
    path: str = Field(..., description="Relative path within the project, e.g. 'sections/intro.tex'")

class ReadFileOutput(BaseModel):
    content: str
    truncated: bool
    total_lines: int

async def read_file(input: ReadFileInput, *, project_id: str) -> ReadFileOutput:
    file = await db.get_file_by_path(project_id, input.path)
    if not file:
        available = await db.list_file_paths(project_id)
        raise ToolError(f"No file at '{input.path}'. Available files: {', '.join(available[:20])}")
    text = file.content
    lines = text.splitlines()
    if len(lines) > 500:
        return ReadFileOutput(content='\n'.join(lines[:500]), truncated=True, total_lines=len(lines))
    return ReadFileOutput(content=text, truncated=False, total_lines=len(lines))
```

## Model routing — cost discipline

LLM costs will dominate your bill. Route smart:

```python
def pick_model(agent_type: str, messages: list[Message]) -> str:
    last = messages[-1].content
    if agent_type == 'writing' and is_simple_edit(last):
        return 'claude-haiku-4-5'  # cheap and fast
    if agent_type == 'research':
        return 'claude-sonnet-4-6'  # needs reasoning
    if agent_type == 'citation':
        return 'claude-haiku-4-5'  # mostly verification, structured output
    return 'claude-sonnet-4-6'
```

### Always enable prompt caching

For repeated context (system prompt, project structure, file contents that don't change between turns), use Anthropic's prompt caching — repeated tokens cost 10% of normal input price.

```python
system = [
    {'type': 'text', 'text': base_prompt},
    {'type': 'text', 'text': project_context, 'cache_control': {'type': 'ephemeral'}},
]
```

## Context building

Don't dump the whole project. Build a minimal context:

1. **Always:** project name, file tree (paths only, ~50 lines max), currently open file
2. **Always:** last compile errors (if any) — they're often what the user wants help with
3. **On demand via tools:** file contents, search results, bib entries

For projects > 30 files, build an embedding index of sections and retrieve the top 5 most relevant on each turn.

## Streaming protocol (SSE)

The frontend speaks SSE. Each event is a JSON line with a `type`:

```python
@app.post('/agent/run')
async def agent_run(req: AgentRunRequest, user: User = Depends(current_user)):
    async def event_stream():
        async for event in run_agent(
            agent_type=req.agent_type,
            project_id=req.project_id,
            user_id=user.id,
            messages=req.messages,
        ):
            yield f"data: {event.model_dump_json()}\n\n"
    return EventSourceResponse(event_stream())
```

Event types:
- `text_delta` — streamed text from the model
- `tool_start` — model called a tool
- `tool_result` — tool finished successfully
- `tool_error` — tool failed (LLM will see this and may retry)
- `done` — agent finished
- `error` — fatal error (auth, model failure, etc.)

## Auth boundary

The agent service trusts ONLY the API gateway. It verifies the Clerk JWT on every request and looks up project membership before running. **Never** take a project ID without checking the user has access.

## Anti-patterns

- ❌ Long-running global `messages` list. Each request is stateless — history comes in via the request body.
- ❌ Synchronous LLM calls. Always async, always streaming.
- ❌ Tools that touch the filesystem directly. Files live in Yjs/Postgres, accessed via the API/db — not via `open()`.
- ❌ Letting tools take a `user_id` from the LLM input. Inject it server-side.
- ❌ Returning huge tool results (>4KB) without truncation.
- ❌ Hardcoding model names in tool code. Use `pick_model()`.
- ❌ Catching exceptions silently. Errors should surface to the user as `tool_error` events.
- ❌ Skipping cache_control on stable context. You're leaving 90% cost savings on the table.

---

# AI edit application

How the agent modifies files is the highest-leverage technical decision in the AI layer. Get this right and the agent feels magical. Get it wrong and users will rage-quit.

## The format we use: search/replace blocks

The agent emits edits in this format (model output):

```
<<<<<<< SEARCH
\section{Introduction}
This is a placeholder.
=======
\section{Introduction}
The transformer architecture, introduced by Vaswani et al.~\cite{vaswani2017},
revolutionized sequence modeling.
>>>>>>> REPLACE
```

We parse these out of the assistant message and apply them. Why this format and not unified diffs:
- LLMs produce it more reliably than diffs (no line numbers to hallucinate).
- It works across all major models.
- It's human-readable in the chat UI.
- Aider achieved 85% on its code-editing benchmark using this format.

## The layered fallback — critical

Exact string matching fails ~30% of the time on real code (whitespace, line endings, the model paraphrasing slightly). Use four layers, falling through on failure:

```python
# llm/apply.py
def apply_edit(file_content: str, search: str, replace: str) -> str:
    # Layer 1: exact match
    if search in file_content:
        return file_content.replace(search, replace, 1)

    # Layer 2: whitespace-normalized match
    normalized_file = normalize_ws(file_content)
    normalized_search = normalize_ws(search)
    if normalized_search in normalized_file:
        location = find_with_normalized(file_content, search)
        return file_content[:location.start] + replace + file_content[location.end:]

    # Layer 3: indentation-flexible match
    flexible = try_flexible_indent_match(file_content, search, replace)
    if flexible is not None:
        return flexible

    # Layer 4: fuzzy match with difflib
    fuzzy = try_fuzzy_match(file_content, search, replace, threshold=0.85)
    if fuzzy is not None:
        return fuzzy

    # Give up — return a structured error so the LLM can self-correct
    raise EditApplyError(
        message=f"Could not find the search block in the file.",
        file_excerpt=file_content[:2000],
        search_attempted=search,
    )

def normalize_ws(s: str) -> str:
    return re.sub(r'\s+', ' ', s).strip()
```

When the edit fails, **the error becomes a tool result the LLM sees**. The next turn, the LLM sees its own search block, sees what the file actually contains, and tries again with a corrected block.

## The Sketch + Apply pattern (recommended for production)

Two models, two roles:

- **Sketch model (Claude Sonnet):** thinks about the project, plans the change, returns a plain-English description of what to do — not precise diffs.
- **Apply model (Claude Haiku):** receives the sketch + the file content, returns the precise search/replace blocks.

```python
async def edit_with_sketch_apply(
    file_path: str,
    file_content: str,
    user_intent: str,
    project_context: str,
) -> list[Edit]:
    # Step 1: Sketch (slow, smart)
    sketch = await claude.messages.create(
        model='claude-sonnet-4-6',
        system=SKETCH_PROMPT,
        messages=[{
            'role': 'user',
            'content': f"User wants: {user_intent}\n\nFile {file_path}:\n{file_content}\n\n"
                       f"Project context:\n{project_context}\n\n"
                       "Describe the change you'd make in plain English. Do NOT write code yet."
        }],
        max_tokens=1024,
    )

    # Step 2: Apply (fast, cheap, focused)
    edits = await claude.messages.create(
        model='claude-haiku-4-5',
        system=APPLY_PROMPT,
        messages=[{
            'role': 'user',
            'content': f"File {file_path}:\n{file_content}\n\n"
                       f"Change to make:\n{sketch.content[0].text}\n\n"
                       "Output search/replace blocks only."
        }],
        max_tokens=2048,
    )

    return parse_search_replace_blocks(edits.content[0].text)
```

### Why two models

- The strong model thinks clearly without being constrained by output format.
- The cheap model focuses on a narrow task it does well: producing one specific edit format.
- Cost: roughly 70% cheaper than asking Sonnet to do both.
- Reliability: noticeably higher edit-success rate than single-model edits.

## Validation before commit — Shadow Workspace

Before any edit lands in the actual Yjs doc:

1. Apply the edit to a **shadow copy** of the file (just an in-memory string).
2. Run a fast `latexmk -draftmode` compile — produces no PDF, fast (~2s for most projects).
3. If the compile gets new fatal errors that weren't there before, **reject** the edit and feed the error back to the LLM.
4. Only commit accepted edits to Yjs.

```python
async def apply_with_validation(project_id: str, file_path: str, edit: Edit) -> ApplyResult:
    original = await read_file_from_yjs(project_id, file_path)
    new_content = apply_edit(original, edit.search, edit.replace)

    pre_errors = await fast_compile(project_id, override={file_path: original})
    post_errors = await fast_compile(project_id, override={file_path: new_content})

    new_errors = diff_errors(pre_errors, post_errors)
    if new_errors:
        return ApplyResult(
            success=False,
            reason='introduces_compile_errors',
            errors=new_errors,
            new_content=new_content,
        )

    await write_file_to_yjs(project_id, file_path, new_content)
    return ApplyResult(success=True)
```

## How edits land in Yjs

Edits do NOT bypass Yjs. The agent service writes edits through the same Yjs sync pipeline that human edits use:

```python
# apps/agent/yjs_writer.py
async def write_file_to_yjs(project_id: str, file_path: str, new_content: str) -> None:
    doc = Y.YDoc()
    provider = HocuspocusProvider(
        url=COLLAB_URL,
        name=f'project:{project_id}:file:{file_id}',
        document=doc,
        token=AGENT_SERVICE_TOKEN,  # service-to-service auth
    )
    await provider.connected

    ytext = doc.get_text('content')
    with doc.transaction(origin='agent'):
        ytext.delete(0, len(ytext))
        ytext.insert(0, new_content)

    await provider.flush()
    provider.destroy()
```

Why route through Yjs and not write directly to Postgres:
- Other connected clients see the change in real time.
- Undo works — users can undo an agent's change.
- The change has an `origin: 'agent'` tag so the UI can highlight it differently.
- One source of truth, no sync issues.

## Edit confirmation UI

In the chat UI, every agent edit shows up as a card with:

- A `@codemirror/merge` diff preview (before / after)
- Filename and line range
- **Accept** and **Reject** buttons
- An "Accept all" button at the bottom of the message if there are multiple edits

By default, edits are NOT auto-applied. The user must accept them. (Power users can opt into auto-apply in settings — Cursor calls this "YOLO mode.")

## Anti-patterns

- ❌ Asking the LLM to output a full file rewrite. Slow, expensive, error-prone for big files.
- ❌ Using line numbers in the edit format. LLMs hallucinate them constantly.
- ❌ Single-layer exact matching with no fallback. ~30% failure rate.
- ❌ Failing silently when an edit doesn't apply. Always feed the error back to the model.
- ❌ Auto-applying edits without user confirmation on the first project. Build trust first.
- ❌ Bypassing Yjs to write edits directly to the database. Breaks realtime sync.
- ❌ Letting the LLM see an unbounded file. Truncate `read_file` results to the first 500 lines.
- ❌ Re-running the entire agent loop after an edit failure instead of feeding the error as a tool result. Wastes tokens, slower iteration.
