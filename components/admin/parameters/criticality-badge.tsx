'use client';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const COLORS: Record<string, string> = {
  Critical: 'bg-red-100 text-red-800 border-red-200',
  Major: 'bg-amber-100 text-amber-800 border-amber-200',
  Minor: 'bg-slate-100 text-slate-700 border-slate-200',
};

export function CriticalityBadge({ criticality }: { criticality?: string }) {
  const label = criticality || 'Major';
  return (
    <Badge variant="outline" className={cn('text-xs font-medium', COLORS[label] || COLORS.Major)}>
      {label}
    </Badge>
  );
}
