'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { cpvPermissions } from '@/lib/cpv';
import {
  fetchRawMaterialRecordById, fetchRawMaterialAuditTrail,
  approveRawMaterialRecord, reviewRawMaterialRecord, updateRawMaterialRecord,
} from '@/lib/cpv-raw-material-monitoring-service';
import type { RawMaterialMonitoringRecord, RawMaterialAttachment } from '@/lib/cpv-raw-material-monitoring';
import { CpvPageHeader } from '@/components/cpv/product-master/cpv-page-header';
import { AttachmentUploader } from './attachment-uploader';
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

export function RawMaterialDetailView({ id }: { id: string }) {
  const router = useRouter();
  const { user, profile } = useAuth();
  const canReview = cpvPermissions.canReviewRawMaterial(profile?.role);
  const canEdit = cpvPermissions.canUpdateRawMaterialQc(profile?.role) && !cpvPermissions.isRawMaterialViewOnly(profile?.role);
  const [record, setRecord] = useState<RawMaterialMonitoringRecord | null>(null);
  const [audit, setAudit] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const actor = { id: user?.uid || 'system', name: profile?.full_name || 'System', role: profile?.role || '' };

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetchRawMaterialRecordById(id);
    if (!r) { setError('Record not found.'); setLoading(false); return; }
    setRecord(r);
    setAudit(await fetchRawMaterialAuditTrail(id));
    setLoading(false);
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  const onAttachmentsChange = async (attachments: RawMaterialAttachment[]) => {
    if (!record) return;
    const { result } = await updateRawMaterialRecord(record.id, {}, actor, record, attachments);
    if (result) setRecord(result);
  };

  if (loading) return <div className="p-4 sm:p-6"><LoadingSkeleton rows={1} /></div>;
  if (error || !record) return <div className="p-4 sm:p-6"><ErrorCard message={error || 'Not found'} onRetry={load} /></div>;

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <CpvPageHeader
        title={record.materialName}
        description={`${record.batchNumber} · ${record.productName}`}
        trail={[
          { label: 'Continued Process Verification', href: '/cpv/dashboard' },
          { label: 'Raw Material Monitoring', href: '/cpv/raw-material-monitoring' },
          { label: record.rawMaterialMonitoringId },
        ]}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => router.push('/cpv/raw-material-monitoring')}><ArrowLeft className="h-4 w-4 mr-1" />Back</Button>
            {canReview && record.reviewStatus === 'Draft' && (
              <Button size="sm" onClick={async () => { await reviewRawMaterialRecord(record.id, actor, record); await load(); }}>Submit Review</Button>
            )}
            {canReview && record.reviewStatus === 'Under Review' && (
              <Button size="sm" onClick={async () => { await approveRawMaterialRecord(record.id, actor, record); await load(); }}>Approve</Button>
            )}
          </>
        }
      />
      <div className="flex flex-wrap gap-2">
        <StatusBadge status={record.complianceStatus} />
        <StatusBadge status={record.riskLevel} />
        <StatusBadge status={record.qcStatus} />
        <AvlBadge status={record.avlStatus} />
        <StatusBadge status={record.reviewStatus} />
      </div>
      <div className="grid gap-4 sm:grid-cols-4">
        <KpiCard label="Used Qty" value={`${record.usedQuantity} ${record.unit}`} tone="blue" />
        <KpiCard label="AR No" value={record.arNumber} tone="green" />
        <KpiCard label="Vendor" value={record.vendorName} tone="amber" />
        <KpiCard label="EXP" value={record.expDate} tone="red" />
      </div>
      <Card>
        <CardHeader><CardTitle className="text-sm">Material Details</CardTitle></CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2 text-sm">
          <p><span className="text-muted-foreground">GRN:</span> {record.grnNumber}</p>
          <p><span className="text-muted-foreground">Lot:</span> {record.materialLotNumber}</p>
          <p><span className="text-muted-foreground">Manufacturer:</span> {record.manufacturerName}</p>
          <p><span className="text-muted-foreground">Supplier:</span> {record.supplierName}</p>
          <p><span className="text-muted-foreground">COA:</span> {record.coaAvailable}</p>
          <p><span className="text-muted-foreground">Deviation:</span> {record.linkedDeviationNumber || '—'}</p>
          <p><span className="text-muted-foreground">OOS:</span> {record.linkedOosNumber || '—'}</p>
          <p className="sm:col-span-2"><span className="text-muted-foreground">Remarks:</span> {record.remarks || '—'}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6">
          <AttachmentUploader
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
