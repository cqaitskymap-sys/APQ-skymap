'use client';

import { cn } from '@/lib/utils';
import {
  approvalStatusColor,
  approvalStatusLabel,
  riskLevelColor,
  roleBadgeColor,
  workflowStepColor,
} from '@/lib/risk-approval-records';

export function RiskApprovalStatusBadge({ status }: { status?: string }) {
  return (
    <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium', approvalStatusColor(status))}>
      {approvalStatusLabel(status)}
    </span>
  );
}

export function RiskWorkflowStepBadge({ step }: { step?: string }) {
  return (
    <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium', workflowStepColor(step))}>
      {step || '—'}
    </span>
  );
}

export function RiskRoleBadge({ role }: { role?: string }) {
  const label = (role || '—').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  return (
    <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium', roleBadgeColor(role))}>
      {label}
    </span>
  );
}

export function RiskLevelBadge({ level }: { level?: string }) {
  return (
    <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium', riskLevelColor(level))}>
      {level || '—'}
    </span>
  );
}

export function RiskOverdueBadge({ overdue }: { overdue: boolean }) {
  if (!overdue) return null;
  return (
    <span className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium bg-red-100 text-red-800 animate-pulse">
      Overdue
    </span>
  );
}
