'use client';

import { CheckCircle2, Circle, XCircle, ArrowLeftCircle } from 'lucide-react';
import type { PqrApprovalRecord } from '@/lib/pqr-approval-records';

export function PqrApprovalTimeline({ approvals }: { approvals: PqrApprovalRecord[] }) {
  const steps = approvals.filter((a) => !a.isDeleted).sort((a, b) => a.approvalLevel - b.approvalLevel);
  if (!steps.length) return <p className="text-sm text-muted-foreground">No approval steps configured.</p>;

  return (
    <ol className="relative space-y-0 border-l border-slate-200 pl-6">
      {steps.map((step) => {
        const approved = step.approvalStatus === 'Approved' || step.approvalStatus === 'Completed';
        const rejected = step.approvalStatus === 'Rejected';
        const sentBack = step.approvalStatus === 'Sent Back';
        const active = step.approvalStatus === 'In Review' || step.approvalStatus === 'Escalated';
        return (
          <li key={step.id || step.approvalId} className="relative pb-6 last:pb-0">
            <span className={`absolute -left-[1.65rem] top-0.5 flex h-6 w-6 items-center justify-center rounded-full border-2 bg-white ${
              rejected ? 'border-red-500 text-red-500'
                : sentBack ? 'border-amber-500 text-amber-500'
                  : approved ? 'border-green-600 text-green-600'
                    : active ? 'border-blue-600 text-blue-600'
                      : 'border-slate-300 text-slate-300'
            }`}>
              {rejected ? <XCircle className="h-4 w-4" />
                : sentBack ? <ArrowLeftCircle className="h-4 w-4" />
                  : approved ? <CheckCircle2 className="h-4 w-4" />
                    : <Circle className="h-3 w-3" />}
            </span>
            <div className="rounded-md border bg-white p-3 text-sm shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">{step.currentWorkflowStep}</p>
                <span className="text-xs text-muted-foreground">Level {step.approvalLevel}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">{step.approvalType} · <RoleInline role={step.currentApproverRole} /></p>
              <p className="text-xs mt-1">Status: {step.approvalStatus}{step.signedBy ? ` · ${step.signedBy}` : ''}{step.signedDate ? ` · ${step.signedDate}` : ''}</p>
              {step.approvalComments && <p className="text-xs mt-1 italic">{step.approvalComments}</p>}
              {step.rejectionReason && <p className="text-xs mt-1 text-red-600">Rejected: {step.rejectionReason}</p>}
              {step.sendBackReason && <p className="text-xs mt-1 text-amber-700">Sent back: {step.sendBackReason}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function RoleInline({ role }: { role: string }) {
  return <span>{role.replace(/_/g, ' ')}</span>;
}
