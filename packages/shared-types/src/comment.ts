import { z } from 'zod';

export const CommentSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  fileId: z.string().uuid(),
  authorId: z.string(),
  authorName: z.string().nullable(),
  body: z.string(),
  resolvedAt: z.string().datetime().nullable(),
  resolvedBy: z.string().nullable(),
  yjsAnchor: z.string(),
  parentId: z.string().uuid().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  replies: z.array(z.lazy((): z.ZodTypeAny => CommentSchema)).optional(),
});

export type Comment = z.infer<typeof CommentSchema>;

export const CreateCommentInput = z.object({
  fileId: z.string().uuid(),
  body: z.string().min(1).max(10000),
  yjsAnchor: z.string(),
  parentId: z.string().uuid().optional(),
});

export type CreateCommentInputType = z.infer<typeof CreateCommentInput>;

export const UpdateCommentInput = z.union([
  z.object({ body: z.string().min(1).max(10000) }),
  z.object({ resolved: z.literal(true) }),
  z.object({ resolved: z.literal(false) }),
]);

export type UpdateCommentInputType = z.infer<typeof UpdateCommentInput>;
