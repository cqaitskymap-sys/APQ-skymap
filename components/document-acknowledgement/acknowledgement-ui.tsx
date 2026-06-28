'use client';

import { cn } from '@/lib/utils';
import { ackStatusColor } from '@/lib/document-acknowledgement-types';
import { FileText, Clock } from 'lucide-react';
import type { DocumentAcknowledgementRecord } from '@/lib/document-acknowledgement-types';

export function AckStatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap', ackStatusColor(status), className)}>
      {status}
    </span>
  );
}

export function AcknowledgementCard({ record, onAction }: { record: DocumentAcknowledgementRecord; onAction?: (id: string, action: 'view' | 'read' | 'ack') => void }) {
  const canAct = !['Acknowledged', 'Cancelled', 'Expired'].includes(record.acknowledgement_status);
  return (
    <div className="rounded-lg border bg-card p-4 space-y-3 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-mono text-xs text-muted-foreground">{record.acknowledgement_number}</p>
          <h3 className="font-semibold truncate">{record.document_title}</h3>
          <p className="text-xs text-muted-foreground">{record.document_number} · v{record.document_version}</p>
        </div>
        <AckStatusBadge status={record.acknowledgement_status} />
      </div>
      <p className="text-xs text-muted-foreground">Due: {record.due_date || '—'} · {record.department}</p>
      {canAct && onAction && (
        <div className="flex flex-wrap gap-2 pt-1">
          {!record.viewed_date && <button type="button" onClick={() => onAction(record.id, 'view')} className="text-xs px-2 py-1 rounded bg-blue-50 text-blue-700 hover:bg-blue-100">View</button>}
          {record.viewed_date && !record.read_confirmation_date && <button type="button" onClick={() => onAction(record.id, 'read')} className="text-xs px-2 py-1 rounded bg-indigo-50 text-indigo-700 hover:bg-indigo-100">Confirm Read</button>}
          {record.read_confirmation_date && record.acknowledgement_status !== 'Acknowledged' && <button type="button" onClick={() => onAction(record.id, 'ack')} className="text-xs px-2 py-1 rounded bg-green-50 text-green-700 hover:bg-green-100">Acknowledge</button>}
        </div>
      )}
    </div>
  );
}

export function AcknowledgementInbox({ records, onAction }: { records: DocumentAcknowledgementRecord[]; onAction?: (id: string, action: 'view' | 'read' | 'ack') => void }) {
  if (!records.length) return <p className="text-sm text-muted-foreground py-8 text-center">Your acknowledgement inbox is empty.</p>;
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {records.map((r) => (<AcknowledgementCard key={r.id} record={r} onAction={onAction} />))}
    </div>
  );
}

export function AcknowledgementTable({ records, selectedIds, toggleSelect, toggleSelectAll, isReadOnly, compact }: {
  records: DocumentAcknowledgementRecord[];
  selectedIds?: string[];
  toggleSelect?: (id: string) => void;
  toggleSelectAll?: () => void;
  isReadOnly?: boolean;
  compact?: boolean;
}) {
  if (!records.length) return <p className="py-8 text-center text-sm text-muted-foreground">No acknowledgements match filters.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            {!isReadOnly && toggleSelect && <th className="p-3 w-10"><input type="checkbox" onChange={toggleSelectAll} className="rounded" /></th>}
            <th className="p-3 text-left font-medium">Ack #</th>
            <th className="p-3 text-left font-medium">Document</th>
            <th className="p-3 text-left font-medium hidden md:table-cell">Employee</th>
            <th className="p-3 text-left font-medium">Status</th>
            <th className="p-3 text-left font-medium hidden lg:table-cell">Due Date</th>
            {!compact && <th className="p-3 text-left font-medium hidden xl:table-cell">Department</th>}
          </tr>
        </thead>
        <tbody>
          {records.map((r) => (
            <tr key={r.id} className="border-b hover:bg-muted/30">
              {!isReadOnly && toggleSelect && (
                <td className="p-3"><input type="checkbox" checked={selectedIds?.includes(r.id)} onChange={() => toggleSelect(r.id)} className="rounded" /></td>
              )}
              <td className="p-3 font-mono text-xs">{r.acknowledgement_number}</td>
              <td className="p-3 max-w-[180px]">
                <p className="truncate font-medium">{r.document_title}</p>
                <p className="text-xs text-muted-foreground">{r.document_number}</p>
              </td>
              <td className="p-3 hidden md:table-cell">{r.employee_name}</td>
              <td className="p-3"><AckStatusBadge status={r.acknowledgement_status} /></td>
              <td className="p-3 hidden lg:table-cell text-muted-foreground">{r.due_date || '—'}</td>
              {!compact && <td className="p-3 hidden xl:table-cell text-muted-foreground">{r.department}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function DocumentViewer({ title, version }: { title: string; version: string }) {
  return (
    <div className="rounded-lg border-2 border-dashed bg-muted/30 p-8 text-center">
      <FileText className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
      <p className="text-sm font-medium">{title}</p>
      <p className="text-xs text-muted-foreground mt-1">Version {version}</p>
      <p className="text-xs text-muted-foreground mt-3">Document Viewer — PDF rendering available in production</p>
    </div>
  );
}

export function ReminderPanel({ pendingCount, onRemind, onEscalate, disabled }: { pendingCount: number; onRemind: () => void; onEscalate: () => void; disabled?: boolean }) {
  return (
    <div className="rounded-lg border bg-amber-50/50 dark:bg-amber-950/20 p-4 space-y-2">
      <p className="text-sm font-medium">{pendingCount} pending acknowledgement(s)</p>
      <div className="flex gap-2">
        <button type="button" disabled={disabled || !pendingCount} onClick={onRemind} className="text-xs px-3 py-1.5 rounded bg-amber-100 text-amber-800 hover:bg-amber-200 disabled:opacity-50">Send Bulk Reminder</button>
        <button type="button" disabled={disabled} onClick={onEscalate} className="text-xs px-3 py-1.5 rounded border hover:bg-muted disabled:opacity-50">Escalate Overdue</button>
      </div>
    </div>
  );
}

export function AuditTimeline({ entries }: { entries: Array<{ action: string; user: string; date: string }> }) {
  if (!entries.length) return <p className="text-sm text-muted-foreground">No audit entries.</p>;
  return (
    <div className="space-y-2 max-h-64 overflow-y-auto">
      {entries.map((e, i) => (
        <div key={i} className="rounded border px-3 py-2 text-sm flex gap-2">
          <Clock className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
          <div><p className="font-medium">{e.action}</p><p className="text-xs text-muted-foreground">{e.user} · {new Date(e.date).toLocaleString()}</p></div>
        </div>
      ))}
    </div>
  );
}

export { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
