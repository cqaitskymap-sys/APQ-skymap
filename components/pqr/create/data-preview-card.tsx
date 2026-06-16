'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function DataPreviewCard({
  title, items, emptyMessage = 'No data collected',
}: {
  title: string;
  items: Array<{ label: string; value: string | number }>;
  emptyMessage?: string;
}) {
  const hasData = items.some((i) => Number(i.value) > 0);
  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <p className="text-xs text-muted-foreground">{emptyMessage}</p>
        ) : (
          <dl className="grid grid-cols-2 gap-2 text-sm">
            {items.map((item) => (
              <div key={item.label}>
                <dt className="text-xs text-muted-foreground">{item.label}</dt>
                <dd className="font-semibold tabular-nums">{item.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </CardContent>
    </Card>
  );
}
