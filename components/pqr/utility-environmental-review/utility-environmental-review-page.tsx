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
  PQR_REVIEW_TYPES, canExportUtilityEnvReview, canManageUtilityEnvReview,
  computeUtilityEnvSummary, type PqrUtilityEnvironmentalReviewRecord, type UtilityEnvReviewFormData,
} from '@/lib/pqr-utility-environmental-review-records';
import {
  buildUtilityEnvCharts, createUtilityEnvReviewRecord, fetchUtilityEnvReviewRecords,
  fetchPqrOptions, getUtilityEnvReviewNarrative, logUtilityEnvNarrativeEdit,
  logUtilityEnvReviewExport, logUtilityEnvReviewView, pullUtilityEnvironmentalData,
  recalculateAllUtilityEnvCompliance, saveUtilityEnvSectionToPqr,
  softDeleteUtilityEnvReviewRecord, updateUtilityEnvReviewRecord,
} from '@/lib/pqr-utility-environmental-review-service';
import { CpvPageHeader } from '@/components/cpv/product-master/cpv-page-header';
import { ResponsiveDataTable } from '@/components/cpv/product-master/responsive-data-table';
import { KpiCard } from '@/components/cpv/cpv-ui';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { EmptyState } from '@/components/admin/dashboard/empty-state';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { UtilityEnvReviewAccessGuard } from './utility-env-review-access-guard';
import { UtilityEnvReviewFormDialog } from './utility-env-review-form-dialog';
import { ComplianceBadge, ExcursionBadge, GradeBadge, RiskBadge } from './utility-env-review-badges';
import { ParameterTrendChart } from './parameter-trend-chart';
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
const WFI_TYPES = ['Water for Injection', 'Purified Water'];
const AIR_TYPES = ['Compressed Air', 'Nitrogen'];

function SafeChart({ title, empty, children }: { title: string; empty?: boolean; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm">{title}</CardTitle></CardHeader>
      <CardContent className="h-52">{empty ? <EmptyState title="No data" message="No chart data." /> : children}</CardContent>
    </Card>
  );
}

type TableRow = PqrUtilityEnvironmentalReviewRecord & { srNo: number };

