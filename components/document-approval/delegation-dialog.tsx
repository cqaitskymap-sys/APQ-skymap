'use client';

import { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { ApprovalDelegateInput } from '@/lib/document-approval-schemas';

interface DelegationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDelegate: (input: ApprovalDelegateInput) => void;
}

export function DelegationDialog({ open, onOpenChange, onDelegate }: DelegationDialogProps) {
  const [delegateId, setDelegateId] = useState('');
  const [delegateName, setDelegateName] = useState('');
  const [reason, setReason] = useState('');

  const handleSubmit = () => {
    if (!delegateId.trim() || !delegateName.trim() || !reason.trim()) return;
    onDelegate({ delegate_to_id: delegateId.trim(), delegate_to_name: delegateName.trim(), reason: reason.trim() });
    setDelegateId(''); setDelegateName(''); setReason('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Delegate Approval</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Delegate User ID</Label>
            <Input value={delegateId} onChange={(e) => setDelegateId(e.target.value)} placeholder="Firebase UID" />
          </div>
          <div>
            <Label>Delegate Name</Label>
            <Input value={delegateName} onChange={(e) => setDelegateName(e.target.value)} placeholder="Full name" />
          </div>
          <div>
            <Label>Reason</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="Delegation reason..." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit}>Delegate</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
