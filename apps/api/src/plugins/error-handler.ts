import fp from 'fastify-plugin';
import { AppError } from '../lib/errors.js';

export default fp(async (fastify) => {
  fastify.setErrorHandler((error: Error, req, reply) => {
    if (error instanceof AppError) {
      reply.code(error.statusCode).send({ error: error.code, message: error.message });
      return;
    }

    const fastifyError = error as Error & { validation?: unknown };
    if (fastifyError.validation) {
      reply.code(400).send({ error: 'VALIDATION_ERROR', details: fastifyError.validation });
      return;
    }

    req.log.error(error);
    reply.code(500).send({ error: 'INTERNAL_ERROR' });
  });
});
