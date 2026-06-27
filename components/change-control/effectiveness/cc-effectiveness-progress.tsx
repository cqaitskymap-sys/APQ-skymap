'use client';

import { computeEffectivenessProgress } from '@/lib/cc-effectiveness-records';
import type { ChangeEffectivenessReview } from '@/lib/change-control-types';
import { Progress } from '@/components/ui/progress';

export function CcEffectivenessProgress({ review }: { review?: ChangeEffectivenessReview | null }) {
  const value = computeEffectivenessProgress(review);
  return (
    <div className="flex min-w-[100px] items-center gap-2">
      <Progress value={value} className="h-2 flex-1" />
      <span className="text-xs tabular-nums text-muted-foreground">{value}%</span>
    </div>
  );
}
