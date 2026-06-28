'use client';

import { Card, CardContent } from '@/components/ui/card';
import { CalendarStatusBadge } from './calendar-status-badge';
import type { TrainingEvent } from '@/lib/training-calendar-types';
import { formatEventDateTime } from '@/lib/training-calendar-types';
import { Users, MapPin, Video } from 'lucide-react';

interface TrainingEventCardProps {
  event: TrainingEvent;
  onClick?: () => void;
  compact?: boolean;
}

export function TrainingEventCard({ event, onClick, compact }: TrainingEventCardProps) {
  return (
    <Card
      className={`border-l-4 border-l-blue-600 shadow-sm cursor-pointer hover:shadow-md transition-shadow ${onClick ? '' : ''}`}
      onClick={onClick}
    >
      <CardContent className={compact ? 'p-3' : 'p-4'}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate">{event.training_title}</p>
            <p className="text-xs text-muted-foreground">{event.event_number} · {event.training_type}</p>
          </div>
          <CalendarStatusBadge status={event.status} />
        </div>
        {!compact && (
          <div className="mt-2 space-y-1 text-xs text-muted-foreground">
            <p>{formatEventDateTime(event)}</p>
            <p className="flex items-center gap-1"><Users className="h-3 w-3" />{event.trainer}</p>
            {event.room && <p className="flex items-center gap-1"><MapPin className="h-3 w-3" />{event.room}</p>}
            {event.virtual_meeting_link && <p className="flex items-center gap-1 truncate"><Video className="h-3 w-3" />Virtual</p>}
            <p>{event.assigned_employees.length}/{event.capacity} enrolled
              {event.waiting_list.length > 0 && ` · ${event.waiting_list.length} waiting`}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
