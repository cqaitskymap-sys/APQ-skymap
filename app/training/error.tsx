'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function TrainingError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Training module error:', error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6" role="alert">
      <div className="w-full max-w-lg space-y-4 rounded-lg border bg-card p-6 text-center">
        <AlertTriangle className="mx-auto h-10 w-10 text-amber-600" aria-hidden="true" />
        <h1 className="text-xl font-semibold">Training module could not be loaded</h1>
        <p className="text-sm text-muted-foreground">
          Your work was not submitted. Retry the operation or return to the Training dashboard.
        </p>
        {error.digest && <p className="text-xs text-muted-foreground">Reference: {error.digest}</p>}
        <div className="flex flex-wrap justify-center gap-2">
          <Button onClick={reset}>Try again</Button>
          <Button asChild variant="outline">
            <Link href="/training/dashboard">Training dashboard</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
