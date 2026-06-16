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
import type { PqrOption } from '@/lib/pqr-batch-review-records';
import {
  PQR_MATERIAL_TYPES, PQR_QC_STATUSES, buildVendorAvlRows,
  canAddMaterialReview, canExportMaterialReview, canManageMaterialReview,
  computeMaterialSummary, type MaterialReviewFormData, type PqrMaterialReviewRecord,
} from '@/lib/pqr-material-review-records';
import {
  buildMaterialCharts, createMaterialReviewRecord, fetchMaterialQualityMetrics,
  fetchMaterialReviewRecords, fetchPqrOptions, getMaterialReviewNarrative, logMaterialNarrativeEdit,
  logMaterialReviewExport, logMaterialReviewView, pullMaterialData,
  recalculateAllCompliance, saveMaterialSectionToPqr, softDeleteMaterialReviewRecord,
  updateMaterialReviewRecord, uploadMaterialAttachment,
} from '@/lib/pqr-material-review-service';
import { CpvPageHeader } from '@/components/cpv/product-master/cpv-page-header';
import { ResponsiveDataTable } from '@/components/cpv/product-master/responsive-data-table';
import { AttachmentUploader } from '@/components/pqr/create/attachment-uploader';
import { KpiCard } from '@/components/cpv/cpv-ui';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { EmptyState } from '@/components/admin/dashboard/empty-state';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { MaterialReviewAccessGuard } from './material-review-access-guard';
import { MaterialReviewFormDialog } from './material-review-form-dialog';
import { AvlStatusBadge, ComplianceBadge, MaterialRiskBadge, QcStatusBadge } from './material-review-badges';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { ColumnDef } from '@/components/admin/admin-data-table';

const CHART_COLORS = ['#2563eb', '#059669', '#d97706', '#dc2626', '#7c3aed', '#64748b'];

function SafeChart({ title, empty, children }: { title: string; empty?: boolean; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm">{title}</CardTitle></CardHeader>
      <CardContent className="h-52">
        {empty ? <EmptyState title="No data" message="No chart data available." /> : children}
      </CardContent>
    </Card>
  );
}

type TableRow = PqrMaterialReviewRecord & { srNo: number };

