'use client';

import { User } from 'lucide-react';

export function CcAuditUserBadge({ name, role }: { name: string; role?: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border bg-slate-50 dark:bg-slate-900/50 px-2 py-0.5 text-xs">
      <User className="h-3 w-3 text-muted-foreground" />
      <span className="font-medium">{name || 'System'}</span>
      {role && <span className="text-muted-foreground">· {role}</span>}
    </span>
  );
}
