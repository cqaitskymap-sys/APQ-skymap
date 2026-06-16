'use client';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const LEVEL_COLORS: Record<string, string> = {
  Executive: 'bg-slate-100 text-slate-700 border-slate-200',
  Manager: 'bg-blue-100 text-blue-800 border-blue-200',
  'Senior Manager': 'bg-indigo-100 text-indigo-800 border-indigo-200',
  Head: 'bg-purple-100 text-purple-800 border-purple-200',
  Director: 'bg-violet-100 text-violet-800 border-violet-200',
  GM: 'bg-emerald-100 text-emerald-800 border-emerald-200',
};

export function DesignationLevelBadge({ level }: { level?: string }) {
  const label = level || 'Executive';
  const color = LEVEL_COLORS[label] || 'bg-gray-100 text-gray-700 border-gray-200';
  return (
    <Badge variant="outline" className={cn('text-xs font-medium', color)}>
      {label}
    </Badge>
  );
}
