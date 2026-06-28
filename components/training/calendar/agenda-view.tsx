'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { TrainingEvent } from '@/lib/training-calendar-types';
import { CalendarStatusBadge } from './calendar-status-badge';
import { formatEventDateTime } from '@/lib/training-calendar-types';

interface AgendaViewProps {
  events: TrainingEvent[];
  title?: string;
  onSelect?: (event: TrainingEvent) => void;
}

export function AgendaView({ events, title = 'Agenda', onSelect }: AgendaViewProps) {
  const sorted = [...events].sort((a, b) =>
    a.start_date.localeCompare(b.start_date) || a.start_time.localeCompare(b.start_time));

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm">{title}</CardTitle></CardHeader>
      <CardContent className="p-0">
        {sorted.length === 0 ? (
          <p className="text-sm text-muted-foreground p-4 text-center">No events</p>
        ) : (
          <div className="divide-y max-h-[400px] overflow-y-auto">
            {sorted.map((e) => (
              <button
                key={e.id}
                type="button"
                onClick={() => onSelect?.(e)}
                className="w-full text-left p-3 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium truncate">{e.training_title}</p>
                  <CalendarStatusBadge status={e.status} />
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{formatEventDateTime(e)} · {e.trainer}</p>
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
