import fp from 'fastify-plugin';
import { AppError } from '../lib/errors.js';

export default fp(async (fastify) => {
  fastify.setErrorHandler((error, req, reply) => {
    if (error instanceof AppError) {
      reply.code(error.statusCode).send({ error: error.code, message: error.message });
      return;
    }

    if (error.validation) {
      reply.code(400).send({ error: 'VALIDATION_ERROR', details: error.validation });
      return;
    }

    req.log.error(error);
    reply.code(500).send({ error: 'INTERNAL_ERROR' });
  });
});
