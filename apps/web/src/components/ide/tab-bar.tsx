'use client';

import { X, FileCode, FileText } from 'lucide-react';

interface TabBarProps {
  openFiles: string[];
  activeFile: string;
  onTabSelect: (fileName: string) => void;
  onTabClose: (fileName: string) => void;
}

function getTabIcon(fileName: string) {
  if (fileName.endsWith('.tex')) return <FileCode size={14} className="text-green-400" />;
  if (fileName.endsWith('.bib')) return <FileText size={14} className="text-yellow-400" />;
  return <FileText size={14} className="text-gray-400" />;
}

export function TabBar({ openFiles, activeFile, onTabSelect, onTabClose }: TabBarProps) {
  return (
    <div className="flex items-center bg-[#21252b] border-b border-[#3e4451] overflow-x-auto">
      {openFiles.map((file) => (
        <div
          key={file}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-sm cursor-pointer border-r border-[#3e4451] min-w-0 shrink-0 group ${
            activeFile === file
              ? 'bg-[#282c34] text-white border-t-2 border-t-blue-500'
              : 'bg-[#21252b] text-[#7f848e] hover:bg-[#2c313a] border-t-2 border-t-transparent'
          }`}
          onClick={() => onTabSelect(file)}
        >
          {getTabIcon(file)}
          <span className="truncate max-w-[120px]">{file}</span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onTabClose(file);
            }}
            className="ml-1 p-0.5 rounded hover:bg-[#3e4451] opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <X size={12} />
          </button>
        </div>
      ))}
    </div>
  );
}
