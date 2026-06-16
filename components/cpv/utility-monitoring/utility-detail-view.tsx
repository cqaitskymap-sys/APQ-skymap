'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { cpvPermissions } from '@/lib/cpv';
import {
  fetchUtilityRecordById, fetchUtilityAuditTrail, approveUtilityRecord, reviewUtilityRecord,
  utilityParameterTrendData, fetchUtilityRecords,
} from '@/lib/cpv-utility-monitoring-service';
import type { UtilityMonitoringRecord } from '@/lib/cpv-utility-monitoring';
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

function UtilityTypeBadge({ type }: { type: string }) {
  return <span className="rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-800">{type}</span>;
}

export function UtilityDetailView({ id }: { id: string }) {
  const router = useRouter();
  const { user, profile } = useAuth();
  const canReview = cpvPermissions.canReviewUtility(profile?.role);
  const [record, setRecord] = useState<UtilityMonitoringRecord | null>(null);
  const [audit, setAudit] = useState<Record<string, unknown>[]>([]);
  const [trend, setTrend] = useState<ReturnType<typeof utilityParameterTrendData>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const actor = { id: user?.uid || 'system', name: profile?.full_name || 'System', role: profile?.role || '' };

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetchUtilityRecordById(id);
    if (!r) { setError('Utility record not found.'); setLoading(false); return; }
    setRecord(r);
    const [auditRows, all] = await Promise.all([fetchUtilityAuditTrail(id), fetchUtilityRecords()]);
    setAudit(auditRows);
    setTrend(utilityParameterTrendData(all, r.parameterName));
    setLoading(false);
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  if (loading) return <div className="p-4 sm:p-6"><LoadingSkeleton rows={1} /></div>;
  if (error || !record) return <div className="p-4 sm:p-6"><ErrorCard message={error || 'Not found'} onRetry={load} /></div>;

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <CpvPageHeader
        title={record.parameterName}
        description={`${record.batchNumber} · ${record.utilitySystemName}`}
        trail={[
          { label: 'Continued Process Verification', href: '/cpv/dashboard' },
          { label: 'Utility Monitoring', href: '/cpv/utility-monitoring' },
          { label: record.utilityMonitoringId },
        ]}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => router.push('/cpv/utility-monitoring')}><ArrowLeft className="h-4 w-4 mr-1" />Back</Button>
            {canReview && record.reviewStatus === 'Draft' && (
              <Button size="sm" onClick={async () => { await reviewUtilityRecord(record.id, actor, record); await load(); }}>Submit Review</Button>
            )}
            {canReview && record.reviewStatus === 'Under Review' && (
              <Button size="sm" onClick={async () => { await approveUtilityRecord(record.id, actor, record); await load(); }}>Approve</Button>
            )}
          </>
        }
      />
      <div className="flex flex-wrap gap-2">
        <UtilityTypeBadge type={record.utilityType} />
        <StatusBadge status={record.status} />
        <RiskBadge level={record.riskLevel} />
        <StatusBadge status={record.reviewStatus} />
        <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-700">{record.samplingPoint}</span>
      </div>
      <div className="grid gap-4 sm:grid-cols-4">
        <KpiCard label="Observed" value={String(record.observedValue)} tone="blue" />
        <KpiCard label="Target" value={String(record.targetValue ?? '—')} tone="green" />
        <KpiCard label="Limits" value={`${record.lowerLimit} – ${record.upperLimit} ${record.unit}`} tone="amber" />
        <KpiCard label="Deviation" value={record.linkedDeviationNumber || '—'} tone="red" />
      </div>
      <Card>
        <CardHeader><CardTitle>Utility Details</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 text-sm">
          {[
            ['Utility Monitoring ID', record.utilityMonitoringId],
            ['Utility System', record.utilitySystemName],
            ['Sampling Point', record.samplingPoint],
            ['Area / Room', record.areaRoomNo],
            ['Department', record.department],
            ['Monitoring Date', `${record.monitoringDate} ${record.monitoringTime}`],
            ['Recorded By', record.recordedBy],
            ['Reviewed By', record.reviewedBy],
            ['CAPA Required', record.capaRequired ? 'Yes' : 'No'],
            ['Remarks', record.remarks],
          ].map(([l, v]) => (
            <div key={l}><p className="text-xs text-muted-foreground">{l}</p><p>{v || '—'}</p></div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-sm">Parameter Trend</CardTitle></CardHeader>
        <CardContent><ParameterTrendChart data={trend} /></CardContent>
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
