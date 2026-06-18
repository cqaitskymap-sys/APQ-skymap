'use client';

import { cn } from '@/lib/utils';
import { complaintClosureStatusColor } from '@/lib/complaint-closure-records';
import { CheckCircle2, Circle } from 'lucide-react';

export function ComplaintClosureStatusBadge({ status }: { status?: string }) {
  const label = status || 'Pending';
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', complaintClosureStatusColor(label))}>
      {label}
    </span>
  );
}

export function ComplaintClosureReadinessBar({ percent }: { percent: number }) {
  const color = percent >= 100 ? 'bg-green-500' : percent >= 70 ? 'bg-blue-500' : percent >= 40 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Closure Readiness</span>
        <span className="font-medium">{percent}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div className={cn('h-full transition-all', color)} style={{ width: `${Math.min(100, percent)}%` }} />
      </div>
    </div>
  );
}

export function ComplaintClosureChecklistCard({
  label, complete, required, warning,
}: {
  label: string; complete: boolean; required?: boolean; warning?: string;
}) {
  return (
    <div className={cn(
      'rounded-lg border p-3 text-sm',
      complete ? 'border-green-200 bg-green-50/40 dark:bg-green-950/20' : required ? 'border-amber-200 bg-amber-50/30 dark:bg-amber-950/20' : 'bg-card',
    )}>
      <div className="flex items-start gap-2">
        {complete ? <CheckCircle2 className="mt-0.5 h-4 w-4 text-green-600 shrink-0" /> : <Circle className="mt-0.5 h-4 w-4 text-muted-foreground shrink-0" />}
        <div>
          <p className="font-medium">{label}{required ? ' *' : ''}</p>
          {warning && !complete && <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">{warning}</p>}
        </div>
      </div>
    </div>
  );
}

export function ComplaintClosureTimeline({
  entries,
}: {
  entries: { date: string; title: string; description: string; user: string }[];
}) {
  if (!entries.length) return <p className="text-sm text-muted-foreground py-4 text-center">No closure events yet.</p>;
  return (
    <div className="space-y-3">
      {entries.map((e, i) => (
        <div key={`${e.date}-${i}`} className="border-b pb-2 text-sm last:border-0">
          <div className="flex justify-between gap-2">
            <span className="font-medium">{e.title}</span>
            <span className="text-xs text-muted-foreground">{e.date}</span>
          </div>
          {e.description && <p className="text-muted-foreground">{e.description}</p>}
          {e.user && <p className="text-xs text-muted-foreground">By {e.user}</p>}
        </div>
      ))}
    </div>
  );
}
