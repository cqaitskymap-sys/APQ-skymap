'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Global application error:', error);
  }, [error]);

  return (
    <html lang="en">
      <body className="min-h-screen flex items-center justify-center p-6 bg-slate-50 font-sans">
        <div className="max-w-md w-full text-center space-y-4">
          <h1 className="text-2xl font-bold text-red-600">Critical Error</h1>
          <p className="text-sm text-slate-600">
            The application encountered an unexpected error. Please refresh the page or try again later.
          </p>
          {error.message && (
            <p className="text-xs text-slate-500 bg-slate-100 p-3 rounded-lg font-mono break-all">{error.message}</p>
          )}
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Try Again
          </button>
        </div>
      </body>
    </html>
  );
}
