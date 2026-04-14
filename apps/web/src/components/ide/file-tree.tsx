'use client';

import { FileText, FileCode, ChevronDown, ChevronRight, FolderOpen } from 'lucide-react';
import { useState } from 'react';

interface FileEntry {
  name: string;
  type: 'tex' | 'bib' | 'image' | 'other';
}

interface FileTreeProps {
  files: FileEntry[];
  activeFile: string;
  onFileSelect: (fileName: string) => void;
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

export function FileTree({ files, activeFile, onFileSelect }: FileTreeProps) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="h-full flex flex-col text-sm">
      <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-[#5c6370] border-b border-[#3e4451]">
        Explorer
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
            {files.map((file) => (
              <button
                key={file.name}
                onClick={() => onFileSelect(file.name)}
                className={`flex items-center gap-1.5 w-full px-2 py-1 text-left transition-colors ${
                  activeFile === file.name
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
