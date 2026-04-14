# LaTeX IDE — Cursor / Claude Code rules

A set of rule files (skills) that guide an AI coding agent working on the LaTeX IDE project. Drop them into your editor's rules directory and the agent will follow them.

## Where to put these files

### Cursor
Put all the `.mdc` files in `.cursor/rules/` at your repo root:
```
your-project/
└── .cursor/
    └── rules/
        ├── 00-project-overview.mdc
        ├── 10-codemirror.mdc
        └── ...
```
Cursor reads the frontmatter (`description`, `globs`, `alwaysApply`) and decides when to load each rule.

### Claude Code
Rename them to `.md` (drop the front-matter `globs:` field — Claude Code uses different conventions) and place them in `.claude/skills/` or reference them from a top-level `CLAUDE.md`. The simplest setup: concatenate them all into `CLAUDE.md`.

### Windsurf, Continue.dev, etc.
Most modern AI IDEs read either `.cursor/rules/*.mdc` directly or have a similar convention. Check your editor's docs.

## What's in here

| File | Triggers on | What it covers |
|---|---|---|
| `00-project-overview.mdc` | always | Project description, stack, non-negotiables, conventions |
| `10-codemirror.mdc` | editor files | CM6 patterns, React integration, anti-patterns |
| `20-yjs-collab.mdc` | collab files | Yjs document lifecycle, awareness, persistence |
| `30-latex-compilation.mdc` | compile worker | Docker sandboxing, security, log parsing, SyncTeX |
| `40-agent-service.mdc` | agent service | Agent loop, tools, model routing, prompt caching |
| `41-ai-edit-application.mdc` | edit code | Search/replace blocks, layered fallback, Sketch+Apply |
| `50-fastify-api.mdc` | API code | Routes, services, auth, error handling |
| `60-database-drizzle.mdc` | DB code | Schema, migrations, querying, transactions |
| `70-testing.mdc` | test files | What to test, what to skip, fixtures |

## How they're numbered

The `00`, `10`, `20`... numbering is for human reading order, not enforced by Cursor. The overview comes first; the rest are roughly in the order of the build phases.

## Why "rules" and not "skills"?

In Cursor, these are called **rules** (Cursor Rules). The Claude Code equivalent is sometimes called **skills** or just **CLAUDE.md guidance**. Same idea: a markdown file the AI reads to learn how to behave on your codebase.

## Customization

These rules are opinionated based on the roadmap. As you build, you'll discover patterns specific to your codebase — add them. Suggested workflow:

1. When you fix a recurring agent mistake, add the lesson to the matching rule file.
2. When you adopt a new library, write a short rule file for it.
3. When the agent does something great that you want to repeat, codify it.

The rules aren't sacred — they're a living spec for "how this codebase wants to be edited."

## Adding a new rule file

Use this template:

```mdc
---
description: One sentence about what this covers and when it applies.
globs: apps/foo/**/*.ts, packages/foo/**/*.ts
---

# Rule title

Brief context for why this rule exists.

## The pattern

Concrete code examples.

## Anti-patterns

- ❌ Things not to do
```

Keep them under ~300 lines each. The agent has limited context — focused rules beat sprawling ones.
