import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { FileWithContentSchema, UpdateFileInput } from '@latex-ide/shared-types';
import { createFileService } from '../../services/files.js';

type FileType = 'tex' | 'bib' | 'image' | 'other';

const fileByIdRoutes: FastifyPluginAsyncZod = async (fastify) => {
  const svc = createFileService(fastify.db);

  fastify.get('/:id', {
    schema: {
      params: z.object({ id: z.string().uuid() }),
      response: { 200: FileWithContentSchema },
    },
    handler: async (req) => {
      const { id } = req.params;
      const file = await svc.getById(id, req.user.id);
      return {
        id: file.id,
        projectId: file.projectId,
        path: file.path,
        type: file.type as FileType,
        content: file.content,
        createdAt: file.createdAt.toISOString(),
        updatedAt: file.updatedAt.toISOString(),
      };
    },
  });

  fastify.put('/:id', {
    schema: {
      params: z.object({ id: z.string().uuid() }),
      body: UpdateFileInput,
      response: { 200: FileWithContentSchema },
    },
    handler: async (req) => {
      const { id } = req.params;
      const file = await svc.updateContent(id, req.body.content, req.user.id);
      return {
        id: file.id,
        projectId: file.projectId,
        path: file.path,
        type: file.type as FileType,
        content: file.content,
        createdAt: file.createdAt.toISOString(),
        updatedAt: file.updatedAt.toISOString(),
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

export default fileByIdRoutes;
