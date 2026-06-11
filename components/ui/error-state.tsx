'use client';

import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function ErrorState({
  title = 'Unable to load data',
  message = 'Something went wrong while fetching records. Please try again.',
  onRetry,
  className,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div className={cn('flex min-h-[220px] flex-col items-center justify-center px-6 py-10 text-center', className)}>
      <AlertTriangle className="mb-3 h-10 w-10 text-amber-500" />
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-4 gap-2" onClick={onRetry}>
          <RefreshCw className="h-4 w-4" />Retry
        </Button>
      )}
    </div>
  );
}
