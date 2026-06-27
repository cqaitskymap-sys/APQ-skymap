'use client';

import { cn } from '@/lib/utils';
import { impactOptionColor, impactRatingColor, impactStatusColor } from '@/lib/cc-impact-records';

export function CcImpactRatingBadge({ rating }: { rating?: string }) {
  return (
    <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium', impactRatingColor(rating))}>
      {rating || '—'}
    </span>
  );
}

export function CcImpactStatusBadge({ status }: { status?: string }) {
  return (
    <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium', impactStatusColor(status))}>
      {status || 'Draft'}
    </span>
  );
}

export function CcImpactOptionBadge({ value }: { value?: string }) {
  return (
    <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium', impactOptionColor(value))}>
      {value || 'No'}
    </span>
  );
}
