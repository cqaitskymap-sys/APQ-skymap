'use client';

import { Badge } from '@/components/ui/badge';

export function DepartmentBadge({ department }: { department?: string }) {
  return (
    <Badge variant="outline" className="text-xs bg-indigo-50 text-indigo-700 border-indigo-200">
      {department || 'All'}
    </Badge>
  );
}
