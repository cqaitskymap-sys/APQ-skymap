'use client';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const COLORS: Record<string, string> = {
  Pending: 'bg-slate-100 text-slate-700 border-slate-200',
  Released: 'bg-green-100 text-green-800 border-green-200',
  Rejected: 'bg-red-100 text-red-800 border-red-200',
  'On Hold': 'bg-amber-100 text-amber-800 border-amber-200',
  'Not Applicable': 'bg-gray-100 text-gray-600 border-gray-200',
};

export function ReleaseStatusBadge({ status }: { status?: string }) {
  const label = status || 'Pending';
  return (
    <Badge variant="outline" className={cn('text-xs font-medium', COLORS[label] || COLORS.Pending)}>
      {label}
    </Badge>
  );
}
