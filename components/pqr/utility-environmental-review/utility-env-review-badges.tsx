'use client';

import { complianceStatusColor, excursionBadgeColor, gradeBadgeColor, riskLevelColor } from '@/lib/pqr-utility-environmental-review-records';

export function ComplianceBadge({ status }: { status: string }) {
  return <span className={`rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${complianceStatusColor(status)}`}>{status}</span>;
}

export function RiskBadge({ level }: { level: string }) {
  return <span className={`rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${riskLevelColor(level)}`}>{level}</span>;
}

export function GradeBadge({ grade }: { grade: string }) {
  if (!grade || grade === 'Unclassified') return <span className="text-xs text-muted-foreground">—</span>;
  return <span className={`rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${gradeBadgeColor(grade)}`}>{grade}</span>;
}

export function ExcursionBadge({ count }: { count: number }) {
  return <span className={`rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${excursionBadgeColor(count)}`}>{count}</span>;
}
