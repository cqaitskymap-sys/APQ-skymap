'use client';

import {
  approvalStatusColor,
  esignStatusColor,
  overdueBadgeColor,
  roleBadgeColor,
  workflowStatusColor,
} from '@/lib/pqr-approval-records';

export function ApprovalStatusBadge({ status }: { status: string }) {
  return (
    <span className={`rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${approvalStatusColor(status)}`}>
      {status || '—'}
    </span>
  );
}

export function WorkflowStatusBadge({ status }: { status: string }) {
  return (
    <span className={`rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${workflowStatusColor(status)}`}>
      {status || '—'}
    </span>
  );
}

export function RoleBadge({ role }: { role: string }) {
  if (!role) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <span className={`rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${roleBadgeColor()}`}>
      {role.replace(/_/g, ' ')}
    </span>
  );
}

export function OverdueBadge({ overdue, days }: { overdue: boolean; days?: number }) {
  return (
    <span className={`rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${overdueBadgeColor(overdue)}`}>
      {overdue ? `${days ?? 0}d overdue` : 'On track'}
    </span>
  );
}

export function EsignStatusBadge({ status }: { status: string }) {
  return (
    <span className={`rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${esignStatusColor(status)}`}>
      {status || '—'}
    </span>
  );
}
