'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import type { RetrainingRecord } from '@/lib/training-retraining-types';

export function ProgressCard({ record }: { record: RetrainingRecord }) {
  const statusProgress: Record<string, number> = {
    Draft: 10, Assigned: 25, Scheduled: 40, 'In Progress': 65,
    Completed: 100, Closed: 100, Failed: 50, Overdue: 30, Cancelled: 0,
  };
  const progress = statusProgress[String(record.retraining_status)] ?? 25;

  return (
    <Card className="border-slate-200">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{record.training_topic}</CardTitle>
        <p className="text-xs text-muted-foreground">{record.employee_name} · {record.retraining_number}</p>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex justify-between text-xs">
          <span>{record.retraining_status}</span>
          <span>{progress}%</span>
        </div>
        <Progress value={progress} className="h-2" />
        <p className="text-xs text-muted-foreground">Due: {record.due_date} · Trainer: {record.trainer || '—'}</p>
      </CardContent>
    </Card>
  );
}
