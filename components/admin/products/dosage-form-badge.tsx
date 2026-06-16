'use client';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const COLORS: Record<string, string> = {
  Injection: 'bg-blue-100 text-blue-800 border-blue-200',
  Tablet: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  Capsule: 'bg-teal-100 text-teal-800 border-teal-200',
  Syrup: 'bg-amber-100 text-amber-800 border-amber-200',
};

export function DosageFormBadge({ form }: { form?: string }) {
  const label = form || 'Other';
  const color = COLORS[label] || 'bg-slate-100 text-slate-700 border-slate-200';
  return (
    <Badge variant="outline" className={cn('text-xs font-medium', color)}>{label}</Badge>
  );
}
