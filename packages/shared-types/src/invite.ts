import { z } from 'zod';
import { ProjectMemberRole } from './project.js';

export const InviteSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  invitedBy: z.string(),
  email: z.string().email(),
  role: z.enum(['editor', 'viewer']),
  token: z.string(),
  acceptedAt: z.string().datetime().nullable(),
  expiresAt: z.string().datetime(),
  createdAt: z.string().datetime(),
});

export type Invite = z.infer<typeof InviteSchema>;

export const CreateInviteInput = z.object({
  email: z.string().email(),
  role: z.enum(['editor', 'viewer']),
});

export type CreateInviteInputType = z.infer<typeof CreateInviteInput>;

export const ProjectMemberWithUserSchema = z.object({
  projectId: z.string().uuid(),
  userId: z.string(),
  role: ProjectMemberRole,
  addedAt: z.string().datetime(),
  email: z.string().nullable(),
  name: z.string().nullable(),
});

export type ProjectMemberWithUser = z.infer<typeof ProjectMemberWithUserSchema>;
