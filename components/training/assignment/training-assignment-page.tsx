'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  RefreshCw, AlertTriangle, ChevronLeft, ChevronRight, Calendar, Users, Building2,
  Grid3X3, Plus,
} from 'lucide-react';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { KpiCard } from '@/components/cpv/cpv-ui';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { ResponsiveDataTable } from '@/components/cpv/product-master/responsive-data-table';
import type { ColumnDef } from '@/components/admin/admin-data-table';
import { TmsPageHeader } from '@/components/training/tms-page-header';
import { AssignmentForm } from '@/components/training/tms-assignment-form';
import { TrainingMasterForm } from '@/components/training/tms-master-form';
import { useTrainingAssignment } from '@/hooks/use-training-assignment';
import type { AssignmentFilters, TrainingAssignment } from '@/lib/training-assignment-types';
import { displayAssignmentStatus, ASSIGNMENT_TRAINING_MODES } from '@/lib/training-assignment-types';
import {
  bulkAssignmentSchema, departmentAssignmentSchema, scheduleSessionSchema,
  type BulkAssignmentInput, type DepartmentAssignmentInput, type ScheduleSessionInput,
} from '@/lib/training-assignment-schemas';
import type { AssignmentInput, TrainingMasterInput } from '@/lib/training-schemas';
import {
  assignTraining, bulkAssign, assignDepartmentTraining, assignFromTrainingMatrix,
  scheduleSession, syncSopRetraining, cancelTrainingAssignment, createMaster,
  exportAssignmentList, openAssignmentPrint, logAssignmentExport,
  listEmployees, listTrainingMaster,
} from '@/lib/training-assignment-service';
import { TMS_DEPARTMENTS, type TrainingMaster, type EmployeeProfile } from '@/lib/training-types';
import { AssignmentFilterPanel } from './assignment-filter-panel';
import { AssignmentDashboardCharts } from './assignment-dashboard-charts';
import { AssignmentExportMenu } from './assignment-export-menu';
import { AssignmentStatusBadge } from './assignment-status-badge';

const KPI_CONFIG = [
  { label: 'Total Assignments', key: 'totalAssignments' as const, tone: 'blue' as const },
  { label: 'Assigned', key: 'assigned' as const, tone: 'amber' as const },
  { label: 'In Progress', key: 'inProgress' as const, tone: 'blue' as const },
  { label: 'Completed', key: 'completed' as const, tone: 'green' as const },
  { label: 'Overdue', key: 'overdue' as const, tone: 'red' as const },
  { label: 'Due This Week', key: 'dueThisWeek' as const, tone: 'amber' as const },
  { label: 'From Matrix', key: 'fromMatrix' as const, tone: 'blue' as const },
  { label: 'SOP Retraining', key: 'sopRetraining' as const, tone: 'red' as const },
];

interface TrainingAssignmentPageProps {
  defaultTab?: 'dashboard' | 'assignments' | 'bulk' | 'scheduling';
}

