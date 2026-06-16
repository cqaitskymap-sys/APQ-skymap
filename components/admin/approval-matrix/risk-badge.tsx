'use client';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const COLORS: Record<string, string> = {
  Low: 'bg-green-100 text-green-800 border-green-200',
  Medium: 'bg-blue-100 text-blue-800 border-blue-200',
  High: 'bg-amber-100 text-amber-800 border-amber-200',
  Critical: 'bg-red-100 text-red-800 border-red-200',
  All: 'bg-slate-100 text-slate-700 border-slate-200',
};

export function RiskBadge({ risk }: { risk?: string }) {
  const label = risk || 'Medium';
  return (
    <Badge variant="outline" className={cn('text-xs font-medium', COLORS[label] || COLORS.Medium)}>
      {label}
    </Badge>
  );
}
