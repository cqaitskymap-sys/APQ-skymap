'use client';

import { Progress } from '@/components/ui/progress';
import { LmsStatusBadge } from './status-badge';
import type { SyncProgressState } from '@/lib/lms-types';

interface SyncProgressProps {
  progress: SyncProgressState | null;
}

export function SyncProgress({ progress }: SyncProgressProps) {
  if (!progress) return null;

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Sync in Progress</p>
        <LmsStatusBadge status={progress.status} />
      </div>
      <Progress value={progress.progress} className="h-2" />
      <p className="text-xs text-muted-foreground">{progress.currentStep}</p>
      <div className="grid grid-cols-4 gap-2 text-xs text-center">
        <div><p className="font-bold">{progress.recordsProcessed}</p><p className="text-muted-foreground">Processed</p></div>
        <div><p className="font-bold text-green-600">{progress.recordsImported}</p><p className="text-muted-foreground">Imported</p></div>
        <div><p className="font-bold text-amber-600">{progress.recordsSkipped}</p><p className="text-muted-foreground">Skipped</p></div>
        <div><p className="font-bold text-red-600">{progress.recordsFailed}</p><p className="text-muted-foreground">Failed</p></div>
      </div>
    </div>
  );
}
