'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { TrainingRoom, TrainingEvent } from '@/lib/training-calendar-types';

interface RoomAvailabilityProps {
  rooms: TrainingRoom[];
  events: TrainingEvent[];
  date: string;
}

export function RoomAvailability({ rooms, events, date }: RoomAvailabilityProps) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm">Room Availability — {date}</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {rooms.map((room) => {
          const booked = events.filter((e) =>
            e.room === room.room_name
            && e.start_date <= date && e.end_date >= date
            && !['Cancelled', 'Closed'].includes(e.status));
          const available = booked.length === 0;
          return (
            <div key={room.id} className="flex items-center justify-between text-sm border rounded-md p-2">
              <div>
                <p className="font-medium">{room.room_name}</p>
                <p className="text-xs text-muted-foreground">{room.location} · Cap {room.capacity}</p>
              </div>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${available ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                {available ? 'Available' : `${booked.length} booked`}
              </span>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

interface TrainerAvailabilityProps {
  trainers: { id: string; full_name: string; department: string; max_sessions_per_day: number }[];
  events: TrainingEvent[];
  date: string;
}

export function TrainerAvailability({ trainers, events, date }: TrainerAvailabilityProps) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm">Trainer Availability — {date}</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {trainers.map((t) => {
          const sessions = events.filter((e) =>
            e.trainer === t.full_name
            && e.start_date <= date && e.end_date >= date
            && !['Cancelled', 'Closed'].includes(e.status));
          const available = sessions.length < t.max_sessions_per_day;
          return (
            <div key={t.id} className="flex items-center justify-between text-sm border rounded-md p-2">
              <div>
                <p className="font-medium">{t.full_name}</p>
                <p className="text-xs text-muted-foreground">{t.department}</p>
              </div>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${available ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
                {sessions.length}/{t.max_sessions_per_day} sessions
              </span>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

export { TrainerAvailability as default };
