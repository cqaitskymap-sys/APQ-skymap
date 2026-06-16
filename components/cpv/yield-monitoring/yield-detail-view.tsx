'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { cpvPermissions } from '@/lib/cpv';
import {
  fetchYieldRecordById, fetchYieldAuditTrail,
  approveYieldRecord, reviewYieldRecord, yieldStageTrendData, fetchYieldRecords,
} from '@/lib/cpv-yield-monitoring-service';
import type { YieldMonitoringRecord } from '@/lib/cpv-yield-monitoring';
import { CpvPageHeader } from '@/components/cpv/product-master/cpv-page-header';
import { YieldTrendChart } from './yield-trend-chart';
import { KpiCard, StatusBadge } from '@/components/cpv/cpv-ui';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

function RiskBadge({ level }: { level: string }) {
  const cls = level === 'Critical' ? 'bg-red-900/10 text-red-900 border-red-300'
    : level === 'High' ? 'bg-red-50 text-red-700 border-red-200'
      : level === 'Medium' ? 'bg-amber-50 text-amber-700 border-amber-200'
        : 'bg-slate-50 text-slate-600 border-slate-200';
  return <span className={`rounded-md border px-2 py-0.5 text-xs font-medium ${cls}`}>{level}</span>;
}

function YieldBadge({ pct }: { pct: number }) {
  const cls = pct >= 96 ? 'bg-green-50 text-green-700 border-green-200'
    : pct >= 90 ? 'bg-amber-50 text-amber-700 border-amber-200'
      : 'bg-red-50 text-red-700 border-red-200';
  return <span className={`rounded-md border px-2 py-0.5 text-xs font-medium ${cls}`}>{pct}%</span>;
}

export function YieldDetailView({ id }: { id: string }) {
  const router = useRouter();
  const { user, profile } = useAuth();
  const canReview = cpvPermissions.canReviewYield(profile?.role);
  const [record, setRecord] = useState<YieldMonitoringRecord | null>(null);
  const [audit, setAudit] = useState<Record<string, unknown>[]>([]);
  const [trend, setTrend] = useState<ReturnType<typeof yieldStageTrendData>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const actor = { id: user?.uid || 'system', name: profile?.full_name || 'System', role: profile?.role || '' };

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetchYieldRecordById(id);
    if (!r) { setError('Yield record not found.'); setLoading(false); return; }
    setRecord(r);
    const [auditRows, all] = await Promise.all([fetchYieldAuditTrail(id), fetchYieldRecords()]);
    setAudit(auditRows);
    setTrend(yieldStageTrendData(all, r.yieldStage));
    setLoading(false);
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  if (loading) return <div className="p-4 sm:p-6"><LoadingSkeleton rows={1} /></div>;
  if (error || !record) return <div className="p-4 sm:p-6"><ErrorCard message={error || 'Not found'} onRetry={load} /></div>;

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <CpvPageHeader
        title={record.yieldStage}
        description={`${record.batchNumber} · ${record.productName}`}
        trail={[
          { label: 'Continued Process Verification', href: '/cpv/dashboard' },
          { label: 'Yield Monitoring', href: '/cpv/yield-monitoring' },
          { label: record.yieldMonitoringId },
        ]}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => router.push('/cpv/yield-monitoring')}><ArrowLeft className="h-4 w-4 mr-1" />Back</Button>
            {canReview && record.reviewStatus === 'Draft' && (
              <Button size="sm" onClick={async () => { await reviewYieldRecord(record.id, actor, record); await load(); }}>Submit Review</Button>
            )}
            {canReview && record.reviewStatus === 'Under Review' && (
              <Button size="sm" onClick={async () => { await approveYieldRecord(record.id, actor, record); await load(); }}>Approve</Button>
            )}
          </>
        }
      />
      <div className="flex flex-wrap gap-2">
        <YieldBadge pct={record.yieldPercentage} />
        <StatusBadge status={record.status} />
        <RiskBadge level={record.riskLevel} />
        <StatusBadge status={record.reviewStatus} />
      </div>
      <div className="grid gap-4 sm:grid-cols-4">
        <KpiCard label="Yield %" value={`${record.yieldPercentage}%`} tone="blue" />
        <KpiCard label="Target" value={`${record.targetYield}%`} tone="green" />
        <KpiCard label="Variance" value={`${record.variancePercentage}%`} tone="amber" />
        <KpiCard label="Loss Qty" value={String(record.lossQuantity)} tone="red" />
      </div>
      <Card>
        <CardHeader><CardTitle>Yield Details</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 text-sm">
          {[
            ['Yield ID', record.yieldMonitoringId],
            ['Theoretical', record.theoreticalQuantity],
            ['Actual', record.actualQuantity],
            ['Reject', record.rejectQuantity],
            ['Rework', record.reworkQuantity],
            ['Limits', `${record.lowerLimit}% – ${record.upperLimit}%`],
            ['MFG Date', record.manufacturingDate],
            ['Recorded By', record.recordedBy],
            ['Deviation', record.linkedDeviationNumber || '—'],
            ['Remarks', record.remarks],
          ].map(([l, v]) => (
            <div key={l}><p className="text-xs text-muted-foreground">{l}</p><p>{v || '—'}</p></div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-sm">Stage Trend</CardTitle></CardHeader>
        <CardContent><YieldTrendChart data={trend} /></CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-sm">Audit Trail</CardTitle></CardHeader>
        <CardContent>
          {audit.length === 0 ? <p className="text-sm text-muted-foreground">No audit events.</p> : (
            <Table>
              <TableHeader><TableRow><TableHead>Time</TableHead><TableHead>Action</TableHead><TableHead>User</TableHead></TableRow></TableHeader>
              <TableBody>
                {audit.map((a, i) => (
                  <TableRow key={String(a.id || i)}>
                    <TableCell className="text-xs">{String(a.timestamp || a.dateTime || '—')}</TableCell>
                    <TableCell>{String(a.actionType || a.action || '—')}</TableCell>
                    <TableCell>{String(a.changedByUserName || a.userName || '—')}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
