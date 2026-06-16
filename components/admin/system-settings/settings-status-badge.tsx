'use client';

import { Badge } from '@/components/ui/badge';

export function SettingsStatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    Connected: 'bg-green-100 text-green-700',
    Degraded: 'bg-amber-100 text-amber-700',
    'Not Configured': 'bg-red-100 text-red-700',
    Active: 'bg-green-100 text-green-700',
    Inactive: 'bg-slate-100 text-slate-600',
  };
  return (
    <Badge variant="outline" className={`text-xs ${colors[status] || ''}`}>
      {status}
    </Badge>
  );
}
