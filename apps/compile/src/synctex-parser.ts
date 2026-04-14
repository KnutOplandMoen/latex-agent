import { gunzipSync } from 'zlib';
import { readFile } from 'fs/promises';
import type { SyncTexData, SyncTexEntry } from '@latex-ide/shared-types';

/**
 * Parse a .synctex.gz file into structured forward/reverse lookup data.
 *
 * SyncTeX format reference: each record block starts with a type character:
 *   Input:N:filepath   — maps input number N to a file path
 *   {pageNum           — start of page
 *   }pageNum           — end of page
 *   h/v/w/H/x/k/g/$/[/] — content elements (hbox, vbox, glue, kern, etc.)
 *   Each element line has fields like h=X,v=Y,W=W,H=H
 *
 * We extract the "x" (current) records which carry (file, line, column, h, v)
 * and the hbox "[" records for bounding boxes.
 */
export async function parseSyncTexFile(syncTexPath: string): Promise<SyncTexData> {
  const compressed = await readFile(syncTexPath);
  const raw = gunzipSync(compressed).toString('utf-8');
  return parseSyncTexContent(raw);
}

export function parseSyncTexContent(content: string): SyncTexData {
  const pdfToSource: SyncTexEntry[] = [];
  const sourceToPdf: SyncTexEntry[] = [];

  const inputMap = new Map<number, string>();
  let currentPage = 0;

  const lines = content.split('\n');

  for (const line of lines) {
    // Input file mapping: "Input:1:./main.tex"
    if (line.startsWith('Input:')) {
      const parts = line.split(':');
      const num = parseInt(parts[1]!, 10);
      let filePath = parts.slice(2).join(':');
      if (filePath.startsWith('./')) filePath = filePath.slice(2);
      inputMap.set(num, filePath);
      continue;
    }

    // Page start: "{1" or "{ 1"
    if (line.startsWith('{')) {
      const pageStr = line.slice(1).trim();
      const page = parseInt(pageStr, 10);
      if (!isNaN(page)) currentPage = page;
      continue;
    }

    // Content records — lines starting with specific type chars followed by fields
    // Format: "x<input>:<line>:<col>:<h>:<v>..."  or  "[<input>:<line>:<col>:<h>:<v>:<W>:<H>:<D>"
    if (line.startsWith('x') || line.startsWith('[')) {
      const rest = line.slice(1);
      const fields = rest.split(/[,:]/);
      if (fields.length < 5) continue;

      const inputNum = parseInt(fields[0]!, 10);
      const lineNum = parseInt(fields[1]!, 10);
      const h = parseInt(fields[3]!, 10);
      const v = parseInt(fields[4]!, 10);

      if (isNaN(inputNum) || isNaN(lineNum) || isNaN(h) || isNaN(v)) continue;

      const file = inputMap.get(inputNum);
      if (!file) continue;

      const entry: SyncTexEntry = {
        page: currentPage,
        x: h,
        y: v,
        file,
        line: lineNum,
      };

      pdfToSource.push(entry);
      sourceToPdf.push(entry);
    }
  }

  return { pdfToSource, sourceToPdf };
}
