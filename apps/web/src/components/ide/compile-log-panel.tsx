'use client';

import { useState } from 'react';
import { X, AlertCircle, AlertTriangle, FileText } from 'lucide-react';
import type { CompileError } from '@latex-ide/shared-types';

interface CompileLogPanelProps {
  errors: CompileError[];
  warnings: CompileError[];
  log: string | null;
  onClose: () => void;
  onErrorClick: (file: string, line: number) => void;
}

type Tab = 'issues' | 'log';

export function CompileLogPanel({ errors, warnings, log, onClose, onErrorClick }: CompileLogPanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>('issues');

  return (
    <div className="h-[200px] min-h-[120px] border-t border-[#3e4451] bg-[#21252b] flex flex-col">
      {/* Tab bar */}
      <div className="flex items-center justify-between px-2 py-1 border-b border-[#3e4451] text-xs">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveTab('issues')}
            className={`px-2 py-0.5 rounded transition-colors ${
              activeTab === 'issues' ? 'bg-[#2c313a] text-[#abb2bf]' : 'text-[#5c6370] hover:text-[#abb2bf]'
            }`}
          >
            Issues
            {errors.length > 0 && (
              <span className="ml-1 px-1 rounded bg-red-900 text-red-300">{errors.length}</span>
            )}
            {warnings.length > 0 && (
              <span className="ml-1 px-1 rounded bg-yellow-900 text-yellow-300">{warnings.length}</span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('log')}
            className={`px-2 py-0.5 rounded transition-colors flex items-center gap-1 ${
              activeTab === 'log' ? 'bg-[#2c313a] text-[#abb2bf]' : 'text-[#5c6370] hover:text-[#abb2bf]'
            }`}
          >
            <FileText size={12} />
            Log
          </button>
        </div>
        <button
          onClick={onClose}
          className="p-0.5 rounded hover:bg-[#2c313a] text-[#5c6370] hover:text-[#abb2bf] transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {activeTab === 'issues' ? (
          <div className="p-1">
            {errors.length === 0 && warnings.length === 0 && (
              <p className="text-[#5c6370] text-xs px-2 py-4 text-center">No issues</p>
            )}
            {errors.map((err, i) => (
              <button
                key={`e-${i}`}
                onClick={() => err.line != null && onErrorClick(err.file, err.line)}
                className="flex items-start gap-2 px-2 py-1 w-full text-left rounded hover:bg-[#2c313a] transition-colors"
              >
                <AlertCircle size={14} className="text-red-400 shrink-0 mt-0.5" />
                <div className="text-xs min-w-0">
                  <span className="text-red-400">{err.file}{err.line != null ? `:${err.line}` : ''}</span>
                  <span className="text-[#abb2bf] ml-2">{err.message}</span>
                </div>
              </button>
            ))}
            {warnings.map((warn, i) => (
              <button
                key={`w-${i}`}
                onClick={() => warn.line != null && onErrorClick(warn.file, warn.line)}
                className="flex items-start gap-2 px-2 py-1 w-full text-left rounded hover:bg-[#2c313a] transition-colors"
              >
                <AlertTriangle size={14} className="text-yellow-400 shrink-0 mt-0.5" />
                <div className="text-xs min-w-0">
                  <span className="text-yellow-400">{warn.file}{warn.line != null ? `:${warn.line}` : ''}</span>
                  <span className="text-[#abb2bf] ml-2">{warn.message}</span>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <pre className="p-2 text-[10px] leading-relaxed text-[#abb2bf] font-mono whitespace-pre-wrap">
            {log ?? 'No log output available.'}
          </pre>
        )}
      </div>
    </div>
  );
}
