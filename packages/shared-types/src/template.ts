import { z } from 'zod';

export const TemplateFileSchema = z.object({
  path: z.string(),
  content: z.string(),
});

export type TemplateFile = z.infer<typeof TemplateFileSchema>;

export const TemplateSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string(),
  category: z.enum(['article', 'thesis', 'beamer', 'cv', 'ieee', 'acm']),
  thumbnail: z.string().nullable(),
  createdAt: z.string().datetime(),
});

export type Template = z.infer<typeof TemplateSchema>;

export const CreateProjectFromTemplateInput = z.object({
  name: z.string().min(1).max(255),
});

export type CreateProjectFromTemplateInputType = z.infer<typeof CreateProjectFromTemplateInput>;
