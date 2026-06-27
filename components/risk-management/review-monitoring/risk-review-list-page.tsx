'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle, CheckCircle2, Clock, Eye, Loader2, RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/auth-context';
import type { RiskReviewDashboardMetrics, RiskReviewRecord } from '@/lib/risk-review-monitoring-records';
import type { RiskAssessmentRecord } from '@/lib/cpv-risk-assessment-records';
import {
  escalateOverdueReviews,
  fetchRiskReviewDashboard,
  schedulePeriodicReviews,
} from '@/lib/risk-review-monitoring-service';
import { CpvPageHeader } from '@/components/cpv/product-master/cpv-page-header';
import { KpiCard } from '@/components/admin/dashboard/kpi-card';
import { ResponsiveDataTable } from '@/components/cpv/product-master/responsive-data-table';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { EmptyState } from '@/components/admin/dashboard/empty-state';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { RiskReviewAccessGuard } from './risk-review-access-guard';
import {
  EffectivenessBadge,
  OverdueReviewBadge,
  ReviewStatusBadge,
  RiskLevelBadge,
  RiskTrendBadge,
} from './risk-review-badges';
import { RiskReviewCharts } from './risk-review-charts';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { RiskReviewChartData } from '@/lib/risk-review-monitoring-records';

type ReviewRow = RiskReviewRecord & { overdue: boolean };

