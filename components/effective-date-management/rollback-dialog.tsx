'use client';

import { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { RollbackInput } from '@/lib/effective-date-schemas';

interface RollbackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentNumber?: string;
  onRollback: (input: RollbackInput) => void;
}

export function RollbackDialog({ open, onOpenChange, documentNumber, onRollback }: RollbackDialogProps) {
  const [reason, setReason] = useState('');

  const handleSubmit = () => {
    if (!reason.trim()) return;
    onRollback({ reason: reason.trim() });
    setReason('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Rollback Activation</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">Rollback {documentNumber} within the configured rollback window.</p>
        <div>
          <Label>Reason *</Label>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="Reason for rollback..." />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="destructive" onClick={handleSubmit}>Rollback</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
