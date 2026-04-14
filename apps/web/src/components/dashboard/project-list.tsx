'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FileText, Trash2, Loader2 } from 'lucide-react';
import type { Project } from '@latex-ide/shared-types';
import { useApi } from '@/lib/use-api';
import { NewProjectDialog } from './new-project-dialog';

export function ProjectList() {
  const api = useApi();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchProjects = useCallback(async () => {
    try {
      const data = await api.projects.list();
      setProjects(data);
    } catch {
      setError('Failed to load projects.');
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  async function handleCreate(name: string) {
    const project = await api.projects.create({ name });
    router.push(`/project/${project.id}`);
  }

  async function handleDelete(id: string) {
    try {
      await api.projects.remove(id);
      setProjects((prev) => prev.filter((p) => p.id !== id));
    } catch {
      setError('Failed to delete project.');
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={32} className="animate-spin text-[#5c6370]" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[#abb2bf]">Your Projects</h1>
          <p className="text-sm text-[#5c6370] mt-1">
            {projects.length} {projects.length === 1 ? 'project' : 'projects'}
          </p>
        </div>
        <NewProjectDialog onCreateProject={handleCreate} />
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-900/20 border border-red-800/30 text-red-400 text-sm">
          {error}
        </div>
      )}

      {projects.length === 0 ? (
        <div className="text-center py-20">
          <FileText size={48} className="mx-auto mb-4 text-[#3e4451]" />
          <p className="text-[#5c6370] text-lg">No projects yet</p>
          <p className="text-[#5c6370] text-sm mt-1">Create your first project to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => (
            <div
              key={project.id}
              className="group relative rounded-xl border border-[#3e4451] bg-[#21252b] hover:border-[#5c6370] transition-colors"
            >
              <Link
                href={`/project/${project.id}`}
                className="block p-5"
              >
                <div className="flex items-start gap-3">
                  <FileText size={20} className="text-blue-400 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <h2 className="font-semibold text-[#abb2bf] truncate">{project.name}</h2>
                    <p className="text-xs text-[#5c6370] mt-1">
                      Updated {new Date(project.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </Link>
              <button
                onClick={() => handleDelete(project.id)}
                className="absolute top-3 right-3 p-1.5 rounded opacity-0 group-hover:opacity-100 text-[#5c6370] hover:text-red-400 hover:bg-[#2c313a] transition-all"
                title="Delete project"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
