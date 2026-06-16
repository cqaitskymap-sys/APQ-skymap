'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { cpvPermissions } from '@/lib/cpv';
import {
  fetchCppResultById, fetchCppAuditTrail, approveCppResult, reviewCppResult,
  parameterTrendData, fetchCppResults,
} from '@/lib/cpv-cpp-monitoring-service';
import type { CppResultRecord } from '@/lib/cpv-cpp-monitoring';
import { CpvPageHeader } from '@/components/cpv/product-master/cpv-page-header';
import { ParameterTrendChart } from './parameter-trend-chart';
import { KpiCard, StatusBadge } from '@/components/cpv/cpv-ui';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export function CppResultDetailView({ id }: { id: string }) {
  const router = useRouter();
  const { user, profile } = useAuth();
  const canReview = cpvPermissions.canReviewCpp(profile?.role);
  const [record, setRecord] = useState<CppResultRecord | null>(null);
  const [audit, setAudit] = useState<Record<string, unknown>[]>([]);
  const [trend, setTrend] = useState<ReturnType<typeof parameterTrendData>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const actor = { id: user?.uid || 'system', name: profile?.full_name || 'System', role: profile?.role || '' };

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetchCppResultById(id);
    if (!r) { setError('CPP result not found.'); setLoading(false); return; }
    setRecord(r);
    const [auditRows, all] = await Promise.all([fetchCppAuditTrail(id), fetchCppResults()]);
    setAudit(auditRows);
    setTrend(parameterTrendData(all, r.parameterName));
    setLoading(false);
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  if (loading) return <div className="p-4 sm:p-6"><LoadingSkeleton rows={1} /></div>;
  if (error || !record) return <div className="p-4 sm:p-6"><ErrorCard message={error || 'Not found'} onRetry={load} /></div>;

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <CpvPageHeader
        title={record.parameterName}
        description={`${record.batchNumber} · ${record.productName}`}
        trail={[
          { label: 'Continued Process Verification', href: '/cpv/dashboard' },
          { label: 'CPP Monitoring', href: '/cpv/cpp' },
          { label: record.cppResultId },
        ]}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => router.push('/cpv/cpp')}><ArrowLeft className="h-4 w-4 mr-1" />Back</Button>
            {canReview && record.reviewStatus === 'Draft' && (
              <Button size="sm" onClick={async () => { await reviewCppResult(record.id, actor, record); await load(); }}>Submit Review</Button>
            )}
            {canReview && record.reviewStatus === 'Under Review' && (
              <Button size="sm" onClick={async () => { await approveCppResult(record.id, actor, record); await load(); }}>Approve</Button>
            )}
          </>
        }
      />
      <div className="flex flex-wrap gap-2">
        <StatusBadge status={record.status} />
        <StatusBadge status={record.riskLevel} />
        <StatusBadge status={record.reviewStatus} />
      </div>
      <div className="grid gap-4 sm:grid-cols-4">
        <KpiCard label="Observed" value={String(record.observedValue)} tone="blue" />
        <KpiCard label="Target" value={String(record.targetValue ?? '—')} tone="green" />
        <KpiCard label="Limits" value={`${record.lowerLimit} – ${record.upperLimit}`} tone="amber" />
        <KpiCard label="Deviation" value={record.linkedDeviationNumber || '—'} tone="red" />
      </div>
      <Card>
        <CardHeader><CardTitle>Result Details</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 text-sm">
          {[
            ['CPP Result ID', record.cppResultId],
            ['Process Stage', record.processStage],
            ['Criticality', record.criticality],
            ['Observation', record.observationDateTime],
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
