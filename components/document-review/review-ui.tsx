'use client';

import { cn } from '@/lib/utils';
import { reviewStatusColor, slaStatusColor } from '@/lib/document-review-types';
import type { DocumentReviewRecord, ReviewChecklistItem } from '@/lib/document-review-types';
import { Check, Clock, MessageSquare, ClipboardCheck } from 'lucide-react';

export function ReviewStatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap', reviewStatusColor(status), className)}>
      {status}
    </span>
  );
}

export function SlaBadge({ sla }: { sla: string }) {
  return (
    <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-medium', slaStatusColor(sla))}>{sla}</span>
  );
}

export function WorkflowProgress({ current, total }: { current: number; total: number }) {
  const pct = total ? Math.round((current / total) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-muted-foreground"><span>Step {current} of {total}</span><span>{pct}%</span></div>
      <div className="h-2 rounded-full bg-muted overflow-hidden"><div className="h-full bg-blue-600 rounded-full transition-all" style={{ width: `${pct}%` }} /></div>
    </div>
  );
}

export function ReviewTimeline({ record }: { record: DocumentReviewRecord }) {
  const steps = [
    { label: 'Assigned', done: true, date: record.created_at },
    { label: 'Started', done: !!record.started_at, date: record.started_at },
    { label: 'Completed', done: record.review_status === 'Completed', date: record.completed_date },
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
          <div className="pb-3"><p className="text-sm font-medium">{s.label}</p>{s.date && <p className="text-xs text-muted-foreground">{new Date(s.date).toLocaleString()}</p>}</div>
        </div>
      ))}
    </div>
  );
}

export function ReviewChecklist({ items, onChange, readonly }: {
  items: ReviewChecklistItem[];
  onChange?: (items: ReviewChecklistItem[]) => void;
  readonly?: boolean;
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium flex items-center gap-1"><ClipboardCheck className="h-4 w-4" /> Review Checklist</p>
      {items.map((item) => (
        <label key={item.id} className={cn('flex items-start gap-2 text-sm rounded border p-2', item.checked && 'bg-green-50/50')}>
          <input type="checkbox" checked={item.checked} disabled={readonly}
            onChange={(e) => onChange?.(items.map((x) => x.id === item.id ? { ...x, checked: e.target.checked } : x))}
            className="mt-0.5 rounded" />
          <span>{item.label}{item.required && <span className="text-red-500 ml-1">*</span>}</span>
        </label>
      ))}
    </div>
  );
}

export function CommentPanel({ comments }: { comments: Array<{ author_name?: string; comment?: string; created_at?: string }> }) {
  if (!comments.length) return <p className="text-sm text-muted-foreground">No comments yet.</p>;
  return (
    <div className="space-y-2 max-h-48 overflow-y-auto">
      {comments.map((c, i) => (
        <div key={i} className="rounded border px-3 py-2 text-sm">
          <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1"><MessageSquare className="h-3 w-3" />{c.author_name} · {c.created_at ? new Date(c.created_at).toLocaleString() : ''}</div>
          <p>{c.comment}</p>
        </div>
      ))}
    </div>
  );
}

export function ReviewInbox({ records, onAction }: { records: DocumentReviewRecord[]; onAction?: (id: string, action: 'start' | 'complete') => void }) {
  if (!records.length) return <p className="text-sm text-muted-foreground py-6 text-center">No reviews in your inbox.</p>;
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {records.map((r) => (
        <div key={r.id} className="rounded-lg border bg-card p-4 space-y-2 hover:shadow-md transition-shadow">
          <div className="flex justify-between gap-2">
            <p className="font-mono text-xs text-muted-foreground">{r.review_number}</p>
            <SlaBadge sla={r.sla_status} />
          </div>
          <h3 className="font-semibold truncate">{r.document_title}</h3>
          <p className="text-xs text-muted-foreground">{r.document_number} · v{r.version}</p>
          <ReviewStatusBadge status={r.review_status} />
          <WorkflowProgress current={r.current_step} total={r.total_steps} />
          <p className="text-xs text-muted-foreground">Due: {r.due_date}</p>
          {onAction && r.review_status === 'Pending Review' && (
            <button type="button" onClick={() => onAction(r.id, 'start')} className="text-xs px-2 py-1 rounded bg-blue-50 text-blue-700 hover:bg-blue-100">Start Review</button>
          )}
          {onAction && r.review_status === 'Under Review' && (
            <button type="button" onClick={() => onAction(r.id, 'complete')} className="text-xs px-2 py-1 rounded bg-green-50 text-green-700 hover:bg-green-100">Complete Review</button>
          )}
        </div>
      ))}
    </div>
  );
}

export function ReviewTable({ records, selectedIds, toggleSelect, toggleSelectAll, isReadOnly, compact }: {
  records: DocumentReviewRecord[];
  selectedIds?: string[];
  toggleSelect?: (id: string) => void;
  toggleSelectAll?: () => void;
  isReadOnly?: boolean;
  compact?: boolean;
}) {
  if (!records.length) return <p className="py-8 text-center text-sm text-muted-foreground">No reviews match filters.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            {!isReadOnly && toggleSelect && <th className="p-3 w-10"><input type="checkbox" onChange={toggleSelectAll} className="rounded" /></th>}
            <th className="p-3 text-left font-medium">Review #</th>
            <th className="p-3 text-left font-medium">Document</th>
            <th className="p-3 text-left font-medium hidden md:table-cell">Reviewer</th>
            <th className="p-3 text-left font-medium">Status</th>
            <th className="p-3 text-left font-medium hidden lg:table-cell">SLA</th>
            {!compact && <th className="p-3 text-left font-medium hidden xl:table-cell">Due</th>}
          </tr>
        </thead>
        <tbody>
          {records.map((r) => (
            <tr key={r.id} className="border-b hover:bg-muted/30">
              {!isReadOnly && toggleSelect && (
                <td className="p-3"><input type="checkbox" checked={selectedIds?.includes(r.id)} onChange={() => toggleSelect(r.id)} className="rounded" /></td>
              )}
              <td className="p-3 font-mono text-xs">{r.review_number}</td>
              <td className="p-3 max-w-[180px]">
                <p className="truncate font-medium">{r.document_title}</p>
                <p className="text-xs text-muted-foreground">{r.document_number} v{r.version}</p>
              </td>
              <td className="p-3 hidden md:table-cell">{r.reviewer_name}</td>
              <td className="p-3"><ReviewStatusBadge status={r.review_status} /></td>
              <td className="p-3 hidden lg:table-cell"><SlaBadge sla={r.sla_status} /></td>
              {!compact && <td className="p-3 hidden xl:table-cell text-muted-foreground">{r.due_date}</td>}
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
        <div key={i} className="rounded border px-3 py-2 text-sm flex gap-2">
          <Clock className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
          <div><p className="font-medium">{e.action}</p><p className="text-xs text-muted-foreground">{e.user} · {new Date(e.date).toLocaleString()}</p></div>
        </div>
      ))}
    </div>
  );
}

export { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
