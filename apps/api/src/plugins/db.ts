import fp from 'fastify-plugin';
import { createDb, type Database } from '@latex-ide/db';

declare module 'fastify' {
  interface FastifyInstance {
    db: Database;
  }
}

export default fp(async (fastify) => {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is required');
  }

  const { db, pool } = createDb(databaseUrl);
  fastify.decorate('db', db);

  fastify.addHook('onClose', async () => {
    await pool.end();
  });
});
