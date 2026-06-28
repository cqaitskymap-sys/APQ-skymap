'use client';

import { cn } from '@/lib/utils';
import { certificateStatusColor } from '@/lib/training-certificate-types';

export function CertificateStatusBadge({ status }: { status: string }) {
  return (
    <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium', certificateStatusColor(status))}>
      {status}
    </span>
  );
}

export { CertificateStatusBadge as StatusBadge };
