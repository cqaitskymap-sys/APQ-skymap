'use client';

import { cn } from '@/lib/utils';
import { matrixStatusColor } from '@/lib/training-matrix-types';

export function MatrixStatusBadge({ status }: { status: string }) {
  return (
    <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium', matrixStatusColor(status))}>
      {status}
    </span>
  );
}
