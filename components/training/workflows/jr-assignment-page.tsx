'use client';

import { useCallback, useState } from 'react';
import { RefreshCw, Plus, Send, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { ResponsiveDataTable } from '@/components/cpv/product-master/responsive-data-table';
import type { ColumnDef } from '@/components/admin/admin-data-table';
import { TmsPageHeader } from '@/components/training/tms-page-header';
import { TmsStatusBadge } from '@/components/training/tms-sub-nav';
import { WorkflowDiagram } from '@/components/training/workflow/workflow-diagram';
import { JR_ASSIGNMENT_WORKFLOW } from '@/lib/enterprise-tms/workflows';
import { useCompanyTraining } from '@/hooks/use-company-training';
import { listJobDescriptions, createTniFromJd, approveTni } from '@/lib/company-training-service';
import { TMS_DEPARTMENTS } from '@/lib/training-types';
import type { JobDescription, TniRecord } from '@/lib/company-training-types';

export function JrAssignmentPage() {
  const { data, loading, error, refresh, refreshing, actor, canManageTni } = useCompanyTraining();
  const [jds, setJds] = useState<JobDescription[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    employee_name: '', department: 'Production', jr_template: '',
    jr_training_required: true, approver: '', comments: '',
  });

  const loadJds = useCallback(async () => {
    setJds(await listJobDescriptions());
  }, []);

  const handleOpenCreate = () => {
    loadJds();
    setCreateOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.employee_name || !form.jr_template) {
      return toast.error('Employee and JR template required');
    }
    const jd = jds.find((j) => j.id === form.jr_template);
    if (!jd) return toast.error('Select valid JR template');
    try {
      await createTniFromJd(actor, jd);
      toast.success('JR sent for approval');
      setCreateOpen(false);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  };

  const handleApprove = async (id: string, approved: boolean) => {
    if (!approved) return toast.info('Reverted to Training Coordinator for revision');
    try {
      await approveTni(actor, id);
      toast.success('JR approved — sent to employee for acceptance');
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  };

  const handleEmployeeAccept = (accepted: boolean) => {
    toast.success(accepted ? 'JR accepted — BU/dept training auto-assigned per matrix' : 'Reverted to Training Coordinator');
  };

  const tniColumns: ColumnDef<TniRecord>[] = [
    { key: 'num', header: 'JR #', render: (r) => r.tni_number },
    { key: 'jd', header: 'JD / JR Template', render: (r) => r.jd_number },
    { key: 'emp', header: 'Employee', render: (r) => r.employee_name || '—' },
    { key: 'dept', header: 'Department', render: (r) => r.department },
    { key: 'roles', header: 'Functional Roles', render: (r) => r.training_needs.length },
    { key: 'status', header: 'Status', render: (r) => <TmsStatusBadge status={r.status} /> },
    {
      key: 'actions', header: 'Workflow Action',
      render: (r) => {
        if (r.status === 'Pending Review' && canManageTni) {
          return (
            <div className="flex gap-1">
              <Button size="sm" variant="outline" onClick={() => handleApprove(r.id, true)}>
                <CheckCircle className="h-3 w-3 mr-1" /> Approve
              </Button>
              <Button size="sm" variant="ghost" onClick={() => handleApprove(r.id, false)}>
                <XCircle className="h-3 w-3 mr-1" /> Revert
              </Button>
            </div>
          );
        }
        if (r.status === 'Approved') {
          return (
            <div className="flex gap-1">
              <Button size="sm" variant="outline" onClick={() => handleEmployeeAccept(true)}>Accept</Button>
              <Button size="sm" variant="ghost" onClick={() => handleEmployeeAccept(false)}>Revert</Button>
            </div>
          );
        }
        return null;
      },
    },
  ];

  if (loading) return <LoadingSkeleton rows={6} />;
  if (error) return <ErrorCard message={error} onRetry={refresh} />;

  const records = data?.tniRecords ?? [];

  return (
    <div className="space-y-6">
      <TmsPageHeader
        title="JR Assignment"
        description="Training Coordinator assigns Job Role — approver review — employee acceptance — auto BU/dept training"
        trail={[{ label: 'Training Programs' }, { label: 'JR Assignment' }]}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => refresh()} disabled={refreshing}>
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
            </Button>
            {canManageTni && (
              <Button size="sm" onClick={handleOpenCreate}>
                <Plus className="h-4 w-4 mr-2" /> New JR Assignment
              </Button>
            )}
          </div>
        }
      />

      <WorkflowDiagram workflow={JR_ASSIGNMENT_WORKFLOW} activeStepId="2" />

      <Card>
        <CardHeader><CardTitle className="text-base">JR Assignment Records</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveDataTable columns={tniColumns} data={records} />
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>New JR Assignment</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>1. Select Employee</Label>
              <Input value={form.employee_name} placeholder="Employee who completed induction"
                onChange={(e) => setForm({ ...form, employee_name: e.target.value })} />
            </div>
            <div>
              <Label>2. Select JR from Template</Label>
              <Select value={form.jr_template} onValueChange={(v) => setForm({ ...form, jr_template: v })}>
                <SelectTrigger><SelectValue placeholder="Choose JD/JR template" /></SelectTrigger>
                <SelectContent>
                  {jds.map((j) => (
                    <SelectItem key={j.id} value={j.id}>{j.jd_number} — {j.role_title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
            <div className="flex items-center justify-between rounded-lg border p-3">
              <Label>3. Is JR Training Required?</Label>
              <Switch checked={form.jr_training_required}
                onCheckedChange={(v) => setForm({ ...form, jr_training_required: v })} />
            </div>
            <div>
              <Label>4. Select Approver</Label>
              <Input value={form.approver} placeholder="Approver name"
                onChange={(e) => setForm({ ...form, approver: e.target.value })} />
            </div>
            <div>
              <Label>Comments</Label>
              <Textarea value={form.comments} onChange={(e) => setForm({ ...form, comments: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit}><Send className="h-4 w-4 mr-2" /> Send for Approval</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
