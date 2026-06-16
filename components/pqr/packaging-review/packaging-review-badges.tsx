'use client';

import {
  avlStatusColor, complianceStatusColor, qcStatusColor, reconciliationStatusColor, riskLevelColor,
} from '@/lib/pqr-packaging-review-records';

export function QcStatusBadge({ status }: { status: string }) {
  return <span className={`rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${qcStatusColor(status)}`}>{status}</span>;
}

export function AvlStatusBadge({ status }: { status: string }) {
  return <span className={`rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${avlStatusColor(status)}`}>{status}</span>;
}

export function ComplianceBadge({ status }: { status: string }) {
  return <span className={`rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${complianceStatusColor(status)}`}>{status}</span>;
}

export function ReconciliationBadge({ status }: { status: string }) {
  return <span className={`rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${reconciliationStatusColor(status)}`}>{status}</span>;
}

export function PackagingRiskBadge({ level }: { level: string }) {
  return <span className={`rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${riskLevelColor(level)}`}>{level}</span>;
}