export function TrainingAssignmentPage({ defaultTab = 'dashboard' }: TrainingAssignmentPageProps) {
  const [filters, setFilters] = useState<AssignmentFilters>({});
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [page, setPage] = useState(1);
  const [saving, setSaving] = useState(false);
  const [showMaster, setShowMaster] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(new Date().toISOString().slice(0, 7));
  const [employees, setEmployees] = useState<EmployeeProfile[]>([]);
  const [masters, setMasters] = useState<TrainingMaster[]>([]);
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);

  const {
    data, loading, refreshing, error, refresh, actor,
    canView, canManage, canAssign, isReadOnly, isEmployeeView, isDepartmentView,
  } = useTrainingAssignment(filters);

  useEffect(() => {
    listEmployees().then(setEmployees).catch(() => {});
    listTrainingMaster({ status: 'Active' }).then(setMasters).catch(() => {});
  }, []);

  const bulkForm = useForm<BulkAssignmentInput>({
    resolver: zodResolver(bulkAssignmentSchema),
    defaultValues: {
      training_master_id: '', employee_ids: [],
      assigned_date: new Date().toISOString().slice(0, 10),
      due_date: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
      trainer_name: '', training_mode: 'Classroom', remarks: '',
    },
  });

  const deptForm = useForm<DepartmentAssignmentInput>({
    resolver: zodResolver(departmentAssignmentSchema),
    defaultValues: {
      training_master_id: '', department: TMS_DEPARTMENTS[0],
      assigned_date: new Date().toISOString().slice(0, 10),
      due_date: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
      trainer_name: '', training_mode: 'Classroom', remarks: '',
    },
  });

  const scheduleForm = useForm<ScheduleSessionInput>({
    resolver: zodResolver(scheduleSessionSchema),
    defaultValues: {
      training_master_id: '', department: TMS_DEPARTMENTS[0],
      scheduled_date: new Date().toISOString().slice(0, 10),
      scheduled_time: '10:00', trainer_name: '', training_mode: 'Classroom',
      employee_ids: [], due_date: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
      notes: '',
    },
  });

  const employeeOptions = useMemo(() => {
    const map = new Map<string, string>();
    data?.assignments.forEach((a) => map.set(a.employee_id, a.employee_name));
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [data?.assignments]);

  const trainers = useMemo(() => {
    const set = new Set<string>();
    data?.assignments.forEach((a) => { if (a.trainer_name) set.add(a.trainer_name); });
    return Array.from(set);
  }, [data?.assignments]);

  const paginated = useMemo(() => {
    const size = 15;
    return (data?.assignments ?? []).slice((page - 1) * size, page * size);
  }, [data?.assignments, page]);

  const totalPages = Math.max(1, Math.ceil((data?.assignments.length ?? 0) / 15));

  const calendarEvents = useMemo(() => {
    if (!data) return [];
    return data.calendar.filter((e) => e.date.startsWith(calendarMonth));
  }, [data, calendarMonth]);

  const scheduleDept = scheduleForm.watch('department');
  const deptEmployees = employees.filter((e) => e.department === scheduleDept);

  const toggleEmployee = (id: string) => {
    setSelectedEmployees((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      bulkForm.setValue('employee_ids', next, { shouldValidate: true });
      scheduleForm.setValue('employee_ids', next, { shouldValidate: true });
      return next;
    });
  };

  const handleAssign = async (input: AssignmentInput) => {
    setSaving(true);
    try {
      await assignTraining(input, actor);
      toast.success('Training assigned — employee notified');
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Assignment failed');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateMaster = async (input: TrainingMasterInput) => {
    setSaving(true);
    try {
      await createMaster(input, actor);
      toast.success('Training master created');
      setShowMaster(false);
      listTrainingMaster({ status: 'Active' }).then(setMasters);
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Create failed');
    } finally {
      setSaving(false);
    }
  };

  const handleBulk = async (input: BulkAssignmentInput) => {
    setSaving(true);
    try {
      const results = await bulkAssign({ ...input, employee_ids: selectedEmployees }, actor);
      toast.success(`${results.length} training(s) assigned`);
      setSelectedEmployees([]);
      bulkForm.reset();
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Bulk assign failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDept = async (input: DepartmentAssignmentInput) => {
    setSaving(true);
    try {
      const results = await assignDepartmentTraining(input, actor);
      toast.success(`${results.length} assignment(s) for ${input.department}`);
      deptForm.reset();
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Department assign failed');
    } finally {
      setSaving(false);
    }
  };

  const handleMatrix = async () => {
    setSaving(true);
    try {
      const count = await assignFromTrainingMatrix(actor);
      toast.success(count > 0 ? `${count} assignment(s) from matrix` : 'No pending matrix gaps');
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Matrix assign failed');
    } finally {
      setSaving(false);
    }
  };

  const handleSchedule = async (input: ScheduleSessionInput) => {
    setSaving(true);
    try {
      const { assignments: created } = await scheduleSession({ ...input, employee_ids: selectedEmployees }, actor);
      toast.success(`Session scheduled — ${created.length} assignment(s)`);
      setSelectedEmployees([]);
      scheduleForm.reset();
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Scheduling failed');
    } finally {
      setSaving(false);
    }
  };

  const handleSopSync = async () => {
    setSaving(true);
    try {
      const count = await syncSopRetraining(actor);
      toast.success(count > 0 ? `${count} SOP retraining assignment(s)` : 'No pending SOP revisions');
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'SOP sync failed');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async (a: TrainingAssignment) => {
    if (!confirm(`Cancel assignment ${a.training_number} for ${a.employee_name}?`)) return;
    try {
      await cancelTrainingAssignment(a.id, actor, 'Cancelled by user');
      toast.success('Assignment cancelled');
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Cancel failed');
    }
  };

  const columns: ColumnDef<TrainingAssignment>[] = [
    { key: 'num', header: 'Training #', render: (r) => <span className="font-mono text-xs">{r.training_number}</span> },
    { key: 'emp', header: 'Employee', render: (r) => r.employee_name },
    { key: 'dept', header: 'Department', render: (r) => r.department },
    { key: 'topic', header: 'Topic', render: (r) => <span className="text-xs">{r.training_topic || r.training_title}</span> },
    { key: 'type', header: 'Type', render: (r) => r.training_type },
    { key: 'doc', header: 'Doc #', render: (r) => <span className="font-mono text-xs">{r.document_number || '—'}</span> },
    { key: 'assigned', header: 'Assigned', render: (r) => r.assigned_date },
    { key: 'due', header: 'Due', render: (r) => r.due_date },
    { key: 'mode', header: 'Mode', render: (r) => r.training_mode || '—' },
    { key: 'trainer', header: 'Trainer', render: (r) => r.trainer_name },
    { key: 'status', header: 'Status', render: (r) => <AssignmentStatusBadge status={displayAssignmentStatus(r)} /> },
    { key: 'source', header: 'Source', render: (r) => <span className="text-xs capitalize">{r.source?.replace(/_/g, ' ') || 'manual'}</span> },
    {
      key: 'actions', header: '',
      render: (r) => canManage && !['completed', 'cancelled'].includes(String(r.status)) ? (
        <Button size="sm" variant="ghost" className="h-7 text-xs text-red-600" onClick={() => handleCancel(r)}>Cancel</Button>
      ) : null,
    },
  ];

  if (!canView) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Access Denied</AlertTitle>
        <AlertDescription>You do not have permission to view training assignments.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <TmsPageHeader
        title="Training Assignment & Scheduling"
        description="Assign, schedule and track GMP training activities"
        trail={[{ label: 'Assignment & Scheduling' }]}
        actions={
          <div className="flex flex-wrap gap-2">
            {canAssign && !isReadOnly && (
              <>
                <Button variant="outline" size="sm" onClick={handleMatrix} disabled={saving}>
                  <Grid3X3 className="h-4 w-4 mr-1" /> Matrix Auto-Assign
                </Button>
                <Button variant="outline" size="sm" onClick={handleSopSync} disabled={saving}>
                  <RefreshCw className="h-4 w-4 mr-1" /> SOP Retraining
                </Button>
              </>
            )}
            <Button variant="outline" onClick={refresh} disabled={refreshing}>
              <RefreshCw className={`h-4 w-4 mr-1 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
            </Button>
            <AssignmentExportMenu
              canExport={!isReadOnly}
              onCsv={() => { if (data) { exportAssignmentList(data.assignments); logAssignmentExport(actor, data.assignments.length); toast.success('CSV exported'); } }}
              onPrint={() => { if (data) { openAssignmentPrint(data.assignments); toast.success('Report opened'); } }}
            />
          </div>
        }
      />

      <div className="flex flex-wrap gap-1.5">
        <Badge variant="outline" className="text-xs">GMP Compliant</Badge>
        <Badge variant="outline" className="text-xs">Matrix-Driven</Badge>
        <Badge variant="outline" className="text-xs">SOP Revision Ready</Badge>
      </div>

      {isReadOnly && <Alert><AlertTitle>Read-Only</AlertTitle><AlertDescription>Auditor view — assignments cannot be modified.</AlertDescription></Alert>}
      {isEmployeeView && <Alert><AlertDescription>Viewing your own training assignments.</AlertDescription></Alert>}
      {isDepartmentView && <Alert><AlertDescription>Viewing department training assignments.</AlertDescription></Alert>}
      {error && <ErrorCard message={error} onRetry={refresh} />}

      {loading ? <LoadingSkeleton rows={6} /> : data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
            {KPI_CONFIG.map((k) => (
              <KpiCard key={k.key} label={k.label} value={data.kpis[k.key]} tone={k.tone} />
            ))}
          </div>

          <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v as typeof activeTab); setPage(1); }}>
            <TabsList className="flex flex-wrap h-auto gap-1">
              <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
              <TabsTrigger value="assignments">Assignments ({data.assignments.length})</TabsTrigger>
              <TabsTrigger value="bulk">Bulk & Department</TabsTrigger>
              <TabsTrigger value="scheduling"><Calendar className="h-3.5 w-3.5 mr-1 inline" />Scheduling</TabsTrigger>
            </TabsList>

            <TabsContent value="dashboard" className="space-y-4 mt-4">
              <AssignmentDashboardCharts charts={data.charts} />
              {data.upcomingDue.length > 0 && (
                <Alert>
                  <Calendar className="h-4 w-4" />
                  <AlertTitle>Upcoming Due Dates</AlertTitle>
                  <AlertDescription>
                    Next due: {data.upcomingDue[0]?.employee_name} — {data.upcomingDue[0]?.training_title} on {data.upcomingDue[0]?.due_date}
                  </AlertDescription>
                </Alert>
              )}
              <Card>
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                  <CardTitle className="text-sm">Training Calendar — {calendarMonth}</CardTitle>
                  <Input type="month" className="w-40 h-8" value={calendarMonth} onChange={(e) => setCalendarMonth(e.target.value)} />
                </CardHeader>
                <CardContent className="space-y-2 max-h-64 overflow-y-auto">
                  {calendarEvents.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">No scheduled events this month</p>
                  ) : calendarEvents.map((e) => (
                    <div key={`${e.id}-${e.date}`} className="flex items-center justify-between rounded border px-3 py-2 text-sm">
                      <div>
                        <span className="font-medium">{e.date}</span> — {e.title}
                        <p className="text-xs text-muted-foreground">{e.employee_name} · {e.department} · Due {e.due_date}</p>
                      </div>
                      <AssignmentStatusBadge status={e.training_status} />
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="assignments" className="space-y-4 mt-4">
              <AssignmentFilterPanel filters={filters} onChange={(f) => { setFilters(f); setPage(1); }} employees={employeeOptions} trainers={trainers} />
              {canAssign && !isReadOnly && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <Card className="border-blue-100 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <CardTitle className="text-base text-blue-900">Manual Assignment</CardTitle>
                      <Button variant="ghost" size="sm" onClick={() => setShowMaster(!showMaster)}>
                        <Plus className="h-4 w-4 mr-1" />{showMaster ? 'Hide Master' : 'New Training Master'}
                      </Button>
                    </CardHeader>
                    <CardContent><AssignmentForm onSubmit={handleAssign} saving={saving} /></CardContent>
                  </Card>
                  {showMaster && (
                    <Card>
                      <CardHeader><CardTitle className="text-base">Create Training Master</CardTitle></CardHeader>
                      <CardContent>
                        <TrainingMasterForm onSubmit={handleCreateMaster} onCancel={() => setShowMaster(false)} saving={saving} submitLabel="Create Training" />
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}
              <ResponsiveDataTable columns={columns} data={paginated} emptyMessage="No assignments found" />
            </TabsContent>

            <TabsContent value="bulk" className="space-y-4 mt-4">
              {canAssign && !isReadOnly && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <Card className="border-blue-100 shadow-sm">
                    <CardHeader><CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4" />Bulk Assign</CardTitle></CardHeader>
                    <CardContent>
                      <Form {...bulkForm}>
                        <form onSubmit={bulkForm.handleSubmit(handleBulk)} className="space-y-4">
                          <FormField control={bulkForm.control} name="training_master_id" render={({ field }) => (
                            <FormItem><FormLabel>Training *</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl><SelectTrigger><SelectValue placeholder="Select training" /></SelectTrigger></FormControl>
                                <SelectContent>{masters.map((m) => <SelectItem key={m.id} value={m.id}>{m.training_code} — {m.training_title}</SelectItem>)}</SelectContent>
                              </Select><FormMessage />
                            </FormItem>
                          )} />
                          <div className="grid grid-cols-2 gap-3">
                            <FormField control={bulkForm.control} name="assigned_date" render={({ field }) => (
                              <FormItem><FormLabel>Assigned Date *</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={bulkForm.control} name="due_date" render={({ field }) => (
                              <FormItem><FormLabel>Due Date *</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                          </div>
                          <FormField control={bulkForm.control} name="training_mode" render={({ field }) => (
                            <FormItem><FormLabel>Mode</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                <SelectContent>{ASSIGNMENT_TRAINING_MODES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                              </Select>
                            </FormItem>
                          )} />
                          <div><Label>Select Employees *</Label>
                            <div className="mt-2 max-h-40 overflow-y-auto border rounded p-2 space-y-1">
                              {employees.map((e) => (
                                <label key={e.id} className="flex items-center gap-2 text-sm cursor-pointer">
                                  <Checkbox checked={selectedEmployees.includes(e.id)} onCheckedChange={() => toggleEmployee(e.id)} />
                                  {e.full_name} ({e.department})
                                </label>
                              ))}
                            </div>
                          </div>
                          <Button type="submit" disabled={saving || selectedEmployees.length === 0} className="bg-blue-600">Bulk Assign ({selectedEmployees.length})</Button>
                        </form>
                      </Form>
                    </CardContent>
                  </Card>
                  <Card className="border-blue-100 shadow-sm">
                    <CardHeader><CardTitle className="text-base flex items-center gap-2"><Building2 className="h-4 w-4" />Department Assign</CardTitle></CardHeader>
                    <CardContent>
                      <Form {...deptForm}>
                        <form onSubmit={deptForm.handleSubmit(handleDept)} className="space-y-4">
                          <FormField control={deptForm.control} name="training_master_id" render={({ field }) => (
                            <FormItem><FormLabel>Training *</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                <SelectContent>{masters.map((m) => <SelectItem key={m.id} value={m.id}>{m.training_title}</SelectItem>)}</SelectContent>
                              </Select><FormMessage />
                            </FormItem>
                          )} />
                          <FormField control={deptForm.control} name="department" render={({ field }) => (
                            <FormItem><FormLabel>Department *</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                <SelectContent>{TMS_DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                              </Select><FormMessage />
                            </FormItem>
                          )} />
                          <div className="grid grid-cols-2 gap-3">
                            <FormField control={deptForm.control} name="assigned_date" render={({ field }) => (
                              <FormItem><FormLabel>Assigned *</FormLabel><FormControl><Input type="date" {...field} /></FormControl></FormItem>
                            )} />
                            <FormField control={deptForm.control} name="due_date" render={({ field }) => (
                              <FormItem><FormLabel>Due *</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                          </div>
                          <Button type="submit" disabled={saving} className="bg-blue-600">Assign Department</Button>
                        </form>
                      </Form>
                    </CardContent>
                  </Card>
                </div>
              )}
            </TabsContent>

            <TabsContent value="scheduling" className="space-y-4 mt-4">
              {canAssign && !isReadOnly && (
                <Card className="border-blue-100 shadow-sm max-w-2xl">
                  <CardHeader><CardTitle className="text-base flex items-center gap-2"><Calendar className="h-4 w-4" />Schedule Training Session</CardTitle></CardHeader>
                  <CardContent>
                    <Form {...scheduleForm}>
                      <form onSubmit={scheduleForm.handleSubmit(handleSchedule)} className="space-y-4">
                        <FormField control={scheduleForm.control} name="training_master_id" render={({ field }) => (
                          <FormItem><FormLabel>Training *</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                              <SelectContent>{masters.map((m) => <SelectItem key={m.id} value={m.id}>{m.training_title}</SelectItem>)}</SelectContent>
                            </Select><FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={scheduleForm.control} name="department" render={({ field }) => (
                          <FormItem><FormLabel>Department *</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                              <SelectContent>{TMS_DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                            </Select>
                          </FormItem>
                        )} />
                        <div className="grid grid-cols-2 gap-3">
                          <FormField control={scheduleForm.control} name="scheduled_date" render={({ field }) => (
                            <FormItem><FormLabel>Date *</FormLabel><FormControl><Input type="date" {...field} /></FormControl></FormItem>
                          )} />
                          <FormField control={scheduleForm.control} name="scheduled_time" render={({ field }) => (
                            <FormItem><FormLabel>Time *</FormLabel><FormControl><Input type="time" {...field} /></FormControl></FormItem>
                          )} />
                          <FormField control={scheduleForm.control} name="due_date" render={({ field }) => (
                            <FormItem><FormLabel>Due Date *</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                          )} />
                          <FormField control={scheduleForm.control} name="training_mode" render={({ field }) => (
                            <FormItem><FormLabel>Mode</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                <SelectContent>{ASSIGNMENT_TRAINING_MODES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                              </Select>
                            </FormItem>
                          )} />
                        </div>
                        <FormField control={scheduleForm.control} name="notes" render={({ field }) => (
                          <FormItem><FormLabel>Notes</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl></FormItem>
                        )} />
                        <div><Label>Participants *</Label>
                          <div className="mt-2 max-h-40 overflow-y-auto border rounded p-2 space-y-1">
                            {deptEmployees.map((e) => (
                              <label key={e.id} className="flex items-center gap-2 text-sm cursor-pointer">
                                <Checkbox checked={selectedEmployees.includes(e.id)} onCheckedChange={() => toggleEmployee(e.id)} />
                                {e.full_name}
                              </label>
                            ))}
                          </div>
                        </div>
                        <Button type="submit" disabled={saving || selectedEmployees.length === 0} className="bg-blue-600">Schedule Session</Button>
                      </form>
                    </Form>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>

          {(activeTab === 'assignments') && data.assignments.length > 15 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Page {page} of {totalPages} ({data.assignments.length} records)</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}><ChevronLeft className="h-4 w-4" /></Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
