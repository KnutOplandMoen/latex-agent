import { eq, and } from 'drizzle-orm';
import { projectMembers, projects } from '@latex-ide/db';
import type { Database } from '@latex-ide/db';
import type { Queue } from 'bullmq';
import { ForbiddenError, NotFoundError } from '../lib/errors.js';

export function createCompileService(db: Database, compileQueue: Queue) {
  async function assertCanCompile(projectId: string, userId: string) {
    const member = await db.query.projectMembers.findFirst({
      where: and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)),
    });
    if (!member) throw new ForbiddenError('Not a project member');
    if (member.role === 'viewer') throw new ForbiddenError('Viewers cannot compile');
    return member;
  }

  return {
    async enqueue(projectId: string, userId: string, rootFile?: string) {
      await assertCanCompile(projectId, userId);

      const project = await db.query.projects.findFirst({
        where: eq(projects.id, projectId),
      });
      if (!project) throw new NotFoundError('Project not found');

      const job = await compileQueue.add('compile', {
        projectId,
        userId,
        rootFile: rootFile ?? project.rootFile,
      });

      return { jobId: job.id! };
    },

    async getStatus(projectId: string, jobId: string, userId: string) {
      await assertCanCompile(projectId, userId);

      const job = await compileQueue.getJob(jobId);
      if (!job || job.data.projectId !== projectId) {
        throw new NotFoundError('Compile job not found');
      }

      const state = await job.getState();

      if (state === 'completed') {
        // Persist so the frontend can reload the PDF on next visit.
        await db.update(projects).set({ lastCompiledJobId: jobId }).where(eq(projects.id, projectId));
        return { jobId, status: 'completed' as const, ...job.returnvalue };
      }

      if (state === 'failed') {
        return {
          jobId,
          status: 'failed' as const,
          pdfUrl: null,
          errors: [{ file: 'main.tex', line: null, message: job.failedReason ?? 'Unknown error', level: 'error' as const }],
          warnings: [],
          log: null,
        };
      }

      return { jobId, status: (state === 'active' ? 'active' : 'queued') as 'active' | 'queued' };
    },
  };
}
