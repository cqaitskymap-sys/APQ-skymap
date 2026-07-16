'use client';

import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Plus, AlertTriangle, UserMinus, RotateCcw, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { ResponsiveDataTable } from '@/components/cpv/product-master/responsive-data-table';
import type { ColumnDef } from '@/components/admin/admin-data-table';
import { TmsPageHeader } from '@/components/training/tms-page-header';
import { TmsStatusBadge } from '@/components/training/tms-sub-nav';
import { WorkflowDiagram, RoleActionFlow } from '@/components/training/workflow/workflow-diagram';
import {
  TARGET_TRAINING_WORKFLOW, UNSATISFACTORY_WORKFLOW, WAIVE_TRAINEE_WORKFLOW,
  TARGET_TRAINING_REASSIGN_WORKFLOW, TARGET_TRAINING_CLOSE_WORKFLOW, TARGET_TRAINING_TYPES,
} from '@/lib/enterprise-tms/workflows';
import { useEnterpriseTms } from '@/hooks/use-enterprise-tms';
import { createNeedBasedTraining, type NeedBasedTrainingRecord } from '@/lib/enterprise-tms';

export function TargetTrainingPage() {
  const { actor, listNeedBasedTraining } = useEnterpriseTms();
  const [records, setRecords] = useState<NeedBasedTrainingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [waiveOpen, setWaiveOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [form, setForm] = useState({ type: 'General', document: '', trainees: '', due_date: '' });
  const [waiveForm, setWaiveForm] = useState({ training: '', comments: '' });

  const load = useCallback(async () => {
    setRecords(await listNeedBasedTraining());
    setLoading(false);
  }, [listNeedBasedTraining]);

  useEffect(() => { load(); }, [load]);

  const handleSchedule = async () => {
    await createNeedBasedTraining(actor, form.type, `DOC-${Date.now()}`, form.document, actor.department ?? 'QA', form.type, form.document);
    toast.success('Target training schedule created');
    setScheduleOpen(false);
    await load();
  };

  const columns: ColumnDef<NeedBasedTrainingRecord>[] = [
    { key: 'num', header: 'Schedule #', render: (r) => r.record_number },
    { key: 'type', header: 'Type', render: (r) => <Badge variant="outline">{r.trigger_source}</Badge> },
    { key: 'topic', header: 'Document / Topic', render: (r) => r.training_topic },
    { key: 'dept', header: 'Department', render: (r) => r.department },
    { key: 'due', header: 'Due', render: (r) => r.due_date },
    { key: 'status', header: 'Status', render: (r) => <TmsStatusBadge status={r.status} /> },
  ];

  const unsatisfactory = records.filter((r) => r.trigger_source.includes('Unsatisfactory') || r.trigger_source === 'Failed Assessment');

  return (
    <div className="space-y-6">
      <TmsPageHeader
        title="Target Training"
        description="Document training schedules — remedial, waive off, reassignment, close request"
        trail={[{ label: 'Training Programs' }, { label: 'Target Training' }]}
        actions={
          <Button variant="outline" size="sm" onClick={() => load()}>
            <RefreshCw className="h-4 w-4 mr-2" /> Refresh
          </Button>
        }
      />

      <WorkflowDiagram workflow={TARGET_TRAINING_WORKFLOW} activeStepId="1" compact />

      <Tabs defaultValue="schedules">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="schedules">Create Schedule</TabsTrigger>
          <TabsTrigger value="unsatisfactory"><AlertTriangle className="h-3 w-3 mr-1" /> Unsatisfactory List</TabsTrigger>
          <TabsTrigger value="waive"><UserMinus className="h-3 w-3 mr-1" /> Waive Off Trainee</TabsTrigger>
          <TabsTrigger value="reassign"><RotateCcw className="h-3 w-3 mr-1" /> Reassign</TabsTrigger>
          <TabsTrigger value="close"><XCircle className="h-3 w-3 mr-1" /> Close Request</TabsTrigger>
        </TabsList>

        <TabsContent value="schedules" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setScheduleOpen(true)}>
              <Plus className="h-4 w-4 mr-2" /> Create Schedule
            </Button>
          </div>
          <Card>
            <CardContent className="pt-6">
              {loading ? 'Loading...' : <ResponsiveDataTable columns={columns} data={records} />}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="unsatisfactory" className="mt-4 space-y-4">
          <WorkflowDiagram workflow={UNSATISFACTORY_WORKFLOW} activeStepId="3" compact />
          <Card>
            <CardHeader><CardTitle className="text-sm">Unsatisfactory Employee List (Target Training Menu)</CardTitle></CardHeader>
            <CardContent>
              {unsatisfactory.length > 0 ? (
                <ResponsiveDataTable columns={columns} data={unsatisfactory} />
              ) : (
                <p className="text-sm text-muted-foreground">No unsatisfactory evaluations pending remedial schedule.</p>
              )}
              <Button size="sm" className="mt-4" onClick={() => toast.success('Remedial schedule created')}>
                Create Schedule
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="waive" className="mt-4 space-y-4">
          <RoleActionFlow
            role="Training Coordinator"
            steps={WAIVE_TRAINEE_WORKFLOW.steps.slice(0, 2).map((s) => s.label)}
            outcome="Trainee Removed"
          />
          <Button size="sm" onClick={() => setWaiveOpen(true)}>Waive Off / Remove Trainee</Button>
        </TabsContent>

        <TabsContent value="reassign" className="mt-4 space-y-4">
          <WorkflowDiagram workflow={TARGET_TRAINING_REASSIGN_WORKFLOW} compact />
          <Card>
            <CardContent className="pt-6 text-sm text-muted-foreground">
              Trainee selects trained document → adds comments → optional approver → training reassigned.
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="close" className="mt-4 space-y-4">
          <WorkflowDiagram workflow={TARGET_TRAINING_CLOSE_WORKFLOW} compact />
          <Button size="sm" variant="outline" onClick={() => setCloseOpen(true)}>Raise Close Request</Button>
        </TabsContent>
      </Tabs>

      <Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Target Training Schedule</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Training Type</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TARGET_TRAINING_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Document(s)</Label>
              <Input value={form.document} onChange={(e) => setForm({ ...form, document: e.target.value })} />
            </div>
            <div>
              <Label>Trainees</Label>
              <Input value={form.trainees} onChange={(e) => setForm({ ...form, trainees: e.target.value })} />
            </div>
            <div>
              <Label>Due Date</Label>
              <Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setScheduleOpen(false)}>Cancel</Button>
            <Button onClick={handleSchedule}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={waiveOpen} onOpenChange={setWaiveOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Waive Off / Remove Trainee</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Select Target Training</Label>
              <Input value={waiveForm.training} onChange={(e) => setWaiveForm({ ...waiveForm, training: e.target.value })} />
            </div>
            <div>
              <Label>Comments / Justification *</Label>
              <Textarea value={waiveForm.comments} onChange={(e) => setWaiveForm({ ...waiveForm, comments: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => { toast.success('Trainee removed'); setWaiveOpen(false); }}>Remove Trainee</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={closeOpen} onOpenChange={setCloseOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Close Target Training</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Training Coordinator raises request → Approver Approve (closed) or Reject (continues)</p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { toast.info('Target Training Continues'); setCloseOpen(false); }}>Reject</Button>
            <Button onClick={() => { toast.success('Target Training Closed'); setCloseOpen(false); }}>Approve Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
