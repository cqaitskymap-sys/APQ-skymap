'use client';

import { Card, CardContent } from '@/components/ui/card';

export function FishbonePlaceholder() {
  return (
    <Card className="border-dashed">
      <CardContent className="flex min-h-[220px] flex-col items-center justify-center gap-2 p-6 text-center text-sm text-muted-foreground">
        <p className="font-medium text-slate-700">Fishbone (Ishikawa) Diagram</p>
        <p>Placeholder — attach fishbone diagram as PDF/image in Attachments tab, or document causes in Contributing Factors.</p>
        <div className="mt-2 grid grid-cols-3 gap-2 text-[10px] uppercase tracking-wide">
          {['Man', 'Machine', 'Method', 'Material', 'Measurement', 'Environment'].map((c) => (
            <span key={c} className="rounded border bg-white px-2 py-1">{c}</span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
