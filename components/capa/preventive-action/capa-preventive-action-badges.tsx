'use client';

import { cn } from '@/lib/utils';
import {
  actionStatusColor, actionStatusLabel, implementationStatusColor, implementationStatusLabel, riskLevelColor,
} from '@/lib/capa-preventive-action-records';

export function CapaPreventiveActionStatusBadge({ status }: { status?: string }) {
  return (
    <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium', actionStatusColor(status))}>
      {actionStatusLabel(status)}
    </span>
  );
}

export function CapaPreventiveImplementationStatusBadge({ status }: { status?: string }) {
  return (
    <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium', implementationStatusColor(status))}>
      {implementationStatusLabel(status)}
    </span>
  );
}

export function CapaPreventiveRiskBadge({ level }: { level?: string }) {
  return (
    <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize', riskLevelColor(level))}>
      {level || 'medium'}
    </span>
  );
}
