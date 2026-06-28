'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { HistoryStatusBadge } from './employee-profile-card';
import type { TrainingHistoryEntry } from '@/lib/training-history-types';
import { cn } from '@/lib/utils';

export function HistoryEntryCard({ entry }: { entry: TrainingHistoryEntry }) {
  return (
    <Card className={cn('border-slate-200', entry.is_overdue && 'border-red-300')}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-sm font-semibold line-clamp-2">{entry.training_topic}</CardTitle>
          <HistoryStatusBadge status={String(entry.training_status)} />
        </div>
        <p className="text-xs font-mono text-muted-foreground">{entry.training_number}</p>
      </CardHeader>
      <CardContent className="text-xs space-y-1 text-muted-foreground">
        <p>{entry.training_type} · {entry.trainer || '—'}</p>
        <p>Completed: {entry.completion_date || '—'}</p>
        {entry.assessment_score != null && <p>Score: {entry.assessment_score}%</p>}
        {entry.is_expired_cert && <p className="text-red-600 font-medium">Certificate expired</p>}
      </CardContent>
    </Card>
  );
}
