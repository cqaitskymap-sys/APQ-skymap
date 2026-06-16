'use client';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const COLORS: Record<string, string> = {
  Planned: 'bg-slate-100 text-slate-700 border-slate-200',
  Manufacturing: 'bg-blue-100 text-blue-800 border-blue-200',
  'Under QC Testing': 'bg-cyan-100 text-cyan-800 border-cyan-200',
  'Under QA Review': 'bg-indigo-100 text-indigo-800 border-indigo-200',
  Released: 'bg-green-100 text-green-800 border-green-200',
  Rejected: 'bg-red-100 text-red-800 border-red-200',
  Hold: 'bg-amber-100 text-amber-800 border-amber-200',
  Reworked: 'bg-orange-100 text-orange-800 border-orange-200',
  Reprocessed: 'bg-orange-100 text-orange-700 border-orange-200',
  Cancelled: 'bg-gray-100 text-gray-600 border-gray-200',
};

export function BatchStatusBadge({ status }: { status?: string }) {
  const label = status || 'Planned';
  return (
    <Badge variant="outline" className={cn('text-xs font-medium', COLORS[label] || COLORS.Planned)}>
      {label}
    </Badge>
  );
}
