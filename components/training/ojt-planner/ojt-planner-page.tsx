'use client';

import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Plus, Wrench, Grid3X3 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { KpiCard } from '@/components/cpv/cpv-ui';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { ResponsiveDataTable } from '@/components/cpv/product-master/responsive-data-table';
import type { ColumnDef } from '@/components/admin/admin-data-table';
import { TmsPageHeader } from '@/components/training/tms-page-header';
import { RoleActionFlow } from '@/components/training/workflow/workflow-diagram';
import { OJT_WORKFLOW } from '@/lib/enterprise-tms/workflows';
import { TmsStatusBadge } from '@/components/training/tms-sub-nav';
import { useCompanyTraining } from '@/hooks/use-company-training';
import { createOjtPlan, listOjtMatrix } from '@/lib/company-training-service';
import { TMS_DEPARTMENTS } from '@/lib/training-types';
import type { OjtTrainingPlan, OjtCompetencyMatrixEntry } from '@/lib/company-training-types';

export function OjtPlannerPage() {
  const { data, loading, error, refresh, refreshing, actor } = useCompanyTraining();
  const [matrix, setMatrix] = useState<OjtCompetencyMatrixEntry[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    employee_name: '', department: 'Production', designation: '',
    mentor_name: '', training_area: '', sop_number: '', sop_title: '',
    planned_start: new Date().toISOString().slice(0, 10),
    planned_end: '',
  });

  useEffect(() => {
    listOjtMatrix().then(setMatrix);
  }, [data]);

  const handleCreate = useCallback(async () => {
    if (!form.employee_name || !form.mentor_name) return toast.error('Employee and mentor required');
    try {
      await createOjtPlan(actor, {
        ...form,
        tasks: [
          { task_number: 1, description: 'Observe operation procedure', competency_required: 'Basic', status: 'Pending', mentor_sign_off: false, sign_off_date: null },
          { task_number: 2, description: 'Perform under supervision', competency_required: 'Competent', status: 'Pending', mentor_sign_off: false, sign_off_date: null },
          { task_number: 3, description: 'Independent execution', competency_required: 'Proficient', status: 'Pending', mentor_sign_off: false, sign_off_date: null },
        ],
      });
      toast.success('OJT plan created');
      setCreateOpen(false);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to create OJT plan');
    }
  }, [actor, form, refresh]);

  const planColumns: ColumnDef<OjtTrainingPlan>[] = [
    { key: 'number', header: 'Plan #', render: (r) => r.plan_number },
    { key: 'employee', header: 'Employee', render: (r) => r.employee_name },
    { key: 'dept', header: 'Department', render: (r) => r.department },
    { key: 'mentor', header: 'Mentor', render: (r) => r.mentor_name },
    { key: 'area', header: 'Training Area', render: (r) => r.training_area },
    { key: 'sop', header: 'SOP', render: (r) => r.sop_number },
    {
      key: 'progress', header: 'Progress',
      render: (r) => {
        const done = r.tasks.filter((t) => t.status === 'Completed').length;
        const pct = r.tasks.length > 0 ? Math.round((done / r.tasks.length) * 100) : 0;
        return (
          <div className="w-24">
            <Progress value={pct} className="h-2" />
            <span className="text-xs text-muted-foreground">{done}/{r.tasks.length}</span>
          </div>
        );
      },
    },
    { key: 'status', header: 'Status', render: (r) => <TmsStatusBadge status={r.status} /> },
  ];

  const matrixColumns: ColumnDef<OjtCompetencyMatrixEntry>[] = [
    { key: 'dept', header: 'Department', render: (r) => r.department },
    { key: 'desig', header: 'Designation', render: (r) => r.designation },
    { key: 'skill', header: 'Skill Area', render: (r) => r.skill_area },
    { key: 'sop', header: 'SOP', render: (r) => r.sop_number },
    { key: 'competency', header: 'Competency', render: (r) => <Badge variant="secondary">{r.competency_level}</Badge> },
    { key: 'ojt', header: 'OJT Required', render: (r) => r.ojt_required ? 'Yes' : 'No' },
    { key: 'refresher', header: 'Refresher', render: (r) => r.refresher_frequency },
    { key: 'status', header: 'Status', render: (r) => <TmsStatusBadge status={r.status} /> },
  ];

  if (loading) return <LoadingSkeleton rows={6} />;
  if (error) return <ErrorCard message={error} onRetry={refresh} />;

  const plans = data?.ojtPlans ?? [];

  return (
    <div>
      <TmsPageHeader
        title="On Job Training"
        description="Select trainees → session details → attachments → OJT created"
        trail={[{ label: 'Training Programs' }, { label: 'On Job Training' }]}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => refresh()} disabled={refreshing}>
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
            </Button>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-2" /> Create OJT
            </Button>
          </div>
        }
      />

      <RoleActionFlow
        role="Training Coordinator"
        steps={OJT_WORKFLOW.steps.slice(0, 3).map((s) => s.label)}
        outcome="On Job Training Created"
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <KpiCard label="Active OJT Plans" value={data?.activeOjtPlans ?? 0} tone="blue" />
        <KpiCard label="Completed" value={data?.ojtCompleted ?? 0} tone="green" />
        <KpiCard label="Matrix Entries" value={matrix.length} tone="blue" />
        <KpiCard label="Total Plans" value={plans.length} tone="amber" />
      </div>

      <Tabs defaultValue="planner">
        <TabsList>
          <TabsTrigger value="planner"><Wrench className="h-4 w-4 mr-1" /> OJT Planner</TabsTrigger>
          <TabsTrigger value="matrix"><Grid3X3 className="h-4 w-4 mr-1" /> Competency Matrix</TabsTrigger>
        </TabsList>

        <TabsContent value="planner" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">OJT Training Plans</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveDataTable columns={planColumns} data={plans} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="matrix" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">OJT Competency Matrix</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveDataTable columns={matrixColumns} data={matrix} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New OJT Training Plan</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Employee Name</Label>
              <Input value={form.employee_name}
                onChange={(e) => setForm({ ...form, employee_name: e.target.value })} />
            </div>
            <div>
              <Label>Department</Label>
              <Select value={form.department} onValueChange={(v) => setForm({ ...form, department: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TMS_DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Mentor Name</Label>
              <Input value={form.mentor_name}
                onChange={(e) => setForm({ ...form, mentor_name: e.target.value })} />
            </div>
            <div>
              <Label>Training Area</Label>
              <Input value={form.training_area}
                onChange={(e) => setForm({ ...form, training_area: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>SOP Number</Label>
                <Input value={form.sop_number}
                  onChange={(e) => setForm({ ...form, sop_number: e.target.value })} />
              </div>
              <div>
                <Label>SOP Title</Label>
                <Input value={form.sop_title}
                  onChange={(e) => setForm({ ...form, sop_title: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate}>Create Plan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
