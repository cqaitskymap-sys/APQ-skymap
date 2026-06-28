'use client';

import { cn } from '@/lib/utils';
import { reportStatusColor } from '@/lib/training-reports-records';

export function ReportStatusBadge({ status }: { status: string }) {
  return (
    <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium', reportStatusColor(status))}>
      {status}
    </span>
  );
}

export { ReportStatusBadge as StatusBadge };
