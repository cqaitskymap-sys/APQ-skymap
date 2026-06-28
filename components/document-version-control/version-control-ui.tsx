'use client';

import { cn } from '@/lib/utils';
import { versionStatusColor } from '@/lib/document-version-control-types';
import { GitBranch, Clock, FileText, ArrowRight } from 'lucide-react';
import type { DocumentVersionRecord } from '@/lib/document-version-control-types';

export function VersionStatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap', versionStatusColor(status), className)}>
      {status}
    </span>
  );
}

export function VersionTimeline({ versions }: { versions: DocumentVersionRecord[] }) {
  if (!versions.length) return <p className="text-sm text-muted-foreground">No version history.</p>;
  return (
    <div className="space-y-0">
      {versions.map((v, i) => (
        <div key={v.id} className="flex gap-3">
          <div className="flex flex-col items-center">
            <div className={cn('flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs font-bold',
              v.is_effective ? 'border-green-500 bg-green-50 text-green-700' :
              v.is_latest ? 'border-blue-500 bg-blue-50 text-blue-700' :
              'border-muted bg-muted/30 text-muted-foreground')}>
              {v.revision_number}
            </div>
            {i < versions.length - 1 && <div className="w-0.5 h-8 bg-muted" />}
          </div>
          <div className="pb-4 min-w-0">
            <p className="font-mono text-sm font-semibold">v{v.version_number}</p>
            <div className="flex flex-wrap gap-2 mt-1">
              <VersionStatusBadge status={v.status} />
              <span className="text-xs bg-indigo-50 text-indigo-700 rounded-full px-2 py-0.5">{v.revision_type}</span>
            </div>
            {v.change_summary && <p className="text-xs text-muted-foreground mt-1 truncate">{v.change_summary}</p>}
            <p className="text-xs text-muted-foreground">{new Date(v.created_at).toLocaleDateString()} · {v.author_name}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export function VersionTree({ versions }: { versions: DocumentVersionRecord[] }) {
  if (!versions.length) return <p className="text-sm text-muted-foreground">No version tree.</p>;
  const sorted = [...versions].sort((a, b) => a.revision_number - b.revision_number);
  return (
    <div className="space-y-2 pl-2">
      {sorted.map((v, i) => (
        <div key={v.id} className="flex items-center gap-2" style={{ paddingLeft: `${Math.min(i, 4) * 16}px` }}>
          <GitBranch className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="font-mono text-xs font-medium">v{v.version_number}</span>
          <VersionStatusBadge status={v.status} />
          {v.previous_version && <span className="text-xs text-muted-foreground">← v{v.previous_version}</span>}
        </div>
      ))}
    </div>
  );
}

export function VersionComparison({ from, to, diff }: { from: string; to: string; diff: string }) {
  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex items-center gap-3 text-sm">
        <span className="font-mono font-semibold">v{from}</span>
        <ArrowRight className="h-4 w-4 text-muted-foreground" />
        <span className="font-mono font-semibold">v{to}</span>
      </div>
      <pre className="text-xs bg-muted/50 rounded p-3 whitespace-pre-wrap font-mono max-h-48 overflow-y-auto">{diff}</pre>
      <p className="text-xs text-muted-foreground">Diff Viewer — full side-by-side comparison available in production</p>
    </div>
  );
}

export function ChangeSummaryCard({ record }: { record: DocumentVersionRecord }) {
  return (
    <div className="rounded-lg border bg-card p-4 space-y-2">
      <div className="flex items-center gap-2"><FileText className="h-4 w-4 text-blue-600" /><span className="font-medium">{record.document_title}</span></div>
      <p className="text-sm">v{record.version_number} · {record.revision_type} revision</p>
      <p className="text-sm text-muted-foreground"><strong>Reason:</strong> {record.revision_reason || '—'}</p>
      <p className="text-sm text-muted-foreground"><strong>Summary:</strong> {record.change_summary || '—'}</p>
      {record.training_required && <span className="text-xs bg-amber-50 text-amber-700 rounded px-2 py-0.5">Training Required</span>}
    </div>
  );
}

export function RevisionHistoryTable({ records, selectedIds, toggleSelect, toggleSelectAll, isReadOnly, compact }: {
  records: DocumentVersionRecord[];
  selectedIds?: string[];
  toggleSelect?: (id: string) => void;
  toggleSelectAll?: () => void;
  isReadOnly?: boolean;
  compact?: boolean;
}) {
  if (!records.length) return <p className="py-8 text-center text-sm text-muted-foreground">No versions match filters.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            {!isReadOnly && toggleSelect && <th className="p-3 w-10"><input type="checkbox" onChange={toggleSelectAll} className="rounded" /></th>}
            <th className="p-3 text-left font-medium">Document</th>
            <th className="p-3 text-left font-medium">Version</th>
            <th className="p-3 text-left font-medium hidden md:table-cell">Type</th>
            <th className="p-3 text-left font-medium">Status</th>
            <th className="p-3 text-left font-medium hidden lg:table-cell">Author</th>
            {!compact && <th className="p-3 text-left font-medium hidden xl:table-cell">Created</th>}
          </tr>
        </thead>
        <tbody>
          {records.map((r) => (
            <tr key={r.id} className="border-b hover:bg-muted/30">
              {!isReadOnly && toggleSelect && (
                <td className="p-3"><input type="checkbox" checked={selectedIds?.includes(r.id)} onChange={() => toggleSelect(r.id)} className="rounded" /></td>
              )}
              <td className="p-3 max-w-[180px]">
                <p className="truncate font-medium">{r.document_title}</p>
                <p className="text-xs text-muted-foreground font-mono">{r.document_number}</p>
              </td>
              <td className="p-3 font-mono text-xs">v{r.version_number}{r.is_latest && <span className="ml-1 text-blue-600">latest</span>}</td>
              <td className="p-3 hidden md:table-cell text-muted-foreground">{r.revision_type}</td>
              <td className="p-3"><VersionStatusBadge status={r.status} /></td>
              <td className="p-3 hidden lg:table-cell text-muted-foreground">{r.author_name}</td>
              {!compact && <td className="p-3 hidden xl:table-cell text-muted-foreground">{r.created_at?.split('T')[0] || '—'}</td>}
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
