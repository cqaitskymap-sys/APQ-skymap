'use client';

export function RecallAuditUserBadge({ name, role }: { name: string; role?: string }) {
  return (
    <span className="inline-flex flex-col text-xs">
      <span className="font-medium">{name || 'System'}</span>
      {role ? <span className="text-muted-foreground">{role.replace(/_/g, ' ')}</span> : null}
    </span>
  );
}
