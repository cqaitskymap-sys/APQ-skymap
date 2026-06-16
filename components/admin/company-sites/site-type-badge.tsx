'use client';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const TYPE_COLORS: Record<string, string> = {
  'Manufacturing Plant': 'bg-emerald-100 text-emerald-800 border-emerald-200',
  'Corporate Office': 'bg-blue-100 text-blue-800 border-blue-200',
  'R&D Site': 'bg-purple-100 text-purple-800 border-purple-200',
  Warehouse: 'bg-amber-100 text-amber-800 border-amber-200',
  'Testing Laboratory': 'bg-cyan-100 text-cyan-800 border-cyan-200',
  'Contract Manufacturing Site': 'bg-indigo-100 text-indigo-800 border-indigo-200',
};

export function SiteTypeBadge({ type }: { type?: string }) {
  const label = type || 'Manufacturing Plant';
  const color = TYPE_COLORS[label] || 'bg-gray-100 text-gray-700 border-gray-200';
  return (
    <Badge variant="outline" className={cn('text-xs font-medium', color)}>
      {label}
    </Badge>
  );
}
