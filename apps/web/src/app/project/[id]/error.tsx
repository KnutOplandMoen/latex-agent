'use client';

import Link from 'next/link';

export default function ProjectError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex items-center justify-center h-screen bg-[#282c34]">
      <div className="text-center max-w-md mx-auto px-4">
        <h2 className="text-xl font-semibold text-[#abb2bf] mb-2">Failed to load project</h2>
        <p className="text-sm text-[#5c6370] mb-6">
          {error.message || 'Could not open this project. It may have been deleted or you may not have access.'}
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
          >
            Try again
          </button>
          <Link
            href="/dashboard"
            className="px-4 py-2 text-sm rounded-lg bg-[#2c313a] text-[#abb2bf] hover:bg-[#3e4451] transition-colors"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
