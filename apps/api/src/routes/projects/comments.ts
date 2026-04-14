import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { CommentSchema, CreateCommentInput, UpdateCommentInput } from '@latex-ide/shared-types';
import { createCommentService } from '../../services/comments.js';

const commentRoutes: FastifyPluginAsyncZod = async (fastify) => {
  const svc = createCommentService(fastify.db);

  fastify.get('/:id/comments', {
    schema: {
      params: z.object({ id: z.string().uuid() }),
      querystring: z.object({
        fileId: z.string().uuid(),
        resolved: z.enum(['true', 'false']).optional(),
      }),
      response: { 200: z.array(CommentSchema) },
    },
    handler: async (req) => {
      const includeResolved = req.query.resolved === 'true';
      return svc.list(req.params.id, req.user.id, req.query.fileId, includeResolved);
    },
  });

  fastify.post('/:id/comments', {
    schema: {
      params: z.object({ id: z.string().uuid() }),
      body: CreateCommentInput,
      response: { 201: CommentSchema },
    },
    handler: async (req, reply) => {
      const comment = await svc.create(
        req.params.id,
        req.body.fileId,
        req.body.body,
        req.body.yjsAnchor,
        req.body.parentId,
        req.user.id,
      );
      reply.code(201);
      return comment;
    },
  });

  fastify.patch('/:id/comments/:commentId', {
    schema: {
      params: z.object({ id: z.string().uuid(), commentId: z.string().uuid() }),
      body: UpdateCommentInput,
      response: { 200: CommentSchema },
    },
    handler: async (req) => {
      const body = req.body as { body?: string } | { resolved: boolean };
      let update: { body?: string; resolved?: boolean };
      if ('body' in body) {
        update = { body: (body as { body?: string }).body };
      } else {
        update = { resolved: (body as { resolved: boolean }).resolved };
      }
      return svc.update(req.params.id, req.params.commentId, update, req.user.id);
    },
  });

  fastify.delete('/:id/comments/:commentId', {
    schema: {
      params: z.object({ id: z.string().uuid(), commentId: z.string().uuid() }),
      response: { 204: z.void() },
    },
    handler: async (req, reply) => {
      await svc.remove(req.params.id, req.params.commentId, req.user.id);
      reply.code(204);
    },
  });
};

export default commentRoutes;
