'use client';

export function RiskAuditUserBadge({ name, role }: { name: string; role?: string }) {
  return (
    <span className="inline-flex flex-col text-xs">
      <span className="font-medium text-slate-800">{name || 'System'}</span>
      {role && <span className="text-muted-foreground">{role}</span>}
    </span>
  );
}
