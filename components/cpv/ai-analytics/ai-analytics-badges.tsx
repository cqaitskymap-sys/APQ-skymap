'use client';

import type { AiRecommendationRecord } from '@/lib/cpv-ai-analytics-records';

export function AiInsightTimeline({ entries }: { entries: Array<{ action: string; user: string; at: string }> }) {
  if (!entries?.length) {
    return <p className="text-sm text-muted-foreground">No AI insight events yet.</p>;
  }
  return (
    <ol className="relative space-y-4 border-l border-slate-200 pl-4">
      {entries.map((entry, i) => (
        <li key={`${entry.action}-${i}`} className="relative">
          <span className="absolute -left-[1.35rem] top-1 h-3 w-3 rounded-full border-2 border-white bg-violet-600" />
          <div className="rounded-md border bg-white p-3 text-sm shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium">{entry.action}</p>
              <span className="text-xs text-muted-foreground">{new Date(entry.at).toLocaleString()}</span>
            </div>
            <p className="text-muted-foreground">{entry.user}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function PriorityBadge({ priority }: { priority: string }) {
  const cls = priority === 'Critical' ? 'bg-red-900/10 text-red-900 border-red-300'
    : priority === 'High' ? 'bg-red-50 text-red-700 border-red-200'
      : priority === 'Medium' ? 'bg-amber-50 text-amber-700 border-amber-200'
        : 'bg-green-50 text-green-700 border-green-200';
  return <span className={`rounded-md border px-2 py-0.5 text-xs font-medium ${cls}`}>{priority}</span>;
}

export function StatusBadge({ status }: { status: AiRecommendationRecord['status'] | string }) {
  const cls = status === 'Closed' ? 'bg-green-50 text-green-700 border-green-200'
    : status === 'Implemented' ? 'bg-blue-50 text-blue-700 border-blue-200'
      : status === 'Reviewed' ? 'bg-amber-50 text-amber-700 border-amber-200'
        : 'bg-slate-50 text-slate-700 border-slate-200';
  return <span className={`rounded-md border px-2 py-0.5 text-xs font-medium ${cls}`}>{status}</span>;
}
