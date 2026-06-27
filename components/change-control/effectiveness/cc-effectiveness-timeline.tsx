'use client';

import { mapCcEffectivenessAuditToTimeline } from '@/lib/cc-effectiveness-records';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function CcEffectivenessTimeline({ auditLogs }: { auditLogs: Record<string, unknown>[] }) {
  const entries = mapCcEffectivenessAuditToTimeline(auditLogs);
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Audit Trail</CardTitle></CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">No effectiveness audit events recorded yet.</p>
        ) : (
          <ol className="relative space-y-4 border-l border-border pl-4">
            {entries.map((e, i) => (
              <li key={i} className="text-sm">
                <p className="font-medium">{e.action}</p>
                <p className="text-xs text-muted-foreground">{e.user} · {e.at ? new Date(e.at).toLocaleString() : '—'}</p>
                {e.detail && <p className="mt-1 text-muted-foreground">{e.detail}</p>}
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
