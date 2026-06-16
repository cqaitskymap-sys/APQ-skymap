'use client';

import { avlStatusColor, complianceStatusColor, qcStatusColor, riskLevelColor } from '@/lib/pqr-material-review-records';

export function QcStatusBadge({ status }: { status: string }) {
  return <span className={`rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${qcStatusColor(status)}`}>{status}</span>;
}

export function AvlStatusBadge({ status }: { status: string }) {
  return <span className={`rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${avlStatusColor(status)}`}>{status}</span>;
}

export function ComplianceBadge({ status }: { status: string }) {
  return <span className={`rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${complianceStatusColor(status)}`}>{status}</span>;
}

export function MaterialRiskBadge({ level }: { level: string }) {
  return <span className={`rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${riskLevelColor(level)}`}>{level}</span>;
}
