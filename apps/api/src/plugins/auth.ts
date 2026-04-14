import fp from 'fastify-plugin';

declare module 'fastify' {
  interface FastifyRequest {
    user: { id: string; email: string };
  }
}

export default fp(async (fastify) => {
  fastify.addHook('onRequest', async (req, reply) => {
    if (req.url.startsWith('/webhooks/') || req.url === '/health') return;

    // TODO: Replace with real Clerk JWT verification in Phase 2
    // For now, allow all requests with a stub user for development
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      req.user = { id: 'dev_user', email: 'dev@localhost' };
      return;
    }

    req.user = { id: 'dev_user', email: 'dev@localhost' };
  });
});
