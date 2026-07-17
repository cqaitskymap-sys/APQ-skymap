'use client';

import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar as DayPickerCalendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { TrainingEvent, CalendarView } from '@/lib/training-calendar-types';
import { TrainingEventCard } from './training-event-card';

interface CalendarViewProps {
  events: TrainingEvent[];
  view?: CalendarView | string;
  onSelectEvent?: (event: TrainingEvent) => void;
  onSelectDate?: (date: Date) => void;
}

function getWeekDates(base: Date): Date[] {
  const start = new Date(base);
  start.setDate(start.getDate() - start.getDay());
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

function dateKey(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseLocalDate(value: string): Date {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function CalendarViewComponent({ events, view = 'Month', onSelectEvent, onSelectDate }: CalendarViewProps) {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [month, setMonth] = useState(new Date());

  const eventsByDate = useMemo(() => {
    const map = new Map<string, TrainingEvent[]>();
    for (const e of events) {
      const start = parseLocalDate(e.start_date);
      const end = parseLocalDate(e.end_date);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const key = dateKey(d);
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(e);
      }
    }
    return map;
  }, [events]);

  const dayEvents = eventsByDate.get(dateKey(selectedDate)) ?? [];

  if (view === 'Agenda') {
    const sorted = [...events].sort((a, b) => a.start_date.localeCompare(b.start_date) || a.start_time.localeCompare(b.start_time));
    return (
      <div className="space-y-2 max-h-[500px] overflow-y-auto">
        {sorted.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">No scheduled events</p>
          : sorted.map((e) => <TrainingEventCard key={e.id} event={e} onClick={() => onSelectEvent?.(e)} />)}
      </div>
    );
  }

  if (view === 'Week') {
    const weekDates = getWeekDates(selectedDate);
    return (
      <div className="grid grid-cols-7 gap-1">
        {weekDates.map((d) => {
          const key = dateKey(d);
          const dayItems = eventsByDate.get(key) ?? [];
          const isToday = key === dateKey(new Date());
          return (
            <div key={key} className={`min-h-[100px] border rounded-md p-1 ${isToday ? 'bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800' : 'bg-card'}`}>
              <p className="text-xs font-medium mb-1">{d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' })}</p>
              {dayItems.slice(0, 3).map((e) => (
                <button key={e.id} type="button" onClick={() => onSelectEvent?.(e)}
                  className="block w-full text-left text-[10px] truncate bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-200 rounded px-1 mb-0.5">
                  {e.start_time} {e.training_title}
                </button>
              ))}
              {dayItems.length > 3 && <p className="text-[10px] text-muted-foreground">+{dayItems.length - 3} more</p>}
            </div>
          );
        })}
      </div>
    );
  }

  if (view === 'Day') {
    return (
      <div className="space-y-2">
        <p className="text-sm font-medium">{selectedDate.toLocaleDateString(undefined, { weekday: 'long', dateStyle: 'long' })}</p>
        {dayEvents.length === 0 ? <p className="text-sm text-muted-foreground">No events today</p>
          : dayEvents.map((e) => <TrainingEventCard key={e.id} event={e} onClick={() => onSelectEvent?.(e)} />)}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Calendar</CardTitle>
          <div className="flex gap-1">
            <Button aria-label="Previous month" variant="ghost" size="icon" className="h-7 w-7" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button aria-label="Next month" variant="ghost" size="icon" className="h-7 w-7" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <DayPickerCalendar
            mode="single"
            selected={selectedDate}
            month={month}
            onMonthChange={setMonth}
            onSelect={(d) => {
              if (d) {
                setSelectedDate(d);
                onSelectDate?.(d);
              }
            }}
            modifiers={{
              hasEvent: (d) => eventsByDate.has(dateKey(d)),
            }}
            modifiersClassNames={{ hasEvent: 'bg-blue-100 dark:bg-blue-950/50 font-bold' }}
          />
        </CardContent>
      </Card>
      <div className="space-y-2">
        <p className="text-sm font-medium">{selectedDate.toLocaleDateString(undefined, { dateStyle: 'medium' })} — {dayEvents.length} event(s)</p>
        {dayEvents.map((e) => <TrainingEventCard key={e.id} event={e} onClick={() => onSelectEvent?.(e)} compact />)}
      </div>
    </div>
  );
}

export { CalendarViewComponent as CalendarView };
