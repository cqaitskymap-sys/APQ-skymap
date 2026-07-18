'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/auth-context';
import { cpvPermissions } from '@/lib/cpv';
import type { CpvBatchRecord } from '@/lib/cpv-batch-registration';
import { formatMonthYear, type CpvBatchFormData } from '@/lib/cpv-batch-registration';
import {
  fetchCpvBatchById,
  fetchActiveCpvProductsForBatch,
  fetchBatchCppResults,
  fetchBatchCqaResults,
  fetchBatchYieldResults,
  fetchBatchStabilityLinks,
  fetchBatchRiskSummary,
  fetchBatchAuditTrail,
  updateCpvBatch,
} from '@/lib/cpv-batch-registration-service';
import { CpvPageHeader } from '@/components/cpv/product-master/cpv-page-header';
import { CpvBatchFormSheet } from './cpv-batch-form-sheet';
import { KpiCard, StatusBadge } from '@/components/cpv/cpv-ui';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { EmptyState } from '@/components/admin/dashboard/empty-state';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export function CpvBatchDetailView({ id }: { id: string }) {
  const router = useRouter();
  const { user, profile } = useAuth();
  const canManage = cpvPermissions.canManageCpvBatches(profile?.role) && !cpvPermissions.isReadOnly(profile?.role);

  const [batch, setBatch] = useState<CpvBatchRecord | null>(null);
  const [cppResults, setCppResults] = useState<Record<string, unknown>[]>([]);
  const [cqaResults, setCqaResults] = useState<Record<string, unknown>[]>([]);
  const [yieldResults, setYieldResults] = useState<Record<string, unknown>[]>([]);
  const [stabilityLinks, setStabilityLinks] = useState<Record<string, unknown>[]>([]);
  const [riskRows, setRiskRows] = useState<Record<string, unknown>[]>([]);
  const [auditTrail, setAuditTrail] = useState<Record<string, unknown>[]>([]);
  const [cpvProducts, setCpvProducts] = useState<Awaited<ReturnType<typeof fetchActiveCpvProductsForBatch>>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const actor = { id: user?.uid || 'system', name: profile?.full_name || 'System' };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const b = await fetchCpvBatchById(id);
      if (!b) {
        setError('CPV batch not found.');
        setLoading(false);
        return;
      }
      setBatch(b);
      const [cpp, cqa, yieldR, stab, risk, audit, products] = await Promise.all([
        fetchBatchCppResults(b),
        fetchBatchCqaResults(b),
        fetchBatchYieldResults(b),
        fetchBatchStabilityLinks(b),
        fetchBatchRiskSummary(b),
        fetchBatchAuditTrail(id),
        fetchActiveCpvProductsForBatch(),
      ]);
      setCppResults(cpp);
      setCqaResults(cqa);
      setYieldResults(yieldR);
      setStabilityLinks(stab);
      setRiskRows(risk);
      setAuditTrail(audit);
      setCpvProducts(products);
    } catch {
      setError('Failed to load batch profile.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  const handleSave = async (data: CpvBatchFormData) => {
    if (!batch) return;
    setSubmitting(true);
    const { error: err } = await updateCpvBatch(batch.id, data, actor, batch);
    setSubmitting(false);
    if (err) toast.error(err);
    else {
      toast.success('Batch updated');
      setFormOpen(false);
      await load();
    }
  };

  if (loading) return <div className="p-4 sm:p-6"><LoadingSkeleton rows={2} /></div>;
  if (error || !batch) return <div className="p-4 sm:p-6"><ErrorCard title="Not Found" message={error || 'Batch not found'} onRetry={load} /></div>;

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <CpvPageHeader
        title={batch.batchNumber}
        description={`${batch.cpvBatchId} · ${batch.productName}`}
        trail={[
          { label: 'Continued Process Verification', href: '/cpv/dashboard' },
          { label: 'Batch Registration', href: '/cpv/batch-registration' },
          { label: batch.batchNumber },
        ]}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => router.push('/cpv/batch-registration')}>
              <ArrowLeft className="h-4 w-4 mr-1" />Back
            </Button>
            {canManage && (
              <Button size="sm" className="gap-2" onClick={() => setFormOpen(true)}>
                <Pencil className="h-4 w-4" />Edit
              </Button>
            )}
          </>
        }
      />

      <div className="flex flex-wrap gap-2">
        <StatusBadge status={batch.batchStatus} />
        <StatusBadge status={batch.releaseStatus} />
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="flex h-auto flex-wrap">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="cpp">CPP Results</TabsTrigger>
          <TabsTrigger value="cqa">CQA Results</TabsTrigger>
          <TabsTrigger value="yield">Yield Results</TabsTrigger>
          <TabsTrigger value="stability">Stability Link</TabsTrigger>
          <TabsTrigger value="risk">Risk Summary</TabsTrigger>
          <TabsTrigger value="pqr">PQR Link</TabsTrigger>
          <TabsTrigger value="audit">Audit Trail</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <Card>
            <CardHeader><CardTitle>Batch Overview</CardTitle></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 text-sm">
              {[
                ['Product', `${batch.productCode} — ${batch.productName}`],
                ['Generic', batch.genericName],
                ['Strength / Form', `${batch.strength} / ${batch.dosageForm}`],
                ['Pack Size', batch.packSize],
                ['Market', batch.market],
                ['Batch Size', `${batch.batchSize} ${batch.batchSizeUnit}`],
                ['Mfg Date', formatMonthYear(batch.manufacturingDate)],
                ['Expiry', formatMonthYear(batch.expiryDate)],
                ['Site / Line', `${batch.manufacturingSite} / ${batch.manufacturingLine}`],
                ['Shift', batch.shift],
                ['MFR / BMR / BPR', `${batch.mfrNumber} / ${batch.bmrNumber} / ${batch.bprNumber}`],
                ['SF / FP / Pack Batch', `${batch.semiFinishedBatchNumber} / ${batch.finishedProductBatchNumber} / ${batch.packingBatchNumber}`],
                ['Customer', batch.customerName],
                ['Manufactured For', batch.manufacturedFor],
                ['Review Period', batch.cpvReviewPeriod],
                ['QA Release', batch.qaReleaseDate ? `${batch.qaReleaseDate} by ${batch.qaReleasedBy}` : '—'],
                ['Remarks', batch.remarks],
              ].map(([label, val]) => (
                <div key={label}>
                  <p className="text-xs font-medium text-muted-foreground">{label}</p>
                  <p className="mt-0.5">{val || '—'}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cpp" className="mt-4">
          {cppResults.length === 0 ? <EmptyState title="No CPP results" /> : (
            <ResultTable rows={cppResults} cols={['parameterName', 'observedValue', 'status']} />
          )}
        </TabsContent>

        <TabsContent value="cqa" className="mt-4">
          {cqaResults.length === 0 ? <EmptyState title="No CQA results" /> : (
            <ResultTable rows={cqaResults} cols={['testParameter', 'observedValue', 'status']} />
          )}
        </TabsContent>

        <TabsContent value="yield" className="mt-4">
          {yieldResults.length === 0 ? <EmptyState title="No yield records" /> : (
            <ResultTable rows={yieldResults} cols={['yieldStage', 'yieldPercent', 'status']} />
          )}
        </TabsContent>

        <TabsContent value="stability" className="mt-4">
          {stabilityLinks.length === 0 ? <EmptyState title="No stability studies" /> : (
            <ResultTable rows={stabilityLinks} cols={['studyId', 'condition', 'status']} />
          )}
        </TabsContent>

        <TabsContent value="risk" className="mt-4">
          {riskRows.length === 0 ? <EmptyState title="No linked risks" /> : (
            <ResultTable rows={riskRows} cols={['riskDescription', 'riskLevel', 'status']} />
          )}
        </TabsContent>

        <TabsContent value="pqr" className="mt-4">
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              PQR batch review linkage uses batch number <strong>{batch.batchNumber}</strong>.
              Open <Link href="/pqr/batches" className="text-blue-600 hover:underline">PQR Batch Review</Link> to view related periodic quality reports.
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="mt-4">
          {auditTrail.length === 0 ? <EmptyState title="No audit events" /> : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    {['Timestamp', 'Action', 'User', 'Details'].map((h) => <TableHead key={h}>{h}</TableHead>)}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auditTrail.map((a, i) => (
                    <TableRow key={String(a.id || i)}>
                      <TableCell className="text-xs">{String(a.timestamp || a.dateTime || '—')}</TableCell>
                      <TableCell>{String(a.actionType || a.action || '—')}</TableCell>
                      <TableCell>{String(a.changedByUserName || a.userName || '—')}</TableCell>
                      <TableCell className="max-w-xs truncate text-xs">{String(a.actionDescription || a.newValue || '—')}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <div className="grid gap-3 sm:grid-cols-4">
        <KpiCard label="CPP Results" value={cppResults.length} tone="blue" />
        <KpiCard label="CQA Results" value={cqaResults.length} tone="green" />
        <KpiCard label="Yield Records" value={yieldResults.length} tone="amber" />
        <KpiCard label="Risk Items" value={riskRows.length} tone="red" />
      </div>

      <CpvBatchFormSheet
        open={formOpen}
        onOpenChange={setFormOpen}
        editing={batch}
        cpvProducts={cpvProducts}
        onSubmit={handleSave}
        submitting={submitting}
      />
    </div>
  );
}

function ResultTable({ rows, cols }: { rows: Record<string, unknown>[]; cols: string[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>{cols.map((c) => <TableHead key={c}>{c}</TableHead>)}</TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r, i) => (
            <TableRow key={String(r.id || i)}>
              {cols.map((c) => <TableCell key={c}>{String(r[c] ?? r[c.replace(/([A-Z])/g, '_$1').toLowerCase()] ?? '—')}</TableCell>)}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
