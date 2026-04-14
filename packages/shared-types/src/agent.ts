import { z } from 'zod';

export const AgentMode = z.enum(['general', 'debug']);
export type AgentModeType = z.infer<typeof AgentMode>;

export const AgentMessageRole = z.enum(['user', 'assistant']);

export const AgentMessageSchema = z.object({
  role: AgentMessageRole,
  content: z.string(),
});
export type AgentMessage = z.infer<typeof AgentMessageSchema>;

export const AgentSessionSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  userId: z.string(),
  mode: AgentMode,
  messages: z.array(AgentMessageSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type AgentSession = z.infer<typeof AgentSessionSchema>;

/** Body for creating or updating the persisted chat session */
export const AgentSessionPutBodySchema = z.object({
  sessionId: z.string().uuid().optional().nullable(),
  mode: AgentMode,
  messages: z.array(AgentMessageSchema),
});
export type AgentSessionPutBody = z.infer<typeof AgentSessionPutBodySchema>;

export const AgentRunRequestSchema = z.object({
  projectId: z.string().uuid(),
  mode: AgentMode.optional().default('general'),
  messages: z.array(AgentMessageSchema),
  openFile: z.string().nullable().optional(),
  compileErrors: z.array(z.object({
    file: z.string(),
    line: z.number().nullable(),
    message: z.string(),
    level: z.string(),
  })).nullable().optional(),
});
export type AgentRunRequest = z.infer<typeof AgentRunRequestSchema>;

// SSE event types (for documentation — actual parsing is done on the client)
export const AgentEventType = z.enum([
  'text_delta',
  'tool_start',
  'tool_result',
  'edit_proposed',
  'file_created',
  'done',
  'error',
]);
export type AgentEventTypeValue = z.infer<typeof AgentEventType>;
