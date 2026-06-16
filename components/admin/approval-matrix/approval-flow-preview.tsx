'use client';

import { ArrowRight } from 'lucide-react';
import type { ApprovalMatrix } from '@/lib/admin/schemas';
import { buildApprovalFlow } from '@/lib/admin/approval-matrix-service';
import { cn } from '@/lib/utils';

export function ApprovalFlowPreview({ matrix }: { matrix: ApprovalMatrix }) {
  const flow = buildApprovalFlow(matrix);

  if (!flow.length) {
    return <p className="text-sm text-muted-foreground">No approval flow defined.</p>;
  }

  return (
    <div className="flex flex-col lg:flex-row lg:flex-wrap items-start gap-2 p-4 bg-slate-50 rounded-lg border">
      {flow.map((step, i) => (
        <div key={step.label} className="flex items-center gap-2">
          <div className={cn(
            'min-w-[150px] p-3 rounded-lg border bg-white shadow-sm text-center',
            step.label === 'Final Approver' && 'border-green-300 bg-green-50',
          )}>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{step.label}</p>
            <p className="text-xs font-semibold text-slate-900 mt-1">
              {step.roles.split(',').map((r) => r.trim().replace(/_/g, ' ')).join(' · ')}
            </p>
          </div>
          {i < flow.length - 1 && <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 hidden lg:block" />}
        </div>
      ))}
    </div>
  );
}
