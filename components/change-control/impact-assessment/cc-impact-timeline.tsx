'use client';

import { mapCcImpactAuditToTimeline } from '@/lib/cc-impact-records';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function CcImpactTimeline({ auditLogs }: { auditLogs: Record<string, unknown>[] }) {
  const entries = mapCcImpactAuditToTimeline(auditLogs);
  if (!entries.length) {
    return <p className="text-sm text-muted-foreground py-8 text-center">No impact assessment audit entries yet.</p>;
  }
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Audit Trail</CardTitle></CardHeader>
      <CardContent>
        <ol className="relative border-l border-slate-200 space-y-4 ml-2">
          {entries.map((e, i) => (
            <li key={i} className="ml-4">
              <div className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border-2 border-white bg-cyan-500" />
              <p className="text-sm font-medium">{e.action}</p>
              <p className="text-xs text-muted-foreground">{e.user} · {e.at ? new Date(e.at).toLocaleString() : '—'}</p>
              {e.detail && <p className="text-xs mt-1 text-slate-600">{e.detail}</p>}
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
