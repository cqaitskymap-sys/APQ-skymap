'use client';

import type { OosCapaTimelineEntry } from '@/lib/oos-capa-records';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function OosCapaTimeline({ entries }: { entries: OosCapaTimelineEntry[] }) {
  const defaults: OosCapaTimelineEntry[] = [
    { date: '', title: 'CAPA Created', description: 'Awaiting events' },
    { date: '', title: 'Action Assigned', description: '' },
    { date: '', title: 'Implementation Started', description: '' },
    { date: '', title: 'Implementation Completed', description: '' },
    { date: '', title: 'Effectiveness Checked', description: '' },
    { date: '', title: 'CAPA Closed', description: '' },
  ];

  const merged = defaults.map((d) => {
    const match = entries.find((e) => e.title.toLowerCase().includes(d.title.toLowerCase().split(' ')[0]));
    return match || d;
  });

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">CAPA Timeline</CardTitle></CardHeader>
      <CardContent>
        <ol className="relative space-y-4 border-l border-blue-200 pl-4">
          {merged.map((e, i) => (
            <li key={i} className="text-sm">
              <span className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full bg-blue-500" />
              <p className="font-medium">{e.title}</p>
              {e.description && <p className="text-muted-foreground">{e.description}</p>}
              {e.date && <p className="text-xs text-muted-foreground">{e.user ? `${e.user} · ` : ''}{e.date.slice(0, 19).replace('T', ' ')}</p>}
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
