'use client';

import { useState, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import {
  Panel,
  PanelGroup,
  PanelResizeHandle,
} from 'react-resizable-panels';
import { FileTree } from './file-tree';
import { OutlineView } from './outline-view';
import { TabBar } from './tab-bar';
import { PdfPlaceholder } from './pdf-placeholder';
import { CommandPalette } from '@/components/command-palette/command-palette';
import { SAMPLE_FILES } from '@/lib/sample-doc';
import { PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, Loader2 } from 'lucide-react';

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

const FILE_ENTRIES = Object.entries(SAMPLE_FILES).map(([name, info]) => ({
  name,
  type: info.type,
}));

export function IdeLayout() {
  const [activeFile, setActiveFile] = useState('main.tex');
  const [openFiles, setOpenFiles] = useState(['main.tex']);
  const [fileContents, setFileContents] = useState<Record<string, string>>(
    Object.fromEntries(Object.entries(SAMPLE_FILES).map(([k, v]) => [k, v.content])),
  );
  const [showLeftPanel, setShowLeftPanel] = useState(true);
  const [showRightPanel, setShowRightPanel] = useState(true);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const editorKeyRef = useRef(0);

  const handleFileSelect = useCallback(
    (fileName: string) => {
      if (!openFiles.includes(fileName)) {
        setOpenFiles((prev) => [...prev, fileName]);
      }
      setActiveFile(fileName);
      editorKeyRef.current += 1;
    },
    [openFiles],
  );

  const handleTabClose = useCallback(
    (fileName: string) => {
      setOpenFiles((prev) => {
        const next = prev.filter((f) => f !== fileName);
        if (next.length === 0) return prev;
        if (activeFile === fileName) {
          const idx = prev.indexOf(fileName);
          setActiveFile(next[Math.min(idx, next.length - 1)]!);
          editorKeyRef.current += 1;
        }
        return next;
      });
    },
    [activeFile],
  );

  const handleDocChange = useCallback(
    (doc: string) => {
      setFileContents((prev) => ({ ...prev, [activeFile]: doc }));
    },
    [activeFile],
  );

  const currentContent = fileContents[activeFile] ?? '';

  return (
    <div className="h-screen w-screen flex flex-col bg-[#282c34]">
      {/* Top bar */}
      <div className="flex items-center justify-between px-3 py-1 bg-[#21252b] border-b border-[#3e4451] text-sm">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowLeftPanel((p) => !p)}
            className="p-1 rounded hover:bg-[#2c313a] text-[#7f848e] hover:text-[#abb2bf] transition-colors"
            title={showLeftPanel ? 'Hide sidebar' : 'Show sidebar'}
          >
            {showLeftPanel ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}
          </button>
          <span className="text-[#abb2bf] font-medium">LaTeX IDE</span>
        </div>

        <div className="flex items-center gap-2">
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
                      files={FILE_ENTRIES}
                      activeFile={activeFile}
                      onFileSelect={handleFileSelect}
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
                openFiles={openFiles}
                activeFile={activeFile}
                onTabSelect={(f) => {
                  setActiveFile(f);
                  editorKeyRef.current += 1;
                }}
                onTabClose={handleTabClose}
              />
              <div className="flex-1 min-h-0">
                <Editor
                  key={`${activeFile}-${editorKeyRef.current}`}
                  initialDoc={currentContent}
                  onDocChange={handleDocChange}
                />
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
          <span>{activeFile}</span>
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
        files={FILE_ENTRIES.map((f) => f.name)}
        onFileSelect={handleFileSelect}
        onToggleLeftPanel={() => setShowLeftPanel((p) => !p)}
        onToggleRightPanel={() => setShowRightPanel((p) => !p)}
      />
    </div>
  );
}
