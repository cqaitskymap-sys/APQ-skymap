'use client';

import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import type { CapaFiveWhyAnalysis } from '@/lib/capa-types';

interface CapaFiveWhyWorksheetProps {
  value?: Partial<CapaFiveWhyAnalysis>;
  onChange: (next: CapaFiveWhyAnalysis) => void;
  disabled?: boolean;
}

export function CapaFiveWhyWorksheet({ value, onChange, disabled }: CapaFiveWhyWorksheetProps) {
  const current: CapaFiveWhyAnalysis = {
    why1: value?.why1 || '',
    why2: value?.why2 || '',
    why3: value?.why3 || '',
    why4: value?.why4 || '',
    why5: value?.why5 || '',
    final_root_cause: value?.final_root_cause || '',
  };

  const set = (key: keyof CapaFiveWhyAnalysis, v: string) => {
    onChange({ ...current, [key]: v });
  };

  return (
    <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
      <p className="text-sm font-medium">5 Why Analysis Worksheet</p>
      {[1, 2, 3, 4, 5].map((n) => (
        <div key={n} className="space-y-1">
          <Label className="text-xs text-muted-foreground">Why {n}</Label>
          <Textarea
            rows={2}
            disabled={disabled}
            value={current[`why${n}` as keyof CapaFiveWhyAnalysis] as string}
            onChange={(e) => set(`why${n}` as keyof CapaFiveWhyAnalysis, e.target.value)}
            placeholder={`Document why level ${n} occurred`}
          />
        </div>
      ))}
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Final Root Cause</Label>
        <Input
          disabled={disabled}
          value={current.final_root_cause}
          onChange={(e) => set('final_root_cause', e.target.value)}
          placeholder="Identified root cause from 5 Why analysis"
        />
      </div>
    </div>
  );
}
