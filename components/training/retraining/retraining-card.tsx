'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RetrainingStatusBadge } from './retraining-status-badge';
import type { RetrainingRecord } from '@/lib/training-retraining-types';
import { Calendar, User, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

export function RetrainingCard({ record, onClick }: { record: RetrainingRecord; onClick?: () => void }) {
  const isOverdue = record.retraining_status === 'Overdue';
  const daysLeft = record.due_date
    ? Math.ceil((new Date(record.due_date).getTime() - Date.now()) / 86400000)
    : null;

  return (
    <Card
      className={cn('cursor-pointer transition-shadow hover:shadow-md border-slate-200', isOverdue && 'border-red-300')}
      onClick={onClick}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-sm font-semibold line-clamp-2">{record.training_topic}</CardTitle>
          <RetrainingStatusBadge status={String(record.retraining_status)} />
        </div>
        <p className="text-xs font-mono text-muted-foreground">{record.retraining_number}</p>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <User className="h-3.5 w-3.5" />
          <span>{record.employee_name}</span>
          <span className="text-xs">· {record.department}</span>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
          <span className={cn(isOverdue && 'text-red-600 font-medium')}>Due: {record.due_date}</span>
          {daysLeft != null && daysLeft >= 0 && daysLeft <= 7 && (
            <span className="text-xs text-amber-600">{daysLeft}d left</span>
          )}
        </div>
        <div className="flex flex-wrap gap-1">
          <span className="rounded bg-slate-100 px-2 py-0.5 text-xs">{record.trigger_type}</span>
          {record.trainer && <span className="rounded bg-blue-50 px-2 py-0.5 text-xs text-blue-700">{record.trainer}</span>}
        </div>
        {isOverdue && (
          <div className="flex items-center gap-1 text-xs text-red-600">
            <AlertTriangle className="h-3 w-3" /> Overdue — escalation required
          </div>
        )}
      </CardContent>
    </Card>
  );
}
