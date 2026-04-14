# LaTeX compilation

Compiling user-provided LaTeX is a security-critical operation. LaTeX can execute shell commands (`\write18`), read arbitrary files, and run forever. Every compile happens inside a locked-down Docker container.

## The flow

```
user clicks Compile (or auto-save fires)
  ↓
POST /projects/:id/compile  →  enqueues BullMQ job
  ↓
compile worker picks up job
  ↓
extract files from Yjs docs → write to /tmp/job-{id} on local SSD
  ↓
docker run --rm --network none --memory 2g --cpus 1 ... texlive ...
  ↓
parse log, upload PDF to R2, return result
  ↓
frontend receives result via SSE / WebSocket
```

## Sandboxing — non-negotiable rules

Every `docker run` for a compile job MUST include:

```bash
docker run --rm \
  --network none \                  # no internet, no metadata service
  --memory 2g \                     # OOM kill if exceeded
  --memory-swap 2g \                # no swap fallback
  --cpus 1 \                        # one CPU max
  --pids-limit 256 \                # no fork bombs
  --read-only \                     # rootfs is read-only
  --tmpfs /tmp:size=512m \          # writable scratch in tmpfs only
  --cap-drop ALL \                  # drop all Linux capabilities
  --security-opt no-new-privileges \
  --user 1000:1000 \                # non-root inside container
  -v /tmp/job-${jobId}:/workspace \ # bind mount the compile dir
  -w /workspace \
  latex-ide-texlive:2025 \
  latexmk -pdf -interaction=nonstopmode -file-line-error -no-shell-escape main.tex
```

Critical: `-no-shell-escape` disables `\write18`. Without it, a malicious `.tex` can run arbitrary shell commands inside the container.

## The compile worker

```ts
// apps/compile/src/worker.ts
import { Worker } from 'bullmq';
import Docker from 'dockerode';
import { mkdtemp, rm, writeFile, readFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

const docker = new Docker();
const COMPILE_TIMEOUT_MS = 60_000;

new Worker('compile', async (job) => {
  const { projectId, rootFile } = job.data;
  const workDir = await mkdtemp(join(tmpdir(), `compile-${projectId}-`));

  try {
    // 1. Materialize all project files from Yjs to disk
    const files = await loadProjectFilesFromYjs(projectId);
    for (const f of files) {
      await writeFile(join(workDir, f.path), f.content);
    }

    // 2. Run TeX Live in a sandboxed container
    const result = await runContainer(workDir, rootFile);

    // 3. Parse log
    const log = await readFile(join(workDir, rootFile.replace('.tex', '.log')), 'utf-8').catch(() => '');
    const errors = parseLatexLog(log);

    // 4. Upload PDF if present
    let pdfUrl: string | null = null;
    const pdfPath = join(workDir, rootFile.replace('.tex', '.pdf'));
    if (await exists(pdfPath)) {
      pdfUrl = await uploadToR2(pdfPath, `compiles/${projectId}/${job.id}.pdf`);
    }

    return { success: errors.fatal.length === 0, pdfUrl, errors, log };
  } finally {
    // ALWAYS clean up the temp dir
    await rm(workDir, { recursive: true, force: true });
  }
}, { concurrency: 4, connection: redisConnection });
```

## File system rules

- **Local SSD only.** Never use NFS, EBS gp2, or any networked storage for the compile work directory. Overleaf's docs explicitly warn this causes "unexpected compile errors and other performance issues."
- Working directory under `/tmp` (which should be a tmpfs or local SSD partition).
- **Always clean up** the temp dir in a `finally` block. A crashed worker should not leak gigabytes of `.aux` files.

## Caching the auxiliary files

To make incremental compiles fast, persist `.aux`, `.bbl`, `.toc`, `.synctex.gz` between compile runs:

```ts
// Before compile: restore cached aux files
await restoreAuxCache(projectId, workDir);

// After compile: save them back
await saveAuxCache(projectId, workDir);
```

Cache key: `aux:${projectId}:${rootFile}`. Store as a tarball in R2. Invalidate on:
- User clicks "Recompile from scratch"
- The set of input files changes structurally (file added/removed)
- More than 7 days old

## Parsing the log

LaTeX logs are an unstructured nightmare. Use a battle-tested parser:

```ts
import { parseLog } from 'latex-log-parser'; // ships with Overleaf, MIT licensed

const parsed = parseLog(logContent);
// parsed.errors: { line, file, message, level }[]
// parsed.warnings: same shape
```

Map errors to CodeMirror diagnostics for inline display in the editor.

## SyncTeX

Compile with `latexmk -synctex=1`. The output `.synctex.gz` enables source ↔ PDF jumping.

```ts
import { parseSyncTeX } from 'synctex.js';

// PDF click → source line
const source = parseSyncTeX(syncTexContent).pdfToSource(page, x, y);
// → { file: 'main.tex', line: 142 }
```

Send the parsed SyncTeX data to the frontend along with the PDF.

## Errors and timeouts

- **Compile timeout:** 60 seconds default, 120 seconds for paid users. Kill the container with `container.stop({ t: 0 })` if exceeded.
- **OOM:** caught by Docker; the worker sees a non-zero exit. Report as "out of memory."
- **No PDF produced:** fatal compile error. Report the parsed log errors.
- **Worker crash mid-compile:** BullMQ retries with `attempts: 2`. Always idempotent — the workdir is unique per attempt.

## Two-engine option

Offer the user a choice in project settings:

- **TeX Live (default)** — full-featured, slow, 2.3 GB image. Use for final compiles.
- **Tectonic** — XeTeX only, fast, 120 MB image, fetches packages on demand. Use for live preview.

Both go through the same worker; just a different image and command.

## Anti-patterns

- ❌ Running `latexmk` directly on the host (no Docker). One `\write18` and your server is owned.
- ❌ Removing `--network none`. The compile container does not need internet.
- ❌ Mounting the workdir from a slow/networked disk.
- ❌ Sharing one container across multiple compiles. One container per job, always.
- ❌ Forgetting `-no-shell-escape`. This is the #1 LaTeX security issue.
- ❌ Logging the entire log file to your application logs. Logs can be megabytes — store on disk, link from the API response.
- ❌ Running the worker as root inside the container. Use a non-root user.
