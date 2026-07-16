'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { TmsPageHeader } from '@/components/training/tms-page-header';
import { RoleActionFlow } from '@/components/training/workflow/workflow-diagram';
import { OTHER_TRAINING_WORKFLOW } from '@/lib/enterprise-tms/workflows';

export function OtherTrainingPage() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', details: '', attachment: '' });

  const handleCreate = () => {
    if (!form.name) return toast.error('Training name required');
    toast.success('Other Training Record Created');
    setOpen(false);
  };

  return (
    <div className="space-y-6">
      <TmsPageHeader
        title="Other Training Record"
        description="Manual training record for general, remedial, cGMP and other schedule types"
        trail={[{ label: 'Training Programs' }, { label: 'Other Training Record' }]}
        actions={
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> Create Record
          </Button>
        }
      />

      <RoleActionFlow
        role="Training Coordinator"
        steps={OTHER_TRAINING_WORKFLOW.steps.slice(0, 3).map((s) => s.label)}
        outcome="Other Training Record Created"
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Other Training Record</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>1. Add the Training Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <Label>2. Add Details about the session</Label>
              <Textarea value={form.details} onChange={(e) => setForm({ ...form, details: e.target.value })} />
            </div>
            <div>
              <Label>3. Add Attachments if required</Label>
              <Input type="file" onChange={(e) => setForm({ ...form, attachment: e.target.files?.[0]?.name ?? '' })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
