'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Pencil } from 'lucide-react';
import { PageHeader } from '@/components/admin/dashboard/page-header';
import { StatusBadge } from '@/components/admin/dashboard/status-badge';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { EmptyState } from '@/components/admin/dashboard/empty-state';
import { PermissionMatrix } from './permission-matrix';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAdminPermissions } from '@/hooks/use-admin-permissions';
import { canEditRoles } from '@/lib/permissions';
import type { AdminRole, PermissionMatrix as PermMatrix } from '@/lib/admin/schemas';
import {
  fetchRoleWithPermissions, countUsersWithRole, fetchRoleAuditTrail,
} from '@/lib/admin/role-service';
import { buildDefaultRoleMatrix } from '@/lib/permissions';

export function RoleDetailView({ id }: { id: string }) {
  const router = useRouter();
  const { role: currentRole } = useAdminPermissions();
  const canEdit = canEditRoles(currentRole);

  const [role, setRole] = useState<AdminRole | null>(null);
  const [permissions, setPermissions] = useState<PermMatrix | null>(null);
  const [userCount, setUserCount] = useState(0);
  const [auditTrail, setAuditTrail] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const { role: r, permissions: p } = await fetchRoleWithPermissions(id);
        if (!r) {
          setError('Role not found');
          return;
        }
        setRole(r);
        setPermissions(p);
        setUserCount(await countUsersWithRole(r.roleId));
        setAuditTrail(await fetchRoleAuditTrail(id));
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  if (loading) return <LoadingSkeleton rows={2} />;
  if (error || !role) return <ErrorCard title="Not Found" message={error || 'Role not found'} />;

  const matrix = permissions?.permissions || buildDefaultRoleMatrix(role.roleId);

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={() => router.push('/admin/roles')}>
        <ArrowLeft className="h-4 w-4 mr-1" />Back to Roles
      </Button>

      <PageHeader
        title={role.roleName}
        description={role.roleDescription || role.roleId}
        basePath="/admin"
        actions={
          canEdit ? (
            <Button asChild className="bg-blue-600 hover:bg-blue-700">
              <Link href={`/admin/roles/${id}/edit`}><Pencil className="h-4 w-4 mr-1" />Edit Role</Link>
            </Button>
          ) : undefined
        }
      />

      <div className="flex flex-wrap gap-2">
        <StatusBadge status={role.status} />
        <span className="text-sm text-muted-foreground">Level {role.roleLevel ?? role.level}</span>
        <span className="text-sm text-muted-foreground">{userCount} users assigned</span>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Role Information</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          {[
            { label: 'Role ID', value: role.roleId },
            { label: 'Department Access', value: role.departmentAccess || 'All' },
            { label: 'Created At', value: role.createdAt ? new Date(role.createdAt).toLocaleString() : '-' },
            { label: 'Updated At', value: role.updatedAt ? new Date(role.updatedAt).toLocaleString() : '-' },
            { label: 'Created By', value: role.createdBy },
            { label: 'Updated By', value: role.updatedBy },
          ].map((f) => (
            <div key={f.label}>
              <p className="text-xs text-muted-foreground">{f.label}</p>
              <p className="font-medium">{String(f.value ?? '-')}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Module Permissions</CardTitle></CardHeader>
        <CardContent>
          <PermissionMatrix permissions={matrix} onChange={() => {}} readOnly />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Audit Trail</CardTitle></CardHeader>
        <CardContent>
          {auditTrail.length === 0 ? (
            <EmptyState message="No audit events for this role." />
          ) : (
            <div className="space-y-2 text-sm max-h-64 overflow-y-auto">
              {auditTrail.map((l, i) => (
                <div key={i} className="p-2 border rounded">
                  <p className="font-medium">{String(l.action)}</p>
                  <p className="text-xs text-muted-foreground">
                    {String(l.timestamp || l.dateTime)} — {String(l.userName || '')}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
