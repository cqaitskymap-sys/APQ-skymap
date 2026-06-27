'use client';

import { buildGanttItems, mapCcImplementationAuditToTimeline } from '@/lib/cc-implementation-records';
import type { CcImplementationTask } from '@/lib/change-control-types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CcTaskStatusBadge } from './cc-implementation-badges';

function dateToOffset(dateStr: string, minDate: Date, rangeMs: number): number {
  const d = new Date(dateStr).getTime();
  return Math.max(0, Math.min(100, ((d - minDate.getTime()) / rangeMs) * 100));
}

export function CcImplementationGantt({ tasks }: { tasks: CcImplementationTask[] }) {
  const items = buildGanttItems(tasks);
  if (!items.length) {
    return <p className="text-sm text-muted-foreground py-8 text-center">Add tasks to view Gantt chart.</p>;
  }

  const dates = items.flatMap((i) => [new Date(i.start), new Date(i.end)]).filter((d) => !Number.isNaN(d.getTime()));
  if (!dates.length) {
    return <p className="text-sm text-muted-foreground py-8 text-center">Tasks need valid planned dates for Gantt view.</p>;
  }
  const minDate = new Date(Math.min(...dates.map((d) => d.getTime())));
  const maxDate = new Date(Math.max(...dates.map((d) => d.getTime())));
  const rangeMs = Math.max(maxDate.getTime() - minDate.getTime(), 86400000);

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Gantt Chart</CardTitle></CardHeader>
      <CardContent className="space-y-3 overflow-x-auto">
        {items.map((item) => {
          const left = dateToOffset(item.start, minDate, rangeMs);
          const right = dateToOffset(item.end, minDate, rangeMs);
          const width = Math.max(right - left, 2);
          return (
            <div key={item.id} className="min-w-[480px]">
              <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                <span className="truncate font-medium max-w-[200px]">{item.label}</span>
                <div className="flex items-center gap-2 shrink-0">
                  <CcTaskStatusBadge status={item.status} />
                  <span className="text-muted-foreground">{item.start} → {item.end}</span>
                </div>
              </div>
              <div className="relative h-6 rounded bg-muted">
                <div
                  className="absolute top-0.5 h-5 rounded bg-blue-500/80"
                  style={{ left: `${left}%`, width: `${width}%` }}
                />
                <div
                  className="absolute top-0.5 h-5 rounded bg-green-500/70"
                  style={{ left: `${left}%`, width: `${width * (item.progress / 100)}%` }}
                />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

export function CcImplementationTimeline({ auditLogs }: { auditLogs: Record<string, unknown>[] }) {
  const entries = mapCcImplementationAuditToTimeline(auditLogs);
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Audit Trail</CardTitle></CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">No implementation audit events yet.</p>
        ) : (
          <ol className="relative space-y-4 border-l border-border pl-4">
            {entries.map((e, i) => (
              <li key={i} className="text-sm">
                <p className="font-medium">{e.action}</p>
                <p className="text-xs text-muted-foreground">{e.user} · {e.at ? new Date(e.at).toLocaleString() : '—'}</p>
                {e.detail && <p className="mt-1 text-muted-foreground">{e.detail}</p>}
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
