'use client';

import { cn } from '@/lib/utils';
import { approvalStatusColor, workflowStepColor } from '@/lib/cc-approval-records';

export function CcApprovalStatusBadge({ status }: { status?: string }) {
  return (
    <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium', approvalStatusColor(status))}>
      {status || 'Pending'}
    </span>
  );
}

export function CcWorkflowStepBadge({ step }: { step?: string }) {
  return (
    <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium', workflowStepColor(step))}>
      {step || '—'}
    </span>
  );
}

export function CcRoleBadge({ role }: { role?: string }) {
  return (
    <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
      {(role || '—').replace(/_/g, ' ')}
    </span>
  );
}

export function CcOverdueBadge({ overdue }: { overdue: boolean }) {
  if (!overdue) return null;
  return <span className="inline-flex rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">Overdue</span>;
}
