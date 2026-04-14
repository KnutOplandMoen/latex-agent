'use client';

import { FileOutput } from 'lucide-react';

export function PdfPlaceholder() {
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
