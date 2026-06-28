'use client';

import { cn } from '@/lib/utils';
import { reviewStatusColor } from '@/lib/periodic-review-types';
import type { PeriodicReviewRecord } from '@/lib/periodic-review-types';
import { Calendar, Check, Clock, FileText, User } from 'lucide-react';

export function ReviewStatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap', reviewStatusColor(status), className)}>
      {status}
    </span>
  );
}

export function ReviewTimeline({ record }: { record: PeriodicReviewRecord }) {
  const steps = [
    { label: 'Scheduled', done: true, date: record.scheduled_date || record.created_at },
    { label: 'Started', done: Boolean(record.started_date), date: record.started_date },
    { label: 'Completed', done: record.status === 'Completed', date: record.completed_date },
  ];
  return (
    <div className="space-y-0">
      {steps.map((s, i) => (
        <div key={s.label} className="flex gap-3">
          <div className="flex flex-col items-center">
            <div className={cn('flex h-6 w-6 items-center justify-center rounded-full border-2', s.done ? 'border-green-500 bg-green-50 text-green-600' : 'border-muted text-muted-foreground')}>
              {s.done ? <Check className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
            </div>
            {i < steps.length - 1 && <div className={cn('w-0.5 h-6', s.done ? 'bg-green-300' : 'bg-muted')} />}
          </div>
          <div className="pb-3">
            <p className="text-sm font-medium">{s.label}</p>
            {s.date && <p className="text-xs text-muted-foreground">{new Date(s.date).toLocaleString()}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}

export function TrainingImpactCard({ record }: { record: PeriodicReviewRecord }) {
  return (
    <div className={cn('rounded-lg border p-3 text-sm', record.training_impact ? 'border-amber-300 bg-amber-50/50' : 'bg-card')}>
      <div className="flex items-center gap-2 mb-1">
        <FileText className="h-4 w-4" />
        <span className="font-medium">Training Impact</span>
      </div>
      <p>Impact: {record.training_impact ? 'Yes — retraining may be required' : 'None identified'}</p>
      <p>Decision: {record.decision || 'Pending'}</p>
    </div>
  );
}

export function ReviewChecklist({ items, onToggle, readOnly }: {
  items: PeriodicReviewRecord['review_checklist'];
  onToggle?: (id: string) => void;
  readOnly?: boolean;
}) {
  if (!items.length) return <p className="text-sm text-muted-foreground">No checklist items.</p>;
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item.id} className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={item.checked}
            disabled={readOnly}
            onChange={() => onToggle?.(item.id)}
            className="mt-1 rounded"
          />
          <span className={item.required ? 'font-medium' : ''}>{item.label}{item.required ? ' *' : ''}</span>
        </li>
      ))}
    </ul>
  );
}

export function PeriodicReviewCalendar({ records }: { records: PeriodicReviewRecord[] }) {
  const byDate = new Map<string, PeriodicReviewRecord[]>();
  for (const r of records) {
    if (!r.due_date) continue;
    const list = byDate.get(r.due_date) || [];
    list.push(r);
    byDate.set(r.due_date, list);
  }
  const dates = Array.from(byDate.keys()).sort().slice(0, 14);
  if (!dates.length) return <p className="text-sm text-muted-foreground py-4 text-center">No upcoming reviews on calendar.</p>;
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {dates.map((d) => (
        <div key={d} className="rounded-lg border p-3 space-y-1">
          <p className="text-xs font-medium flex items-center gap-1 text-muted-foreground"><Calendar className="h-3 w-3" /> {d}</p>
          {byDate.get(d)!.map((r) => (
            <div key={r.id} className="text-sm flex justify-between gap-2">
              <span className="truncate">{r.document_number}</span>
              <ReviewStatusBadge status={r.status} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export function ReviewScheduleTable({ records, onStart, onComplete, isReadOnly }: {
  records: PeriodicReviewRecord[];
  onStart?: (id: string) => void;
  onComplete?: (id: string) => void;
  isReadOnly?: boolean;
}) {
  if (!records.length) return <p className="text-sm text-muted-foreground py-4 text-center">No reviews in queue.</p>;
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {records.map((r) => (
        <div key={r.id} className="rounded-lg border bg-card p-4 space-y-2">
          <div className="flex justify-between gap-2">
            <p className="font-mono text-xs text-muted-foreground">{r.review_number}</p>
            <ReviewStatusBadge status={r.status} />
          </div>
          <h3 className="font-semibold truncate">{r.document_title}</h3>
          <p className="text-xs text-muted-foreground">{r.document_number} · v{r.current_version}</p>
          <p className="text-xs flex items-center gap-1"><Calendar className="h-3 w-3" /> Due {r.due_date}</p>
          <p className="text-xs flex items-center gap-1"><User className="h-3 w-3" /> {r.reviewer_name}</p>
          {!isReadOnly && (
            <div className="flex gap-2 pt-1">
              {['Pending', 'Scheduled', 'Overdue'].includes(r.status) && onStart && (
                <button type="button" onClick={() => onStart(r.id)} className="text-xs px-2 py-1 rounded bg-blue-50 text-blue-700 hover:bg-blue-100">Start</button>
              )}
              {r.status === 'In Progress' && onComplete && (
                <button type="button" onClick={() => onComplete(r.id)} className="text-xs px-2 py-1 rounded bg-green-50 text-green-700 hover:bg-green-100">Complete</button>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export function PeriodicReviewTable({ records, selectedIds, toggleSelect, toggleSelectAll, isReadOnly, compact }: {
  records: PeriodicReviewRecord[];
  selectedIds?: string[];
  toggleSelect?: (id: string) => void;
  toggleSelectAll?: () => void;
  isReadOnly?: boolean;
  compact?: boolean;
}) {
  if (!records.length) return <p className="py-8 text-center text-sm text-muted-foreground">No records match filters.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            {!isReadOnly && toggleSelect && <th className="p-3 w-10"><input type="checkbox" onChange={toggleSelectAll} className="rounded" /></th>}
            <th className="p-3 text-left font-medium">Review</th>
            <th className="p-3 text-left font-medium">Document</th>
            <th className="p-3 text-left font-medium">Due Date</th>
            <th className="p-3 text-left font-medium">Status</th>
            {!compact && <th className="p-3 text-left font-medium hidden md:table-cell">Decision</th>}
            {!compact && <th className="p-3 text-left font-medium hidden lg:table-cell">Frequency</th>}
          </tr>
        </thead>
        <tbody>
          {records.map((r) => (
            <tr key={r.id} className="border-b hover:bg-muted/30">
              {!isReadOnly && toggleSelect && (
                <td className="p-3"><input type="checkbox" checked={selectedIds?.includes(r.id)} onChange={() => toggleSelect(r.id)} className="rounded" /></td>
              )}
              <td className="p-3 font-mono text-xs">{r.review_number}</td>
              <td className="p-3">
                <p className="font-medium truncate max-w-[180px]">{r.document_title}</p>
                <p className="text-xs text-muted-foreground">{r.document_number} v{r.current_version}</p>
              </td>
              <td className="p-3">{r.due_date}</td>
              <td className="p-3"><ReviewStatusBadge status={r.status} /></td>
              {!compact && <td className="p-3 hidden md:table-cell text-xs">{r.decision || '—'}</td>}
              {!compact && <td className="p-3 hidden lg:table-cell text-xs">{r.review_frequency}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AuditTimeline({ entries }: { entries: Array<{ action: string; user: string; date: string }> }) {
  if (!entries.length) return <p className="text-sm text-muted-foreground">No audit entries.</p>;
  return (
    <div className="space-y-2 max-h-64 overflow-y-auto">
      {entries.map((e, i) => (
        <div key={i} className="rounded border px-3 py-2 text-sm">
          <p className="font-medium">{e.action}</p>
          <p className="text-xs text-muted-foreground">{e.user} · {new Date(e.date).toLocaleString()}</p>
        </div>
      ))}
    </div>
  );
}

export { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
