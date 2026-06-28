'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ApprovalStep } from '@/lib/training-approval-types';
import { ApprovalStatusBadge } from './approval-status-badge';

interface ApprovalStepCardProps {
  step: ApprovalStep;
  isCurrent?: boolean;
}

export function ApprovalStepCard({ step, isCurrent }: ApprovalStepCardProps) {
  return (
    <Card className={isCurrent ? 'border-blue-300 bg-blue-50/30' : 'border-slate-200'}>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium">
          Step {step.step_number}: {step.step_name}
        </CardTitle>
        <ApprovalStatusBadge status={step.status} />
      </CardHeader>
      <CardContent className="text-xs space-y-1 text-muted-foreground">
        <p>Approver role: {step.approver_role}</p>
        {step.approver_name && <p>Approved by: {step.approver_name}</p>}
        <p>Due: {step.due_date || '—'}</p>
        {step.e_signature_required && <p className="text-blue-700 font-medium">E-signature required</p>}
        {step.comments && <p className="italic text-foreground mt-1">{step.comments}</p>}
        {step.rejection_reason && <p className="text-red-600">{step.rejection_reason}</p>}
      </CardContent>
    </Card>
  );
}
