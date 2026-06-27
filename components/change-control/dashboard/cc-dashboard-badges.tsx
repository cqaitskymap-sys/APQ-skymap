'use client';

import { cn } from '@/lib/utils';
import { riskLevelBadgeClass } from '@/lib/cc-dashboard-records';
import { CcStatusBadge, CcPriorityBadge, CcCategoryBadge } from '@/components/change-control/cc-sub-nav';

export function CcRiskBadge({ level }: { level: string }) {
  if (!level || level === '—') return <span className="text-muted-foreground">—</span>;
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium', riskLevelBadgeClass(level))}>
      {level}
    </span>
  );
}

export function CcDashboardStatusBadge({ status }: { status: string }) {
  return <CcStatusBadge status={status} />;
}

export { CcPriorityBadge, CcCategoryBadge };
