'use client';

import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import type { CpvReviewSectionRecord } from '@/lib/cpv-annual-review-records';

export function ReportSectionEditor({
  section,
  disabled,
  onChange,
}: {
  section: CpvReviewSectionRecord;
  disabled?: boolean;
  onChange: (content: string) => void;
}) {
  return (
    <div className="space-y-2 rounded-md border p-4">
      <Label className="text-sm font-semibold">{section.sectionTitle}</Label>
      <p className="text-xs text-muted-foreground">{section.summary}</p>
      <Textarea
        value={section.content}
        onChange={(e) => onChange(e.target.value)}
        rows={5}
        disabled={disabled}
        className="mt-2"
      />
    </div>
  );
}
