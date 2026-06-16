'use client';

import { cn } from '@/lib/utils';

const COLORS: Record<string, string> = {
  Draft: 'bg-slate-100 text-slate-700 border-slate-200',
  Open: 'bg-blue-100 text-blue-800 border-blue-200',
  'Under Implementation': 'bg-indigo-100 text-indigo-800 border-indigo-200',
  'Pending Verification': 'bg-cyan-100 text-cyan-800 border-cyan-200',
  'Effectiveness Check Pending': 'bg-purple-100 text-purple-800 border-purple-200',
  Closed: 'bg-green-100 text-green-800 border-green-200',
  Overdue: 'bg-red-100 text-red-800 border-red-200 animate-pulse',
};

export function OosCapaStatusBadge({ status, overdue }: { status?: string | null; overdue?: boolean }) {
  const label = overdue && status !== 'Closed' ? 'Overdue' : (status || 'Draft');
  return (
    <span className={cn('inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium', COLORS[label] || COLORS.Draft)}>
      {label}
    </span>
  );
}
