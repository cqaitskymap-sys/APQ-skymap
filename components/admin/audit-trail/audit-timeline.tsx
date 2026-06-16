'use client';

import { ActionTypeBadge } from './action-type-badge';
import { StatusBadge } from '@/components/admin/dashboard/status-badge';
import type { AuditTrailEntry } from '@/lib/admin/schemas';

interface AuditTimelineProps {
  entries: AuditTrailEntry[];
  title?: string;
  emptyMessage?: string;
}

export function AuditTimeline({ entries, title, emptyMessage }: AuditTimelineProps) {
  if (entries.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-4 text-center">
        {emptyMessage || 'No timeline entries'}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {title && <h3 className="text-sm font-semibold text-slate-800">{title}</h3>}
      <div className="relative space-y-4 pl-4 border-l-2 border-slate-200">
        {entries.map((entry) => (
          <div key={entry.id || entry.auditId} className="relative pl-4">
            <span className="absolute -left-[21px] top-1.5 h-3 w-3 rounded-full bg-blue-500 ring-4 ring-white" />
            <div className="rounded-lg border bg-white p-3 shadow-sm">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <ActionTypeBadge action={entry.actionType} />
                <StatusBadge status={entry.status} />
                <span className="text-xs text-muted-foreground">
                  {new Date(entry.dateTime).toLocaleString()}
                </span>
              </div>
              <p className="text-sm font-medium">{entry.actionDescription || entry.actionType}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {entry.changedByUserName} · {entry.moduleName}
                {entry.recordId && ` · ${entry.recordId}`}
              </p>
              {entry.fieldName && (
                <p className="text-xs mt-2 font-mono bg-slate-50 p-2 rounded">
                  <span className="text-muted-foreground">{entry.fieldName}:</span>
                  {entry.oldValue && <span className="text-red-600 ml-1">{String(entry.oldValue).slice(0, 80)}</span>}
                  {entry.newValue && <span className="text-green-700 ml-1">→ {String(entry.newValue).slice(0, 80)}</span>}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
