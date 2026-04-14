'use client';

import { useState, useEffect } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { LayoutTemplate, X, Loader2 } from 'lucide-react';
import type { Template } from '@latex-ide/shared-types';
import type { ApiClient } from '@/lib/api';

const CATEGORY_LABELS: Record<string, string> = {
  article: 'Article',
  thesis: 'Thesis',
  beamer: 'Presentation',
  cv: 'CV',
  ieee: 'IEEE',
  acm: 'ACM',
};

const CATEGORY_COLORS: Record<string, string> = {
  article: 'bg-blue-900/40 text-blue-300',
  thesis: 'bg-purple-900/40 text-purple-300',
  beamer: 'bg-orange-900/40 text-orange-300',
  cv: 'bg-green-900/40 text-green-300',
  ieee: 'bg-red-900/40 text-red-300',
  acm: 'bg-yellow-900/40 text-yellow-300',
};

interface TemplateCloneDialogProps {
  template: Template;
  api: ApiClient;
  onCloned: (projectId: string) => void;
  onClose: () => void;
}

function TemplateCloneDialog({ template, api, onCloned, onClose }: TemplateCloneDialogProps) {
  const [name, setName] = useState(template.name);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError('');
    try {
      const { projectId } = await api.templates.clone(template.id, { name: name.trim() });
      onCloned(projectId);
    } catch {
      setError('Failed to create project from template.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog.Root open onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm rounded-xl bg-[#21252b] border border-[#3e4451] p-6 shadow-2xl z-50">
          <Dialog.Title className="text-lg font-semibold text-[#abb2bf]">New from Template</Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-[#5c6370]">{template.description}</Dialog.Description>
          <Dialog.Close asChild>
            <button className="absolute top-3 right-3 p-1 rounded text-[#5c6370] hover:text-[#abb2bf] hover:bg-[#2c313a] transition-colors" aria-label="Close">
              <X size={16} />
            </button>
          </Dialog.Close>
          <form onSubmit={handleSubmit} className="mt-4">
            <label htmlFor="tpl-name" className="block text-sm font-medium text-[#abb2bf] mb-1">Project name</label>
            <input
              id="tpl-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              className="w-full px-3 py-2 rounded-lg bg-[#282c34] border border-[#3e4451] text-[#abb2bf] placeholder-[#5c6370] focus:outline-none focus:border-blue-500 transition-colors text-sm"
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
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

interface TemplatesGalleryProps {
  api: ApiClient;
  onProjectCreated: (projectId: string) => void;
}

export function TemplatesGallery({ api, onProjectCreated }: TemplatesGalleryProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Template | null>(null);

  useEffect(() => {
    api.templates.list().then(setTemplates).catch(() => {}).finally(() => setLoading(false));
  }, [api]);

  if (loading) return null;
  if (templates.length === 0) return null;

  return (
    <div className="mb-10">
      <div className="flex items-center gap-2 mb-4">
        <LayoutTemplate size={18} className="text-[#5c6370]" />
        <h2 className="text-base font-semibold text-[#abb2bf]">Start from Template</h2>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {templates.map((t) => (
          <button
            key={t.id}
            onClick={() => setSelected(t)}
            className="group text-left rounded-xl border border-[#3e4451] bg-[#21252b] hover:border-[#5c6370] transition-colors p-4"
          >
            <div className="flex items-start gap-2 mb-2">
              <LayoutTemplate size={16} className="text-blue-400 mt-0.5 shrink-0" />
              <span className="text-sm font-semibold text-[#abb2bf] truncate">{t.name}</span>
            </div>
            <p className="text-xs text-[#5c6370] line-clamp-2 mb-2">{t.description}</p>
            <span className={`text-xs px-1.5 py-0.5 rounded ${CATEGORY_COLORS[t.category] ?? 'bg-[#2c313a] text-[#5c6370]'}`}>
              {CATEGORY_LABELS[t.category] ?? t.category}
            </span>
          </button>
        ))}
      </div>

      {selected && (
        <TemplateCloneDialog
          template={selected}
          api={api}
          onCloned={(id) => { setSelected(null); onProjectCreated(id); }}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
