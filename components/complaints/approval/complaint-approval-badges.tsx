'use client';

import {
  approvalStatusColor,
  overdueBadgeColor,
  roleBadgeColor,
  workflowStepColor,
} from '@/lib/complaint-approval-records';

export function ComplaintApprovalStatusBadge({ status }: { status?: string }) {
  return (
    <span className={`rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${approvalStatusColor(status || 'Pending')}`}>
      {status || 'Pending'}
    </span>
  );
}

export function ComplaintWorkflowStepBadge({ step }: { step?: string }) {
  return (
    <span className={`rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${workflowStepColor(step || 'Received')}`}>
      {step || '—'}
    </span>
  );
}

export function ComplaintRoleBadge({ role }: { role?: string }) {
  if (!role) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <span className={`rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${roleBadgeColor()}`}>
      {role.replace(/_/g, ' ')}
    </span>
  );
}

export function ComplaintOverdueBadge({ overdue, days }: { overdue: boolean; days?: number }) {
  return (
    <span className={`rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${overdueBadgeColor(overdue)}`}>
      {overdue ? `${days ?? 0}d overdue` : 'On track'}
    </span>
  );
}
