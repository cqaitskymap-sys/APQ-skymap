'use client';

import { riskColor, statusColor } from '@/lib/pqr-dashboard-records';

export function PqrStatusBadge({ status }: { status: string }) {
  return <span className={`rounded-md border px-2 py-0.5 text-xs font-medium ${statusColor(status)}`}>{status}</span>;
}

export function PqrRiskBadge({ level }: { level: string }) {
  return <span className={`rounded-md border px-2 py-0.5 text-xs font-medium ${riskColor(level)}`}>{level}</span>;
}
