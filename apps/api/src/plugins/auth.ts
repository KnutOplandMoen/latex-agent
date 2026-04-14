import fp from 'fastify-plugin';
import { verifyToken } from '@clerk/backend';
import { users } from '@latex-ide/db';

declare module 'fastify' {
  interface FastifyRequest {
    user: { id: string; email: string };
  }
}

export default fp(async (fastify) => {
  const clerkSecret = process.env.CLERK_SECRET_KEY;
  const isProduction = process.env.NODE_ENV === 'production';

  if (!clerkSecret && isProduction) {
    throw new Error('CLERK_SECRET_KEY is required in production');
  }

  const devMode = !clerkSecret && !isProduction;

  if (devMode) {
    fastify.log.warn('CLERK_SECRET_KEY not set — running with dev auth bypass');
  }

  fastify.addHook('onRequest', async (req, reply) => {
    const pathname = req.url.split('?')[0];
    if (pathname === '/health' || req.url.startsWith('/webhooks/')) return;

    if (devMode) {
      req.user = { id: 'dev_user', email: 'dev@localhost' };
      return;
    }

    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      reply.code(401).send({ error: 'UNAUTHORIZED', message: 'Missing authorization token' });
      return reply;
    }

    try {
      const payload = await verifyToken(token, {
        secretKey: clerkSecret!,
      });
      const id = payload.sub;
      const email = (payload as Record<string, unknown>).email as string ?? '';

      req.user = { id, email };

      await fastify.db
        .insert(users)
        .values({ id, email })
        .onConflictDoNothing({ target: users.id });
    } catch {
      reply.code(401).send({ error: 'UNAUTHORIZED', message: 'Invalid token' });
      return reply;
    }
  });
});
