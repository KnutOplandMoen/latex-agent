'use client';

import { useRef, useEffect } from 'react';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { MergeView } from '@codemirror/merge';
import { oneDark } from '@codemirror/theme-one-dark';
import { Check, X, FileText } from 'lucide-react';
import type { EditProposal } from '@/hooks/use-agent';

interface EditProposalCardProps {
  proposal: EditProposal;
  onAccept: (editId: string) => void;
  onReject: (editId: string) => void;
}

export function EditProposalCard({ proposal, onAccept, onReject }: EditProposalCardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mergeRef = useRef<MergeView | null>(null);

  useEffect(() => {
    if (!containerRef.current || mergeRef.current) return;

    const theme = EditorView.theme({
      '&': { fontSize: '12px', maxHeight: '200px' },
      '.cm-scroller': { overflow: 'auto', fontFamily: 'var(--font-mono)' },
      '.cm-gutters': { display: 'none' },
    });

    mergeRef.current = new MergeView({
      parent: containerRef.current,
      a: {
        doc: proposal.search,
        extensions: [oneDark, theme, EditorState.readOnly.of(true)],
      },
      b: {
        doc: proposal.replace,
        extensions: [oneDark, theme, EditorState.readOnly.of(true)],
      },
      gutter: true,
      highlightChanges: true,
    });

    return () => {
      mergeRef.current?.destroy();
      mergeRef.current = null;
    };
  }, [proposal.search, proposal.replace]);

  const isPending = proposal.status === 'pending';
  const statusColors = {
    pending: 'border-blue-600/50',
    accepted: 'border-green-600/50',
    rejected: 'border-red-600/50',
  };

  return (
    <div className={`rounded-lg border ${statusColors[proposal.status]} bg-[#1e2127] overflow-hidden my-2`}>
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#21252b]">
        <div className="flex items-center gap-2 text-xs text-[#abb2bf]">
          <FileText size={12} />
          <span className="font-medium">{proposal.file}</span>
          {!isPending && (
            <span className={`text-xs ${proposal.status === 'accepted' ? 'text-green-400' : 'text-red-400'}`}>
              {proposal.status === 'accepted' ? 'Accepted' : 'Rejected'}
            </span>
          )}
        </div>
        {isPending && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => onAccept(proposal.editId)}
              className="flex items-center gap-1 px-2 py-0.5 text-xs rounded bg-green-700/80 hover:bg-green-600 text-white transition-colors"
            >
              <Check size={10} />
              Accept
            </button>
            <button
              onClick={() => onReject(proposal.editId)}
              className="flex items-center gap-1 px-2 py-0.5 text-xs rounded bg-red-700/80 hover:bg-red-600 text-white transition-colors"
            >
              <X size={10} />
              Reject
            </button>
          </div>
        )}
      </div>
      <div ref={containerRef} className="text-sm" />
    </div>
  );
}
