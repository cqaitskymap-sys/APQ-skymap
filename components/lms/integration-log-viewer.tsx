'use client';

import { useState } from 'react';
import { Download, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ResponsiveDataTable } from '@/components/cpv/product-master/responsive-data-table';
import type { ColumnDef } from '@/components/admin/admin-data-table';
import { LmsStatusBadge } from './status-badge';
import type { IntegrationLog } from '@/lib/lms-types';
import { exportIntegrationLogs } from '@/lib/lms-service';

interface IntegrationLogViewerProps {
  logs: IntegrationLog[];
}

export function IntegrationLogViewer({ logs }: IntegrationLogViewerProps) {
  const [search, setSearch] = useState('');

  const filtered = logs.filter((l) =>
    !search || l.message.toLowerCase().includes(search.toLowerCase())
    || l.action.toLowerCase().includes(search.toLowerCase()));

  const columns: ColumnDef<IntegrationLog>[] = [
    {
      key: 'created_at',
      header: 'Timestamp',
      render: (l) => <span className="text-xs">{new Date(l.created_at).toLocaleString()}</span>,
    },
    { key: 'level', header: 'Level', render: (l) => <LmsStatusBadge status={l.level} /> },
    { key: 'action', header: 'Action', render: (l) => l.action },
    { key: 'message', header: 'Message', render: (l) => <span className="text-xs">{l.message}</span> },
    { key: 'entity_type', header: 'Entity', render: (l) => l.entity_type || '—' },
  ];

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search logs…"
            className="pl-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button variant="outline" size="sm" onClick={() => exportIntegrationLogs(filtered)}>
          <Download className="h-4 w-4 mr-1" /> Export
        </Button>
      </div>
      <ResponsiveDataTable
        data={filtered}
        columns={columns}
        emptyMessage="No integration logs"
        searchKeys={['message', 'action', 'entity_type']}
        mobileTitleKey="action"
        mobileSubtitleKey="message"
      />
    </div>
  );
}
