'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import type { Project, File } from '@latex-ide/shared-types';
import { useApi, useGetToken } from '@/lib/use-api';
import { useAuth } from '@clerk/nextjs';
import { IdeLayout } from '@/components/ide/ide-layout';

const clerkEnabled = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

function useCurrentUserId(): string {
  if (clerkEnabled) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const { userId } = useAuth();
    return userId ?? 'dev_user';
  }
  return 'dev_user';
}

export default function ProjectPage() {
  const params = useParams<{ id: string }>();
  const api = useApi();
  const currentUserId = useCurrentUserId();
  const [project, setProject] = useState<Project | null>(null);
  const [files, setFiles] = useState<File[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const [proj, fileList] = await Promise.all([
          api.projects.get(params.id),
          api.files.listByProject(params.id),
        ]);
        setProject(proj);
        setFiles(fileList);
      } catch {
        setError('Failed to load project.');
      }
    }
    load();
  }, [api, params.id]);

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#282c34]">
        <div className="text-center">
          <p className="text-red-400 text-lg">{error}</p>
          <a href="/dashboard" className="text-blue-400 hover:underline mt-2 inline-block">
            Back to dashboard
          </a>
        </div>
      </div>
    );
  }

  if (!project || !files) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#282c34]">
        <Loader2 size={32} className="animate-spin text-[#5c6370]" />
      </div>
    );
  }

  return (
    <IdeLayout
      projectId={project.id}
      projectName={project.name}
      initialFiles={files}
      currentUserId={currentUserId}
    />
  );
}
