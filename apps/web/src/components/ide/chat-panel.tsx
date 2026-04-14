'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Send, Trash2, Loader2, Bot, Bug } from 'lucide-react';
import { useAgent, type AgentMode, type EditProposal } from '@/hooks/use-agent';
import { ChatMessageView } from './chat-message';
import { useApi } from '@/lib/use-api';

interface ChatPanelProps {
  projectId: string;
  getToken: () => Promise<string | null>;
  openFile?: string | null;
  compileErrors?: Array<{ file: string; line: number | null; message: string; level: string }>;
  onAcceptEdit: (proposal: EditProposal) => void;
  onRejectEdit: (editId: string) => void;
  onFileCreated?: (path: string) => void;
}

export function ChatPanel({
  projectId,
  getToken,
  openFile,
  compileErrors,
  onAcceptEdit,
  onRejectEdit,
  onFileCreated,
}: ChatPanelProps) {
  const api = useApi();
  const [mode, setMode] = useState<AgentMode>('general');
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const persistOpts = useMemo(
    () => ({
      loadPersisted: async () => {
        const { session } = await api.agentSession.get(projectId);
        if (!session?.messages.length) return null;
        return { sessionId: session.id, messages: session.messages };
      },
      savePersisted: async (payload: {
        sessionId: string | null;
        mode: AgentMode;
        messages: { role: 'user' | 'assistant'; content: string }[];
      }) => {
        const saved = await api.agentSession.put(projectId, {
          sessionId: payload.sessionId,
          mode: payload.mode,
          messages: payload.messages,
        });
        return saved.id;
      },
    }),
    [api, projectId],
  );

  const {
    messages,
    status,
    currentTool,
    sendMessage,
    acceptEdit,
    rejectEdit,
    clearMessages,
  } = useAgent(projectId, mode, getToken, {
    openFile,
    compileErrors,
    onFileCreated,
    ...persistOpts,
  });

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, status]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text) return;
    setInput('');
    await sendMessage(text);
  }, [input, sendMessage]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const handleAcceptEdit = useCallback(
    (editId: string) => {
      acceptEdit(editId);
      // Find the proposal to pass full data to parent
      for (const msg of messages) {
        const prop = msg.editProposals?.find((p) => p.editId === editId);
        if (prop) {
          onAcceptEdit(prop);
          break;
        }
      }
    },
    [acceptEdit, messages, onAcceptEdit],
  );

  const handleRejectEdit = useCallback(
    (editId: string) => {
      rejectEdit(editId);
      onRejectEdit(editId);
    },
    [rejectEdit, onRejectEdit],
  );

  const isActive = status === 'thinking' || status === 'tool_call';

  const statusLabel = (() => {
    if (status === 'thinking') return 'Thinking...';
    if (status === 'tool_call' && currentTool) {
      const labels: Record<string, string> = {
        read_file: 'Reading file...',
        list_files: 'Listing files...',
        edit_file: 'Editing file...',
        create_file: 'Creating file...',
        search_in_files: 'Searching files...',
        compile_project: 'Compiling...',
        search_papers: 'Searching papers...',
        web_search: 'Searching web...',
        add_to_bibliography: 'Updating bibliography...',
      };
      return labels[currentTool] ?? `Running ${currentTool}...`;
    }
    return null;
  })();

  return (
    <div className="h-full flex flex-col bg-[#282c34]">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#21252b] border-b border-[#3e4451]">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-[#abb2bf]">AI Assistant</span>
          <div className="flex items-center gap-0.5 bg-[#2c313a] rounded p-0.5">
            <button
              onClick={() => setMode('general')}
              className={`flex items-center gap-1 px-2 py-0.5 text-xs rounded transition-colors ${
                mode === 'general'
                  ? 'bg-purple-600/40 text-purple-300'
                  : 'text-[#5c6370] hover:text-[#abb2bf]'
              }`}
            >
              <Bot size={11} />
              General
            </button>
            <button
              onClick={() => setMode('debug')}
              className={`flex items-center gap-1 px-2 py-0.5 text-xs rounded transition-colors ${
                mode === 'debug'
                  ? 'bg-orange-600/40 text-orange-300'
                  : 'text-[#5c6370] hover:text-[#abb2bf]'
              }`}
            >
              <Bug size={11} />
              Debug
            </button>
          </div>
        </div>
        <button
          onClick={clearMessages}
          className="p-1 rounded hover:bg-[#2c313a] text-[#5c6370] hover:text-[#abb2bf] transition-colors"
          title="Clear chat"
        >
          <Trash2 size={13} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-[#5c6370] text-sm px-6 text-center">
            <div>
              <Bot size={32} className="mx-auto mb-3 opacity-50" />
              <p className="font-medium mb-1">AI Assistant</p>
              <p className="text-xs">
                Ask me to write LaTeX, find papers, fix compile errors, or anything else.
              </p>
            </div>
          </div>
        ) : (
          <div className="py-2">
            {messages.map((msg) => (
              <ChatMessageView
                key={msg.id}
                message={msg}
                onAcceptEdit={handleAcceptEdit}
                onRejectEdit={handleRejectEdit}
              />
            ))}
            {/* Status indicator */}
            {isActive && statusLabel && (
              <div className="flex items-center gap-2 px-3 py-2 text-xs text-[#7f848e]">
                <Loader2 size={12} className="animate-spin" />
                <span>{statusLabel}</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-[#3e4451] p-2">
        <div className="flex items-end gap-2 bg-[#21252b] rounded-lg border border-[#3e4451] focus-within:border-blue-500/50 transition-colors">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isActive ? 'Agent is working...' : 'Ask the AI assistant... (Enter to send)'}
            disabled={isActive}
            rows={1}
            className="flex-1 bg-transparent text-sm text-[#abb2bf] placeholder:text-[#5c6370] px-3 py-2 resize-none outline-none disabled:opacity-50 max-h-[120px]"
            style={{ minHeight: '36px' }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = 'auto';
              target.style.height = `${Math.min(target.scrollHeight, 120)}px`;
            }}
          />
          <button
            onClick={handleSend}
            disabled={isActive || !input.trim()}
            className="p-2 text-[#5c6370] hover:text-[#abb2bf] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Send message"
          >
            <Send size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
