'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle, CheckCircle2, Clock, Eye, Loader2, RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/auth-context';
import type { RiskMitigationChartData, RiskMitigationDashboardMetrics, RiskMitigationRecord } from '@/lib/risk-mitigation-records';
import type { RiskAssessmentRecord } from '@/lib/cpv-risk-assessment-records';
import {
  escalateOverdueMitigations,
  fetchRiskMitigationDashboard,
} from '@/lib/risk-mitigation-service';
import { CpvPageHeader } from '@/components/cpv/product-master/cpv-page-header';
import { KpiCard } from '@/components/admin/dashboard/kpi-card';
import { ResponsiveDataTable } from '@/components/cpv/product-master/responsive-data-table';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { EmptyState } from '@/components/admin/dashboard/empty-state';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { RiskMitigationAccessGuard } from './risk-mitigation-access-guard';
import { MitigationStatusBadge, OverdueBadge, RiskLevelBadge } from './risk-mitigation-badges';
import { RiskMitigationCharts } from './risk-mitigation-charts';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

type MitigationRow = RiskMitigationRecord & { overdue: boolean };

export function RiskMitigationListPage() {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mitigations, setMitigations] = useState<RiskMitigationRecord[]>([]);
  const [risks, setRisks] = useState<RiskAssessmentRecord[]>([]);
  const [metrics, setMetrics] = useState<RiskMitigationDashboardMetrics | null>(null);
  const [charts, setCharts] = useState<RiskMitigationChartData | null>(null);

  const actor = useMemo(() => ({
    id: user?.uid || 'system',
    name: profile?.full_name || profile?.email || 'User',
    role: profile?.role,
  }), [user?.uid, profile?.full_name, profile?.email, profile?.role]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchRiskMitigationDashboard();
      setMitigations(data.mitigations);
      setRisks(data.risks);
      setMetrics(data.metrics);
      setCharts(data.charts);
    } catch {
      setError('Failed to load mitigation dashboard.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const today = new Date().toISOString().slice(0, 10);
  const rows: MitigationRow[] = useMemo(() => mitigations.map((m) => ({
    ...m,
    overdue: Boolean(m.target_completion_date && m.target_completion_date < today && !['Closed', 'Approved'].includes(m.mitigation_status)),
  })), [mitigations, today]);

  const openRisks = useMemo(() => risks.filter((r) => ['High', 'Critical'].includes(r.riskLevel) && r.riskStatus !== 'Closed'), [risks]);

  const columns = [
    { key: 'risk_number', header: 'Risk No', render: (r: MitigationRow) => <span className="font-mono text-blue-600">{r.risk_number}</span> },
    { key: 'title', header: 'Mitigation', render: (r: MitigationRow) => <span className="line-clamp-1 max-w-xs">{r.mitigation_title}</span> },
    { key: 'owner', header: 'Action Owner', render: (r: MitigationRow) => r.action_owner },
    { key: 'priority', header: 'Priority', render: (r: MitigationRow) => <RiskLevelBadge level={r.priority} /> },
    { key: 'residual', header: 'Residual Level', render: (r: MitigationRow) => <RiskLevelBadge level={r.residual_risk_level} /> },
    { key: 'status', header: 'Status', render: (r: MitigationRow) => <MitigationStatusBadge status={r.mitigation_status} /> },
    { key: 'target', header: 'Target', render: (r: MitigationRow) => <span className="flex items-center gap-1">{r.target_completion_date} <OverdueBadge overdue={r.overdue} /></span> },
    { key: 'actions', header: 'Action', render: (r: MitigationRow) => (
      <Link href={`/qms/risk-management/${r.risk_assessment_id}/mitigation-plan`}>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0"><Eye className="h-4 w-4" /></Button>
      </Link>
    ) },
  ];

  const riskColumns = [
    { key: 'risk_number', header: 'Risk No', render: (r: RiskAssessmentRecord) => <span className="font-mono text-blue-600">{r.riskNumber}</span> },
    { key: 'title', header: 'Title', render: (r: RiskAssessmentRecord) => <span className="line-clamp-1 max-w-xs">{r.parameterName || r.riskDescription}</span> },
    { key: 'level', header: 'Level', render: (r: RiskAssessmentRecord) => <RiskLevelBadge level={r.riskLevel} /> },
    { key: 'status', header: 'Status', render: (r: RiskAssessmentRecord) => r.riskStatus },
    { key: 'actions', header: 'Action', render: (r: RiskAssessmentRecord) => (
      <Link href={`/qms/risk-management/${r.id}/mitigation-plan`}>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0"><Eye className="h-4 w-4" /></Button>
      </Link>
    ) },
  ];

  const handleEscalate = async () => {
    setBusy(true);
    const count = await escalateOverdueMitigations(actor);
    setBusy(false);
    toast.success(count ? `${count} overdue mitigation(s) escalated` : 'No overdue mitigations');
    void load();
  };

  return (
    <RiskMitigationAccessGuard>
      <div className="space-y-6">
        <CpvPageHeader
          title="Risk Mitigation Plan"
          description="Define and implement controls to reduce GMP risks"
          trail={[
            { label: 'Dashboard', href: '/dashboard' },
            { label: 'QMS', href: '/qms/risk-management/audit-trail' },
            { label: 'Risk Management', href: '/qms/risk-management/audit-trail' },
            { label: 'Mitigation Plan' },
          ]}
          actions={(
            <>
              <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
                <RefreshCw className="mr-1 h-4 w-4" />Refresh
              </Button>
              <Button variant="outline" size="sm" onClick={handleEscalate} disabled={busy}>
                {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}Escalate Overdue
              </Button>
            </>
          )}
        />

        {loading ? <LoadingSkeleton rows={2} /> : error ? (
          <ErrorCard title="Load error" message={error} onRetry={load} />
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
              <KpiCard label="Total Mitigations" value={metrics?.totalMitigations ?? 0} icon={CheckCircle2} accent="border-l-blue-600" />
              <KpiCard label="Open Mitigations" value={metrics?.openMitigations ?? 0} icon={Clock} accent="border-l-amber-500" />
              <KpiCard label="Implemented" value={metrics?.implementedMitigations ?? 0} icon={CheckCircle2} accent="border-l-green-600" />
              <KpiCard label="Overdue" value={metrics?.overdueMitigations ?? 0} icon={AlertTriangle} accent="border-l-red-600" />
              <KpiCard label="Critical Risks" value={metrics?.criticalRiskMitigations ?? 0} icon={AlertTriangle} accent="border-l-red-700" />
              <KpiCard label="Residual High" value={metrics?.residualHighRisks ?? 0} icon={AlertTriangle} accent="border-l-orange-600" />
              <KpiCard label="CAPA Linked" value={metrics?.capaLinkedMitigations ?? 0} icon={CheckCircle2} accent="border-l-violet-600" />
              <KpiCard label="Pending Reviews" value={metrics?.pendingReviews ?? 0} icon={Clock} accent="border-l-indigo-600" />
            </div>

            {charts ? <RiskMitigationCharts charts={charts} /> : null}

            <Tabs defaultValue="mitigations">
              <TabsList className="flex h-auto flex-wrap gap-1">
                <TabsTrigger value="mitigations">Mitigation Overview</TabsTrigger>
                <TabsTrigger value="risks">Action Management</TabsTrigger>
                <TabsTrigger value="audit">Audit Trail</TabsTrigger>
              </TabsList>

              <TabsContent value="mitigations" className="mt-4">
                {rows.length ? (
                  <ResponsiveDataTable columns={columns} data={rows} mobileTitleKey="risk_number" mobileSubtitleKey="mitigation_title" pageSize={15} />
                ) : (
                  <EmptyState title="No mitigation plans" message="Create mitigation plans for high and critical risks." />
                )}
              </TabsContent>

              <TabsContent value="risks" className="mt-4">
                {openRisks.length ? (
                  <ResponsiveDataTable columns={riskColumns} data={openRisks} mobileTitleKey="riskNumber" mobileSubtitleKey="riskLevel" pageSize={15} />
                ) : (
                  <EmptyState title="No high/critical risks pending mitigation" message="All high priority risks are already mitigated or closed." />
                )}
              </TabsContent>

              <TabsContent value="audit" className="mt-4">
                <Card>
                  <CardHeader><CardTitle className="text-base">Mitigation Snapshot</CardTitle></CardHeader>
                  <CardContent>
                    {rows.length ? (
                      <Table>
                        <TableHeader><TableRow>
                          <TableHead>Risk #</TableHead><TableHead>Mitigation</TableHead><TableHead>Status</TableHead><TableHead>Residual</TableHead><TableHead>Owner</TableHead>
                        </TableRow></TableHeader>
                        <TableBody>
                          {rows.slice(0, 30).map((m) => (
                            <TableRow key={m.id}>
                              <TableCell className="font-mono">{m.risk_number}</TableCell>
                              <TableCell className="max-w-xs truncate">{m.mitigation_title}</TableCell>
                              <TableCell><MitigationStatusBadge status={m.mitigation_status} /></TableCell>
                              <TableCell><RiskLevelBadge level={m.residual_risk_level} /></TableCell>
                              <TableCell>{m.action_owner}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : <p className="text-sm text-muted-foreground">No mitigation activity yet.</p>}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </RiskMitigationAccessGuard>
  );
}
