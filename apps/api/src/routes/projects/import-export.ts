import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import archiver from 'archiver';
import unzipper from 'unzipper';
import path from 'node:path';
import { eq, and } from 'drizzle-orm';
import { projects, projectMembers, files } from '@latex-ide/db';
import { ForbiddenError } from '../../lib/errors.js';

const MAX_FILE_BYTES = 2 * 1024 * 1024; // 2 MB

function detectFileType(filePath: string): 'tex' | 'bib' | 'image' | 'other' {
  const ext = filePath.split('.').pop()?.toLowerCase();
  if (ext === 'tex' || ext === 'sty' || ext === 'cls' || ext === 'ltx') return 'tex';
  if (ext === 'bib') return 'bib';
  if (['png', 'jpg', 'jpeg', 'pdf', 'eps', 'svg', 'gif'].includes(ext ?? '')) return 'image';
  return 'other';
}

function isTextFile(type: string): boolean {
  return type === 'tex' || type === 'bib' || type === 'other';
}

const importExportRoutes: FastifyPluginAsyncZod = async (fastify) => {
  // Export project as ZIP
  fastify.get('/:id/export', {
    schema: {
      params: z.object({ id: z.string().uuid() }),
    },
    handler: async (req, reply) => {
      const { id } = req.params;

      // Check membership
      const member = await fastify.db.query.projectMembers.findFirst({
        where: and(eq(projectMembers.projectId, id), eq(projectMembers.userId, req.user.id)),
      });
      if (!member) throw new ForbiddenError('Not a project member');

      const project = await fastify.db.query.projects.findFirst({ where: eq(projects.id, id) });
      const projectFiles = await fastify.db.query.files.findMany({
        where: and(eq(files.projectId, id)),
      });

      const safeName = (project?.name ?? 'project').replace(/[^a-z0-9_-]/gi, '_');

      reply.header('Content-Type', 'application/zip');
      reply.header('Content-Disposition', `attachment; filename="${safeName}.zip"`);

      const archive = archiver('zip', { zlib: { level: 6 } });
      archive.on('error', (err) => { throw err; });

      // We need to pipe the archive to the reply's raw stream
      archive.pipe(reply.raw);

      for (const file of projectFiles) {
        if (file.content != null) {
          archive.append(file.content, { name: file.path });
        }
      }

      await archive.finalize();
    },
  });

  // Import ZIP as new project
  fastify.post('/import', {
    schema: {
      // multipart — validation handled manually since fastify-type-provider-zod doesn't support multipart directly
    },
    handler: async (req, reply) => {
      const data = await req.file();
      if (!data) {
        reply.code(400).send({ error: 'VALIDATION_ERROR', message: 'No file uploaded' });
        return;
      }

      const nameField = (req.body as Record<string, { value: string } | undefined>)['name'];
      const projectName = nameField?.value?.trim() || 'Imported Project';

      const skipped: string[] = [];
      const filesToInsert: { path: string; type: 'tex' | 'bib' | 'image' | 'other'; content: string | null }[] = [];

      // Parse ZIP from stream
      const directory = data.file.pipe(unzipper.Parse({ forceStream: true }));

      for await (const entry of directory) {
        const e = entry as unzipper.Entry;
        const rawPath: string = (e as { path: string }).path;

        // Normalize and sanitize path
        const normalizedPath = path.posix.normalize(rawPath);
        if (normalizedPath.startsWith('..') || path.isAbsolute(normalizedPath)) {
          skipped.push(rawPath);
          e.autodrain();
          continue;
        }

        const type = detectFileType(normalizedPath);

        if (!isTextFile(type)) {
          skipped.push(rawPath);
          e.autodrain();
          continue;
        }

        // Read content with size limit
        const chunks: Buffer[] = [];
        let totalBytes = 0;
        let tooLarge = false;

        for await (const chunk of e) {
          totalBytes += (chunk as Buffer).length;
          if (totalBytes > MAX_FILE_BYTES) {
            tooLarge = true;
            break;
          }
          chunks.push(chunk as Buffer);
        }

        if (tooLarge) {
          skipped.push(rawPath);
          continue;
        }

        const content = Buffer.concat(chunks).toString('utf-8');
        filesToInsert.push({ path: normalizedPath, type, content });
      }

      if (filesToInsert.length === 0) {
        reply.code(400).send({ error: 'VALIDATION_ERROR', message: 'No valid text files found in ZIP' });
        return;
      }

      const result = await fastify.db.transaction(async (tx) => {
        const [project] = await tx
          .insert(projects)
          .values({ name: projectName, ownerId: req.user.id })
          .returning();

        await tx.insert(projectMembers).values({
          projectId: project!.id,
          userId: req.user.id,
          role: 'owner',
        });

        for (const f of filesToInsert) {
          await tx.insert(files).values({
            projectId: project!.id,
            path: f.path,
            type: f.type,
            content: f.content,
          });
        }

        return { projectId: project!.id };
      });

      reply.code(201).send({ ...result, skipped });
    },
  });
};

export default importExportRoutes;
