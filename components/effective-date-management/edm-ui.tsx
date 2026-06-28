'use client';

import { cn } from '@/lib/utils';
import { activationStatusColor } from '@/lib/effective-date-types';
import type { EffectiveDateRecord } from '@/lib/effective-date-types';
import { Calendar, Check, Clock, GraduationCap, RotateCcw, Truck } from 'lucide-react';

export function ActivationStatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap', activationStatusColor(status), className)}>
      {status}
    </span>
  );
}

export function ActivationTimeline({ record }: { record: EffectiveDateRecord }) {
  const steps = [
    { label: 'Scheduled', done: true, date: record.created_at },
    { label: 'Ready', done: ['Ready', 'Activated', 'Waiting For Training'].includes(record.activation_status), date: record.effective_date },
    { label: 'Activated', done: record.activation_status === 'Activated', date: record.activated_at },
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

export function TrainingDependencyCard({ record }: { record: EffectiveDateRecord }) {
  const blocked = record.activation_status === 'Waiting For Training';
  return (
    <div className={cn('rounded-lg border p-3 text-sm', blocked ? 'border-amber-300 bg-amber-50/50' : 'bg-card')}>
      <div className="flex items-center gap-2 mb-1">
        <GraduationCap className="h-4 w-4" />
        <span className="font-medium">Training Dependency</span>
      </div>
      <p>Required: {record.training_required ? 'Yes' : 'No'}</p>
      <p>Status: {record.training_completion_status}</p>
    </div>
  );
}

export function ActivationQueue({ records, onActivate }: { records: EffectiveDateRecord[]; onActivate?: (id: string) => void }) {
  if (!records.length) return <p className="text-sm text-muted-foreground py-4 text-center">Activation queue is empty.</p>;
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {records.map((r) => (
        <div key={r.id} className="rounded-lg border bg-card p-4 space-y-2">
          <div className="flex justify-between gap-2">
            <p className="font-mono text-xs text-muted-foreground">{r.effective_date_id}</p>
            <ActivationStatusBadge status={r.activation_status} />
          </div>
          <h3 className="font-semibold truncate">{r.document_title}</h3>
          <p className="text-xs text-muted-foreground">{r.document_number} · v{r.version}</p>
          <p className="text-xs flex items-center gap-1"><Calendar className="h-3 w-3" /> {r.effective_date} {r.activation_time} {r.time_zone}</p>
          {r.training_required && <p className="text-xs flex items-center gap-1 text-amber-700"><GraduationCap className="h-3 w-3" /> {r.training_completion_status}</p>}
          {onActivate && ['Ready', 'Scheduled'].includes(r.activation_status) && (
            <button type="button" onClick={() => onActivate(r.id)} className="text-xs px-2 py-1 rounded bg-green-50 text-green-700 hover:bg-green-100">Activate Now</button>
          )}
        </div>
      ))}
    </div>
  );
}

export function EffectiveDateTable({ records, selectedIds, toggleSelect, toggleSelectAll, isReadOnly, compact }: {
  records: EffectiveDateRecord[];
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
            <th className="p-3 text-left font-medium">Document</th>
            <th className="p-3 text-left font-medium">Effective Date</th>
            <th className="p-3 text-left font-medium">Status</th>
            {!compact && <th className="p-3 text-left font-medium hidden md:table-cell">Training</th>}
            {!compact && <th className="p-3 text-left font-medium hidden lg:table-cell">Distribution</th>}
          </tr>
        </thead>
        <tbody>
          {records.map((r) => (
            <tr key={r.id} className="border-b hover:bg-muted/30">
              {!isReadOnly && toggleSelect && (
                <td className="p-3"><input type="checkbox" checked={selectedIds?.includes(r.id)} onChange={() => toggleSelect(r.id)} className="rounded" /></td>
              )}
              <td className="p-3">
                <p className="font-medium truncate max-w-[180px]">{r.document_title}</p>
                <p className="text-xs text-muted-foreground">{r.document_number} v{r.version}</p>
              </td>
              <td className="p-3">{r.effective_date}</td>
              <td className="p-3"><ActivationStatusBadge status={r.activation_status} /></td>
              {!compact && <td className="p-3 hidden md:table-cell text-xs">{r.training_completion_status}</td>}
              {!compact && <td className="p-3 hidden lg:table-cell text-xs"><span className="flex items-center gap-1"><Truck className="h-3 w-3" />{r.distribution_status}</span></td>}
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
          <RotateCcw className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
          <div><p className="font-medium">{e.action}</p><p className="text-xs text-muted-foreground">{e.user} · {new Date(e.date).toLocaleString()}</p></div>
        </div>
      ))}
    </div>
  );
}

export { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
