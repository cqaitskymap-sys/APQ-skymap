'use client';

import {
  approvalStatusColor,
  overdueBadgeColor,
  roleBadgeColor,
  workflowStepColor,
} from '@/lib/deviation-approval-records';

export function DeviationApprovalStatusBadge({ status }: { status?: string }) {
  return (
    <span className={`rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${approvalStatusColor(status || 'Pending')}`}>
      {status || 'Pending'}
    </span>
  );
}

export function DeviationWorkflowStepBadge({ step }: { step?: string }) {
  return (
    <span className={`rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${workflowStepColor(step || 'Submitted')}`}>
      {step || '—'}
    </span>
  );
}

export function DeviationRoleBadge({ role }: { role?: string }) {
  if (!role) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <span className={`rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${roleBadgeColor()}`}>
      {role.replace(/_/g, ' ')}
    </span>
  );
}

export function DeviationOverdueBadge({ overdue, days }: { overdue: boolean; days?: number }) {
  return (
    <span className={`rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${overdueBadgeColor(overdue)}`}>
      {overdue ? `${days ?? 0}d overdue` : 'On track'}
    </span>
  );
}
