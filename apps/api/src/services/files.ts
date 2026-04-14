import { eq, and } from 'drizzle-orm';
import { files, projectMembers } from '@latex-ide/db';
import type { Database } from '@latex-ide/db';
import type { CreateFileInputType } from '@latex-ide/shared-types';
import { NotFoundError, ForbiddenError } from '../lib/errors.js';

export function createFileService(db: Database) {
  async function assertMembership(projectId: string, userId: string) {
    const member = await db.query.projectMembers.findFirst({
      where: and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)),
    });
    if (!member) throw new ForbiddenError('Not a project member');
    return member;
  }

  async function getFileWithAccessCheck(fileId: string, userId: string) {
    const file = await db.query.files.findFirst({
      where: eq(files.id, fileId),
    });
    if (!file) throw new NotFoundError('File not found');
    await assertMembership(file.projectId, userId);
    return file;
  }

  return {
    async listByProject(projectId: string, userId: string) {
      await assertMembership(projectId, userId);
      return db.query.files.findMany({
        where: eq(files.projectId, projectId),
        columns: { id: true, projectId: true, path: true, type: true, createdAt: true, updatedAt: true },
      });
    },

    async getById(fileId: string, userId: string) {
      return getFileWithAccessCheck(fileId, userId);
    },

    async create(projectId: string, input: CreateFileInputType, userId: string) {
      await assertMembership(projectId, userId);
      const [file] = await db
        .insert(files)
        .values({
          projectId,
          path: input.path,
          type: input.type,
          content: input.content ?? null,
        })
        .returning();
      return file!;
    },

    async updateContent(fileId: string, content: string, userId: string) {
      const file = await getFileWithAccessCheck(fileId, userId);
      const member = await db.query.projectMembers.findFirst({
        where: and(eq(projectMembers.projectId, file.projectId), eq(projectMembers.userId, userId)),
      });
      if (member?.role === 'viewer') throw new ForbiddenError('Viewers cannot edit files');

      const [updated] = await db
        .update(files)
        .set({ content, updatedAt: new Date() })
        .where(eq(files.id, fileId))
        .returning();
      return updated!;
    },

    async remove(fileId: string, userId: string) {
      const file = await getFileWithAccessCheck(fileId, userId);
      const member = await db.query.projectMembers.findFirst({
        where: and(eq(projectMembers.projectId, file.projectId), eq(projectMembers.userId, userId)),
      });
      if (member?.role === 'viewer') throw new ForbiddenError('Viewers cannot delete files');

      await db.delete(files).where(eq(files.id, fileId));
    },
  };
}
