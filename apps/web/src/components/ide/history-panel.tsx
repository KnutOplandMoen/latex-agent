'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { MergeView } from '@codemirror/merge';
import { oneDark } from '@codemirror/theme-one-dark';
import { ArrowLeft, Clock, Save, Loader2, Undo2 } from 'lucide-react';
import type { Text as YText } from 'yjs';
import type { Snapshot } from '@latex-ide/shared-types';
import type { ApiClient } from '@/lib/api';

interface HistoryPanelProps {
  projectId: string;
  fileId: string | null;
  ytext: YText | null;
  api: ApiClient;
  isOwner: boolean;
}

export function HistoryPanel({ projectId, fileId, ytext, api, isOwner }: HistoryPanelProps) {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [label, setLabel] = useState('');
  const [selectedSnapshot, setSelectedSnapshot] = useState<Snapshot | null>(null);
  const [snapshotContent, setSnapshotContent] = useState<string | null>(null);
  const [loadingContent, setLoadingContent] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const mergeRef = useRef<MergeView | null>(null);

  const loadSnapshots = useCallback(async () => {
    if (!fileId) return;
    setLoading(true);
    try {
      const data = await api.snapshots.list(projectId, fileId);
      setSnapshots(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [api, projectId, fileId]);

  useEffect(() => {
    loadSnapshots();
  }, [loadSnapshots]);

  // Build/destroy MergeView when diff data changes
  useEffect(() => {
    if (!containerRef.current || !snapshotContent || !ytext) {
      mergeRef.current?.destroy();
      mergeRef.current = null;
      return;
    }

    mergeRef.current?.destroy();
    mergeRef.current = null;

    const theme = EditorView.theme({
      '&': { fontSize: '12px', height: '100%' },
      '.cm-scroller': { overflow: 'auto', fontFamily: 'var(--font-mono, monospace)' },
    });

    mergeRef.current = new MergeView({
      parent: containerRef.current,
      a: {
        doc: snapshotContent,
        extensions: [oneDark, theme, EditorState.readOnly.of(true)],
      },
      b: {
        doc: ytext.toString(),
        extensions: [oneDark, theme, EditorState.readOnly.of(true)],
      },
      gutter: true,
      highlightChanges: true,
    });

    return () => {
      mergeRef.current?.destroy();
      mergeRef.current = null;
    };
  }, [snapshotContent, ytext]);

  async function handleSaveSnapshot() {
    if (!fileId) return;
    setSaving(true);
    try {
      const snapshot = await api.snapshots.create(projectId, { fileId, label: label || undefined });
      setSnapshots((prev) => [snapshot, ...prev]);
      setLabel('');
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  }

  async function handleViewDiff(snapshot: Snapshot) {
    setSelectedSnapshot(snapshot);
    setSnapshotContent(null);
    setLoadingContent(true);
    try {
      const { content } = await api.snapshots.getContent(projectId, snapshot.id);
      setSnapshotContent(content);
    } catch {
      setSnapshotContent('');
    } finally {
      setLoadingContent(false);
    }
  }

  function handleRestore() {
    if (!ytext || !snapshotContent) return;
    ytext.doc?.transact(() => {
      ytext.delete(0, ytext.length);
      ytext.insert(0, snapshotContent);
    });
    setSelectedSnapshot(null);
    setSnapshotContent(null);
  }

  async function handleDeleteSnapshot(snapshotId: string) {
    try {
      await api.snapshots.remove(projectId, snapshotId);
      setSnapshots((prev) => prev.filter((s) => s.id !== snapshotId));
      if (selectedSnapshot?.id === snapshotId) {
        setSelectedSnapshot(null);
        setSnapshotContent(null);
      }
    } catch {
      // ignore
    }
  }

  if (!fileId) {
    return (
      <div className="h-full flex items-center justify-center text-[#5c6370] text-sm">
        Open a file to view its history.
      </div>
    );
  }

  // Diff view
  if (selectedSnapshot) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center justify-between px-3 py-2 bg-[#21252b] border-b border-[#3e4451]">
          <button
            onClick={() => { setSelectedSnapshot(null); setSnapshotContent(null); }}
            className="flex items-center gap-1 text-xs text-[#7f848e] hover:text-[#abb2bf] transition-colors"
          >
            <ArrowLeft size={13} />
            Back
          </button>
          <span className="text-xs text-[#abb2bf] font-medium">
            {selectedSnapshot.label ?? new Date(selectedSnapshot.createdAt).toLocaleString()}
          </span>
          <button
            onClick={handleRestore}
            disabled={!snapshotContent || !ytext}
            className="flex items-center gap-1 px-2 py-0.5 text-xs rounded bg-orange-700/80 hover:bg-orange-600 text-white disabled:opacity-50 transition-colors"
            title="Restore this snapshot to the editor"
          >
            <Undo2 size={11} />
            Restore
          </button>
        </div>

        {loadingContent ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 size={20} className="animate-spin text-[#5c6370]" />
          </div>
        ) : (
          <div className="flex-1 min-h-0">
            <div className="px-2 py-1 text-xs text-[#5c6370] bg-[#21252b] border-b border-[#3e4451] flex justify-between">
              <span>Snapshot</span>
              <span>Current</span>
            </div>
            <div ref={containerRef} className="h-full" />
          </div>
        )}
      </div>
    );
  }

  // List view
  return (
    <div className="h-full flex flex-col">
      <div className="px-3 py-2 border-b border-[#3e4451] bg-[#21252b]">
        <div className="flex gap-1">
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Snapshot label (optional)"
            className="flex-1 px-2 py-1 text-xs rounded bg-[#282c34] border border-[#3e4451] text-[#abb2bf] placeholder-[#5c6370] focus:outline-none focus:border-blue-500 transition-colors"
          />
          <button
            onClick={handleSaveSnapshot}
            disabled={saving}
            className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-blue-700/80 hover:bg-blue-600 text-white disabled:opacity-50 transition-colors"
            title="Save snapshot of current file"
          >
            {saving ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}
            Save
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-[#5c6370]" /></div>
        ) : snapshots.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-[#5c6370] text-sm">
            <Clock size={32} className="mb-3 opacity-40" />
            <p>No snapshots yet.</p>
            <p className="text-xs mt-1">Save a snapshot to capture the current state.</p>
          </div>
        ) : (
          <div className="divide-y divide-[#3e4451]">
            {snapshots.map((s) => (
              <div key={s.id} className="px-3 py-2 hover:bg-[#2c313a] transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm text-[#abb2bf] font-medium truncate">
                      {s.label ?? 'Untitled snapshot'}
                    </p>
                    <p className="text-xs text-[#5c6370] mt-0.5">
                      {new Date(s.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleViewDiff(s)}
                      className="px-2 py-0.5 text-xs rounded bg-[#2c313a] text-[#7f848e] hover:text-[#abb2bf] transition-colors"
                    >
                      Diff
                    </button>
                    {isOwner && (
                      <button
                        onClick={() => handleDeleteSnapshot(s.id)}
                        className="px-2 py-0.5 text-xs rounded text-[#5c6370] hover:text-red-400 transition-colors"
                      >
                        Del
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
