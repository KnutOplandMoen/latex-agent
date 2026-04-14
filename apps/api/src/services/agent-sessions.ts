import { and, desc, eq } from 'drizzle-orm';
import { agentSessions, projectMembers } from '@latex-ide/db';
import type { Database } from '@latex-ide/db';
import type { AgentMessage, AgentModeType, AgentSession } from '@latex-ide/shared-types';
import { AgentMessageSchema } from '@latex-ide/shared-types';
import { ForbiddenError, NotFoundError } from '../lib/errors.js';

function serializeSession(row: {
  id: string;
  projectId: string;
  userId: string;
  mode: string;
  messages: string;
  createdAt: Date;
  updatedAt: Date;
}): AgentSession {
  let messages: AgentMessage[] = [];
  try {
    const raw = JSON.parse(row.messages) as unknown[];
    if (Array.isArray(raw)) {
      messages = raw
        .map((m) => AgentMessageSchema.safeParse(m))
        .filter((r) => r.success)
        .map((r) => r.data);
    }
  } catch {
    messages = [];
  }

  return {
    id: row.id,
    projectId: row.projectId,
    userId: row.userId,
    mode: row.mode as AgentModeType,
    messages,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function createAgentSessionService(db: Database) {
  async function assertCanUseAgent(projectId: string, userId: string) {
    const member = await db.query.projectMembers.findFirst({
      where: and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)),
    });
    if (!member) throw new ForbiddenError('Not a project member');
    if (member.role === 'viewer') throw new ForbiddenError('Viewers cannot use the agent');
    return member;
  }

  return {
    async getLatest(projectId: string, userId: string): Promise<AgentSession | null> {
      await assertCanUseAgent(projectId, userId);

      const row = await db.query.agentSessions.findFirst({
        where: and(eq(agentSessions.projectId, projectId), eq(agentSessions.userId, userId)),
        orderBy: [desc(agentSessions.updatedAt)],
      });

      if (!row) return null;
      return serializeSession(row);
    },

    async upsert(
      projectId: string,
      userId: string,
      input: { sessionId?: string | null; mode: AgentModeType; messages: AgentMessage[] },
    ): Promise<AgentSession> {
      await assertCanUseAgent(projectId, userId);

      const payload = JSON.stringify(input.messages);

      if (input.sessionId) {
        const existing = await db.query.agentSessions.findFirst({
          where: and(
            eq(agentSessions.id, input.sessionId),
            eq(agentSessions.projectId, projectId),
            eq(agentSessions.userId, userId),
          ),
        });
        if (!existing) throw new NotFoundError('Agent session not found');

        const [updated] = await db
          .update(agentSessions)
          .set({
            mode: input.mode,
            messages: payload,
            updatedAt: new Date(),
          })
          .where(eq(agentSessions.id, input.sessionId))
          .returning();

        return serializeSession(updated!);
      }

      const [created] = await db
        .insert(agentSessions)
        .values({
          projectId,
          userId,
          mode: input.mode,
          messages: payload,
        })
        .returning();

      return serializeSession(created!);
    },
  };
}
