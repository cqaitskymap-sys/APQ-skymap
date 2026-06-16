'use client';

import { Badge } from '@/components/ui/badge';

const COLORS: Record<string, string> = {
  Never: 'bg-slate-100 text-slate-700',
  Yearly: 'bg-blue-100 text-blue-700',
  Monthly: 'bg-violet-100 text-violet-700',
  Daily: 'bg-amber-100 text-amber-700',
};

export function ResetFrequencyBadge({ value }: { value?: string }) {
  if (!value) return null;
  return (
    <Badge variant="outline" className={COLORS[value] || 'bg-slate-100 text-slate-700'}>
      {value}
    </Badge>
  );
}
