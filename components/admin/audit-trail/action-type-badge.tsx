'use client';

import { Badge } from '@/components/ui/badge';

const COLORS: Record<string, string> = {
  Create: 'bg-green-100 text-green-800',
  Update: 'bg-blue-100 text-blue-800',
  Delete: 'bg-red-100 text-red-800',
  Approve: 'bg-emerald-100 text-emerald-800',
  Reject: 'bg-orange-100 text-orange-800',
  'Failed Login': 'bg-red-100 text-red-800',
  Login: 'bg-slate-100 text-slate-700',
  Export: 'bg-violet-100 text-violet-800',
  'E-Signature': 'bg-indigo-100 text-indigo-800',
  'System Setting Change': 'bg-amber-100 text-amber-800',
};

export function ActionTypeBadge({ action }: { action?: string }) {
  if (!action) return null;
  return (
    <Badge variant="outline" className={COLORS[action] || 'bg-slate-100 text-slate-700'}>
      {action}
    </Badge>
  );
}
