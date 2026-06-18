'use client';

import type { ComplaintInvestigationTimelineEntry } from '@/lib/complaint-investigation-records';

export function ComplaintInvestigationTimeline({ entries }: { entries: ComplaintInvestigationTimelineEntry[] }) {
  if (!entries.length) {
    return <p className="text-sm text-muted-foreground">No investigation activity recorded.</p>;
  }
  return (
    <div className="space-y-4">
      {entries.map((entry, i) => (
        <div key={`${entry.at}-${i}`} className="relative border-l-2 border-blue-200 pl-4 pb-1">
          <p className="text-sm font-medium">{entry.action}</p>
          <p className="text-xs text-muted-foreground">{entry.user} · {entry.at ? new Date(entry.at).toLocaleString() : '—'}</p>
          {entry.detail && <p className="mt-1 text-xs text-muted-foreground">{entry.detail}</p>}
        </div>
      ))}
    </div>
  );
}
