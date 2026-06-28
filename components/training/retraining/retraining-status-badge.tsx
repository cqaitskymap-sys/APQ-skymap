'use client';

import { cn } from '@/lib/utils';
import { retrainingStatusColor } from '@/lib/training-retraining-types';

export function RetrainingStatusBadge({ status }: { status: string }) {
  return (
    <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium', retrainingStatusColor(status))}>
      {status}
    </span>
  );
}
