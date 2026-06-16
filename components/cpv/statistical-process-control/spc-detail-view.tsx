'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { cpvPermissions } from '@/lib/cpv';
import {
  fetchSpcRecordById, fetchSpcAuditTrail,
  approveSpcRecord, reviewSpcRecord, rejectSpcRecord,
  regenerateSpcRecord, logSpcExport,
} from '@/lib/cpv-spc-service';
import type { SpcRecord } from '@/lib/cpv-spc-records';
import { CpvPageHeader } from '@/components/cpv/product-master/cpv-page-header';
import { ControlChart, MovingRangeChart } from './control-chart';
import { KpiCard } from '@/components/cpv/cpv-ui';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

function SpcStatusBadge({ status }: { status: string }) {
  const cls = status === 'Out Of Control' ? 'bg-red-50 text-red-700 border-red-200'
    : status === 'Warning' ? 'bg-amber-50 text-amber-700 border-amber-200'
      : status === 'In Control' ? 'bg-green-50 text-green-700 border-green-200'
        : 'bg-slate-50 text-slate-600 border-slate-200';
  return <span className={`rounded-md border px-2 py-0.5 text-xs font-medium ${cls}`}>{status}</span>;
}

function RiskBadge({ level }: { level: string }) {
  const cls = level === 'Critical' ? 'bg-red-900/10 text-red-900 border-red-300'
    : level === 'High' ? 'bg-red-50 text-red-700 border-red-200'
      : level === 'Medium' ? 'bg-amber-50 text-amber-700 border-amber-200'
        : 'bg-slate-50 text-slate-600 border-slate-200';
  return <span className={`rounded-md border px-2 py-0.5 text-xs font-medium ${cls}`}>{level}</span>;
}

export function SpcDetailView({ id }: { id: string }) {
  const router = useRouter();
  const { user, profile } = useAuth();
  const canReview = cpvPermissions.canReviewSpc(profile?.role);
  const canEdit = cpvPermissions.canEditSpc(profile?.role);
  const canExport = cpvPermissions.canImportExportSpc(profile?.role);
  const [record, setRecord] = useState<SpcRecord | null>(null);
  const [audit, setAudit] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const actor = { id: user?.uid || 'system', name: profile?.full_name || 'System', role: profile?.role || '' };

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetchSpcRecordById(id);
    if (!r) { setError('Record not found.'); setLoading(false); return; }
    setRecord(r);
    const auditRows = await fetchSpcAuditTrail(id);
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
        description={`${record.productName} · ${record.chartType} · ${record.spcRecordId}`}
        trail={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Continued Process Verification', href: '/cpv/dashboard' },
          { label: 'Statistical Process Control', href: '/cpv/control-charts' },
          { label: record.spcRecordId },
        ]}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => router.push('/cpv/control-charts')}>
              <ArrowLeft className="h-4 w-4 mr-1" />Back
            </Button>
            {canExport && (
              <>
                <Button size="sm" variant="outline" onClick={() => void logSpcExport(actor, 'chart', 1)}>Export Chart</Button>
                <Button size="sm" variant="outline" onClick={() => void logSpcExport(actor, 'report', 1)}>Export PDF</Button>
                <Button size="sm" variant="outline" onClick={() => void logSpcExport(actor, 'data', record.dataPointsCount)}>Export Excel</Button>
              </>
            )}
            {canEdit && record.status !== 'Approved' && (
              <Button size="sm" variant="outline" onClick={async () => {
                await regenerateSpcRecord(record.id, actor, record);
                await load();
              }}>Re-generate</Button>
            )}
            {canReview && record.isLocked && record.status === 'Approved' && (
              <Button size="sm" variant="outline" onClick={async () => {
                await regenerateSpcRecord(record.id, actor, record, true);
                await load();
              }}>QA Override</Button>
            )}
            {canReview && record.status === 'Generated' && (
              <Button size="sm" onClick={async () => { await reviewSpcRecord(record.id, actor, record); await load(); }}>Submit Review</Button>
            )}
            {canReview && record.status === 'Under Review' && (
              <>
                <Button size="sm" onClick={async () => { await approveSpcRecord(record.id, actor, record); await load(); }}>Approve</Button>
                <Button size="sm" variant="destructive" onClick={async () => { await rejectSpcRecord(record.id, actor, record); await load(); }}>Reject</Button>
              </>
            )}
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Center Line" value={record.centerLine} />
        <KpiCard label="UCL" value={record.upperControlLimit} />
        <KpiCard label="LCL" value={record.lowerControlLimit} />
        <KpiCard label="Violations" value={record.ruleViolationsCount} tone={record.ruleViolationsCount > 0 ? 'amber' : 'green'} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Individuals Control Chart</CardTitle></CardHeader>
        <CardContent>
          <ControlChart
            data={record.chartData}
            lsl={record.lowerSpecificationLimit}
            usl={record.upperSpecificationLimit}
            height={360}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Moving Range Chart</CardTitle></CardHeader>
        <CardContent>
          <MovingRangeChart data={record.movingRangeData} height={300} />
        </CardContent>
      </Card>

      {record.xbarChartData.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">X-Bar Chart (placeholder)</CardTitle></CardHeader>
          <CardContent>
            <ControlChart data={record.xbarChartData} title="X-Bar" height={280} />
          </CardContent>
        </Card>
      )}

      {record.rChartData.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">R Chart (placeholder)</CardTitle></CardHeader>
          <CardContent>
            <ControlChart data={record.rChartData} title="R Chart" height={280} />
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Control Limits</CardTitle></CardHeader>
          <CardContent className="grid gap-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">MR Average</span><span>{record.movingRangeAverage}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">R Bar</span><span>{record.averageRange}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Std Dev</span><span>{record.standardDeviation}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Data Points</span><span>{record.dataPointsCount}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">OOC Points</span><span>{record.outOfControlPoints}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">LSL / USL</span><span>{record.lowerSpecificationLimit} – {record.upperSpecificationLimit}</span></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Assessment</CardTitle></CardHeader>
          <CardContent className="grid gap-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">SPC Status</span><SpcStatusBadge status={record.spcStatus} /></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Risk</span><RiskBadge level={record.riskLevel} /></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Workflow</span><span>{record.status}</span></div>
            {record.capaSuggested && <p className="text-amber-700">CAPA suggested</p>}
            {record.conclusion && <p className="text-muted-foreground">{record.conclusion}</p>}
            {record.recommendation && <p>{record.recommendation}</p>}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Rule Violations</CardTitle></CardHeader>
        <CardContent>
          {record.violations.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Batch</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Rule</TableHead>
                  <TableHead>Severity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {record.violations.map((v) => (
                  <TableRow key={v.violationId}>
                    <TableCell>{v.batchNumber}</TableCell>
                    <TableCell>{v.violationType}</TableCell>
                    <TableCell>{v.dataPointValue}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{v.ruleDescription}</TableCell>
                    <TableCell><RiskBadge level={v.severity} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground">No rule violations detected.</p>
          )}
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
