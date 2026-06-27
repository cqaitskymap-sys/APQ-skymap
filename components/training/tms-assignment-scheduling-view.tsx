'use client';

import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Download, Calendar, Users, Building2, Grid3X3, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Checkbox } from '@/components/ui/checkbox';
import { TmsFiltersBar } from '@/components/training/tms-filters';
import { TmsPageHeader } from '@/components/training/tms-page-header';
import { TmsStatusBadge } from '@/components/training/tms-sub-nav';
import { AssignmentForm } from '@/components/training/tms-assignment-form';
import { TrainingMasterForm } from '@/components/training/tms-master-form';
import { useTrainingAssignments } from '@/hooks/use-training';
import {
  createAssignment, createTrainingMaster, bulkAssignTraining, assignByDepartment,
  assignFromMatrix, scheduleTrainingSession, exportAssignmentsCsv, syncDmsTrainingLinks,
  listEmployees,
} from '@/lib/training-service';
import {
  bulkAssignmentSchema, departmentAssignmentSchema, scheduleSessionSchema,
  type AssignmentInput, type BulkAssignmentInput, type DepartmentAssignmentInput,
  type ScheduleSessionInput, type TrainingMasterInput,
} from '@/lib/training-schemas';
import {
  ASSIGNMENT_TRAINING_MODES, TMS_DEPARTMENTS, type TmsFilters, type TrainingAssignment,
  canAssignTraining, canAssignDepartmentTraining, canViewDepartmentTraining,
  isTmsReadOnly, isEmployeeTrainingView, getAssignmentDisplayStatus,
} from '@/lib/training-types';
import type { EmployeeProfile, TmsActor } from '@/lib/training-types';

type TabKey = 'assignments' | 'bulk' | 'scheduling';

interface Props {
  defaultTab?: TabKey;
}

function filterAssignments(
  items: TrainingAssignment[],
  role: string,
  userDepartment: string,
  userEmployeeId: string,
): TrainingAssignment[] {
  if (canViewDepartmentTraining(role) || isTmsReadOnly(role)) {
    if (canAssignDepartmentTraining(role) && !canAssignTraining(role)
      && ['department_head', 'production_manager', 'qc_manager', 'engineering_manager', 'warehouse_manager'].includes(role)) {
      return items.filter((a) => a.department === userDepartment);
    }
    if (isTmsReadOnly(role)) return items;
    return items;
  }
  if (isEmployeeTrainingView(role)) {
    return items.filter((a) => a.employee_id === userEmployeeId);
  }
  return items;
}

