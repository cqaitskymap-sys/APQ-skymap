'use client';

import { Badge } from '@/components/ui/badge';
import { ADMIN_ROLES } from '@/lib/admin/constants';

const ROLE_COLORS: Record<string, string> = {
  super_admin: 'bg-purple-50 text-purple-700 border-purple-200',
  admin: 'bg-blue-50 text-blue-700 border-blue-200',
  head_qa: 'bg-teal-50 text-teal-700 border-teal-200',
  auditor: 'bg-slate-100 text-slate-700 border-slate-200',
};

export function RoleBadge({ role }: { role?: string }) {
  const label = ADMIN_ROLES.find((r) => r.id === role)?.name || role?.replace(/_/g, ' ') || 'Unknown';
  return (
    <Badge variant="outline" className={ROLE_COLORS[role || ''] || 'bg-slate-100 text-slate-600'}>
      {label}
    </Badge>
  );
}
