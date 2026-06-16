'use client';

export function OosAuditUserBadge({ name, role }: { name: string; role?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border bg-slate-50 px-2 py-0.5 text-xs dark:bg-slate-900/50">
      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-[10px] font-bold text-blue-700">
        {(name || '?').charAt(0).toUpperCase()}
      </span>
      <span className="font-medium">{name || 'System'}</span>
      {role && <span className="text-muted-foreground">· {role.replace(/_/g, ' ')}</span>}
    </span>
  );
}
