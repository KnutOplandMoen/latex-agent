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
import type { EditorHandle } from '@/components/editor/editor';
import { FileTree } from './file-tree';
import { OutlineView } from './outline-view';
import { TabBar } from './tab-bar';
import { PdfViewer, type PdfViewerHandle } from './pdf-viewer';
import { CompileLogPanel } from './compile-log-panel';
import { PresenceIndicator } from './presence-indicator';
import { CommandPalette } from '@/components/command-palette/command-palette';
import { useApi } from '@/lib/use-api';
import { useCollabEditor } from '@/hooks/use-collab-editor';
import { useCompile } from '@/hooks/use-compile';
import { PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, Loader2, ArrowLeft, AlertTriangle, Play } from 'lucide-react';

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

export function IdeLayout({ projectId, projectName, initialFiles }: IdeLayoutProps) {
  const api = useApi();
  const editorRef = useRef<EditorHandle | null>(null);
  const pdfViewerRef = useRef<PdfViewerHandle | null>(null);
  const [files, setFiles] = useState(initialFiles);
  const [activeFileId, setActiveFileId] = useState<string | null>(
    initialFiles.find((f) => f.path === 'main.tex')?.id ?? initialFiles[0]?.id ?? null,
  );
  const [openFileIds, setOpenFileIds] = useState<string[]>(activeFileId ? [activeFileId] : []);
  const [showLeftPanel, setShowLeftPanel] = useState(true);
  const [showRightPanel, setShowRightPanel] = useState(true);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [errorToast, setErrorToast] = useState<string | null>(null);
  const [outlineContent, setOutlineContent] = useState('');
  const [showCompileLog, setShowCompileLog] = useState(false);
  const editorKeyRef = useRef(0);

  const { ytext, provider, isConnected, isSynced, connectedUsers } =
    useCollabEditor(projectId, activeFileId);

  const { compile, phase, pdfUrl, errors: compileErrors, warnings: compileWarnings, log: compileLog, synctex, isCompiling } =
    useCompile(projectId, api);

  // Observe ytext to feed the outline view
  useEffect(() => {
    if (!ytext) {
      setOutlineContent('');
      return;
    }

    const update = () => setOutlineContent(ytext.toString());
    update();
    ytext.observe(update);
    return () => ytext.unobserve(update);
  }, [ytext]);

  const showError = useCallback((message: string) => {
    setErrorToast(message);
    setTimeout(() => setErrorToast(null), 5000);
  }, []);

  const fileById = useCallback(
    (id: string) => files.find((f) => f.id === id),
    [files],
  );

  const activeFile = activeFileId ? fileById(activeFileId) : null;

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

  const handleCreateFile = useCallback(
    async (path: string) => {
      try {
        const ext = path.split('.').pop()?.toLowerCase();
        const type = ext === 'tex' ? 'tex' : ext === 'bib' ? 'bib' : 'other';
        const file = await api.files.create(projectId, { path, type: type as 'tex' | 'bib' | 'other' });
        setFiles((prev) => [...prev, { id: file.id, projectId: file.projectId, path: file.path, type: file.type, createdAt: file.createdAt, updatedAt: file.updatedAt }]);
        handleFileSelect(file.id);
      } catch {
        showError('Failed to create file.');
      }
    },
    [api, projectId, handleFileSelect, showError],
  );

  const handleDeleteFile = useCallback(
    async (fileId: string) => {
      try {
        await api.files.remove(fileId);
        setFiles((prev) => prev.filter((f) => f.id !== fileId));
        setOpenFileIds((prev) => {
          const next = prev.filter((f) => f !== fileId);
          if (activeFileId === fileId) {
            const newActive = next[0] ?? null;
            setActiveFileId(newActive);
            editorKeyRef.current += 1;
          }
          return next;
        });
      } catch {
        showError('Failed to delete file.');
      }
    },
    [api, activeFileId, showError],
  );

  const handleInsertText = useCallback((text: string) => {
    editorRef.current?.insertText(text);
  }, []);

  const handleOutlineNavigate = useCallback((line: number) => {
    editorRef.current?.scrollToLine(line);
  }, []);

  const handleSynctexClick = useCallback(
    (file: string, line: number) => {
      const targetFile = files.find((f) => f.path === file);
      if (targetFile) {
        handleFileSelect(targetFile.id);
        setTimeout(() => editorRef.current?.scrollToLine(line), 100);
      }
    },
    [files, handleFileSelect],
  );

  // Ctrl+Enter / Cmd+Enter to compile
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
        e.preventDefault();
        compile();
      }
      // Ctrl+Shift+Enter: forward SyncTeX (source -> PDF)
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && e.shiftKey) {
        e.preventDefault();
        const line = editorRef.current?.getCursorLine();
        if (line != null && activeFile && pdfViewerRef.current) {
          pdfViewerRef.current.scrollToSourceLine(activeFile.path, line);
        }
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [compile, activeFile]);

  // Auto-show log panel when compile has errors
  useEffect(() => {
    if (compileErrors.length > 0) setShowCompileLog(true);
  }, [compileErrors]);

  // Push compile errors as editor diagnostics for the active file
  useEffect(() => {
    if (!editorRef.current || !activeFile) return;
    const fileErrors = compileErrors.filter(
      (e) => e.file === activeFile.path && e.line != null,
    );
    const fileWarnings = compileWarnings.filter(
      (w) => w.file === activeFile.path && w.line != null,
    );
    editorRef.current.setExternalDiagnostics([
      ...fileErrors.map((e) => ({ line: e.line!, message: e.message, severity: 'error' as const })),
      ...fileWarnings.map((w) => ({ line: w.line!, message: w.message, severity: 'warning' as const })),
    ]);
  }, [compileErrors, compileWarnings, activeFile]);

  const syncStatusLabel = !activeFileId
    ? ''
    : !isConnected
      ? 'Offline'
      : !isSynced
        ? 'Syncing...'
        : 'Synced';

  const syncStatusClass = !activeFileId
    ? 'text-[#5c6370]'
    : !isConnected
      ? 'text-red-400'
      : !isSynced
        ? 'text-yellow-400'
        : 'text-[#5c6370]';

  const fileEntries = files.map((f) => ({ id: f.id, name: f.path, type: f.type as 'tex' | 'bib' | 'image' | 'other' }));

  const showEditor = activeFileId && ytext && provider;

  return (
    <div className="ide-root h-screen w-screen flex flex-col bg-[#282c34]">
      {/* Error toast */}
      {errorToast && (
        <div className="absolute top-12 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg bg-red-900/90 border border-red-700 text-red-200 text-sm flex items-center gap-2 shadow-lg">
          <AlertTriangle size={14} />
          {errorToast}
        </div>
      )}

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
          <PresenceIndicator users={connectedUsers} />
          <span className={`text-xs ${syncStatusClass}`}>
            {syncStatusLabel}
          </span>
          <button
            onClick={compile}
            disabled={isCompiling}
            className="flex items-center gap-1 px-2 py-0.5 text-xs rounded bg-green-700 hover:bg-green-600 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Compile (Ctrl+Enter)"
          >
            {isCompiling ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
            {isCompiling ? 'Compiling...' : 'Compile'}
          </button>
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

      {/* Offline banner */}
      {activeFileId && !isConnected && (
        <div className="px-3 py-1 bg-red-900/60 border-b border-red-700 text-red-200 text-xs text-center">
          Offline — changes will sync when reconnected
        </div>
      )}

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
                      onDeleteFile={handleDeleteFile}
                    />
                  </div>
                  <div className="border-t border-[#3e4451] h-[40%] min-h-[120px] overflow-hidden">
                    <OutlineView content={outlineContent} onNavigate={handleOutlineNavigate} />
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
                {showEditor ? (
                  <Editor
                    ref={editorRef}
                    key={`${activeFileId}-${editorKeyRef.current}`}
                    mode="collab"
                    ytext={ytext}
                    awareness={provider.awareness!}
                  />
                ) : activeFileId ? (
                  <div className="h-full flex items-center justify-center bg-[#282c34] text-[#5c6370]">
                    <Loader2 size={24} className="animate-spin" />
                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center bg-[#282c34] text-[#5c6370]">
                    <span>No file open</span>
                  </div>
                )}
              </div>
            </div>
          </Panel>

          {/* Right: PDF preview + compile log */}
          {showRightPanel && (
            <>
              <PanelResizeHandle className="w-[3px] bg-[#3e4451] hover:bg-blue-500 transition-colors" />
              <Panel defaultSize={30} minSize={15} maxSize={50} id="pdf-panel">
                <div className="h-full flex flex-col">
                  <div className={showCompileLog ? 'flex-1 min-h-0' : 'h-full'}>
                    <PdfViewer
                      ref={pdfViewerRef}
                      pdfUrl={pdfUrl}
                      synctexData={synctex}
                      onSynctexClick={handleSynctexClick}
                    />
                  </div>
                  {showCompileLog && (
                    <CompileLogPanel
                      errors={compileErrors}
                      warnings={compileWarnings}
                      log={compileLog}
                      onClose={() => setShowCompileLog(false)}
                      onErrorClick={handleSynctexClick}
                    />
                  )}
                </div>
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
          {phase !== 'idle' && (
            <button
              onClick={() => setShowCompileLog((p) => !p)}
              className={`cursor-pointer hover:underline ${
                phase === 'compiling' ? 'text-yellow-400' :
                phase === 'completed' ? 'text-green-400' :
                'text-red-400'
              }`}
            >
              {phase === 'compiling' ? 'Compiling...' :
               phase === 'completed' ? 'Compiled' :
               `${compileErrors.length} error${compileErrors.length !== 1 ? 's' : ''}`}
            </button>
          )}
        </div>
        <div className="flex items-center gap-3">
          {connectedUsers.length > 0 && (
            <span>{connectedUsers.length + 1} online</span>
          )}
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
        onInsertText={handleInsertText}
        onCompile={compile}
      />
    </div>
  );
}
