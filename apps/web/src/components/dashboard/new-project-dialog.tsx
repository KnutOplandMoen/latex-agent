'use client';

import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Plus, X, Loader2 } from 'lucide-react';

interface NewProjectDialogProps {
  onCreateProject: (name: string) => Promise<void>;
}

export function NewProjectDialog({ onCreateProject }: NewProjectDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    setError('');
    try {
      await onCreateProject(name.trim());
      setName('');
      setOpen(false);
    } catch {
      setError('Failed to create project. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors">
          <Plus size={18} />
          New Project
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md rounded-xl bg-[#21252b] border border-[#3e4451] p-6 shadow-2xl">
          <Dialog.Title className="text-lg font-semibold text-[#abb2bf]">
            Create New Project
          </Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-[#5c6370]">
            Give your project a name. A starter main.tex file will be created automatically.
          </Dialog.Description>

          <form onSubmit={handleSubmit} className="mt-4">
            <label htmlFor="project-name" className="block text-sm font-medium text-[#abb2bf] mb-1">
              Project name
            </label>
            <input
              id="project-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Research Paper"
              autoFocus
              className="w-full px-3 py-2 rounded-lg bg-[#282c34] border border-[#3e4451] text-[#abb2bf] placeholder-[#5c6370] focus:outline-none focus:border-blue-500 transition-colors"
            />
            {error && <p className="mt-2 text-sm text-red-400">{error}</p>}

            <div className="mt-4 flex justify-end gap-2">
              <Dialog.Close asChild>
                <button type="button" className="px-3 py-1.5 rounded-lg text-sm text-[#abb2bf] hover:bg-[#2c313a] transition-colors">
                  Cancel
                </button>
              </Dialog.Close>
              <button
                type="submit"
                disabled={loading || !name.trim()}
                className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm bg-blue-600 hover:bg-blue-500 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading && <Loader2 size={14} className="animate-spin" />}
                Create
              </button>
            </div>
          </form>

          <Dialog.Close asChild>
            <button className="absolute top-3 right-3 p-1 rounded text-[#5c6370] hover:text-[#abb2bf] hover:bg-[#2c313a] transition-colors" aria-label="Close">
              <X size={16} />
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
