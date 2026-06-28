'use client';

import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ResponsiveDataTable } from '@/components/cpv/product-master/responsive-data-table';
import type { ColumnDef } from '@/components/admin/admin-data-table';
import { LmsStatusBadge } from './status-badge';
import type { LmsSyncJob } from '@/lib/lms-types';
import { formatSyncDuration } from '@/lib/lms-types';

interface SyncJobTableProps {
  jobs: LmsSyncJob[];
  onRetry?: (jobId: string) => void;
  canSync?: boolean;
  syncing?: string | null;
}

export function SyncJobTable({ jobs, onRetry, canSync, syncing }: SyncJobTableProps) {
  const columns: ColumnDef<LmsSyncJob>[] = [
    { key: 'job_id', header: 'Job ID', render: (j) => <span className="font-mono text-xs">{j.job_id}</span> },
    { key: 'connection_name', header: 'Connection', render: (j) => j.connection_name },
    { key: 'sync_mode', header: 'Mode', render: (j) => j.sync_mode },
    { key: 'status', header: 'Status', render: (j) => <LmsStatusBadge status={j.status} /> },
    {
      key: 'records',
      header: 'Records',
      render: (j) => (
        <span className="text-xs">
          {j.records_imported}↑ {j.records_skipped}⊘ {j.records_failed}✗
        </span>
      ),
    },
    { key: 'duration', header: 'Duration', render: (j) => formatSyncDuration(j.duration_ms) },
    { key: 'started_at', header: 'Started', render: (j) => j.started_at ? new Date(j.started_at).toLocaleString() : '—' },
  ];

  return (
    <ResponsiveDataTable
      data={jobs}
      columns={columns}
      emptyMessage="No sync jobs found"
      searchKeys={['job_id', 'connection_name', 'status']}
      mobileTitleKey="connection_name"
      mobileSubtitleKey="job_id"
      actions={canSync ? (j) => j.status === 'Failed' && onRetry ? (
        <Button size="sm" variant="ghost" onClick={() => onRetry(j.id)} disabled={syncing === j.id}>
          <RefreshCw className={`h-3.5 w-3.5 ${syncing === j.id ? 'animate-spin' : ''}`} />
        </Button>
      ) : null : undefined}
    />
  );
}
