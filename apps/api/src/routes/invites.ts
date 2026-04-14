import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { createMemberService } from '../services/members.js';

const invitesRoutes: FastifyPluginAsyncZod = async (fastify) => {
  const svc = createMemberService(fastify.db);

  fastify.post('/:token/accept', {
    schema: {
      params: z.object({ token: z.string() }),
      response: { 200: z.object({ projectId: z.string().uuid() }) },
    },
    handler: async (req) => {
      return svc.acceptInvite(req.params.token, req.user.id, req.user.email);
    },
  });
};

export default invitesRoutes;
