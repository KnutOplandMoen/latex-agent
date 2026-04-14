'use client';

import { useEffect, useRef, useCallback } from 'react';
import { EditorState, type Extension } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection, rectangularSelection, crosshairCursor, highlightSpecialChars } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import { autocompletion, completionKeymap, closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import { bracketMatching, indentOnInput, foldGutter, foldKeymap } from '@codemirror/language';
import { linter, lintKeymap } from '@codemirror/lint';
import { oneDark } from '@codemirror/theme-one-dark';
import { latex, latexLinter } from 'codemirror-lang-latex';

interface EditorProps {
  initialDoc?: string;
  onDocChange?: (doc: string) => void;
  extensions?: Extension[];
}

export function Editor({ initialDoc = '', onDocChange, extensions: extraExtensions = [] }: EditorProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onDocChangeRef = useRef(onDocChange);

  useEffect(() => {
    onDocChangeRef.current = onDocChange;
  }, [onDocChange]);

  const getExtensions = useCallback((): Extension[] => {
    return [
      lineNumbers(),
      highlightActiveLineGutter(),
      highlightSpecialChars(),
      history(),
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
        ...historyKeymap,
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

      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          onDocChangeRef.current?.(update.state.doc.toString());
        }
      }),

      EditorView.theme({
        '&': { height: '100%' },
        '.cm-scroller': { overflow: 'auto', fontFamily: 'var(--font-mono)' },
        '.cm-content': { padding: '8px 0' },
        '.cm-gutters': { borderRight: '1px solid #3e4451' },
      }),

      ...extraExtensions,
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!hostRef.current) return;

    const state = EditorState.create({
      doc: initialDoc,
      extensions: getExtensions(),
    });

    viewRef.current = new EditorView({ state, parent: hostRef.current });
    return () => viewRef.current?.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={hostRef} className="h-full w-full" />;
}
