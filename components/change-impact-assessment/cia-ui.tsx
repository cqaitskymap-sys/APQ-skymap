'use client';

import { cn } from '@/lib/utils';
import { assessmentStatusColor, impactRatingColor } from '@/lib/change-impact-assessment-types';
import type { DocumentChangeImpactRecord, ImpactDependency } from '@/lib/change-impact-assessment-types';
import { AlertTriangle, FileText, Link2 } from 'lucide-react';

export function ImpactStatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap', assessmentStatusColor(status), className)}>
      {status}
    </span>
  );
}

export function ImpactRatingBadge({ rating, className }: { rating: string; className?: string }) {
  return (
    <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium', impactRatingColor(rating), className)}>
      {rating}
    </span>
  );
}

export function ImpactSummaryCard({ record }: { record: DocumentChangeImpactRecord }) {
  return (
    <div className="rounded-lg border bg-card p-4 space-y-2">
      <div className="flex justify-between gap-2">
        <p className="font-mono text-xs text-muted-foreground">{record.assessment_number}</p>
        <ImpactStatusBadge status={record.assessment_status} />
      </div>
      <h3 className="font-semibold truncate">{record.document_title}</h3>
      <p className="text-xs text-muted-foreground">{record.document_number} · v{record.document_version}</p>
      <div className="flex gap-2 flex-wrap">
        <ImpactRatingBadge rating={record.overall_impact_rating} />
        <span className="text-xs text-muted-foreground">{record.assessment_type}</span>
      </div>
      {record.overall_impact_rating === 'Critical' && (
        <p className="text-xs text-red-700 flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Critical impact</p>
      )}
    </div>
  );
}

export function DependencyGraph({ dependencies }: { dependencies: ImpactDependency[] }) {
  if (!dependencies.length) return <p className="text-sm text-muted-foreground py-4 text-center">No linked dependencies identified.</p>;
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {dependencies.map((d) => (
        <div key={`${d.type}-${d.id}`} className="rounded border p-3 text-sm flex gap-2">
          <Link2 className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
          <div>
            <p className="font-medium">{d.type}: {d.number}</p>
            <p className="text-xs text-muted-foreground truncate">{d.title}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export function ValidationImpactPanel({ record }: { record: DocumentChangeImpactRecord }) {
  return (
    <div className={cn('rounded-lg border p-3 text-sm', record.revalidation_required ? 'border-amber-300 bg-amber-50/50' : 'bg-card')}>
      <p className="font-medium flex items-center gap-1"><FileText className="h-4 w-4" /> Validation Impact</p>
      <p>Rating: <ImpactRatingBadge rating={record.validation_impact} /></p>
      <p>Revalidation: {record.revalidation_required ? 'Required' : 'Not required'}</p>
      {record.linked_validation_id && <p className="text-xs text-muted-foreground mt-1">Linked validation initiated</p>}
    </div>
  );
}

export function TrainingImpactPanel({ record }: { record: DocumentChangeImpactRecord }) {
  return (
    <div className={cn('rounded-lg border p-3 text-sm', record.retraining_required ? 'border-blue-300 bg-blue-50/50' : 'bg-card')}>
      <p className="font-medium">Training Impact</p>
      <p>Rating: <ImpactRatingBadge rating={record.training_impact} /></p>
      <p>Retraining: {record.retraining_required ? 'Required' : 'Not required'}</p>
    </div>
  );
}

export function ImpactAssessmentTable({ records, selectedIds, toggleSelect, toggleSelectAll, isReadOnly, compact }: {
  records: DocumentChangeImpactRecord[];
  selectedIds?: string[];
  toggleSelect?: (id: string) => void;
  toggleSelectAll?: () => void;
  isReadOnly?: boolean;
  compact?: boolean;
}) {
  if (!records.length) return <p className="py-8 text-center text-sm text-muted-foreground">No assessments match filters.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            {!isReadOnly && toggleSelect && <th className="p-3 w-10"><input type="checkbox" onChange={toggleSelectAll} className="rounded" /></th>}
            <th className="p-3 text-left font-medium">Assessment</th>
            <th className="p-3 text-left font-medium">Document</th>
            <th className="p-3 text-left font-medium">Impact</th>
            <th className="p-3 text-left font-medium">Status</th>
            {!compact && <th className="p-3 text-left font-medium hidden md:table-cell">Department</th>}
          </tr>
        </thead>
        <tbody>
          {records.map((r) => (
            <tr key={r.id} className="border-b hover:bg-muted/30">
              {!isReadOnly && toggleSelect && (
                <td className="p-3"><input type="checkbox" checked={selectedIds?.includes(r.id)} onChange={() => toggleSelect(r.id)} className="rounded" /></td>
              )}
              <td className="p-3 font-mono text-xs">{r.assessment_number}</td>
              <td className="p-3">
                <p className="font-medium truncate max-w-[180px]">{r.document_title}</p>
                <p className="text-xs text-muted-foreground">{r.document_number} v{r.document_version}</p>
              </td>
              <td className="p-3"><ImpactRatingBadge rating={r.overall_impact_rating} /></td>
              <td className="p-3"><ImpactStatusBadge status={r.assessment_status} /></td>
              {!compact && <td className="p-3 hidden md:table-cell text-xs">{r.department}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
