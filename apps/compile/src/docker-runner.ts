import Docker from 'dockerode';

const docker = new Docker();

export interface RunContainerOptions {
  workDir: string;
  rootFile: string;
  image: string;
  timeoutMs: number;
}

export interface ContainerResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  oom: boolean;
}

/**
 * Run latexmk inside a sandboxed Docker container.
 *
 * Security flags follow .cursor/rules/30-latex-compilation.mdc:
 * --network none, --memory 2g, --cpus 1, --pids-limit 256, --read-only,
 * --cap-drop ALL, --security-opt no-new-privileges, --user 1000:1000,
 * -no-shell-escape
 */
export async function runContainer(opts: RunContainerOptions): Promise<ContainerResult> {
  const { workDir, rootFile, image, timeoutMs } = opts;

  const container = await docker.createContainer({
    Image: image,
    Cmd: [
      '-pdf',
      '-interaction=nonstopmode',
      '-file-line-error',
      '-no-shell-escape',
      '-synctex=1',
      rootFile,
    ],
    HostConfig: {
      Binds: [`${workDir}:/workspace`],
      NetworkMode: 'none',
      Memory: 2 * 1024 * 1024 * 1024,
      MemorySwap: 2 * 1024 * 1024 * 1024,
      NanoCpus: 1_000_000_000,
      PidsLimit: 256,
      ReadonlyRootfs: true,
      Tmpfs: { '/tmp': 'size=512m' },
      CapDrop: ['ALL'],
      SecurityOpt: ['no-new-privileges'],
    },
    User: '1000:1000',
    WorkingDir: '/workspace',
  });

  let timedOut = false;
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

  try {
    await container.start();

    const waitPromise = container.wait();
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(async () => {
        timedOut = true;
        try {
          await container.stop({ t: 0 });
        } catch {
          // Container may have already exited
        }
        reject(new Error('Compile timed out'));
      }, timeoutMs);
    });

    const result = await Promise.race([waitPromise, timeoutPromise]);
    if (timeoutHandle) clearTimeout(timeoutHandle);

    const logs = await container.logs({ stdout: true, stderr: true, follow: false });
    const logStr = demuxDockerStream(logs as unknown as Buffer);

    const oom = (result as { StatusCode: number }).StatusCode === 137;

    return {
      exitCode: (result as { StatusCode: number }).StatusCode,
      stdout: logStr,
      stderr: '',
      timedOut,
      oom,
    };
  } catch (err) {
    if (timeoutHandle) clearTimeout(timeoutHandle);
    if (timedOut) {
      return { exitCode: -1, stdout: '', stderr: 'Compile timed out', timedOut: true, oom: false };
    }
    throw err;
  } finally {
    try {
      await container.remove({ force: true });
    } catch {
      // Best-effort cleanup
    }
  }
}

/**
 * Docker stream multiplexing: the logs buffer contains 8-byte headers per frame.
 * header[0] = stream type (1=stdout, 2=stderr), header[4..7] = payload length (big-endian).
 */
function demuxDockerStream(buffer: Buffer): string {
  const chunks: string[] = [];
  let offset = 0;
  while (offset + 8 <= buffer.length) {
    const size = buffer.readUInt32BE(offset + 4);
    if (offset + 8 + size > buffer.length) break;
    chunks.push(buffer.subarray(offset + 8, offset + 8 + size).toString('utf-8'));
    offset += 8 + size;
  }
  // If no header frames found, the buffer might just be a plain string
  if (chunks.length === 0 && buffer.length > 0) {
    return buffer.toString('utf-8');
  }
  return chunks.join('');
}
