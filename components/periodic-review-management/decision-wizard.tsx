'use client';

import { useState, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { ReviewChecklist } from './prm-ui';
import type { CompleteReviewInput } from '@/lib/periodic-review-schemas';
import type { PeriodicReviewRecord } from '@/lib/periodic-review-types';
import { PERIODIC_REVIEW_DECISIONS } from '@/lib/periodic-review-types';

interface DecisionWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record: PeriodicReviewRecord | null;
  onComplete: (input: CompleteReviewInput) => void;
}

export function DecisionWizard({ open, onOpenChange, record, onComplete }: DecisionWizardProps) {
  const [decision, setDecision] = useState('');
  const [outcome, setOutcome] = useState('');
  const [comments, setComments] = useState('');
  const [checklist, setChecklist] = useState(record?.review_checklist || []);
  const [flags, setFlags] = useState({
    revision_required: false,
    change_control_required: false,
    risk_assessment_required: false,
    capa_required: false,
    training_impact: false,
    electronic_signature_required: false,
  });
  const [signatureMeaning, setSignatureMeaning] = useState('');

  useEffect(() => {
    if (record) {
      setChecklist(record.review_checklist || []);
      setDecision(''); setOutcome(''); setComments('');
      setFlags({
        revision_required: false, change_control_required: false,
        risk_assessment_required: false, capa_required: false,
        training_impact: false, electronic_signature_required: false,
      });
      setSignatureMeaning('');
    }
  }, [record]);

  const handleDecisionChange = (d: string) => {
    setDecision(d);
    setFlags((f) => ({
      ...f,
      revision_required: ['Minor Revision', 'Major Revision'].includes(d),
      change_control_required: ['Minor Revision', 'Major Revision', 'Replace Document'].includes(d),
      training_impact: d === 'Major Revision',
    }));
  };

  const handleSubmit = () => {
    if (!decision || !outcome.trim()) return;
    onComplete({
      decision: decision as CompleteReviewInput['decision'],
      outcome: outcome.trim(),
      review_comments: comments.trim(),
      review_checklist: checklist,
      ...flags,
      signature_meaning: signatureMeaning,
    });
    setDecision(''); setOutcome(''); setComments('');
    onOpenChange(false);
  };

  if (!record) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Review Decision — {record.document_number}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">Complete periodic review and record decision for GMP compliance.</p>

        <div className="space-y-4">
          <div>
            <Label>Decision *</Label>
            <Select value={decision} onValueChange={handleDecisionChange}>
              <SelectTrigger><SelectValue placeholder="Select decision..." /></SelectTrigger>
              <SelectContent>
                {PERIODIC_REVIEW_DECISIONS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Outcome Summary *</Label>
            <Textarea value={outcome} onChange={(e) => setOutcome(e.target.value)} rows={2} placeholder="Summary of review findings..." />
          </div>

          <div>
            <Label>Review Checklist</Label>
            <ReviewChecklist
              items={checklist}
              onToggle={(id) => setChecklist((items) => items.map((i) => i.id === id ? { ...i, checked: !i.checked } : i))}
            />
          </div>

          <div className="grid grid-cols-2 gap-2 text-sm">
            {[
              ['change_control_required', 'Change Control Required'],
              ['risk_assessment_required', 'Risk Assessment Required'],
              ['capa_required', 'CAPA Required'],
              ['training_impact', 'Training Impact'],
              ['electronic_signature_required', 'E-Signature Required'],
            ].map(([key, label]) => (
              <label key={key} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={flags[key as keyof typeof flags]}
                  onChange={(e) => setFlags((f) => ({ ...f, [key]: e.target.checked }))}
                  className="rounded"
                />
                {label}
              </label>
            ))}
          </div>

          {flags.electronic_signature_required && (
            <div>
              <Label>Signature Meaning *</Label>
              <Select value={signatureMeaning} onValueChange={setSignatureMeaning}>
                <SelectTrigger><SelectValue placeholder="Select meaning..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Reviewed and Approved">Reviewed and Approved</SelectItem>
                  <SelectItem value="Reviewed and Accepted">Reviewed and Accepted</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <Label>Comments</Label>
            <Textarea value={comments} onChange={(e) => setComments(e.target.value)} rows={2} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!decision || !outcome.trim()}>Complete Review</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
