'use client';

import { useEffect, useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { LmsFieldMapping } from '@/lib/lms-types';

const DEFAULT_EQMS_FIELDS = [
  'employee_id', 'email', 'full_name', 'department', 'course_title',
  'course_code', 'completion_date', 'score', 'certificate_number',
];

const DEFAULT_LMS_FIELDS = [
  'user_id', 'email', 'full_name', 'department', 'title',
  'code', 'completed_at', 'score', 'cert_number',
];

interface FieldMappingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mappings: LmsFieldMapping[];
  onSave: (mappings: LmsFieldMapping[]) => Promise<void>;
}

export function FieldMappingDialog({ open, onOpenChange, mappings, onSave }: FieldMappingDialogProps) {
  const [local, setLocal] = useState<LmsFieldMapping[]>(
    mappings.length ? mappings : DEFAULT_EQMS_FIELDS.map((eqms, i) => ({
      eqmsField: eqms,
      lmsField: DEFAULT_LMS_FIELDS[i] ?? '',
    })),
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLocal(mappings.length ? mappings : DEFAULT_EQMS_FIELDS.map((eqms, index) => ({
      eqmsField: eqms,
      lmsField: DEFAULT_LMS_FIELDS[index] ?? '',
    })));
  }, [mappings, open]);

  const update = (index: number, field: keyof LmsFieldMapping, value: string) => {
    setLocal((prev) => prev.map((m, i) => i === index ? { ...m, [field]: value } : m));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Field Mapping</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 max-h-[400px] overflow-y-auto">
          {local.map((m, i) => (
            <div key={i} className="grid grid-cols-2 gap-2 items-end">
              <div>
                <Label className="text-xs">eQMS Field</Label>
                <Input value={m.eqmsField} onChange={(e) => update(i, 'eqmsField', e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">LMS Field</Label>
                <Input value={m.lmsField} onChange={(e) => update(i, 'lmsField', e.target.value)} />
              </div>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={saving} onClick={async () => {
            setSaving(true);
            try {
              await onSave(local);
              onOpenChange(false);
            } catch {
              // The parent reports the domain error and the dialog remains open for correction.
            } finally {
              setSaving(false);
            }
          }}>{saving ? 'Saving…' : 'Save Mappings'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
