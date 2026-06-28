'use client';

import { useState } from 'react';
import { ESignatureModal } from '@/components/shared/esignature-modal';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { DAW_MODULE } from '@/lib/document-approval-types';
import type { DocumentApprovalRecord } from '@/lib/document-approval-types';
import type { ApprovalCompleteInput } from '@/lib/document-approval-schemas';
import { APPROVAL_DECISIONS } from '@/lib/document-approval-types';
import type { EsignRecord } from '@/lib/admin/schemas';

interface ApprovalCompleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record: DocumentApprovalRecord | null;
  onComplete: (input: ApprovalCompleteInput) => void;
}

export function ApprovalCompleteDialog({ open, onOpenChange, record, onComplete }: ApprovalCompleteDialogProps) {
  const [comments, setComments] = useState('');
  const [decision, setDecision] = useState<ApprovalCompleteInput['decision']>('Approved');
  const [esignOpen, setEsignOpen] = useState(false);
  const needsEsign = record?.electronic_signature_required && decision.startsWith('Approved');

  const handleSubmit = () => {
    if (needsEsign) {
      setEsignOpen(true);
      return;
    }
    onComplete({ decision, comments });
    setComments('');
    onOpenChange(false);
  };

  const handleSigned = (esignRecord: EsignRecord) => {
    onComplete({ decision, comments, esign_record_id: esignRecord.esignRecordId || esignRecord.id });
    setComments('');
    setEsignOpen(false);
    onOpenChange(false);
  };

  return (
    <>
      <Dialog open={open && !esignOpen} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Complete Approval</DialogTitle>
          </DialogHeader>
          {record && (
            <p className="text-sm text-muted-foreground">
              {record.document_number} — {record.document_title} (Step {record.current_step}/{record.total_steps})
            </p>
          )}
          <div>
            <Label>Decision</Label>
            <select
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              value={decision}
              onChange={(e) => setDecision(e.target.value as ApprovalCompleteInput['decision'])}
            >
              {APPROVAL_DECISIONS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <Label>Comments</Label>
            <Textarea value={comments} onChange={(e) => setComments(e.target.value)} rows={3} placeholder="Approval comments..." />
          </div>
          {needsEsign && (
            <p className="text-xs text-indigo-700">Electronic signature required for this approval step.</p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleSubmit}>{needsEsign ? 'Sign & Approve' : 'Submit Decision'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {record && (
        <ESignatureModal
          open={esignOpen}
          onOpenChange={setEsignOpen}
          moduleName={DAW_MODULE}
          recordId={record.id}
          documentNumber={record.document_number}
          actionType="Approve"
          signatureMeaning="I approve this controlled document for release"
          onSuccess={handleSigned}
          onCancel={() => setEsignOpen(false)}
        />
      )}
    </>
  );
}
