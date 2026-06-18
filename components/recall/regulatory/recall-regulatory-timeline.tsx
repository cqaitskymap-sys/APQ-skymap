'use client';

import { cn } from '@/lib/utils';
import type { RecallRegulatoryTimelineEntry } from '@/lib/recall-types';

export function RecallRegulatoryTimeline({ entries }: { entries: RecallRegulatoryTimelineEntry[] }) {
  if (!entries.length) {
    return <p className="text-sm text-muted-foreground py-6 text-center">No timeline events yet</p>;
  }

  return (
    <div className="space-y-4">
      {entries.map((entry, i) => (
        <div key={`${entry.date}-${entry.title}-${i}`} className="flex gap-4">
          <div className="flex flex-col items-center">
            <div className={cn('h-3 w-3 rounded-full shrink-0', i === 0 ? 'bg-blue-600' : 'bg-slate-300')} />
            {i < entries.length - 1 && <div className="w-px flex-1 bg-slate-200 min-h-[24px]" />}
          </div>
          <div className="pb-4 flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium text-sm">{entry.title}</p>
              {entry.status && (
                <span className="text-xs rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">{entry.status}</span>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">{entry.description}</p>
            <p className="text-xs text-muted-foreground mt-1">{entry.user} · {entry.date.slice(0, 10)}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
