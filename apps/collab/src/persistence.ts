import * as Y from 'yjs';
import { eq } from 'drizzle-orm';
import { yjsUpdates, files } from '@latex-ide/db';
import type { Database } from '@latex-ide/db';
import { parseDocumentName } from './auth.js';

export function createPersistence(db: Database) {
  return {
    async fetch({ documentName }: { documentName: string }): Promise<Uint8Array | null> {
      const rows = await db.query.yjsUpdates.findMany({
        where: eq(yjsUpdates.documentName, documentName),
        orderBy: (t, { asc }) => [asc(t.id)],
      });

      if (rows.length > 0) {
        const updates = rows.map((r) => new Uint8Array(r.update));
        return Y.mergeUpdates(updates);
      }

      // No Yjs state yet — seed from the files.content column (Phase 2 migration)
      const { fileId } = parseDocumentName(documentName);
      const file = await db.query.files.findFirst({
        where: eq(files.id, fileId),
        columns: { content: true },
      });

      if (file?.content) {
        const doc = new Y.Doc();
        doc.getText('content').insert(0, file.content);
        const state = Y.encodeStateAsUpdate(doc);
        doc.destroy();

        await db.insert(yjsUpdates).values({
          documentName,
          update: Buffer.from(state),
        });

        return state;
      }

      return null;
    },

    async store({
      documentName,
      state,
    }: {
      documentName: string;
      state: Uint8Array;
    }): Promise<void> {
      // Persist the merged Yjs state
      await db.insert(yjsUpdates).values({
        documentName,
        update: Buffer.from(state),
      });

      // Write back to files.content as a cache for non-collab consumers
      const { fileId } = parseDocumentName(documentName);
      const doc = new Y.Doc();
      Y.applyUpdate(doc, state);
      const content = doc.getText('content').toString();
      doc.destroy();

      await db
        .update(files)
        .set({ content, updatedAt: new Date() })
        .where(eq(files.id, fileId));
    },
  };
}
