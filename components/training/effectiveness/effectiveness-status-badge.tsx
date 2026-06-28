'use client';

import { cn } from '@/lib/utils';
import {
  evaluationStatusColor, resultColor, competencyColor,
} from '@/lib/training-effectiveness-types';

export function EvaluationStatusBadge({ status }: { status: string }) {
  return (
    <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium', evaluationStatusColor(status))}>
      {status}
    </span>
  );
}

export function EvaluationResultBadge({ result }: { result: string }) {
  return (
    <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium', resultColor(result))}>
      {result || '—'}
    </span>
  );
}

export function CompetencyLevelBadge({ level }: { level: string }) {
  return (
    <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium', competencyColor(level))}>
      {level || '—'}
    </span>
  );
}
