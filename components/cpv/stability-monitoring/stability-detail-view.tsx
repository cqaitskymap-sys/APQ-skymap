'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { cpvPermissions } from '@/lib/cpv';
import {
  fetchStabilityResultById, fetchStabilityAuditTrail, fetchStabilityResults,
  approveStabilityResult, reviewStabilityResult, stabilityParameterTrendData,
  updateStabilityAttachments,
} from '@/lib/cpv-stability-monitoring-service';
import type { StabilityResultRecord } from '@/lib/cpv-stability-monitoring';
import { CpvPageHeader } from '@/components/cpv/product-master/cpv-page-header';
import { ParameterTrendChart } from '@/components/cpv/cpp-monitoring/parameter-trend-chart';
import { StabilityAttachmentUploader } from './stability-attachment-uploader';
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

export function StabilityDetailView({ id }: { id: string }) {
  const router = useRouter();
  const { user, profile } = useAuth();
  const canReview = cpvPermissions.canReviewStability(profile?.role);
  const canEdit = cpvPermissions.canEnterStabilityResults(profile?.role);
  const [record, setRecord] = useState<StabilityResultRecord | null>(null);
  const [audit, setAudit] = useState<Record<string, unknown>[]>([]);
  const [trend, setTrend] = useState<ReturnType<typeof stabilityParameterTrendData>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const actor = { id: user?.uid || 'system', name: profile?.full_name || 'System', role: profile?.role || '' };

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetchStabilityResultById(id);
    if (!r) { setError('Stability result not found.'); setLoading(false); return; }
    setRecord(r);
    const [auditRows, all] = await Promise.all([fetchStabilityAuditTrail(id), fetchStabilityResults()]);
    setAudit(auditRows);
    setTrend(stabilityParameterTrendData(
      all.filter((x) => x.batchNumber === r.batchNumber && x.parameterName === r.parameterName),
      r.parameterName,
    ));
    setLoading(false);
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  const saveAttachments = async (attachments: StabilityResultRecord['attachments']) => {
    if (!record) return;
    const { result } = await updateStabilityAttachments(record.id, attachments, actor, record);
    if (result) setRecord(result);
  };

  if (loading) return <div className="p-4 sm:p-6"><LoadingSkeleton rows={1} /></div>;
  if (error || !record) return <div className="p-4 sm:p-6"><ErrorCard message={error || 'Not found'} onRetry={load} /></div>;

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <CpvPageHeader
        title={record.parameterName}
        description={`${record.batchNumber} · ${record.pullingInterval} · ${record.stabilityStudyNumber}`}
        trail={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Continued Process Verification', href: '/cpv/dashboard' },
          { label: 'Stability Monitoring', href: '/cpv/stability-monitoring' },
          { label: record.stabilityMonitoringId },
        ]}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => router.push('/cpv/stability-monitoring')}>
              <ArrowLeft className="h-4 w-4 mr-1" />Back
            </Button>
            {canReview && record.reviewStatus === 'Draft' && (
              <Button size="sm" onClick={async () => { await reviewStabilityResult(record.id, actor, record); await load(); }}>Submit Review</Button>
            )}
            {canReview && record.reviewStatus === 'Under Review' && (
              <Button size="sm" onClick={async () => { await approveStabilityResult(record.id, actor, record); await load(); }}>
                Approve
              </Button>
            )}
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Observed Result" value={String(record.observedResult)} />
        <KpiCard label="Status" value={record.status} tone={record.status === 'Complies' ? 'green' : 'red'} />
        <KpiCard label="Risk Level" value={record.riskLevel} tone="amber" />
        <KpiCard label="Review Status" value={record.reviewStatus} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Study & Batch</CardTitle></CardHeader>
          <CardContent className="grid gap-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Product</span><span>{record.productName}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Batch</span><span>{record.batchNumber}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Study Type</span><span>{record.studyType}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Storage Condition</span><span>{record.storageCondition}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Interval</span><span>{record.pullingInterval}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Test Date</span><span>{record.testDate}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Analyst</span><span>{record.analyst}</span></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Specification</CardTitle></CardHeader>
          <CardContent className="grid gap-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Target</span><span>{record.targetValue} {record.unit}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Lower Limit</span><span>{record.lowerLimit}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Upper Limit</span><span>{record.upperLimit}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Status</span><StatusBadge status={record.status} /></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Risk</span><RiskBadge level={record.riskLevel} /></div>
            {record.linkedOosNumber && (
              <div className="flex justify-between"><span className="text-muted-foreground">Linked OOS</span><span>{record.linkedOosNumber}</span></div>
            )}
            {record.capaRequired && (
              <div className="flex justify-between"><span className="text-muted-foreground">CAPA</span><span className="text-amber-700">Suggested</span></div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">{record.parameterName} Trend</CardTitle></CardHeader>
        <CardContent>
          <ParameterTrendChart data={trend} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Attachments</CardTitle></CardHeader>
        <CardContent>
          <StabilityAttachmentUploader
            recordId={record.id}
            uploadedBy={actor.name}
            attachments={record.attachments || []}
            onChange={(files) => void saveAttachments(files)}
            disabled={(record.isLocked && !canReview) || !canEdit}
          />
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
