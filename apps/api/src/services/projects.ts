import { eq, and } from 'drizzle-orm';
import { projects, projectMembers, files } from '@latex-ide/db';
import type { Database } from '@latex-ide/db';
import { NotFoundError, ForbiddenError } from '../lib/errors.js';

export function createProjectService(db: Database) {
  async function assertMembership(projectId: string, userId: string) {
    const member = await db.query.projectMembers.findFirst({
      where: and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)),
    });
    if (!member) throw new ForbiddenError('Not a project member');
    return member;
  }

  return {
    async list(userId: string) {
      const rows = await db.query.projectMembers.findMany({
        where: eq(projectMembers.userId, userId),
        with: { project: true },
      });
      return rows.map((r) => r.project);
    },

    async getById(projectId: string, userId: string) {
      await assertMembership(projectId, userId);
      const project = await db.query.projects.findFirst({
        where: eq(projects.id, projectId),
      });
      if (!project) throw new NotFoundError('Project not found');
      return project;
    },

    async create(name: string, userId: string) {
      return db.transaction(async (tx) => {
        const [project] = await tx
          .insert(projects)
          .values({ name, ownerId: userId })
          .returning();

        await tx.insert(projectMembers).values({
          projectId: project!.id,
          userId,
          role: 'owner',
        });

        await tx.insert(files).values({
          projectId: project!.id,
          path: 'main.tex',
          type: 'tex',
          content: '\\documentclass{article}\n\n\\begin{document}\n\nHello, world!\n\n\\end{document}\n',
        });

        return project!;
      });
    },

    async remove(projectId: string, userId: string) {
      const member = await assertMembership(projectId, userId);
      if (member.role !== 'owner') throw new ForbiddenError('Only the owner can delete a project');
      const [deleted] = await db.delete(projects).where(eq(projects.id, projectId)).returning();
      if (!deleted) throw new NotFoundError('Project not found');
    },
  };
}
