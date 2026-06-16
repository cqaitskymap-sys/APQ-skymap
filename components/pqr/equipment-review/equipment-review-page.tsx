'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Download, Eye, FileSpreadsheet, Loader2, Pencil, Plus, RefreshCw, Save, Trash2,
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
  MANUFACTURING_CATEGORIES, PACKING_CATEGORIES, PQR_CALIBRATION_STATUSES,
  PQR_EQUIPMENT_CATEGORIES, PQR_PM_STATUSES, PQR_QUALIFICATION_STATUSES, PQR_RISK_LEVELS,
  QC_CATEGORIES, UTILITY_CATEGORIES, canExportEquipmentReview, canManageEquipmentReview,
  computeEquipmentSummary, type EquipmentReviewFormData, type PqrEquipmentReviewRecord,
} from '@/lib/pqr-equipment-review-records';
import {
  buildEquipmentCharts, createEquipmentReviewRecord, fetchEquipmentReviewRecords,
  fetchPqrOptions, getEquipmentReviewNarrative, logEquipmentNarrativeEdit,
  logEquipmentReviewExport, logEquipmentReviewView, pullEquipmentData,
  recalculateAllEquipmentCompliance, saveEquipmentSectionToPqr,
  softDeleteEquipmentReviewRecord, updateEquipmentReviewRecord,
} from '@/lib/pqr-equipment-review-service';
import { CpvPageHeader } from '@/components/cpv/product-master/cpv-page-header';
import { ResponsiveDataTable } from '@/components/cpv/product-master/responsive-data-table';
import { KpiCard } from '@/components/cpv/cpv-ui';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { EmptyState } from '@/components/admin/dashboard/empty-state';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EquipmentReviewAccessGuard } from './equipment-review-access-guard';
import { EquipmentReviewFormDialog } from './equipment-review-form-dialog';
import {
  CalibrationBadge, EquipmentComplianceBadge, EquipmentRiskBadge, PmBadge, QualificationBadge,
} from './equipment-review-badges';
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

type TableRow = PqrEquipmentReviewRecord & { srNo: number };

