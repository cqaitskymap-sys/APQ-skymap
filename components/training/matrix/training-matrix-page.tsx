'use client';

import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  RefreshCw, AlertTriangle, ChevronLeft, ChevronRight, Plus, Eye, Pencil, Grid3X3,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { KpiCard } from '@/components/cpv/cpv-ui';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { ResponsiveDataTable } from '@/components/cpv/product-master/responsive-data-table';
import type { ColumnDef } from '@/components/admin/admin-data-table';
import { TmsPageHeader } from '@/components/training/tms-page-header';
import { ComplianceBadge } from '@/components/training/tms-sub-nav';
import { useTrainingMatrix } from '@/hooks/use-training-matrix';
import type { MatrixFilters, TrainingMatrixDefinition, TrainingMatrixRow } from '@/lib/training-matrix-types';
import { MATRIX_FREQUENCIES, MATRIX_STATUSES } from '@/lib/training-matrix-types';
import { createMatrixSchema, type CreateMatrixInput } from '@/lib/training-matrix-schemas';
import {
  createMatrix, updateMatrix, autoAssignFromMatrix, processMatrixRefreshers,
  syncSopMatrixRetraining, exportMatrixDefinitions, exportMatrixCompliance,
  openMatrixPrint, logMatrixExport,
} from '@/lib/training-matrix-service';
import { TRAINING_TYPES, TMS_DEPARTMENTS } from '@/lib/training-types';
import { MatrixFilterPanel } from './matrix-filter-panel';
import { MatrixDashboardCharts } from './matrix-dashboard-charts';
import { MatrixExportMenu } from './matrix-export-menu';
import { MatrixStatusBadge } from './matrix-status-badge';
import { groupDefinitions } from '@/lib/training-matrix-records';

const KPI_CONFIG = [
  { label: 'Total Matrix', key: 'totalMatrix' as const, tone: 'blue' as const },
  { label: 'Active', key: 'activeMatrix' as const, tone: 'green' as const },
  { label: 'Inactive', key: 'inactiveMatrix' as const, tone: 'slate' as const },
  { label: 'Departments', key: 'departmentsCovered' as const, tone: 'blue' as const },
  { label: 'SOP Mapped', key: 'sopMapped' as const, tone: 'amber' as const },
  { label: 'Effectiveness Req', key: 'effectivenessRequired' as const, tone: 'amber' as const },
  { label: 'Avg Compliance', key: 'avgCompliance' as const, tone: 'green' as const, suffix: '%' },
  { label: 'Employees Tracked', key: 'employeesTracked' as const, tone: 'blue' as const },
];

const DEFAULT_FORM: CreateMatrixInput = {
  department: TMS_DEPARTMENTS[0],
  designation: '',
  role: '',
  training_topic: '',
  training_type: 'GMP Training',
  document_number: '',
  document_title: '',
  sop_number: '',
  sop_version: '',
  training_required: true,
  training_frequency: 'Yearly',
  initial_training_required: true,
  refresher_required: true,
  effectiveness_required: false,
  trainer_role: 'QA Trainer',
  training_duration: '',
  due_days_after_assignment: 30,
  status: 'Active',
  skill: '',
};

interface TrainingMatrixPageProps {
  defaultTab?: 'dashboard' | 'definitions' | 'compliance';
}

