'use client';

import { cn } from '@/lib/utils';
import { implStatusColor, priorityColor, taskStatusColor } from '@/lib/cc-implementation-records';

export function CcImplStatusBadge({ status }: { status?: string }) {
  return (
    <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium', implStatusColor(status))}>
      {status || 'Draft'}
    </span>
  );
}

export function CcTaskStatusBadge({ status }: { status?: string }) {
  return (
    <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium', taskStatusColor(status))}>
      {status || 'Not Started'}
    </span>
  );
}

export function CcTaskPriorityBadge({ priority }: { priority?: string }) {
  return (
    <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium', priorityColor(priority))}>
      {priority || 'Medium'}
    </span>
  );
}
