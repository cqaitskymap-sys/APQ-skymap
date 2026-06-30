'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Download, Eye, Pencil, CheckCircle, Layers, Warehouse } from 'lucide-react';
import { toast } from 'sonner';
import { BarChart, Bar, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie } from 'recharts';
import { useAuth } from '@/contexts/auth-context';
import { cpvPermissions } from '@/lib/cpv';
import {
  summarizeRawMaterialRecords, buildRawMaterialChartSeries, RM_MATERIAL_TYPES, RM_QC_STATUSES,
  RM_COMPLIANCE_STATUSES, type RawMaterialMonitoringFormData, type RawMaterialMonitoringRecord,
} from '@/lib/cpv-raw-material-monitoring';
import {
  fetchRawMaterialRecords, fetchRmBatchesForProduct, fetchMaterialMasterOptions, fetchVendorOptions,
  createRawMaterialRecord, updateRawMaterialRecord, approveRawMaterialRecord, reviewRawMaterialRecord,
  bulkCreateRawMaterialRecords, importFromWarehouseReceipt, fetchWarehouseReceiptsForImport,
  logRawMaterialExport,
} from '@/lib/cpv-raw-material-monitoring-service';
import { fetchActiveCpvProductsForBatch as fetchProducts } from '@/lib/cpv-batch-registration-service';
import type { CpvProductRecord } from '@/lib/cpv-product-master';
import type { MaterialMaster } from '@/lib/material-schemas';
import type { VendorRecord } from '@/lib/vendor-mgmt-types';
import { downloadCsv } from '@/lib/export-utils';
import { CpvPageHeader } from '@/components/cpv/product-master/cpv-page-header';
import { ResponsiveDataTable } from '@/components/cpv/product-master/responsive-data-table';
import { KpiCard, StatusBadge } from '@/components/cpv/cpv-ui';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { EmptyState } from '@/components/admin/dashboard/empty-state';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { ColumnDef } from '@/components/admin/admin-data-table';

const CHART_COLORS = ['#2563eb', '#059669', '#d97706', '#dc2626', '#7c3aed'];

function RiskBadge({ level }: { level: string }) {
  const cls = level === 'Critical' ? 'bg-red-900/10 text-red-900 border-red-300'
    : level === 'High' ? 'bg-red-50 text-red-700 border-red-200'
      : level === 'Medium' ? 'bg-amber-50 text-amber-700 border-amber-200'
        : 'bg-slate-50 text-slate-600 border-slate-200';
  return <span className={`rounded-md border px-2 py-0.5 text-xs font-medium ${cls}`}>{level}</span>;
}

