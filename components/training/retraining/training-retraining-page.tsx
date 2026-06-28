'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Plus, RefreshCw, AlertTriangle, ChevronLeft, ChevronRight, CheckCircle, Calendar,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { KpiCard } from '@/components/cpv/cpv-ui';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { ResponsiveDataTable } from '@/components/cpv/product-master/responsive-data-table';
import type { ColumnDef } from '@/components/admin/admin-data-table';
import { TmsPageHeader } from '@/components/training/tms-page-header';
import { useTrainingRetraining } from '@/hooks/use-training-retraining';
import type { RetrainingFilters, RetrainingRecord } from '@/lib/training-retraining-types';
import { RETRAINING_TRIGGER_TYPES } from '@/lib/training-retraining-types';
import { TMS_DEPARTMENTS, TRAINING_TYPES } from '@/lib/training-types';
import {
  createRetraining, bulkAssignRetraining, scheduleRetraining, completeRetraining,
  startRetraining, closeRetraining, cancelRetraining,
  exportRetrainingCsv, openRetrainingPrint, logRetrainingExport,
} from '@/lib/training-retraining-service';
import { listEmployees } from '@/lib/training-service';
import { RetrainingStatusBadge } from './retraining-status-badge';
import { RetrainingFilterPanel } from './retraining-filter-panel';
import { RetrainingDashboardCharts } from './retraining-dashboard-charts';
import { RetrainingExportMenu } from './retraining-export-menu';
import { ComplianceGauge } from './compliance-gauge';
import { RetrainingCalendarPanel } from './retraining-calendar-panel';
import { ProgressCard } from './progress-card';

const KPI_CONFIG = [
  { label: 'Total Retraining', key: 'totalRetraining' as const, tone: 'blue' as const },
  { label: 'Assigned', key: 'assigned' as const, tone: 'amber' as const },
  { label: 'Completed', key: 'completed' as const, tone: 'green' as const },
  { label: 'Pending', key: 'pending' as const, tone: 'amber' as const },
  { label: 'Overdue', key: 'overdue' as const, tone: 'red' as const },
  { label: 'Failed', key: 'failed' as const, tone: 'red' as const },
  { label: 'Annual GMP Due', key: 'annualGmpDue' as const, tone: 'blue' as const },
  { label: 'Cert Expired', key: 'certificatesExpired' as const, tone: 'red' as const },
  { label: 'Competency Gaps', key: 'competencyGaps' as const, tone: 'amber' as const },
  { label: 'Dept Compliance', key: 'departmentCompliance' as const, tone: 'green' as const, suffix: '%' },
];

interface TrainingRetrainingPageProps {
  defaultTab?: 'dashboard' | 'schedule' | 'registry';
}

