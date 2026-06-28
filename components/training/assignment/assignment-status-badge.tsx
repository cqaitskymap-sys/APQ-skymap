'use client';

import { cn } from '@/lib/utils';
import { assignmentStatusColor } from '@/lib/training-assignment-types';

export function AssignmentStatusBadge({ status }: { status: string }) {
  return (
    <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium', assignmentStatusColor(status))}>
      {status}
    </span>
  );
}
