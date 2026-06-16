'use client';

import { cn } from '@/lib/utils';

const COLORS: Record<string, string> = {
  Draft: 'bg-slate-100 text-slate-700',
  Submitted: 'bg-blue-100 text-blue-800',
  'QA Review': 'bg-purple-100 text-purple-800',
  Approved: 'bg-green-100 text-green-800',
  Rejected: 'bg-red-100 text-red-800',
};

export function ImpactStatusBadge({ status }: { status?: string | null }) {
  const label = status || 'Draft';
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', COLORS[label] || COLORS.Draft)}>
      {label}
    </span>
  );
}
