'use client';

import { batchStatusColor, releaseStatusColor } from '@/lib/pqr-batch-review-records';

export function BatchStatusBadge({ status }: { status: string }) {
  return (
    <span className={`rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${batchStatusColor(status)}`}>
      {status}
    </span>
  );
}

export function ReleaseStatusBadge({ status }: { status: string }) {
  return (
    <span className={`rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${releaseStatusColor(status)}`}>
      {status}
    </span>
  );
}
