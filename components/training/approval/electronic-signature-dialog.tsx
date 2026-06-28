'use client';

import { useState } from 'react';
import { ESignatureModal } from '@/components/shared/esignature-modal';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { TRAINING_APPROVAL_MODULE } from '@/lib/training-approval-types';
import type { EsignRecord } from '@/lib/admin/schemas';

interface ElectronicSignatureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requestId: string;
  referenceNumber: string;
  onSigned: (esignRecord: EsignRecord, comments: string) => void;
}

export function ElectronicSignatureDialog({
  open, onOpenChange, requestId, referenceNumber, onSigned,
}: ElectronicSignatureDialogProps) {
  const [comments, setComments] = useState('');
  const [esignOpen, setEsignOpen] = useState(false);

  return (
    <>
      <Dialog open={open && !esignOpen} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Electronic Signature Required</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            21 CFR Part 11 compliant electronic signature required for approving {referenceNumber}.
          </p>
          <div>
            <Label>Approval Comments</Label>
            <Textarea value={comments} onChange={(e) => setComments(e.target.value)} rows={3} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={() => setEsignOpen(true)}>Sign Electronically</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ESignatureModal
        open={esignOpen}
        onOpenChange={setEsignOpen}
        moduleName={TRAINING_APPROVAL_MODULE}
        recordId={requestId}
        documentNumber={referenceNumber}
        actionType="Approve"
        signatureMeaning="I approve this training workflow action"
        onSuccess={(record) => {
          setEsignOpen(false);
          onOpenChange(false);
          onSigned(record, comments);
          setComments('');
        }}
        onCancel={() => setEsignOpen(false)}
      />
    </>
  );
}
