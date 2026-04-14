import { createReadStream } from 'fs';
import { access } from 'fs/promises';
import { join, resolve, isAbsolute, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';

// Resolve compile output dir relative to the monorepo root so it works regardless of CWD.
// __dirname here = apps/api/src/routes/compiles/ → five levels up = monorepo root
const MONOREPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../..');
const rawDir = process.env.COMPILE_OUTPUT_DIR ?? 'apps/compile/compile-output';
const COMPILE_OUTPUT_DIR = isAbsolute(rawDir) ? rawDir : resolve(MONOREPO_ROOT, rawDir);

const compilesRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.get('/:jobId/output.pdf', {
    schema: {
      params: z.object({ jobId: z.string() }),
      querystring: z.object({ projectId: z.string().uuid() }),
    },
    handler: async (req, reply) => {
      const { jobId } = req.params;
      const { projectId } = req.query;

      const pdfPath = join(COMPILE_OUTPUT_DIR, projectId, jobId, 'output.pdf');
      const exists = await access(pdfPath).then(() => true).catch(() => false);
      if (!exists) {
        reply.code(404).send({ error: 'NOT_FOUND', message: 'PDF not found' });
        return;
      }

      reply.type('application/pdf');
      return reply.send(createReadStream(pdfPath));
    },
  });
};

export default compilesRoutes;
