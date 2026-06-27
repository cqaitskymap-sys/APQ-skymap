'use client';

import type { TrainingActivityEntry } from '@/lib/training-dashboard-records';

export function TrainingActivityTimeline({ entries }: { entries: TrainingActivityEntry[] }) {
  if (!entries?.length) {
    return <p className="text-sm text-muted-foreground">No recent training activity.</p>;
  }
  return (
    <ol className="relative space-y-4 border-l border-slate-200 pl-4">
      {entries.map((entry) => (
        <li key={entry.id} className="relative">
          <span className="absolute -left-[1.35rem] top-1 h-3 w-3 rounded-full border-2 border-white bg-blue-600" />
          <div className="rounded-md border bg-white p-3 text-sm shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium">{entry.title}</p>
              <span className="text-xs text-muted-foreground">
                {entry.timestamp ? new Date(entry.timestamp).toLocaleString() : '—'}
              </span>
            </div>
            <p className="text-muted-foreground">{entry.description}</p>
            {entry.type && <p className="mt-1 text-xs text-blue-600">{entry.type}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}
