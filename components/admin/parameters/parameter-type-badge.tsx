'use client';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const COLORS: Record<string, string> = {
  CPP: 'bg-blue-100 text-blue-800 border-blue-200',
  CQA: 'bg-purple-100 text-purple-800 border-purple-200',
  IPC: 'bg-cyan-100 text-cyan-800 border-cyan-200',
  'Finished Product Test': 'bg-indigo-100 text-indigo-800 border-indigo-200',
  'Stability Test': 'bg-violet-100 text-violet-800 border-violet-200',
  'Utility Parameter': 'bg-amber-100 text-amber-800 border-amber-200',
  'Environmental Parameter': 'bg-teal-100 text-teal-800 border-teal-200',
  'Raw Material Test': 'bg-orange-100 text-orange-800 border-orange-200',
  'Packing Material Test': 'bg-pink-100 text-pink-800 border-pink-200',
  'Yield Parameter': 'bg-green-100 text-green-800 border-green-200',
};

export function ParameterTypeBadge({ type }: { type?: string }) {
  const label = type || 'CPP';
  return (
    <Badge variant="outline" className={cn('text-xs font-medium', COLORS[label] || COLORS.CPP)}>
      {label}
    </Badge>
  );
}