export function TrainingAssignmentSchedulingView({ defaultTab = 'assignments' }: Props) {
  const [filters, setFilters] = useState<TmsFilters>({});
  const [tab, setTab] = useState<TabKey>(defaultTab);
  const [saving, setSaving] = useState(false);
  const [showMaster, setShowMaster] = useState(false);
  const [employees, setEmployees] = useState<EmployeeProfile[]>([]);
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [calendarMonth, setCalendarMonth] = useState(new Date().toISOString().slice(0, 7));

  const {
    assignments, masters, calendar, loading, error, refresh, role,
    userDepartment, userEmployeeId, actor,
  } = useTrainingAssignments(filters);

  const scoped = useMemo(
    () => filterAssignments(assignments, role, userDepartment, userEmployeeId),
    [assignments, role, userDepartment, userEmployeeId],
  );

  const calendarEvents = useMemo(() => {
    const scopedIds = new Set(scoped.map((a) => a.id));
    return calendar.filter((e) => scopedIds.has(e.id) && e.date.startsWith(calendarMonth));
  }, [calendar, scoped, calendarMonth]);

  const bulkForm = useForm<BulkAssignmentInput>({
    resolver: zodResolver(bulkAssignmentSchema),
    defaultValues: {
      training_master_id: '', employee_ids: [],
      assigned_date: new Date().toISOString().split('T')[0],
      due_date: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
      trainer_name: '', training_mode: 'Classroom', remarks: '',
    },
  });

  const deptForm = useForm<DepartmentAssignmentInput>({
    resolver: zodResolver(departmentAssignmentSchema),
    defaultValues: {
      training_master_id: '', department: userDepartment || TMS_DEPARTMENTS[0],
      assigned_date: new Date().toISOString().split('T')[0],
      due_date: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
      trainer_name: '', training_mode: 'Classroom', remarks: '',
    },
  });

  const scheduleForm = useForm<ScheduleSessionInput>({
    resolver: zodResolver(scheduleSessionSchema),
    defaultValues: {
      training_master_id: '', department: userDepartment || TMS_DEPARTMENTS[0],
      scheduled_date: new Date().toISOString().split('T')[0],
      scheduled_time: '10:00', trainer_name: '', training_mode: 'Classroom',
      employee_ids: [], due_date: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
      notes: '',
    },
  });

  useEffect(() => {
    listEmployees().then(setEmployees);
  }, []);

  const canAssign = canAssignTraining(role) && !isTmsReadOnly(role);
  const canDeptAssign = canAssignDepartmentTraining(role) && !isTmsReadOnly(role);

  const handleAssign = async (data: AssignmentInput) => {
    setSaving(true);
    try {
      await createAssignment(data, actor as TmsActor);
      toast.success('Training assigned — employee notified');
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Assignment failed');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateMaster = async (data: TrainingMasterInput) => {
    setSaving(true);
    try {
      await createTrainingMaster(data, actor as TmsActor);
      toast.success('Training master created');
      setShowMaster(false);
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Create failed');
    } finally {
      setSaving(false);
    }
  };

  const handleBulk = async (data: BulkAssignmentInput) => {
    setSaving(true);
    try {
      const results = await bulkAssignTraining({ ...data, employee_ids: selectedEmployees }, actor as TmsActor);
      toast.success(`${results.length} training(s) assigned`);
      setSelectedEmployees([]);
      bulkForm.reset();
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Bulk assign failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDept = async (data: DepartmentAssignmentInput) => {
    setSaving(true);
    try {
      const results = await assignByDepartment(data, actor as TmsActor);
      toast.success(`${results.length} assignment(s) created for ${data.department}`);
      deptForm.reset();
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Department assign failed');
    } finally {
      setSaving(false);
    }
  };

  const handleMatrixAssign = async () => {
    setSaving(true);
    try {
      const count = await assignFromMatrix(actor as TmsActor);
      toast.success(count > 0 ? `${count} assignment(s) from matrix` : 'No pending matrix gaps to assign');
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Matrix assign failed');
    } finally {
      setSaving(false);
    }
  };

  const handleSchedule = async (data: ScheduleSessionInput) => {
    setSaving(true);
    try {
      const { assignments: created } = await scheduleTrainingSession(
        { ...data, employee_ids: selectedEmployees },
        actor as TmsActor,
      );
      toast.success(`Session scheduled — ${created.length} assignment(s) created`);
      setSelectedEmployees([]);
      scheduleForm.reset();
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Scheduling failed');
    } finally {
      setSaving(false);
    }
  };

  const handleSyncSop = async () => {
    setSaving(true);
    try {
      const count = await syncDmsTrainingLinks(actor as TmsActor);
      toast.success(count > 0 ? `${count} SOP retraining assignment(s) created` : 'No pending SOP revisions');
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'SOP sync failed');
    } finally {
      setSaving(false);
    }
  };

  const toggleEmployee = (id: string) => {
    setSelectedEmployees((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const deptEmployees = employees.filter((e) => e.department === scheduleForm.watch('department'));

  return (
    <div className="space-y-6">
      <TmsPageHeader
        title="Training Assignment & Scheduling"
        description="Assign, schedule and track GMP training activities"
        trail={[{ label: 'Assignment & Scheduling' }]}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => exportAssignmentsCsv(scoped)}>
              <Download className="h-4 w-4 mr-1" />Export
            </Button>
            {canAssign && (
              <>
                <Button variant="outline" size="sm" onClick={handleMatrixAssign} disabled={saving}>
                  <Grid3X3 className="h-4 w-4 mr-1" />Matrix Auto-Assign
                </Button>
                <Button variant="outline" size="sm" onClick={handleSyncSop} disabled={saving}>
                  <RefreshCw className="h-4 w-4 mr-1" />SOP Retraining
                </Button>
              </>
            )}
          </>
        }
      />

      <TmsFiltersBar filters={filters} onChange={setFilters} />
      {error && <p className="text-sm text-red-600">{error}</p>}

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
        <TabsList className="grid w-full max-w-2xl grid-cols-3">
          <TabsTrigger value="assignments">Assignments</TabsTrigger>
          <TabsTrigger value="bulk">Bulk & Department</TabsTrigger>
          <TabsTrigger value="scheduling"><Calendar className="h-4 w-4 mr-1 inline" />Scheduling</TabsTrigger>
        </TabsList>

        <TabsContent value="assignments" className="space-y-6 mt-6">
          {canAssign && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="border-blue-100 shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-base text-blue-900">Manual Assignment</CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => setShowMaster(!showMaster)}>
                    {showMaster ? 'Hide' : '+ New Training Master'}
                  </Button>
                </CardHeader>
                <CardContent>
                  <AssignmentForm onSubmit={handleAssign} saving={saving} />
                </CardContent>
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

          {loading ? <LoadingSpinner /> : (
            <Card>
              <CardHeader><CardTitle>All Assignments ({scoped.length})</CardTitle></CardHeader>
              <CardContent className="overflow-x-auto p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Training #</TableHead><TableHead>Employee</TableHead><TableHead>Department</TableHead>
                      <TableHead>Topic</TableHead><TableHead>Type</TableHead><TableHead>Doc #</TableHead>
                      <TableHead>Assigned</TableHead><TableHead>Due</TableHead><TableHead>Mode</TableHead>
                      <TableHead>Trainer</TableHead><TableHead>Status</TableHead><TableHead>Source</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {scoped.length === 0 ? (
                      <TableRow><TableCell colSpan={12} className="text-center py-8 text-muted-foreground">No assignments</TableCell></TableRow>
                    ) : scoped.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell className="font-mono text-sm">{a.training_number}</TableCell>
                        <TableCell>{a.employee_name}</TableCell>
                        <TableCell>{a.department}</TableCell>
                        <TableCell className="max-w-[140px] truncate">{a.training_topic || a.training_title}</TableCell>
                        <TableCell className="text-xs">{a.training_type}</TableCell>
                        <TableCell className="font-mono text-xs">{a.document_number || '—'}</TableCell>
                        <TableCell>{a.assigned_date}</TableCell>
                        <TableCell>{a.due_date}</TableCell>
                        <TableCell className="text-xs">{a.training_mode || '—'}</TableCell>
                        <TableCell>{a.trainer_name}</TableCell>
                        <TableCell><TmsStatusBadge status={getAssignmentDisplayStatus(a)} /></TableCell>
                        <TableCell className="text-xs capitalize">{a.source?.replace(/_/g, ' ') || 'manual'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="bulk" className="space-y-6 mt-6">
          {canAssign && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="border-blue-100 shadow-sm">
                <CardHeader><CardTitle className="text-base text-blue-900 flex items-center gap-2"><Users className="h-4 w-4" />Bulk Assign</CardTitle></CardHeader>
                <CardContent>
                  <Form {...bulkForm}>
                    <form onSubmit={bulkForm.handleSubmit(handleBulk)} className="space-y-4">
                      <FormField control={bulkForm.control} name="training_master_id" render={({ field }) => (
                        <FormItem><FormLabel>Training *</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Select training" /></SelectTrigger></FormControl>
                            <SelectContent>{masters.map((m) => <SelectItem key={m.id} value={m.id}>{m.training_title}</SelectItem>)}</SelectContent>
                          </Select><FormMessage />
                        </FormItem>
                      )} />
                      <div className="space-y-2 max-h-40 overflow-y-auto border rounded-md p-2">
                        <FormLabel>Employees * ({selectedEmployees.length} selected)</FormLabel>
                        {employees.map((e) => (
                          <label key={e.id} className="flex items-center gap-2 text-sm cursor-pointer">
                            <Checkbox checked={selectedEmployees.includes(e.id)} onCheckedChange={() => toggleEmployee(e.id)} />
                            {e.full_name} — {e.department}
                          </label>
                        ))}
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <FormField control={bulkForm.control} name="assigned_date" render={({ field }) => (
                          <FormItem><FormLabel>Assigned *</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={bulkForm.control} name="due_date" render={({ field }) => (
                          <FormItem><FormLabel>Due *</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                      </div>
                      <Button type="submit" disabled={saving || selectedEmployees.length === 0} className="bg-blue-600">
                        Bulk Assign ({selectedEmployees.length})
                      </Button>
                    </form>
                  </Form>
                </CardContent>
              </Card>

              {canDeptAssign && (
                <Card className="border-blue-100 shadow-sm">
                  <CardHeader><CardTitle className="text-base text-blue-900 flex items-center gap-2"><Building2 className="h-4 w-4" />Department Assign</CardTitle></CardHeader>
                  <CardContent>
                    <Form {...deptForm}>
                      <form onSubmit={deptForm.handleSubmit(handleDept)} className="space-y-4">
                        <FormField control={deptForm.control} name="training_master_id" render={({ field }) => (
                          <FormItem><FormLabel>Training *</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl><SelectTrigger><SelectValue placeholder="Select training" /></SelectTrigger></FormControl>
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
                            <FormItem><FormLabel>Assigned *</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                          )} />
                          <FormField control={deptForm.control} name="due_date" render={({ field }) => (
                            <FormItem><FormLabel>Due *</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                          )} />
                        </div>
                        <Button type="submit" disabled={saving} className="bg-blue-600">Assign to Department</Button>
                      </form>
                    </Form>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="scheduling" className="space-y-6 mt-6">
          {canAssign && (
            <Card className="border-blue-100 shadow-sm">
              <CardHeader><CardTitle className="text-base text-blue-900">Schedule Training Session</CardTitle></CardHeader>
              <CardContent>
                <Form {...scheduleForm}>
                  <form onSubmit={scheduleForm.handleSubmit(handleSchedule)} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField control={scheduleForm.control} name="training_master_id" render={({ field }) => (
                        <FormItem><FormLabel>Training *</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Select training" /></SelectTrigger></FormControl>
                            <SelectContent>{masters.map((m) => <SelectItem key={m.id} value={m.id}>{m.training_title}</SelectItem>)}</SelectContent>
                          </Select><FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={scheduleForm.control} name="department" render={({ field }) => (
                        <FormItem><FormLabel>Department *</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                            <SelectContent>{TMS_DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                          </Select><FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={scheduleForm.control} name="scheduled_date" render={({ field }) => (
                        <FormItem><FormLabel>Session Date *</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={scheduleForm.control} name="scheduled_time" render={({ field }) => (
                        <FormItem><FormLabel>Session Time *</FormLabel><FormControl><Input type="time" {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={scheduleForm.control} name="due_date" render={({ field }) => (
                        <FormItem><FormLabel>Completion Due *</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
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
                    <div className="space-y-2 max-h-36 overflow-y-auto border rounded-md p-2">
                      <FormLabel>Session Attendees * ({selectedEmployees.length})</FormLabel>
                      {deptEmployees.map((e) => (
                        <label key={e.id} className="flex items-center gap-2 text-sm cursor-pointer">
                          <Checkbox checked={selectedEmployees.includes(e.id)} onCheckedChange={() => toggleEmployee(e.id)} />
                          {e.full_name}
                        </label>
                      ))}
                    </div>
                    <FormField control={scheduleForm.control} name="notes" render={({ field }) => (
                      <FormItem><FormLabel>Session Notes</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl></FormItem>
                    )} />
                    <Button type="submit" disabled={saving || selectedEmployees.length === 0} className="bg-blue-600">
                      Schedule Session
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Training Calendar</CardTitle>
              <Input type="month" value={calendarMonth} onChange={(e) => setCalendarMonth(e.target.value)} className="w-40" />
            </CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead><TableHead>Training #</TableHead><TableHead>Topic</TableHead>
                    <TableHead>Employee</TableHead><TableHead>Department</TableHead><TableHead>Trainer</TableHead>
                    <TableHead>Mode</TableHead><TableHead>Status</TableHead><TableHead>Due</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {calendarEvents.length === 0 ? (
                    <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">No events this month</TableCell></TableRow>
                  ) : calendarEvents.map((e) => (
                    <TableRow key={`${e.id}-${e.date}`}>
                      <TableCell>{e.date}</TableCell>
                      <TableCell className="font-mono text-sm">{e.training_number}</TableCell>
                      <TableCell className="max-w-[140px] truncate">{e.title}</TableCell>
                      <TableCell>{e.employee_name}</TableCell>
                      <TableCell>{e.department}</TableCell>
                      <TableCell>{e.trainer_name}</TableCell>
                      <TableCell className="text-xs">{e.training_mode}</TableCell>
                      <TableCell><TmsStatusBadge status={e.training_status} /></TableCell>
                      <TableCell>{e.due_date}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
