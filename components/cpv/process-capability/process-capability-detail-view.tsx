'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { cpvPermissions } from '@/lib/cpv';
import {
  fetchProcessCapabilityById, fetchProcessCapabilityAuditTrail,
  approveProcessCapability, reviewProcessCapability, rejectProcessCapability,
  recalculateProcessCapability,
} from '@/lib/cpv-process-capability-service';
import type { ProcessCapabilityRecord } from '@/lib/cpv-process-capability';
import { CpvPageHeader } from '@/components/cpv/product-master/cpv-page-header';
import { CapabilityChart } from './capability-chart';
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

export function ProcessCapabilityDetailView({ id }: { id: string }) {
  const router = useRouter();
  const { user, profile } = useAuth();
  const canReview = cpvPermissions.canReviewProcessCapability(profile?.role);
  const canEdit = cpvPermissions.canEditProcessCapability(profile?.role);
  const [record, setRecord] = useState<ProcessCapabilityRecord | null>(null);
  const [audit, setAudit] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const actor = { id: user?.uid || 'system', name: profile?.full_name || 'System', role: profile?.role || '' };

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetchProcessCapabilityById(id);
    if (!r) { setError('Record not found.'); setLoading(false); return; }
    setRecord(r);
    const auditRows = await fetchProcessCapabilityAuditTrail(id);
    setAudit(auditRows);
    setLoading(false);
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  if (loading) return <div className="p-4 sm:p-6"><LoadingSkeleton rows={1} /></div>;
  if (error || !record) return <div className="p-4 sm:p-6"><ErrorCard message={error || 'Not found'} onRetry={load} /></div>;

  const chartData = [{ label: record.parameterName, cp: record.cp, cpk: record.cpk, ppk: record.ppk }];

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <CpvPageHeader
        title={record.parameterName}
        description={`${record.productName} · ${record.parameterType} · ${record.capabilityId}`}
        trail={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Continued Process Verification', href: '/cpv/dashboard' },
          { label: 'Process Capability', href: '/cpv/process-capability' },
          { label: record.capabilityId },
        ]}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => router.push('/cpv/process-capability')}>
              <ArrowLeft className="h-4 w-4 mr-1" />Back
            </Button>
            {canEdit && (!record.isLocked || canReview) && record.status !== 'Approved' && (
              <Button size="sm" variant="outline" onClick={async () => {
                await recalculateProcessCapability(record.id, actor, record);
                await load();
              }}>Recalculate</Button>
            )}
            {canReview && record.isLocked && record.status === 'Approved' && (
              <Button size="sm" variant="outline" onClick={async () => {
                await recalculateProcessCapability(record.id, actor, record, true);
                await load();
              }}>QA Override Recalculate</Button>
            )}
            {canReview && record.status === 'Calculated' && (
              <Button size="sm" onClick={async () => { await reviewProcessCapability(record.id, actor, record); await load(); }}>Submit Review</Button>
            )}
            {canReview && record.status === 'Under Review' && (
              <>
                <Button size="sm" onClick={async () => { await approveProcessCapability(record.id, actor, record); await load(); }}>Approve</Button>
                <Button size="sm" variant="destructive" onClick={async () => { await rejectProcessCapability(record.id, actor, record); await load(); }}>Reject</Button>
              </>
            )}
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Cpk" value={record.cpk} tone={record.cpk >= 1.33 ? 'green' : 'amber'} />
        <KpiCard label="Cp" value={record.cp} />
        <KpiCard label="Ppk" value={record.ppk} />
        <KpiCard label="Sigma Level" value={record.sigmaLevel} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Statistics</CardTitle></CardHeader>
          <CardContent className="grid gap-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Mean</span><span>{record.mean}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Median</span><span>{record.median}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Min / Max</span><span>{record.minimumValue} / {record.maximumValue}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Range</span><span>{record.range}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Variance</span><span>{record.variance}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Std Dev</span><span>{record.standardDeviation}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Samples</span><span>{record.sampleCount}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Batches</span><span>{record.batchCount}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">LSL / USL</span><span>{record.lowerSpecificationLimit} – {record.upperSpecificationLimit}</span></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Assessment</CardTitle></CardHeader>
          <CardContent className="grid gap-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Capability</span><StatusBadge status={record.capabilityStatus} /></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Risk</span><RiskBadge level={record.riskLevel} /></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Workflow</span><span>{record.status}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Review Period</span><span>{record.reviewPeriodFrom} → {record.reviewPeriodTo}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Data Source</span><span>{record.dataSource}</span></div>
            {record.capaRecommended && <p className="text-amber-700">CAPA recommended</p>}
            {record.conclusion && <p className="text-muted-foreground">{record.conclusion}</p>}
            {record.recommendation && <p>{record.recommendation}</p>}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Capability Indices</CardTitle></CardHeader>
        <CardContent>
          <CapabilityChart data={chartData.map((d) => ({ label: d.label, cp: d.cp, cpk: d.cpk, ppk: d.ppk }))} />
        </CardContent>
      </Card>

      {record.sourcePreview?.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Source Data Histogram</CardTitle></CardHeader>
          <CardContent>
            <div className="rounded-md border bg-slate-50 p-4 text-sm text-muted-foreground">
              Histogram placeholder — {record.sourcePreview.length} source values stored.
              Distribution: min {record.minimumValue}, max {record.maximumValue}, mean {record.mean}.
            </div>
            <div className="mt-3 flex flex-wrap gap-1">
              {record.sourcePreview.slice(0, 30).map((v, i) => (
                <span key={i} className="rounded bg-blue-100 px-1.5 py-0.5 text-xs text-blue-800">{v}</span>
              ))}
              {record.sourcePreview.length > 30 && (
                <span className="text-xs text-muted-foreground">+{record.sourcePreview.length - 30} more</span>
              )}
            </div>
          </CardContent>
        </Card>
      )}

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
