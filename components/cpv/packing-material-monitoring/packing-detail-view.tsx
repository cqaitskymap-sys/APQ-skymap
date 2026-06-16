'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { cpvPermissions } from '@/lib/cpv';
import { isLabelCategory } from '@/lib/cpv-packing-material-monitoring';
import {
  fetchPackingMaterialRecordById, fetchPackingMaterialAuditTrail,
  approvePackingMaterialRecord, reviewPackingMaterialRecord, updatePackingMaterialRecord,
} from '@/lib/cpv-packing-material-monitoring-service';
import type { PackingMaterialMonitoringRecord } from '@/lib/cpv-packing-material-monitoring';
import { CpvPageHeader } from '@/components/cpv/product-master/cpv-page-header';
import { PackingAttachmentUploader } from './attachment-uploader';
import { KpiCard, StatusBadge } from '@/components/cpv/cpv-ui';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

function AvlBadge({ status }: { status: string }) {
  const ok = ['Approved', 'Conditional Approved', 'Conditionally Approved'].includes(status);
  return <span className={`rounded-md border px-2 py-0.5 text-xs font-medium ${ok ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>{status}</span>;
}

function ReconBadge({ status }: { status: string }) {
  const cls = status === 'Matched' ? 'bg-green-50 text-green-700 border-green-200'
    : status === 'Mismatch' ? 'bg-red-50 text-red-700 border-red-200'
      : 'bg-slate-50 text-slate-600 border-slate-200';
  return <span className={`rounded-md border px-2 py-0.5 text-xs font-medium ${cls}`}>{status}</span>;
}

export function PackingDetailView({ id }: { id: string }) {
  const router = useRouter();
  const { user, profile } = useAuth();
  const canReview = cpvPermissions.canReviewPackingMaterial(profile?.role);
  const canEdit = cpvPermissions.canUpdatePackingMaterialQc(profile?.role) && !cpvPermissions.isPackingMaterialViewOnly(profile?.role);
  const [record, setRecord] = useState<PackingMaterialMonitoringRecord | null>(null);
  const [audit, setAudit] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const actor = { id: user?.uid || 'system', name: profile?.full_name || 'System', role: profile?.role || '' };

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetchPackingMaterialRecordById(id);
    if (!r) { setError('Record not found.'); setLoading(false); return; }
    setRecord(r);
    setAudit(await fetchPackingMaterialAuditTrail(id));
    setLoading(false);
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  const onAttachmentsChange = async (attachments: PackingMaterialMonitoringRecord['attachments']) => {
    if (!record) return;
    const { result } = await updatePackingMaterialRecord(record.id, {}, actor, record, attachments);
    if (result) setRecord(result);
  };

  if (loading) return <div className="p-4 sm:p-6"><LoadingSkeleton rows={1} /></div>;
  if (error || !record) return <div className="p-4 sm:p-6"><ErrorCard message={error || 'Not found'} onRetry={load} /></div>;

  const labelWarning = isLabelCategory(record.materialCategory) && record.reconciliationStatus === 'Mismatch';

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <CpvPageHeader
        title={record.materialName}
        description={`${record.batchNumber} · ${record.productName}`}
        trail={[
          { label: 'Continued Process Verification', href: '/cpv/dashboard' },
          { label: 'Packing Material Monitoring', href: '/cpv/packing-material-monitoring' },
          { label: record.packingMaterialMonitoringId },
        ]}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => router.push('/cpv/packing-material-monitoring')}><ArrowLeft className="h-4 w-4 mr-1" />Back</Button>
            {canReview && record.reviewStatus === 'Draft' && (
              <Button size="sm" onClick={async () => { await reviewPackingMaterialRecord(record.id, actor, record); await load(); }}>Submit Review</Button>
            )}
            {canReview && record.reviewStatus === 'Under Review' && (
              <Button size="sm" onClick={async () => { await approvePackingMaterialRecord(record.id, actor, record); await load(); }}>Approve</Button>
            )}
          </>
        }
      />
      {labelWarning && (
        <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-900">
          Critical: Label/package insert reconciliation mismatch — verify counts before batch release.
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <StatusBadge status={record.complianceStatus} />
        <StatusBadge status={record.riskLevel} />
        <ReconBadge status={record.reconciliationStatus} />
        <AvlBadge status={record.avlStatus} />
        <StatusBadge status={record.reviewStatus} />
      </div>
      <div className="grid gap-4 sm:grid-cols-4">
        <KpiCard label="Issued" value={`${record.issuedQuantity} ${record.unit}`} tone="blue" />
        <KpiCard label="Used" value={`${record.usedQuantity} ${record.unit}`} tone="green" />
        <KpiCard label="Balance" value={`${record.balanceQuantity} ${record.unit}`} tone="amber" />
        <KpiCard label="Category" value={record.materialCategory} tone="blue" />
      </div>
      <Card>
        <CardHeader><CardTitle className="text-sm">Details</CardTitle></CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2 text-sm">
          <p><span className="text-muted-foreground">Type:</span> {record.materialType}</p>
          <p><span className="text-muted-foreground">AR / GRN:</span> {record.arNumber} / {record.grnNumber}</p>
          <p><span className="text-muted-foreground">Vendor:</span> {record.vendorName}</p>
          <p><span className="text-muted-foreground">QC:</span> {record.qcStatus}</p>
          <p><span className="text-muted-foreground">Test Summary:</span> {record.testResultSummary || '—'}</p>
          <p><span className="text-muted-foreground">Deviation:</span> {record.linkedDeviationNumber || '—'}</p>
          <p className="sm:col-span-2"><span className="text-muted-foreground">Remarks:</span> {record.remarks || '—'}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6">
          <PackingAttachmentUploader
            recordId={record.id}
            uploadedBy={actor.name}
            attachments={record.attachments || []}
            onChange={(files) => void onAttachmentsChange(files)}
            disabled={!canEdit || record.isLocked}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-sm">Audit Trail</CardTitle></CardHeader>
        <CardContent>
          {audit.length === 0 ? <p className="text-sm text-muted-foreground">No audit entries.</p> : (
            <Table>
              <TableHeader><TableRow><TableHead>Action</TableHead><TableHead>User</TableHead><TableHead>When</TableHead></TableRow></TableHeader>
              <TableBody>
                {audit.map((a) => (
                  <TableRow key={String(a.id)}>
                    <TableCell>{String(a.action || a.actionType || '—')}</TableCell>
                    <TableCell>{String(a.userName || a.user_name || '—')}</TableCell>
                    <TableCell>{String(a.timestamp || a.createdAt || '—')}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
