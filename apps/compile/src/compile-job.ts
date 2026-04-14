import { mkdtemp, rm, writeFile, readFile, mkdir, copyFile, access } from 'fs/promises';
import { tmpdir } from 'os';
import { join, dirname } from 'path';
import { eq } from 'drizzle-orm';
import { files } from '@latex-ide/db';
import type { Database } from '@latex-ide/db';
import type { CompileError, SyncTexData } from '@latex-ide/shared-types';
import { runContainer } from './docker-runner.js';
import { parseLatexLog } from './log-parser.js';
import { parseSyncTexFile } from './synctex-parser.js';

export interface CompileJobData {
  projectId: string;
  userId: string;
  rootFile: string;
}

export interface CompileJobResult {
  success: boolean;
  pdfUrl: string | null;
  errors: CompileError[];
  warnings: CompileError[];
  log: string;
  synctex: SyncTexData | null;
}

const COMPILE_OUTPUT_DIR = process.env.COMPILE_OUTPUT_DIR ?? './compile-output';
const COMPILE_TIMEOUT_MS = parseInt(process.env.COMPILE_TIMEOUT_MS ?? '60000', 10);
const TEXLIVE_IMAGE = process.env.TEXLIVE_IMAGE ?? 'latex-ide-texlive:2025';

export async function handleCompileJob(
  data: CompileJobData,
  jobId: string,
  db: Database,
): Promise<CompileJobResult> {
  const { projectId, rootFile } = data;
  const workDir = await mkdtemp(join(tmpdir(), `compile-${projectId}-`));

  try {
    // 1. Materialize project files from Postgres to disk
    const projectFiles = await db.query.files.findMany({
      where: eq(files.projectId, projectId),
      columns: { path: true, content: true, type: true },
    });

    for (const f of projectFiles) {
      if (f.type === 'image') continue;
      const filePath = join(workDir, f.path);
      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(filePath, f.content ?? '', 'utf-8');
    }

    // 2. Run latexmk in a sandboxed Docker container
    const result = await runContainer({
      workDir,
      rootFile,
      image: TEXLIVE_IMAGE,
      timeoutMs: COMPILE_TIMEOUT_MS,
    });

    // 3. Read and parse the log file
    const logName = rootFile.replace(/\.tex$/, '.log');
    const logPath = join(workDir, logName);
    const log = await readFile(logPath, 'utf-8').catch(() => result.stdout || '');
    const parsed = parseLatexLog(log);

    if (result.oom) {
      parsed.errors.push({
        file: rootFile,
        line: null,
        message: 'Compilation ran out of memory (2 GB limit exceeded)',
        level: 'error',
      });
    }

    if (result.timedOut) {
      parsed.errors.push({
        file: rootFile,
        line: null,
        message: `Compilation timed out after ${COMPILE_TIMEOUT_MS / 1000} seconds`,
        level: 'error',
      });
    }

    // 4. Copy PDF to output dir if it was produced
    let pdfUrl: string | null = null;
    const pdfName = rootFile.replace(/\.tex$/, '.pdf');
    const pdfSourcePath = join(workDir, pdfName);

    const pdfExists = await access(pdfSourcePath).then(() => true).catch(() => false);
    if (pdfExists) {
      const outputDir = join(COMPILE_OUTPUT_DIR, projectId, jobId);
      await mkdir(outputDir, { recursive: true });
      await copyFile(pdfSourcePath, join(outputDir, 'output.pdf'));
      pdfUrl = `/compiles/${jobId}/output.pdf?projectId=${projectId}`;
    }

    // 5. Parse SyncTeX data if available
    let synctex: SyncTexData | null = null;
    const synctexPath = join(workDir, rootFile.replace(/\.tex$/, '.synctex.gz'));
    const synctexExists = await access(synctexPath).then(() => true).catch(() => false);
    if (synctexExists) {
      try {
        synctex = await parseSyncTexFile(synctexPath);
      } catch {
        // SyncTeX parsing is best-effort
      }
    }

    const success = parsed.errors.length === 0 && pdfExists;

    return {
      success,
      pdfUrl,
      errors: parsed.errors,
      warnings: parsed.warnings,
      log,
      synctex,
    };
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}
