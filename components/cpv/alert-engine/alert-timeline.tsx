'use client';

import type { AlertTimelineEntry } from '@/lib/cpv-alert-records';

export function AlertTimeline({ entries }: { entries: AlertTimelineEntry[] }) {
  if (!entries?.length) {
    return <p className="text-sm text-muted-foreground">No timeline events yet.</p>;
  }
  return (
    <ol className="relative space-y-4 border-l border-slate-200 pl-4">
      {entries.map((entry, i) => (
        <li key={`${entry.action}-${i}`} className="relative">
          <span className="absolute -left-[1.35rem] top-1 h-3 w-3 rounded-full border-2 border-white bg-blue-600" />
          <div className="rounded-md border bg-white p-3 text-sm shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium capitalize">{entry.action}</p>
              <span className="text-xs text-muted-foreground">{new Date(entry.at).toLocaleString()}</span>
            </div>
            <p className="text-muted-foreground">{entry.user}</p>
            {entry.remarks && <p className="mt-1">{entry.remarks}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}
