import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { FileSchema, CreateFileInput, FileWithContentSchema } from '@latex-ide/shared-types';
import { createFileService } from '../../services/files.js';

const projectFilesRoutes: FastifyPluginAsyncZod = async (fastify) => {
  const svc = createFileService(fastify.db);

  fastify.get('/:id/files', {
    schema: {
      params: z.object({ id: z.string().uuid() }),
      response: { 200: z.array(FileSchema) },
    },
    handler: async (req) => {
      const { id } = req.params;
      const rows = await svc.listByProject(id, req.user.id);
      return rows.map(serializeFile);
    },
  });

  fastify.post('/:id/files', {
    schema: {
      params: z.object({ id: z.string().uuid() }),
      body: CreateFileInput,
      response: { 201: FileWithContentSchema },
    },
    handler: async (req, reply) => {
      const { id } = req.params;
      const file = await svc.create(id, req.body, req.user.id);
      reply.code(201);
      return serializeFileWithContent(file);
    },
  });
};

type FileType = 'tex' | 'bib' | 'image' | 'other';

function serializeFile(row: { id: string; projectId: string; path: string; type: string; createdAt: Date; updatedAt: Date }) {
  return {
    id: row.id,
    projectId: row.projectId,
    path: row.path,
    type: row.type as FileType,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function serializeFileWithContent(row: { id: string; projectId: string; path: string; type: string; content: string | null; createdAt: Date; updatedAt: Date }) {
  return {
    ...serializeFile(row),
    content: row.content,
  };
}

export default projectFilesRoutes;
