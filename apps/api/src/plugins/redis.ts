import fp from 'fastify-plugin';
import IORedis from 'ioredis';

declare module 'fastify' {
  interface FastifyInstance {
    redis: IORedis;
  }
}

export default fp(async (fastify) => {
  const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';
  const redis = new IORedis(redisUrl, { maxRetriesPerRequest: null });

  fastify.decorate('redis', redis);

  fastify.addHook('onClose', async () => {
    await redis.quit();
  });
});
