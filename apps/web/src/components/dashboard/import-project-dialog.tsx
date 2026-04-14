'use client';

import { useState, useRef } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Upload, X, Loader2 } from 'lucide-react';
import type { ApiClient } from '@/lib/api';

interface ImportProjectDialogProps {
  api: ApiClient;
  onImported: (projectId: string) => void;
}

export function ImportProjectDialog({ api, onImported }: ImportProjectDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [file, setFile] = useState<globalThis.File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;

    setLoading(true);
    setError('');
    try {
      const projectName = name.trim() || file.name.replace(/\.zip$/, '') || 'Imported Project';
      const { projectId } = await api.export.importZip(projectName, file);
      setOpen(false);
      setName('');
      setFile(null);
      onImported(projectId);
    } catch {
      setError('Failed to import project. Make sure the file is a valid ZIP.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#2c313a] hover:bg-[#3e4451] text-[#abb2bf] font-medium transition-colors text-sm">
          <Upload size={16} />
          Import ZIP
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md rounded-xl bg-[#21252b] border border-[#3e4451] p-6 shadow-2xl z-50">
          <Dialog.Title className="text-lg font-semibold text-[#abb2bf]">Import ZIP</Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-[#5c6370]">
            Import a project from a ZIP file. Text files (.tex, .bib) will be imported.
          </Dialog.Description>
          <Dialog.Close asChild>
            <button className="absolute top-3 right-3 p-1 rounded text-[#5c6370] hover:text-[#abb2bf] hover:bg-[#2c313a] transition-colors" aria-label="Close">
              <X size={16} />
            </button>
          </Dialog.Close>

          <form onSubmit={handleSubmit} className="mt-4 space-y-3">
            <div>
              <label htmlFor="import-name" className="block text-sm font-medium text-[#abb2bf] mb-1">
                Project name (optional)
              </label>
              <input
                id="import-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Defaults to ZIP filename"
                className="w-full px-3 py-2 rounded-lg bg-[#282c34] border border-[#3e4451] text-[#abb2bf] placeholder-[#5c6370] focus:outline-none focus:border-blue-500 transition-colors text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#abb2bf] mb-1">ZIP file</label>
              <div
                onClick={() => inputRef.current?.click()}
                className={`flex flex-col items-center justify-center px-4 py-6 rounded-lg border-2 border-dashed cursor-pointer transition-colors ${
                  file
                    ? 'border-blue-500 bg-blue-900/10'
                    : 'border-[#3e4451] hover:border-[#5c6370]'
                }`}
              >
                <Upload size={24} className={file ? 'text-blue-400' : 'text-[#5c6370]'} />
                <p className="mt-2 text-sm text-[#7f848e]">
                  {file ? file.name : 'Click to select a ZIP file'}
                </p>
                {file && (
                  <p className="text-xs text-[#5c6370] mt-0.5">
                    {(file.size / 1024).toFixed(1)} KB
                  </p>
                )}
              </div>
              <input
                ref={inputRef}
                type="file"
                accept=".zip"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>

            {error && <p className="text-sm text-red-400">{error}</p>}

            <div className="flex justify-end gap-2 pt-1">
              <Dialog.Close asChild>
                <button type="button" className="px-3 py-1.5 rounded-lg text-sm text-[#abb2bf] hover:bg-[#2c313a] transition-colors">
                  Cancel
                </button>
              </Dialog.Close>
              <button
                type="submit"
                disabled={!file || loading}
                className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm bg-blue-600 hover:bg-blue-500 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading && <Loader2 size={14} className="animate-spin" />}
                Import
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
