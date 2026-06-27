'use client';

import { cn } from '@/lib/utils';
import { impactBadgeColor, validationCategoryColor, validationStatusColor } from '@/lib/cc-validation-records';

export function CcValidationStatusBadge({ status }: { status?: string }) {
  return (
    <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium', validationStatusColor(status))}>
      {status || 'Draft'}
    </span>
  );
}

export function CcValidationCategoryBadge({ category }: { category?: string }) {
  return (
    <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium', validationCategoryColor(category))}>
      {category || '—'}
    </span>
  );
}

export function CcImpactBadge({ label, active }: { label: string; active: boolean }) {
  return (
    <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium', impactBadgeColor(active))}>
      {label}: {active ? 'Yes' : 'No'}
    </span>
  );
}
