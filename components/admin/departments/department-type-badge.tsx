'use client';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const TYPE_COLORS: Record<string, string> = {
  QA: 'bg-blue-100 text-blue-800 border-blue-200',
  QC: 'bg-cyan-100 text-cyan-800 border-cyan-200',
  Production: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  Warehouse: 'bg-amber-100 text-amber-800 border-amber-200',
  Engineering: 'bg-purple-100 text-purple-800 border-purple-200',
  Regulatory: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  Admin: 'bg-slate-100 text-slate-800 border-slate-200',
};

export function DepartmentTypeBadge({ type }: { type?: string }) {
  const label = type || 'Other';
  const color = TYPE_COLORS[label] || 'bg-gray-100 text-gray-700 border-gray-200';
  return (
    <Badge variant="outline" className={cn('text-xs font-medium', color)}>
      {label}
    </Badge>
  );
}
