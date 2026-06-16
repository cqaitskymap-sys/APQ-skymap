'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Pencil } from 'lucide-react';
import { PageHeader } from '@/components/admin/dashboard/page-header';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { EmptyState } from '@/components/admin/dashboard/empty-state';
import { StatusBadge } from '@/components/admin/dashboard/status-badge';
import { ModuleBadge } from '@/components/admin/workflows/module-badge';
import { RiskBadge } from './risk-badge';
import { DepartmentBadge } from './department-badge';
import { ApprovalFlowPreview } from './approval-flow-preview';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAdminPermissions } from '@/hooks/use-admin-permissions';
import { canEditApprovalMatrix } from '@/lib/permissions';
import type { ApprovalMatrix } from '@/lib/admin/schemas';
import {
  fetchApprovalMatrixById, fetchApprovalMatrixAuditTrail, isMatrixActive,
} from '@/lib/admin/approval-matrix-service';

export function ApprovalMatrixDetailView({ id }: { id: string }) {
  const router = useRouter();
  const { role } = useAdminPermissions();
  const canEdit = canEditApprovalMatrix(role);

  const [matrix, setMatrix] = useState<ApprovalMatrix | null>(null);
  const [auditTrail, setAuditTrail] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const m = await fetchApprovalMatrixById(id);
      if (!m) {
        setError('Approval matrix not found');
        return;
      }
      setMatrix(m);
      setAuditTrail(await fetchApprovalMatrixAuditTrail(id));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <LoadingSkeleton rows={2} />;
  if (error || !matrix) return <ErrorCard title="Not Found" message={error || 'Matrix not found'} />;

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={() => router.push('/admin/approval-matrix')}>
        <ArrowLeft className="h-4 w-4 mr-1" />Back to Approval Matrix
      </Button>

      <PageHeader
        title={matrix.matrixName}
        description={matrix.approvalMatrixId || matrix.matrixCode}
        basePath="/admin"
        actions={
          canEdit ? (
            <Button asChild className="bg-blue-600 hover:bg-blue-700">
              <Link href={`/admin/approval-matrix/${id}/edit`}><Pencil className="h-4 w-4 mr-1" />Edit Matrix</Link>
            </Button>
          ) : undefined
        }
      />

      <div className="flex flex-wrap gap-2 items-center">
        <ModuleBadge module={matrix.moduleName} />
        <DepartmentBadge department={matrix.department} />
        <RiskBadge risk={matrix.riskLevel} />
        <StatusBadge status={matrix.status} />
        {!isMatrixActive(matrix) && (
          <span className="text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded border border-amber-200">
            Inactive — new records cannot use this matrix
          </span>
        )}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Matrix Profile</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          {[
            { label: 'Matrix Code', value: matrix.matrixCode },
            { label: 'Module', value: matrix.moduleName },
            { label: 'Department', value: matrix.department },
            { label: 'Site / Location', value: matrix.siteLocation },
            { label: 'Product', value: matrix.productOptional || 'All' },
            { label: 'Process', value: matrix.processOptional },
            { label: 'Min Approval Level', value: matrix.minimumApprovalLevel },
            { label: 'Escalation Role', value: matrix.escalationRole?.replace(/_/g, ' ') },
            { label: 'E-Signature', value: matrix.eSignatureRequired ? 'Required' : 'No' },
            { label: 'Comment Required', value: matrix.approvalCommentRequired ? 'Yes' : 'No' },
            { label: 'Parallel Approval', value: matrix.parallelApprovalAllowed ? 'Yes' : 'No' },
            { label: 'Delegation', value: matrix.delegationAllowed ? 'Allowed' : 'No' },
          ].map((f) => (
            <div key={f.label}>
              <p className="text-xs text-muted-foreground">{f.label}</p>
              <p className="font-medium">{String(f.value ?? '-')}</p>
            </div>
          ))}
          {matrix.remarks && (
            <div className="sm:col-span-2 md:col-span-3">
              <p className="text-xs text-muted-foreground">Remarks</p>
              <p className="font-medium">{matrix.remarks}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Approval Authority</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          {[
            { label: 'Prepared By', value: matrix.preparedByRole },
            { label: 'Reviewed By', value: matrix.reviewedByRole },
            { label: 'Verified By', value: matrix.verifiedByRole },
            { label: 'Approved By', value: matrix.approvedByRole },
            { label: 'Final Approver', value: matrix.finalApproverRole },
          ].map((f) => (
            <div key={f.label}>
              <p className="text-xs text-muted-foreground">{f.label}</p>
              <p className="font-medium">{f.value ? f.value.split(',').map((r) => r.trim().replace(/_/g, ' ')).join(' · ') : '-'}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Approval Flow Preview</CardTitle></CardHeader>
        <CardContent>
          <ApprovalFlowPreview matrix={matrix} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Audit Trail</CardTitle></CardHeader>
        <CardContent>
          {auditTrail.length === 0 ? (
            <EmptyState title="No audit entries" />
          ) : (
            <div className="space-y-2">
              {auditTrail.map((entry, i) => (
                <div key={i} className="flex flex-col sm:flex-row sm:items-center gap-1 p-2 border rounded text-sm">
                  <span className="font-medium">{String(entry.action ?? '-')}</span>
                  <span className="text-xs text-muted-foreground">
                    {String(entry.userName ?? entry.actorName ?? '-')} · {String(entry.timestamp ?? entry.dateTime ?? '-')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
