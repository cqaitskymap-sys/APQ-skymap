'use client';

import { User } from 'lucide-react';

export function DeviationAuditUserBadge({ name, role }: { name: string; role?: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border bg-slate-50 px-2 py-0.5 text-xs text-slate-700">
      <User className="h-3 w-3" />
      <span className="font-medium">{name || 'System'}</span>
      {role && <span className="text-muted-foreground">({role.replace(/_/g, ' ')})</span>}
    </span>
  );
}
