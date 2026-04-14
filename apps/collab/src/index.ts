import { config } from 'dotenv';
config({ path: '../../.env' });

import { Server } from '@hocuspocus/server';
import { Database } from '@hocuspocus/extension-database';
import { createDb } from '@latex-ide/db';
import { createAuthHandler, type AuthResult } from './auth.js';
import { createPersistence } from './persistence.js';

const PORT = parseInt(process.env.COLLAB_PORT ?? '3030', 10);
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('DATABASE_URL environment variable is required');
  process.exit(1);
}

const { db, pool } = createDb(databaseUrl);
const authenticate = createAuthHandler(db, process.env.CLERK_SECRET_KEY);
const persistence = createPersistence(db);

const server = Server.configure({
  port: PORT,

  async onAuthenticate(data) {
    const result: AuthResult = await authenticate({
      token: data.token,
      documentName: data.documentName,
    });

    data.connection.readOnly = result.role === 'viewer';

    return {
      user: result.user,
      role: result.role,
    };
  },

  extensions: [
    new Database({
      fetch: persistence.fetch,
      store: persistence.store,
    }),
  ],
});

server.listen();

console.log(`Collab server running on port ${PORT}`);

function shutdown() {
  console.log('Shutting down collab server...');
  server.destroy().then(() => {
    pool.end().then(() => process.exit(0));
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
