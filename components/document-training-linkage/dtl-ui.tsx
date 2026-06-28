'use client';

import { cn } from '@/lib/utils';
import { trainingLinkStatusColor } from '@/lib/document-training-linkage-types';
import type { DocumentTrainingLinkRecord } from '@/lib/document-training-linkage-types';
import { BookOpen, CheckCircle, GraduationCap, Users } from 'lucide-react';

export function TrainingLinkStatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap', trainingLinkStatusColor(status), className)}>
      {status}
    </span>
  );
}

export function TrainingLinkCard({ record }: { record: DocumentTrainingLinkRecord }) {
  return (
    <div className="rounded-lg border bg-card p-4 space-y-2">
      <div className="flex justify-between gap-2">
        <p className="font-mono text-xs text-muted-foreground">{record.training_link_id}</p>
        <TrainingLinkStatusBadge status={record.status} />
      </div>
      <h3 className="font-semibold truncate">{record.document_title}</h3>
      <p className="text-xs text-muted-foreground">{record.document_number} · v{record.version}</p>
      <p className="text-xs flex items-center gap-1"><BookOpen className="h-3 w-3" /> {record.training_type}</p>
      <p className="text-xs flex items-center gap-1"><GraduationCap className="h-3 w-3" /> {record.training_program}</p>
      <div className="flex gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {record.assignments_count} assigned</span>
        <span className="flex items-center gap-1"><CheckCircle className="h-3 w-3" /> {record.completed_count} done</span>
      </div>
    </div>
  );
}

export function TrainingAssignmentTable({ records, selectedIds, toggleSelect, toggleSelectAll, isReadOnly, compact }: {
  records: DocumentTrainingLinkRecord[];
  selectedIds?: string[];
  toggleSelect?: (id: string) => void;
  toggleSelectAll?: () => void;
  isReadOnly?: boolean;
  compact?: boolean;
}) {
  if (!records.length) return <p className="py-8 text-center text-sm text-muted-foreground">No training links match filters.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            {!isReadOnly && toggleSelect && <th className="p-3 w-10"><input type="checkbox" onChange={toggleSelectAll} className="rounded" /></th>}
            <th className="p-3 text-left font-medium">Document</th>
            <th className="p-3 text-left font-medium">Training Type</th>
            <th className="p-3 text-left font-medium">Due Date</th>
            <th className="p-3 text-left font-medium">Status</th>
            {!compact && <th className="p-3 text-left font-medium hidden md:table-cell">Progress</th>}
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
              <td className="p-3 text-xs">{r.training_type}</td>
              <td className="p-3">{r.training_due_date}</td>
              <td className="p-3"><TrainingLinkStatusBadge status={r.status} /></td>
              {!compact && (
                <td className="p-3 hidden md:table-cell text-xs">
                  {r.completed_count}/{r.assignments_count}
                  {r.overdue_count > 0 && <span className="text-red-600 ml-1">({r.overdue_count} overdue)</span>}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AcknowledgementStatus({ required, completed }: { required: boolean; completed: boolean }) {
  if (!required) return <span className="text-xs text-muted-foreground">Not required</span>;
  return (
    <span className={cn('text-xs font-medium', completed ? 'text-green-700' : 'text-amber-700')}>
      {completed ? 'Acknowledged' : 'Pending acknowledgement'}
    </span>
  );
}

export function AssessmentStatusCard({ required, passingScore }: { required: boolean; passingScore: number }) {
  return (
    <div className="rounded-lg border p-3 text-sm">
      <p className="font-medium">Assessment</p>
      <p>{required ? `Required — ${passingScore}% to pass` : 'Not required'}</p>
    </div>
  );
}

export function TrainingHistory({ entries }: { entries: Array<{ action: string; user: string; date: string }> }) {
  if (!entries.length) return <p className="text-sm text-muted-foreground">No history entries.</p>;
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
