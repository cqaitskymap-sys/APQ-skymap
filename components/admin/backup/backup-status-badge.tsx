'use client';

import { Badge } from '@/components/ui/badge';

const STATUS_COLORS: Record<string, string> = {
  Pending: 'bg-slate-100 text-slate-700',
  'In Progress': 'bg-blue-100 text-blue-700',
  Completed: 'bg-green-100 text-green-700',
  Success: 'bg-green-100 text-green-700',
  Verified: 'bg-emerald-100 text-emerald-700',
  Failed: 'bg-red-100 text-red-700',
  Restored: 'bg-purple-100 text-purple-700',
  Requested: 'bg-amber-100 text-amber-700',
  Approved: 'bg-blue-100 text-blue-700',
  Cancelled: 'bg-slate-100 text-slate-600',
};

export function BackupStatusBadge({ status }: { status?: string }) {
  const s = status || 'Pending';
  return (
    <Badge variant="outline" className={`text-xs ${STATUS_COLORS[s] || 'bg-slate-100'}`}>
      {s}
    </Badge>
  );
}