function AvlBadge({ status }: { status: string }) {
  const ok = ['Approved', 'Conditional Approved', 'Conditionally Approved'].includes(status);
  return <span className={`rounded-md border px-2 py-0.5 text-xs font-medium ${ok ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>{status}</span>;
}

export function RawMaterialMonitoringPage() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const role = profile?.role;
  const canCreate = cpvPermissions.canCreateRawMaterial(role) && !cpvPermissions.isRawMaterialViewOnly(role);
  const canReview = cpvPermissions.canReviewRawMaterial(role);
  const canImportExport = cpvPermissions.canImportExportRawMaterial(role);
  const canQaOverride = cpvPermissions.canReviewRawMaterial(role);
  const isReadOnly = cpvPermissions.isReadOnly(role) || cpvPermissions.isRawMaterialViewOnly(role);

  const [records, setRecords] = useState<RawMaterialMonitoringRecord[]>([]);
  const [products, setProducts] = useState<CpvProductRecord[]>([]);
  const [materials, setMaterials] = useState<MaterialMaster[]>([]);
  const [vendors, setVendors] = useState<VendorRecord[]>([]);
  const [receipts, setReceipts] = useState<Awaited<ReturnType<typeof fetchWarehouseReceiptsForImport>>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [warehouseOpen, setWarehouseOpen] = useState(false);
  const [editing, setEditing] = useState<RawMaterialMonitoringRecord | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [qcFilter, setQcFilter] = useState('all');
  const [complianceFilter, setComplianceFilter] = useState('all');
  const [riskFilter, setRiskFilter] = useState('all');

  const [formProductId, setFormProductId] = useState('');
  const [formBatches, setFormBatches] = useState<Awaited<ReturnType<typeof fetchRmBatchesForProduct>>>([]);
  const [form, setForm] = useState<Partial<RawMaterialMonitoringFormData>>({});
  const [bulkProductId, setBulkProductId] = useState('');
  const [bulkBatchId, setBulkBatchId] = useState('');
  const [bulkRows, setBulkRows] = useState<Array<{ material: MaterialMaster; used: string; remarks: string }>>([]);
  const [warehouseReceiptId, setWarehouseReceiptId] = useState('');
  const [warehouseUsedQty, setWarehouseUsedQty] = useState('');

  const actor = { id: user?.uid || 'system', name: profile?.full_name || 'System', role: role || '' };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [rows, prods, mats, vends, rcpts] = await Promise.all([
        fetchRawMaterialRecords(), fetchProducts(), fetchMaterialMasterOptions(),
        fetchVendorOptions(), fetchWarehouseReceiptsForImport(),
      ]);
      setRecords(rows);
      setProducts(prods);
      setMaterials(mats);
      setVendors(vends);
      setReceipts(rcpts);
    } catch {
      setError('Failed to load raw material records.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return records.filter((r) => {
      if (typeFilter !== 'all' && r.materialType !== typeFilter) return false;
      if (qcFilter !== 'all' && r.qcStatus !== qcFilter) return false;
      if (complianceFilter !== 'all' && r.complianceStatus !== complianceFilter) return false;
      if (riskFilter !== 'all' && r.riskLevel !== riskFilter) return false;
      if (!q) return true;
      return r.productName.toLowerCase().includes(q) || r.batchNumber.toLowerCase().includes(q)
        || r.materialName.toLowerCase().includes(q) || r.vendorName.toLowerCase().includes(q)
        || r.arNumber.toLowerCase().includes(q) || r.grnNumber.toLowerCase().includes(q);
    });
  }, [records, search, typeFilter, qcFilter, complianceFilter, riskFilter]);

  const summary = useMemo(() => summarizeRawMaterialRecords(records), [records]);
  const charts = useMemo(() => buildRawMaterialChartSeries(filtered), [filtered]);

  const onProductChange = async (productId: string) => {
    setFormProductId(productId);
    const p = products.find((x) => x.id === productId);
    if (!p) return;
    setForm((f) => ({ ...f, cpvProductId: productId, productName: p.productName, productCode: p.productCode }));
    const batches = await fetchRmBatchesForProduct(p.productName);
    setFormBatches(batches);
  };

  const onMaterialChange = (materialId: string) => {
    const m = materials.find((x) => x.id === materialId);
    if (!m) return;
    setForm((f) => ({
      ...f,
      materialCode: m.materialCode,
      materialName: m.materialName,
      materialType: mapMaterialType(m.materialType),
      materialGrade: m.grade,
      specificationNumber: m.specificationNo,
      stpNumber: '',
      storageCondition: m.storageCondition,
      unit: f.unit || 'kg',
    }));
  };

  const onVendorChange = (vendorId: string) => {
    const v = vendors.find((x) => x.id === vendorId);
    if (!v) return;
    setForm((f) => ({
      ...f,
      vendorId: vendorId,
      vendorName: v.vendor_name,
      vendorStatus: v.vendor_status === 'Active' ? 'Active' : v.vendor_status,
      avlStatus: v.approval_status,
      manufacturerName: v.manufacturer_name || f.manufacturerName || v.vendor_name,
      supplierName: v.supplier_name || f.supplierName || v.vendor_name,
    }));
  };

  const openCreate = () => {
    setEditing(null);
    setForm({
      mfgDate: new Date().toISOString().split('T')[0],
      expDate: new Date(Date.now() + 365 * 86400000).toISOString().split('T')[0],
      qcStatus: 'Under Test',
      coaAvailable: 'No',
      receivedQuantity: 0,
      issuedQuantity: 0,
      usedQuantity: 0,
      unit: 'kg',
      vendorStatus: 'Active',
      avlStatus: 'Approved',
    });
    setFormOpen(true);
  };

  const saveForm = async (qaOverride = false) => {
    if (!form.cpvProductId || !form.batchNumber || !form.materialName || !form.arNumber) {
      toast.error('Complete required fields');
      return;
    }
    setSubmitting(true);
    const data = form as RawMaterialMonitoringFormData;
    if (editing) {
      const { error: err } = await updateRawMaterialRecord(editing.id, data, actor, editing, editing.attachments, qaOverride || (editing.isLocked && canQaOverride));
      if (err) toast.error(err);
      else { toast.success('Record updated'); setFormOpen(false); await load(); }
    } else {
      const { error: err } = await createRawMaterialRecord(data, actor, [], qaOverride);
      if (err) toast.error(err);
      else { toast.success('Record created'); setFormOpen(false); await load(); }
    }
    setSubmitting(false);
  };

  const saveWarehouseImport = async () => {
    const p = products.find((x) => x.id === formProductId);
    const batch = formBatches.find((b) => b.id === bulkBatchId);
    if (!p || !batch || !warehouseReceiptId) { toast.error('Select product, batch and receipt'); return; }
    setSubmitting(true);
    const { error: err } = await importFromWarehouseReceipt(
      warehouseReceiptId, p.id, p.productName, p.productCode, batch.batchNumber,
      Number(warehouseUsedQty) || 0, actor,
    );
    setSubmitting(false);
    if (err) toast.error(err);
    else { toast.success('Imported from warehouse'); setWarehouseOpen(false); await load(); }
  };

  const saveBulk = async () => {
    const p = products.find((x) => x.id === bulkProductId);
    const batch = formBatches.find((b) => b.id === bulkBatchId);
    if (!p || !batch) { toast.error('Select product and batch'); return; }
    const rows: RawMaterialMonitoringFormData[] = bulkRows.filter((r) => r.used).map((row) => ({
      cpvProductId: bulkProductId,
      productName: p.productName,
      productCode: p.productCode,
      batchNumber: batch.batchNumber,
      materialCode: row.material.materialCode,
      materialName: row.material.materialName,
      materialType: mapMaterialType(row.material.materialType),
      materialGrade: row.material.grade,
      manufacturerName: row.material.materialName,
      supplierName: row.material.materialName,
      vendorId: '',
      vendorName: 'To be assigned',
      vendorStatus: 'Active',
      avlStatus: 'Approved',
      grnNumber: '',
      arNumber: `AR-${Date.now()}-${row.material.materialCode}`,
      coaNumber: '',
      materialLotNumber: '',
      mfgDate: new Date().toISOString().split('T')[0],
      expDate: new Date(Date.now() + 365 * 86400000).toISOString().split('T')[0],
      retestDate: '',
      receivedQuantity: 0,
      issuedQuantity: Number(row.used),
      usedQuantity: Number(row.used),
      unit: 'kg',
      storageCondition: row.material.storageCondition,
      qcStatus: 'Under Test',
      coaAvailable: 'No',
      specificationNumber: row.material.specificationNo,
      stpNumber: '',
      testParameter: '',
      testUnit: '',
      remarks: row.remarks,
    }));
    setSubmitting(true);
    const { created, errors } = await bulkCreateRawMaterialRecords(rows, actor);
    setSubmitting(false);
    if (errors.length) toast.error(errors[0]);
    toast.success(`${created} records saved`);
    setBulkOpen(false);
    await load();
  };

  const columns: ColumnDef<RawMaterialMonitoringRecord>[] = [
    { key: 'batchNumber', header: 'Batch' },
    { key: 'materialName', header: 'Material' },
    { key: 'vendorName', header: 'Vendor' },
    { key: 'arNumber', header: 'AR No' },
    { key: 'usedQuantity', header: 'Used' },
    { key: 'complianceStatus', header: 'Compliance', render: (r) => <StatusBadge status={r.complianceStatus} /> },
    { key: 'riskLevel', header: 'Risk', render: (r) => <RiskBadge level={r.riskLevel} /> },
    { key: 'avlStatus', header: 'AVL', render: (r) => <AvlBadge status={r.avlStatus} /> },
  ];

  const vendorWarning = form.avlStatus && !['Approved', 'Conditional Approved', 'Conditionally Approved'].includes(form.avlStatus);

  if (loading) return <div className="p-4 sm:p-6"><LoadingSkeleton rows={2} /></div>;
  if (error) return <div className="p-4 sm:p-6"><ErrorCard message={error} onRetry={load} /></div>;

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <CpvPageHeader
        title="Raw Material Monitoring"
        description="Monitor API and raw material quality, vendor compliance and batch-wise usage for CPV"
        trail={[{ label: 'Continued Process Verification', href: '/cpv/dashboard' }, { label: 'Raw Material Monitoring' }]}
        actions={
          <>
            {canImportExport && (
              <Button variant="outline" size="sm" onClick={() => toast.info('Excel import placeholder — upload template coming soon')}>Import Excel</Button>
            )}
            {canCreate && (
              <Button variant="outline" size="sm" className="gap-2" onClick={() => { setWarehouseOpen(true); if (products[0]) void onProductChange(products[0].id); }}>
                <Warehouse className="h-4 w-4" />From Warehouse
              </Button>
            )}
            {canImportExport && (
              <Button variant="outline" size="sm" className="gap-2" onClick={async () => {
                downloadCsv(`raw-materials-${Date.now()}.csv`, ['Batch', 'Material', 'AR', 'Compliance', 'Risk'],
                  filtered.map((r) => [r.batchNumber, r.materialName, r.arNumber, r.complianceStatus, r.riskLevel]));
                await logRawMaterialExport(actor, filtered.length);
                toast.success('Export CSV generated');
              }}><Download className="h-4 w-4" />Export</Button>
            )}
            {canCreate && !isReadOnly && (
              <>
                <Button variant="outline" size="sm" className="gap-2" onClick={() => { if (products[0]) { setBulkProductId(products[0].id); void onProductChange(products[0].id); setBulkRows(materials.slice(0, 5).map((m) => ({ material: m, used: '', remarks: '' }))); setBulkOpen(true); } }}>
                  <Layers className="h-4 w-4" />Bulk Entry
                </Button>
                <Button size="sm" className="gap-2" onClick={openCreate}><Plus className="h-4 w-4" />New Record</Button>
              </>
            )}
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-9">
        <KpiCard label="Total Lots" value={summary.total} tone="blue" />
        <KpiCard label="API Lots" value={summary.apiLots} tone="blue" />
        <KpiCard label="Excipient Lots" value={summary.excipientLots} tone="green" />
        <KpiCard label="Approved" value={summary.approvedLots} tone="green" />
        <KpiCard label="Rejected" value={summary.rejectedLots} tone="red" />
        <KpiCard label="AVL Compliant" value={summary.avlCompliant} tone="green" />
        <KpiCard label="Non-Compliant" value={summary.nonCompliant} tone="amber" />
        <KpiCard label="Expired/Retest" value={summary.expiredRetestDue} tone="red" />
        <KpiCard label="OOS Triggered" value={summary.oosTriggered} tone="amber" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Usage Trend</CardTitle></CardHeader>
          <CardContent className="h-[240px]">
            {charts.usageTrend.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={charts.usageTrend}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" /><YAxis /><Tooltip />
                  <Line type="monotone" dataKey="quantity" stroke={CHART_COLORS[0]} strokeWidth={2} /></LineChart>
              </ResponsiveContainer>
            ) : <EmptyState title="No usage data" />}
          </CardContent>
        </Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Vendor Trend</CardTitle></CardHeader>
          <CardContent className="h-[240px]">
            {charts.vendorTrend.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={charts.vendorTrend}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="vendor" tick={{ fontSize: 9 }} /><YAxis /><Tooltip /><Bar dataKey="count" fill={CHART_COLORS[1]} /></BarChart>
              </ResponsiveContainer>
            ) : <EmptyState title="No vendor data" />}
          </CardContent>
        </Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Approved vs Rejected</CardTitle></CardHeader>
          <CardContent className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart><Pie data={charts.approvedVsRejected} dataKey="count" nameKey="status" cx="50%" cy="50%" outerRadius={70} label>
                {charts.approvedVsRejected.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}</Pie><Tooltip /></PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Risk Distribution</CardTitle></CardHeader>
          <CardContent className="h-[240px]">
            {charts.riskDistribution.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart><Pie data={charts.riskDistribution} dataKey="count" nameKey="level" cx="50%" cy="50%" outerRadius={70} label>
                  {charts.riskDistribution.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}</Pie><Tooltip /></PieChart>
              </ResponsiveContainer>
            ) : <EmptyState title="No risk data" />}
          </CardContent>
        </Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">AVL Compliance Trend</CardTitle></CardHeader>
          <CardContent className="h-[240px]">
            {charts.avlComplianceTrend.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={charts.avlComplianceTrend}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" /><YAxis domain={[0, 100]} /><Tooltip />
                  <Line type="monotone" dataKey="rate" name="AVL %" stroke={CHART_COLORS[3]} strokeWidth={2} /></LineChart>
              </ResponsiveContainer>
            ) : <EmptyState title="No AVL trend" />}
          </CardContent>
        </Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Retest Due Trend</CardTitle></CardHeader>
          <CardContent className="h-[240px]">
            {charts.retestDueTrend.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={charts.retestDueTrend}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" /><YAxis /><Tooltip /><Bar dataKey="count" fill={CHART_COLORS[4]} /></BarChart>
              </ResponsiveContainer>
            ) : <EmptyState title="No retest due data" />}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="grid gap-3 lg:grid-cols-5">
            <Input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="lg:col-span-2" />
            <Select value={typeFilter} onValueChange={setTypeFilter}><SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
              <SelectContent><SelectItem value="all">All Types</SelectItem>{RM_MATERIAL_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select>
            <Select value={qcFilter} onValueChange={setQcFilter}><SelectTrigger><SelectValue placeholder="QC" /></SelectTrigger>
              <SelectContent><SelectItem value="all">All QC</SelectItem>{RM_QC_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
            <Select value={complianceFilter} onValueChange={setComplianceFilter}><SelectTrigger><SelectValue placeholder="Compliance" /></SelectTrigger>
              <SelectContent><SelectItem value="all">All</SelectItem>{RM_COMPLIANCE_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
          </div>
          {filtered.length === 0 ? <EmptyState title="No raw material records" /> : (
            <ResponsiveDataTable
              columns={columns}
              data={filtered}
              pageSize={10}
              onRowClick={(r) => router.push(`/cpv/raw-material-monitoring/${r.id}`)}
              actions={(row) => (
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" onClick={() => router.push(`/cpv/raw-material-monitoring/${row.id}`)}><Eye className="h-4 w-4" /></Button>
                  {canCreate && !isReadOnly && (!row.isLocked || canQaOverride) && (
                    <Button size="icon" variant="ghost" onClick={() => { setEditing(row); setForm(row); setFormProductId(row.cpvProductId); void onProductChange(row.cpvProductId); setFormOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                  )}
                  {canReview && row.reviewStatus === 'Draft' && (
                    <Button size="icon" variant="ghost" onClick={async () => { await reviewRawMaterialRecord(row.id, actor, row); await load(); }}><CheckCircle className="h-4 w-4" /></Button>
                  )}
                  {canReview && row.reviewStatus === 'Under Review' && (
                    <Button size="sm" variant="outline" onClick={async () => { await approveRawMaterialRecord(row.id, actor, row); await load(); }}>Approve</Button>
                  )}
                </div>
              )}
            />
          )}
        </CardContent>
      </Card>

      <Sheet open={formOpen} onOpenChange={setFormOpen}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader><SheetTitle>{editing ? 'Edit Raw Material Record' : 'New Raw Material Record'}</SheetTitle></SheetHeader>
          <div className="mt-6 space-y-3">
            {vendorWarning && (
              <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                Vendor/AVL not approved. Save blocked unless QA override.
                {canQaOverride && <Button variant="link" className="h-auto p-0 ml-2" onClick={() => void saveForm(true)}>QA Override</Button>}
              </div>
            )}
            {!editing && (
              <div><Label>CPV Product *</Label>
                <Select value={formProductId} onValueChange={(v) => void onProductChange(v)}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Product" /></SelectTrigger>
                  <SelectContent>{products.map((p) => <SelectItem key={p.id} value={p.id}>{p.productName}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <div><Label>Batch *</Label>
              <Select value={form.batchNumber || ''} onValueChange={(v) => setForm((f) => ({ ...f, batchNumber: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{formBatches.map((b) => <SelectItem key={b.id} value={b.batchNumber}>{b.batchNumber}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Material *</Label>
              <Select value={materials.find((m) => m.materialCode === form.materialCode)?.id || ''} onValueChange={onMaterialChange} disabled={Boolean(editing)}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Material" /></SelectTrigger>
                <SelectContent>{materials.map((m) => <SelectItem key={m.id} value={m.id || ''}>{m.materialName}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Vendor *</Label>
              <Select value={form.vendorId || ''} onValueChange={onVendorChange}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Vendor" /></SelectTrigger>
                <SelectContent>{vendors.map((v) => <SelectItem key={v.id} value={v.id}>{v.vendor_name}</SelectItem>)}</SelectContent>
              </Select>
              {form.avlStatus && <div className="mt-1"><AvlBadge status={form.avlStatus} /></div>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>AR Number *</Label><Input className="mt-1" value={form.arNumber || ''} onChange={(e) => setForm((f) => ({ ...f, arNumber: e.target.value }))} /></div>
              <div><Label>GRN Number</Label><Input className="mt-1" value={form.grnNumber || ''} onChange={(e) => setForm((f) => ({ ...f, grnNumber: e.target.value }))} /></div>
              <div><Label>MFG Date *</Label><Input className="mt-1" type="month" value={(form.mfgDate || '').slice(0, 7)} onChange={(e) => setForm((f) => ({ ...f, mfgDate: e.target.value }))} /></div>
              <div><Label>EXP Date *</Label><Input className="mt-1" type="month" value={(form.expDate || '').slice(0, 7)} onChange={(e) => setForm((f) => ({ ...f, expDate: e.target.value }))} /></div>
              <div><Label>Issued Qty</Label><Input className="mt-1" type="number" value={form.issuedQuantity ?? ''} onChange={(e) => setForm((f) => ({ ...f, issuedQuantity: Number(e.target.value) }))} /></div>
              <div><Label>Used Qty *</Label><Input className="mt-1" type="number" value={form.usedQuantity ?? ''} onChange={(e) => setForm((f) => ({ ...f, usedQuantity: Number(e.target.value) }))} /></div>
              <div><Label>Unit *</Label><Input className="mt-1" value={form.unit || ''} onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))} /></div>
              <div><Label>QC Status *</Label>
                <Select value={form.qcStatus || ''} onValueChange={(v) => setForm((f) => ({ ...f, qcStatus: v as RawMaterialMonitoringFormData['qcStatus'] }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{RM_QC_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>COA Available *</Label>
                <Select value={form.coaAvailable || 'No'} onValueChange={(v) => setForm((f) => ({ ...f, coaAvailable: v as 'Yes' | 'No' }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="Yes">Yes</SelectItem><SelectItem value="No">No</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Remarks</Label><Textarea className="mt-1" value={form.remarks || ''} onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))} /></div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
              <Button onClick={() => void saveForm()} disabled={submitting}>{submitting ? 'Saving...' : 'Save'}</Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={warehouseOpen} onOpenChange={setWarehouseOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Import from Warehouse Receipt</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div><Label>Product</Label>
              <Select value={formProductId} onValueChange={(v) => void onProductChange(v)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{products.map((p) => <SelectItem key={p.id} value={p.id}>{p.productName}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Batch</Label>
              <Select value={bulkBatchId} onValueChange={setBulkBatchId}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{formBatches.map((b) => <SelectItem key={b.id} value={b.id}>{b.batchNumber}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Warehouse Receipt</Label>
              <Select value={warehouseReceiptId} onValueChange={setWarehouseReceiptId}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select receipt" /></SelectTrigger>
                <SelectContent>{receipts.map((r) => <SelectItem key={r.id} value={r.id}>{r.grn_number} — {r.material_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Used Quantity</Label><Input className="mt-1" type="number" value={warehouseUsedQty} onChange={(e) => setWarehouseUsedQty(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWarehouseOpen(false)}>Cancel</Button>
            <Button onClick={() => void saveWarehouseImport()} disabled={submitting}>Import</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Bulk Raw Material Entry</DialogTitle></DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2 py-2">
            <div><Label>Product</Label>
              <Select value={bulkProductId} onValueChange={async (v) => {
                setBulkProductId(v);
                const p = products.find((x) => x.id === v);
                if (p) setFormBatches(await fetchRmBatchesForProduct(p.productName));
              }}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{products.map((p) => <SelectItem key={p.id} value={p.id}>{p.productName}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Batch</Label>
              <Select value={bulkBatchId} onValueChange={setBulkBatchId}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{formBatches.map((b) => <SelectItem key={b.id} value={b.id}>{b.batchNumber}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <Table>
            <TableHeader><TableRow><TableHead>Material</TableHead><TableHead>Used Qty</TableHead><TableHead>Remarks</TableHead></TableRow></TableHeader>
            <TableBody>
              {bulkRows.map((row, i) => (
                <TableRow key={row.material.id || i}>
                  <TableCell>{row.material.materialName}</TableCell>
                  <TableCell><Input value={row.used} onChange={(e) => setBulkRows((rows) => rows.map((r, j) => j === i ? { ...r, used: e.target.value } : r))} /></TableCell>
                  <TableCell><Input value={row.remarks} onChange={(e) => setBulkRows((rows) => rows.map((r, j) => j === i ? { ...r, remarks: e.target.value } : r))} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkOpen(false)}>Cancel</Button>
            <Button onClick={() => void saveBulk()} disabled={submitting}>Save All</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function mapMaterialType(t: string): RawMaterialMonitoringFormData['materialType'] {
  const map: Record<string, RawMaterialMonitoringFormData['materialType']> = {
    API: 'API', Excipient: 'Excipient', Preservative: 'Preservative', Solvent: 'Solvent',
    Buffer: 'Buffer', 'pH Adjuster': 'pH Adjuster', 'Raw Material': 'Raw Material', Other: 'Other',
  };
  return map[t] || 'Other';
}
