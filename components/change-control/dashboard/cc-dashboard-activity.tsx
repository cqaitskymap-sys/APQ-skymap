'use client';

import Link from 'next/link';
import type { CcDashboardActivityEntry } from '@/lib/cc-dashboard-records';

export function CcDashboardActivityTimeline({ entries }: { entries: CcDashboardActivityEntry[] }) {
  if (!entries?.length) {
    return <p className="text-sm text-muted-foreground">No recent change control activity.</p>;
  }

  return (
    <ol className="relative space-y-4 border-l border-slate-200 pl-4">
      {entries.map((entry, i) => (
        <li key={`${entry.action}-${entry.at}-${i}`} className="relative">
          <span className="absolute -left-[1.35rem] top-1 h-3 w-3 rounded-full border-2 border-white bg-blue-600" />
          <div className="rounded-md border bg-white p-3 text-sm shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium">{entry.action}</p>
              <span className="text-xs text-muted-foreground">
                {entry.at ? new Date(entry.at).toLocaleString() : '—'}
              </span>
            </div>
            <p className="text-muted-foreground">{entry.user}</p>
            {entry.detail ? <p className="mt-1 text-xs">{entry.detail}</p> : null}
            {entry.recordId && entry.recordId !== 'cc-dashboard' ? (
              <Link
                href={`/qms/change-control/${entry.recordId}`}
                className="mt-2 inline-block text-xs text-blue-600 hover:underline"
              >
                View change control
              </Link>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
