import { z } from 'zod';

export const FileType = z.enum(['tex', 'bib', 'image', 'other']);
export type FileTypeValue = z.infer<typeof FileType>;

export const FileSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  path: z.string().min(1),
  type: FileType,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type File = z.infer<typeof FileSchema>;

export const FileWithContentSchema = FileSchema.extend({
  content: z.string().nullable(),
});

export type FileWithContent = z.infer<typeof FileWithContentSchema>;

export const CreateFileInput = z.object({
  path: z.string().min(1),
  type: FileType,
  content: z.string().optional(),
});

export type CreateFileInputType = z.infer<typeof CreateFileInput>;

export const UpdateFileInput = z.object({
  content: z.string(),
});

export type UpdateFileInputType = z.infer<typeof UpdateFileInput>;
