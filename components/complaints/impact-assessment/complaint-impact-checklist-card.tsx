'use client';

import { COMPLAINT_IMPACT_OPTIONS } from '@/lib/complaint-types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface ComplaintImpactChecklistCardProps {
  label: string;
  value: string;
  onValueChange: (v: string) => void;
  disabled?: boolean;
  highlight?: boolean;
}

export function ComplaintImpactChecklistCard({
  label, value, onValueChange, disabled, highlight,
}: ComplaintImpactChecklistCardProps) {
  const isYes = value === 'Yes';
  return (
    <Card className={highlight || isYes ? 'border-amber-300 bg-amber-50/30 dark:bg-amber-950/20' : undefined}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <span>{label}</span>
          <Select value={value} onValueChange={onValueChange} disabled={disabled}>
            <SelectTrigger className="h-8 w-full sm:w-[160px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COMPLAINT_IMPACT_OPTIONS.map((o) => (
                <SelectItem key={o} value={o}>{o}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardTitle>
      </CardHeader>
      {isYes && (
        <CardContent className="pt-0 text-xs text-amber-800 dark:text-amber-200">
          Impact identified — document details in Impact Description or Scientific Justification.
        </CardContent>
      )}
    </Card>
  );
}
