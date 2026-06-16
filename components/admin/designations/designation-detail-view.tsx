'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Pencil, AlertTriangle } from 'lucide-react';
import { PageHeader } from '@/components/admin/dashboard/page-header';
import { StatusBadge } from '@/components/admin/dashboard/status-badge';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { EmptyState } from '@/components/admin/dashboard/empty-state';
import { DesignationLevelBadge } from './designation-level-badge';
import { DepartmentBadge } from './department-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAdminPermissions } from '@/hooks/use-admin-permissions';
import { canEditDesignations } from '@/lib/permissions';
import type { AdminUser, Designation } from '@/lib/admin/schemas';
import {
  fetchDesignationById, fetchUsersWithDesignation, fetchDesignationAuditTrail,
} from '@/lib/admin/designation-service';

export function DesignationDetailView({ id }: { id: string }) {
  const router = useRouter();
  const { role } = useAdminPermissions();
  const canEdit = canEditDesignations(role);

  const [des, setDes] = useState<Designation | null>(null);
  const [linkedUsers, setLinkedUsers] = useState<AdminUser[]>([]);
  const [auditTrail, setAuditTrail] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const designation = await fetchDesignationById(id);
      if (!designation) {
        setError('Designation not found');
        return;
      }
      setDes(designation);
      setLinkedUsers(await fetchUsersWithDesignation(designation));
      setAuditTrail(await fetchDesignationAuditTrail(id));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <LoadingSkeleton rows={2} />;
  if (error || !des) return <ErrorCard title="Not Found" message={error || 'Designation not found'} />;

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={() => router.push('/admin/designations')}>
        <ArrowLeft className="h-4 w-4 mr-1" />Back to Designations
      </Button>

      <PageHeader
        title={des.designationName}
        description={des.designationId || des.designationCode}
        basePath="/admin"
        actions={
          canEdit ? (
            <Button asChild className="bg-blue-600 hover:bg-blue-700">
              <Link href={`/admin/designations/${id}/edit`}><Pencil className="h-4 w-4 mr-1" />Edit Designation</Link>
            </Button>
          ) : undefined
        }
      />

      <div className="flex flex-wrap gap-2 items-center">
        <StatusBadge status={des.status} />
        <DepartmentBadge department={des.department} />
        <DesignationLevelBadge level={des.designationLevel} />
        <span className="text-sm text-muted-foreground">{linkedUsers.length} linked users</span>
        {des.status === 'Inactive' && (
          <span className="flex items-center gap-1 text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded border border-amber-200">
            <AlertTriangle className="h-3 w-3" />
            Inactive — new user assignments blocked
          </span>
        )}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Designation Information</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          {[
            { label: 'Designation ID', value: des.designationId },
            { label: 'Designation Code', value: des.designationCode },
            { label: 'Approval Level', value: des.approvalLevel },
            { label: 'Created At', value: des.createdAt ? new Date(des.createdAt).toLocaleString() : '-' },
            { label: 'Updated At', value: des.updatedAt ? new Date(des.updatedAt).toLocaleString() : '-' },
            { label: 'Created By', value: des.createdBy },
            { label: 'Updated By', value: des.updatedBy },
          ].map((f) => (
            <div key={f.label}>
              <p className="text-xs text-muted-foreground">{f.label}</p>
              <p className="font-medium">{String(f.value ?? '-')}</p>
            </div>
          ))}
          {des.description && (
            <div className="sm:col-span-2 md:col-span-3">
              <p className="text-xs text-muted-foreground">Description</p>
              <p className="font-medium">{des.description}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Approval & Authority</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          {[
            { label: 'Approval Authority', value: des.approvalAuthority },
            { label: 'Can Review', value: des.canReview },
            { label: 'Can Approve', value: des.canApprove },
            { label: 'Can E-Sign', value: des.canESign },
          ].map((f) => (
            <div key={f.label} className="p-3 border rounded-lg">
              <p className="text-xs text-muted-foreground">{f.label}</p>
              <p className="font-medium">{f.value ? 'Yes' : 'No'}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Linked Users</CardTitle></CardHeader>
        <CardContent>
          {linkedUsers.length === 0 ? (
            <EmptyState message="No users linked to this designation." />
          ) : (
            <div className="space-y-2">
              {linkedUsers.map((u) => (
                <div key={u.id} className="flex justify-between items-center p-2 border rounded text-sm">
                  <div>
                    <p className="font-medium">{u.fullName}</p>
                    <p className="text-xs text-muted-foreground">{u.email} · {u.department}</p>
                  </div>
                  {des.status === 'Inactive' && (
                    <span className="text-xs text-amber-600">Inactive designation warning</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Audit Trail</CardTitle></CardHeader>
        <CardContent>
          {auditTrail.length === 0 ? (
            <EmptyState message="No audit events for this designation." />
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
