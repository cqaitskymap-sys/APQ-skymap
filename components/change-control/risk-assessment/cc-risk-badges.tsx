'use client';

import { cn } from '@/lib/utils';
import { ccRiskLevelColor, ccRiskStatusColor } from '@/lib/cc-risk-records';

export function CcRiskLevelBadge({ level }: { level?: string }) {
  return (
    <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium', ccRiskLevelColor(level))}>
      {level || '—'}
    </span>
  );
}

export function CcRiskStatusBadge({ status }: { status?: string }) {
  return (
    <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium', ccRiskStatusColor(status))}>
      {status || 'Draft'}
    </span>
  );
}

export function CcRpnBadge({ rpn, level }: { rpn?: number; level?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums', ccRiskLevelColor(level))}>
      RPN {rpn ?? 0}
    </span>
  );
}

export function CcRiskCategoryBadge({ category }: { category?: string }) {
  return (
    <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
      {category || 'Other'}
    </span>
  );
}
