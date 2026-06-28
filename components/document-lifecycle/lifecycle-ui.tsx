'use client';

import { cn } from '@/lib/utils';
import { stageColor, type LifecycleStage, WORKFLOW_STAGES } from '@/lib/document-lifecycle-types';
import { Check, Circle, Clock } from 'lucide-react';

interface StageBadgeProps {
  stage: LifecycleStage | string;
  className?: string;
}

export function StageBadge({ stage, className }: StageBadgeProps) {
  return (
    <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap', stageColor(stage), className)}>
      {stage}
    </span>
  );
}

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const colors: Record<string, string> = {
    draft: 'bg-slate-100 text-slate-700',
    under_review: 'bg-amber-100 text-amber-800',
    approved: 'bg-blue-100 text-blue-800',
    effective: 'bg-green-100 text-green-800',
    obsolete: 'bg-gray-100 text-gray-600',
    archived: 'bg-purple-100 text-purple-800',
    retired: 'bg-stone-100 text-stone-600',
  };
  const label = status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  return (
    <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium', colors[status] || colors.draft, className)}>
      {label}
    </span>
  );
}

interface LifecycleTimelineProps {
  currentStage: LifecycleStage;
  events?: Array<{ stage: LifecycleStage; completed: boolean; current: boolean; date?: string }>;
  compact?: boolean;
}

export function LifecycleTimeline({ currentStage, events, compact }: LifecycleTimelineProps) {
  const steps = events || WORKFLOW_STAGES.map((stage, i) => {
    const idx = WORKFLOW_STAGES.indexOf(currentStage);
    return { stage, completed: i < idx, current: stage === currentStage, date: undefined as string | undefined };
  });

  if (compact) {
    return (
      <div className="flex flex-wrap gap-1">
        {steps.filter((s) => s.completed || s.current).slice(-4).map((s) => (
          <StageBadge key={s.stage} stage={s.stage} />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {steps.map((step, i) => (
        <div key={step.stage} className="flex gap-3">
          <div className="flex flex-col items-center">
            <div className={cn(
              'flex h-7 w-7 items-center justify-center rounded-full border-2',
              step.completed ? 'border-green-500 bg-green-50 text-green-600'
                : step.current ? 'border-blue-500 bg-blue-50 text-blue-600'
                  : 'border-muted bg-muted/30 text-muted-foreground',
            )}>
              {step.completed ? <Check className="h-3.5 w-3.5" /> : step.current ? <Clock className="h-3.5 w-3.5" /> : <Circle className="h-3 w-3" />}
            </div>
            {i < steps.length - 1 && (
              <div className={cn('w-0.5 h-6', step.completed ? 'bg-green-300' : 'bg-muted')} />
            )}
          </div>
          <div className="pb-4 min-w-0">
            <p className={cn('text-sm font-medium', step.current ? 'text-blue-700 dark:text-blue-300' : step.completed ? 'text-foreground' : 'text-muted-foreground')}>
              {step.stage}
            </p>
            {step.date && <p className="text-xs text-muted-foreground">{new Date(step.date).toLocaleDateString()}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}

interface WorkflowProgressProps {
  currentStage: LifecycleStage;
}

export function WorkflowProgress({ currentStage }: WorkflowProgressProps) {
  const idx = WORKFLOW_STAGES.indexOf(currentStage);
  const progress = idx >= 0 ? Math.round(((idx + 1) / WORKFLOW_STAGES.length) * 100) : 0;

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Workflow Progress</span>
        <span>{progress}% — {currentStage}</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-blue-500 to-green-500 transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>Draft</span>
        <span>Effective</span>
        <span>Retired</span>
      </div>
    </div>
  );
}

interface VersionHistoryProps {
  versions: Array<{ version: string; status: string; date: string; author?: string; reason?: string }>;
}

export function VersionHistory({ versions }: VersionHistoryProps) {
  if (!versions.length) {
    return <p className="text-sm text-muted-foreground">No version history available.</p>;
  }
  return (
    <div className="space-y-2">
      {versions.map((v, i) => (
        <div key={`${v.version}-${i}`} className="flex items-start gap-3 rounded-lg border p-3 text-sm">
          <span className="font-mono font-semibold text-blue-700 dark:text-blue-300">v{v.version}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <StatusBadge status={v.status} />
              {v.author && <span className="text-muted-foreground">{v.author}</span>}
            </div>
            {v.reason && <p className="text-muted-foreground mt-1 truncate">{v.reason}</p>}
          </div>
          <span className="text-xs text-muted-foreground shrink-0">{new Date(v.date).toLocaleDateString()}</span>
        </div>
      ))}
    </div>
  );
}

interface ApprovalTimelineProps {
  entries: Array<{ stage: string; reviewer: string; decision: string; date: string; comments?: string }>;
}

export function ApprovalTimeline({ entries }: ApprovalTimelineProps) {
  if (!entries.length) return <p className="text-sm text-muted-foreground">No approval history.</p>;
  return (
    <div className="space-y-3">
      {entries.map((e, i) => (
        <div key={i} className="flex gap-3 border-l-2 border-blue-200 pl-4 pb-2">
          <div>
            <p className="text-sm font-medium">{e.stage.replace(/_/g, ' ')}</p>
            <p className="text-xs text-muted-foreground">{e.reviewer} — {e.decision}</p>
            {e.comments && <p className="text-xs mt-1">{e.comments}</p>}
            <p className="text-xs text-muted-foreground mt-0.5">{new Date(e.date).toLocaleString()}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

interface AuditTimelineProps {
  entries: Array<{ action: string; user: string; date: string; details?: string }>;
}

export function AuditTimeline({ entries }: AuditTimelineProps) {
  if (!entries.length) return <p className="text-sm text-muted-foreground">No audit entries.</p>;
  return (
    <div className="space-y-2 max-h-64 overflow-y-auto">
      {entries.map((e, i) => (
        <div key={i} className="rounded border px-3 py-2 text-sm">
          <div className="flex justify-between gap-2">
            <span className="font-medium">{e.action}</span>
            <span className="text-xs text-muted-foreground">{new Date(e.date).toLocaleString()}</span>
          </div>
          <p className="text-xs text-muted-foreground">{e.user}</p>
          {e.details && <p className="text-xs mt-1">{e.details}</p>}
        </div>
      ))}
    </div>
  );
}

export function NotificationPanel({ notifications }: { notifications: Array<{ title: string; message: string; date: string }> }) {
  if (!notifications.length) {
    return <p className="text-sm text-muted-foreground p-4">No pending notifications.</p>;
  }
  return (
    <div className="divide-y max-h-72 overflow-y-auto">
      {notifications.map((n, i) => (
        <div key={i} className="px-4 py-3 hover:bg-muted/50">
          <p className="text-sm font-medium">{n.title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{n.message}</p>
          <p className="text-xs text-muted-foreground mt-1">{new Date(n.date).toLocaleString()}</p>
        </div>
      ))}
    </div>
  );
}

export function ReviewCalendar({ dates }: { dates: Array<{ date: string; document_number: string; title: string }> }) {
  if (!dates.length) return <p className="text-sm text-muted-foreground">No upcoming reviews scheduled.</p>;
  return (
    <div className="space-y-2">
      {dates.slice(0, 10).map((d, i) => (
        <div key={i} className="flex items-center justify-between rounded border px-3 py-2 text-sm">
          <div>
            <span className="font-medium">{d.document_number}</span>
            <p className="text-xs text-muted-foreground truncate">{d.title}</p>
          </div>
          <span className="text-xs font-medium text-amber-700">{d.date}</span>
        </div>
      ))}
    </div>
  );
}

export { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
