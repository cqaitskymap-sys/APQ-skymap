'use client';

import { cn } from '@/lib/utils';
import { rcaCategoryColor } from '@/lib/capa-investigation-records';

export function CapaRcaCategoryBadge({ category }: { category?: string }) {
  if (!category) return <span className="text-muted-foreground text-xs">—</span>;
  return (
    <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium', rcaCategoryColor(category))}>
      {category}
    </span>
  );
}

export function CapaRiskBadge({ level }: { level?: string }) {
  const colors: Record<string, string> = {
    Low: 'bg-blue-100 text-blue-800',
    Medium: 'bg-amber-100 text-amber-800',
    High: 'bg-orange-100 text-orange-800',
    Critical: 'bg-red-100 text-red-800',
  };
  const label = level || 'Not Assessed';
  return (
    <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium', colors[label] || 'bg-slate-100 text-slate-700')}>
      {label}
    </span>
  );
}
