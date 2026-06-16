'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { cpvPermissions } from '@/lib/cpv';
import {
  fetchHoldTimeRecordById, fetchHoldTimeAuditTrail, fetchHoldTimeRecords,
  approveHoldTimeRecord, reviewHoldTimeRecord, holdTimeStageTrendData,
} from '@/lib/cpv-hold-time-monitoring-service';
import type { HoldTimeMonitoringRecord } from '@/lib/cpv-hold-time-monitoring';
import { CpvPageHeader } from '@/components/cpv/product-master/cpv-page-header';
import { ParameterTrendChart } from '@/components/cpv/cpp-monitoring/parameter-trend-chart';
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

export function HoldTimeDetailView({ id }: { id: string }) {
  const router = useRouter();
  const { user, profile } = useAuth();
  const canReview = cpvPermissions.canReviewHoldTime(profile?.role);
  const [record, setRecord] = useState<HoldTimeMonitoringRecord | null>(null);
  const [audit, setAudit] = useState<Record<string, unknown>[]>([]);
  const [trend, setTrend] = useState<ReturnType<typeof holdTimeStageTrendData>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const actor = { id: user?.uid || 'system', name: profile?.full_name || 'System', role: profile?.role || '' };

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetchHoldTimeRecordById(id);
    if (!r) { setError('Hold time record not found.'); setLoading(false); return; }
    setRecord(r);
    const [auditRows, all] = await Promise.all([fetchHoldTimeAuditTrail(id), fetchHoldTimeRecords()]);
    setAudit(auditRows);
    setTrend(holdTimeStageTrendData(all, r.holdStage));
    setLoading(false);
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  if (loading) return <div className="p-4 sm:p-6"><LoadingSkeleton rows={1} /></div>;
  if (error || !record) return <div className="p-4 sm:p-6"><ErrorCard message={error || 'Not found'} onRetry={load} /></div>;

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <CpvPageHeader
        title={record.holdStage}
        description={`${record.batchNumber} · ${record.productName}`}
        trail={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Continued Process Verification', href: '/cpv/dashboard' },
          { label: 'Hold Time Monitoring', href: '/cpv/hold-time-monitoring' },
          { label: record.holdTimeId },
        ]}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => router.push('/cpv/hold-time-monitoring')}>
              <ArrowLeft className="h-4 w-4 mr-1" />Back
            </Button>
            {canReview && record.reviewStatus === 'Draft' && (
              <Button size="sm" onClick={async () => { await reviewHoldTimeRecord(record.id, actor, record); await load(); }}>Submit Review</Button>
            )}
            {canReview && record.reviewStatus === 'Under Review' && (
              <Button size="sm" onClick={async () => { await approveHoldTimeRecord(record.id, actor, record); await load(); }}>Approve</Button>
            )}
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Actual Hold Time" value={`${record.actualHoldTime} ${record.holdTimeUnit}`} />
        <KpiCard label="Allowed" value={`${record.allowedHoldTime} ${record.holdTimeUnit}`} />
        <KpiCard label="Difference" value={record.difference} />
        <KpiCard label="Status" value={record.status} tone={record.status === 'Complies' ? 'green' : 'red'} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Hold Details</CardTitle></CardHeader>
          <CardContent className="grid gap-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Product</span><span>{record.productName}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Batch</span><span>{record.batchNumber}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Process Stage</span><span>{record.processStage}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Start</span><span>{record.startDateTime}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">End</span><span>{record.endDateTime}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Risk</span><RiskBadge level={record.riskLevel} /></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Review</span><span>{record.reviewStatus}</span></div>
            {record.linkedDeviationNumber && (
              <div className="flex justify-between"><span className="text-muted-foreground">Deviation</span><span>{record.linkedDeviationNumber}</span></div>
            )}
            {record.capaRequired && (
              <div className="flex justify-between"><span className="text-muted-foreground">CAPA</span><span className="text-amber-700">Suggested</span></div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Compliance</CardTitle></CardHeader>
          <CardContent className="grid gap-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Status</span><StatusBadge status={record.status} /></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Reason</span><span>{record.reasonForHold || '—'}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Extension</span><span>{record.extensionApproved ? 'Yes' : 'No'}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Remarks</span><span>{record.remarks || '—'}</span></div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Stage Trend</CardTitle></CardHeader>
        <CardContent>
          <ParameterTrendChart data={trend} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Audit Trail</CardTitle></CardHeader>
        <CardContent>
          {audit.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Action</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {audit.map((row) => (
                  <TableRow key={String(row.id)}>
                    <TableCell>{String(row.action || row.actionType || '')}</TableCell>
                    <TableCell>{String(row.userName || row.userId || '')}</TableCell>
                    <TableCell>{String(row.createdAt || row.timestamp || '')}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground">No audit entries yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
