import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { TemplateSchema, CreateProjectFromTemplateInput } from '@latex-ide/shared-types';
import { createTemplateService } from '../services/templates.js';

const templatesRoutes: FastifyPluginAsyncZod = async (fastify) => {
  const svc = createTemplateService(fastify.db);

  // Public — no auth check needed (auth hook runs but templates are read-only public data)
  fastify.get('/', {
    schema: {
      response: { 200: z.array(TemplateSchema) },
    },
    handler: async () => {
      return svc.list();
    },
  });

  fastify.post('/:id/clone', {
    schema: {
      params: z.object({ id: z.string().uuid() }),
      body: CreateProjectFromTemplateInput,
      response: { 201: z.object({ projectId: z.string().uuid() }) },
    },
    handler: async (req, reply) => {
      const result = await svc.cloneToProject(req.params.id, req.body.name, req.user.id);
      reply.code(201);
      return result;
    },
  });
};

export default templatesRoutes;
