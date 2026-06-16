'use client';

import { cn } from '@/lib/utils';

export function DeviationApprovalTimeline({
  entries,
}: {
  entries: { date: string; title: string; description: string; user: string; step?: string }[];
}) {
  if (!entries.length) {
    return <p className="text-sm text-muted-foreground py-6 text-center">No approval events yet.</p>;
  }
  return (
    <div className="space-y-4">
      {entries.map((e, i) => (
        <div key={`${e.date}-${i}`} className="relative pl-6">
          <div className={cn('absolute left-0 top-1.5 h-2.5 w-2.5 rounded-full bg-blue-500', i === 0 && 'ring-4 ring-blue-100')} />
          {i < entries.length - 1 && <div className="absolute left-[4px] top-4 h-full w-0.5 bg-border" />}
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium">{e.title}</p>
            {e.step && <span className="text-xs rounded bg-muted px-1.5 py-0.5">{e.step}</span>}
          </div>
          <p className="text-xs text-muted-foreground">{e.date}</p>
          {e.description && <p className="text-sm text-muted-foreground mt-0.5">{e.description}</p>}
          {e.user && <p className="text-xs text-muted-foreground">By {e.user}</p>}
        </div>
      ))}
    </div>
  );
}
