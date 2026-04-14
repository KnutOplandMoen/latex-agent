import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { SnapshotSchema, CreateSnapshotInput } from '@latex-ide/shared-types';
import { createSnapshotService } from '../../services/snapshots.js';

const snapshotRoutes: FastifyPluginAsyncZod = async (fastify) => {
  const svc = createSnapshotService(fastify.db);

  fastify.get('/:id/snapshots', {
    schema: {
      params: z.object({ id: z.string().uuid() }),
      querystring: z.object({ fileId: z.string().uuid().optional() }),
      response: { 200: z.array(SnapshotSchema) },
    },
    handler: async (req) => {
      return svc.list(req.params.id, req.user.id, req.query.fileId);
    },
  });

  fastify.post('/:id/snapshots', {
    schema: {
      params: z.object({ id: z.string().uuid() }),
      body: CreateSnapshotInput,
      response: { 201: SnapshotSchema },
    },
    handler: async (req, reply) => {
      const snapshot = await svc.create(req.params.id, req.body.fileId, req.body.label, req.user.id);
      reply.code(201);
      return snapshot;
    },
  });

  fastify.get('/:id/snapshots/:snapshotId/content', {
    schema: {
      params: z.object({ id: z.string().uuid(), snapshotId: z.string().uuid() }),
      response: { 200: z.object({ content: z.string() }) },
    },
    handler: async (req) => {
      const content = await svc.getContent(req.params.id, req.params.snapshotId, req.user.id);
      return { content };
    },
  });

  fastify.delete('/:id/snapshots/:snapshotId', {
    schema: {
      params: z.object({ id: z.string().uuid(), snapshotId: z.string().uuid() }),
      response: { 204: z.void() },
    },
    handler: async (req, reply) => {
      await svc.remove(req.params.id, req.params.snapshotId, req.user.id);
      reply.code(204);
    },
  });
};

export default snapshotRoutes;
