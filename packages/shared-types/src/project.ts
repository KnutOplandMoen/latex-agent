import { z } from 'zod';

export const ProjectSchema = z.object({
  id: z.string().uuid(),
  ownerId: z.string(),
  name: z.string().min(1).max(255),
  rootFile: z.string().default('main.tex'),
  lastCompiledJobId: z.string().nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Project = z.infer<typeof ProjectSchema>;

export const CreateProjectInput = z.object({
  name: z.string().min(1).max(255),
});

export type CreateProjectInputType = z.infer<typeof CreateProjectInput>;

export const ProjectMemberRole = z.enum(['owner', 'editor', 'viewer']);
export type ProjectMemberRoleType = z.infer<typeof ProjectMemberRole>;

export const ProjectMemberSchema = z.object({
  projectId: z.string().uuid(),
  userId: z.string(),
  role: ProjectMemberRole,
  addedAt: z.string().datetime(),
});

export type ProjectMember = z.infer<typeof ProjectMemberSchema>;
