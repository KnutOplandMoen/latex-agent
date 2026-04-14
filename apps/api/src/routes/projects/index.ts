import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { CreateProjectInput, ProjectSchema } from '@latex-ide/shared-types';
import { createProjectService } from '../../services/projects.js';

const projectsRoutes: FastifyPluginAsyncZod = async (fastify) => {
  const svc = createProjectService(fastify.db);

  fastify.get('/', {
    schema: {
      response: { 200: z.array(ProjectSchema) },
    },
    handler: async (req) => {
      const rows = await svc.list(req.user.id);
      return rows.map(serializeProject);
    },
  });

  fastify.post('/', {
    schema: {
      body: CreateProjectInput,
      response: { 201: ProjectSchema },
    },
    handler: async (req, reply) => {
      const project = await svc.create(req.body.name, req.user.id);
      reply.code(201);
      return serializeProject(project);
    },
  });
};

function serializeProject(row: { id: string; ownerId: string; name: string; rootFile: string; createdAt: Date; updatedAt: Date }) {
  return {
    id: row.id,
    ownerId: row.ownerId,
    name: row.name,
    rootFile: row.rootFile,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export default projectsRoutes;
