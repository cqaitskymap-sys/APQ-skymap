'use client';

import type { CapaApprovalTimelineEntry } from '@/lib/capa-types';

export function CapaApprovalTimeline({ entries }: { entries: CapaApprovalTimelineEntry[] }) {
  if (!entries?.length) {
    return <p className="text-sm text-muted-foreground">No approval activity recorded yet.</p>;
  }
  return (
    <ol className="relative space-y-4 border-l border-slate-200 pl-4 dark:border-slate-700">
      {entries.map((entry, i) => (
        <li key={`${entry.action}-${entry.at}-${i}`} className="relative">
          <span className="absolute -left-[1.35rem] top-1 h-3 w-3 rounded-full border-2 border-white bg-indigo-600 dark:border-slate-900" />
          <div className="rounded-md border bg-white p-3 text-sm shadow-sm dark:bg-slate-900">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium">{entry.action}</p>
              <span className="text-xs text-muted-foreground">
                {entry.at ? new Date(entry.at).toLocaleString() : '—'}
              </span>
            </div>
            {entry.workflow_step && <p className="text-xs text-blue-600">{entry.workflow_step}</p>}
            <p className="text-muted-foreground">{entry.user}</p>
            {entry.detail && <p className="mt-1 text-xs">{entry.detail}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}
