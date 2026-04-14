import { eq, and, desc } from 'drizzle-orm';
import { projectSnapshots, projectMembers, yjsUpdates } from '@latex-ide/db';
import type { Database } from '@latex-ide/db';
import * as Y from 'yjs';
import type { Snapshot } from '@latex-ide/shared-types';
import { ForbiddenError, NotFoundError } from '../lib/errors.js';

function serializeSnapshot(row: {
  id: string;
  projectId: string;
  fileId: string;
  label: string | null;
  createdBy: string;
  createdAt: Date;
}): Snapshot {
  return {
    id: row.id,
    projectId: row.projectId,
    fileId: row.fileId,
    label: row.label,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
  };
}

export function createSnapshotService(db: Database) {
  async function assertCanWrite(projectId: string, userId: string) {
    const member = await db.query.projectMembers.findFirst({
      where: and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)),
    });
    if (!member) throw new ForbiddenError('Not a project member');
    if (member.role === 'viewer') throw new ForbiddenError('Viewers cannot create snapshots');
    return member;
  }

  async function assertMembership(projectId: string, userId: string) {
    const member = await db.query.projectMembers.findFirst({
      where: and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)),
    });
    if (!member) throw new ForbiddenError('Not a project member');
    return member;
  }

  return {
    async list(projectId: string, userId: string, fileId?: string): Promise<Snapshot[]> {
      await assertMembership(projectId, userId);
      const rows = await db.query.projectSnapshots.findMany({
        where: fileId
          ? and(eq(projectSnapshots.projectId, projectId), eq(projectSnapshots.fileId, fileId))
          : eq(projectSnapshots.projectId, projectId),
        orderBy: [desc(projectSnapshots.createdAt)],
      });
      return rows.map(serializeSnapshot);
    },

    async create(projectId: string, fileId: string, label: string | undefined, userId: string): Promise<Snapshot> {
      await assertCanWrite(projectId, userId);

      // Reconstruct current Yjs state from yjsUpdates (same logic as collab persistence.fetch)
      const documentName = `project:${projectId}:file:${fileId}`;
      const updateRows = await db.query.yjsUpdates.findMany({
        where: eq(yjsUpdates.documentName, documentName),
        orderBy: [yjsUpdates.id],
        columns: { update: true },
      });

      let yjsState: Buffer;
      if (updateRows.length === 0) {
        // No Yjs data yet — snapshot an empty doc
        const doc = new Y.Doc();
        yjsState = Buffer.from(Y.encodeStateAsUpdate(doc));
      } else {
        const merged = Y.mergeUpdates(updateRows.map((r) => new Uint8Array(r.update)));
        yjsState = Buffer.from(merged);
      }

      const [row] = await db
        .insert(projectSnapshots)
        .values({ projectId, fileId, label: label ?? null, createdBy: userId, yjsState })
        .returning();

      return serializeSnapshot(row!);
    },

    async getContent(projectId: string, snapshotId: string, userId: string): Promise<string> {
      await assertMembership(projectId, userId);

      const row = await db.query.projectSnapshots.findFirst({
        where: and(eq(projectSnapshots.id, snapshotId), eq(projectSnapshots.projectId, projectId)),
      });
      if (!row) throw new NotFoundError('Snapshot not found');

      const doc = new Y.Doc();
      Y.applyUpdate(doc, new Uint8Array(row.yjsState));
      return doc.getText('content').toString();
    },

    async remove(projectId: string, snapshotId: string, userId: string): Promise<void> {
      const member = await assertMembership(projectId, userId);
      if (member.role !== 'owner') throw new ForbiddenError('Only the owner can delete snapshots');

      const [deleted] = await db
        .delete(projectSnapshots)
        .where(and(eq(projectSnapshots.id, snapshotId), eq(projectSnapshots.projectId, projectId)))
        .returning();
      if (!deleted) throw new NotFoundError('Snapshot not found');
    },
  };
}