export function EquipmentReviewPage() {
  const { user, profile } = useAuth();
  const role = profile?.role;
  const canManage = canManageEquipmentReview(role);
  const canExport = canExportEquipmentReview(role);

  const [pqrs, setPqrs] = useState<PqrOption[]>([]);
  const [selectedPqrId, setSelectedPqrId] = useState('');
  const [records, setRecords] = useState<PqrEquipmentReviewRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [narrative, setNarrative] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editRecord, setEditRecord] = useState<PqrEquipmentReviewRecord | null>(null);
  const [detailRecord, setDetailRecord] = useState<PqrEquipmentReviewRecord | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [filterCategory, setFilterCategory] = useState('all');
  const [filterQual, setFilterQual] = useState('all');
  const [filterCal, setFilterCal] = useState('all');
  const [filterPm, setFilterPm] = useState('all');
  const [filterRisk, setFilterRisk] = useState('all');
  const [filterDept, setFilterDept] = useState('');
  const [filterName, setFilterName] = useState('');

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

  const loadRecords = useCallback(async (pqrId: string) => {
    if (!pqrId) return;
    setBusy(true);
    try {
      const rows = await fetchEquipmentReviewRecords(pqrId);
      setRecords(rows);
      setNarrative(getEquipmentReviewNarrative(rows));
    } catch { toast.error('Failed to load equipment records'); }
    finally { setBusy(false); }
  }, []);

  useEffect(() => { void loadPqrs(); void logEquipmentReviewView(actor); }, [loadPqrs, actor]);
  useEffect(() => { if (selectedPqrId) void loadRecords(selectedPqrId); }, [selectedPqrId, loadRecords]);

  const filtered = useMemo(() => records.filter((r) => {
    if (filterCategory !== 'all' && r.equipmentCategory !== filterCategory) return false;
    if (filterQual !== 'all' && r.qualificationStatus !== filterQual) return false;
    if (filterCal !== 'all' && r.calibrationStatus !== filterCal) return false;
    if (filterPm !== 'all' && r.pmStatus !== filterPm) return false;
    if (filterRisk !== 'all' && r.riskLevel !== filterRisk) return false;
    if (filterDept && !r.department.toLowerCase().includes(filterDept.toLowerCase())) return false;
    if (filterName && !`${r.equipmentName} ${r.equipmentId}`.toLowerCase().includes(filterName.toLowerCase())) return false;
    return true;
  }), [records, filterCategory, filterQual, filterCal, filterPm, filterRisk, filterDept, filterName]);

  const mfgRecords = useMemo(() => filtered.filter((r) => MANUFACTURING_CATEGORIES.includes(r.equipmentCategory)), [filtered]);
  const packRecords = useMemo(() => filtered.filter((r) => PACKING_CATEGORIES.includes(r.equipmentCategory)), [filtered]);
  const utilityRecords = useMemo(() => filtered.filter((r) => UTILITY_CATEGORIES.includes(r.equipmentCategory)), [filtered]);
  const qcRecords = useMemo(() => filtered.filter((r) => QC_CATEGORIES.includes(r.equipmentCategory)), [filtered]);
  const summary = useMemo(() => computeEquipmentSummary(filtered), [filtered]);
  const charts = useMemo(() => buildEquipmentCharts(filtered), [filtered]);

  const tableColumns: ColumnDef<TableRow>[] = [
    { key: 'srNo', header: 'Sr. No.' },
    { key: 'equipmentName', header: 'Equipment Name' },
    { key: 'equipmentId', header: 'Equipment ID' },
    { key: 'equipmentCategory', header: 'Category', render: (r) => <span className="text-xs">{r.equipmentCategory.replace(' Equipment', '')}</span> },
    { key: 'qualificationStatus', header: 'Qualification', render: (r) => <QualificationBadge status={r.qualificationStatus} /> },
    { key: 'calibrationStatus', header: 'Calibration', render: (r) => <CalibrationBadge status={r.calibrationStatus} /> },
    { key: 'pmStatus', header: 'PM Status', render: (r) => <PmBadge status={r.pmStatus} /> },
    { key: 'breakdownCount', header: 'Breakdowns' },
    { key: 'complianceStatus', header: 'Compliance', render: (r) => <EquipmentComplianceBadge status={r.complianceStatus} /> },
    { key: 'remarks', header: 'Remarks', render: (r) => <span className="line-clamp-1 max-w-[80px]">{r.remarks || '—'}</span> },
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

  const toTable = (rows: PqrEquipmentReviewRecord[]): TableRow[] => rows.map((r, i) => ({ ...r, srNo: i + 1 }));
  const renderTable = (rows: PqrEquipmentReviewRecord[], emptyTitle: string) => (
    rows.length ? (
      <ResponsiveDataTable columns={tableColumns} data={toTable(rows)} searchKeys={['equipmentName', 'equipmentId']} mobileTitleKey="equipmentName" mobileSubtitleKey="equipmentId" pageSize={15} />
    ) : <EmptyState title={emptyTitle} message="Pull equipment data or add manually." />
  );

  const handlePull = async () => {
    if (!selectedPqr) return;
    setBusy(true);
    const { created, skipped, error: err } = await pullEquipmentData(selectedPqr, actor);
    setBusy(false);
    if (err) return toast.error(err);
    toast.success(`${created} equipment record(s) pulled (${skipped} skipped)`);
    await loadRecords(selectedPqr.id);
  };

  const handleSaveForm = async (data: EquipmentReviewFormData): Promise<void> => {
    if (!selectedPqr) return;
    setBusy(true);
    const result = editRecord?.id
      ? await updateEquipmentReviewRecord(editRecord.id, selectedPqr, data, actor)
      : await createEquipmentReviewRecord(selectedPqr, data, actor);
    setBusy(false);
    if (result.error) { toast.error(result.error); return; }
    toast.success(editRecord ? 'Equipment updated' : 'Equipment added');
    setFormOpen(false);
    setEditRecord(null);
    await loadRecords(selectedPqr.id);
  };

  const handleSaveSection = async () => {
    if (!selectedPqr) return;
    setBusy(true);
    const { error: err } = await saveEquipmentSectionToPqr(selectedPqr.id, narrative, records, actor);
    setBusy(false);
    if (err) toast.error(err);
    else toast.success('Equipment section saved to PQR');
  };

  const handleRecalc = async () => {
    if (!selectedPqr) return;
    setBusy(true);
    await recalculateAllEquipmentCompliance(selectedPqr.id, actor);
    setBusy(false);
    toast.success('Compliance and risk recalculated');
    await loadRecords(selectedPqr.id);
  };

  const handleDelete = async (): Promise<void> => {
    if (!deleteId || !selectedPqr) return;
    setBusy(true);
    const { error: err } = await softDeleteEquipmentReviewRecord(deleteId, actor);
    setBusy(false);
    setDeleteId(null);
    if (err) { toast.error(err); return; }
    toast.success('Equipment record removed');
    await loadRecords(selectedPqr.id);
  };

  if (loading) return <EquipmentReviewAccessGuard><div className="p-4 sm:p-6"><LoadingSkeleton rows={3} /></div></EquipmentReviewAccessGuard>;
  if (error) return <EquipmentReviewAccessGuard><div className="p-4 sm:p-6"><ErrorCard message={error} onRetry={() => void loadPqrs()} /></div></EquipmentReviewAccessGuard>;

  return (
    <EquipmentReviewAccessGuard>
      <div className="space-y-6 p-4 sm:p-6">
        <CpvPageHeader
          title="Equipment Review"
          description="Review qualification, calibration, maintenance and performance of equipment used during PQR period"
          trail={[
            { label: 'Dashboard', href: '/dashboard' },
            { label: 'PQR Management', href: '/pqr/dashboard' },
            { label: 'Equipment Review' },
          ]}
          actions={(
            <>
              {canExport && (
                <Button variant="outline" size="sm" onClick={() => { void logEquipmentReviewExport(actor); toast.info('Export placeholder'); }}>
                  <FileSpreadsheet className="h-4 w-4 mr-1" />Export
                </Button>
              )}
              {canManage && selectedPqr && (
                <>
                  <Button variant="outline" size="sm" onClick={() => void handlePull()} disabled={busy}>
                    {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Download className="h-4 w-4 mr-1" />}
                    Pull Equipment
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => void handleRecalc()} disabled={busy}>Recalc</Button>
                  <Button size="sm" onClick={() => { setEditRecord(null); setFormOpen(true); }}><Plus className="h-4 w-4 mr-1" />Add</Button>
                </>
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
          <EmptyState title="Select a PQR" message="Choose a PQR to review equipment for the annual review period." />
        ) : (
          <>
            <div className="grid gap-3 grid-cols-2 md:grid-cols-5 xl:grid-cols-10">
              <KpiCard label="Total Equipment" value={summary.totalEquipmentReviewed} />
              <KpiCard label="Qualified" value={summary.qualifiedEquipment} tone="green" />
              <KpiCard label="Cal Due" value={summary.calibrationDue} tone="amber" />
              <KpiCard label="Cal Overdue" value={summary.calibrationOverdue} tone="red" />
              <KpiCard label="PM Due" value={summary.pmDue} tone="amber" />
              <KpiCard label="PM Overdue" value={summary.pmOverdue} tone="red" />
              <KpiCard label="Breakdowns" value={summary.breakdownCount} />
              <KpiCard label="Deviations" value={summary.equipmentDeviations} />
              <KpiCard label="CAPA" value={summary.equipmentCapa} />
              <KpiCard label="Critical Risks" value={summary.criticalEquipmentRisks} tone="red" />
            </div>

            <Card><CardContent className="pt-6">
              <div className="flex flex-wrap gap-2">
                <Select value={filterCategory} onValueChange={setFilterCategory}>
                  <SelectTrigger className="w-[170px]"><SelectValue placeholder="Category" /></SelectTrigger>
                  <SelectContent><SelectItem value="all">All Categories</SelectItem>{PQR_EQUIPMENT_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={filterQual} onValueChange={setFilterQual}>
                  <SelectTrigger className="w-[150px]"><SelectValue placeholder="Qualification" /></SelectTrigger>
                  <SelectContent><SelectItem value="all">All Qual</SelectItem>{PQR_QUALIFICATION_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={filterCal} onValueChange={setFilterCal}>
                  <SelectTrigger className="w-[150px]"><SelectValue placeholder="Calibration" /></SelectTrigger>
                  <SelectContent><SelectItem value="all">All Cal</SelectItem>{PQR_CALIBRATION_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={filterPm} onValueChange={setFilterPm}>
                  <SelectTrigger className="w-[130px]"><SelectValue placeholder="PM" /></SelectTrigger>
                  <SelectContent><SelectItem value="all">All PM</SelectItem>{PQR_PM_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={filterRisk} onValueChange={setFilterRisk}>
                  <SelectTrigger className="w-[120px]"><SelectValue placeholder="Risk" /></SelectTrigger>
                  <SelectContent><SelectItem value="all">All Risk</SelectItem>{PQR_RISK_LEVELS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
                <Input placeholder="Equipment" className="w-[130px]" value={filterName} onChange={(e) => setFilterName(e.target.value)} />
                <Input placeholder="Department" className="w-[120px]" value={filterDept} onChange={(e) => setFilterDept(e.target.value)} />
                <Button variant="outline" size="icon" onClick={() => void loadRecords(selectedPqrId)} disabled={busy}>
                  <RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </CardContent></Card>

            <Tabs defaultValue="mfg">
              <TabsList className="flex flex-wrap h-auto">
                <TabsTrigger value="mfg">Manufacturing</TabsTrigger>
                <TabsTrigger value="pack">Packing</TabsTrigger>
                <TabsTrigger value="utility">Utility</TabsTrigger>
                <TabsTrigger value="qc">QC Equipment</TabsTrigger>
                <TabsTrigger value="qual">Qualification</TabsTrigger>
                <TabsTrigger value="cal">Calibration</TabsTrigger>
                <TabsTrigger value="pm">PM Review</TabsTrigger>
                <TabsTrigger value="breakdown">Breakdown</TabsTrigger>
                <TabsTrigger value="compliance">Compliance</TabsTrigger>
                <TabsTrigger value="charts">Charts</TabsTrigger>
                <TabsTrigger value="narrative">Narrative</TabsTrigger>
              </TabsList>

              <TabsContent value="mfg" className="mt-4"><Card><CardContent className="pt-6 overflow-x-auto">{renderTable(mfgRecords, 'No manufacturing equipment')}</CardContent></Card></TabsContent>
              <TabsContent value="pack" className="mt-4"><Card><CardContent className="pt-6 overflow-x-auto">{renderTable(packRecords, 'No packing equipment')}</CardContent></Card></TabsContent>
              <TabsContent value="utility" className="mt-4"><Card><CardContent className="pt-6 overflow-x-auto">{renderTable(utilityRecords, 'No utility equipment')}</CardContent></Card></TabsContent>
              <TabsContent value="qc" className="mt-4"><Card><CardContent className="pt-6 overflow-x-auto">{renderTable(qcRecords, 'No QC equipment')}</CardContent></Card></TabsContent>

              <TabsContent value="qual" className="mt-4">
                <Card><CardHeader><CardTitle className="text-base">Qualification Review</CardTitle></CardHeader>
                  <CardContent className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="border-b bg-slate-50">
                        {['Equipment', 'IQ', 'OQ', 'PQ', 'Status'].map((h) => <th key={h} className="px-3 py-2 text-left font-medium">{h}</th>)}
                      </tr></thead>
                      <tbody>
                        {filtered.map((r) => (
                          <tr key={r.id} className="border-b">
                            <td className="px-3 py-2">{r.equipmentName}</td>
                            <td className="px-3 py-2">{r.iqStatus || '—'}</td>
                            <td className="px-3 py-2">{r.oqStatus || '—'}</td>
                            <td className="px-3 py-2">{r.pqStatus || '—'}</td>
                            <td className="px-3 py-2"><QualificationBadge status={r.qualificationStatus} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {!filtered.length && <EmptyState title="No qualification data" message="Pull equipment data to populate qualification review." />}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="cal" className="mt-4">
                <Card><CardHeader><CardTitle className="text-base">Calibration Review</CardTitle></CardHeader>
                  <CardContent className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="border-b bg-slate-50">
                        {['Equipment', 'Last Cal', 'Next Cal', 'Status'].map((h) => <th key={h} className="px-3 py-2 text-left font-medium">{h}</th>)}
                      </tr></thead>
                      <tbody>
                        {filtered.map((r) => (
                          <tr key={r.id} className="border-b">
                            <td className="px-3 py-2">{r.equipmentName}</td>
                            <td className="px-3 py-2">{r.lastCalibrationDate || '—'}</td>
                            <td className="px-3 py-2">{r.nextCalibrationDate || '—'}</td>
                            <td className="px-3 py-2"><CalibrationBadge status={r.calibrationStatus} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="pm" className="mt-4">
                <Card><CardHeader><CardTitle className="text-base">PM Review</CardTitle></CardHeader>
                  <CardContent className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="border-b bg-slate-50">
                        {['Equipment', 'Last PM', 'Next PM', 'Status'].map((h) => <th key={h} className="px-3 py-2 text-left font-medium">{h}</th>)}
                      </tr></thead>
                      <tbody>
                        {filtered.map((r) => (
                          <tr key={r.id} className="border-b">
                            <td className="px-3 py-2">{r.equipmentName}</td>
                            <td className="px-3 py-2">{r.lastPmDate || '—'}</td>
                            <td className="px-3 py-2">{r.nextPmDate || '—'}</td>
                            <td className="px-3 py-2"><PmBadge status={r.pmStatus} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="breakdown" className="mt-4">
                <Card><CardHeader><CardTitle className="text-base">Breakdown Analysis</CardTitle></CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    {filtered.filter((r) => r.breakdownCount > 0).map((r) => (
                      <p key={r.id}>{r.equipmentName}: {r.breakdownCount} breakdown(s), {r.downtimeHours}h downtime — {r.impactOnProduct}</p>
                    ))}
                    {!filtered.some((r) => r.breakdownCount > 0) && (
                      <p className="text-muted-foreground">No breakdowns recorded during the review period.</p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="compliance" className="mt-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <Card><CardHeader><CardTitle className="text-sm">Compliant Equipment</CardTitle></CardHeader>
                    <CardContent>{filtered.filter((r) => r.complianceStatus === 'Complies').length} of {filtered.length}</CardContent></Card>
                  <Card><CardHeader><CardTitle className="text-sm">Observation Summary</CardTitle></CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      {['Complies', 'Observation', 'Major Observation', 'Critical Observation'].map((s) => (
                        <p key={s}>{s}: {filtered.filter((r) => r.complianceStatus === s).length}</p>
                      ))}
                    </CardContent></Card>
                </div>
              </TabsContent>

              <TabsContent value="charts" className="mt-4">
                <div className="grid gap-4 lg:grid-cols-2">
                  <SafeChart title="Qualification Status" empty={!charts.qualificationStatus.length}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart><Pie data={charts.qualificationStatus} dataKey="value" nameKey="name" outerRadius={70} label>
                        {charts.qualificationStatus.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                      </Pie><Tooltip /></PieChart>
                    </ResponsiveContainer>
                  </SafeChart>
                  <SafeChart title="Calibration Compliance Trend" empty={!charts.calibrationComplianceTrend.length}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={charts.calibrationComplianceTrend}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" /><YAxis /><Tooltip /><Legend />
                        <Line type="monotone" dataKey="compliant" stroke="#059669" /><Line type="monotone" dataKey="nonCompliant" stroke="#dc2626" /></LineChart>
                    </ResponsiveContainer>
                  </SafeChart>
                  <SafeChart title="PM Compliance Trend" empty={!charts.pmComplianceTrend.length}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={charts.pmComplianceTrend}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" /><YAxis /><Tooltip /><Legend />
                        <Line type="monotone" dataKey="completed" stroke="#059669" /><Line type="monotone" dataKey="overdue" stroke="#dc2626" /></LineChart>
                    </ResponsiveContainer>
                  </SafeChart>
                  <SafeChart title="Breakdown Trend" empty={!charts.breakdownTrend.length}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={charts.breakdownTrend}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" /><YAxis /><Tooltip /><Line type="monotone" dataKey="count" stroke="#d97706" /></LineChart>
                    </ResponsiveContainer>
                  </SafeChart>
                  <SafeChart title="Risk Distribution" empty={!charts.riskDistribution.length}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart><Pie data={charts.riskDistribution} dataKey="value" nameKey="name" outerRadius={70} label>
                        {charts.riskDistribution.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                      </Pie><Tooltip /></PieChart>
                    </ResponsiveContainer>
                  </SafeChart>
                  <SafeChart title="Equipment Category Review" empty={!charts.categoryReview.length}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={charts.categoryReview}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" tick={{ fontSize: 9 }} /><YAxis /><Tooltip /><Bar dataKey="value" fill="#2563eb" /></BarChart>
                    </ResponsiveContainer>
                  </SafeChart>
                  <SafeChart title="Downtime Trend" empty={!charts.downtimeTrend.length}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={charts.downtimeTrend}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" /><YAxis /><Tooltip /><Line type="monotone" dataKey="hours" stroke="#7c3aed" /></LineChart>
                    </ResponsiveContainer>
                  </SafeChart>
                </div>
              </TabsContent>

              <TabsContent value="narrative" className="mt-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-base">PQR Section Narrative — Equipment Review</CardTitle>
                    {canManage && (
                      <Button size="sm" onClick={() => void handleSaveSection()} disabled={busy}>
                        <Save className="h-4 w-4 mr-1" />Save to PQR
                      </Button>
                    )}
                  </CardHeader>
                  <CardContent>
                    <Textarea className="min-h-[140px]" value={narrative} readOnly={!canManage}
                      onChange={(e) => { setNarrative(e.target.value); if (selectedPqr) void logEquipmentNarrativeEdit(actor, selectedPqr.id); }} />
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        )}

        {selectedPqr && (
          <EquipmentReviewFormDialog open={formOpen} onOpenChange={setFormOpen} pqr={selectedPqr} record={editRecord} onSubmit={handleSaveForm} loading={busy} />
        )}

        <Dialog open={!!detailRecord} onOpenChange={() => setDetailRecord(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{detailRecord?.equipmentName}</DialogTitle></DialogHeader>
            {detailRecord && (
              <div className="space-y-4">
                <dl className="grid grid-cols-2 gap-2 text-sm">
                  {[
                    ['Equipment ID', detailRecord.equipmentId], ['Category', detailRecord.equipmentCategory],
                    ['Type', detailRecord.equipmentType], ['Department', detailRecord.department],
                    ['Breakdowns', detailRecord.breakdownCount], ['Downtime (h)', detailRecord.downtimeHours],
                    ['Linked Deviations', detailRecord.linkedDeviations], ['Linked CAPA', detailRecord.linkedCapa],
                    ['Change Controls', detailRecord.linkedChangeControls], ['Product Impact', detailRecord.impactOnProduct],
                  ].map(([k, v]) => (
                    <div key={k}><dt className="text-muted-foreground">{k}</dt><dd className="font-medium">{String(v)}</dd></div>
                  ))}
                </dl>
                <div className="flex flex-wrap gap-2">
                  <QualificationBadge status={detailRecord.qualificationStatus} />
                  <CalibrationBadge status={detailRecord.calibrationStatus} />
                  <PmBadge status={detailRecord.pmStatus} />
                  <EquipmentComplianceBadge status={detailRecord.complianceStatus} />
                  <EquipmentRiskBadge level={detailRecord.riskLevel} />
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        <ConfirmDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)} title="Remove Equipment Record"
          description="This will soft-delete the equipment review record." confirmLabel="Remove" destructive loading={busy} onConfirm={handleDelete} />
      </div>
    </EquipmentReviewAccessGuard>
  );
}
