import { eq } from 'drizzle-orm';
import { projectTemplates, projects, projectMembers, files } from '@latex-ide/db';
import type { Database } from '@latex-ide/db';
import type { Template, TemplateFile } from '@latex-ide/shared-types';
import { NotFoundError } from '../lib/errors.js';

function serializeTemplate(row: {
  id: string;
  name: string;
  description: string;
  category: string;
  thumbnail: string | null;
  createdAt: Date;
}): Template {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    category: row.category as Template['category'],
    thumbnail: row.thumbnail,
    createdAt: row.createdAt.toISOString(),
  };
}

export function createTemplateService(db: Database) {
  return {
    async list(): Promise<Template[]> {
      const rows = await db.query.projectTemplates.findMany({
        columns: { id: true, name: true, description: true, category: true, thumbnail: true, createdAt: true },
      });
      return rows.map(serializeTemplate);
    },

    async cloneToProject(templateId: string, name: string, userId: string): Promise<{ projectId: string }> {
      const template = await db.query.projectTemplates.findFirst({
        where: eq(projectTemplates.id, templateId),
      });
      if (!template) throw new NotFoundError('Template not found');

      const templateFiles = template.files as TemplateFile[];

      return db.transaction(async (tx) => {
        const [project] = await tx
          .insert(projects)
          .values({ name, ownerId: userId })
          .returning();

        await tx.insert(projectMembers).values({
          projectId: project!.id,
          userId,
          role: 'owner',
        });

        for (const f of templateFiles) {
          const ext = f.path.split('.').pop()?.toLowerCase();
          const type = ext === 'tex' ? 'tex' : ext === 'bib' ? 'bib' : 'other';
          await tx.insert(files).values({
            projectId: project!.id,
            path: f.path,
            type: type as 'tex' | 'bib' | 'other',
            content: f.content,
          });
        }

        return { projectId: project!.id };
      });
    },
  };
}
