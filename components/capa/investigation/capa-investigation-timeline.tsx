'use client';

import type { CapaInvestigationTimelineEntry } from '@/lib/capa-types';

export function CapaInvestigationTimeline({ entries }: { entries: CapaInvestigationTimelineEntry[] }) {
  if (!entries?.length) {
    return <p className="text-sm text-muted-foreground">No investigation activity recorded yet.</p>;
  }
  return (
    <ol className="relative space-y-4 border-l border-slate-200 pl-4 dark:border-slate-700">
      {entries.map((entry, i) => (
        <li key={`${entry.action}-${entry.at}-${i}`} className="relative">
          <span className="absolute -left-[1.35rem] top-1 h-3 w-3 rounded-full border-2 border-white bg-blue-600 dark:border-slate-900" />
          <div className="rounded-md border bg-white p-3 text-sm shadow-sm dark:bg-slate-900">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium">{entry.action.replace(/_/g, ' ')}</p>
              <span className="text-xs text-muted-foreground">
                {entry.at ? new Date(entry.at).toLocaleString() : '—'}
              </span>
            </div>
            <p className="text-muted-foreground">{entry.user}</p>
            {entry.detail && <p className="mt-1 text-xs">{entry.detail}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}
