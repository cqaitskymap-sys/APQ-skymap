'use client';

import { BarChart3 } from 'lucide-react';

export function ChartEmptyState({ message = 'Data will appear here after entry' }: { message?: string }) {
  return (
    <div className="flex h-full min-h-[200px] flex-col items-center justify-center text-center px-4">
      <BarChart3 className="h-8 w-8 text-muted-foreground/50 mb-2" />
      <p className="text-sm font-medium text-muted-foreground">No records found</p>
      <p className="text-xs text-muted-foreground/80 mt-1">{message}</p>
    </div>
  );
}

export function hasChartData<T>(data: T[] | undefined | null): data is T[] {
  return Array.isArray(data) && data.length > 0;
}
