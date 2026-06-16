'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { cpvPermissions } from '@/lib/cpv';
import {
  fetchCqaResultById, fetchCqaAuditTrail, approveCqaResult, reviewCqaResult,
  parameterTrendData, fetchCqaResults,
} from '@/lib/cpv-cqa-monitoring-service';
import type { CqaResultRecord } from '@/lib/cpv-cqa-monitoring';
import { CpvPageHeader } from '@/components/cpv/product-master/cpv-page-header';
import { ParameterTrendChart } from '@/components/cpv/cpp-monitoring/parameter-trend-chart';
import { KpiCard, StatusBadge } from '@/components/cpv/cpv-ui';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export function CqaResultDetailView({ id }: { id: string }) {
  const router = useRouter();
  const { user, profile } = useAuth();
  const canReview = cpvPermissions.canReviewCqa(profile?.role);
  const [record, setRecord] = useState<CqaResultRecord | null>(null);
  const [audit, setAudit] = useState<Record<string, unknown>[]>([]);
  const [trend, setTrend] = useState<ReturnType<typeof parameterTrendData>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const actor = { id: user?.uid || 'system', name: profile?.full_name || 'System', role: profile?.role || '' };

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetchCqaResultById(id);
    if (!r) { setError('CQA result not found.'); setLoading(false); return; }
    setRecord(r);
    const [auditRows, all] = await Promise.all([fetchCqaAuditTrail(id), fetchCqaResults()]);
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
          { label: 'CQA Monitoring', href: '/cpv/cqa' },
          { label: record.cqaResultId },
        ]}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => router.push('/cpv/cqa')}><ArrowLeft className="h-4 w-4 mr-1" />Back</Button>
            {canReview && record.reviewStatus === 'Draft' && (
              <Button size="sm" onClick={async () => { await reviewCqaResult(record.id, actor, record); await load(); }}>Submit Review</Button>
            )}
            {canReview && record.reviewStatus === 'Under Review' && (
              <Button size="sm" onClick={async () => { await approveCqaResult(record.id, actor, record); await load(); }}>Approve</Button>
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
        <KpiCard label="Observed" value={String(record.observedResult)} tone="blue" />
        <KpiCard label="Target" value={String(record.targetValue ?? '—')} tone="green" />
        <KpiCard label="Limits" value={`${record.lowerLimit} – ${record.upperLimit}`} tone="amber" />
        <KpiCard label="OOS Ref" value={record.linkedOosNumber || '—'} tone="red" />
      </div>
      <Card>
        <CardHeader><CardTitle className="text-sm">Details</CardTitle></CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2 text-sm">
          <p><span className="text-muted-foreground">Test Stage:</span> {record.testStage}</p>
          <p><span className="text-muted-foreground">Spec No:</span> {record.specificationNumber || '—'}</p>
          <p><span className="text-muted-foreground">STP No:</span> {record.stpNumber || '—'}</p>
          <p><span className="text-muted-foreground">Analyst:</span> {record.analyst}</p>
          <p><span className="text-muted-foreground">Test Date:</span> {record.testDate}</p>
          <p><span className="text-muted-foreground">Deviation:</span> {record.linkedDeviationNumber || '—'}</p>
          <p><span className="text-muted-foreground">CAPA Required:</span> {record.capaRequired ? 'Yes' : 'No'}</p>
          <p className="sm:col-span-2"><span className="text-muted-foreground">Remarks:</span> {record.remarks || '—'}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-sm">Parameter Trend</CardTitle></CardHeader>
        <CardContent><ParameterTrendChart data={trend} /></CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-sm">Audit Trail</CardTitle></CardHeader>
        <CardContent>
          {audit.length === 0 ? <p className="text-sm text-muted-foreground">No audit entries.</p> : (
            <Table>
              <TableHeader><TableRow><TableHead>Action</TableHead><TableHead>User</TableHead><TableHead>When</TableHead></TableRow></TableHeader>
              <TableBody>
                {audit.map((a) => (
                  <TableRow key={String(a.id)}>
                    <TableCell>{String(a.action || a.actionType || '—')}</TableCell>
                    <TableCell>{String(a.userName || a.user_name || '—')}</TableCell>
                    <TableCell>{String(a.timestamp || a.createdAt || '—')}</TableCell>
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
