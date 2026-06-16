'use client';

import { Progress } from '@/components/ui/progress';
import { computeCorrectiveActionProgress } from '@/lib/capa-corrective-action-records';
import type { CapaCorrectiveAction } from '@/lib/capa-types';

export function CapaCorrectiveActionProgress({ action }: { action: CapaCorrectiveAction }) {
  const value = computeCorrectiveActionProgress(action);
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
