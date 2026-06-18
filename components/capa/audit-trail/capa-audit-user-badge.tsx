'use client';

export function CapaAuditUserBadge({ name, role }: { name: string; role?: string }) {
  return (
    <div className="inline-flex flex-col">
      <span className="text-xs font-medium">{name || 'System'}</span>
      {role && <span className="text-[10px] text-muted-foreground capitalize">{role.replace(/_/g, ' ')}</span>}
    </div>
  );
}
