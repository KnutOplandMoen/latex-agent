'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import type { CompileError, SyncTexData } from '@latex-ide/shared-types';
import type { ApiClient } from '@/lib/api';

export type CompilePhase = 'idle' | 'compiling' | 'completed' | 'failed';

export interface CompileState {
  phase: CompilePhase;
  pdfUrl: string | null;
  errors: CompileError[];
  warnings: CompileError[];
  log: string | null;
  synctex: SyncTexData | null;
  isCompiling: boolean;
  compile: () => void;
}

const POLL_INTERVAL_MS = 1000;
const MAX_POLLS = 120;

export function useCompile(projectId: string, api: ApiClient, initialJobId?: string | null): CompileState {
  const [phase, setPhase] = useState<CompilePhase>('idle');
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [errors, setErrors] = useState<CompileError[]>([]);
  const [warnings, setWarnings] = useState<CompileError[]>([]);
  const [log, setLog] = useState<string | null>(null);
  const [synctex, setSynctex] = useState<SyncTexData | null>(null);
  const pollingRef = useRef(false);
  const prevBlobUrl = useRef<string | null>(null);

  // On mount, try to load the PDF from the last successful compile.
  useEffect(() => {
    if (!initialJobId) return;
    api.compile.fetchPdf(initialJobId, projectId).then((url) => {
      prevBlobUrl.current = url;
      setPdfUrl(url);
    }).catch(() => {
      // PDF no longer on disk — silently ignore; user can recompile.
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const compile = useCallback(async () => {
    if (pollingRef.current) return;
    pollingRef.current = true;

    setPhase('compiling');
    setErrors([]);
    setWarnings([]);
    setLog(null);

    try {
      const { jobId } = await api.compile.start(projectId);

      let polls = 0;
      while (polls < MAX_POLLS) {
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
        polls++;

        const result = await api.compile.status(projectId, jobId);

        if (result.status === 'completed' || result.status === 'failed') {
          if (prevBlobUrl.current) {
            URL.revokeObjectURL(prevBlobUrl.current);
            prevBlobUrl.current = null;
          }
          const resolvedPdfUrl = result.pdfUrl
            ? await api.compile.fetchPdf(jobId, projectId)
            : null;
          prevBlobUrl.current = resolvedPdfUrl;

          setPdfUrl(resolvedPdfUrl);
          setErrors(result.errors ?? []);
          setWarnings(result.warnings ?? []);
          setLog(result.log ?? null);
          setSynctex((result as { synctex?: SyncTexData }).synctex ?? null);
          setPhase(result.status === 'completed' && (result.errors?.length ?? 0) === 0 ? 'completed' : 'failed');
          pollingRef.current = false;
          return;
        }
      }

      setPhase('failed');
      setErrors([{ file: 'main.tex', line: null, message: 'Compile timed out (polling limit reached)', level: 'error' }]);
    } catch (err) {
      setPhase('failed');
      setErrors([{ file: 'main.tex', line: null, message: err instanceof Error ? err.message : 'Compile request failed', level: 'error' }]);
    } finally {
      pollingRef.current = false;
    }
  }, [projectId, api]);

  return {
    phase,
    pdfUrl,
    errors,
    warnings,
    log,
    synctex,
    isCompiling: phase === 'compiling',
    compile,
  };
}