export function UtilityEnvironmentalReviewPage() {
  const { user, profile } = useAuth();
  const role = profile?.role;
  const canManage = canManageUtilityEnvReview(role);
  const canExport = canExportUtilityEnvReview(role);

  const [pqrs, setPqrs] = useState<PqrOption[]>([]);
  const [selectedPqrId, setSelectedPqrId] = useState('');
  const [records, setRecords] = useState<PqrUtilityEnvironmentalReviewRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [narrative, setNarrative] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editRecord, setEditRecord] = useState<PqrUtilityEnvironmentalReviewRecord | null>(null);
  const [detailRecord, setDetailRecord] = useState<PqrUtilityEnvironmentalReviewRecord | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [filterReviewType, setFilterReviewType] = useState('all');
  const [filterCompliance, setFilterCompliance] = useState('all');
  const [filterRisk, setFilterRisk] = useState('all');
  const [filterArea, setFilterArea] = useState('');

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
      const rows = await fetchUtilityEnvReviewRecords(pqrId);
      setRecords(rows);
      setNarrative(getUtilityEnvReviewNarrative(rows));
    } catch { toast.error('Failed to load review records'); }
    finally { setBusy(false); }
  }, []);

  useEffect(() => { void loadPqrs(); void logUtilityEnvReviewView(actor); }, [loadPqrs, actor]);
  useEffect(() => { if (selectedPqrId) void loadRecords(selectedPqrId); }, [selectedPqrId, loadRecords]);

  const filtered = useMemo(() => records.filter((r) => {
    if (filterReviewType !== 'all' && r.reviewType !== filterReviewType) return false;
    if (filterCompliance !== 'all' && r.complianceStatus !== filterCompliance) return false;
    if (filterRisk !== 'all' && r.riskLevel !== filterRisk) return false;
    if (filterArea && !r.systemAreaName.toLowerCase().includes(filterArea.toLowerCase())) return false;
    return true;
  }), [records, filterReviewType, filterCompliance, filterRisk, filterArea]);

  const utilityRecords = useMemo(() => filtered.filter((r) => r.reviewType === 'Utility Review'), [filtered]);
  const envRecords = useMemo(() => filtered.filter((r) => r.reviewType === 'Environmental Review'), [filtered]);
  const wfiRecords = useMemo(() => utilityRecords.filter((r) => WFI_TYPES.includes(r.utilityType)), [utilityRecords]);
  const airRecords = useMemo(() => utilityRecords.filter((r) => AIR_TYPES.includes(r.utilityType)), [utilityRecords]);
  const hvacRecords = useMemo(() => utilityRecords.filter((r) => r.utilityType === 'HVAC'), [utilityRecords]);
  const excursionRecords = useMemo(() => filtered.filter((r) => r.excursionCount > 0), [filtered]);
  const summary = useMemo(() => computeUtilityEnvSummary(filtered), [filtered]);
  const charts = useMemo(() => buildUtilityEnvCharts(filtered), [filtered]);

  const tableColumns: ColumnDef<TableRow>[] = [
    { key: 'srNo', header: 'Sr. No.' },
    { key: 'systemAreaName', header: 'System / Area' },
    { key: 'reviewType', header: 'Review Type', render: (r) => <span className="text-xs">{r.reviewType.replace(' Review', '')}</span> },
    { key: 'monitoringParameter', header: 'Parameter' },
    { key: 'observedMinimum', header: 'Min', render: (r) => r.observedMinimum ?? '—' },
    { key: 'observedMaximum', header: 'Max', render: (r) => r.observedMaximum ?? '—' },
    { key: 'observedAverage', header: 'Avg', render: (r) => r.observedAverage ?? '—' },
    { key: 'limits', header: 'Limit', render: (r) => `${r.lowerLimit}–${r.upperLimit}` },
    { key: 'excursionCount', header: 'Excursions', render: (r) => <ExcursionBadge count={r.excursionCount} /> },
    { key: 'deviationCount', header: 'Deviations' },
    { key: 'capaCount', header: 'CAPA' },
    { key: 'complianceStatus', header: 'Compliance', render: (r) => <ComplianceBadge status={r.complianceStatus} /> },
    { key: 'remarks', header: 'Remarks', render: (r) => <span className="line-clamp-1 max-w-[70px]">{r.remarks || '—'}</span> },
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

  const toTable = (rows: PqrUtilityEnvironmentalReviewRecord[]): TableRow[] => rows.map((r, i) => ({ ...r, srNo: i + 1 }));
  const renderTable = (rows: PqrUtilityEnvironmentalReviewRecord[], emptyTitle: string) => (
    rows.length ? (
      <ResponsiveDataTable columns={tableColumns} data={toTable(rows)} searchKeys={['systemAreaName', 'monitoringParameter']} mobileTitleKey="systemAreaName" mobileSubtitleKey="monitoringParameter" pageSize={15} />
    ) : <EmptyState title={emptyTitle} message="Pull monitoring data or add manually." />
  );

  const handlePull = async () => {
    if (!selectedPqr) return;
    setBusy(true);
    const { created, skipped, error: err } = await pullUtilityEnvironmentalData(selectedPqr, actor);
    setBusy(false);
    if (err) return toast.error(err);
    toast.success(`${created} review record(s) created (${skipped} skipped)`);
    await loadRecords(selectedPqr.id);
  };

  const handleSaveForm = async (data: UtilityEnvReviewFormData): Promise<void> => {
    if (!selectedPqr) return;
    setBusy(true);
    const result = editRecord?.id
      ? await updateUtilityEnvReviewRecord(editRecord.id, data, actor)
      : await createUtilityEnvReviewRecord(selectedPqr, data, actor);
    setBusy(false);
    if (result.error) { toast.error(result.error); return; }
    toast.success(editRecord ? 'Record updated' : 'Record added');
    setFormOpen(false);
    setEditRecord(null);
    await loadRecords(selectedPqr.id);
  };

  const handleSaveSection = async () => {
    if (!selectedPqr) return;
    setBusy(true);
    const { error: err } = await saveUtilityEnvSectionToPqr(selectedPqr.id, narrative, records, actor);
    setBusy(false);
    if (err) toast.error(err);
    else toast.success('Section saved to PQR');
  };

  const handleRecalc = async () => {
    if (!selectedPqr) return;
    setBusy(true);
    await recalculateAllUtilityEnvCompliance(selectedPqr.id, actor);
    setBusy(false);
    toast.success('Compliance and risk recalculated');
    await loadRecords(selectedPqr.id);
  };

  const handleDelete = async (): Promise<void> => {
    if (!deleteId || !selectedPqr) return;
    setBusy(true);
    const { error: err } = await softDeleteUtilityEnvReviewRecord(deleteId, actor);
    setBusy(false);
    setDeleteId(null);
    if (err) { toast.error(err); return; }
    toast.success('Record removed');
    await loadRecords(selectedPqr.id);
  };

  if (loading) return <UtilityEnvReviewAccessGuard><div className="p-4 sm:p-6"><LoadingSkeleton rows={3} /></div></UtilityEnvReviewAccessGuard>;
  if (error) return <UtilityEnvReviewAccessGuard><div className="p-4 sm:p-6"><ErrorCard message={error} onRetry={() => void loadPqrs()} /></div></UtilityEnvReviewAccessGuard>;

  return (
    <UtilityEnvReviewAccessGuard>
      <div className="space-y-6 p-4 sm:p-6">
        <CpvPageHeader
          title="Utility & Environmental Review"
          description="Review utility performance and cleanroom environmental monitoring during the PQR period"
          trail={[
            { label: 'Dashboard', href: '/dashboard' },
            { label: 'PQR Management', href: '/pqr/dashboard' },
            { label: 'Utility & Environmental Review' },
          ]}
          actions={(
            <>
              {canExport && (
                <Button variant="outline" size="sm" onClick={() => { void logUtilityEnvReviewExport(actor); toast.info('Export placeholder'); }}>
                  <FileSpreadsheet className="h-4 w-4 mr-1" />Export
                </Button>
              )}
              {canManage && selectedPqr && (
                <>
                  <Button variant="outline" size="sm" onClick={() => void handlePull()} disabled={busy}>
                    {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Download className="h-4 w-4 mr-1" />}
                    Pull Data
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => void handleRecalc()} disabled={busy}>Recalc</Button>
                  <Button size="sm" onClick={() => { setEditRecord(null); setFormOpen(true); }}><Plus className="h-4 w-4 mr-1" />Add</Button>
                </>
              )}
            </>
          )}
        />

        <Card><CardContent className="pt-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2 sm:col-span-2">
              <Label>PQR Number *</Label>
              <Select value={selectedPqrId} onValueChange={setSelectedPqrId}>
                <SelectTrigger><SelectValue placeholder="Select PQR..." /></SelectTrigger>
                <SelectContent>{pqrs.map((p) => <SelectItem key={p.id} value={p.id}>{p.pqrNumber} — {p.productName}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {selectedPqr && (
              <>
                <div><Label className="text-muted-foreground">Product</Label><p className="text-sm font-medium">{selectedPqr.productName}</p></div>
                <div><Label className="text-muted-foreground">Review Period</Label><p className="text-sm font-medium">{selectedPqr.reviewPeriodFrom} — {selectedPqr.reviewPeriodTo}</p></div>
              </>
            )}
          </div>
        </CardContent></Card>

        {!selectedPqr ? (
          <EmptyState title="Select a PQR" message="Choose a PQR to review utility and environmental monitoring data." />
        ) : (
          <>
            <div className="grid gap-3 grid-cols-2 md:grid-cols-5 xl:grid-cols-10">
              <KpiCard label="Utility Records" value={summary.totalUtilityRecords} />
              <KpiCard label="Environmental Records" value={summary.totalEnvironmentalRecords} />
              <KpiCard label="Compliant" value={summary.compliantRecords} tone="green" />
              <KpiCard label="Alerts" value={summary.alertRecords} tone="amber" />
              <KpiCard label="Actions" value={summary.actionRecords} tone="amber" />
              <KpiCard label="Excursions" value={summary.excursionRecords} tone="red" />
              <KpiCard label="Grade A/B Exc." value={summary.gradeAExcursions} tone="red" />
              <KpiCard label="Deviations" value={summary.deviationCount} />
              <KpiCard label="CAPA" value={summary.capaCount} />
              <KpiCard label="Critical Risks" value={summary.openCriticalRisks} tone="red" />
            </div>

            <Card><CardContent className="pt-6">
              <div className="flex flex-wrap gap-2">
                <Select value={filterReviewType} onValueChange={setFilterReviewType}>
                  <SelectTrigger className="w-[160px]"><SelectValue placeholder="Review Type" /></SelectTrigger>
                  <SelectContent><SelectItem value="all">All Types</SelectItem>{PQR_REVIEW_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={filterCompliance} onValueChange={setFilterCompliance}>
                  <SelectTrigger className="w-[160px]"><SelectValue placeholder="Compliance" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Compliance</SelectItem>
                    <SelectItem value="Complies">Complies</SelectItem>
                    <SelectItem value="Observation">Observation</SelectItem>
                    <SelectItem value="Major Observation">Major Observation</SelectItem>
                    <SelectItem value="Critical Observation">Critical Observation</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filterRisk} onValueChange={setFilterRisk}>
                  <SelectTrigger className="w-[120px]"><SelectValue placeholder="Risk" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Risk</SelectItem>
                    <SelectItem value="Low">Low</SelectItem>
                    <SelectItem value="Medium">Medium</SelectItem>
                    <SelectItem value="High">High</SelectItem>
                    <SelectItem value="Critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
                <Input placeholder="Area / system" className="w-[140px]" value={filterArea} onChange={(e) => setFilterArea(e.target.value)} />
                <Button variant="outline" size="icon" onClick={() => void loadRecords(selectedPqrId)} disabled={busy}>
                  <RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </CardContent></Card>

            <Tabs defaultValue="utility">
              <TabsList className="flex flex-wrap h-auto">
                <TabsTrigger value="utility">Utility Summary</TabsTrigger>
                <TabsTrigger value="environmental">Environmental Summary</TabsTrigger>
                <TabsTrigger value="wfi">WFI / PW</TabsTrigger>
                <TabsTrigger value="air">Compressed Air / N2</TabsTrigger>
                <TabsTrigger value="hvac">HVAC</TabsTrigger>
                <TabsTrigger value="cleanroom">Cleanroom</TabsTrigger>
                <TabsTrigger value="excursion">Excursions</TabsTrigger>
                <TabsTrigger value="devcap">Deviation / CAPA</TabsTrigger>
                <TabsTrigger value="charts">Trend Charts</TabsTrigger>
                <TabsTrigger value="narrative">Narrative</TabsTrigger>
              </TabsList>

              <TabsContent value="utility" className="mt-4"><Card><CardContent className="pt-6 overflow-x-auto">{renderTable(utilityRecords, 'No utility records')}</CardContent></Card></TabsContent>
              <TabsContent value="environmental" className="mt-4"><Card><CardContent className="pt-6 overflow-x-auto">{renderTable(envRecords, 'No environmental records')}</CardContent></Card></TabsContent>
              <TabsContent value="wfi" className="mt-4"><Card><CardContent className="pt-6 overflow-x-auto">{renderTable(wfiRecords, 'No WFI/PW records')}</CardContent></Card></TabsContent>
              <TabsContent value="air" className="mt-4"><Card><CardContent className="pt-6 overflow-x-auto">{renderTable(airRecords, 'No compressed air/nitrogen records')}</CardContent></Card></TabsContent>
              <TabsContent value="hvac" className="mt-4"><Card><CardContent className="pt-6 overflow-x-auto">{renderTable(hvacRecords, 'No HVAC records')}</CardContent></Card></TabsContent>
              <TabsContent value="cleanroom" className="mt-4"><Card><CardContent className="pt-6 overflow-x-auto">{renderTable(envRecords, 'No cleanroom monitoring records')}</CardContent></Card></TabsContent>

              <TabsContent value="excursion" className="mt-4">
                <Card><CardHeader><CardTitle className="text-base">Excursion Review</CardTitle></CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    {excursionRecords.map((r) => (
                      <p key={r.id}>{r.systemAreaName} — {r.monitoringParameter}: {r.excursionCount} excursion(s), {r.deviationCount} deviation(s) <GradeBadge grade={r.cleanroomGrade} /></p>
                    ))}
                    {!excursionRecords.length && <p className="text-muted-foreground">No excursions recorded.</p>}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="devcap" className="mt-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <Card><CardHeader><CardTitle className="text-sm">Linked Deviations</CardTitle></CardHeader>
                    <CardContent>{summary.deviationCount} total across reviewed parameters</CardContent></Card>
                  <Card><CardHeader><CardTitle className="text-sm">Linked CAPA</CardTitle></CardHeader>
                    <CardContent>{summary.capaCount} total across reviewed parameters</CardContent></Card>
                </div>
              </TabsContent>

              <TabsContent value="charts" className="mt-4">
                <div className="grid gap-4 lg:grid-cols-2">
                  <SafeChart title="Utility Compliance Trend" empty={!charts.utilityComplianceTrend.length}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={charts.utilityComplianceTrend}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" /><YAxis /><Tooltip /><Legend />
                        <Line type="monotone" dataKey="compliant" stroke="#059669" /><Line type="monotone" dataKey="nonCompliant" stroke="#dc2626" /></LineChart>
                    </ResponsiveContainer>
                  </SafeChart>
                  <SafeChart title="Environmental Compliance Trend" empty={!charts.environmentalComplianceTrend.length}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={charts.environmentalComplianceTrend}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" /><YAxis /><Tooltip /><Legend />
                        <Line type="monotone" dataKey="compliant" stroke="#059669" /><Line type="monotone" dataKey="nonCompliant" stroke="#dc2626" /></LineChart>
                    </ResponsiveContainer>
                  </SafeChart>
                  <Card><CardContent className="pt-4"><ParameterTrendChart title="Temperature Trend" data={charts.temperatureTrend} empty={!charts.temperatureTrend.length} /></CardContent></Card>
                  <Card><CardContent className="pt-4"><ParameterTrendChart title="RH Trend" data={charts.rhTrend} empty={!charts.rhTrend.length} /></CardContent></Card>
                  <Card><CardContent className="pt-4"><ParameterTrendChart title="Differential Pressure" data={charts.differentialPressureTrend} empty={!charts.differentialPressureTrend.length} /></CardContent></Card>
                  <Card><CardContent className="pt-4"><ParameterTrendChart title="WFI Conductivity" data={charts.wfiConductivityTrend} empty={!charts.wfiConductivityTrend.length} /></CardContent></Card>
                  <SafeChart title="Excursion Trend" empty={!charts.excursionTrend.length}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={charts.excursionTrend}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" /><YAxis /><Tooltip /><Line type="monotone" dataKey="count" stroke="#d97706" /></LineChart>
                    </ResponsiveContainer>
                  </SafeChart>
                  <SafeChart title="Area-wise Excursions" empty={!charts.areaExcursionDistribution.length}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={charts.areaExcursionDistribution}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="area" tick={{ fontSize: 9 }} /><YAxis /><Tooltip /><Bar dataKey="count" fill="#dc2626" /></BarChart>
                    </ResponsiveContainer>
                  </SafeChart>
                  <SafeChart title="Risk Distribution" empty={!charts.riskDistribution.length}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart><Pie data={charts.riskDistribution} dataKey="value" nameKey="name" outerRadius={70} label>
                        {charts.riskDistribution.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                      </Pie><Tooltip /></PieChart>
                    </ResponsiveContainer>
                  </SafeChart>
                </div>
              </TabsContent>

              <TabsContent value="narrative" className="mt-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-base">PQR Section Narrative</CardTitle>
                    {canManage && (
                      <Button size="sm" onClick={() => void handleSaveSection()} disabled={busy}>
                        <Save className="h-4 w-4 mr-1" />Save to PQR
                      </Button>
                    )}
                  </CardHeader>
                  <CardContent>
                    <Textarea className="min-h-[140px]" value={narrative} readOnly={!canManage}
                      onChange={(e) => { setNarrative(e.target.value); if (selectedPqr) void logUtilityEnvNarrativeEdit(actor, selectedPqr.id); }} />
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        )}

        {selectedPqr && (
          <UtilityEnvReviewFormDialog open={formOpen} onOpenChange={setFormOpen} pqr={selectedPqr} record={editRecord} onSubmit={handleSaveForm} loading={busy} />
        )}

        <Dialog open={!!detailRecord} onOpenChange={() => setDetailRecord(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{detailRecord?.systemAreaName}</DialogTitle></DialogHeader>
            {detailRecord && (
              <div className="space-y-4">
                <dl className="grid grid-cols-2 gap-2 text-sm">
                  {[
                    ['Review Type', detailRecord.reviewType], ['Parameter', detailRecord.monitoringParameter],
                    ['Min / Max / Avg', `${detailRecord.observedMinimum ?? '—'} / ${detailRecord.observedMaximum ?? '—'} / ${detailRecord.observedAverage ?? '—'}`],
                    ['Limits', `${detailRecord.lowerLimit} – ${detailRecord.upperLimit}`],
                    ['Alerts / Actions / Excursions', `${detailRecord.alertCount} / ${detailRecord.actionCount} / ${detailRecord.excursionCount}`],
                    ['Deviations / CAPA / CC', `${detailRecord.deviationCount} / ${detailRecord.capaCount} / ${detailRecord.changeControlCount}`],
                    ['Product Impact', detailRecord.impactOnProductQuality], ['Conclusion', detailRecord.conclusion],
                  ].map(([k, v]) => (
                    <div key={k}><dt className="text-muted-foreground">{k}</dt><dd className="font-medium">{String(v)}</dd></div>
                  ))}
                </dl>
                <div className="flex flex-wrap gap-2">
                  <ComplianceBadge status={detailRecord.complianceStatus} />
                  <RiskBadge level={detailRecord.riskLevel} />
                  <GradeBadge grade={detailRecord.cleanroomGrade} />
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        <ConfirmDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)} title="Remove Review Record"
          description="This will soft-delete the utility/environmental review record." confirmLabel="Remove" destructive loading={busy} onConfirm={handleDelete} />
      </div>
    </UtilityEnvReviewAccessGuard>
  );
}
