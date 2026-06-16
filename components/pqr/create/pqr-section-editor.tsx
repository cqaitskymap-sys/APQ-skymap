'use client';

import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import type { PqrSectionRecord } from '@/lib/pqr-create-records';

export function PqrSectionEditor({
  sections,
  onChange,
  readOnly = false,
}: {
  sections: PqrSectionRecord[];
  onChange: (sectionId: string, narrative: string) => void;
  readOnly?: boolean;
}) {
  if (!sections.length) {
    return <p className="text-sm text-muted-foreground">No sections generated yet.</p>;
  }

  return (
    <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
      {sections.map((section) => (
        <div key={section.id || section.sectionKey} className="rounded-lg border bg-white p-4 shadow-sm">
          <Label className="text-sm font-semibold">
            {section.sectionOrder}. {section.sectionTitle}
          </Label>
          <Textarea
            className="mt-2 min-h-[80px] text-sm"
            value={section.narrative}
            readOnly={readOnly}
            onChange={(e) => section.id && onChange(section.id, e.target.value)}
          />
        </div>
      ))}
    </div>
  );
}
