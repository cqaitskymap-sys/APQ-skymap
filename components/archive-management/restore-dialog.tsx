'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import type { RestoreRequestInput, ApproveRestoreInput } from '@/lib/archive-management-schemas';
import type { ArchiveRecord } from '@/lib/archive-management-types';

interface RestoreDialogProps {
  record: ArchiveRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'request' | 'approve';
  onSubmit: (input: RestoreRequestInput | ApproveRestoreInput) => Promise<void>;
}

export function RestoreDialog({ record, open, onOpenChange, mode, onSubmit }: RestoreDialogProps) {
  const [reason, setReason] = useState('');
  const [signature, setSignature] = useState('');
  const [comments, setComments] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      if (mode === 'request') {
        await onSubmit({ restoration_reason: reason });
      } else {
        await onSubmit({ signature_meaning: signature, comments });
      }
      setReason(''); setSignature(''); setComments('');
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === 'request' ? 'Request Restoration' : 'Approve Restoration'}
            {record && ` — ${record.document_number}`}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {mode === 'request' ? (
            <div className="space-y-2">
              <Label>Restoration Reason *</Label>
              <Input value={reason} onChange={(e) => setReason(e.target.value)}
                placeholder="Justification for restoring archived document..." />
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label>Electronic Signature Meaning</Label>
                <Input value={signature} onChange={(e) => setSignature(e.target.value)}
                  placeholder="I approve restoration of this archived document" />
              </div>
              <div className="space-y-2">
                <Label>Comments</Label>
                <Input value={comments} onChange={(e) => setComments(e.target.value)} />
              </div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => void handleSubmit()} disabled={loading || (mode === 'request' && reason.length < 10)}>
            {loading ? 'Processing...' : mode === 'request' ? 'Submit Request' : 'Approve Restoration'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
