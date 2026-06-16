'use client';

import {
  processStatusColor,
  qualityStatusColor,
  riskLevelColor,
  summaryStatusColor,
} from '@/lib/pqr-summary-conclusion-records';

export function QualityStatusBadge({ status }: { status: string }) {
  return (
    <span className={`rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${qualityStatusColor(status)}`}>
      {status || '—'}
    </span>
  );
}

export function ProcessStatusBadge({ status }: { status: string }) {
  return (
    <span className={`rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${processStatusColor(status)}`}>
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

export function SummaryStatusBadge({ status }: { status: string }) {
  return (
    <span className={`rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${summaryStatusColor(status)}`}>
      {status || 'Draft'}
    </span>
  );
}
