'use client';

import { Inbox } from 'lucide-react';

interface EmptyStateProps {
  title?: string;
  message?: string;
}

export function EmptyState({
  title = 'No data available',
  message = 'There are no records to display for this section.',
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <Inbox className="h-10 w-10 text-slate-300 mb-3" />
      <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{title}</p>
      <p className="text-xs text-muted-foreground mt-1 max-w-sm">{message}</p>
    </div>
  );
}
