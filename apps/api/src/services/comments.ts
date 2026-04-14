import { eq, and, isNull, desc } from 'drizzle-orm';
import { comments, projectMembers, users } from '@latex-ide/db';
import type { Database } from '@latex-ide/db';
import type { Comment } from '@latex-ide/shared-types';
import { ForbiddenError, NotFoundError } from '../lib/errors.js';

type CommentRow = {
  id: string;
  projectId: string;
  fileId: string;
  authorId: string;
  body: string;
  resolvedAt: Date | null;
  resolvedBy: string | null;
  yjsAnchor: string;
  parentId: string | null;
  createdAt: Date;
  updatedAt: Date;
  author: { name: string | null } | null;
};

function serializeComment(row: CommentRow, replies: CommentRow[] = []): Comment {
  return {
    id: row.id,
    projectId: row.projectId,
    fileId: row.fileId,
    authorId: row.authorId,
    authorName: row.author?.name ?? null,
    body: row.body,
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
    resolvedBy: row.resolvedBy,
    yjsAnchor: row.yjsAnchor,
    parentId: row.parentId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    replies: replies.map((r) => serializeComment(r)),
  };
}

export function createCommentService(db: Database) {
  async function assertMembership(projectId: string, userId: string) {
    const member = await db.query.projectMembers.findFirst({
      where: and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)),
    });
    if (!member) throw new ForbiddenError('Not a project member');
    return member;
  }

  async function assertCanWrite(projectId: string, userId: string) {
    const member = await assertMembership(projectId, userId);
    if (member.role === 'viewer') throw new ForbiddenError('Viewers cannot post comments');
    return member;
  }

  return {
    async list(projectId: string, userId: string, fileId: string, includeResolved: boolean): Promise<Comment[]> {
      await assertMembership(projectId, userId);

      const allRows = await db.query.comments.findMany({
        where: and(
          eq(comments.projectId, projectId),
          eq(comments.fileId, fileId),
          includeResolved ? undefined : isNull(comments.resolvedAt),
        ),
        with: { author: { columns: { name: true } } },
        orderBy: [desc(comments.createdAt)],
      });

      // Separate top-level from replies and nest them
      const topLevel = allRows.filter((r) => !r.parentId);
      const replies = allRows.filter((r) => r.parentId);

      return topLevel.map((top) =>
        serializeComment(top as CommentRow, replies.filter((r) => r.parentId === top.id) as CommentRow[]),
      );
    },

    async create(
      projectId: string,
      fileId: string,
      body: string,
      yjsAnchor: string,
      parentId: string | undefined,
      userId: string,
    ): Promise<Comment> {
      await assertCanWrite(projectId, userId);

      const [row] = await db
        .insert(comments)
        .values({ projectId, fileId, authorId: userId, body, yjsAnchor, parentId: parentId ?? null })
        .returning();

      const author = await db.query.users.findFirst({
        where: eq(users.id, userId),
        columns: { name: true },
      });

      return serializeComment({ ...row!, author: author ?? null });
    },

    async update(
      projectId: string,
      commentId: string,
      update: { body?: string; resolved?: boolean },
      userId: string,
    ): Promise<Comment> {
      const member = await assertMembership(projectId, userId);
      const existing = await db.query.comments.findFirst({
        where: and(eq(comments.id, commentId), eq(comments.projectId, projectId)),
        with: { author: { columns: { name: true } } },
      });
      if (!existing) throw new NotFoundError('Comment not found');

      // Only the author can edit the body; editors/owners can resolve
      if (update.body !== undefined && existing.authorId !== userId) {
        throw new ForbiddenError('Only the author can edit a comment');
      }
      if (update.resolved !== undefined && member.role === 'viewer') {
        throw new ForbiddenError('Viewers cannot resolve comments');
      }

      const setValues: Partial<{ body: string; resolvedAt: Date | null; resolvedBy: string | null; updatedAt: Date }> = {
        updatedAt: new Date(),
      };
      if (update.body !== undefined) setValues.body = update.body;
      if (update.resolved === true) {
        setValues.resolvedAt = new Date();
        setValues.resolvedBy = userId;
      }
      if (update.resolved === false) {
        setValues.resolvedAt = null;
        setValues.resolvedBy = null;
      }

      const [updated] = await db
        .update(comments)
        .set(setValues)
        .where(and(eq(comments.id, commentId), eq(comments.projectId, projectId)))
        .returning();

      return serializeComment({ ...updated!, author: (existing as CommentRow).author });
    },

    async remove(projectId: string, commentId: string, userId: string): Promise<void> {
      const member = await assertMembership(projectId, userId);
      const existing = await db.query.comments.findFirst({
        where: and(eq(comments.id, commentId), eq(comments.projectId, projectId)),
      });
      if (!existing) throw new NotFoundError('Comment not found');
      if (existing.authorId !== userId && member.role !== 'owner') {
        throw new ForbiddenError('Only the author or owner can delete a comment');
      }
      await db
        .delete(comments)
        .where(and(eq(comments.id, commentId), eq(comments.projectId, projectId)));
    },
  };
}
