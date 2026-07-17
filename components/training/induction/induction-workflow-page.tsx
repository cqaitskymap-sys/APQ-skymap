'use client';

import { useCallback, useState } from 'react';
import { RefreshCw, Plus, ArrowRight, UserCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
import { TmsStatusBadge } from '@/components/training/tms-sub-nav';
import { useCompanyTraining } from '@/hooks/use-company-training';
import {
  createInductionRecord, completeHrInduction, completeDeptHandover,
} from '@/lib/company-training-service';
import { TMS_DEPARTMENTS } from '@/lib/training-types';
import { INDUCTION_STAGES } from '@/lib/company-training-types';
import type { InductionRecord } from '@/lib/company-training-types';

export function InductionWorkflowPage() {
  const {
    data, loading, error, refresh, refreshing, actor,
    canConductHrInduction, canApproveDeptHandover,
  } = useCompanyTraining();
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    employee_name: '', department: 'Production', designation: '',
    dept_head_name: '', joining_date: new Date().toISOString().slice(0, 10),
  });

  const handleCreate = useCallback(async () => {
    if (!form.employee_name) return toast.error('Employee name required');
    try {
      await createInductionRecord(actor, form);
      toast.success('Induction record created — HR induction in progress');
      setCreateOpen(false);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to create induction');
    }
  }, [actor, form, refresh]);

  const handleHrComplete = useCallback(async (id: string) => {
    try {
      await completeHrInduction(actor, id);
      toast.success('HR induction completed — pending department head handover');
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  }, [actor, refresh]);

  const handleDeptHandover = useCallback(async (id: string) => {
    try {
      await completeDeptHandover(actor, id);
      toast.success('Department handover completed — TC will prepare JD & TNI');
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  }, [actor, refresh]);

  const columns: ColumnDef<InductionRecord>[] = [
    { key: 'number', header: 'Induction #', render: (r) => r.induction_number },
    { key: 'employee', header: 'Employee', render: (r) => r.employee_name },
    { key: 'dept', header: 'Department', render: (r) => r.department },
    { key: 'desig', header: 'Designation', render: (r) => r.designation },
    { key: 'joining', header: 'Joining Date', render: (r) => r.joining_date },
    { key: 'stage', header: 'Stage', render: (r) => <Badge variant="outline">{r.current_stage}</Badge> },
    { key: 'hr', header: 'HR By', render: (r) => r.hr_conducted_by_name || '—' },
    { key: 'dh', header: 'Dept Head', render: (r) => r.dept_head_name || '—' },
    {
      key: 'jd_tni', header: 'JD / TNI',
      render: (r) => (
        <span className="text-xs">{r.jd_number || '—'} / {r.tni_number || '—'}</span>
      ),
    },
    { key: 'status', header: 'Status', render: (r) => <TmsStatusBadge status={r.status} /> },
    {
      key: 'actions', header: 'Actions',
      render: (r) => {
        if (r.status === 'HR In Progress' && canConductHrInduction) {
          return (
            <Button size="sm" variant="outline" onClick={() => handleHrComplete(r.id)}>
              <UserCheck className="h-3 w-3 mr-1" /> Complete HR
            </Button>
          );
        }
        if (r.status === 'Pending Dept Head' && canApproveDeptHandover) {
          return (
            <Button size="sm" variant="outline" onClick={() => handleDeptHandover(r.id)}>
              <ArrowRight className="h-3 w-3 mr-1" /> Dept Handover
            </Button>
          );
        }
        return null;
      },
    },
  ];

  if (loading) return <LoadingSkeleton rows={6} />;
  if (error) return <ErrorCard message={error} onRetry={refresh} />;

  const records = data?.inductionRecords ?? [];

  return (
    <div>
      <TmsPageHeader
        title="Induction Workflow"
        description="HR conducts induction → handover to Department Head → TC prepares JD → TNI → SOP training"
        trail={[{ label: 'Company Program', href: '/training/company-program' }, { label: 'Induction' }]}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => refresh()} disabled={refreshing}>
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
            </Button>
            {canConductHrInduction && (
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4 mr-2" /> New Induction
              </Button>
            )}
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <KpiCard label="Active Inductions" value={data?.activeInductions ?? 0} tone="blue" />
        <KpiCard label="Pending Dept Handover" value={data?.pendingDeptHandover ?? 0} tone="amber" />
        <KpiCard label="Completed" value={records.filter((r) => r.status === 'Completed').length} tone="green" />
        <KpiCard label="Total Records" value={records.length} tone="blue" />
      </div>

      {/* Process Flow */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Induction Process Stages</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-2">
            {INDUCTION_STAGES.map((stage, i) => (
              <span key={stage} className="flex items-center gap-2">
                <Badge variant="secondary">{stage}</Badge>
                {i < INDUCTION_STAGES.length - 1 && <ArrowRight className="h-3 w-3 text-muted-foreground" />}
              </span>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Induction Records</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveDataTable columns={columns} data={records} />
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Employee Induction</DialogTitle></DialogHeader>
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
              <Label>Designation</Label>
              <Input value={form.designation}
                onChange={(e) => setForm({ ...form, designation: e.target.value })} />
            </div>
            <div>
              <Label>Department Head</Label>
              <Input value={form.dept_head_name}
                onChange={(e) => setForm({ ...form, dept_head_name: e.target.value })} />
            </div>
            <div>
              <Label>Joining Date</Label>
              <Input type="date" value={form.joining_date}
                onChange={(e) => setForm({ ...form, joining_date: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate}>Create Induction</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
