'use client';

import { useEffect, useRef, useState, useCallback, useImperativeHandle, forwardRef } from 'react';
import { FileOutput, Loader2, ChevronUp, ChevronDown, ZoomIn, ZoomOut } from 'lucide-react';
import type { SyncTexData } from '@latex-ide/shared-types';

export interface PdfViewerHandle {
  scrollToSourceLine: (file: string, line: number) => void;
}

interface PdfViewerProps {
  pdfUrl: string | null;
  synctexData: SyncTexData | null;
  onSynctexClick?: (file: string, line: number) => void;
}

interface PageDimensions {
  width: number;
  height: number;
}

export const PdfViewer = forwardRef<PdfViewerHandle, PdfViewerProps>(function PdfViewer({ pdfUrl, synctexData, onSynctexClick }, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pageCount, setPageCount] = useState(0);
  const [scale, setScale] = useState(1.0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pageDimensions, setPageDimensions] = useState<PageDimensions[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfDocRef = useRef<any>(null);
  const canvasRefs = useRef<Map<number, HTMLCanvasElement>>(new Map());
  const renderingRef = useRef(false);

  useImperativeHandle(ref, () => ({
    scrollToSourceLine(file: string, line: number) {
      if (!synctexData || !containerRef.current) return;
      const entries = synctexData.sourceToPdf.filter((e) => e.file === file && e.line === line);
      if (entries.length === 0) {
        const nearest = synctexData.sourceToPdf
          .filter((e) => e.file === file)
          .sort((a, b) => Math.abs(a.line - line) - Math.abs(b.line - line));
        if (nearest.length === 0) return;
        entries.push(nearest[0]!);
      }
      const entry = entries[0]!;
      const canvases = containerRef.current.querySelectorAll('canvas');
      const target = canvases[entry.page - 1];
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    },
  }));

  const renderPage = useCallback(
    async (pageNum: number) => {
      const pdfDoc = pdfDocRef.current;
      if (!pdfDoc) return;

      const page = await pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale: scale * window.devicePixelRatio });
      const displayViewport = page.getViewport({ scale });

      const canvas = canvasRefs.current.get(pageNum);
      if (!canvas) return;

      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.style.width = `${displayViewport.width}px`;
      canvas.style.height = `${displayViewport.height}px`;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      await page.render({ canvasContext: ctx, viewport }).promise;
    },
    [scale],
  );

  useEffect(() => {
    if (!pdfUrl) {
      pdfDocRef.current = null;
      setPageCount(0);
      setPageDimensions([]);
      return;
    }

    let cancelled = false;

    async function loadPdf() {
      setLoading(true);
      setError(null);

      try {
        const pdfjsLib = await import('pdfjs-dist');
        pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
          'pdfjs-dist/build/pdf.worker.mjs',
          import.meta.url,
        ).toString();

        const doc = await pdfjsLib.getDocument(pdfUrl!).promise;
        if (cancelled) {
          doc.destroy();
          return;
        }

        pdfDocRef.current = doc;
        setPageCount(doc.numPages);

        const dims: PageDimensions[] = [];
        for (let i = 1; i <= doc.numPages; i++) {
          const page = await doc.getPage(i);
          const viewport = page.getViewport({ scale: 1 });
          dims.push({ width: viewport.width, height: viewport.height });
        }
        if (!cancelled) setPageDimensions(dims);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load PDF');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadPdf();

    return () => {
      cancelled = true;
      if (pdfDocRef.current) {
        pdfDocRef.current.destroy();
        pdfDocRef.current = null;
      }
    };
  }, [pdfUrl]);

  useEffect(() => {
    if (!pdfDocRef.current || pageCount === 0 || renderingRef.current) return;

    renderingRef.current = true;
    async function renderAll() {
      for (let i = 1; i <= pageCount; i++) {
        await renderPage(i);
      }
      renderingRef.current = false;
    }
    renderAll();
  }, [pageCount, scale, renderPage]);

  const handleCanvasClick = useCallback(
    (pageNum: number, e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!synctexData || !onSynctexClick) return;

      const canvas = e.currentTarget;
      const rect = canvas.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * (pageDimensions[pageNum - 1]?.width ?? 1);
      const y = ((e.clientY - rect.top) / rect.height) * (pageDimensions[pageNum - 1]?.height ?? 1);

      const entries = synctexData.pdfToSource.filter((s) => s.page === pageNum);
      if (entries.length === 0) return;

      let closest = entries[0]!;
      let minDist = Infinity;
      for (const entry of entries) {
        const dist = Math.hypot(entry.x - x, entry.y - y);
        if (dist < minDist) {
          minDist = dist;
          closest = entry;
        }
      }

      onSynctexClick(closest.file, closest.line);
    },
    [synctexData, onSynctexClick, pageDimensions],
  );

  const setCanvasRef = useCallback((pageNum: number, el: HTMLCanvasElement | null) => {
    if (el) {
      canvasRefs.current.set(pageNum, el);
    } else {
      canvasRefs.current.delete(pageNum);
    }
  }, []);

  if (!pdfUrl) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-[#1e2127] text-[#5c6370]">
        <FileOutput size={48} className="mb-4 opacity-40" />
        <p className="text-sm font-medium">PDF Preview</p>
        <p className="text-xs mt-1 text-center px-4">
          Compile your project to see the PDF output here.
        </p>
        <div className="mt-4 px-3 py-1.5 rounded bg-[#2c313a] text-xs text-[#abb2bf]">
          Ctrl+Enter to compile
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-[#1e2127] text-[#5c6370]">
        <Loader2 size={24} className="animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-[#1e2127] text-red-400">
        <p className="text-sm">Failed to load PDF</p>
        <p className="text-xs mt-1 text-[#5c6370]">{error}</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[#1e2127]">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-2 py-1 border-b border-[#3e4451] bg-[#21252b] text-xs text-[#abb2bf]">
        <span>{pageCount} page{pageCount !== 1 ? 's' : ''}</span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setScale((s) => Math.max(0.25, s - 0.25))}
            className="p-1 rounded hover:bg-[#2c313a] transition-colors"
            title="Zoom out"
          >
            <ZoomOut size={14} />
          </button>
          <span className="w-12 text-center">{Math.round(scale * 100)}%</span>
          <button
            onClick={() => setScale((s) => Math.min(3, s + 0.25))}
            className="p-1 rounded hover:bg-[#2c313a] transition-colors"
            title="Zoom in"
          >
            <ZoomIn size={14} />
          </button>
          <button
            onClick={() => containerRef.current?.scrollBy(0, -200)}
            className="p-1 rounded hover:bg-[#2c313a] transition-colors"
            title="Scroll up"
          >
            <ChevronUp size={14} />
          </button>
          <button
            onClick={() => containerRef.current?.scrollBy(0, 200)}
            className="p-1 rounded hover:bg-[#2c313a] transition-colors"
            title="Scroll down"
          >
            <ChevronDown size={14} />
          </button>
        </div>
      </div>

      {/* Pages */}
      <div ref={containerRef} className="flex-1 overflow-auto p-2">
        <div className="flex flex-col items-center gap-2">
          {Array.from({ length: pageCount }, (_, i) => i + 1).map((pageNum) => (
            <canvas
              key={pageNum}
              ref={(el) => setCanvasRef(pageNum, el)}
              onClick={(e) => handleCanvasClick(pageNum, e)}
              className={`shadow-lg ${synctexData ? 'cursor-crosshair' : ''}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
});
