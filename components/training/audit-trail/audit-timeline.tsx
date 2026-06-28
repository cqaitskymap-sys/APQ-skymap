'use client';

import type { TrainingAuditEntry } from '@/lib/training-audit-trail-records';
import { formatAuditDateTimeLocal } from '@/lib/training-audit-trail-records';
import { AuditActionBadge, AuditStatusBadge } from './audit-status-badge';
import { Lock } from 'lucide-react';

interface AuditTimelineProps {
  entries: TrainingAuditEntry[];
  emptyMessage?: string;
}

export function AuditTimeline({ entries, emptyMessage }: AuditTimelineProps) {
  if (!entries.length) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        {emptyMessage || 'No audit trail entries recorded yet.'}
      </p>
    );
  }

  const sorted = [...entries].sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  return (
    <div className="relative space-y-4 pl-4 border-l-2 border-blue-200">
      {sorted.map((entry) => (
        <div key={entry.id || entry.audit_id} className="relative pl-4">
          <span className="absolute -left-[21px] top-2 h-3 w-3 rounded-full bg-blue-600 ring-4 ring-white dark:ring-card" />
          <div className="rounded-lg border bg-card p-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <AuditActionBadge action={entry.action} />
              <AuditStatusBadge status={entry.status} />
              {entry.electronic_signature_required && (
                <span className="inline-flex items-center gap-1 text-xs text-purple-700">
                  <Lock className="h-3 w-3" /> E-Sign
                </span>
              )}
              <span className="text-xs text-muted-foreground">{formatAuditDateTimeLocal(entry.timestamp)}</span>
            </div>
            <p className="text-sm font-medium">{entry.comments || `${entry.action} on ${entry.module}`}</p>
            <p className="text-xs text-muted-foreground mt-1">{entry.module} · {entry.entity_type}</p>
            {entry.reference_number && (
              <p className="text-xs font-mono text-blue-600 mt-1">{entry.reference_number}</p>
            )}
            <p className="text-xs mt-2">{entry.performed_by_name} {entry.role && `(${entry.role})`}</p>
            {entry.changed_field && (
              <div className="mt-2 rounded bg-slate-50 dark:bg-slate-900/50 p-2 text-xs font-mono">
                <span className="text-muted-foreground">{entry.changed_field}:</span>
                {entry.previous_value && (
                  <span className="text-red-600 ml-1 line-through">{entry.previous_value.slice(0, 100)}</span>
                )}
                {entry.new_value && (
                  <span className="text-green-700 ml-1">→ {entry.new_value.slice(0, 100)}</span>
                )}
              </div>
            )}
            {entry.reason_for_change && (
              <p className="text-xs text-muted-foreground mt-2">Reason: {entry.reason_for_change}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
