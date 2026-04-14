import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { CompileRequestSchema, CompileResultSchema } from '@latex-ide/shared-types';
import { createCompileService } from '../../services/compile.js';

const compileRoutes: FastifyPluginAsyncZod = async (fastify) => {
  const svc = createCompileService(fastify.db, fastify.compileQueue);

  fastify.post('/:id/compile', {
    schema: {
      params: z.object({ id: z.string().uuid() }),
      body: CompileRequestSchema,
      response: { 202: z.object({ jobId: z.string() }) },
    },
    handler: async (req, reply) => {
      const { id } = req.params;
      const result = await svc.enqueue(id, req.user.id, req.body.rootFile);
      reply.code(202);
      return result;
    },
  });

  fastify.get('/:id/compile/:jobId', {
    schema: {
      params: z.object({ id: z.string().uuid(), jobId: z.string() }),
      response: { 200: CompileResultSchema },
    },
    handler: async (req) => {
      const { id, jobId } = req.params;
      return svc.getStatus(id, jobId, req.user.id);
    },
  });
};

export default compileRoutes;
