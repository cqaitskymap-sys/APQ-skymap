'use client';

import { cn } from '@/lib/utils';
import { approvalStatusColor, slaStatusColor } from '@/lib/document-approval-types';
import type { DocumentApprovalRecord } from '@/lib/document-approval-types';
import { Check, Clock, MessageSquare, ShieldCheck, UserPlus, AlertTriangle } from 'lucide-react';

export function ApprovalStatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap', approvalStatusColor(status), className)}>
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
      <div className="h-2 rounded-full bg-muted overflow-hidden"><div className="h-full bg-indigo-600 rounded-full transition-all" style={{ width: `${pct}%` }} /></div>
    </div>
  );
}

export function ApprovalTimeline({ record }: { record: DocumentApprovalRecord }) {
  const steps = [
    { label: 'Assigned', done: true, date: record.created_at },
    { label: 'Started', done: !!record.started_at, date: record.started_at },
    { label: 'Decision', done: ['Approved', 'Rejected', 'Returned'].includes(record.approval_status), date: record.approval_date },
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

export function ApprovalStepCard({ record }: { record: DocumentApprovalRecord }) {
  return (
    <div className="rounded-lg border bg-card p-4 space-y-2">
      <div className="flex justify-between gap-2">
        <p className="font-mono text-xs text-muted-foreground">{record.approval_number}</p>
        <SlaBadge sla={record.sla_status} />
      </div>
      <h3 className="font-semibold truncate">{record.document_title}</h3>
      <p className="text-xs text-muted-foreground">{record.document_number} · v{record.version}</p>
      <ApprovalStatusBadge status={record.approval_status} />
      <WorkflowProgress current={record.current_step} total={record.total_steps} />
      {record.electronic_signature_required && (
        <p className="text-xs flex items-center gap-1 text-indigo-700"><ShieldCheck className="h-3 w-3" /> E-Sign: {record.electronic_signature_status}</p>
      )}
      {record.delegated_to_name && (
        <p className="text-xs flex items-center gap-1 text-amber-700"><UserPlus className="h-3 w-3" /> Delegated to {record.delegated_to_name}</p>
      )}
      {record.escalated && (
        <p className="text-xs flex items-center gap-1 text-red-700"><AlertTriangle className="h-3 w-3" /> Escalated (L{record.escalation_level})</p>
      )}
      <p className="text-xs text-muted-foreground">Due: {record.due_date}</p>
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

export function ApprovalInbox({ records, onAction }: {
  records: DocumentApprovalRecord[];
  onAction?: (id: string, action: 'start' | 'complete' | 'delegate') => void;
}) {
  if (!records.length) return <p className="text-sm text-muted-foreground py-6 text-center">No approvals in your inbox.</p>;
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {records.map((r) => (
        <div key={r.id} className="rounded-lg border bg-card p-4 space-y-2 hover:shadow-md transition-shadow">
          <ApprovalStepCard record={r} />
          <div className="flex flex-wrap gap-2 pt-1">
            {onAction && r.approval_status === 'Pending Approval' && (
              <button type="button" onClick={() => onAction(r.id, 'start')} className="text-xs px-2 py-1 rounded bg-blue-50 text-blue-700 hover:bg-blue-100">Start</button>
            )}
            {onAction && r.approval_status === 'In Progress' && (
              <button type="button" onClick={() => onAction(r.id, 'complete')} className="text-xs px-2 py-1 rounded bg-green-50 text-green-700 hover:bg-green-100">Complete</button>
            )}
            {onAction && ['Pending Approval', 'In Progress'].includes(r.approval_status) && (
              <button type="button" onClick={() => onAction(r.id, 'delegate')} className="text-xs px-2 py-1 rounded bg-amber-50 text-amber-700 hover:bg-amber-100">Delegate</button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export function ApprovalTable({ records, selectedIds, toggleSelect, toggleSelectAll, isReadOnly, compact }: {
  records: DocumentApprovalRecord[];
  selectedIds?: string[];
  toggleSelect?: (id: string) => void;
  toggleSelectAll?: () => void;
  isReadOnly?: boolean;
  compact?: boolean;
}) {
  if (!records.length) return <p className="py-8 text-center text-sm text-muted-foreground">No approvals match filters.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            {!isReadOnly && toggleSelect && <th className="p-3 w-10"><input type="checkbox" onChange={toggleSelectAll} className="rounded" /></th>}
            <th className="p-3 text-left font-medium">Approval #</th>
            <th className="p-3 text-left font-medium">Document</th>
            <th className="p-3 text-left font-medium hidden md:table-cell">Approver</th>
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
              <td className="p-3 font-mono text-xs">{r.approval_number}</td>
              <td className="p-3 max-w-[180px]">
                <p className="truncate font-medium">{r.document_title}</p>
                <p className="text-xs text-muted-foreground">{r.document_number} v{r.version}</p>
              </td>
              <td className="p-3 hidden md:table-cell">{r.delegated_to_name || r.approver_name}</td>
              <td className="p-3"><ApprovalStatusBadge status={r.approval_status} /></td>
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
