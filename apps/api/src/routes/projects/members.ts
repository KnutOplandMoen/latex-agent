import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { ProjectMemberWithUserSchema, InviteSchema, CreateInviteInput } from '@latex-ide/shared-types';
import { createMemberService } from '../../services/members.js';

const membersRoutes: FastifyPluginAsyncZod = async (fastify) => {
  const svc = createMemberService(fastify.db);

  fastify.get('/:id/members', {
    schema: {
      params: z.object({ id: z.string().uuid() }),
      response: { 200: z.array(ProjectMemberWithUserSchema) },
    },
    handler: async (req) => {
      return svc.listMembers(req.params.id, req.user.id);
    },
  });

  fastify.patch('/:id/members/:userId', {
    schema: {
      params: z.object({ id: z.string().uuid(), userId: z.string() }),
      body: z.object({ role: z.enum(['editor', 'viewer']) }),
      response: { 200: ProjectMemberWithUserSchema },
    },
    handler: async (req) => {
      return svc.updateRole(req.params.id, req.params.userId, req.body.role, req.user.id);
    },
  });

  fastify.delete('/:id/members/:userId', {
    schema: {
      params: z.object({ id: z.string().uuid(), userId: z.string() }),
      response: { 204: z.void() },
    },
    handler: async (req, reply) => {
      await svc.removeMember(req.params.id, req.params.userId, req.user.id);
      reply.code(204);
    },
  });

  fastify.post('/:id/invites', {
    schema: {
      params: z.object({ id: z.string().uuid() }),
      body: CreateInviteInput,
      response: { 201: InviteSchema },
    },
    handler: async (req, reply) => {
      const invite = await svc.createInvite(req.params.id, req.body.email, req.body.role, req.user.id);
      reply.code(201);
      return invite;
    },
  });

  fastify.get('/:id/invites', {
    schema: {
      params: z.object({ id: z.string().uuid() }),
      response: { 200: z.array(InviteSchema) },
    },
    handler: async (req) => {
      return svc.listInvites(req.params.id, req.user.id);
    },
  });

  fastify.delete('/:id/invites/:inviteId', {
    schema: {
      params: z.object({ id: z.string().uuid(), inviteId: z.string().uuid() }),
      response: { 204: z.void() },
    },
    handler: async (req, reply) => {
      await svc.cancelInvite(req.params.id, req.params.inviteId, req.user.id);
      reply.code(204);
    },
  });
};

export default membersRoutes;
