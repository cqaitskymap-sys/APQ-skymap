'use client';

import { ArrowRight } from 'lucide-react';
import type { WorkflowStep } from '@/lib/admin/schemas';
import { cn } from '@/lib/utils';

export function WorkflowFlowchart({ steps }: { steps: WorkflowStep[] }) {
  if (!steps.length) {
    return <p className="text-sm text-muted-foreground">No steps defined.</p>;
  }

  return (
    <div className="flex flex-col lg:flex-row lg:flex-wrap items-start gap-2 p-4 bg-slate-50 rounded-lg border">
      {steps.map((step, i) => (
        <div key={step.id || i} className="flex items-center gap-2">
          <div className={cn(
            'min-w-[140px] p-3 rounded-lg border bg-white shadow-sm text-center',
            step.stepType === 'Final Approve' && 'border-green-300 bg-green-50',
            step.stepType === 'Close' && 'border-slate-300',
          )}>
            <p className="text-xs font-semibold text-slate-900">{step.stepName}</p>
            <p className="text-[10px] text-muted-foreground mt-1">{step.stepType}</p>
            <p className="text-[10px] text-blue-600 mt-0.5">{step.assignedRole.replace(/_/g, ' ')}</p>
            {step.dueDays && <p className="text-[10px] text-muted-foreground">{step.dueDays}d due</p>}
          </div>
          {i < steps.length - 1 && <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 hidden lg:block" />}
        </div>
      ))}
    </div>
  );
}
