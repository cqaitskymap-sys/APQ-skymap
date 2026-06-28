'use client';

import { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import type { ApproveImpactInput } from '@/lib/change-impact-assessment-schemas';
import type { DocumentChangeImpactRecord } from '@/lib/change-impact-assessment-types';

interface ElectronicSignatureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record: DocumentChangeImpactRecord | null;
  onApprove: (input: ApproveImpactInput) => void;
}

export function ElectronicSignatureDialog({ open, onOpenChange, record, onApprove }: ElectronicSignatureDialogProps) {
  const [meaning, setMeaning] = useState('');
  const [comments, setComments] = useState('');

  const handleSubmit = () => {
    if (record?.electronic_signature_required && !meaning) return;
    onApprove({ signature_meaning: meaning, comments: comments.trim() });
    setMeaning(''); setComments('');
    onOpenChange(false);
  };

  if (!record) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Approve Impact Assessment</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">{record.document_number} — {record.overall_impact_rating} impact</p>
        {record.electronic_signature_required && (
          <div>
            <Label>Electronic Signature Meaning *</Label>
            <Select value={meaning} onValueChange={setMeaning}>
              <SelectTrigger><SelectValue placeholder="Select meaning..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Reviewed and Approved">Reviewed and Approved</SelectItem>
                <SelectItem value="Impact Assessment Approved">Impact Assessment Approved</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
        <div>
          <Label>Comments</Label>
          <Textarea value={comments} onChange={(e) => setComments(e.target.value)} rows={2} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit}>Approve</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
