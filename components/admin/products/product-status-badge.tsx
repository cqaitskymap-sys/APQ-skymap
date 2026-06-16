'use client';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const COLORS: Record<string, string> = {
  Active: 'bg-green-100 text-green-800 border-green-200',
  Inactive: 'bg-gray-100 text-gray-700 border-gray-200',
  Discontinued: 'bg-red-100 text-red-800 border-red-200',
  'Under Development': 'bg-purple-100 text-purple-800 border-purple-200',
};

export function ProductStatusBadge({ status }: { status?: string }) {
  const label = status || 'Active';
  return (
    <Badge variant="outline" className={cn('text-xs font-medium', COLORS[label] || COLORS.Active)}>
      {label}
    </Badge>
  );
}
