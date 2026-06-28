'use client';

import type { ApprovalStep } from '@/lib/training-approval-types';
import { ApprovalStatusBadge } from './approval-status-badge';
import { CheckCircle, Circle, XCircle, Clock } from 'lucide-react';

interface WorkflowTimelineProps {
  steps: ApprovalStep[];
  currentStep?: number;
}

export function WorkflowTimeline({ steps, currentStep }: WorkflowTimelineProps) {
  const sorted = [...steps].sort((a, b) => a.step_number - b.step_number);

  return (
    <div className="space-y-0">
      {sorted.map((step, i) => {
        const isActive = step.step_number === currentStep;
        const Icon = step.status === 'Approved' ? CheckCircle
          : step.status === 'Rejected' ? XCircle
          : isActive ? Clock : Circle;
        const iconColor = step.status === 'Approved' ? 'text-green-600'
          : step.status === 'Rejected' ? 'text-red-600'
          : isActive ? 'text-blue-600' : 'text-muted-foreground';

        return (
          <div key={step.id} className="flex gap-3">
            <div className="flex flex-col items-center">
              <Icon className={`h-5 w-5 ${iconColor}`} />
              {i < sorted.length - 1 && <div className="w-px h-8 bg-border" />}
            </div>
            <div className="pb-4 flex-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium">{step.step_name}</p>
                <ApprovalStatusBadge status={step.status} />
              </div>
              <p className="text-xs text-muted-foreground">{step.approver_role} · Due {step.due_date}</p>
              {step.approver_name && <p className="text-xs">By {step.approver_name}</p>}
              {step.comments && <p className="text-xs mt-1 italic">{step.comments}</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
