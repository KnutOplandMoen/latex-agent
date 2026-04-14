/**
 * Copies pdfjs-dist's worker into public/ so GlobalWorkerOptions.workerSrc
 * can point at a stable URL (avoids broken new URL(..., import.meta.url) under Next).
 */
import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const pdfPkg = require.resolve('pdfjs-dist/package.json');
const workerSrc = join(dirname(pdfPkg), 'build', 'pdf.worker.mjs');
const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const destDir = join(rootDir, 'public');
const destFile = join(destDir, 'pdf.worker.mjs');

mkdirSync(destDir, { recursive: true });
copyFileSync(workerSrc, destFile);
