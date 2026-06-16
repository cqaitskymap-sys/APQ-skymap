'use client';

import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { CAPA_FISHBONE_CATEGORIES, type CapaFishboneAnalysis } from '@/lib/capa-types';

interface CapaFishboneSectionProps {
  value?: Partial<CapaFishboneAnalysis>;
  onChange: (next: CapaFishboneAnalysis) => void;
  disabled?: boolean;
}

export function CapaFishboneSection({ value, onChange, disabled }: CapaFishboneSectionProps) {
  const current: CapaFishboneAnalysis = {
    Man: value?.Man || '',
    Machine: value?.Machine || '',
    Method: value?.Method || '',
    Material: value?.Material || '',
    Measurement: value?.Measurement || '',
    Environment: value?.Environment || '',
  };

  const set = (key: keyof CapaFishboneAnalysis, v: string) => {
    onChange({ ...current, [key]: v });
  };

  return (
    <div className="space-y-4 rounded-lg border bg-muted/20 p-4">
      <div>
        <p className="text-sm font-medium">Fishbone (Ishikawa) Analysis</p>
        <p className="text-xs text-muted-foreground mt-1">Document potential causes across 6M categories.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {CAPA_FISHBONE_CATEGORIES.map((category) => (
          <div key={category} className="space-y-1">
            <Label className="text-xs text-muted-foreground">{category}</Label>
            <Textarea
              rows={2}
              disabled={disabled}
              value={current[category]}
              onChange={(e) => set(category, e.target.value)}
              placeholder={`${category} — potential causes`}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
