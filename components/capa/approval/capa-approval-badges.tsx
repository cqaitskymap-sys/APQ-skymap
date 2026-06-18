'use client';

import { cn } from '@/lib/utils';
import {
  approvalStatusColor,
  approvalStatusLabel,
  roleBadgeColor,
  workflowStepColor,
} from '@/lib/capa-approval-records';
import { CapaPriorityBadge } from '@/components/capa/capa-sub-nav';

export function CapaApprovalStatusBadge({ status }: { status?: string }) {
  return (
    <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium', approvalStatusColor(status))}>
      {approvalStatusLabel(status)}
    </span>
  );
}

export function CapaWorkflowStepBadge({ step }: { step?: string }) {
  return (
    <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium', workflowStepColor(step))}>
      {step || '—'}
    </span>
  );
}

export function CapaRoleBadge({ role }: { role?: string }) {
  const label = (role || '—').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  return (
    <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium', roleBadgeColor(role))}>
      {label}
    </span>
  );
}

export function CapaOverdueBadge({ overdue }: { overdue: boolean }) {
  if (!overdue) return null;
  return (
    <span className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium bg-red-100 text-red-800 animate-pulse">
      Overdue
    </span>
  );
}

export { CapaPriorityBadge };
