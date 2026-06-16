'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Download, Eye, FileSpreadsheet, Loader2, Pencil, Plus, RefreshCw, Save, Trash2, Upload,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { useAuth } from '@/contexts/auth-context';
import { isFirebaseConfigured } from '@/lib/firebase';
import {
  BATCH_REVIEW_STATUSES, BATCH_RELEASE_STATUSES,
  canAddBatchReview, canExportBatchReview, canManageBatchReview,
  type BatchReviewFormData, type PqrBatchReviewRecord, type PqrOption,
} from '@/lib/pqr-batch-review-records';
import {
  buildBatchCharts, createBatchReviewRecord, fetchBatchReviewRecords,
  fetchPqrOptions, getBatchReviewNarrative, logBatchReviewExport,
  logBatchReviewNarrativeEdit, logBatchReviewSummaryRecalc, logBatchReviewView,
  pullBatchesFromMaster, saveBatchSectionToPqr, softDeleteBatchReviewRecord,
  updateBatchReviewRecord,
} from '@/lib/pqr-batch-review-service';
import { CpvPageHeader } from '@/components/cpv/product-master/cpv-page-header';
import { ResponsiveDataTable } from '@/components/cpv/product-master/responsive-data-table';
import { KpiCard } from '@/components/cpv/cpv-ui';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { EmptyState } from '@/components/admin/dashboard/empty-state';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { BatchReviewAccessGuard } from './batch-review-access-guard';
import { BatchReviewFormDialog } from './batch-review-form-dialog';
import { BatchStatusBadge, ReleaseStatusBadge } from './batch-review-badges';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import type { ColumnDef } from '@/components/admin/admin-data-table';

const CHART_COLORS = ['#2563eb', '#059669', '#d97706', '#dc2626', '#7c3aed', '#64748b'];

function SafeChart({ title, empty, children }: { title: string; empty?: boolean; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm">{title}</CardTitle></CardHeader>
      <CardContent className="h-52">
        {empty ? <EmptyState title="No data" message="No chart data for current filters." /> : children}
      </CardContent>
    </Card>
  );
}

