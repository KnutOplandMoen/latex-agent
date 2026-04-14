'use client';

import { useEffect, useRef, useCallback, useImperativeHandle, forwardRef } from 'react';
import { EditorState, type Extension } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection, rectangularSelection, crosshairCursor, highlightSpecialChars } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import { autocompletion, completionKeymap, closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import { bracketMatching, indentOnInput, foldGutter, foldKeymap } from '@codemirror/language';
import { linter, lintKeymap, setDiagnostics, type Diagnostic } from '@codemirror/lint';
import { oneDark } from '@codemirror/theme-one-dark';
import { latex, latexLinter } from 'codemirror-lang-latex';
import type * as Y from 'yjs';

export interface ExternalDiagnostic {
  line: number;
  message: string;
  severity: 'error' | 'warning' | 'info';
}

export interface EditorHandle {
  insertText: (text: string) => void;
  scrollToLine: (line: number) => void;
  setExternalDiagnostics: (diagnostics: ExternalDiagnostic[]) => void;
  getCursorLine: () => number | null;
}

interface BaseEditorProps {
  extensions?: Extension[];
}

interface PlainTextEditorProps extends BaseEditorProps {
  mode?: 'plain';
  initialDoc?: string;
  onDocChange?: (doc: string) => void;
  ytext?: never;
  awareness?: never;
}

interface CollabEditorProps extends BaseEditorProps {
  mode: 'collab';
  ytext: Y.Text;
  /** Awareness instance from the Hocuspocus provider — typed as unknown since yCollab accepts any */
  awareness: unknown;
  initialDoc?: never;
  onDocChange?: never;
}

type EditorProps = PlainTextEditorProps | CollabEditorProps;

const CURSOR_STYLES: Record<string, string> = {
  '.cm-ySelectionCaret': `
    position: relative;
    border-left: 2px solid;
    margin-left: -1px;
    margin-right: -1px;
  `,
  '.cm-ySelectionCaretDot': `
    display: none;
  `,
  '.cm-ySelectionInfo': `
    position: absolute;
    top: -1.4em;
    left: -1px;
    font-size: 0.7em;
    font-family: var(--font-mono);
    font-style: normal;
    font-weight: 600;
    line-height: normal;
    user-select: none;
    padding: 1px 4px;
    border-radius: 3px 3px 3px 0;
    white-space: nowrap;
    opacity: 1;
    transition: opacity 0.3s ease-in-out;
    pointer-events: none;
    z-index: 10;
  `,
  '.cm-ySelection': `
    opacity: 0.3;
  `,
  '.cm-yLineSelection': `
    opacity: 0.15;
  `,
};

export const Editor = forwardRef<EditorHandle, EditorProps>(function Editor(
  props,
  ref,
) {
  const {
    extensions: extraExtensions = [],
  } = props;

  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onDocChangeRef = useRef(
    props.mode === 'collab' ? undefined : props.onDocChange,
  );

  useEffect(() => {
    if (props.mode !== 'collab') {
      onDocChangeRef.current = props.onDocChange;
    }
  }, [props.mode, props.mode === 'collab' ? undefined : props.onDocChange]);

  const getExtensions = useCallback((): Extension[] => {
    const base: Extension[] = [
      lineNumbers(),
      highlightActiveLineGutter(),
      highlightSpecialChars(),
      foldGutter(),
      drawSelection(),
      rectangularSelection(),
      crosshairCursor(),
      indentOnInput(),
      bracketMatching(),
      closeBrackets(),
      autocompletion(),
      highlightActiveLine(),
      highlightSelectionMatches(),

      keymap.of([
        ...closeBracketsKeymap,
        ...defaultKeymap,
        ...searchKeymap,
        ...foldKeymap,
        ...completionKeymap,
        ...lintKeymap,
        indentWithTab,
      ]),

      latex({
        autoCloseTags: true,
        enableLinting: true,
        enableTooltips: true,
        enableAutocomplete: true,
        autoCloseBrackets: true,
      }),
      linter(latexLinter()),
      oneDark,

      EditorView.theme({
        '&': { height: '100%' },
        '.cm-scroller': { overflow: 'auto', fontFamily: 'var(--font-mono)' },
        '.cm-content': { padding: '8px 0' },
        '.cm-gutters': { borderRight: '1px solid #3e4451' },
        ...CURSOR_STYLES,
      }),
    ];

    if (props.mode === 'collab') {
      // yCollab handles undo/redo via Y.UndoManager — no need for CM history()
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { yCollab } = require('y-codemirror.next') as typeof import('y-codemirror.next');
      base.push(yCollab(props.ytext, props.awareness));
    } else {
      base.push(
        history(),
        keymap.of([...historyKeymap]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onDocChangeRef.current?.(update.state.doc.toString());
          }
        }),
      );
    }

    base.push(...extraExtensions);

    return base;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useImperativeHandle(ref, () => ({
    insertText(text: string) {
      const view = viewRef.current;
      if (!view) return;
      const { from, to } = view.state.selection.main;
      view.dispatch({ changes: { from, to, insert: text } });
      view.focus();
    },
    scrollToLine(line: number) {
      const view = viewRef.current;
      if (!view) return;
      const lineCount = view.state.doc.lines;
      const clampedLine = Math.max(1, Math.min(line, lineCount));
      const lineInfo = view.state.doc.line(clampedLine);
      view.dispatch({
        selection: { anchor: lineInfo.from },
        effects: EditorView.scrollIntoView(lineInfo.from, { y: 'center' }),
      });
      view.focus();
    },
    setExternalDiagnostics(externalDiags: ExternalDiagnostic[]) {
      const view = viewRef.current;
      if (!view) return;
      const cmDiags: Diagnostic[] = externalDiags
        .filter((d) => d.line >= 1 && d.line <= view.state.doc.lines)
        .map((d) => {
          const lineInfo = view.state.doc.line(d.line);
          return {
            from: lineInfo.from,
            to: lineInfo.to,
            severity: d.severity,
            message: d.message,
            source: 'latex-compile',
          };
        });
      view.dispatch(setDiagnostics(view.state, cmDiags));
    },
    getCursorLine() {
      const view = viewRef.current;
      if (!view) return null;
      const pos = view.state.selection.main.head;
      return view.state.doc.lineAt(pos).number;
    },
  }));

  useEffect(() => {
    if (!hostRef.current) return;

    const stateConfig: Parameters<typeof EditorState.create>[0] = {
      extensions: getExtensions(),
    };

    // In plain-text mode, use the provided initial content.
    // In collab mode, initialise from the current Y.Text so CodeMirror is not
    // blank on first load. yCollab only observes *future* changes — it does not
    // seed the initial document from Y.Text (see y-codemirror.next README).
    if (props.mode !== 'collab') {
      stateConfig.doc = props.initialDoc ?? '';
    } else {
      stateConfig.doc = props.ytext.toString();
    }

    const state = EditorState.create(stateConfig);

    viewRef.current = new EditorView({ state, parent: hostRef.current });
    return () => viewRef.current?.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={hostRef} className="h-full w-full" />;
});
