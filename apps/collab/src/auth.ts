import { verifyToken } from '@clerk/backend';
import { eq, and } from 'drizzle-orm';
import { projectMembers, users } from '@latex-ide/db';
import type { Database } from '@latex-ide/db';

export interface CollabUser {
  id: string;
  email: string;
  name: string | null;
}

export interface AuthResult {
  user: CollabUser;
  role: 'owner' | 'editor' | 'viewer';
}

const DEV_USER: CollabUser = { id: 'dev_user', email: 'dev@localhost', name: 'Dev User' };

export function parseDocumentName(name: string): { projectId: string; fileId: string } {
  const parts = name.split(':');
  if (parts.length !== 4 || parts[0] !== 'project' || parts[2] !== 'file') {
    throw new Error(`Invalid document name format: ${name}`);
  }
  return { projectId: parts[1]!, fileId: parts[3]! };
}

export function createAuthHandler(db: Database, clerkSecretKey: string | undefined) {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!clerkSecretKey && isProduction) {
    throw new Error('CLERK_SECRET_KEY is required in production');
  }

  const devMode = !clerkSecretKey && !isProduction;

  return async function onAuthenticate({
    token,
    documentName,
  }: {
    token: string;
    documentName: string;
  }): Promise<AuthResult> {
    const { projectId } = parseDocumentName(documentName);

    if (devMode) {
      return { user: DEV_USER, role: 'owner' };
    }

    if (!token) {
      throw new Error('Missing authentication token');
    }

    const payload = await verifyToken(token, { secretKey: clerkSecretKey! });
    const id = payload.sub;
    const email = ((payload as Record<string, unknown>).email as string) ?? '';

    await db
      .insert(users)
      .values({ id, email })
      .onConflictDoNothing({ target: users.id });

    const userRow = await db.query.users.findFirst({
      where: eq(users.id, id),
    });

    const member = await db.query.projectMembers.findFirst({
      where: and(
        eq(projectMembers.projectId, projectId),
        eq(projectMembers.userId, id),
      ),
    });

    if (!member) {
      throw new Error('Not a project member');
    }

    return {
      user: { id, email, name: userRow?.name ?? null },
      role: member.role as AuthResult['role'],
    };
  };
}
