'use client';

import { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import type { RetrainingInput } from '@/lib/document-training-linkage-schemas';
import { RETRAINING_TRIGGERS } from '@/lib/document-training-linkage-types';

interface RetrainingWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentNumber?: string;
  linkId?: string;
  onSubmit: (input: RetrainingInput) => void;
}

export function RetrainingWizard({ open, onOpenChange, documentNumber, linkId, onSubmit }: RetrainingWizardProps) {
  const [trigger, setTrigger] = useState('Major Revision');
  const [dueDate, setDueDate] = useState('');
  const [reason, setReason] = useState('');

  const handleSubmit = () => {
    if (!linkId || !dueDate || !reason.trim()) return;
    onSubmit({ link_id: linkId, trigger: trigger as RetrainingInput['trigger'], due_date: dueDate, reason: reason.trim() });
    setReason(''); setDueDate('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Retraining Wizard — {documentNumber}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Retraining Trigger</Label>
            <Select value={trigger} onValueChange={setTrigger}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {RETRAINING_TRIGGERS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Due Date *</Label>
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
          <div>
            <Label>Reason *</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="Reason for retraining..." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!dueDate || !reason.trim()}>Create Retraining</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