export function BatchReviewPage() {
  const { user, profile } = useAuth();
  const role = profile?.role;
  const canAdd = canAddBatchReview(role);
  const canManage = canManageBatchReview(role);
  const canExport = canExportBatchReview(role);

  const [pqrs, setPqrs] = useState<PqrOption[]>([]);
  const [selectedPqrId, setSelectedPqrId] = useState('');
  const [records, setRecords] = useState<PqrBatchReviewRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [narrative, setNarrative] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editRecord, setEditRecord] = useState<PqrBatchReviewRecord | null>(null);
  const [detailRecord, setDetailRecord] = useState<PqrBatchReviewRecord | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [filterStatus, setFilterStatus] = useState('all');
  const [filterRelease, setFilterRelease] = useState('all');
  const [filterMfgFrom, setFilterMfgFrom] = useState('');
  const [filterMfgTo, setFilterMfgTo] = useState('');
  const [filterManufacturedFor, setFilterManufacturedFor] = useState('');

  const actor = useMemo(() => ({
    id: user?.uid || 'system',
    name: profile?.full_name || profile?.email || 'System',
    role,
  }), [user?.uid, profile?.full_name, profile?.email, role]);

  const selectedPqr = useMemo(
    () => pqrs.find((p) => p.id === selectedPqrId) || null,
    [pqrs, selectedPqrId],
  );

  const loadPqrs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (!isFirebaseConfigured()) {
        setError('Firebase is not configured.');
        return;
      }
      const opts = await fetchPqrOptions();
      setPqrs(opts);
      if (opts.length && !selectedPqrId) setSelectedPqrId(opts[0].id);
    } catch {
      setError('Failed to load PQR records.');
    } finally {
      setLoading(false);
    }
  }, [selectedPqrId]);

  const loadRecords = useCallback(async (pqrId: string) => {
    if (!pqrId) return;
    setBusy(true);
    try {
      const rows = await fetchBatchReviewRecords(pqrId);
      setRecords(rows);
      setNarrative(getBatchReviewNarrative(rows));
      void logBatchReviewSummaryRecalc(actor, pqrId);
    } catch {
      toast.error('Failed to load batch review records');
    } finally {
      setBusy(false);
    }
  }, [actor]);

  useEffect(() => { void loadPqrs(); void logBatchReviewView(actor); }, [loadPqrs, actor]);
  useEffect(() => { if (selectedPqrId) void loadRecords(selectedPqrId); }, [selectedPqrId, loadRecords]);

  const filtered = useMemo(() => records.filter((r) => {
    if (filterStatus !== 'all' && r.batchStatus !== filterStatus) return false;
    if (filterRelease !== 'all' && r.releaseStatus !== filterRelease) return false;
    if (filterManufacturedFor && !r.manufacturedFor.toLowerCase().includes(filterManufacturedFor.toLowerCase())) return false;
    if (filterMfgFrom && r.manufacturingDate < filterMfgFrom) return false;
    if (filterMfgTo && r.manufacturingDate > filterMfgTo) return false;
    return true;
  }), [records, filterStatus, filterRelease, filterManufacturedFor, filterMfgFrom, filterMfgTo]);

  const summary = useMemo(() => {
    const active = filtered.filter((r) => !r.isDeleted);
    const total = active.length;
    const released = active.filter((r) => String(r.releaseStatus).toLowerCase().includes('release') && !String(r.releaseStatus).toLowerCase().includes('reject')).length;
    const rejected = active.filter((r) => String(r.batchStatus).toLowerCase().includes('reject') || String(r.releaseStatus).toLowerCase().includes('reject')).length;
    const hold = active.filter((r) => String(r.batchStatus).toLowerCase().includes('hold')).length;
    const reworked = active.filter((r) => r.reworkRequired || String(r.batchStatus).toLowerCase().includes('rework')).length;
    const reprocessed = active.filter((r) => r.reprocessRequired || String(r.batchStatus).toLowerCase().includes('reprocess')).length;
    return {
      totalBatches: total,
      releasedBatches: released,
      rejectedBatches: rejected,
      holdBatches: hold,
      reworkedBatches: reworked,
      reprocessedBatches: reprocessed,
      releasePct: total ? Math.round((released / total) * 1000) / 10 : 0,
      rejectionPct: total ? Math.round((rejected / total) * 1000) / 10 : 0,
    };
  }, [filtered]);

  const charts = useMemo(() => buildBatchCharts(filtered), [filtered]);

  const handlePull = async () => {
    if (!selectedPqr) return;
    setBusy(true);
    const { created, skipped, error: err } = await pullBatchesFromMaster(selectedPqr, actor);
    setBusy(false);
    if (err) return toast.error(err);
    toast.success(`${created} batch(es) pulled (${skipped} skipped)`);
    await loadRecords(selectedPqr.id);
  };

  const handleSaveForm = async (data: BatchReviewFormData): Promise<void> => {
    if (!selectedPqr) return;
    setBusy(true);
    const result = editRecord?.id
      ? await updateBatchReviewRecord(editRecord.id, selectedPqr, data, actor)
      : await createBatchReviewRecord(selectedPqr, data, actor);
    setBusy(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success(editRecord ? 'Batch updated' : 'Batch added');
    setFormOpen(false);
    setEditRecord(null);
    await loadRecords(selectedPqr.id);
  };

  const handleSaveSection = async () => {
    if (!selectedPqr) return;
    setBusy(true);
    const { error: err } = await saveBatchSectionToPqr(selectedPqr.id, narrative, records, actor);
    setBusy(false);
    if (err) return toast.error(err);
    toast.success('Batch section saved to PQR');
  };

  const handleDelete = async (): Promise<void> => {
    if (!deleteId || !selectedPqr) return;
    setBusy(true);
    const { error: err } = await softDeleteBatchReviewRecord(deleteId, actor);
    setBusy(false);
    setDeleteId(null);
    if (err) {
      toast.error(err);
      return;
    }
    toast.success('Batch record removed');
    await loadRecords(selectedPqr.id);
  };

  const exportExcel = () => {
    void logBatchReviewExport(actor, 'excel');
    toast.info('Excel export will be available in a future release.');
  };

  const importExcel = () => {
    void logBatchReviewExport(actor, 'import');
    toast.info('Excel import will be available in a future release.');
  };

  const pqrTableColumns: ColumnDef<PqrBatchReviewRecord & { srNo: number }>[] = [
    { key: 'srNo', header: 'Sr. No.' },
    { key: 'batchNumber', header: 'Batch No.' },
    { key: 'semiFinishedBatchNumber', header: 'Semi Finish Batch No.', render: (r) => r.semiFinishedBatchNumber || '—' },
    { key: 'finishedProductBatchNumber', header: 'Finished Product Batch No.', render: (r) => r.finishedProductBatchNumber || '—' },
    { key: 'manufacturingDate', header: 'MFG Date' },
    { key: 'expiryDate', header: 'EXP Date' },
    { key: 'batchSize', header: 'Batch Size', render: (r) => `${r.batchSize} ${r.batchSizeUnit}` },
    { key: 'manufacturedFor', header: 'Manufactured For', render: (r) => r.manufacturedFor || r.customerName || '—' },
    { key: 'batchStatus', header: 'Status', render: (r) => <BatchStatusBadge status={r.batchStatus} /> },
    { key: 'remarks', header: 'Remarks', render: (r) => <span className="line-clamp-1 max-w-[120px]">{r.remarks || '—'}</span> },
    {
      key: 'actions', header: 'Action',
      render: (r) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" onClick={() => setDetailRecord(r)}><Eye className="h-4 w-4" /></Button>
          {canManage && (
            <>
              <Button variant="ghost" size="icon" onClick={() => { setEditRecord(r); setFormOpen(true); }}><Pencil className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" onClick={() => setDeleteId(r.id || null)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
            </>
          )}
        </div>
      ),
    },
  ];

  const tableData = filtered.map((r, i) => ({ ...r, srNo: i + 1 }));

  if (loading) {
    return (
      <BatchReviewAccessGuard>
        <div className="p-4 sm:p-6"><LoadingSkeleton rows={3} /></div>
      </BatchReviewAccessGuard>
    );
  }

  if (error) {
    return (
      <BatchReviewAccessGuard>
        <div className="p-4 sm:p-6"><ErrorCard message={error} onRetry={() => void loadPqrs()} /></div>
      </BatchReviewAccessGuard>
    );
  }

  return (
    <BatchReviewAccessGuard>
      <div className="space-y-6 p-4 sm:p-6">
        <CpvPageHeader
          title="Batch Review"
          description="Review all manufactured batches during the PQR period"
          trail={[
            { label: 'Dashboard', href: '/dashboard' },
            { label: 'PQR Management', href: '/pqr/dashboard' },
            { label: 'Batch Review' },
          ]}
          actions={(
            <>
              {canExport && (
                <>
                  <Button variant="outline" size="sm" onClick={importExcel}><Upload className="h-4 w-4 mr-1" />Import</Button>
                  <Button variant="outline" size="sm" onClick={exportExcel}><FileSpreadsheet className="h-4 w-4 mr-1" />Export</Button>
                </>
              )}
              {canManage && selectedPqr && (
                <Button variant="outline" size="sm" onClick={() => void handlePull()} disabled={busy}>
                  {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Download className="h-4 w-4 mr-1" />}
                  Pull from Master
                </Button>
              )}
              {canAdd && selectedPqr && (
                <Button size="sm" onClick={() => { setEditRecord(null); setFormOpen(true); }}>
                  <Plus className="h-4 w-4 mr-1" />Add Batch
                </Button>
              )}
            </>
          )}
        />

        <Card>
          <CardContent className="pt-6">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2 sm:col-span-2">
                <Label>PQR Number *</Label>
                <Select value={selectedPqrId} onValueChange={setSelectedPqrId}>
                  <SelectTrigger><SelectValue placeholder="Select PQR..." /></SelectTrigger>
                  <SelectContent>
                    {pqrs.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.pqrNumber} — {p.productName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {selectedPqr && (
                <>
                  <div><Label className="text-muted-foreground">Product</Label><p className="text-sm font-medium">{selectedPqr.productName}</p></div>
                  <div><Label className="text-muted-foreground">Review Period</Label><p className="text-sm font-medium">{selectedPqr.reviewPeriodFrom} — {selectedPqr.reviewPeriodTo}</p></div>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {!selectedPqr ? (
          <EmptyState title="Select a PQR" message="Choose a PQR record to review batches for the annual review period." />
        ) : (
          <>
            <div className="grid gap-3 grid-cols-2 md:grid-cols-4 xl:grid-cols-8">
              <KpiCard label="Total Batches" value={summary.totalBatches} />
              <KpiCard label="Released" value={summary.releasedBatches} tone="green" />
              <KpiCard label="Rejected" value={summary.rejectedBatches} tone="red" />
              <KpiCard label="Hold" value={summary.holdBatches} tone="amber" />
              <KpiCard label="Reworked" value={summary.reworkedBatches} />
              <KpiCard label="Reprocessed" value={summary.reprocessedBatches} />
              <KpiCard label="Release %" value={`${summary.releasePct}%`} tone="green" />
              <KpiCard label="Rejection %" value={`${summary.rejectionPct}%`} tone={summary.rejectionPct > 0 ? 'red' : 'green'} />
            </div>

            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-wrap gap-2">
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="w-[160px]"><SelectValue placeholder="Batch Status" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      {BATCH_REVIEW_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={filterRelease} onValueChange={setFilterRelease}>
                    <SelectTrigger className="w-[160px]"><SelectValue placeholder="Release Status" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Release</SelectItem>
                      {BATCH_RELEASE_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Input placeholder="Manufactured For" className="w-[160px]" value={filterManufacturedFor} onChange={(e) => setFilterManufacturedFor(e.target.value)} />
                  <Input type="date" value={filterMfgFrom} onChange={(e) => setFilterMfgFrom(e.target.value)} />
                  <Input type="date" value={filterMfgTo} onChange={(e) => setFilterMfgTo(e.target.value)} />
                  <Button variant="outline" size="icon" onClick={() => selectedPqrId && void loadRecords(selectedPqrId)} disabled={busy}>
                    <RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">PQR Batch Review Table</CardTitle></CardHeader>
              <CardContent className="overflow-x-auto">
                {tableData.length ? (
                  <ResponsiveDataTable
                    columns={pqrTableColumns}
                    data={tableData}
                    searchKeys={['batchNumber', 'manufacturedFor', 'customerName', 'remarks']}
                    mobileTitleKey="batchNumber"
                    mobileSubtitleKey="manufacturingDate"
                    pageSize={15}
                  />
                ) : (
                  <EmptyState title="No batch records" message="Pull batches from Batch Master or add manually." />
                )}
              </CardContent>
            </Card>

            <div className="grid gap-4 lg:grid-cols-2">
              <SafeChart title="Batch Status Distribution" empty={!charts.statusDistribution.length}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={charts.statusDistribution} dataKey="value" nameKey="name" outerRadius={70} label>
                      {charts.statusDistribution.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </SafeChart>
              <SafeChart title="Monthly Batch Manufacturing Trend" empty={!charts.monthlyManufacturing.length}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={charts.monthlyManufacturing}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="count" stroke="#2563eb" />
                  </LineChart>
                </ResponsiveContainer>
              </SafeChart>
              <SafeChart title="Released vs Rejected Trend" empty={!charts.releaseRejectTrend.length}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={charts.releaseRejectTrend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="released" fill="#059669" name="Released" />
                    <Bar dataKey="rejected" fill="#dc2626" name="Rejected" />
                  </BarChart>
                </ResponsiveContainer>
              </SafeChart>
              <SafeChart title="Manufactured For / Customer Trend" empty={!charts.manufacturedForTrend.length}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={charts.manufacturedForTrend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#2563eb" />
                  </BarChart>
                </ResponsiveContainer>
              </SafeChart>
            </div>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">PQR Section Narrative — Batch Manufacturing Details</CardTitle>
                {canManage && (
                  <Button size="sm" onClick={() => void handleSaveSection()} disabled={busy}>
                    <Save className="h-4 w-4 mr-1" />Save to PQR
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                <Textarea
                  className="min-h-[120px]"
                  value={narrative}
                  readOnly={!canManage}
                  onChange={(e) => {
                    setNarrative(e.target.value);
                    if (selectedPqr) void logBatchReviewNarrativeEdit(actor, selectedPqr.id);
                  }}
                />
              </CardContent>
            </Card>
          </>
        )}

        {selectedPqr && (
          <BatchReviewFormDialog
            open={formOpen}
            onOpenChange={setFormOpen}
            pqr={selectedPqr}
            record={editRecord}
            onSubmit={handleSaveForm}
            loading={busy}
          />
        )}

        <Dialog open={!!detailRecord} onOpenChange={() => setDetailRecord(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Batch Detail — {detailRecord?.batchNumber}</DialogTitle></DialogHeader>
            {detailRecord && (
              <dl className="grid grid-cols-2 gap-2 text-sm">
                {[
                  ['Product', detailRecord.product], ['Batch No.', detailRecord.batchNumber],
                  ['MFG Date', detailRecord.manufacturingDate], ['EXP Date', detailRecord.expiryDate],
                  ['Batch Size', `${detailRecord.batchSize} ${detailRecord.batchSizeUnit}`],
                  ['Status', detailRecord.batchStatus], ['Release', detailRecord.releaseStatus],
                  ['Deviations', detailRecord.linkedDeviationCount], ['OOS', detailRecord.linkedOosCount],
                  ['CAPA', detailRecord.linkedCapaCount], ['Source', detailRecord.sourceType || 'manual'],
                ].map(([k, v]) => (
                  <div key={k}><dt className="text-muted-foreground">{k}</dt><dd className="font-medium">{String(v)}</dd></div>
                ))}
                <div className="col-span-2 flex gap-2 pt-2">
                  <BatchStatusBadge status={detailRecord.batchStatus} />
                  <ReleaseStatusBadge status={detailRecord.releaseStatus} />
                </div>
              </dl>
            )}
          </DialogContent>
        </Dialog>

        <ConfirmDialog
          open={!!deleteId}
          onOpenChange={() => setDeleteId(null)}
          title="Remove Batch Record"
          description="This will soft-delete the batch review record. Continue?"
          confirmLabel="Remove"
          destructive
          loading={busy}
          onConfirm={handleDelete}
        />
      </div>
    </BatchReviewAccessGuard>
  );
}
