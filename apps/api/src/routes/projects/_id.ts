import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { ProjectSchema } from '@latex-ide/shared-types';
import { createProjectService } from '../../services/projects.js';

const projectByIdRoutes: FastifyPluginAsyncZod = async (fastify) => {
  const svc = createProjectService(fastify.db);

  fastify.get('/:id', {
    schema: {
      params: z.object({ id: z.string().uuid() }),
      response: { 200: ProjectSchema },
    },
    handler: async (req) => {
      const { id } = req.params;
      const project = await svc.getById(id, req.user.id);
      return {
        id: project.id,
        ownerId: project.ownerId,
        name: project.name,
        rootFile: project.rootFile,
        createdAt: project.createdAt.toISOString(),
        updatedAt: project.updatedAt.toISOString(),
      };
    },
  });

  fastify.delete('/:id', {
    schema: {
      params: z.object({ id: z.string().uuid() }),
    },
    handler: async (req, reply) => {
      const { id } = req.params;
      await svc.remove(id, req.user.id);
      reply.code(204).send();
    },
  });
};

export default projectByIdRoutes;
