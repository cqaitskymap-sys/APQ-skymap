'use client';

import { Progress } from '@/components/ui/progress';
import { computeEffectivenessProgress } from '@/lib/capa-effectiveness-records';
import type { CapaEffectiveness } from '@/lib/capa-types';

export function CapaEffectivenessProgress({ review }: { review?: CapaEffectiveness | null }) {
  const value = computeEffectivenessProgress(review);
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Review Progress</span>
        <span>{value}%</span>
      </div>
      <Progress value={value} className="h-2" />
    </div>
  );
}
