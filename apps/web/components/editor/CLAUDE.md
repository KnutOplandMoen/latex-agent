# CodeMirror 6

CM6 is fundamentally different from CM5 and Monaco. Most online examples are CM5 — they will not work. Use these patterns.

## Mental model

- **State is immutable.** You never mutate. You dispatch `Transaction`s that produce a new `EditorState`.
- **Everything is an extension.** Syntax highlighting, autocomplete, keymaps, themes, collab — all extensions.
- **The view is a thin layer over the state.** `EditorView` renders an `EditorState`. They are separate.
- **No more `.setValue()`.** Use a transaction that replaces the document.

## React integration — the only correct pattern

```ts
// components/editor/Editor.tsx
'use client';

import { useEffect, useRef } from 'react';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap, lineNumbers } from '@codemirror/view';
import { defaultKeymap } from '@codemirror/commands';
import { latex } from 'codemirror-lang-latex';

export function Editor({ initialDoc, onChange }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  // Mount once. Do NOT recreate the view on every render.
  useEffect(() => {
    if (!hostRef.current) return;

    const state = EditorState.create({
      doc: initialDoc,
      extensions: [
        lineNumbers(),
        keymap.of(defaultKeymap),
        latex(),
        EditorView.updateListener.of((u) => {
          if (u.docChanged) onChange(u.state.doc.toString());
        }),
      ],
    });

    viewRef.current = new EditorView({ state, parent: hostRef.current });
    return () => viewRef.current?.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // empty deps — mount once

  return <div ref={hostRef} className="h-full" />;
}
```

### Why this pattern

- The editor mounts **once**. React state never owns the document.
- The `updateListener` notifies React of changes. React reads — never writes — the doc.
- Cleanup destroys the view to prevent leaks.

### Anti-patterns — never do these

```ts
// ❌ Recreating the view when props change
useEffect(() => {
  const view = new EditorView({ /* ... */ });
  return () => view.destroy();
}, [initialDoc]); // ← runs every change, kills cursor position, breaks collab

// ❌ Using state to control the doc
const [doc, setDoc] = useState('');
<Editor value={doc} onChange={setDoc} /> // CM is not a controlled input

// ❌ Calling .setValue
viewRef.current.setValue(newDoc); // doesn't exist on CM6

// ❌ Mutating state
state.doc = newDoc; // immutable, no effect
```

## Updating the document programmatically

Always go through a transaction:

```ts
view.dispatch({
  changes: { from: 0, to: view.state.doc.length, insert: newContent },
});
```

For a localized edit:

```ts
view.dispatch({
  changes: { from: pos, to: pos, insert: '\\section{}' },
  selection: { anchor: pos + 9 }, // place cursor inside the braces
});
```

## Building extensions

Extensions compose. Group related extensions in a single function that returns an array:

```ts
// packages/latex-lang/snippets.ts
export function latexSnippets(): Extension {
  return [
    snippetCompletion('\\begin{${1:env}}\n\t${0}\n\\end{${1}}', { label: '\\begin' }),
    // ...
  ];
}
```

Then compose them at the top level:

```ts
extensions: [
  basicSetup,
  latex(),
  latexSnippets(),
  latexLinter(),
  yCollab(ytext, provider.awareness), // see yjs CLAUDE.md
  ourTheme,
],
```

## State fields and effects

When an extension needs its own state (e.g., a list of compile errors to display), use `StateField`:

```ts
const compileErrors = StateField.define<Diagnostic[]>({
  create: () => [],
  update(value, tr) {
    for (const e of tr.effects) {
      if (e.is(setCompileErrors)) return e.value;
    }
    return value;
  },
});

const setCompileErrors = StateEffect.define<Diagnostic[]>();

// From outside:
view.dispatch({ effects: setCompileErrors.of(newErrors) });
```

## Decorations (highlights, gutters, etc.)

Use `ViewPlugin` for view-derived decorations (don't need to be in state). Use `StateField` when decorations must survive across views or be part of undo history.

## Performance gotchas

- Decorations on every line in a 10k-line file → use `RangeSetBuilder` and only build for the visible range.
- Don't read `view.state.doc.toString()` on every keystroke — that allocates a full copy. Use `doc.sliceString(from, to)` for ranges.
- Heavy linting → debounce in a `ViewPlugin` with a timer, not on every update.

## Imports — use these specific packages

| Need | Package |
|---|---|
| Core | `@codemirror/state`, `@codemirror/view` |
| Language (LaTeX) | `codemirror-lang-latex` |
| Autocomplete | `@codemirror/autocomplete` |
| Search | `@codemirror/search` |
| Lint | `@codemirror/lint` |
| Commands | `@codemirror/commands` |
| Merge view (diffs) | `@codemirror/merge` |
| Collab (Yjs) | `y-codemirror.next` |
| Theme one-dark | `@codemirror/theme-one-dark` |

Do **not** import from `codemirror` (the umbrella package) — it bundles everything and bloats the build.
