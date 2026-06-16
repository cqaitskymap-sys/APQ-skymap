'use client';

import { Badge } from '@/components/ui/badge';

export function EsignActionBadge({ action }: { action?: string }) {
  if (!action) return null;
  return (
    <Badge variant="outline" className="bg-indigo-50 text-indigo-800 text-xs">
      {action}
    </Badge>
  );
}
