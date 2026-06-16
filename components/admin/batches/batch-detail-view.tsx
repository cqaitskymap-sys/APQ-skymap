'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Pencil, Lock } from 'lucide-react';
import { PageHeader } from '@/components/admin/dashboard/page-header';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { EmptyState } from '@/components/admin/dashboard/empty-state';
import { BatchStatusBadge } from './batch-status-badge';
import { ReleaseStatusBadge } from './release-status-badge';
import { BatchAttachmentsSection } from './batch-attachments-section';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/auth-context';
import { useAdminPermissions } from '@/hooks/use-admin-permissions';
import { canEditBatches, canQaOverrideBatch } from '@/lib/permissions';
import type { AdminBatch, BatchAttachment } from '@/lib/admin/schemas';
import {
  fetchBatchById, fetchBatchAttachments, fetchBatchAuditTrail, isBatchReleasedLocked,
} from '@/lib/admin/batch-service';

export function BatchDetailView({ id }: { id: string }) {
  const router = useRouter();
  const { user, profile } = useAuth();
  const { role } = useAdminPermissions();
  const canEdit = canEditBatches(role);
  const canOverride = canQaOverrideBatch(role);

  const [batch, setBatch] = useState<AdminBatch | null>(null);
  const [attachments, setAttachments] = useState<BatchAttachment[]>([]);
  const [auditTrail, setAuditTrail] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const auditMeta = {
    userId: user?.uid || 'system',
    userName: profile?.full_name || profile?.email || 'Admin',
  };

  const load = useCallback(async () => {
    try {
      const b = await fetchBatchById(id);
      if (!b) {
        setError('Batch not found');
        return;
      }
      setBatch(b);
      setAttachments(await fetchBatchAttachments(id));
      setAuditTrail(await fetchBatchAuditTrail(id));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <LoadingSkeleton rows={2} />;
  if (error || !batch) return <ErrorCard title="Not Found" message={error || 'Batch not found'} />;

  const releasedLocked = isBatchReleasedLocked(batch);
  const showEdit = canEdit && (!releasedLocked || canOverride);

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={() => router.push('/admin/batches')}>
        <ArrowLeft className="h-4 w-4 mr-1" />Back to Batches
      </Button>

      <PageHeader
        title={batch.batchNumber}
        description={`${batch.productName} · ${batch.batchId || batch.productCode}`}
        basePath="/admin"
        actions={
          showEdit ? (
            <Button asChild className="bg-blue-600 hover:bg-blue-700">
              <Link href={`/admin/batches/${id}/edit`}><Pencil className="h-4 w-4 mr-1" />Edit Batch</Link>
            </Button>
          ) : undefined
        }
      />

      <div className="flex flex-wrap gap-2 items-center">
        <BatchStatusBadge status={batch.batchStatus} />
        <ReleaseStatusBadge status={batch.releaseStatus} />
        {releasedLocked && (
          <span className="flex items-center gap-1 text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded border border-amber-200">
            <Lock className="h-3 w-3" />
            Released — critical fields locked
          </span>
        )}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Batch Profile</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          {[
            { label: 'Batch ID', value: batch.batchId },
            { label: 'Product Code', value: batch.productCode },
            { label: 'Product Name', value: batch.productName },
            { label: 'Generic Name', value: batch.genericName },
            { label: 'Strength', value: batch.strength },
            { label: 'Dosage Form', value: batch.dosageForm },
            { label: 'Market', value: batch.market },
            { label: 'Batch Size', value: `${batch.batchSize} ${batch.batchSizeUnit || batch.unit || ''}` },
            { label: 'Manufacturing Date', value: batch.manufacturingDate },
            { label: 'Expiry Date', value: batch.expiryDate },
            { label: 'Manufacturing Site', value: batch.manufacturingSite },
            { label: 'Manufacturing Line', value: batch.manufacturingLine || batch.lineNumber },
            { label: 'Shift', value: batch.shift },
            { label: 'MFR / BMR / BPR', value: `${batch.mfrNumber || '-'} / ${batch.bmrNumber || '-'} / ${batch.bprNumber || '-'}` },
            { label: 'Manufactured For', value: batch.manufacturedFor },
            { label: 'Customer', value: batch.customerName },
            { label: 'Release Date', value: batch.releaseDate },
            { label: 'QA Released By', value: batch.qaReleasedBy },
          ].map((f) => (
            <div key={f.label}>
              <p className="text-xs text-muted-foreground">{f.label}</p>
              <p className="font-medium">{String(f.value ?? '-')}</p>
            </div>
          ))}
          {batch.statusChangeReason && (
            <div className="sm:col-span-2 md:col-span-3">
              <p className="text-xs text-muted-foreground">Status Change Reason</p>
              <p className="font-medium">{batch.statusChangeReason}</p>
            </div>
          )}
          {batch.remarks && (
            <div className="sm:col-span-2 md:col-span-3">
              <p className="text-xs text-muted-foreground">Remarks</p>
              <p className="font-medium">{batch.remarks}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Additional Batch Numbers</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          {[
            { label: 'Semi Finished', value: batch.semiFinishedBatchNumber },
            { label: 'Finished Product', value: batch.finishedProductBatchNumber },
            { label: 'Packing Batch', value: batch.packingBatchNumber },
          ].map((f) => (
            <div key={f.label}>
              <p className="text-xs text-muted-foreground">{f.label}</p>
              <p className="font-medium">{f.value || '-'}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <BatchAttachmentsSection
        batchId={id}
        attachments={attachments}
        canUpload={canEdit}
        auditMeta={auditMeta}
        onRefresh={load}
      />

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
