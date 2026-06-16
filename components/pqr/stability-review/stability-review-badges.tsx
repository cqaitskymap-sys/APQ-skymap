'use client';

import {
  complianceStatusColor,
  intervalBadgeColor,
  resultStatusColor,
  riskLevelColor,
  storageConditionBadgeColor,
} from '@/lib/pqr-stability-review-records';

export function ResultStatusBadge({ status }: { status: string }) {
  return (
    <span className={`rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${resultStatusColor(status)}`}>
      {status || '—'}
    </span>
  );
}

export function ComplianceBadge({ status }: { status: string }) {
  return (
    <span className={`rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${complianceStatusColor(status)}`}>
      {status || '—'}
    </span>
  );
}

export function RiskBadge({ level }: { level: string }) {
  return (
    <span className={`rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${riskLevelColor(level)}`}>
      {level || 'Low'}
    </span>
  );
}

export function StorageConditionBadge({ condition }: { condition: string }) {
  if (!condition) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <span className={`rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${storageConditionBadgeColor()}`}>
      {condition}
    </span>
  );
}

export function IntervalBadge({ interval }: { interval: string }) {
  if (!interval) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <span className={`rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${intervalBadgeColor()}`}>
      {interval}
    </span>
  );
}

export function OotOosBadge({ oot, oos }: { oot: number; oos: number }) {
  if (oot === 0 && oos === 0) return <span className="text-xs text-green-700">—</span>;
  return (
    <span className="text-xs font-medium">
      {oot > 0 && <span className="text-amber-700">OOT:{oot} </span>}
      {oos > 0 && <span className="text-red-700">OOS:{oos}</span>}
    </span>
  );
}
