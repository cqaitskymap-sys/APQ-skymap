'use client';

import { cn } from '@/lib/utils';
import { closureStatusColor } from '@/lib/capa-closure-records';
import { CheckCircle2, Circle } from 'lucide-react';
import type { CapaClosureChecklistItem } from '@/lib/capa-closure-records';
import type { CapaClosureTimelineEntry } from '@/lib/capa-types';

export function CapaClosureStatusBadge({ status }: { status?: string }) {
  return (
    <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium', closureStatusColor(status))}>
      {status || 'Pending'}
    </span>
  );
}

export function CapaClosureReadinessBar({ percent }: { percent: number }) {
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

export function CapaClosureChecklistCard({ item }: { item: CapaClosureChecklistItem }) {
  return (
    <div className={cn(
      'rounded-lg border p-3 text-sm',
      item.complete ? 'border-green-200 bg-green-50/40' : item.required ? 'border-amber-200 bg-amber-50/30' : 'bg-card',
    )}>
      <div className="flex items-start gap-2">
        {item.complete
          ? <CheckCircle2 className="mt-0.5 h-4 w-4 text-green-600 shrink-0" />
          : <Circle className="mt-0.5 h-4 w-4 text-muted-foreground shrink-0" />}
        <div>
          <p className="font-medium">{item.label}{item.required ? ' *' : ''}</p>
          {item.warning && !item.complete && <p className="text-xs text-amber-700 mt-0.5">{item.warning}</p>}
        </div>
      </div>
    </div>
  );
}

export function CapaClosureTimeline({ entries }: { entries: CapaClosureTimelineEntry[] }) {
  if (!entries?.length) return <p className="text-sm text-muted-foreground py-4 text-center">No closure events yet.</p>;
  return (
    <div className="space-y-3">
      {entries.map((e, i) => (
        <div key={`${e.at}-${i}`} className="border-b pb-2 text-sm last:border-0">
          <div className="flex justify-between gap-2">
            <span className="font-medium">{e.action}</span>
            <span className="text-xs text-muted-foreground">{e.at ? new Date(e.at).toLocaleString() : '—'}</span>
          </div>
          {e.detail && <p className="text-muted-foreground">{e.detail}</p>}
          {e.user && <p className="text-xs text-muted-foreground">By {e.user}</p>}
        </div>
      ))}
    </div>
  );
}
