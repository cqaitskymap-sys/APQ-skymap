'use client';

import { IMPACT_OPTION_VALUES } from '@/lib/deviation-types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

interface ImpactChecklistCardProps {
  label: string;
  value: string;
  details?: string;
  detailsField?: string;
  onValueChange: (v: string) => void;
  onDetailsChange?: (v: string) => void;
  disabled?: boolean;
  highlight?: boolean;
}

export function ImpactChecklistCard({
  label, value, details, onValueChange, onDetailsChange, disabled, highlight,
}: ImpactChecklistCardProps) {
  const isYes = value === 'Yes';
  return (
    <Card className={highlight || isYes ? 'border-amber-300 bg-amber-50/30' : undefined}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center justify-between gap-2">
          {label}
          <Select value={value} onValueChange={onValueChange} disabled={disabled}>
            <SelectTrigger className="h-8 w-[160px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {IMPACT_OPTION_VALUES.map((o) => (
                <SelectItem key={o} value={o}>{o}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardTitle>
      </CardHeader>
      {(isYes || details) && onDetailsChange && (
        <CardContent className="pt-0">
          <Label className="text-xs text-muted-foreground">Details / Justification</Label>
          <Textarea
            rows={2}
            value={details || ''}
            disabled={disabled}
            onChange={(e) => onDetailsChange(e.target.value)}
            className="mt-1 text-sm"
            placeholder={`Describe ${label.toLowerCase()}...`}
          />
        </CardContent>
      )}
    </Card>
  );
}
