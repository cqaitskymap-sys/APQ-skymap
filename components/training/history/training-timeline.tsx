'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { HistoryStatusBadge } from './employee-profile-card';
import type { TimelineEvent } from '@/lib/training-history-types';
import {
  GraduationCap, Award, RefreshCw, FileText, ClipboardCheck, Shield,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const TYPE_ICONS: Record<string, typeof GraduationCap> = {
  training: GraduationCap,
  assessment: ClipboardCheck,
  competency: Award,
  certificate: Shield,
  retraining: RefreshCw,
  sop: FileText,
  audit: Shield,
};

const TYPE_COLORS: Record<string, string> = {
  training: 'border-blue-400 bg-blue-50',
  assessment: 'border-purple-400 bg-purple-50',
  competency: 'border-teal-400 bg-teal-50',
  certificate: 'border-green-400 bg-green-50',
  retraining: 'border-amber-400 bg-amber-50',
  sop: 'border-slate-400 bg-slate-50',
  audit: 'border-indigo-400 bg-indigo-50',
};

export function TrainingTimeline({ events }: { events: TimelineEvent[] }) {
  if (events.length === 0) {
    return (
      <Card className="border-slate-200">
        <CardContent className="py-8 text-center text-sm text-muted-foreground">No timeline events</CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-slate-200">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Training Timeline</CardTitle>
      </CardHeader>
      <CardContent className="max-h-[480px] overflow-y-auto">
        <div className="relative space-y-0">
          {events.slice(0, 50).map((event, i) => {
            const Icon = TYPE_ICONS[event.type] || GraduationCap;
            return (
              <div key={event.id} className="flex gap-3 pb-6 relative">
                {i < events.length - 1 && (
                  <div className="absolute left-[15px] top-8 bottom-0 w-px bg-slate-200" />
                )}
                <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2', TYPE_COLORS[event.type] || TYPE_COLORS.training)}>
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <div className="flex-1 min-w-0 pt-0.5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium line-clamp-1">{event.title}</p>
                    <HistoryStatusBadge status={event.status} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{event.description}</p>
                  <p className="text-xs text-blue-600 mt-1">{event.date}</p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
