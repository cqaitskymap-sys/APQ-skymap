'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { cpvPermissions } from '@/lib/cpv';
import {
  fetchTrendAnalysisById, fetchTrendAnalysisAuditTrail,
  approveTrendAnalysis, reviewTrendAnalysis, rejectTrendAnalysis,
  regenerateTrendAnalysis, logTrendExport,
} from '@/lib/cpv-trend-analysis-service';
import type { TrendAnalysisRecord } from '@/lib/cpv-trend-records';
import { CpvPageHeader } from '@/components/cpv/product-master/cpv-page-header';
import { ParameterTrendChart } from './parameter-trend-chart';
import { KpiCard } from '@/components/cpv/cpv-ui';
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

function TrendStatusBadge({ status }: { status: string }) {
  const cls = status === 'OOS' ? 'bg-red-50 text-red-700 border-red-200'
    : status === 'OOT' || status === 'Action Required' ? 'bg-orange-50 text-orange-700 border-orange-200'
      : status === 'Alert' ? 'bg-amber-50 text-amber-700 border-amber-200'
        : 'bg-slate-50 text-slate-600 border-slate-200';
  return <span className={`rounded-md border px-2 py-0.5 text-xs font-medium ${cls}`}>{status}</span>;
}

export function TrendAnalysisDetailView({ id }: { id: string }) {
  const router = useRouter();
  const { user, profile } = useAuth();
  const canReview = cpvPermissions.canReviewTrendAnalysis(profile?.role);
  const canEdit = cpvPermissions.canEditTrendAnalysis(profile?.role);
  const canExport = cpvPermissions.canImportExportTrendAnalysis(profile?.role);
  const [record, setRecord] = useState<TrendAnalysisRecord | null>(null);
  const [audit, setAudit] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const actor = { id: user?.uid || 'system', name: profile?.full_name || 'System', role: profile?.role || '' };

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetchTrendAnalysisById(id);
    if (!r) { setError('Record not found.'); setLoading(false); return; }
    setRecord(r);
    const auditRows = await fetchTrendAnalysisAuditTrail(id);
    setAudit(auditRows);
    setLoading(false);
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  if (loading) return <div className="p-4 sm:p-6"><LoadingSkeleton rows={1} /></div>;
  if (error || !record) return <div className="p-4 sm:p-6"><ErrorCard message={error || 'Not found'} onRetry={load} /></div>;

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <CpvPageHeader
        title={record.parameterName}
        description={`${record.productName} · ${record.trendType} · ${record.trendId}`}
        trail={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Continued Process Verification', href: '/cpv/dashboard' },
          { label: 'Trend Analysis', href: '/cpv/trend-analysis' },
          { label: record.trendId },
        ]}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => router.push('/cpv/trend-analysis')}>
              <ArrowLeft className="h-4 w-4 mr-1" />Back
            </Button>
            {canExport && (
              <>
                <Button size="sm" variant="outline" onClick={() => void logTrendExport(actor, 'chart', 1)}>
                  Export Chart
                </Button>
                <Button size="sm" variant="outline" onClick={() => void logTrendExport(actor, 'report', 1)}>
                  Export PDF
                </Button>
                <Button size="sm" variant="outline" onClick={() => void logTrendExport(actor, 'data', record.dataPointsCount)}>
                  Export Excel
                </Button>
              </>
            )}
            {canEdit && record.status !== 'Approved' && (
              <Button size="sm" variant="outline" onClick={async () => {
                await regenerateTrendAnalysis(record.id, actor, record);
                await load();
              }}>Re-generate</Button>
            )}
            {canReview && record.isLocked && record.status === 'Approved' && (
              <Button size="sm" variant="outline" onClick={async () => {
                await regenerateTrendAnalysis(record.id, actor, record, true);
                await load();
              }}>QA Override</Button>
            )}
            {canReview && record.status === 'Generated' && (
              <Button size="sm" onClick={async () => { await reviewTrendAnalysis(record.id, actor, record); await load(); }}>Submit Review</Button>
            )}
            {canReview && record.status === 'Under Review' && (
              <>
                <Button size="sm" onClick={async () => { await approveTrendAnalysis(record.id, actor, record); await load(); }}>Approve</Button>
                <Button size="sm" variant="destructive" onClick={async () => { await rejectTrendAnalysis(record.id, actor, record); await load(); }}>Reject</Button>
              </>
            )}
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Mean" value={record.mean} />
        <KpiCard label="Min" value={record.minimumValue} />
        <KpiCard label="Max" value={record.maximumValue} />
        <KpiCard label="Std Dev" value={record.standardDeviation} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Trend Chart</CardTitle></CardHeader>
        <CardContent>
          <ParameterTrendChart data={record.chartData} title={`${record.parameterName} trend`} height={360} />
          <div className="mt-4 grid gap-3 sm:grid-cols-3 text-xs text-muted-foreground">
            <div className="rounded-md border border-dashed p-3">Bar chart view — placeholder</div>
            <div className="rounded-md border border-dashed p-3">Area chart view — placeholder</div>
            <div className="rounded-md border border-dashed p-3">Scatter plot — placeholder</div>
          </div>
        </CardContent>
      </Card>

      {record.sourcePreview?.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Batch-to-Batch Source Data</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Batch</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>LSL</TableHead>
                  <TableHead>USL</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {record.sourcePreview.map((p, i) => (
                  <TableRow key={i}>
                    <TableCell>{p.batchNumber}</TableCell>
                    <TableCell>{p.value}</TableCell>
                    <TableCell>{p.date}</TableCell>
                    <TableCell>{Number.isFinite(p.lsl) ? p.lsl : '—'}</TableCell>
                    <TableCell>{Number.isFinite(p.usl) ? p.usl : '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Statistics</CardTitle></CardHeader>
          <CardContent className="grid gap-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Direction</span><span>{record.trendDirection}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Data Points</span><span>{record.dataPointsCount}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Batches</span><span>{record.batchCount}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">OOT / OOS</span><span>{record.ootCount} / {record.oosCount}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Alerts / Actions</span><span>{record.alertCount} / {record.actionCount}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Review Period</span><span>{record.reviewPeriodFrom} → {record.reviewPeriodTo}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Generated</span><span>{record.generatedBy} · {record.generatedDate}</span></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Assessment</CardTitle></CardHeader>
          <CardContent className="grid gap-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Trend Status</span><TrendStatusBadge status={record.trendStatus} /></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Risk</span><RiskBadge level={record.riskLevel} /></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Workflow</span><span>{record.status}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Data Source</span><span>{record.dataSource}</span></div>
            {record.capaSuggested && <p className="text-amber-700">CAPA suggested</p>}
            {record.conclusion && <p className="text-muted-foreground">{record.conclusion}</p>}
            {record.recommendation && <p>{record.recommendation}</p>}
          </CardContent>
        </Card>
      </div>

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
