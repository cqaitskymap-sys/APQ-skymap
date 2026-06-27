'use client';

import { mapHistoryToCcApprovalTimeline } from '@/lib/cc-approval-records';
import type { CcApprovalHistoryEntry } from '@/lib/change-control-types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CcApprovalStatusBadge, CcWorkflowStepBadge } from './cc-approval-badges';

export function CcApprovalTimeline({ history }: { history: CcApprovalHistoryEntry[] }) {
  const entries = mapHistoryToCcApprovalTimeline(history);
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Approval Timeline</CardTitle></CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">No approval events recorded yet.</p>
        ) : (
          <ol className="relative space-y-4 border-l border-border pl-4">
            {entries.map((e, i) => (
              <li key={i} className="text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{e.action}</span>
                  <CcWorkflowStepBadge step={e.step} />
                </div>
                <p className="text-xs text-muted-foreground">{e.user} ({e.role}) · {e.at ? new Date(e.at).toLocaleString() : '—'}</p>
                {e.comments && <p className="mt-1 text-muted-foreground">{e.comments}</p>}
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

export function CcApprovalHistoryTable({ history }: { history: CcApprovalHistoryEntry[] }) {
  const entries = mapHistoryToCcApprovalTimeline(history);
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Approval History</CardTitle></CardHeader>
      <CardContent className="overflow-x-auto">
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">No history yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2 pr-4">Action</th>
                <th className="pb-2 pr-4">Step</th>
                <th className="pb-2 pr-4">User</th>
                <th className="pb-2 pr-4">Date</th>
                <th className="pb-2">Comments</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e, i) => (
                <tr key={i} className="border-b last:border-0">
                  <td className="py-2 pr-4"><CcApprovalStatusBadge status={e.action} /></td>
                  <td className="py-2 pr-4">{e.step}</td>
                  <td className="py-2 pr-4">{e.user}</td>
                  <td className="py-2 pr-4 whitespace-nowrap">{e.at ? new Date(e.at).toLocaleDateString() : '—'}</td>
                  <td className="py-2 max-w-[240px] truncate">{e.comments || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}
