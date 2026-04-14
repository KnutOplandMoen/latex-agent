'use client';

import { FileText, FileCode, ChevronDown, ChevronRight, FolderOpen, FilePlus } from 'lucide-react';
import { useState } from 'react';

interface FileEntry {
  id: string;
  name: string;
  type: 'tex' | 'bib' | 'image' | 'other';
}

interface FileTreeProps {
  files: FileEntry[];
  activeFileId: string | null;
  onFileSelect: (fileId: string) => void;
  onCreateFile?: (path: string) => void;
}

function getFileIcon(type: FileEntry['type']) {
  switch (type) {
    case 'tex':
      return <FileCode size={16} className="text-green-400 shrink-0" />;
    case 'bib':
      return <FileText size={16} className="text-yellow-400 shrink-0" />;
    default:
      return <FileText size={16} className="text-gray-400 shrink-0" />;
  }
}

export function FileTree({ files, activeFileId, onFileSelect, onCreateFile }: FileTreeProps) {
  const [expanded, setExpanded] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newFileName, setNewFileName] = useState('');

  function handleCreateSubmit() {
    const trimmed = newFileName.trim();
    if (trimmed && onCreateFile) {
      onCreateFile(trimmed);
    }
    setNewFileName('');
    setCreating(false);
  }

  return (
    <div className="h-full flex flex-col text-sm">
      <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-[#5c6370] border-b border-[#3e4451] flex items-center justify-between">
        <span>Explorer</span>
        {onCreateFile && (
          <button
            onClick={() => setCreating(true)}
            className="p-0.5 rounded hover:bg-[#2c313a] text-[#5c6370] hover:text-[#abb2bf] transition-colors"
            title="New file"
          >
            <FilePlus size={14} />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto py-1">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1.5 w-full px-2 py-1 hover:bg-[#2c313a] text-left"
        >
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          <FolderOpen size={14} className="text-blue-400" />
          <span className="font-medium text-[#abb2bf]">project</span>
        </button>

        {expanded && (
          <div className="ml-4">
            {creating && (
              <div className="px-2 py-1">
                <input
                  type="text"
                  value={newFileName}
                  onChange={(e) => setNewFileName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreateSubmit();
                    if (e.key === 'Escape') { setCreating(false); setNewFileName(''); }
                  }}
                  onBlur={handleCreateSubmit}
                  autoFocus
                  placeholder="filename.tex"
                  className="w-full px-1.5 py-0.5 text-xs bg-[#282c34] border border-blue-500 rounded text-[#abb2bf] placeholder-[#5c6370] outline-none"
                />
              </div>
            )}
            {files.map((file) => (
              <button
                key={file.id}
                onClick={() => onFileSelect(file.id)}
                className={`flex items-center gap-1.5 w-full px-2 py-1 text-left transition-colors ${
                  activeFileId === file.id
                    ? 'bg-[#2c313a] text-white'
                    : 'text-[#abb2bf] hover:bg-[#2c313a]'
                }`}
              >
                {getFileIcon(file.type)}
                <span className="truncate">{file.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
