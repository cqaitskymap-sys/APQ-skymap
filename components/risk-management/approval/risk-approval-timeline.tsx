'use client';

import type { RiskApprovalTimelineEntry } from '@/lib/risk-approval-records';
import { RiskWorkflowStepBadge } from './risk-approval-badges';

export function RiskApprovalTimeline({ entries }: { entries: RiskApprovalTimelineEntry[] }) {
  if (!entries?.length) return <p className="text-sm text-muted-foreground py-4 text-center">No approval events yet.</p>;
  return (
    <div className="space-y-3">
      {entries.map((e, i) => (
        <div key={`${e.at}-${i}`} className="rounded-lg border p-3 text-sm">
          <div className="flex flex-wrap justify-between gap-2">
            <span className="font-medium">{e.action}</span>
            <span className="text-xs text-muted-foreground">{e.at ? new Date(e.at).toLocaleString() : '—'}</span>
          </div>
          {e.workflow_step && <div className="mt-1"><RiskWorkflowStepBadge step={e.workflow_step} /></div>}
          {e.detail && <p className="text-muted-foreground mt-1">{e.detail}</p>}
          {e.user && <p className="text-xs text-muted-foreground mt-1">By {e.user}</p>}
        </div>
      ))}
    </div>
  );
}
