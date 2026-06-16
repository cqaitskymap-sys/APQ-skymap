'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  AlertTriangle, CheckCircle2, ClipboardList, Clock, Eye, ShieldCheck, XCircle,
} from 'lucide-react';
import { fetchCapaCorrectiveActionDashboard } from '@/lib/capa-corrective-action-service';
import { CpvPageHeader } from '@/components/cpv/product-master/cpv-page-header';
import { KpiCard } from '@/components/admin/dashboard/kpi-card';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { EmptyState } from '@/components/admin/dashboard/empty-state';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { ResponsiveDataTable } from '@/components/cpv/product-master/responsive-data-table';
import { CapaPriorityBadge } from '@/components/capa/capa-sub-nav';
import { CapaCorrectiveActionAccessGuard } from './capa-corrective-action-access-guard';
import { CapaCorrectiveActionStatusBadge } from './capa-corrective-action-badges';
import { CapaCorrectiveActionProgress } from './capa-corrective-action-progress';
import { Button } from '@/components/ui/button';
import type { CapaCorrectiveAction, CapaRecord } from '@/lib/capa-types';

type Row = CapaCorrectiveAction & { capa?: CapaRecord | null };

export function CapaCorrectiveActionListPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [metrics, setMetrics] = useState({
    total: 0, open: 0, implemented: 0, qaVerificationPending: 0, overdue: 0, rejected: 0, closed: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const data = await fetchCapaCorrectiveActionDashboard();
      if (data.error) setError(data.error);
      setRows(data.actions);
      setMetrics(data.metrics);
      setLoading(false);
    })();
  }, []);

  const columns = [
    { key: 'action_number', header: 'Action #', render: (r: Row) => <span className="font-mono text-blue-600">{r.action_number}</span> },
    { key: 'capa_number', header: 'CAPA #', render: (r: Row) => <span className="font-mono">{r.capa_number}</span> },
    { key: 'description', header: 'Description', render: (r: Row) => <span className="line-clamp-2 max-w-xs">{r.corrective_action_description}</span> },
    { key: 'owner', header: 'Owner', render: (r: Row) => r.action_owner_name || r.action_owner || '—' },
    { key: 'department', header: 'Department' },
    { key: 'priority', header: 'Priority', render: (r: Row) => <CapaPriorityBadge priority={r.priority} /> },
    { key: 'target', header: 'Target Date', render: (r: Row) => r.target_completion_date || '—' },
    { key: 'status', header: 'Action Status', render: (r: Row) => <CapaCorrectiveActionStatusBadge status={r.action_status} /> },
    { key: 'progress', header: 'Progress', render: (r: Row) => <CapaCorrectiveActionProgress action={r} /> },
    { key: 'actions', header: '', render: (r: Row) => (
      <Link href={`/qms/capa/${r.capa_id}/corrective-action`}>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0"><Eye className="h-4 w-4" /></Button>
      </Link>
    ) },
  ];

  return (
    <CapaCorrectiveActionAccessGuard>
      <div className="space-y-6">
        <CpvPageHeader
          title="CAPA Corrective Action Plan"
          description="Create, assign, track and verify corrective actions that address identified root causes"
          trail={[
            { label: 'Dashboard', href: '/dashboard' },
            { label: 'QMS', href: '/qms/capa' },
            { label: 'CAPA Management', href: '/qms/capa' },
            { label: 'Corrective Actions' },
          ]}
        />

        {loading ? <LoadingSkeleton rows={3} /> : error ? (
          <ErrorCard title="Load error" message={error} />
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
              <KpiCard label="Total Corrective Actions" value={metrics.total} icon={ClipboardList} />
              <KpiCard label="Open Actions" value={metrics.open} icon={Clock} accent="border-l-amber-500" />
              <KpiCard label="Implemented Actions" value={metrics.implemented} icon={CheckCircle2} accent="border-l-teal-600" />
              <KpiCard label="QA Verification Pending" value={metrics.qaVerificationPending} icon={ShieldCheck} accent="border-l-purple-600" />
              <KpiCard label="Overdue Actions" value={metrics.overdue} icon={AlertTriangle} accent="border-l-red-600" />
              <KpiCard label="Rejected Actions" value={metrics.rejected} icon={XCircle} accent="border-l-orange-600" />
              <KpiCard label="Closed Actions" value={metrics.closed} icon={CheckCircle2} accent="border-l-green-600" />
            </div>

            {rows.length ? (
              <ResponsiveDataTable columns={columns} data={rows} mobileTitleKey="action_number" mobileSubtitleKey="capa_number" pageSize={15} />
            ) : (
              <EmptyState title="No corrective actions yet" message="Complete RCA approval, then create corrective actions from a CAPA record." />
            )}
          </>
        )}
      </div>
    </CapaCorrectiveActionAccessGuard>
  );
}
