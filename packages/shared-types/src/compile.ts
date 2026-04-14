import { z } from 'zod';

export const CompileRequestSchema = z.object({
  rootFile: z.string().optional(),
});

export type CompileRequestType = z.infer<typeof CompileRequestSchema>;

export const CompileErrorSchema = z.object({
  file: z.string(),
  line: z.number().nullable(),
  message: z.string(),
  level: z.enum(['error', 'warning']),
});

export type CompileError = z.infer<typeof CompileErrorSchema>;

export const CompileStatus = z.enum(['queued', 'active', 'completed', 'failed']);
export type CompileStatusType = z.infer<typeof CompileStatus>;

export const CompileResultSchema = z.object({
  jobId: z.string(),
  status: CompileStatus,
  pdfUrl: z.string().nullable().optional(),
  errors: z.array(CompileErrorSchema).optional(),
  warnings: z.array(CompileErrorSchema).optional(),
  log: z.string().nullable().optional(),
});

export type CompileResult = z.infer<typeof CompileResultSchema>;

export const SyncTexEntrySchema = z.object({
  page: z.number(),
  x: z.number(),
  y: z.number(),
  file: z.string(),
  line: z.number(),
});

export type SyncTexEntry = z.infer<typeof SyncTexEntrySchema>;

export const SyncTexDataSchema = z.object({
  pdfToSource: z.array(SyncTexEntrySchema),
  sourceToPdf: z.array(SyncTexEntrySchema),
});

export type SyncTexData = z.infer<typeof SyncTexDataSchema>;
