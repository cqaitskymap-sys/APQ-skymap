'use client';

import { computeValidationProgress } from '@/lib/cc-validation-records';
import type { CcValidationAssessment } from '@/lib/change-control-types';
import { Progress } from '@/components/ui/progress';

export function CcValidationProgress({ assessment }: { assessment?: CcValidationAssessment | null }) {
  const value = assessment?.progress_percent ?? computeValidationProgress(assessment);
  return (
    <div className="flex min-w-[100px] items-center gap-2">
      <Progress value={value} className="h-2 flex-1" />
      <span className="text-xs tabular-nums text-muted-foreground">{value}%</span>
    </div>
  );
}
