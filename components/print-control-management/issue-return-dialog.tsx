'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import type { PrintCopyRecord } from '@/lib/print-control-types';

type DialogMode = 'issue' | 'return' | 'reconcile' | 'destroy';

interface IssueReturnDialogProps {
  copy: PrintCopyRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: DialogMode;
  onSubmit: (data: { issued_to?: string; issued_to_name?: string; return_notes?: string; notes?: string; reason?: string }) => Promise<void>;
}

export function IssueReturnDialog({ copy, open, onOpenChange, mode, onSubmit }: IssueReturnDialogProps) {
  const [issuedTo, setIssuedTo] = useState('');
  const [issuedToName, setIssuedToName] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      if (mode === 'issue') {
        await onSubmit({ issued_to: issuedTo, issued_to_name: issuedToName });
      } else if (mode === 'return') {
        await onSubmit({ return_notes: notes });
      } else if (mode === 'reconcile') {
        await onSubmit({ notes });
      } else {
        await onSubmit({ reason: notes });
      }
      setIssuedTo(''); setIssuedToName(''); setNotes('');
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  const titles: Record<DialogMode, string> = {
    issue: 'Issue Copy',
    return: 'Return Copy',
    reconcile: 'Reconcile Copy',
    destroy: 'Destroy Copy',
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{titles[mode]}{copy && ` — ${copy.controlled_copy_number}`}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {mode === 'issue' ? (
            <>
              <div className="space-y-2">
                <Label>Issued To (User ID)</Label>
                <Input value={issuedTo} onChange={(e) => setIssuedTo(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Issued To (Name) *</Label>
                <Input value={issuedToName} onChange={(e) => setIssuedToName(e.target.value)} />
              </div>
            </>
          ) : (
            <div className="space-y-2">
              <Label>{mode === 'destroy' ? 'Destruction Reason *' : 'Notes'}</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            variant={mode === 'destroy' ? 'destructive' : 'default'}
            onClick={() => void handleSubmit()}
            disabled={loading || (mode === 'issue' && !issuedToName) || (mode === 'destroy' && notes.length < 5)}
          >
            {loading ? 'Processing...' : titles[mode]}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