export function TrainingRetrainingPage({ defaultTab = 'dashboard' }: TrainingRetrainingPageProps) {
  const [filters, setFilters] = useState<RetrainingFilters>({});
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<RetrainingRecord | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [score, setScore] = useState('');
  const [result, setResult] = useState('Pass');
  const [certNumber, setCertNumber] = useState('');
  const [newRec, setNewRec] = useState({
    employee_id: '', employee_name: '', department: 'QA', designation: '',
    training_topic: '', training_type: 'GMP Training', trigger_type: 'Management Decision',
    trigger_reference: '', due_date: '', trainer: 'Training Coordinator', reason: '',
  });
  const [bulkForm, setBulkForm] = useState({
    training_topic: '', training_type: 'GMP Training', trigger_type: 'Annual GMP',
    trigger_reference: '', due_date: '', trainer: 'Training Coordinator', reason: '',
    selectedEmps: [] as string[],
  });

  const {
    data, loading, refreshing, error, refresh, actor,
    canView, canManage, canAssign, canConduct, isReadOnly, isEmployeeView,
    selectedIds, setSelectedIds,
  } = useTrainingRetraining(filters);

  const [allEmployees, setAllEmployees] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    if (bulkOpen) {
      listEmployees().then((emps) => setAllEmployees(emps.map((e) => ({
        id: e.id, name: e.full_name || e.email || e.id,
      })))).catch(() => {});
    }
  }, [bulkOpen]);

  const employees = useMemo(() => {
    const map = new Map<string, string>();
    data?.records.forEach((r) => map.set(r.employee_id, r.employee_name));
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [data?.records]);

  const trainers = useMemo(() => {
    const set = new Set<string>();
    data?.records.forEach((r) => { if (r.trainer) set.add(r.trainer); });
    return Array.from(set);
  }, [data?.records]);

  const paginated = useMemo(() => {
    if (!data) return [];
    const size = 15;
    const start = (page - 1) * size;
    return data.records.slice(start, start + size);
  }, [data, page]);

  const totalPages = data ? Math.max(1, Math.ceil(data.records.length / 15)) : 1;

  const columns: ColumnDef<RetrainingRecord>[] = [
    ...(canAssign && !isReadOnly ? [{
      key: 'select', header: '',
      render: (r: RetrainingRecord) => (
        <Checkbox checked={selectedIds.includes(r.id)} onCheckedChange={(c) =>
          setSelectedIds(c ? [...selectedIds, r.id] : selectedIds.filter((id) => id !== r.id))} />
      ),
    }] : []),
    { key: 'number', header: 'Retraining #', render: (r) => <span className="font-mono text-xs">{r.retraining_number}</span> },
    { key: 'employee', header: 'Employee', render: (r) => r.employee_name },
    { key: 'dept', header: 'Dept', render: (r) => r.department },
    { key: 'topic', header: 'Topic', render: (r) => <span className="text-xs">{r.training_topic}</span> },
    { key: 'trigger', header: 'Trigger', render: (r) => <span className="text-xs">{r.trigger_type}</span> },
    { key: 'status', header: 'Status', render: (r) => <RetrainingStatusBadge status={String(r.retraining_status)} /> },
    { key: 'due', header: 'Due', render: (r) => r.due_date },
    { key: 'trainer', header: 'Trainer', render: (r) => r.trainer || '—' },
  ];

  const handleComplete = useCallback(async () => {
    if (!selected) return;
    await completeRetraining({
      retraining_id: selected.id,
      obtained_score: score ? Number(score) : null,
      result,
      competency_status: result === 'Pass' ? 'Competent' : 'Not Competent',
      certificate_number: certNumber || null,
      remarks: '',
    }, actor);
    toast.success(result === 'Pass' ? 'Retraining completed' : 'Retraining marked failed');
    setCompleteOpen(false);
    refresh();
  }, [selected, score, result, certNumber, actor, refresh]);

  if (!canView) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Access Denied</AlertTitle>
        <AlertDescription>You do not have permission to view retraining records.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <TmsPageHeader
        title="Retraining Management"
        description="Manage mandatory GMP retraining, refresher training and competency recovery."
        trail={[{ label: 'Retraining Management' }]}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={refresh} disabled={refreshing}>
              <RefreshCw className={`h-4 w-4 mr-1 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
            </Button>
            <RetrainingExportMenu
              canExport={!isReadOnly}
              onCsv={() => { if (data) { exportRetrainingCsv(data.records); logRetrainingExport(actor, data.records.length); toast.success('CSV exported'); } }}
              onExcel={() => { if (data) { exportRetrainingCsv(data.records); toast.success('Excel export downloaded'); } }}
              onPrint={() => { if (data) openRetrainingPrint(data.records); else toast.info('No data to print'); }}
            />
            {canAssign && !isReadOnly && (
              <>
                <Button variant="outline" onClick={() => setBulkOpen(true)}>Bulk Assign</Button>
                <Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4 mr-1" /> Assign</Button>
              </>
            )}
          </div>
        }
      />

      <div className="flex flex-wrap gap-1.5">
        <Badge variant="outline" className="text-xs">21 CFR Part 11</Badge>
        <Badge variant="outline" className="text-xs">CAPA / Deviation Linked</Badge>
        <Badge variant="outline" className="text-xs gap-1"><CheckCircle className="h-3 w-3" /> GMP Compliant</Badge>
      </div>

      {isReadOnly && <Alert><AlertTitle>Read-Only</AlertTitle><AlertDescription>Auditor view.</AlertDescription></Alert>}
      {isEmployeeView && <Alert><AlertDescription>Showing your retraining assignments only.</AlertDescription></Alert>}
      {error && <ErrorCard message={error} onRetry={refresh} />}

      <RetrainingFilterPanel filters={filters} onChange={(f) => { setFilters(f); setPage(1); }} employees={employees} trainers={trainers} />

      {loading ? <LoadingSkeleton rows={8} /> : data ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {KPI_CONFIG.map(({ label, key, tone, suffix }) => (
              <KpiCard key={key} label={label} value={`${data.kpis[key]}${suffix ?? ''}`} tone={tone} />
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            <div className="lg:col-span-3">
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
                <TabsList className="flex flex-wrap h-auto gap-1">
                  <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
                  <TabsTrigger value="schedule">Schedule</TabsTrigger>
                  <TabsTrigger value="registry">Registry</TabsTrigger>
                </TabsList>

                <TabsContent value="dashboard" className="mt-4 space-y-4">
                  <RetrainingDashboardCharts charts={data.charts} />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <ResponsiveDataTable
                      data={data.upcoming}
                      columns={columns.filter((c) => c.key !== 'select')}
                      emptyMessage="No upcoming retraining"
                      mobileTitleKey="employee_name"
                      mobileSubtitleKey="retraining_number"
                      actions={(r) => (
                        <Button size="sm" variant="ghost" onClick={() => { setSelected(r); setCompleteOpen(true); }}>View</Button>
                      )}
                    />
                    <ResponsiveDataTable
                      data={data.overdue}
                      columns={columns.filter((c) => c.key !== 'select')}
                      emptyMessage="No overdue retraining"
                      mobileTitleKey="employee_name"
                      mobileSubtitleKey="retraining_number"
                    />
                  </div>
                </TabsContent>

                <TabsContent value="schedule" className="mt-4 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {data.upcoming.slice(0, 6).map((r) => <ProgressCard key={r.id} record={r} />)}
                  </div>
                  <ResponsiveDataTable
                    data={data.upcoming}
                    columns={columns.filter((c) => c.key !== 'select')}
                    emptyMessage="No scheduled retraining"
                    mobileTitleKey="employee_name"
                    mobileSubtitleKey="retraining_number"
                    actions={canConduct && !isReadOnly ? (r) => (
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" onClick={() => { setSelected(r); setScheduleOpen(true); }}><Calendar className="h-3 w-3 mr-1" />Schedule</Button>
                        <Button size="sm" onClick={() => startRetraining(r.id, actor).then(() => refresh())}>Start</Button>
                      </div>
                    ) : undefined}
                  />
                </TabsContent>

                <TabsContent value="registry" className="mt-4 space-y-4">
                  <Tabs defaultValue="all">
                    <TabsList className="flex flex-wrap h-auto gap-1">
                      <TabsTrigger value="all">All</TabsTrigger>
                      <TabsTrigger value="overdue">Overdue</TabsTrigger>
                      <TabsTrigger value="failed">Failed</TabsTrigger>
                      <TabsTrigger value="completed">Completed</TabsTrigger>
                      <TabsTrigger value="renewals">Cert Renewals</TabsTrigger>
                      <TabsTrigger value="capa">CAPA-linked</TabsTrigger>
                      <TabsTrigger value="deviation">Deviation-linked</TabsTrigger>
                    </TabsList>
                    <TabsContent value="all" className="mt-4">
                      <ResponsiveDataTable data={paginated} columns={columns} emptyMessage="No retraining records" mobileTitleKey="employee_name" mobileSubtitleKey="retraining_number"
                        actions={canConduct && !isReadOnly ? (r) => (
                          <div className="flex gap-1">
                            {['Assigned', 'Scheduled', 'In Progress'].includes(String(r.retraining_status)) && (
                              <Button size="sm" onClick={() => { setSelected(r); setCompleteOpen(true); }}>Complete</Button>
                            )}
                            {r.retraining_status === 'Completed' && canManage && (
                              <Button size="sm" variant="outline" onClick={() => closeRetraining(r.id, actor).then(() => refresh())}>Close</Button>
                            )}
                          </div>
                        ) : undefined} />
                    </TabsContent>
                    <TabsContent value="overdue" className="mt-4">
                      <ResponsiveDataTable data={data.overdue} columns={columns.filter((c) => c.key !== 'select')} emptyMessage="No overdue retraining" mobileTitleKey="employee_name" mobileSubtitleKey="retraining_number" />
                    </TabsContent>
                    <TabsContent value="failed" className="mt-4">
                      <ResponsiveDataTable data={data.failed} columns={columns.filter((c) => c.key !== 'select')} emptyMessage="No failed retraining" mobileTitleKey="employee_name" mobileSubtitleKey="retraining_number" />
                    </TabsContent>
                    <TabsContent value="completed" className="mt-4">
                      <ResponsiveDataTable data={data.recentCompleted} columns={columns.filter((c) => c.key !== 'select')} emptyMessage="No completed retraining" mobileTitleKey="employee_name" mobileSubtitleKey="retraining_number" />
                    </TabsContent>
                    <TabsContent value="renewals" className="mt-4">
                      <ResponsiveDataTable data={data.certificateRenewals} columns={columns.filter((c) => c.key !== 'select')} emptyMessage="No certificate renewals due" mobileTitleKey="employee_name" mobileSubtitleKey="retraining_number" />
                    </TabsContent>
                    <TabsContent value="capa" className="mt-4">
                      <ResponsiveDataTable data={data.capaLinked} columns={columns.filter((c) => c.key !== 'select')} emptyMessage="No CAPA-linked retraining" mobileTitleKey="employee_name" mobileSubtitleKey="retraining_number" />
                    </TabsContent>
                    <TabsContent value="deviation" className="mt-4">
                      <ResponsiveDataTable data={data.deviationLinked} columns={columns.filter((c) => c.key !== 'select')} emptyMessage="No deviation-linked retraining" mobileTitleKey="employee_name" mobileSubtitleKey="retraining_number" />
                    </TabsContent>
                  </Tabs>
                  {totalPages > 1 && (
                    <div className="flex justify-center gap-2">
                      <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}><ChevronLeft className="h-4 w-4" /></Button>
                      <span className="text-xs text-muted-foreground">Page {page} of {totalPages}</span>
                      <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </div>
            <div className="space-y-4">
              <ComplianceGauge percent={data.kpis.departmentCompliance} />
              <RetrainingCalendarPanel upcoming={data.upcoming} />
            </div>
          </div>
        </>
      ) : null}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Assign Retraining</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Employee Name *</Label><Input value={newRec.employee_name} onChange={(e) => setNewRec((c) => ({ ...c, employee_name: e.target.value }))} /></div>
            <div><Label>Employee ID *</Label><Input value={newRec.employee_id} onChange={(e) => setNewRec((c) => ({ ...c, employee_id: e.target.value }))} /></div>
            <div><Label>Department</Label>
              <Select value={newRec.department} onValueChange={(v) => setNewRec((c) => ({ ...c, department: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TMS_DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Training Topic *</Label><Input value={newRec.training_topic} onChange={(e) => setNewRec((c) => ({ ...c, training_topic: e.target.value }))} /></div>
            <div><Label>Trigger Type *</Label>
              <Select value={newRec.trigger_type} onValueChange={(v) => setNewRec((c) => ({ ...c, trigger_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{RETRAINING_TRIGGER_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Trigger Reference</Label><Input value={newRec.trigger_reference} onChange={(e) => setNewRec((c) => ({ ...c, trigger_reference: e.target.value }))} /></div>
            <div><Label>Due Date *</Label><Input type="date" value={newRec.due_date} onChange={(e) => setNewRec((c) => ({ ...c, due_date: e.target.value }))} /></div>
            <div><Label>Trainer *</Label><Input value={newRec.trainer} onChange={(e) => setNewRec((c) => ({ ...c, trainer: e.target.value }))} /></div>
            <div><Label>Reason</Label><Textarea value={newRec.reason} onChange={(e) => setNewRec((c) => ({ ...c, reason: e.target.value }))} /></div>
            <Button variant="outline" size="sm" onClick={async () => {
              const emps = await listEmployees();
              const emp = emps.find((e) => e.id === newRec.employee_id);
              if (emp) {
                setNewRec((c) => ({
                  ...c,
                  employee_name: emp.full_name || emp.email || emp.id,
                  department: emp.department || c.department,
                  designation: emp.designation || '',
                }));
                toast.success('Employee loaded');
              }
            }}>Load Employee</Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={async () => {
              try {
                await createRetraining({
                  ...newRec,
                  trigger_type: newRec.trigger_type as typeof RETRAINING_TRIGGER_TYPES[number],
                  training_type: newRec.training_type,
                  designation: newRec.designation,
                }, actor);
                toast.success('Retraining assigned');
                setCreateOpen(false);
                refresh();
              } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed'); }
            }}>Assign</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Bulk Assign Retraining</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Training Topic *</Label><Input value={bulkForm.training_topic} onChange={(e) => setBulkForm((c) => ({ ...c, training_topic: e.target.value }))} /></div>
            <div><Label>Due Date *</Label><Input type="date" value={bulkForm.due_date} onChange={(e) => setBulkForm((c) => ({ ...c, due_date: e.target.value }))} /></div>
            <div><Label>Trainer *</Label><Input value={bulkForm.trainer} onChange={(e) => setBulkForm((c) => ({ ...c, trainer: e.target.value }))} /></div>
            <div><Label>Trigger Type</Label>
              <Select value={bulkForm.trigger_type} onValueChange={(v) => setBulkForm((c) => ({ ...c, trigger_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{RETRAINING_TRIGGER_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Select Employees</Label>
              <div className="max-h-40 overflow-y-auto border rounded p-2 space-y-1">
                {allEmployees.length > 0 ? allEmployees.map((e) => (
                  <label key={e.id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={bulkForm.selectedEmps.includes(e.id)}
                      onCheckedChange={(c) => setBulkForm((f) => ({
                        ...f,
                        selectedEmps: c ? [...f.selectedEmps, e.id] : f.selectedEmps.filter((id) => id !== e.id),
                      }))}
                    />
                    {e.name}
                  </label>
                )) : <p className="text-sm text-muted-foreground">Loading employees…</p>}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkOpen(false)}>Cancel</Button>
            <Button onClick={async () => {
              try {
                const count = await bulkAssignRetraining({
                  employee_ids: bulkForm.selectedEmps,
                  training_topic: bulkForm.training_topic,
                  training_type: bulkForm.training_type,
                  trigger_type: bulkForm.trigger_type as typeof RETRAINING_TRIGGER_TYPES[number],
                  trigger_reference: bulkForm.trigger_reference,
                  due_date: bulkForm.due_date,
                  trainer: bulkForm.trainer,
                  reason: bulkForm.reason,
                }, actor);
                toast.success(`${count} retraining records assigned`);
                setBulkOpen(false);
                refresh();
              } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed'); }
            }}>Bulk Assign</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={completeOpen} onOpenChange={setCompleteOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Complete Retraining</DialogTitle></DialogHeader>
          {selected && <p className="text-sm text-muted-foreground">{selected.employee_name} — {selected.training_topic}</p>}
          <div className="space-y-3">
            <div><Label>Assessment Score</Label><Input type="number" value={score} onChange={(e) => setScore(e.target.value)} /></div>
            <div><Label>Result</Label>
              <Select value={result} onValueChange={setResult}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="Pass">Pass</SelectItem><SelectItem value="Fail">Fail</SelectItem></SelectContent>
              </Select>
            </div>
            <div><Label>Certificate Number (if renewed)</Label><Input value={certNumber} onChange={(e) => setCertNumber(e.target.value)} placeholder="Optional" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompleteOpen(false)}>Cancel</Button>
            <Button onClick={handleComplete}>Complete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Schedule Retraining</DialogTitle></DialogHeader>
          {selected && <p className="text-sm">{selected.training_topic} for {selected.employee_name}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setScheduleOpen(false)}>Cancel</Button>
            <Button onClick={async () => {
              if (!selected) return;
              await scheduleRetraining({ retraining_id: selected.id }, actor);
              toast.success('Retraining scheduled');
              setScheduleOpen(false);
              refresh();
            }}>Schedule</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