export function RiskReviewListPage() {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reviews, setReviews] = useState<RiskReviewRecord[]>([]);
  const [risks, setRisks] = useState<RiskAssessmentRecord[]>([]);
  const [metrics, setMetrics] = useState<RiskReviewDashboardMetrics | null>(null);
  const [charts, setCharts] = useState<RiskReviewChartData | null>(null);

  const actor = useMemo(() => ({
    id: user?.uid || 'system',
    name: profile?.full_name || profile?.email || 'User',
    role: profile?.role,
  }), [user?.uid, profile?.full_name, profile?.email, profile?.role]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchRiskReviewDashboard();
      setReviews(data.reviews);
      setRisks(data.risks);
      setMetrics(data.metrics);
      setCharts(data.charts);
    } catch {
      setError('Failed to load review dashboard.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const today = new Date().toISOString().split('T')[0];
  const reviewRows: ReviewRow[] = useMemo(() => reviews.map((r) => ({
    ...r,
    overdue: Boolean(r.next_review_date && r.next_review_date < today && r.status !== 'Closed'),
  })), [reviews, today]);

  const pendingReviews = reviewRows.filter((r) => ['Draft', 'Under Review', 'QA Review'].includes(r.status));
  const overdueRisks = useMemo(() => risks.filter((r) => {
    if (['Closed', 'Rejected'].includes(r.riskStatus)) return false;
    return ['High', 'Critical'].includes(r.riskLevel);
  }), [risks]);

  const columns = [
    { key: 'risk_number', header: 'Risk No', render: (r: ReviewRow) => <span className="font-mono text-blue-600">{r.risk_number}</span> },
    { key: 'review_date', header: 'Review Date', render: (r: ReviewRow) => r.review_date },
    { key: 'type', header: 'Type', render: (r: ReviewRow) => r.review_type },
    { key: 'reviewer', header: 'Reviewer', render: (r: ReviewRow) => r.reviewer },
    { key: 'trend', header: 'Trend', render: (r: ReviewRow) => <RiskTrendBadge trend={r.risk_trend} /> },
    { key: 'level', header: 'Residual', render: (r: ReviewRow) => <RiskLevelBadge level={r.residual_risk_level} /> },
    { key: 'eff', header: 'Effectiveness', render: (r: ReviewRow) => <EffectivenessBadge evaluation={r.effectiveness_evaluation} /> },
    { key: 'next', header: 'Next Review', render: (r: ReviewRow) => (
      <span className="flex items-center gap-1">{r.next_review_date} <OverdueReviewBadge overdue={r.overdue} /></span>
    ) },
    { key: 'status', header: 'Status', render: (r: ReviewRow) => <ReviewStatusBadge status={r.status} /> },
    { key: 'actions', header: 'Action', render: (r: ReviewRow) => (
      <Link href={`/qms/risk-management/${r.risk_assessment_id}/review-monitoring`}>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0"><Eye className="h-4 w-4" /></Button>
      </Link>
    ) },
  ];

  const riskColumns = [
    { key: 'risk_number', header: 'Risk No', render: (r: RiskAssessmentRecord) => <span className="font-mono text-blue-600">{r.riskNumber}</span> },
    { key: 'level', header: 'Level', render: (r: RiskAssessmentRecord) => <RiskLevelBadge level={r.riskLevel} /> },
    { key: 'owner', header: 'Owner', render: (r: RiskAssessmentRecord) => r.riskOwner },
    { key: 'status', header: 'Status', render: (r: RiskAssessmentRecord) => r.riskStatus },
    { key: 'actions', header: 'Action', render: (r: RiskAssessmentRecord) => (
      <Link href={`/qms/risk-management/${r.id}/review-monitoring`}>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0"><Eye className="h-4 w-4" /></Button>
      </Link>
    ) },
  ];

  const handleEscalate = async () => {
    setBusy(true);
    const count = await escalateOverdueReviews(actor);
    setBusy(false);
    toast.success(count ? `${count} overdue review(s) escalated` : 'No overdue reviews');
    void load();
  };

  const handleSchedule = async () => {
    setBusy(true);
    const count = await schedulePeriodicReviews(actor);
    setBusy(false);
    toast.success(count ? `${count} review(s) scheduled` : 'No reviews due for scheduling');
    void load();
  };

  return (
    <RiskReviewAccessGuard>
      <div className="space-y-6">
        <CpvPageHeader
          title="Risk Review & Monitoring"
          description="Monitor risk effectiveness, trends and continuous compliance"
          trail={[
            { label: 'Dashboard', href: '/dashboard' },
            { label: 'QMS', href: '/qms/risk-management/audit-trail' },
            { label: 'Risk Management', href: '/qms/risk-management/audit-trail' },
            { label: 'Review & Monitoring' },
          ]}
          actions={(
            <>
              <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
                <RefreshCw className="mr-1 h-4 w-4" />Refresh
              </Button>
              <Button variant="outline" size="sm" onClick={handleSchedule} disabled={busy}>Schedule Reviews</Button>
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
              <KpiCard label="Total Reviews" value={metrics?.totalReviews ?? 0} icon={CheckCircle2} accent="border-l-blue-600" />
              <KpiCard label="Pending Reviews" value={metrics?.pendingReviews ?? 0} icon={Clock} accent="border-l-amber-500" />
              <KpiCard label="Approved Reviews" value={metrics?.approvedReviews ?? 0} icon={CheckCircle2} accent="border-l-green-600" />
              <KpiCard label="Overdue Reviews" value={metrics?.overdueReviews ?? 0} icon={AlertTriangle} accent="border-l-red-600" />
              <KpiCard label="Effective Risks" value={metrics?.effectiveRisks ?? 0} icon={CheckCircle2} accent="border-l-emerald-600" />
              <KpiCard label="Partially Effective" value={metrics?.partiallyEffective ?? 0} icon={Clock} accent="border-l-amber-500" />
              <KpiCard label="Not Effective" value={metrics?.notEffective ?? 0} icon={AlertTriangle} accent="border-l-red-600" />
              <KpiCard label="Critical Under Review" value={metrics?.criticalUnderReview ?? 0} icon={AlertTriangle} accent="border-l-purple-600" />
            </div>

            {charts && <RiskReviewCharts charts={charts} />}

            <Tabs defaultValue="pending">
              <TabsList className="flex h-auto flex-wrap gap-1">
                <TabsTrigger value="pending">Pending Reviews</TabsTrigger>
                <TabsTrigger value="all">All Reviews</TabsTrigger>
                <TabsTrigger value="scheduler">Review Scheduler</TabsTrigger>
                <TabsTrigger value="audit">Audit Trail</TabsTrigger>
              </TabsList>

              <TabsContent value="pending" className="mt-4">
                {pendingReviews.length ? (
                  <ResponsiveDataTable columns={columns} data={pendingReviews} mobileTitleKey="risk_number" mobileSubtitleKey="review_type" pageSize={15} />
                ) : (
                  <EmptyState title="No pending reviews" message="Schedule periodic reviews for High/Critical risks." />
                )}
              </TabsContent>

              <TabsContent value="all" className="mt-4">
                {reviewRows.length ? (
                  <ResponsiveDataTable columns={columns} data={reviewRows} mobileTitleKey="risk_number" mobileSubtitleKey="status" pageSize={20} />
                ) : (
                  <EmptyState title="No reviews recorded" message="Start a review from a risk assessment." />
                )}
              </TabsContent>

              <TabsContent value="scheduler" className="mt-4 space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">High / Critical Risks — Periodic Review Required</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {overdueRisks.length ? (
                      <ResponsiveDataTable columns={riskColumns} data={overdueRisks.map((r) => ({ ...r, id: r.id }))} mobileTitleKey="riskNumber" pageSize={15} />
                    ) : (
                      <EmptyState title="No scheduled risks" message="High and Critical risks appear here for periodic review." />
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="audit" className="mt-4">
                <Card>
                  <CardHeader><CardTitle className="text-base">Recent Review Activity</CardTitle></CardHeader>
                  <CardContent>
                    {reviews.length ? (
                      <Table>
                        <TableHeader><TableRow>
                          <TableHead>Risk #</TableHead><TableHead>Date</TableHead><TableHead>Reviewer</TableHead><TableHead>Status</TableHead><TableHead>Conclusion</TableHead>
                        </TableRow></TableHeader>
                        <TableBody>
                          {reviews.slice(0, 30).map((r) => (
                            <TableRow key={r.id}>
                              <TableCell className="font-mono">{r.risk_number}</TableCell>
                              <TableCell>{r.review_date}</TableCell>
                              <TableCell>{r.reviewer}</TableCell>
                              <TableCell><ReviewStatusBadge status={r.status} /></TableCell>
                              <TableCell className="max-w-xs truncate">{r.review_conclusion || '—'}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <p className="text-sm text-muted-foreground">No audit entries yet.</p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </RiskReviewAccessGuard>
  );
}
