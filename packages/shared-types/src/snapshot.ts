import { z } from 'zod';

export const SnapshotSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  fileId: z.string().uuid(),
  label: z.string().nullable(),
  createdBy: z.string(),
  createdAt: z.string().datetime(),
});

export type Snapshot = z.infer<typeof SnapshotSchema>;

export const CreateSnapshotInput = z.object({
  fileId: z.string().uuid(),
  label: z.string().max(255).optional(),
});

export type CreateSnapshotInputType = z.infer<typeof CreateSnapshotInput>;
