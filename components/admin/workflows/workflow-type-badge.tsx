'use client';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export function WorkflowTypeBadge({ type }: { type?: string }) {
  const label = type || 'Multi Level Approval';
  return (
    <Badge variant="outline" className={cn('text-xs font-medium bg-violet-50 text-violet-800 border-violet-200')}>
      {label}
    </Badge>
  );
}
