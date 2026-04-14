import fp from 'fastify-plugin';
import { verifyToken } from '@clerk/backend';

declare module 'fastify' {
  interface FastifyRequest {
    user: { id: string; email: string };
  }
}

const DEV_MODE = !process.env.CLERK_SECRET_KEY;

export default fp(async (fastify) => {
  if (DEV_MODE) {
    fastify.log.warn('CLERK_SECRET_KEY not set — running with dev auth bypass');
  }

  fastify.addHook('onRequest', async (req, reply) => {
    if (req.url.startsWith('/webhooks/') || req.url === '/health') return;

    if (DEV_MODE) {
      req.user = { id: 'dev_user', email: 'dev@localhost' };
      return;
    }

    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      reply.code(401).send({ error: 'UNAUTHORIZED', message: 'Missing authorization token' });
      return;
    }

    try {
      const payload = await verifyToken(token, {
        secretKey: process.env.CLERK_SECRET_KEY!,
      });
      req.user = {
        id: payload.sub,
        email: (payload as Record<string, unknown>).email as string ?? '',
      };
    } catch {
      reply.code(401).send({ error: 'UNAUTHORIZED', message: 'Invalid token' });
    }
  });
});
