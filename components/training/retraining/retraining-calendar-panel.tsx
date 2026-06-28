'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { CalendarDays } from 'lucide-react';
import type { RetrainingRecord } from '@/lib/training-retraining-types';

export function RetrainingCalendarPanel({ upcoming }: { upcoming: RetrainingRecord[] }) {
  const byDate = upcoming.reduce<Record<string, RetrainingRecord[]>>((acc, r) => {
    const key = r.due_date || 'Unscheduled';
    if (!acc[key]) acc[key] = [];
    acc[key].push(r);
    return acc;
  }, {});

  const dates = Object.keys(byDate).sort().slice(0, 8);

  return (
    <Card className="border-slate-200">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <CalendarDays className="h-4 w-4" /> Training Schedule
        </CardTitle>
        <Link href="/qms/training/calendar" className="text-xs text-blue-600 hover:underline">Open Calendar</Link>
      </CardHeader>
      <CardContent className="space-y-3 max-h-[320px] overflow-y-auto">
        {dates.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">No upcoming retraining scheduled</p>
        ) : dates.map((date) => (
          <div key={date} className="border-l-2 border-blue-400 pl-3">
            <p className="text-xs font-semibold text-blue-700">{date}</p>
            {byDate[date].map((r) => (
              <p key={r.id} className="text-xs text-muted-foreground mt-1">
                {r.employee_name} — {r.training_topic}
              </p>
            ))}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
