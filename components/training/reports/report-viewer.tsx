'use client';

import { ResponsiveDataTable } from '@/components/cpv/product-master/responsive-data-table';
import type { TrainingReportPreviewRow } from '@/lib/training-reports-records';
import { ReportStatusBadge } from './report-status-badge';

const COLUMNS = [
  { key: 'reference', header: 'Reference', render: (r: TrainingReportPreviewRow) => <span className="font-mono text-xs">{r.reference}</span> },
  { key: 'employee', header: 'Employee', render: (r: TrainingReportPreviewRow) => r.employee },
  { key: 'department', header: 'Department', render: (r: TrainingReportPreviewRow) => r.department },
  { key: 'training', header: 'Training', render: (r: TrainingReportPreviewRow) => <span className="text-xs">{r.training}</span> },
  { key: 'type', header: 'Type', render: (r: TrainingReportPreviewRow) => r.type },
  { key: 'status', header: 'Status', render: (r: TrainingReportPreviewRow) => <ReportStatusBadge status={r.status} /> },
  { key: 'due_date', header: 'Due', render: (r: TrainingReportPreviewRow) => r.due_date },
  { key: 'completed_date', header: 'Completed', render: (r: TrainingReportPreviewRow) => r.completed_date },
  { key: 'score', header: 'Score', render: (r: TrainingReportPreviewRow) => r.score },
  { key: 'trainer', header: 'Trainer', render: (r: TrainingReportPreviewRow) => r.trainer },
];

interface ReportViewerProps {
  rows: TrainingReportPreviewRow[];
  reportType: string;
  summary: string;
  pageSize?: number;
}

export function ReportViewer({ rows, reportType, summary, pageSize = 15 }: ReportViewerProps) {
  return (
    <div className="space-y-3">
      <div className="rounded-lg border bg-muted/30 p-3 text-sm">
        <p className="font-medium">{reportType}</p>
        <p className="text-muted-foreground text-xs mt-1">{summary}</p>
      </div>
      <ResponsiveDataTable
        data={rows.map((r, i) => ({ id: String(i), ...r }))}
        columns={COLUMNS}
        emptyMessage="No records match the selected filters."
        mobileTitleKey="employee"
        mobileSubtitleKey="training"
        pageSize={pageSize}
      />
    </div>
  );
}
