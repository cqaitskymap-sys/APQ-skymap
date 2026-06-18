'use client';

import { Progress } from '@/components/ui/progress';
import { computePreventiveActionProgress } from '@/lib/capa-preventive-action-records';
import type { CapaPreventiveAction } from '@/lib/capa-types';

export function CapaPreventiveActionProgress({ action }: { action: CapaPreventiveAction }) {
  const value = computePreventiveActionProgress(action);
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Progress</span>
        <span>{value}%</span>
      </div>
      <Progress value={value} className="h-2" />
    </div>
  );
}
