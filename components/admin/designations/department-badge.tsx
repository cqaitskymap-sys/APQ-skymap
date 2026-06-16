'use client';

import { Badge } from '@/components/ui/badge';

export function DepartmentBadge({ department }: { department?: string }) {
  return (
    <Badge variant="outline" className="text-xs font-medium bg-blue-50 text-blue-700 border-blue-200">
      {department || '—'}
    </Badge>
  );
}
