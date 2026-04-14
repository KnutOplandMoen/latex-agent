import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { AgentSessionPutBodySchema, AgentSessionSchema } from '@latex-ide/shared-types';
import { createAgentSessionService } from '../../services/agent-sessions.js';

const agentSessionRoutes: FastifyPluginAsyncZod = async (fastify) => {
  const svc = createAgentSessionService(fastify.db);

  fastify.get('/:id/agent-session', {
    schema: {
      params: z.object({ id: z.string().uuid() }),
      response: {
        200: z.object({ session: AgentSessionSchema.nullable() }),
      },
    },
    handler: async (req) => {
      const { id } = req.params;
      const session = await svc.getLatest(id, req.user.id);
      return { session };
    },
  });

  fastify.put('/:id/agent-session', {
    schema: {
      params: z.object({ id: z.string().uuid() }),
      body: AgentSessionPutBodySchema,
      response: { 200: AgentSessionSchema },
    },
    handler: async (req) => {
      const { id } = req.params;
      const body = req.body;
      return svc.upsert(id, req.user.id, {
        sessionId: body.sessionId ?? undefined,
        mode: body.mode,
        messages: body.messages,
      });
    },
  });
};

export default agentSessionRoutes;
