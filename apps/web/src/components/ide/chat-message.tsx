'use client';

import { useState } from 'react';
import { User, Bot, ChevronDown, ChevronRight, AlertCircle, Wrench } from 'lucide-react';
import type { ChatMessage, ToolCallEntry, EditProposal } from '@/hooks/use-agent';
import { EditProposalCard } from './edit-proposal-card';

interface ChatMessageViewProps {
  message: ChatMessage;
  onAcceptEdit: (editId: string) => void;
  onRejectEdit: (editId: string) => void;
}

export function ChatMessageView({ message, onAcceptEdit, onRejectEdit }: ChatMessageViewProps) {
  if (message.role === 'user') {
    return <UserMessage content={message.content} />;
  }
  return (
    <AssistantMessage
      content={message.content}
      toolCalls={message.toolCalls}
      editProposals={message.editProposals}
      onAcceptEdit={onAcceptEdit}
      onRejectEdit={onRejectEdit}
    />
  );
}

function UserMessage({ content }: { content: string }) {
  return (
    <div className="flex gap-2 px-3 py-2">
      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600/30 flex items-center justify-center">
        <User size={12} className="text-blue-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-[#abb2bf] whitespace-pre-wrap break-words">{content}</p>
      </div>
    </div>
  );
}

function AssistantMessage({
  content,
  toolCalls,
  editProposals,
  onAcceptEdit,
  onRejectEdit,
}: {
  content: string;
  toolCalls?: ToolCallEntry[];
  editProposals?: EditProposal[];
  onAcceptEdit: (editId: string) => void;
  onRejectEdit: (editId: string) => void;
}) {
  return (
    <div className="flex gap-2 px-3 py-2">
      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-600/30 flex items-center justify-center">
        <Bot size={12} className="text-purple-400" />
      </div>
      <div className="flex-1 min-w-0">
        {content && (
          <div className="text-sm text-[#abb2bf] whitespace-pre-wrap break-words">{content}</div>
        )}

        {toolCalls?.map((tc, i) => (
          <ToolCallCard key={i} toolCall={tc} />
        ))}

        {editProposals?.map((ep) => (
          <EditProposalCard
            key={ep.editId}
            proposal={ep}
            onAccept={onAcceptEdit}
            onReject={onRejectEdit}
          />
        ))}
      </div>
    </div>
  );
}

function ToolCallCard({ toolCall }: { toolCall: ToolCallEntry }) {
  const [expanded, setExpanded] = useState(false);
  const hasResult = toolCall.result !== undefined;
  const isError = toolCall.isError;

  const toolLabel = {
    read_file: 'Read file',
    list_files: 'List files',
    create_file: 'Create file',
    edit_file: 'Edit file',
    search_in_files: 'Search files',
    compile_project: 'Compile',
    search_papers: 'Search papers',
    web_search: 'Web search',
    add_to_bibliography: 'Add to bibliography',
  }[toolCall.tool] ?? toolCall.tool;

  const inputSummary = Object.entries(toolCall.input)
    .map(([k, v]) => {
      const val = typeof v === 'string' ? (v.length > 40 ? `${v.slice(0, 40)}...` : v) : JSON.stringify(v);
      return `${k}: ${val}`;
    })
    .join(', ');

  return (
    <div className="my-1 rounded border border-[#3e4451] bg-[#21252b] text-xs">
      <button
        onClick={() => setExpanded((p) => !p)}
        className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-[#2c313a] transition-colors text-left"
      >
        {isError ? (
          <AlertCircle size={11} className="text-red-400 flex-shrink-0" />
        ) : (
          <Wrench size={11} className="text-[#7f848e] flex-shrink-0" />
        )}
        <span className={`font-medium ${isError ? 'text-red-400' : 'text-[#abb2bf]'}`}>{toolLabel}</span>
        <span className="text-[#5c6370] truncate flex-1">{inputSummary}</span>
        {hasResult && (
          expanded ? <ChevronDown size={11} className="text-[#5c6370] flex-shrink-0" /> : <ChevronRight size={11} className="text-[#5c6370] flex-shrink-0" />
        )}
        {!hasResult && (
          <span className="text-yellow-400 animate-pulse">running...</span>
        )}
      </button>
      {expanded && hasResult && (
        <div className="px-2 py-1.5 border-t border-[#3e4451] max-h-[150px] overflow-auto">
          <pre className={`whitespace-pre-wrap break-words ${isError ? 'text-red-300' : 'text-[#7f848e]'}`}>
            {toolCall.result}
          </pre>
        </div>
      )}
    </div>
  );
}
