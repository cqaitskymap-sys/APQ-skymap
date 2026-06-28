'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { DISPOSAL_METHODS } from '@/lib/retention-disposal-types';
import type { CreateDisposalRequestInput } from '@/lib/retention-disposal-schemas';
import type { RetentionScheduleRecord } from '@/lib/retention-disposal-types';

interface DisposalRequestDialogProps {
  schedule: RetentionScheduleRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: CreateDisposalRequestInput) => Promise<void>;
}

export function DisposalRequestDialog({ schedule, open, onOpenChange, onSubmit }: DisposalRequestDialogProps) {
  const [method, setMethod] = useState<string>(DISPOSAL_METHODS[0]);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!schedule) return;
    setLoading(true);
    try {
      await onSubmit({
        schedule_id: schedule.id,
        disposal_method: method as CreateDisposalRequestInput['disposal_method'],
        disposal_reason: reason,
        electronic_signature_required: true,
      });
      setReason('');
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request Disposal{schedule && ` — ${schedule.document_number}`}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Disposal Method *</Label>
            <select className="w-full rounded-md border bg-background px-3 py-2 text-sm" value={method} onChange={(e) => setMethod(e.target.value)}>
              {DISPOSAL_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <Label>Disposal Reason *</Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Justification for disposal..." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="destructive" onClick={() => void handleSubmit()} disabled={loading || reason.length < 10}>
            {loading ? 'Submitting...' : 'Submit Disposal Request'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
