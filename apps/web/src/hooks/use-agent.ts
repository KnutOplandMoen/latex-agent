'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

const AGENT_URL = process.env.NEXT_PUBLIC_AGENT_URL ?? 'http://localhost:3002';

// --- Types matching the Python agent's SSE events ---

export type AgentMode = 'general' | 'debug';

export interface AgentPersistMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface EditProposal {
  editId: string;
  file: string;
  search: string;
  replace: string;
  status: 'pending' | 'accepted' | 'rejected';
}

interface TextDeltaEvent {
  type: 'text_delta';
  text: string;
}

interface ToolStartEvent {
  type: 'tool_start';
  tool: string;
  input: Record<string, unknown>;
}

interface ToolResultEvent {
  type: 'tool_result';
  tool: string;
  result: string;
  is_error?: boolean;
}

interface EditProposedEvent {
  type: 'edit_proposed';
  edit_id: string;
  file: string;
  search: string;
  replace: string;
}

interface FileCreatedEvent {
  type: 'file_created';
  file: string;
}

interface DoneEvent {
  type: 'done';
}

interface ErrorEvent {
  type: 'error';
  message: string;
}

type AgentEvent =
  | TextDeltaEvent
  | ToolStartEvent
  | ToolResultEvent
  | EditProposedEvent
  | FileCreatedEvent
  | DoneEvent
  | ErrorEvent;

export type AgentStatus = 'idle' | 'thinking' | 'tool_call' | 'done' | 'error';

export interface ToolCallEntry {
  tool: string;
  input: Record<string, unknown>;
  result?: string;
  isError?: boolean;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: ToolCallEntry[];
  editProposals?: EditProposal[];
}

export interface UseAgentReturn {
  messages: ChatMessage[];
  status: AgentStatus;
  currentTool: string | null;
  editProposals: EditProposal[];
  sendMessage: (text: string) => Promise<void>;
  acceptEdit: (editId: string) => void;
  rejectEdit: (editId: string) => void;
  clearMessages: () => void;
}

let msgCounter = 0;
function nextId(): string {
  return `msg-${++msgCounter}-${Date.now()}`;
}

async function persistAfterTurn(
  msgs: ChatMessage[],
  currentMode: AgentMode,
  save: (payload: {
    sessionId: string | null;
    mode: AgentMode;
    messages: AgentPersistMessage[];
  }) => Promise<string>,
  sessionRef: { current: string | null },
): Promise<void> {
  const strip: AgentPersistMessage[] = msgs.map(({ role, content }) => ({ role, content }));
  try {
    const id = await save({
      sessionId: sessionRef.current,
      mode: currentMode,
      messages: strip,
    });
    sessionRef.current = id;
  } catch {
    /* ignore */
  }
}

