'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ResultStatusBadge } from '@/components/oos/oos-sub-nav';
import { cn } from '@/lib/utils';

export function OosSpecComparisonCard({
  parameterName,
  lower,
  upper,
  observed,
  unit,
  resultStatus,
}: {
  parameterName: string;
  lower: number;
  upper: number;
  observed: number;
  unit: string;
  resultStatus: string;
}) {
  const inSpec = observed >= lower && observed <= upper;
  return (
    <Card className={cn('border-l-4', inSpec ? 'border-l-emerald-600' : 'border-l-red-600')}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Specification vs Observed Result</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="text-xs text-muted-foreground">Parameter</p>
          <p className="font-medium">{parameterName || '—'}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Specification</p>
          <p className="font-mono">{lower} – {upper} {unit}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Observed</p>
          <p className={cn('font-mono font-semibold', inSpec ? 'text-emerald-700' : 'text-red-700')}>
            {observed} {unit}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Result Status (Auto)</p>
          <div className="pt-1"><ResultStatusBadge status={resultStatus} /></div>
        </div>
      </CardContent>
    </Card>
  );
}
