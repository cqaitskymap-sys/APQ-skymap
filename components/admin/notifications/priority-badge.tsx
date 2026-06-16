'use client';

import { Badge } from '@/components/ui/badge';

const COLORS: Record<string, string> = {
  Low: 'bg-slate-100 text-slate-700',
  Medium: 'bg-blue-100 text-blue-800',
  High: 'bg-amber-100 text-amber-800',
  Critical: 'bg-red-100 text-red-800',
};

export function PriorityBadge({ priority }: { priority?: string }) {
  if (!priority) return null;
  return <Badge variant="outline" className={COLORS[priority] || 'bg-slate-100'}>{priority}</Badge>;
}
