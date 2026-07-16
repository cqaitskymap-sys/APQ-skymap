'use client';

import { useState } from 'react';
import { Plus, Send, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { TmsPageHeader } from '@/components/training/tms-page-header';
import { WorkflowDiagram } from '@/components/training/workflow/workflow-diagram';
import { JR_TRAINING_SCHEDULE_WORKFLOW } from '@/lib/enterprise-tms/workflows';
import { TrainingAssignmentPage } from '@/components/training/assignment/training-assignment-page';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export function JrTrainingSchedulePage() {
  const [wizardOpen, setWizardOpen] = useState(false);
  const [form, setForm] = useState({
    employee: '', functional_roles: '', due_date: '',
    mode: 'Online' as 'Online' | 'Classroom',
    mandatory: true, approval_required: true, approver: '',
  });

  const handleAssign = () => {
    if (!form.employee || !form.functional_roles || !form.due_date) {
      return toast.error('Employee, functional role(s) and due date required');
    }
    toast.success('JR trainings assigned');
    setWizardOpen(false);
  };

  return (
    <div className="space-y-6">
      <TmsPageHeader
        title="JR Training Schedule"
        description="For employees who accepted JR — select functional roles, due date, mode, mandatory status, optional approval"
        trail={[{ label: 'Training Programs' }, { label: 'JR Training Schedule' }]}
        actions={
          <Button size="sm" onClick={() => setWizardOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> Schedule JR Training
          </Button>
        }
      />

      <WorkflowDiagram workflow={JR_TRAINING_SCHEDULE_WORKFLOW} activeStepId="2" />

      <Tabs defaultValue="schedule">
        <TabsList>
          <TabsTrigger value="schedule">Schedule & Assignments</TabsTrigger>
          <TabsTrigger value="pending">Pending Approval</TabsTrigger>
        </TabsList>
        <TabsContent value="schedule" className="mt-4">
          <TrainingAssignmentPage defaultTab="scheduling" hideHeader />
        </TabsContent>
        <TabsContent value="pending" className="mt-4">
          <Card>
            <CardContent className="pt-6 text-sm text-muted-foreground">
              Schedules awaiting approver decision appear here after &quot;Is Approval Required? = Yes&quot;.
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={wizardOpen} onOpenChange={setWizardOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>JR Training Schedule</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Select Employee (Accepted JR)</Label>
              <Input value={form.employee} onChange={(e) => setForm({ ...form, employee: e.target.value })} />
            </div>
            <div>
              <Label>Select Functional Role(s)</Label>
              <Input value={form.functional_roles} placeholder="e.g. Production Operator, QA Reviewer"
                onChange={(e) => setForm({ ...form, functional_roles: e.target.value })} />
            </div>
            <div>
              <Label>Add Due Date</Label>
              <Input type="date" value={form.due_date}
                onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
            </div>
            <div>
              <Label>Training Mode</Label>
              <Select value={form.mode} onValueChange={(v) => setForm({ ...form, mode: v as 'Online' | 'Classroom' })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Online">Online</SelectItem>
                  <SelectItem value="Classroom">Classroom</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <Label>Mandatory</Label>
              <Switch checked={form.mandatory} onCheckedChange={(v) => setForm({ ...form, mandatory: v })} />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <Label>Is Approval Required?</Label>
              <Switch checked={form.approval_required} onCheckedChange={(v) => setForm({ ...form, approval_required: v })} />
            </div>
            {form.approval_required && (
              <div>
                <Label>Select Approver</Label>
                <Input value={form.approver} onChange={(e) => setForm({ ...form, approver: e.target.value })} />
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => toast.info('Reverted for correction')}>
              <XCircle className="h-4 w-4 mr-1" /> Revert
            </Button>
            <Button variant="outline" onClick={() => toast.success('Approved')}>
              <CheckCircle className="h-4 w-4 mr-1" /> Approve
            </Button>
            <Button onClick={handleAssign}><Send className="h-4 w-4 mr-2" /> Assign Trainings</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
