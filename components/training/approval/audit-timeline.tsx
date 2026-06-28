'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ApprovalHistoryEntry } from '@/lib/training-approval-types';

export function AuditTimeline({ history }: { history: ApprovalHistoryEntry[] }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm">Audit Timeline</CardTitle></CardHeader>
      <CardContent className="max-h-[320px] overflow-y-auto space-y-2">
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">No audit history recorded yet.</p>
        ) : history.map((h) => (
          <div key={h.id} className="text-xs border-b pb-2 last:border-0">
            <span className="font-medium">{h.action}</span>
            {' — '}
            <span className="font-mono">{h.workflow_number}</span>
            {' · '}
            {h.step_name}
            <div className="text-muted-foreground mt-0.5">
              {h.user_name} ({h.user_role}) · {new Date(h.created_at).toLocaleString()}
              {h.comments && <span className="block italic mt-0.5">{h.comments}</span>}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
