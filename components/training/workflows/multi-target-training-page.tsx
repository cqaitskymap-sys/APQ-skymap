'use client';

import { useState } from 'react';
import { Plus, Send, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { TmsPageHeader } from '@/components/training/tms-page-header';
import { WorkflowDiagram } from '@/components/training/workflow/workflow-diagram';
import { MULTI_TARGET_TRAINING_WORKFLOW, TARGET_TRAINING_TYPES } from '@/lib/enterprise-tms/workflows';

export function MultiTargetTrainingPage() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    target_type: 'General', multi_doc: true, document: '', session_date: '',
    trainees: '', approval_required: true, approver: '',
  });

  const handleSubmit = () => {
    if (!form.document || !form.session_date) return toast.error('Document and session date required');
    toast.success('Multi target training submitted');
    setOpen(false);
  };

  return (
    <div className="space-y-6">
      <TmsPageHeader
        title="Multi Target Training"
        description="Training Coordinator creates multi-document target training with optional approval"
        trail={[{ label: 'Training Programs' }, { label: 'Multi Target Training' }]}
        actions={
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> Create Multi Target Training
          </Button>
        }
      />

      <WorkflowDiagram workflow={MULTI_TARGET_TRAINING_WORKFLOW} activeStepId="3" />

      <Card>
        <CardContent className="pt-6 text-sm text-muted-foreground">
          Use Multi-Doc = Yes to assign training across multiple documents in a single action.
          After submit, trainees complete online training or trainer conducts classroom session with assessment.
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Multi Target Training</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Select Target Type</Label>
              <Select value={form.target_type} onValueChange={(v) => setForm({ ...form, target_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TARGET_TRAINING_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox checked={form.multi_doc} onCheckedChange={(v) => setForm({ ...form, multi_doc: !!v })} />
              <Label>Multi-Doc = Yes</Label>
            </div>
            <div>
              <Label>Add Document(s)</Label>
              <Input value={form.document} placeholder="SOP-001, SOP-002..."
                onChange={(e) => setForm({ ...form, document: e.target.value })} />
            </div>
            <div>
              <Label>Schedule Session</Label>
              <Input type="datetime-local" value={form.session_date}
                onChange={(e) => setForm({ ...form, session_date: e.target.value })} />
            </div>
            <div>
              <Label>Select Trainees</Label>
              <Input value={form.trainees} placeholder="Employee names or group"
                onChange={(e) => setForm({ ...form, trainees: e.target.value })} />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <Label>Approval Required?</Label>
              <Switch checked={form.approval_required}
                onCheckedChange={(v) => setForm({ ...form, approval_required: v })} />
            </div>
            {form.approval_required && (
              <div>
                <Label>Select Approver</Label>
                <Input value={form.approver} onChange={(e) => setForm({ ...form, approver: e.target.value })} />
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => toast.info('Reverted to Add Session')}><XCircle className="h-4 w-4 mr-1" /> Revert</Button>
            <Button variant="outline" onClick={() => toast.success('Approved')}><CheckCircle className="h-4 w-4 mr-1" /> Approve</Button>
            <Button onClick={handleSubmit}><Send className="h-4 w-4 mr-2" /> Submit</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
