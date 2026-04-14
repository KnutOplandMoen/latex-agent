import { eq, and } from 'drizzle-orm';
import { projectMembers, users, projectInvites } from '@latex-ide/db';
import type { Database } from '@latex-ide/db';
import type { ProjectMemberWithUser, Invite } from '@latex-ide/shared-types';
import { ForbiddenError, NotFoundError, ValidationError } from '../lib/errors.js';
import { randomBytes } from 'node:crypto';

function serializeMember(row: {
  projectId: string;
  userId: string;
  role: string;
  addedAt: Date;
  user: { email: string; name: string | null } | null;
}): ProjectMemberWithUser {
  return {
    projectId: row.projectId,
    userId: row.userId,
    role: row.role as 'owner' | 'editor' | 'viewer',
    addedAt: row.addedAt.toISOString(),
    email: row.user?.email ?? null,
    name: row.user?.name ?? null,
  };
}

function serializeInvite(row: {
  id: string;
  projectId: string;
  invitedBy: string;
  email: string;
  role: string;
  token: string;
  acceptedAt: Date | null;
  expiresAt: Date;
  createdAt: Date;
}): Invite {
  return {
    id: row.id,
    projectId: row.projectId,
    invitedBy: row.invitedBy,
    email: row.email,
    role: row.role as 'editor' | 'viewer',
    token: row.token,
    acceptedAt: row.acceptedAt?.toISOString() ?? null,
    expiresAt: row.expiresAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
  };
}

export function createMemberService(db: Database) {
  async function assertOwner(projectId: string, userId: string) {
    const member = await db.query.projectMembers.findFirst({
      where: and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)),
    });
    if (!member) throw new ForbiddenError('Not a project member');
    if (member.role !== 'owner') throw new ForbiddenError('Only the owner can manage members');
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
    async listMembers(projectId: string, userId: string): Promise<ProjectMemberWithUser[]> {
      await assertMembership(projectId, userId);
      const rows = await db.query.projectMembers.findMany({
        where: eq(projectMembers.projectId, projectId),
        with: { user: true },
      });
      return rows.map(serializeMember);
    },

    async updateRole(projectId: string, targetUserId: string, role: 'editor' | 'viewer', requesterId: string): Promise<ProjectMemberWithUser> {
      await assertOwner(projectId, requesterId);
      if (targetUserId === requesterId) throw new ValidationError('Cannot change your own role');

      const target = await db.query.projectMembers.findFirst({
        where: and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, targetUserId)),
        with: { user: true },
      });
      if (!target) throw new NotFoundError('Member not found');
      if (target.role === 'owner') throw new ForbiddenError('Cannot change owner role');

      await db
        .update(projectMembers)
        .set({ role })
        .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, targetUserId)));

      return serializeMember({ ...target, role });
    },

    async removeMember(projectId: string, targetUserId: string, requesterId: string): Promise<void> {
      const requester = await assertMembership(projectId, requesterId);
      // Members can remove themselves; owners can remove anyone (except themselves)
      if (targetUserId !== requesterId && requester.role !== 'owner') {
        throw new ForbiddenError('Only the owner can remove other members');
      }
      if (targetUserId === requesterId && requester.role === 'owner') {
        throw new ValidationError('Owners cannot leave their own project. Transfer ownership first.');
      }

      const [removed] = await db
        .delete(projectMembers)
        .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, targetUserId)))
        .returning();
      if (!removed) throw new NotFoundError('Member not found');
    },

    async createInvite(projectId: string, email: string, role: 'editor' | 'viewer', requesterId: string): Promise<Invite> {
      await assertOwner(projectId, requesterId);

      const token = randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      const [invite] = await db
        .insert(projectInvites)
        .values({ projectId, invitedBy: requesterId, email, role, token, expiresAt })
        .returning();

      return serializeInvite(invite!);
    },

    async listInvites(projectId: string, requesterId: string): Promise<Invite[]> {
      await assertOwner(projectId, requesterId);
      const rows = await db.query.projectInvites.findMany({
        where: eq(projectInvites.projectId, projectId),
      });
      return rows.map(serializeInvite);
    },

    async cancelInvite(projectId: string, inviteId: string, requesterId: string): Promise<void> {
      await assertOwner(projectId, requesterId);
      const [deleted] = await db
        .delete(projectInvites)
        .where(and(eq(projectInvites.id, inviteId), eq(projectInvites.projectId, projectId)))
        .returning();
      if (!deleted) throw new NotFoundError('Invite not found');
    },

    async acceptInvite(token: string, userId: string, userEmail: string): Promise<{ projectId: string }> {
      return db.transaction(async (tx) => {
        const invite = await tx.query.projectInvites.findFirst({
          where: eq(projectInvites.token, token),
        });

        if (!invite) throw new NotFoundError('Invite not found');
        if (invite.acceptedAt) throw new ValidationError('Invite already accepted');
        if (invite.expiresAt < new Date()) throw new ValidationError('Invite has expired');

        // Check if already a member
        const existing = await tx.query.projectMembers.findFirst({
          where: and(eq(projectMembers.projectId, invite.projectId), eq(projectMembers.userId, userId)),
        });
        if (existing) {
          // Already a member — just mark invite accepted and return
          await tx
            .update(projectInvites)
            .set({ acceptedAt: new Date() })
            .where(eq(projectInvites.id, invite.id));
          return { projectId: invite.projectId };
        }

        await tx.insert(projectMembers).values({
          projectId: invite.projectId,
          userId,
          role: invite.role,
        });

        await tx
          .update(projectInvites)
          .set({ acceptedAt: new Date() })
          .where(eq(projectInvites.id, invite.id));

        return { projectId: invite.projectId };
      });
    },
  };
}