export function TrainingMatrixPage({ defaultTab = 'dashboard' }: TrainingMatrixPageProps) {
  const [filters, setFilters] = useState<MatrixFilters>({ status: 'Active' });
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [page, setPage] = useState(1);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<TrainingMatrixDefinition | null>(null);
  const [viewing, setViewing] = useState<TrainingMatrixDefinition | null>(null);
  const [viewMode, setViewMode] = useState<'all' | 'department' | 'designation' | 'sop'>('all');

  const {
    data, loading, refreshing, error, refresh, actor,
    canView, canManage, canEdit, isReadOnly, isDepartmentView,
  } = useTrainingMatrix(filters);

  const form = useForm<CreateMatrixInput>({
    resolver: zodResolver(createMatrixSchema),
    defaultValues: DEFAULT_FORM,
  });

  const grouped = useMemo(() => {
    if (!data || viewMode === 'all') return null;
    return groupDefinitions(data.definitions, viewMode);
  }, [data, viewMode]);

  const paginated = useMemo(() => {
    const size = 15;
    return (data?.definitions ?? []).slice((page - 1) * size, page * size);
  }, [data?.definitions, page]);

  const paginatedCompliance = useMemo(() => {
    const size = 15;
    return (data?.compliance ?? []).slice((page - 1) * size, page * size);
  }, [data?.compliance, page]);

  const totalPages = Math.max(1, Math.ceil((data?.definitions.length ?? 0) / 15));
  const compliancePages = Math.max(1, Math.ceil((data?.compliance.length ?? 0) / 15));

  const openCreate = () => {
    setEditing(null);
    form.reset(DEFAULT_FORM);
    setShowForm(true);
  };

  const openEdit = (def: TrainingMatrixDefinition) => {
    setEditing(def);
    form.reset({
      department: def.department,
      designation: def.designation,
      role: def.role,
      training_topic: def.training_topic,
      training_type: def.training_type as CreateMatrixInput['training_type'],
      document_number: def.document_number,
      document_title: def.document_title,
      sop_number: def.sop_number,
      sop_version: def.sop_version,
      training_required: def.training_required,
      training_frequency: def.training_frequency as CreateMatrixInput['training_frequency'],
      initial_training_required: def.initial_training_required,
      refresher_required: def.refresher_required,
      effectiveness_required: def.effectiveness_required,
      trainer_role: def.trainer_role,
      training_duration: def.training_duration,
      due_days_after_assignment: def.due_days_after_assignment,
      status: def.status as CreateMatrixInput['status'],
      skill: def.skill,
    });
    setShowForm(true);
  };

  const handleSubmit = async (input: CreateMatrixInput) => {
    setSaving(true);
    try {
      if (editing) {
        await updateMatrix(editing.id, input, actor);
        toast.success('Matrix updated');
      } else {
        await createMatrix(input, actor);
        toast.success('Matrix created');
      }
      setShowForm(false);
      setEditing(null);
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleAutoAssign = async () => {
    setSaving(true);
    try {
      const count = await autoAssignFromMatrix(actor);
      toast.success(count > 0 ? `${count} training(s) auto-assigned` : 'No new assignments needed');
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Auto-assign failed');
    } finally {
      setSaving(false);
    }
  };

  const handleRefresher = async () => {
    setSaving(true);
    try {
      const count = await processMatrixRefreshers(actor);
      toast.success(count > 0 ? `${count} refresher assignment(s)` : 'No refreshers due');
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Refresher process failed');
    } finally {
      setSaving(false);
    }
  };

  const handleSopSync = async () => {
    setSaving(true);
    try {
      const count = await syncSopMatrixRetraining(actor);
      toast.success(count > 0 ? `${count} SOP retraining assignment(s)` : 'No pending SOP revisions');
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'SOP sync failed');
    } finally {
      setSaving(false);
    }
  };

  const matrixColumns: ColumnDef<TrainingMatrixDefinition>[] = [
    { key: 'code', header: 'Code', render: (r) => <span className="font-mono text-xs">{r.matrix_code}</span> },
    { key: 'dept', header: 'Department', render: (r) => r.department },
    { key: 'desig', header: 'Designation', render: (r) => r.designation },
    { key: 'topic', header: 'Topic', render: (r) => <span className="text-xs">{r.training_topic}</span> },
    { key: 'type', header: 'Type', render: (r) => r.training_type },
    { key: 'doc', header: 'Document', render: (r) => <span className="font-mono text-xs">{r.document_number || '—'}</span> },
    { key: 'sop', header: 'SOP', render: (r) => <span className="font-mono text-xs">{r.sop_number || '—'}</span> },
    { key: 'freq', header: 'Frequency', render: (r) => <span className="text-xs">{r.training_frequency}</span> },
    { key: 'status', header: 'Status', render: (r) => <MatrixStatusBadge status={String(r.status)} /> },
    {
      key: 'actions', header: '',
      render: (r) => (
        <div className="flex gap-1 justify-end">
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setViewing(r)}><Eye className="h-4 w-4" /></Button>
          {canEdit && !isReadOnly && (
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
          )}
        </div>
      ),
    },
  ];

  const complianceColumns: ColumnDef<TrainingMatrixRow>[] = [
    { key: 'emp', header: 'Employee', render: (r) => r.employee_name },
    { key: 'dept', header: 'Department', render: (r) => r.department },
    { key: 'desig', header: 'Designation', render: (r) => r.designation || '—' },
    { key: 'req', header: 'Required', render: (r) => r.required_trainings.length },
    { key: 'done', header: 'Completed', render: (r) => <span className="text-green-700">{r.completed_trainings.length}</span> },
    { key: 'pend', header: 'Pending', render: (r) => <span className="text-amber-700">{r.pending_trainings.length}</span> },
    { key: 'over', header: 'Overdue', render: (r) => <span className="text-red-700">{r.overdue_trainings.length}</span> },
    { key: 'comp', header: 'Compliance', render: (r) => <ComplianceBadge percent={r.compliance_percent} /> },
  ];

  if (!canView) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Access Denied</AlertTitle>
        <AlertDescription>You do not have permission to view the training matrix.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <TmsPageHeader
        title="Training Matrix Management"
        description="Define role-wise GMP training requirements and automate assignments"
        trail={[{ label: 'Training Matrix' }]}
        actions={
          <div className="flex flex-wrap gap-2">
            {canManage && !isReadOnly && (
              <>
                <Button variant="outline" size="sm" onClick={handleRefresher} disabled={saving}>
                  <RefreshCw className="h-4 w-4 mr-1" /> Process Refreshers
                </Button>
                <Button variant="outline" size="sm" onClick={handleAutoAssign} disabled={saving}>
                  <Grid3X3 className="h-4 w-4 mr-1" /> Auto-Assign
                </Button>
                <Button variant="outline" size="sm" onClick={handleSopSync} disabled={saving}>
                  SOP Retraining
                </Button>
                <Button size="sm" className="bg-blue-600" onClick={openCreate}>
                  <Plus className="h-4 w-4 mr-1" /> Create Matrix
                </Button>
              </>
            )}
            <Button variant="outline" onClick={refresh} disabled={refreshing}>
              <RefreshCw className={`h-4 w-4 mr-1 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
            </Button>
            <MatrixExportMenu
              canExport={!isReadOnly}
              onCsv={() => { if (data) { exportMatrixDefinitions(data.definitions); logMatrixExport(actor, data.definitions.length, 'definitions'); toast.success('Matrix CSV exported'); } }}
              onComplianceCsv={() => { if (data) { exportMatrixCompliance(data.compliance); logMatrixExport(actor, data.compliance.length, 'compliance'); toast.success('Compliance CSV exported'); } }}
              onPrint={() => { if (data) { openMatrixPrint(data.definitions); toast.success('Report opened'); } }}
              onImport={() => toast.info('Excel import placeholder — connect to document management')}
            />
          </div>
        }
      />

      <div className="flex flex-wrap gap-1.5">
        <Badge variant="outline" className="text-xs">GMP Compliant</Badge>
        <Badge variant="outline" className="text-xs">Matrix-Driven</Badge>
        <Badge variant="outline" className="text-xs">Auto Assignment</Badge>
      </div>

      {isReadOnly && <Alert><AlertTitle>Read-Only</AlertTitle><AlertDescription>Auditor view — matrix cannot be modified.</AlertDescription></Alert>}
      {isDepartmentView && <Alert><AlertDescription>Department view — you can review and recommend matrix requirements.</AlertDescription></Alert>}
      {error && <ErrorCard message={error} onRetry={refresh} />}

      {loading ? <LoadingSkeleton rows={6} /> : data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
            {KPI_CONFIG.map((k) => (
              <KpiCard key={k.key} label={k.label} value={`${data.kpis[k.key]}${k.suffix ?? ''}`} tone={k.tone === 'slate' ? 'blue' : k.tone} />
            ))}
          </div>

          <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v as typeof activeTab); setPage(1); }}>
            <TabsList className="flex flex-wrap h-auto gap-1">
              <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
              <TabsTrigger value="definitions">Matrix ({data.definitions.length})</TabsTrigger>
              <TabsTrigger value="compliance">Compliance ({data.compliance.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="dashboard" className="space-y-4 mt-4">
              <MatrixDashboardCharts charts={data.charts} />
            </TabsContent>

            <TabsContent value="definitions" className="space-y-4 mt-4">
              <MatrixFilterPanel filters={filters} onChange={(f) => { setFilters(f); setPage(1); }} />
              <div className="flex flex-wrap gap-2">
                {(['all', 'department', 'designation', 'sop'] as const).map((m) => (
                  <Button key={m} variant={viewMode === m ? 'default' : 'outline'} size="sm"
                    className={viewMode === m ? 'bg-blue-600' : ''} onClick={() => setViewMode(m)}>
                    {m === 'all' ? 'All' : m === 'sop' ? 'SOP-wise' : `${m.charAt(0).toUpperCase()}${m.slice(1)}-wise`}
                  </Button>
                ))}
              </div>
              {grouped ? (
                <div className="space-y-4">
                  {Object.entries(grouped).map(([key, items]) => (
                    <Card key={key}>
                      <CardHeader className="py-3"><CardTitle className="text-base">{key} ({items.length})</CardTitle></CardHeader>
                      <CardContent className="p-0"><ResponsiveDataTable columns={matrixColumns} data={items} emptyMessage="No items" /></CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <ResponsiveDataTable columns={matrixColumns} data={paginated} emptyMessage="No matrix definitions" />
              )}
              {viewMode === 'all' && data.definitions.length > 15 && (
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">Page {page} of {totalPages}</p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}><ChevronLeft className="h-4 w-4" /></Button>
                    <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="compliance" className="space-y-4 mt-4">
              <ResponsiveDataTable columns={complianceColumns} data={paginatedCompliance} emptyMessage="No compliance data" />
              {data.compliance.length > 15 && (
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">Page {page} of {compliancePages}</p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}><ChevronLeft className="h-4 w-4" /></Button>
                    <Button variant="outline" size="sm" disabled={page >= compliancePages} onClick={() => setPage((p) => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Matrix Definition' : 'Create Matrix Definition'}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name="department" render={({ field }) => (
                  <FormItem><FormLabel>Department *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>{TMS_DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                    </Select><FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="designation" render={({ field }) => (
                  <FormItem><FormLabel>Designation *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="role" render={({ field }) => (
                  <FormItem><FormLabel>Role</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                )} />
                <FormField control={form.control} name="training_topic" render={({ field }) => (
                  <FormItem><FormLabel>Training Topic *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="training_type" render={({ field }) => (
                  <FormItem><FormLabel>Training Type *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>{TRAINING_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                    </Select><FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="training_frequency" render={({ field }) => (
                  <FormItem><FormLabel>Frequency *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>{MATRIX_FREQUENCIES.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
                    </Select><FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="document_number" render={({ field }) => (
                  <FormItem><FormLabel>Document Number</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                )} />
                <FormField control={form.control} name="document_title" render={({ field }) => (
                  <FormItem><FormLabel>Document Title</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                )} />
                <FormField control={form.control} name="sop_number" render={({ field }) => (
                  <FormItem><FormLabel>SOP Number</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                )} />
                <FormField control={form.control} name="sop_version" render={({ field }) => (
                  <FormItem><FormLabel>SOP Version</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                )} />
                <FormField control={form.control} name="trainer_role" render={({ field }) => (
                  <FormItem><FormLabel>Trainer Role</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                )} />
                <FormField control={form.control} name="training_duration" render={({ field }) => (
                  <FormItem><FormLabel>Duration</FormLabel><FormControl><Input {...field} placeholder="e.g. 2 hours" /></FormControl></FormItem>
                )} />
                <FormField control={form.control} name="due_days_after_assignment" render={({ field }) => (
                  <FormItem><FormLabel>Due Days After Assignment</FormLabel>
                    <FormControl><Input type="number" min={1} {...field} /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="status" render={({ field }) => (
                  <FormItem><FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>{MATRIX_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                  </FormItem>
                )} />
                <FormField control={form.control} name="skill" render={({ field }) => (
                  <FormItem><FormLabel>Skill</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                )} />
              </div>
              <div className="flex flex-wrap gap-4">
                {(['training_required', 'initial_training_required', 'refresher_required', 'effectiveness_required'] as const).map((name) => (
                  <FormField key={name} control={form.control} name={name} render={({ field }) => (
                    <FormItem className="flex items-center gap-2 space-y-0">
                      <FormControl><Checkbox checked={!!field.value} onCheckedChange={field.onChange} /></FormControl>
                      <FormLabel className="!mt-0 text-sm capitalize">{name.replace(/_/g, ' ')}</FormLabel>
                    </FormItem>
                  )} />
                ))}
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
                <Button type="submit" disabled={saving} className="bg-blue-600">{saving ? 'Saving…' : editing ? 'Update' : 'Create'}</Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewing} onOpenChange={() => setViewing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Matrix Detail — {viewing?.matrix_code}</DialogTitle></DialogHeader>
          {viewing && (
            <dl className="grid grid-cols-2 gap-2 text-sm">
              {[
                ['Matrix ID', viewing.matrix_id], ['Department', viewing.department], ['Designation', viewing.designation],
                ['Role', viewing.role || '—'], ['Topic', viewing.training_topic], ['Type', viewing.training_type],
                ['Document', viewing.document_number || '—'], ['Doc Title', viewing.document_title || '—'],
                ['SOP', viewing.sop_number || '—'], ['Version', viewing.sop_version || '—'],
                ['Frequency', viewing.training_frequency], ['Duration', viewing.training_duration || '—'],
                ['Due Days', viewing.due_days_after_assignment], ['Trainer Role', viewing.trainer_role],
                ['Status', viewing.status], ['Initial Required', viewing.initial_training_required ? 'Yes' : 'No'],
                ['Refresher', viewing.refresher_required ? 'Yes' : 'No'],
                ['Effectiveness', viewing.effectiveness_required ? 'Yes' : 'No'],
                ['Created By', viewing.created_by_name], ['Updated', new Date(viewing.updated_at).toLocaleDateString()],
              ].map(([label, value]) => (
                <div key={String(label)} className="contents">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="font-medium">{String(value)}</dd>
                </div>
              ))}
            </dl>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
