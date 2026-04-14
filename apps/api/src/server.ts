import { config } from 'dotenv';
config({ path: '../../.env' });

import Fastify from 'fastify';
import cors from '@fastify/cors';
import {
  serializerCompiler,
  validatorCompiler,
} from 'fastify-type-provider-zod';
import errorHandler from './plugins/error-handler.js';
import auth from './plugins/auth.js';
import dbPlugin from './plugins/db.js';
import projectsRoutes from './routes/projects/index.js';
import projectByIdRoutes from './routes/projects/_id.js';
import projectFilesRoutes from './routes/projects/files.js';
import fileByIdRoutes from './routes/files/_id.js';
import redisPlugin from './plugins/redis.js';
import compileQueuePlugin from './plugins/compile-queue.js';
import compileRoutes from './routes/projects/compile.js';
import compilesRoutes from './routes/compiles/index.js';

const PORT = parseInt(process.env.PORT ?? '3001', 10);
const HOST = process.env.HOST ?? '0.0.0.0';

async function start() {
  const fastify = Fastify({
    logger: {
      transport: {
        target: 'pino-pretty',
        options: { colorize: true },
      },
    },
  });

  fastify.setValidatorCompiler(validatorCompiler);
  fastify.setSerializerCompiler(serializerCompiler);

  const corsOrigin = process.env.CORS_ORIGIN ?? 'http://localhost:3000';
  await fastify.register(cors, {
    origin: corsOrigin === '*' ? true : corsOrigin.split(','),
  });
  await fastify.register(errorHandler);
  await fastify.register(dbPlugin);
  await fastify.register(redisPlugin);
  await fastify.register(compileQueuePlugin);
  await fastify.register(auth);

  fastify.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  await fastify.register(projectsRoutes, { prefix: '/projects' });
  await fastify.register(projectByIdRoutes, { prefix: '/projects' });
  await fastify.register(projectFilesRoutes, { prefix: '/projects' });
  await fastify.register(fileByIdRoutes, { prefix: '/files' });
  await fastify.register(compileRoutes, { prefix: '/projects' });
  await fastify.register(compilesRoutes, { prefix: '/compiles' });

  await fastify.listen({ port: PORT, host: HOST });
  fastify.log.info(`API server running on http://${HOST}:${PORT}`);
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
