'use client';

import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

interface FiveWhyWorksheetProps {
  value?: { why1?: string; why2?: string; why3?: string; why4?: string; why5?: string; rootCause?: string };
  onChange: (next: FiveWhyWorksheetProps['value']) => void;
  disabled?: boolean;
}

export function FiveWhyWorksheet({ value, onChange, disabled }: FiveWhyWorksheetProps) {
  const set = (key: keyof NonNullable<FiveWhyWorksheetProps['value']>, v: string) => {
    onChange({ ...value, [key]: v });
  };

  return (
    <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
      <p className="text-sm font-medium">5 Why Worksheet</p>
      {[1, 2, 3, 4, 5].map((n) => (
        <div key={n} className="space-y-1">
          <Label className="text-xs text-muted-foreground">Why {n}?</Label>
          <Textarea
            rows={2}
            disabled={disabled}
            value={value?.[`why${n}` as 'why1'] || ''}
            onChange={(e) => set(`why${n}` as 'why1', e.target.value)}
            placeholder={`Why did this occur (level ${n})?`}
          />
        </div>
      ))}
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Identified Root Cause</Label>
        <Input
          disabled={disabled}
          value={value?.rootCause || ''}
          onChange={(e) => set('rootCause', e.target.value)}
          placeholder="Root cause from 5 Why analysis"
        />
      </div>
    </div>
  );
}
