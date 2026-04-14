import fp from 'fastify-plugin';
import { Queue } from 'bullmq';

declare module 'fastify' {
  interface FastifyInstance {
    compileQueue: Queue;
  }
}

export default fp(async (fastify) => {
  const queue = new Queue('compile', { connection: fastify.redis });

  fastify.decorate('compileQueue', queue);

  fastify.addHook('onClose', async () => {
    await queue.close();
  });
});
