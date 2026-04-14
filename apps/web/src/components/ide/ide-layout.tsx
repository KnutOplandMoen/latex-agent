'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import {
  Panel,
  PanelGroup,
  PanelResizeHandle,
} from 'react-resizable-panels';
import type { File } from '@latex-ide/shared-types';
import { FileTree } from './file-tree';
import { OutlineView } from './outline-view';
import { TabBar } from './tab-bar';
import { PdfPlaceholder } from './pdf-placeholder';
import { CommandPalette } from '@/components/command-palette/command-palette';
import { useApi } from '@/lib/use-api';
import { PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, Loader2, ArrowLeft } from 'lucide-react';

const Editor = dynamic(
  () => import('@/components/editor/editor').then((mod) => mod.Editor),
  {
    ssr: false,
    loading: () => (
      <div className="h-full flex items-center justify-center bg-[#282c34] text-[#5c6370]">
        <Loader2 size={24} className="animate-spin" />
      </div>
    ),
  },
);

interface IdeLayoutProps {
  projectId: string;
  projectName: string;
  initialFiles: File[];
}

const SAVE_DEBOUNCE_MS = 2000;

export function IdeLayout({ projectId, projectName, initialFiles }: IdeLayoutProps) {
  const api = useApi();
  const [files, setFiles] = useState(initialFiles);
  const [activeFileId, setActiveFileId] = useState<string | null>(
    initialFiles.find((f) => f.path === 'main.tex')?.id ?? initialFiles[0]?.id ?? null,
  );
  const [openFileIds, setOpenFileIds] = useState<string[]>(activeFileId ? [activeFileId] : []);
  const [fileContents, setFileContents] = useState<Record<string, string>>({});
  const [loadingFileId, setLoadingFileId] = useState<string | null>(null);
  const [showLeftPanel, setShowLeftPanel] = useState(true);
  const [showRightPanel, setShowRightPanel] = useState(true);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  const editorKeyRef = useRef(0);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSaveRef = useRef<{ fileId: string; content: string } | null>(null);

  const fileById = useCallback(
    (id: string) => files.find((f) => f.id === id),
    [files],
  );

  const activeFile = activeFileId ? fileById(activeFileId) : null;

  const loadFileContent = useCallback(
    async (fileId: string) => {
      if (fileContents[fileId] !== undefined) return;
      setLoadingFileId(fileId);
      try {
        const file = await api.files.get(fileId);
        setFileContents((prev) => ({ ...prev, [fileId]: file.content ?? '' }));
      } catch {
        setFileContents((prev) => ({ ...prev, [fileId]: '' }));
      } finally {
        setLoadingFileId(null);
      }
    },
    [api, fileContents],
  );

  useEffect(() => {
    if (activeFileId && fileContents[activeFileId] === undefined) {
      loadFileContent(activeFileId);
    }
  }, [activeFileId, fileContents, loadFileContent]);

  const flushSave = useCallback(async () => {
    const pending = pendingSaveRef.current;
    if (!pending) return;
    pendingSaveRef.current = null;
    setSaveStatus('saving');
    try {
      await api.files.update(pending.fileId, pending.content);
      setSaveStatus('saved');
    } catch {
      setSaveStatus('unsaved');
    }
  }, [api]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      // Flush on unmount
      if (pendingSaveRef.current) {
        const { fileId, content } = pendingSaveRef.current;
        api.files.update(fileId, content).catch(() => {});
      }
    };
  }, [api]);

  const handleFileSelect = useCallback(
    (fileId: string) => {
      if (!openFileIds.includes(fileId)) {
        setOpenFileIds((prev) => [...prev, fileId]);
      }
      setActiveFileId(fileId);
      editorKeyRef.current += 1;
    },
    [openFileIds],
  );

  const handleTabClose = useCallback(
    (fileId: string) => {
      setOpenFileIds((prev) => {
        const next = prev.filter((f) => f !== fileId);
        if (next.length === 0) return prev;
        if (activeFileId === fileId) {
          const idx = prev.indexOf(fileId);
          setActiveFileId(next[Math.min(idx, next.length - 1)]!);
          editorKeyRef.current += 1;
        }
        return next;
      });
    },
    [activeFileId],
  );

  const handleDocChange = useCallback(
    (doc: string) => {
      if (!activeFileId) return;
      setFileContents((prev) => ({ ...prev, [activeFileId]: doc }));
      setSaveStatus('unsaved');
      pendingSaveRef.current = { fileId: activeFileId, content: doc };

      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(flushSave, SAVE_DEBOUNCE_MS);
    },
    [activeFileId, flushSave],
  );

  const handleCreateFile = useCallback(
    async (path: string) => {
      const ext = path.split('.').pop()?.toLowerCase();
      const type = ext === 'tex' ? 'tex' : ext === 'bib' ? 'bib' : 'other';
      const file = await api.files.create(projectId, { path, type: type as 'tex' | 'bib' | 'other' });
      setFiles((prev) => [...prev, { id: file.id, projectId: file.projectId, path: file.path, type: file.type, createdAt: file.createdAt, updatedAt: file.updatedAt }]);
      setFileContents((prev) => ({ ...prev, [file.id]: file.content ?? '' }));
      handleFileSelect(file.id);
    },
    [api, projectId, handleFileSelect],
  );

  const currentContent = activeFileId ? (fileContents[activeFileId] ?? '') : '';
  const isLoadingContent = activeFileId === loadingFileId;

  const fileEntries = files.map((f) => ({ id: f.id, name: f.path, type: f.type as 'tex' | 'bib' | 'image' | 'other' }));

  return (
    <div className="h-screen w-screen flex flex-col bg-[#282c34]">
      {/* Top bar */}
      <div className="flex items-center justify-between px-3 py-1 bg-[#21252b] border-b border-[#3e4451] text-sm">
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard"
            className="p-1 rounded hover:bg-[#2c313a] text-[#7f848e] hover:text-[#abb2bf] transition-colors"
            title="Back to dashboard"
          >
            <ArrowLeft size={16} />
          </Link>
          <button
            onClick={() => setShowLeftPanel((p) => !p)}
            className="p-1 rounded hover:bg-[#2c313a] text-[#7f848e] hover:text-[#abb2bf] transition-colors"
            title={showLeftPanel ? 'Hide sidebar' : 'Show sidebar'}
          >
            {showLeftPanel ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}
          </button>
          <span className="text-[#abb2bf] font-medium">{projectName}</span>
        </div>

        <div className="flex items-center gap-2">
          <span className={`text-xs ${saveStatus === 'saved' ? 'text-[#5c6370]' : saveStatus === 'saving' ? 'text-yellow-400' : 'text-orange-400'}`}>
            {saveStatus === 'saved' ? 'Saved' : saveStatus === 'saving' ? 'Saving...' : 'Unsaved'}
          </span>
          <button
            onClick={() => setCommandPaletteOpen(true)}
            className="px-2 py-0.5 text-xs rounded bg-[#2c313a] text-[#7f848e] hover:text-[#abb2bf] transition-colors"
          >
            Ctrl+K
          </button>
          <button
            onClick={() => setShowRightPanel((p) => !p)}
            className="p-1 rounded hover:bg-[#2c313a] text-[#7f848e] hover:text-[#abb2bf] transition-colors"
            title={showRightPanel ? 'Hide PDF preview' : 'Show PDF preview'}
          >
            {showRightPanel ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 min-h-0">
        <PanelGroup direction="horizontal" autoSaveId="ide-layout">
          {/* Left sidebar: file tree + outline */}
          {showLeftPanel && (
            <>
              <Panel defaultSize={18} minSize={12} maxSize={30} id="left-sidebar">
                <div className="h-full flex flex-col bg-[#21252b] border-r border-[#3e4451]">
                  <div className="flex-1 min-h-0 overflow-hidden">
                    <FileTree
                      files={fileEntries}
                      activeFileId={activeFileId}
                      onFileSelect={handleFileSelect}
                      onCreateFile={handleCreateFile}
                    />
                  </div>
                  <div className="border-t border-[#3e4451] h-[40%] min-h-[120px] overflow-hidden">
                    <OutlineView content={currentContent} />
                  </div>
                </div>
              </Panel>
              <PanelResizeHandle className="w-[3px] bg-[#3e4451] hover:bg-blue-500 transition-colors" />
            </>
          )}

          {/* Center: editor */}
          <Panel defaultSize={showRightPanel ? 52 : 70} minSize={30} id="editor-panel">
            <div className="h-full flex flex-col">
              <TabBar
                openFiles={openFileIds.map((id) => fileById(id)?.path ?? id)}
                activeFile={activeFile?.path ?? ''}
                onTabSelect={(path) => {
                  const f = files.find((file) => file.path === path);
                  if (f) {
                    setActiveFileId(f.id);
                    editorKeyRef.current += 1;
                  }
                }}
                onTabClose={(path) => {
                  const f = files.find((file) => file.path === path);
                  if (f) handleTabClose(f.id);
                }}
              />
              <div className="flex-1 min-h-0">
                {isLoadingContent ? (
                  <div className="h-full flex items-center justify-center bg-[#282c34] text-[#5c6370]">
                    <Loader2 size={24} className="animate-spin" />
                  </div>
                ) : (
                  <Editor
                    key={`${activeFileId}-${editorKeyRef.current}`}
                    initialDoc={currentContent}
                    onDocChange={handleDocChange}
                  />
                )}
              </div>
            </div>
          </Panel>

          {/* Right: PDF preview */}
          {showRightPanel && (
            <>
              <PanelResizeHandle className="w-[3px] bg-[#3e4451] hover:bg-blue-500 transition-colors" />
              <Panel defaultSize={30} minSize={15} maxSize={50} id="pdf-panel">
                <PdfPlaceholder />
              </Panel>
            </>
          )}
        </PanelGroup>
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between px-3 py-0.5 bg-[#21252b] border-t border-[#3e4451] text-xs text-[#5c6370]">
        <div className="flex items-center gap-3">
          <span>{activeFile?.path ?? 'No file open'}</span>
          <span>LaTeX</span>
        </div>
        <div className="flex items-center gap-3">
          <span>UTF-8</span>
          <span>LF</span>
        </div>
      </div>

      {/* Command palette */}
      <CommandPalette
        open={commandPaletteOpen}
        onOpenChange={setCommandPaletteOpen}
        files={fileEntries.map((f) => f.name)}
        onFileSelect={(path) => {
          const f = files.find((file) => file.path === path);
          if (f) handleFileSelect(f.id);
        }}
        onToggleLeftPanel={() => setShowLeftPanel((p) => !p)}
        onToggleRightPanel={() => setShowRightPanel((p) => !p)}
      />
    </div>
  );
}
