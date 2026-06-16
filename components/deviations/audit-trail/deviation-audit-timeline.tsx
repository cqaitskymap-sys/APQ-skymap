'use client';

import type { DeviationAuditEntry } from '@/lib/deviation-audit-trail-records';
import { DeviationAuditActionBadge } from './deviation-audit-action-badge';
import { DeviationAuditUserBadge } from './deviation-audit-user-badge';
import { StatusBadge } from '@/components/admin/dashboard/status-badge';

interface DeviationAuditTimelineProps {
  entries: DeviationAuditEntry[];
  emptyMessage?: string;
}

export function DeviationAuditTimeline({ entries, emptyMessage }: DeviationAuditTimelineProps) {
  if (!entries.length) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        {emptyMessage || 'No audit trail entries recorded yet.'}
      </p>
    );
  }

  const sorted = [...entries].sort((a, b) => a.date_time.localeCompare(b.date_time));

  return (
    <div className="relative space-y-4 pl-4 border-l-2 border-blue-200">
      {sorted.map((entry) => (
        <div key={entry.id || entry.audit_id} className="relative pl-4">
          <span className="absolute -left-[21px] top-2 h-3 w-3 rounded-full bg-blue-600 ring-4 ring-white dark:ring-card" />
          <div className="rounded-lg border bg-card p-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <DeviationAuditActionBadge action={entry.action_type} />
              <StatusBadge status={entry.status} />
              <span className="text-xs text-muted-foreground">
                {entry.date_time ? new Date(entry.date_time).toLocaleString() : '—'}
              </span>
            </div>
            <p className="text-sm font-medium">{entry.action_description}</p>
            <p className="text-xs text-muted-foreground mt-1">{entry.module_name}</p>
            <div className="mt-2">
              <DeviationAuditUserBadge name={entry.changed_by_name} role={entry.changed_by_role} />
            </div>
            {entry.field_name && (
              <div className="mt-2 rounded bg-slate-50 dark:bg-slate-900/50 p-2 text-xs font-mono">
                <span className="text-muted-foreground">{entry.field_name}:</span>
                {entry.old_value && (
                  <span className="text-red-600 ml-1 line-through">{entry.old_value.slice(0, 100)}</span>
                )}
                {entry.new_value && (
                  <span className="text-green-700 ml-1">→ {entry.new_value.slice(0, 100)}</span>
                )}
              </div>
            )}
            {entry.reason && (
              <p className="text-xs text-muted-foreground mt-2">Reason: {entry.reason}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
