'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import { useApi } from '@/lib/use-api';

export default function AcceptInvitePage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const api = useApi();
  const [status, setStatus] = useState<'loading' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    async function accept() {
      try {
        const { projectId } = await api.invites.accept(params.token);
        router.replace(`/project/${projectId}`);
      } catch (err: unknown) {
        const message =
          (err as { body?: { message?: string } })?.body?.message ?? 'The invite link is invalid or has expired.';
        setErrorMessage(message);
        setStatus('error');
      }
    }
    accept();
  }, [params.token, api, router]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-[#282c34] flex items-center justify-center">
        <div className="text-center">
          <Loader2 size={40} className="animate-spin text-blue-400 mx-auto mb-4" />
          <p className="text-[#abb2bf]">Accepting invite...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#282c34] flex items-center justify-center">
      <div className="text-center max-w-sm">
        <XCircle size={40} className="text-red-400 mx-auto mb-4" />
        <h1 className="text-lg font-semibold text-[#abb2bf] mb-2">Invite Failed</h1>
        <p className="text-sm text-[#5c6370]">{errorMessage}</p>
        <button
          onClick={() => router.push('/dashboard')}
          className="mt-6 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm transition-colors"
        >
          Go to Dashboard
        </button>
      </div>
    </div>
  );
}
