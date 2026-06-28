'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge, VersionBadge } from './status-badge';
import type { DocumentMasterRecord } from '@/lib/document-master-types';

interface DocumentMetadataPanelProps {
  record: DocumentMasterRecord;
  compact?: boolean;
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium truncate">{value || '—'}</dd>
    </div>
  );
}

export function DocumentMetadataPanel({ record, compact }: DocumentMetadataPanelProps) {
  const fields = compact
    ? [
        ['Category', record.document_category],
        ['Department', record.department],
        ['Owner', record.owner_name],
        ['Author', record.author_name],
        ['Effective Date', record.effective_date],
        ['Review Due', record.review_due_date],
      ]
    : [
        ['Document Number', record.document_number],
        ['Short Title', record.short_title],
        ['Category', record.document_category],
        ['Type', record.document_type],
        ['Department', record.department],
        ['Business Unit', record.business_unit],
        ['Site', record.site],
        ['Plant', record.plant],
        ['Process', record.process],
        ['Sub Process', record.sub_process],
        ['Owner', record.owner_name],
        ['Author', record.author_name],
        ['Reviewer', record.reviewer_name],
        ['Approver', record.approver_name],
        ['Effective Date', record.effective_date],
        ['Review Due Date', record.review_due_date],
        ['Expiry Date', record.expiry_date],
        ['Language', record.language],
        ['Country', record.country],
        ['Region', record.region],
        ['Confidentiality', record.confidentiality],
        ['Classification', record.classification],
        ['Training Required', record.training_required ? 'Yes' : 'No'],
        ['Change Control Required', record.change_control_required ? 'Yes' : 'No'],
        ['E-Signature Required', record.electronic_signature_required ? 'Yes' : 'No'],
        ['Linked Change Control', record.linked_change_control],
        ['Created By', record.created_by_name],
        ['Updated By', record.updated_by_name],
      ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-base">{record.document_title}</CardTitle>
          <VersionBadge version={record.version} major={record.major_version} minor={record.minor_version} />
          <StatusBadge status={record.document_status} />
        </div>
        <p className="font-mono text-xs text-muted-foreground">{record.document_number}</p>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {fields.map(([label, value]) => (
            <Field key={label as string} label={label as string} value={value as string | null} />
          ))}
        </dl>
        {(record.keywords.length > 0 || record.tags.length > 0) && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {[...record.keywords, ...record.tags].map((tag) => (
              <span key={tag} className="rounded-full bg-muted px-2 py-0.5 text-xs">{tag}</span>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function DocumentPreview({ record }: { record: DocumentMasterRecord }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
      <p className="font-medium text-foreground mb-1">{record.document_title}</p>
      <p className="font-mono text-xs mb-4">{record.document_number} · v{record.version}</p>
      <p>Document preview available in the Document Library detail view.</p>
    </div>
  );
}