export function useAgent(
  projectId: string,
  mode: AgentMode,
  getToken: () => Promise<string | null>,
  options?: {
    openFile?: string | null;
    compileErrors?: Array<{ file: string; line: number | null; message: string; level: string }>;
    onFileCreated?: (path: string) => void;
    /** Load persisted chat from the API (GET agent-session). */
    loadPersisted?: () => Promise<{
      sessionId: string;
      messages: AgentPersistMessage[];
    } | null>;
    /** Save chat to the API; return new session id when created. */
    savePersisted?: (payload: {
      sessionId: string | null;
      mode: AgentMode;
      messages: AgentPersistMessage[];
    }) => Promise<string>;
  },
): UseAgentReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<AgentStatus>('idle');
  const [currentTool, setCurrentTool] = useState<string | null>(null);
  const [editProposals, setEditProposals] = useState<EditProposal[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const persistSessionIdRef = useRef<string | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    persistSessionIdRef.current = null;
  }, [projectId]);

  // Load latest agent session from Postgres when the project (or loader) changes
  useEffect(() => {
    if (!options?.loadPersisted) return;
    let cancelled = false;
    const pid = projectId;
    void (async () => {
      try {
        const data = await options.loadPersisted!();
        if (cancelled || pid !== projectId || !data?.messages.length) return;
        persistSessionIdRef.current = data.sessionId;
        setMessages(
          data.messages.map((m) => ({
            id: nextId(),
            role: m.role,
            content: m.content,
          })),
        );
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, options?.loadPersisted]);

  // Debounced save after each completed turn (or idle edits)
  useEffect(() => {
    if (!options?.savePersisted) return;
    if (status === 'thinking' || status === 'tool_call') return;
    if (messages.length === 0 && persistSessionIdRef.current === null) return;

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      void persistAfterTurn(messages, mode, options.savePersisted!, persistSessionIdRef);
    }, 1200);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [messages, mode, status, options?.savePersisted]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (status === 'thinking' || status === 'tool_call') return;

      const userMsg: ChatMessage = { id: nextId(), role: 'user', content: text };
      const assistantMsg: ChatMessage = {
        id: nextId(),
        role: 'assistant',
        content: '',
        toolCalls: [],
        editProposals: [],
      };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setStatus('thinking');
      setCurrentTool(null);

      // Build API message history
      const apiMessages = [
        ...messages.map((m) => ({ role: m.role, content: m.content })),
        { role: 'user' as const, content: text },
      ];

      const token = await getToken();
      const abortController = new AbortController();
      abortRef.current = abortController;

      try {
        const response = await fetch(`${AGENT_URL}/agent/run`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            project_id: projectId,
            mode,
            messages: apiMessages,
            open_file: options?.openFile ?? null,
            compile_errors: options?.compileErrors ?? null,
          }),
          signal: abortController.signal,
        });

        if (!response.ok) {
          const errBody = await response.text();
          throw new Error(`Agent error ${response.status}: ${errBody}`);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error('No response body');

        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const jsonStr = line.slice(6).trim();
            if (!jsonStr) continue;

            let event: AgentEvent;
            try {
              event = JSON.parse(jsonStr);
            } catch {
              continue;
            }

            switch (event.type) {
              case 'text_delta':
                setMessages((prev) => {
                  const updated = [...prev];
                  const last = updated[updated.length - 1];
                  if (last?.role === 'assistant') {
                    updated[updated.length - 1] = {
                      ...last,
                      content: last.content + event.text,
                    };
                  }
                  return updated;
                });
                setStatus('thinking');
                break;

              case 'tool_start':
                setStatus('tool_call');
                setCurrentTool(event.tool);
                setMessages((prev) => {
                  const updated = [...prev];
                  const last = updated[updated.length - 1];
                  if (last?.role === 'assistant') {
                    updated[updated.length - 1] = {
                      ...last,
                      toolCalls: [
                        ...(last.toolCalls ?? []),
                        { tool: event.tool, input: event.input },
                      ],
                    };
                  }
                  return updated;
                });
                break;

              case 'tool_result':
                setCurrentTool(null);
                setMessages((prev) => {
                  const updated = [...prev];
                  const last = updated[updated.length - 1];
                  if (last?.role === 'assistant' && last.toolCalls?.length) {
                    const calls = [...last.toolCalls];
                    const lastCall = calls[calls.length - 1];
                    if (lastCall) {
                      calls[calls.length - 1] = {
                        ...lastCall,
                        result: event.result,
                        isError: event.is_error,
                      };
                    }
                    updated[updated.length - 1] = { ...last, toolCalls: calls };
                  }
                  return updated;
                });
                break;

              case 'edit_proposed':
                {
                  const proposal: EditProposal = {
                    editId: event.edit_id,
                    file: event.file,
                    search: event.search,
                    replace: event.replace,
                    status: 'pending',
                  };
                  setEditProposals((prev) => [...prev, proposal]);
                  setMessages((prev) => {
                    const updated = [...prev];
                    const last = updated[updated.length - 1];
                    if (last?.role === 'assistant') {
                      updated[updated.length - 1] = {
                        ...last,
                        editProposals: [...(last.editProposals ?? []), proposal],
                      };
                    }
                    return updated;
                  });
                }
                break;

              case 'file_created':
                options?.onFileCreated?.(event.file);
                break;

              case 'done':
                setStatus('done');
                setCurrentTool(null);
                break;

              case 'error':
                setStatus('error');
                setCurrentTool(null);
                setMessages((prev) => {
                  const updated = [...prev];
                  const last = updated[updated.length - 1];
                  if (last?.role === 'assistant') {
                    updated[updated.length - 1] = {
                      ...last,
                      content: last.content + `\n\n**Error:** ${event.message}`,
                    };
                  }
                  return updated;
                });
                break;
            }
          }
        }

        // If we didn't get an explicit done event, set to done
        setStatus((prev) => (prev === 'thinking' || prev === 'tool_call' ? 'done' : prev));
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        setStatus('error');
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last?.role === 'assistant') {
            updated[updated.length - 1] = {
              ...last,
              content: last.content + `\n\n**Error:** ${(err as Error).message}`,
            };
          }
          return updated;
        });
      }
    },
    [projectId, mode, messages, getToken, options, status],
  );

  const acceptEdit = useCallback((editId: string) => {
    setEditProposals((prev) =>
      prev.map((p) => (p.editId === editId ? { ...p, status: 'accepted' as const } : p)),
    );
    setMessages((prev) =>
      prev.map((m) => ({
        ...m,
        editProposals: m.editProposals?.map((p) =>
          p.editId === editId ? { ...p, status: 'accepted' as const } : p,
        ),
      })),
    );
  }, []);

  const rejectEdit = useCallback((editId: string) => {
    setEditProposals((prev) =>
      prev.map((p) => (p.editId === editId ? { ...p, status: 'rejected' as const } : p)),
    );
    setMessages((prev) =>
      prev.map((m) => ({
        ...m,
        editProposals: m.editProposals?.map((p) =>
          p.editId === editId ? { ...p, status: 'rejected' as const } : p,
        ),
      })),
    );
  }, []);

  const clearMessages = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
    setEditProposals([]);
    setStatus('idle');
    setCurrentTool(null);
    const sid = persistSessionIdRef.current;
    persistSessionIdRef.current = null;
    if (options?.savePersisted && sid) {
      void options
        .savePersisted({ sessionId: sid, mode, messages: [] })
        .then((id) => {
          persistSessionIdRef.current = id;
        })
        .catch(() => {});
    }
  }, [mode, options]);

  return {
    messages,
    status,
    currentTool,
    editProposals,
    sendMessage,
    acceptEdit,
    rejectEdit,
    clearMessages,
  };
}
