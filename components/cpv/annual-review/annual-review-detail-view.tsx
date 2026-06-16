'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Archive, Download, Send } from 'lucide-react';
import { toast } from 'sonner';
import {
  Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { useAuth } from '@/contexts/auth-context';
import { cpvPermissions } from '@/lib/cpv';
import {
  buildCpvReviewCharts, reviewStatusLabel, riskLevelColor,
} from '@/lib/cpv-annual-review-records';
import {
  approveCpvReview, archiveCpvReview, fetchCpvReviewAuditTrail, fetchCpvReviewById,
  logCpvReviewExport, submitCpvReviewForApproval,
  toAnnualCpvDocument, updateCpvReview,
} from '@/lib/cpv-annual-review-service';
import { printPage } from '@/lib/export-utils';
import { AnnualCpvPdfDocument } from '@/components/cpv/annual-cpv-pdf-document';
import { CpvPageHeader } from '@/components/cpv/product-master/cpv-page-header';
import { ApprovalTimeline } from './approval-timeline';
import { ReportSectionEditor } from './report-section-editor';
import { KpiCard } from '@/components/cpv/cpv-ui';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export function AnnualReviewDetailView({ id }: { id: string }) {
  const router = useRouter();
  const { user, profile } = useAuth();
  const canEdit = cpvPermissions.canEditAnnualReview(profile?.role);
  const canApprove = cpvPermissions.canApproveAnnualReview(profile?.role);
  const canExport = cpvPermissions.canExportAnnualReview(profile?.role);

  const [record, setRecord] = useState<Awaited<ReturnType<typeof fetchCpvReviewById>>>(null);
  const [audit, setAudit] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [conclusion, setConclusion] = useState('');
  const [recommendations, setRecommendations] = useState('');
  const [executiveSummary, setExecutiveSummary] = useState('');

  const actor = { id: user?.uid || 'system', name: profile?.full_name || 'System', role: profile?.role || '' };

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetchCpvReviewById(id);
    if (!r) { setLoading(false); return; }
    setRecord(r);
    setConclusion(r.conclusion);
    setRecommendations(r.recommendations);
    setExecutiveSummary(r.executiveSummary);
    setAudit(await fetchCpvReviewAuditTrail(id));
    setLoading(false);
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  const charts = useMemo(() => (record ? buildCpvReviewCharts(record.snapshot) : null), [record]);

  if (loading) return <div className="p-4 sm:p-6"><LoadingSkeleton rows={1} /></div>;
  if (!record) return <div className="p-4 sm:p-6"><ErrorCard message="Review not found." onRetry={load} /></div>;

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <CpvPageHeader
        title={record.cpvReviewNumber}
        description={`${record.productName} · ${record.reviewPeriodFrom} to ${record.reviewPeriodTo}`}
        trail={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Continued Process Verification', href: '/cpv/dashboard' },
          { label: 'Annual CPV Review', href: '/cpv/annual-review' },
          { label: record.cpvReviewNumber },
        ]}
        actions={(
          <>
            <Button variant="outline" size="sm" onClick={() => router.push('/cpv/annual-review')}>
              <ArrowLeft className="h-4 w-4 mr-1" />Back
            </Button>
            {canExport && (
              <Button size="sm" variant="outline" onClick={() => { printPage(); void logCpvReviewExport(actor, 'PDF', record.id, record.cpvReviewNumber); }}>
                <Download className="h-4 w-4 mr-1" />Export PDF
              </Button>
            )}
            {canEdit && !['Approved', 'Archived'].includes(record.reviewStatus) && (
              <Button size="sm" onClick={async () => {
                const { error } = await submitCpvReviewForApproval(record.id, actor, { ...record, executiveSummary });
                if (error) return toast.error(error);
                toast.success('Submitted for review');
                await load();
              }}><Send className="h-4 w-4 mr-1" />Submit</Button>
            )}
            {canApprove && record.reviewStatus === 'Approved' && (
              <Button size="sm" variant="outline" onClick={async () => {
                await archiveCpvReview(record.id, actor, record);
                toast.success('Archived');
                await load();
              }}><Archive className="h-4 w-4 mr-1" />Archive</Button>
            )}
          </>
        )}
      />

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Status" value={reviewStatusLabel(record.reviewStatus)} tone="blue" />
        <KpiCard label="Process" value={record.overallProcessStatus} />
        <KpiCard label="Risk" value={record.overallRiskLevel} tone={record.overallRiskLevel === 'Low' ? 'green' : 'red'} />
        <KpiCard label="Avg Cpk" value={record.averageCpk.toFixed(2)} />
      </div>

      <Tabs defaultValue="report">
        <TabsList>
          <TabsTrigger value="report">Report</TabsTrigger>
          <TabsTrigger value="sections">Sections</TabsTrigger>
          <TabsTrigger value="charts">Charts</TabsTrigger>
          <TabsTrigger value="approval">Approval</TabsTrigger>
          <TabsTrigger value="audit">Audit</TabsTrigger>
        </TabsList>

        <TabsContent value="report">
          <AnnualCpvPdfDocument document={toAnnualCpvDocument(record)} />
        </TabsContent>

        <TabsContent value="sections" className="space-y-3">
          <div><Label>Executive Summary</Label><Textarea className="mt-1" rows={3} value={executiveSummary} onChange={(e) => setExecutiveSummary(e.target.value)} disabled={!canEdit} /></div>
          <div><Label>Conclusion</Label><Textarea className="mt-1" rows={3} value={conclusion} onChange={(e) => setConclusion(e.target.value)} disabled={!canEdit} /></div>
          <div><Label>Recommendations</Label><Textarea className="mt-1" rows={3} value={recommendations} onChange={(e) => setRecommendations(e.target.value)} disabled={!canEdit} /></div>
          {canEdit && (
            <Button onClick={async () => {
              const { error } = await updateCpvReview(record.id, { executiveSummary, conclusion, recommendations }, actor, record);
              if (error) return toast.error(error);
              toast.success('Saved');
              await load();
            }}>Save Sections</Button>
          )}
          {(record.sections || []).slice(0, 6).map((section, i) => (
            <ReportSectionEditor key={section.sectionKey} section={section} disabled={!canEdit}
              onChange={(content) => {
                const sections = [...(record.sections || [])];
                sections[i] = { ...sections[i], content };
                setRecord({ ...record, sections });
              }} />
          ))}
        </TabsContent>

        <TabsContent value="charts">
          {charts && (
            <div className="grid gap-4 lg:grid-cols-2">
              <Card><CardHeader><CardTitle className="text-sm">Risk Distribution</CardTitle></CardHeader>
                <CardContent className="h-56"><ResponsiveContainer width="100%" height="100%">
                  <PieChart><Pie data={charts.riskDistribution} dataKey="value" nameKey="name" outerRadius={70} label>
                    {charts.riskDistribution.map((e) => <Cell key={e.name} fill={riskLevelColor(e.name)} />)}
                  </Pie><Tooltip /></PieChart>
                </ResponsiveContainer></CardContent></Card>
              <Card><CardHeader><CardTitle className="text-sm">Cpk</CardTitle></CardHeader>
                <CardContent className="h-56"><ResponsiveContainer width="100%" height="100%">
                  <BarChart data={charts.cpkTrend}><XAxis dataKey="name" /><YAxis domain={[0, 2]} /><Tooltip /><Bar dataKey="value" fill="#2563eb" /></BarChart>
                </ResponsiveContainer></CardContent></Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="approval">
          <ApprovalTimeline signatures={record.signatures} />
        </TabsContent>

        <TabsContent value="audit">
          <Card><CardContent className="pt-6">
            {audit.length ? (
              <Table>
                <TableHeader><TableRow><TableHead>Action</TableHead><TableHead>User</TableHead><TableHead>When</TableHead></TableRow></TableHeader>
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
            ) : <p className="text-sm text-muted-foreground">No audit entries.</p>}
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
