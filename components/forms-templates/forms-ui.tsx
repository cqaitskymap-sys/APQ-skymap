'use client';

import { cn } from '@/lib/utils';
import { formStatusColor, FORM_WORKFLOW } from '@/lib/forms-templates-types';
import { Check, Circle, Clock, Star, FileText } from 'lucide-react';
import type { FormTemplateRecord } from '@/lib/forms-templates-types';

export function FormStatusBadge({ status, className }: { status: string; className?: string }) {
  return (<span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap', formStatusColor(status), className)}>{status}</span>);
}

export function FormCard({ form, onFavorite }: { form: FormTemplateRecord; onFavorite?: (id: string) => void }) {
  return (
    <div className="rounded-lg border bg-card p-4 space-y-3 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-mono text-xs text-muted-foreground">{form.form_number}</p>
          <h3 className="font-semibold truncate">{form.form_title}</h3>
          <p className="text-xs text-muted-foreground">{form.form_type} · {form.department}</p>
        </div>
        {onFavorite && (<button type="button" onClick={() => onFavorite(form.id)} className="shrink-0 text-muted-foreground hover:text-amber-500"><Star className={cn('h-4 w-4', form.is_favorite && 'fill-amber-400 text-amber-500')} /></button>)}
      </div>
      <div className="flex flex-wrap gap-2"><FormStatusBadge status={form.status} /><span className="text-xs bg-indigo-50 text-indigo-700 rounded-full px-2 py-0.5">{form.form_type}</span></div>
      {(form.related_sop || form.related_wi) && <p className="text-xs text-muted-foreground">{form.related_sop && `SOP: ${form.related_sop}`}{form.related_wi && ` · WI: ${form.related_wi}`}</p>}
    </div>
  );
}

export function WorkflowTimeline({ currentStatus }: { currentStatus: string }) {
  const idx = FORM_WORKFLOW.indexOf(currentStatus as typeof FORM_WORKFLOW[number]);
  return (
    <div className="space-y-0">{FORM_WORKFLOW.map((stage, i) => {
      const completed = i < idx; const current = stage === currentStatus;
      return (
        <div key={stage} className="flex gap-3">
          <div className="flex flex-col items-center">
            <div className={cn('flex h-7 w-7 items-center justify-center rounded-full border-2', completed ? 'border-green-500 bg-green-50 text-green-600' : current ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-muted bg-muted/30 text-muted-foreground')}>
              {completed ? <Check className="h-3.5 w-3.5" /> : current ? <Clock className="h-3.5 w-3.5" /> : <Circle className="h-3 w-3" />}
            </div>
            {i < FORM_WORKFLOW.length - 1 && <div className={cn('w-0.5 h-5', completed ? 'bg-green-300' : 'bg-muted')} />}
          </div>
          <p className={cn('text-sm pb-3', current ? 'font-medium text-blue-700' : completed ? 'text-foreground' : 'text-muted-foreground')}>{stage}</p>
        </div>
      );
    })}</div>
  );
}

export function VersionTimeline({ versions }: { versions: Array<{ version: string; status: string; date: string; reason?: string }> }) {
  if (!versions.length) return <p className="text-sm text-muted-foreground">No version history.</p>;
  return (<div className="space-y-2">{versions.map((v, i) => (
    <div key={i} className="flex gap-3 border-l-2 border-blue-200 pl-4 py-1">
      <span className="font-mono font-semibold text-blue-700">v{v.version}</span>
      <div><FormStatusBadge status={v.status} />{v.reason && <p className="text-xs text-muted-foreground mt-1">{v.reason}</p>}</div>
    </div>
  ))}</div>);
}

export function ApprovalTimeline({ entries }: { entries: Array<{ stage: string; reviewer: string; decision: string; date: string }> }) {
  if (!entries.length) return <p className="text-sm text-muted-foreground">No approvals yet.</p>;
  return (<div className="space-y-2">{entries.map((e, i) => (
    <div key={i} className="rounded border px-3 py-2 text-sm"><p className="font-medium">{e.stage.replace(/_/g, ' ')}</p><p className="text-xs text-muted-foreground">{e.reviewer} — {e.decision}</p></div>
  ))}</div>);
}

export function DocumentPreview({ title }: { title: string }) {
  return (
    <div className="rounded-lg border-2 border-dashed bg-muted/30 p-8 text-center">
      <FileText className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
      <p className="text-sm font-medium">{title}</p>
      <p className="text-xs text-muted-foreground mt-2">PDF Preview & Attachment Upload — available in detail view</p>
    </div>
  );
}

export function AuditTimeline({ entries }: { entries: Array<{ action: string; user: string; date: string }> }) {
  if (!entries.length) return <p className="text-sm text-muted-foreground">No audit entries.</p>;
  return (<div className="space-y-2 max-h-64 overflow-y-auto">{entries.map((e, i) => (
    <div key={i} className="rounded border px-3 py-2 text-sm"><div className="flex justify-between"><span className="font-medium">{e.action}</span><span className="text-xs text-muted-foreground">{new Date(e.date).toLocaleString()}</span></div><p className="text-xs text-muted-foreground">{e.user}</p></div>
  ))}</div>);
}

export { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
