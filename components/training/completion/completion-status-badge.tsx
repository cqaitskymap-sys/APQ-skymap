'use client';

import { cn } from '@/lib/utils';
import {
  attendanceStatusColor, completionStatusColor, trainingResultColor,
} from '@/lib/training-completion-types';

export function AttendanceStatusBadge({ status }: { status: string }) {
  return (
    <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium', attendanceStatusColor(status))}>
      {status}
    </span>
  );
}

export function CompletionStatusBadge({ status }: { status: string }) {
  return (
    <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium', completionStatusColor(status))}>
      {status}
    </span>
  );
}

export function TrainingResultBadge({ result }: { result: string }) {
  return (
    <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium', trainingResultColor(result))}>
      {result || '—'}
    </span>
  );
}
