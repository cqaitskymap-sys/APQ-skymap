'use client';

import {
  approvalStatusColor,
  overdueBadgeColor,
  priorityBadgeColor,
  roleBadgeColor,
  workflowStepColor,
} from '@/lib/oos-approval-records';

export function OosApprovalStatusBadge({ status }: { status?: string }) {
  return (
    <span className={`rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${approvalStatusColor(status || 'Pending')}`}>
      {status || 'Pending'}
    </span>
  );
}

export function OosWorkflowStepBadge({ step }: { step?: string }) {
  return (
    <span className={`rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${workflowStepColor(step || 'Submitted')}`}>
      {step || '—'}
    </span>
  );
}

export function OosRoleBadge({ role }: { role?: string }) {
  if (!role) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <span className={`rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${roleBadgeColor()}`}>
      {role.replace(/_/g, ' ')}
    </span>
  );
}

export function OosPriorityBadge({ priority }: { priority?: string }) {
  return (
    <span className={`rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${priorityBadgeColor(priority || 'Medium')}`}>
      {priority || 'Medium'}
    </span>
  );
}

export function OosOverdueBadge({ overdue, days }: { overdue: boolean; days?: number }) {
  return (
    <span className={`rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${overdueBadgeColor(overdue)}`}>
      {overdue ? `${days ?? 0}d overdue` : 'On track'}
    </span>
  );
}
