'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, CheckCircle2, Loader2, Plus, Save, Send } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/auth-context';
import {
  canApproveCcImplementation,
  canApproveCriticalCcImplementation,
  canCompleteCcImplementationTask,
  canManageCcImplementation,
  isCcImplementationReadOnly,
  requiresHeadQaImplementationReview,
} from '@/lib/cc-implementation-records';
import {
  ccImplementationPlanSchema,
  ccImplementationQaReviewSchema,
  ccImplementationTaskSchema,
  type CcImplementationPlanInput,
  type CcImplementationTaskInput,
} from '@/lib/cc-implementation-schemas';
import {
  approveCcImplementationTask,
  completeCcImplementationTask,
  createCcImplementationTask,
  fetchCcImplementationPageData,
  saveCcImplementationPlan,
  startCcImplementation,
  submitCcImplementationQaReview,
} from '@/lib/cc-implementation-service';
import {
  CC_DEPARTMENTS,
  CC_IMPL_PRIORITIES,
  CC_IMPL_TASK_CATEGORIES,
  type CcImplementationPlan,
  type CcImplementationTask,
  type ChangeControlRecord,
} from '@/lib/change-control-types';
import { CpvPageHeader } from '@/components/cpv/product-master/cpv-page-header';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { CcStatusBadge } from '@/components/change-control/cc-sub-nav';
import { CcImplementationAccessGuard } from './cc-implementation-access-guard';
import { CcImplStatusBadge, CcTaskPriorityBadge, CcTaskStatusBadge } from './cc-implementation-badges';
import { CcImplementationGantt, CcImplementationTimeline } from './cc-implementation-gantt';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export function CcImplementationPage({ changeId }: { changeId: string }) {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [change, setChange] = useState<ChangeControlRecord | null>(null);
  const [plan, setPlan] = useState<CcImplementationPlan | null>(null);
  const [tasks, setTasks] = useState<CcImplementationTask[]>([]);
  const [auditLogs, setAuditLogs] = useState<Record<string, unknown>[]>([]);
  const [canStart, setCanStart] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);

  const actor = useMemo(() => ({
    id: user?.uid || 'system',
    name: profile?.full_name || profile?.email || 'User',
    role: profile?.role,
  }), [user?.uid, profile?.full_name, profile?.email, profile?.role]);

  const readOnly = isCcImplementationReadOnly(actor.role);
  const canManage = canManageCcImplementation(actor.role, plan?.implementation_owner, actor.id) && !readOnly;
  const canApprove = canApproveCcImplementation(actor.role) && !readOnly;
  const canApproveCritical = canApproveCriticalCcImplementation(actor.role) && !readOnly;
  const needsHeadQa = change && requiresHeadQaImplementationReview(change, tasks);
  const showHeadQaReview = canApproveCritical && plan?.head_qa_review_pending && needsHeadQa;
  const showQaReview = canApprove && plan?.implementation_status === 'Pending Verification' && !plan?.head_qa_review_pending;

  const planForm = useForm<CcImplementationPlanInput>({
    resolver: zodResolver(ccImplementationPlanSchema),
    defaultValues: {
      change_id: changeId,
      implementation_title: '',
      implementation_description: '',
      implementation_owner: user?.uid || '',
      implementation_owner_name: profile?.full_name || '',
      department: profile?.department || 'QA',
      planned_start_date: '',
      planned_end_date: '',
      validation_required: false,
      training_required: false,
      document_revision_required: false,
      capa_required: false,
      overall_remarks: '',
    },
  });

  const taskForm = useForm<CcImplementationTaskInput>({
    resolver: zodResolver(ccImplementationTaskSchema),
    defaultValues: {
      change_id: changeId,
      task_title: '',
      task_description: '',
      task_category: 'Other',
      assigned_to: user?.uid || '',
      assigned_to_name: profile?.full_name || '',
      department: profile?.department || 'QA',
      priority: 'Medium',
      dependency_task_id: null,
      planned_start_date: '',
      planned_end_date: '',
      remarks: '',
    },
  });

  const qaForm = useForm<{ decision: 'approved' | 'rejected'; qa_comments: string }>({
    resolver: zodResolver(ccImplementationQaReviewSchema),
    defaultValues: { decision: 'approved', qa_comments: '' },
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const data = await fetchCcImplementationPageData(changeId);
    if ('error' in data && data.error) {
      setError(data.error);
      setLoading(false);
      return;
    }
    if (!data.change) {
      setError('Change control not found');
      setLoading(false);
      return;
    }
    setChange(data.change);
    setPlan(data.plan || null);
    setTasks(data.tasks || []);
    setAuditLogs(data.auditLogs || []);
    setCanStart(data.canStart ?? false);

    planForm.reset({
      change_id: changeId,
      implementation_title: data.plan?.implementation_title || `Implementation — ${data.change.change_title}`,
      implementation_description: data.plan?.implementation_description || data.change.proposed_change,
      implementation_owner: data.plan?.implementation_owner || user?.uid || '',
      implementation_owner_name: data.plan?.implementation_owner_name || profile?.full_name || '',
      department: data.plan?.department || data.change.department,
      planned_start_date: data.plan?.planned_start_date || data.change.planned_implementation_date || new Date().toISOString().split('T')[0],
      planned_end_date: data.plan?.planned_end_date || data.change.planned_implementation_date || '',
      validation_required: data.plan?.validation_required ?? data.change.validation_impact,
      training_required: data.plan?.training_required ?? data.change.training_impact,
      document_revision_required: data.plan?.document_revision_required ?? Boolean(data.change.affected_documents?.trim()),
      capa_required: data.plan?.capa_required ?? data.change.capa_required,
      overall_remarks: data.plan?.overall_remarks || '',
    });
    setLoading(false);
  }, [changeId, planForm, user?.uid, profile?.full_name]);

  useEffect(() => { void load(); }, [load]);

  const handleSavePlan = async () => {
    const valid = await planForm.trigger();
    if (!valid) return;
    setBusy(true);
    const res = await saveCcImplementationPlan(planForm.getValues(), actor);
    setBusy(false);
    if (res.error) { toast.error(res.error); return; }
    setPlan(res.plan || null);
    toast.success('Plan saved');
    void load();
  };

  const handleAddTask = async () => {
    const valid = await taskForm.trigger();
    if (!valid) return;
    setBusy(true);
    const res = await createCcImplementationTask({ ...taskForm.getValues(), plan_id: plan?.id }, actor);
    setBusy(false);
    if (res.error) { toast.error(res.error); return; }
    toast.success('Task created');
    setTaskOpen(false);
    taskForm.reset({ change_id: changeId, task_category: 'Other', priority: 'Medium', assigned_to: user?.uid || '', department: profile?.department || 'QA' });
    void load();
  };

  const handleStart = async () => {
    const valid = await planForm.trigger();
    if (!valid) return;
    setBusy(true);
    const saveRes = await saveCcImplementationPlan(planForm.getValues(), actor);
    if (saveRes.error) {
      setBusy(false);
      toast.error(saveRes.error);
      return;
    }
    const res = await startCcImplementation(changeId, actor);
    setBusy(false);
    if (res.error) { toast.error(res.error); return; }
    setPlan(res.plan || null);
    toast.success('Implementation started');
    void load();
  };

  const handleApproveTask = async (taskId: string) => {
    setBusy(true);
    const res = await approveCcImplementationTask(taskId, actor);
    setBusy(false);
    if (res.error) { toast.error(res.error); return; }
    toast.success('Critical task approved');
    void load();
  };

  const handleCompleteTask = async (taskId: string) => {
    setBusy(true);
    const res = await completeCcImplementationTask(taskId, actor);
    setBusy(false);
    if (res.error) { toast.error(res.error); return; }
    toast.success('Task completed');
    void load();
  };

  const handleQaReview = async () => {
    const valid = await qaForm.trigger();
    if (!valid) return;
    setBusy(true);
    const res = await submitCcImplementationQaReview(changeId, qaForm.getValues(), actor);
    setBusy(false);
    if (res.error) { toast.error(res.error); return; }
    toast.success('QA review recorded');
    void load();
  };

  const filterTasks = (categories: string[]) => tasks.filter((t) => categories.includes(t.task_category));
  const milestones = tasks.filter((t) => t.priority === 'Critical' || t.is_mandatory);

  if (loading) return <LoadingSkeleton rows={8} />;
  if (error || !change) return <ErrorCard message={error || 'Not found'} onRetry={() => void load()} />;

  return (
    <CcImplementationAccessGuard>
      <div className="space-y-6">
        <CpvPageHeader
          title="Change Implementation Plan"
          description="Plan, assign and track implementation activities for approved changes"
          trail={[
            { label: 'Dashboard', href: '/dashboard' },
            { label: 'QMS', href: '/qms/change-control' },
            { label: 'Change Control', href: '/qms/change-control' },
            { label: 'Implementation Plan', href: '/qms/change-control/implementation' },
            { label: change.change_control_number },
          ]}
          actions={(
            <Link href="/qms/change-control/implementation">
              <Button variant="outline" size="sm"><ArrowLeft className="mr-2 h-4 w-4" />Back</Button>
            </Link>
          )}
        />

        {!canStart && (
          <Alert variant="destructive">
            <AlertTitle>Approval Required</AlertTitle>
            <AlertDescription>Implementation plan cannot start until the change control is approved for implementation.</AlertDescription>
          </Alert>
        )}

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Change Control</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-1">
              <p className="font-mono font-medium">{change.change_control_number}</p>
              <CcStatusBadge status={change.status} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Plan Status</CardTitle></CardHeader>
            <CardContent><CcImplStatusBadge status={plan?.implementation_status} /></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Progress</CardTitle></CardHeader>
            <CardContent>
              <Progress value={plan?.implementation_progress ?? 0} className="h-2" />
              <p className="mt-1 text-sm tabular-nums">{plan?.implementation_progress ?? 0}%</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Tasks</CardTitle></CardHeader>
            <CardContent className="text-sm">{tasks.filter((t) => t.task_status === 'Completed').length} / {tasks.length} completed</CardContent>
          </Card>
        </div>

        <Tabs defaultValue="overview">
          <TabsList className="flex h-auto flex-wrap">
            {['overview', 'tasks', 'gantt', 'milestones', 'validation', 'training', 'documents', 'qa', 'audit'].map((t) => {
              const labels: Record<string, string> = {
                overview: 'Overview', tasks: 'Task Management', gantt: 'Gantt Chart', milestones: 'Milestones',
                validation: 'Validation Tasks', training: 'Training Tasks', documents: 'Document Updates',
                qa: 'QA Review', audit: 'Audit Trail',
              };
              return <TabsTrigger key={t} value={t}>{labels[t]}</TabsTrigger>;
            })}
          </TabsList>

          <TabsContent value="overview" className="mt-4">
            <Form {...planForm}>
              <Card>
                <CardHeader><CardTitle>Implementation Overview</CardTitle></CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <FormField control={planForm.control} name="implementation_title" render={({ field }) => (
                    <FormItem className="md:col-span-2"><FormLabel>Title *</FormLabel><FormControl><Input {...field} disabled={!canManage} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={planForm.control} name="implementation_owner" render={({ field }) => (
                    <FormItem><FormLabel>Owner *</FormLabel><FormControl><Input {...field} disabled={!canManage} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={planForm.control} name="department" render={({ field }) => (
                    <FormItem><FormLabel>Department</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value} disabled={!canManage}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>{CC_DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                      </Select></FormItem>
                  )} />
                  <FormField control={planForm.control} name="planned_start_date" render={({ field }) => (
                    <FormItem><FormLabel>Planned Start *</FormLabel><FormControl><Input type="date" {...field} disabled={!canManage} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={planForm.control} name="planned_end_date" render={({ field }) => (
                    <FormItem><FormLabel>Planned End *</FormLabel><FormControl><Input type="date" {...field} disabled={!canManage} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={planForm.control} name="implementation_description" render={({ field }) => (
                    <FormItem className="md:col-span-2"><FormLabel>Description</FormLabel><FormControl><Textarea rows={3} {...field} disabled={!canManage} /></FormControl></FormItem>
                  )} />
                  <BoolPlanField form={planForm} name="validation_required" label="Validation Required" disabled={!canManage} />
                  <BoolPlanField form={planForm} name="training_required" label="Training Required" disabled={!canManage} />
                  <BoolPlanField form={planForm} name="document_revision_required" label="Document Revision Required" disabled={!canManage} />
                  <BoolPlanField form={planForm} name="capa_required" label="CAPA Required" disabled={!canManage} />
                </CardContent>
              </Card>
            </Form>
          </TabsContent>

          <TabsContent value="tasks" className="mt-4 space-y-4">
            {canManage && (
              <Button onClick={() => setTaskOpen(true)}><Plus className="mr-2 h-4 w-4" />Add Task</Button>
            )}
            <TaskTable
              tasks={tasks}
              onComplete={handleCompleteTask}
              onApprove={handleApproveTask}
              canCompleteTask={(t) => canCompleteCcImplementationTask(actor.role, t, actor.id, plan?.implementation_owner)}
              canApprove={canApprove}
              busy={busy}
            />
          </TabsContent>

          <TabsContent value="gantt" className="mt-4"><CcImplementationGantt tasks={tasks} /></TabsContent>
          <TabsContent value="milestones" className="mt-4">
            <TaskTable
              tasks={milestones}
              onComplete={handleCompleteTask}
              onApprove={handleApproveTask}
              canCompleteTask={(t) => canCompleteCcImplementationTask(actor.role, t, actor.id, plan?.implementation_owner)}
              canApprove={canApprove}
              busy={busy}
            />
          </TabsContent>
          <TabsContent value="validation" className="mt-4">
            <TaskTable
              tasks={filterTasks(['Validation', 'Qualification', 'Testing'])}
              onComplete={handleCompleteTask}
              onApprove={handleApproveTask}
              canCompleteTask={(t) => canCompleteCcImplementationTask(actor.role, t, actor.id, plan?.implementation_owner)}
              canApprove={canApprove}
              busy={busy}
            />
          </TabsContent>
          <TabsContent value="training" className="mt-4">
            <TaskTable
              tasks={filterTasks(['Training'])}
              onComplete={handleCompleteTask}
              onApprove={handleApproveTask}
              canCompleteTask={(t) => canCompleteCcImplementationTask(actor.role, t, actor.id, plan?.implementation_owner)}
              canApprove={canApprove}
              busy={busy}
            />
          </TabsContent>
          <TabsContent value="documents" className="mt-4">
            <TaskTable
              tasks={filterTasks(['Document Update'])}
              onComplete={handleCompleteTask}
              onApprove={handleApproveTask}
              canCompleteTask={(t) => canCompleteCcImplementationTask(actor.role, t, actor.id, plan?.implementation_owner)}
              canApprove={canApprove}
              busy={busy}
            />
          </TabsContent>

          <TabsContent value="qa" className="mt-4 space-y-4">
            {(showQaReview || showHeadQaReview) && plan && (
              <Form {...qaForm}>
                <Card>
                  <CardHeader>
                    <CardTitle>{showHeadQaReview ? 'Head QA Verification' : 'QA Verification'}</CardTitle>
                    <CardDescription>
                      {showHeadQaReview
                        ? 'Critical implementation requires Head QA approval.'
                        : 'Verify all mandatory tasks are completed before approval.'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FormField control={qaForm.control} name="decision" render={({ field }) => (
                      <FormItem><FormLabel>Decision</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="approved">Approve{needsHeadQa && showQaReview ? ' (forward to Head QA)' : ''}</SelectItem>
                            <SelectItem value="rejected">Reject</SelectItem>
                          </SelectContent>
                        </Select></FormItem>
                    )} />
                    <FormField control={qaForm.control} name="qa_comments" render={({ field }) => (
                      <FormItem><FormLabel>QA Comments *</FormLabel><FormControl><Textarea rows={3} {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <Button onClick={() => void handleQaReview()} disabled={busy}>
                      {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                      {showHeadQaReview ? 'Submit Head QA Review' : 'Submit QA Review'}
                    </Button>
                  </CardContent>
                </Card>
              </Form>
            )}
          </TabsContent>

          <TabsContent value="audit" className="mt-4"><CcImplementationTimeline auditLogs={auditLogs} /></TabsContent>
        </Tabs>

        {canManage && (
          <div className="flex gap-2 border-t pt-4">
            <Button variant="outline" onClick={() => void handleSavePlan()} disabled={busy}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Save Plan
            </Button>
            {canStart && plan && !plan.actual_start_date && (
              <Button onClick={() => void handleStart()} disabled={busy}>
                <Send className="mr-2 h-4 w-4" />Start Implementation
              </Button>
            )}
          </div>
        )}

        <Dialog open={taskOpen} onOpenChange={setTaskOpen}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Add Implementation Task</DialogTitle></DialogHeader>
            <Form {...taskForm}>
              <div className="space-y-3">
                <FormField control={taskForm.control} name="task_title" render={({ field }) => (
                  <FormItem><FormLabel>Title *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={taskForm.control} name="task_category" render={({ field }) => (
                  <FormItem><FormLabel>Category</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>{CC_IMPL_TASK_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select></FormItem>
                )} />
                <FormField control={taskForm.control} name="assigned_to" render={({ field }) => (
                  <FormItem><FormLabel>Assigned To *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={taskForm.control} name="priority" render={({ field }) => (
                  <FormItem><FormLabel>Priority</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>{CC_IMPL_PRIORITIES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                    </Select></FormItem>
                )} />
                <FormField control={taskForm.control} name="dependency_task_id" render={({ field }) => (
                  <FormItem><FormLabel>Dependency Task</FormLabel>
                    <Select onValueChange={(v) => field.onChange(v === 'none' ? null : v)} value={field.value || 'none'}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {tasks.map((t) => <SelectItem key={t.id} value={t.id}>{t.task_title}</SelectItem>)}
                      </SelectContent>
                    </Select></FormItem>
                )} />
                <div className="grid grid-cols-2 gap-3">
                  <FormField control={taskForm.control} name="planned_start_date" render={({ field }) => (
                    <FormItem><FormLabel>Start *</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={taskForm.control} name="planned_end_date" render={({ field }) => (
                    <FormItem><FormLabel>End *</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
              </div>
            </Form>
            <DialogFooter>
              <Button variant="outline" onClick={() => setTaskOpen(false)}>Cancel</Button>
              <Button onClick={() => void handleAddTask()} disabled={busy}>Create Task</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </CcImplementationAccessGuard>
  );
}

function BoolPlanField({ form, name, label, disabled }: {
  form: ReturnType<typeof useForm<CcImplementationPlanInput>>;
  name: keyof CcImplementationPlanInput;
  label: string;
  disabled?: boolean;
}) {
  return (
    <FormField control={form.control} name={name as 'validation_required'} render={({ field }) => (
      <FormItem className="flex items-center justify-between rounded-lg border p-3">
        <FormLabel className="font-normal">{label}</FormLabel>
        <FormControl><Switch checked={!!field.value} onCheckedChange={field.onChange} disabled={disabled} /></FormControl>
      </FormItem>
    )} />
  );
}

function TaskTable({ tasks, onComplete, onApprove, canCompleteTask, canApprove, busy }: {
  tasks: CcImplementationTask[];
  onComplete: (id: string) => void;
  onApprove: (id: string) => void;
  canCompleteTask: (task: CcImplementationTask) => boolean;
  canApprove: boolean;
  busy: boolean;
}) {
  if (!tasks.length) return <p className="text-sm text-muted-foreground py-8 text-center">No tasks in this category.</p>;
  return (
    <Card>
      <CardContent className="overflow-x-auto pt-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Task</TableHead><TableHead>Category</TableHead><TableHead>Assignee</TableHead>
              <TableHead>Priority</TableHead><TableHead>Status</TableHead><TableHead>Due</TableHead><TableHead>Dep.</TableHead><TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tasks.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="font-medium max-w-[160px] truncate">{t.task_title}{t.is_mandatory && <span className="ml-1 text-red-600">*</span>}</TableCell>
                <TableCell>{t.task_category}</TableCell>
                <TableCell>{t.assigned_to_name || t.assigned_to}</TableCell>
                <TableCell><CcTaskPriorityBadge priority={t.priority} /></TableCell>
                <TableCell><CcTaskStatusBadge status={t.task_status} /></TableCell>
                <TableCell>{t.planned_end_date}</TableCell>
                <TableCell className="text-xs">{t.dependency_task_number || '—'}</TableCell>
                <TableCell className="space-x-1">
                  {canCompleteTask(t) && !['Completed', 'Pending Review'].includes(t.task_status) && (
                    <Button size="sm" variant="outline" disabled={busy} onClick={() => onComplete(t.id)}>Complete</Button>
                  )}
                  {canApprove && t.task_status === 'Pending Review' && (
                    <Button size="sm" disabled={busy} onClick={() => onApprove(t.id)}>Approve</Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
