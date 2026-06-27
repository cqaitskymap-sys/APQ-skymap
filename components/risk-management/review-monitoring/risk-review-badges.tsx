'use client';

import { cn } from '@/lib/utils';
import {
  effectivenessColor,
  reviewStatusColor,
  riskLevelBadgeColor,
  trendColor,
} from '@/lib/risk-review-monitoring-records';

export function ReviewStatusBadge({ status }: { status?: string }) {
  return (
    <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium', reviewStatusColor(status))}>
      {status || 'Draft'}
    </span>
  );
}

export function RiskTrendBadge({ trend }: { trend?: string }) {
  return (
    <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium', trendColor(trend))}>
      {trend || '—'}
    </span>
  );
}

export function EffectivenessBadge({ evaluation }: { evaluation?: string }) {
  return (
    <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium', effectivenessColor(evaluation))}>
      {evaluation || '—'}
    </span>
  );
}

export function RiskLevelBadge({ level }: { level?: string }) {
  return (
    <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium', riskLevelBadgeColor(level))}>
      {level || '—'}
    </span>
  );
}

export function OverdueReviewBadge({ overdue }: { overdue: boolean }) {
  if (!overdue) return null;
  return <span className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium bg-red-100 text-red-800">Overdue</span>;
}