export function MaterialReviewPage() {
  const { user, profile } = useAuth();
  const role = profile?.role;
  const canAdd = canAddMaterialReview(role);
  const canManage = canManageMaterialReview(role);
  const canExport = canExportMaterialReview(role);

  const [pqrs, setPqrs] = useState<PqrOption[]>([]);
  const [selectedPqrId, setSelectedPqrId] = useState('');
  const [records, setRecords] = useState<PqrMaterialReviewRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [narrative, setNarrative] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editRecord, setEditRecord] = useState<PqrMaterialReviewRecord | null>(null);
  const [detailRecord, setDetailRecord] = useState<PqrMaterialReviewRecord | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [filterType, setFilterType] = useState('all');
  const [filterQc, setFilterQc] = useState('all');
  const [filterCompliance, setFilterCompliance] = useState('all');
  const [filterMaterial, setFilterMaterial] = useState('');
  const [filterBatch, setFilterBatch] = useState('');
  const [filterManufacturer, setFilterManufacturer] = useState('');
  const [filterSupplier, setFilterSupplier] = useState('');
  const [filterAvl, setFilterAvl] = useState('all');
  const [filterRisk, setFilterRisk] = useState('all');
  const [qualityMetrics, setQualityMetrics] = useState({ materialOosCount: 0, materialDeviationCount: 0 });

  const actor = useMemo(() => ({
    id: user?.uid || 'system',
    name: profile?.full_name || profile?.email || 'System',
    role,
  }), [user?.uid, profile?.full_name, profile?.email, role]);

  const selectedPqr = useMemo(() => pqrs.find((p) => p.id === selectedPqrId) || null, [pqrs, selectedPqrId]);

  const loadPqrs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (!isFirebaseConfigured()) { setError('Firebase is not configured.'); return; }
      const opts = await fetchPqrOptions();
      setPqrs(opts);
      if (opts.length && !selectedPqrId) setSelectedPqrId(opts[0].id);
    } catch { setError('Failed to load PQR records.'); }
    finally { setLoading(false); }
  }, [selectedPqrId]);

  const loadRecords = useCallback(async (pqrId: string, pqr?: PqrOption | null) => {
    if (!pqrId) return;
    setBusy(true);
    try {
      const rows = await fetchMaterialReviewRecords(pqrId);
      setRecords(rows);
      setNarrative(getMaterialReviewNarrative(rows));
      if (pqr) {
        const metrics = await fetchMaterialQualityMetrics(pqr, rows);
        setQualityMetrics(metrics);
      }
    } catch { toast.error('Failed to load material records'); }
    finally { setBusy(false); }
  }, []);

  useEffect(() => { void loadPqrs(); void logMaterialReviewView(actor); }, [loadPqrs, actor]);
  useEffect(() => { if (selectedPqrId) void loadRecords(selectedPqrId, selectedPqr); }, [selectedPqrId, selectedPqr, loadRecords]);

  const filtered = useMemo(() => records.filter((r) => {
    if (filterType !== 'all' && r.materialType !== filterType) return false;
    if (filterQc !== 'all' && r.qcStatus !== filterQc) return false;
    if (filterCompliance !== 'all' && r.complianceStatus !== filterCompliance) return false;
    if (filterAvl !== 'all' && r.vendorAvlStatus !== filterAvl) return false;
    if (filterRisk !== 'all' && r.riskLevel !== filterRisk) return false;
    if (filterMaterial && !r.materialName.toLowerCase().includes(filterMaterial.toLowerCase())) return false;
    if (filterBatch && !`${r.batchNumber} ${r.materialLotNumber}`.toLowerCase().includes(filterBatch.toLowerCase())) return false;
    if (filterManufacturer && !r.manufacturerName.toLowerCase().includes(filterManufacturer.toLowerCase())) return false;
    if (filterSupplier && !r.supplierName.toLowerCase().includes(filterSupplier.toLowerCase())) return false;
    return true;
  }), [records, filterType, filterQc, filterCompliance, filterAvl, filterRisk, filterMaterial, filterBatch, filterManufacturer, filterSupplier]);

  const apiRecords = useMemo(() => filtered.filter((r) => r.materialType === 'API'), [filtered]);
  const rawRecords = useMemo(() => filtered.filter((r) => r.materialType !== 'API'), [filtered]);
  const summary = useMemo(() => computeMaterialSummary(filtered, qualityMetrics), [filtered, qualityMetrics]);
  const charts = useMemo(() => buildMaterialCharts(filtered), [filtered]);
  const vendorRows = useMemo(() => buildVendorAvlRows(filtered), [filtered]);

  const tableColumns: ColumnDef<TableRow>[] = [
    { key: 'srNo', header: 'Sr. No.' },
    { key: 'materialName', header: 'Material Name' },
    { key: 'manufacturerName', header: 'Manufacturer' },
    { key: 'supplierName', header: 'Supplier' },
    { key: 'arNumber', header: 'AR No.' },
    { key: 'materialLotNumber', header: 'Batch / Lot No.', render: (r) => r.materialLotNumber || r.batchNumber || '—' },
    { key: 'usedQuantity', header: 'Quantity Used', render: (r) => `${r.usedQuantity} ${r.unit}` },
    { key: 'qcStatus', header: 'QC Status', render: (r) => <QcStatusBadge status={r.qcStatus} /> },
    { key: 'vendorAvlStatus', header: 'AVL Status', render: (r) => <AvlStatusBadge status={r.vendorAvlStatus} /> },
    { key: 'complianceStatus', header: 'Compliance', render: (r) => <ComplianceBadge status={r.complianceStatus} /> },
    { key: 'remarks', header: 'Remarks', render: (r) => <span className="line-clamp-1 max-w-[100px]">{r.remarks || '—'}</span> },
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

  const toTable = (rows: PqrMaterialReviewRecord[]): TableRow[] => rows.map((r, i) => ({ ...r, srNo: i + 1 }));

  const handlePull = async () => {
    if (!selectedPqr) return;
    setBusy(true);
    const { created, skipped, error: err } = await pullMaterialData(selectedPqr, actor);
    setBusy(false);
    if (err) return toast.error(err);
    toast.success(`${created} material lot(s) pulled (${skipped} skipped)`);
    await loadRecords(selectedPqr.id, selectedPqr);
  };

  const handleSaveForm = async (data: MaterialReviewFormData): Promise<void> => {
    if (!selectedPqr) return;
    setBusy(true);
    const result = editRecord?.id
      ? await updateMaterialReviewRecord(editRecord.id, selectedPqr, data, actor)
      : await createMaterialReviewRecord(selectedPqr, data, actor);
    setBusy(false);
    if (result.error) { toast.error(result.error); return; }
    toast.success(editRecord ? 'Material updated' : 'Material added');
    setFormOpen(false);
    setEditRecord(null);
    await loadRecords(selectedPqr.id, selectedPqr);
  };

  const handleSaveSection = async () => {
    if (!selectedPqr) return;
    setBusy(true);
    const { error: err } = await saveMaterialSectionToPqr(selectedPqr.id, narrative, records, actor);
    setBusy(false);
    if (err) toast.error(err);
    else toast.success('Material section saved to PQR');
  };

  const handleRecalc = async () => {
    if (!selectedPqr) return;
    setBusy(true);
    await recalculateAllCompliance(selectedPqr.id, actor);
    setBusy(false);
    toast.success('Compliance recalculated');
    await loadRecords(selectedPqr.id, selectedPqr);
  };

  const handleDelete = async (): Promise<void> => {
    if (!deleteId || !selectedPqr) return;
    setBusy(true);
    const { error: err } = await softDeleteMaterialReviewRecord(deleteId, actor);
    setBusy(false);
    setDeleteId(null);
    if (err) { toast.error(err); return; }
    toast.success('Material record removed');
    await loadRecords(selectedPqr.id, selectedPqr);
  };

  if (loading) return <MaterialReviewAccessGuard><div className="p-4 sm:p-6"><LoadingSkeleton rows={3} /></div></MaterialReviewAccessGuard>;
  if (error) return <MaterialReviewAccessGuard><div className="p-4 sm:p-6"><ErrorCard message={error} onRetry={() => void loadPqrs()} /></div></MaterialReviewAccessGuard>;

  return (
    <MaterialReviewAccessGuard>
      <div className="space-y-6 p-4 sm:p-6">
        <CpvPageHeader
          title="Material Review"
          description="Review API and raw materials used during the PQR period"
          trail={[
            { label: 'Dashboard', href: '/dashboard' },
            { label: 'PQR Management', href: '/pqr/dashboard' },
            { label: 'Material Review' },
          ]}
          actions={(
            <>
              {canExport && (
                <>
                  <Button variant="outline" size="sm" onClick={() => { void logMaterialReviewExport(actor, 'import'); toast.info('Excel import placeholder'); }}>
                    <Upload className="h-4 w-4 mr-1" />Import
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => { void logMaterialReviewExport(actor, 'excel'); toast.info('Excel export placeholder'); }}>
                    <FileSpreadsheet className="h-4 w-4 mr-1" />Export
                  </Button>
                </>
              )}
              {canManage && selectedPqr && (
                <>
                  <Button variant="outline" size="sm" onClick={() => void handlePull()} disabled={busy}>
                    {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Download className="h-4 w-4 mr-1" />}
                    Pull Materials
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => void handleRecalc()} disabled={busy}>Recalc Compliance</Button>
                </>
              )}
              {canAdd && selectedPqr && (
                <Button size="sm" onClick={() => { setEditRecord(null); setFormOpen(true); }}><Plus className="h-4 w-4 mr-1" />Add Material</Button>
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
                    {pqrs.map((p) => <SelectItem key={p.id} value={p.id}>{p.pqrNumber} — {p.productName}</SelectItem>)}
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
          <EmptyState title="Select a PQR" message="Choose a PQR to review materials for the annual review period." />
        ) : (
          <>
            <div className="grid gap-3 grid-cols-2 md:grid-cols-5 xl:grid-cols-10">
              <KpiCard label="Total Lots" value={summary.totalMaterialLots} />
              <KpiCard label="API Lots" value={summary.totalApiLots} />
              <KpiCard label="Raw Material Lots" value={summary.totalRawMaterialLots} />
              <KpiCard label="Approved Lots" value={summary.approvedLots} tone="green" />
              <KpiCard label="Rejected Lots" value={summary.rejectedLots} tone="red" />
              <KpiCard label="AVL Compliant" value={summary.avlApprovedLots} tone="green" />
              <KpiCard label="Non-Compliant" value={summary.nonCompliantLots} tone="red" />
              <KpiCard label="Expired/Retest" value={summary.expiredMaterials + summary.retestDueMaterials} tone="amber" />
              <KpiCard label="Material OOS" value={summary.materialOosCount} tone="amber" />
              <KpiCard label="Deviations" value={summary.materialDeviationCount} />
            </div>

            <Card><CardContent className="pt-6">
              <div className="flex flex-wrap gap-2">
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="w-[160px]"><SelectValue placeholder="Material Type" /></SelectTrigger>
                  <SelectContent><SelectItem value="all">All Types</SelectItem>{PQR_MATERIAL_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={filterQc} onValueChange={setFilterQc}>
                  <SelectTrigger className="w-[140px]"><SelectValue placeholder="QC Status" /></SelectTrigger>
                  <SelectContent><SelectItem value="all">All QC</SelectItem>{PQR_QC_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={filterCompliance} onValueChange={setFilterCompliance}>
                  <SelectTrigger className="w-[160px]"><SelectValue placeholder="Compliance" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Compliance</SelectItem>
                    <SelectItem value="Complies">Complies</SelectItem>
                    <SelectItem value="Does Not Comply">Does Not Comply</SelectItem>
                  </SelectContent>
                </Select>
                <Input placeholder="Material name" className="w-[160px]" value={filterMaterial} onChange={(e) => setFilterMaterial(e.target.value)} />
                <Input placeholder="Batch / lot" className="w-[140px]" value={filterBatch} onChange={(e) => setFilterBatch(e.target.value)} />
                <Input placeholder="Manufacturer" className="w-[140px]" value={filterManufacturer} onChange={(e) => setFilterManufacturer(e.target.value)} />
                <Input placeholder="Supplier" className="w-[130px]" value={filterSupplier} onChange={(e) => setFilterSupplier(e.target.value)} />
                <Select value={filterAvl} onValueChange={setFilterAvl}>
                  <SelectTrigger className="w-[150px]"><SelectValue placeholder="AVL Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All AVL</SelectItem>
                    <SelectItem value="Approved">Approved</SelectItem>
                    <SelectItem value="Not Approved">Not Approved</SelectItem>
                    <SelectItem value="Conditional Approved">Conditional</SelectItem>
                    <SelectItem value="Blocked">Blocked</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filterRisk} onValueChange={setFilterRisk}>
                  <SelectTrigger className="w-[130px]"><SelectValue placeholder="Risk" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Risk</SelectItem>
                    <SelectItem value="Low">Low</SelectItem>
                    <SelectItem value="Medium">Medium</SelectItem>
                    <SelectItem value="High">High</SelectItem>
                    <SelectItem value="Critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" size="icon" onClick={() => void loadRecords(selectedPqrId, selectedPqr)} disabled={busy}>
                  <RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </CardContent></Card>

            <Tabs defaultValue="api">
              <TabsList className="flex flex-wrap h-auto">
                <TabsTrigger value="api">API Review</TabsTrigger>
                <TabsTrigger value="raw">Raw Material Review</TabsTrigger>
                <TabsTrigger value="vendor">Vendor AVL Review</TabsTrigger>
                <TabsTrigger value="compliance">Compliance Summary</TabsTrigger>
                <TabsTrigger value="charts">Charts</TabsTrigger>
                <TabsTrigger value="narrative">Narrative</TabsTrigger>
              </TabsList>

              <TabsContent value="api" className="mt-4">
                <Card><CardContent className="pt-6 overflow-x-auto">
                  {apiRecords.length ? (
                    <ResponsiveDataTable columns={tableColumns} data={toTable(apiRecords)} searchKeys={['materialName', 'arNumber', 'manufacturerName']} mobileTitleKey="materialName" mobileSubtitleKey="arNumber" pageSize={15} />
                  ) : <EmptyState title="No API records" message="Pull materials or add manually." />}
                </CardContent></Card>
              </TabsContent>

              <TabsContent value="raw" className="mt-4">
                <Card><CardContent className="pt-6 overflow-x-auto">
                  {rawRecords.length ? (
                    <ResponsiveDataTable columns={tableColumns} data={toTable(rawRecords)} searchKeys={['materialName', 'arNumber']} mobileTitleKey="materialName" mobileSubtitleKey="supplierName" pageSize={15} />
                  ) : <EmptyState title="No raw material records" message="Pull materials or add manually." />}
                </CardContent></Card>
              </TabsContent>

              <TabsContent value="vendor" className="mt-4">
                <Card><CardHeader><CardTitle className="text-base">Vendor AVL Review</CardTitle></CardHeader>
                  <CardContent className="overflow-x-auto">
                    {vendorRows.length ? (
                      <table className="w-full text-sm">
                        <thead><tr className="border-b bg-slate-50">
                          {['Supplier', 'Manufacturer', 'Material Lots', 'AVL Status', 'Compliant', 'Non-Compliant'].map((h) => (
                            <th key={h} className="px-3 py-2 text-left font-medium">{h}</th>
                          ))}
                        </tr></thead>
                        <tbody>
                          {vendorRows.map((v) => (
                            <tr key={v.id} className="border-b">
                              <td className="px-3 py-2">{v.supplierName}</td>
                              <td className="px-3 py-2">{v.manufacturerName}</td>
                              <td className="px-3 py-2">{v.materialCount}</td>
                              <td className="px-3 py-2"><AvlStatusBadge status={v.avlStatus} /></td>
                              <td className="px-3 py-2">{v.compliantLots}</td>
                              <td className="px-3 py-2">{v.nonCompliantLots}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : <EmptyState title="No vendor data" message="Material records will populate vendor AVL summary." />}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="compliance" className="mt-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <Card><CardHeader><CardTitle className="text-sm">Compliant Lots</CardTitle></CardHeader>
                    <CardContent>{filtered.filter((r) => r.complianceStatus === 'Complies').length} of {filtered.length}</CardContent></Card>
                  <Card><CardHeader><CardTitle className="text-sm">Non-Compliant Reasons</CardTitle></CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      {Array.from(new Set(filtered.flatMap((r) => r.complianceReasons))).map((reason) => (
                        <p key={reason}>• {reason}: {filtered.filter((r) => r.complianceReasons.includes(reason)).length}</p>
                      ))}
                      {!filtered.some((r) => r.complianceReasons.length) && <p className="text-muted-foreground">All materials comply.</p>}
                    </CardContent></Card>
                </div>
              </TabsContent>

              <TabsContent value="charts" className="mt-4">
                <div className="grid gap-4 lg:grid-cols-2">
                  <SafeChart title="Material Type Distribution" empty={!charts.materialTypeDistribution.length}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart><Pie data={charts.materialTypeDistribution} dataKey="value" nameKey="name" outerRadius={70} label>
                        {charts.materialTypeDistribution.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                      </Pie><Tooltip /></PieChart>
                    </ResponsiveContainer>
                  </SafeChart>
                  <SafeChart title="Approved vs Rejected Lots" empty={!charts.approvedVsRejected.some((d) => d.value > 0)}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={charts.approvedVsRejected}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis /><Tooltip /><Bar dataKey="value" fill="#2563eb" /></BarChart>
                    </ResponsiveContainer>
                  </SafeChart>
                  <SafeChart title="Vendor-wise Material Usage" empty={!charts.vendorUsage.length}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={charts.vendorUsage}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="vendor" tick={{ fontSize: 10 }} /><YAxis /><Tooltip /><Bar dataKey="count" fill="#059669" /></BarChart>
                    </ResponsiveContainer>
                  </SafeChart>
                  <SafeChart title="AVL Compliance Trend" empty={!charts.avlComplianceTrend.length}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={charts.avlComplianceTrend}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" /><YAxis /><Tooltip /><Legend />
                        <Line type="monotone" dataKey="compliant" stroke="#059669" /><Line type="monotone" dataKey="nonCompliant" stroke="#dc2626" /></LineChart>
                    </ResponsiveContainer>
                  </SafeChart>
                  <SafeChart title="Material Risk Distribution" empty={!charts.riskDistribution.length}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart><Pie data={charts.riskDistribution} dataKey="value" nameKey="name" outerRadius={70} label>
                        {charts.riskDistribution.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                      </Pie><Tooltip /></PieChart>
                    </ResponsiveContainer>
                  </SafeChart>
                  <SafeChart title="Retest Due Trend" empty={!charts.retestDueTrend.length}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={charts.retestDueTrend}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" /><YAxis /><Tooltip /><Line type="monotone" dataKey="count" stroke="#d97706" /></LineChart>
                    </ResponsiveContainer>
                  </SafeChart>
                </div>
              </TabsContent>

              <TabsContent value="narrative" className="mt-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-base">PQR Section Narrative — API / Raw Material Review</CardTitle>
                    {canManage && (
                      <Button size="sm" onClick={() => void handleSaveSection()} disabled={busy}>
                        <Save className="h-4 w-4 mr-1" />Save to PQR
                      </Button>
                    )}
                  </CardHeader>
                  <CardContent>
                    <Textarea className="min-h-[140px]" value={narrative} readOnly={!canManage}
                      onChange={(e) => { setNarrative(e.target.value); if (selectedPqr) void logMaterialNarrativeEdit(actor, selectedPqr.id); }} />
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        )}

        {selectedPqr && (
          <MaterialReviewFormDialog open={formOpen} onOpenChange={setFormOpen} pqr={selectedPqr} record={editRecord} onSubmit={handleSaveForm} loading={busy} />
        )}

        <Dialog open={!!detailRecord} onOpenChange={() => setDetailRecord(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{detailRecord?.materialName}</DialogTitle></DialogHeader>
            {detailRecord && (
              <div className="space-y-4">
                <dl className="grid grid-cols-2 gap-2 text-sm">
                  {[
                    ['Material Type', detailRecord.materialType], ['Batch', detailRecord.batchNumber],
                    ['Manufacturer', detailRecord.manufacturerName], ['Supplier', detailRecord.supplierName],
                    ['AR No.', detailRecord.arNumber], ['GRN', detailRecord.grnNumber],
                    ['Used Qty', `${detailRecord.usedQuantity} ${detailRecord.unit}`],
                    ['MFG/EXP', `${detailRecord.mfgDate} / ${detailRecord.expDate}`],
                    ['Retest', detailRecord.retestDate || '—'],
                    ['COA', detailRecord.coaAvailable],
                  ].map(([k, v]) => (
                    <div key={k}><dt className="text-muted-foreground">{k}</dt><dd className="font-medium">{String(v)}</dd></div>
                  ))}
                </dl>
                <div className="flex flex-wrap gap-2">
                  <QcStatusBadge status={detailRecord.qcStatus} />
                  <AvlStatusBadge status={detailRecord.vendorAvlStatus} />
                  <ComplianceBadge status={detailRecord.complianceStatus} />
                  <MaterialRiskBadge level={detailRecord.riskLevel} />
                </div>
                {detailRecord.complianceReasons.length > 0 && (
                  <p className="text-sm text-red-600">Reasons: {detailRecord.complianceReasons.join(', ')}</p>
                )}
                {detailRecord.id && canManage && (
                  <AttachmentUploader
                    onUpload={(file) => uploadMaterialAttachment(selectedPqr!.id, detailRecord.id!, file, actor)}
                  />
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        <ConfirmDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)} title="Remove Material Record"
          description="This will soft-delete the material review record." confirmLabel="Remove" destructive loading={busy} onConfirm={handleDelete} />
      </div>
    </MaterialReviewAccessGuard>
  );
}
