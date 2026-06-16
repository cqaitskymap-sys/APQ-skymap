'use client';

import { cn } from '@/lib/utils';
import { actionStatusColor, actionStatusLabel, implementationStatusColor, implementationStatusLabel } from '@/lib/capa-corrective-action-records';

export function CapaCorrectiveActionStatusBadge({ status }: { status?: string }) {
  return (
    <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium', actionStatusColor(status))}>
      {actionStatusLabel(status)}
    </span>
  );
}

export function CapaImplementationStatusBadge({ status }: { status?: string }) {
  return (
    <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium', implementationStatusColor(status))}>
      {implementationStatusLabel(status)}
    </span>
  );
}
