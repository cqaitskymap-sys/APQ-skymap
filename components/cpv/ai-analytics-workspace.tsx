'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, Brain, CheckCircle2, Printer, RefreshCw, ShieldAlert, TrendingDown, Zap,
} from 'lucide-react';
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { useCpvAiAnalytics } from '@/hooks/use-cpv-ai-analytics';
import { uniqueProducts } from '@/lib/cpv-dashboard';
import {
  DETECTION_LABELS, SEVERITY_COLORS, type AiDetectionType, type AiSeverity,
} from '@/lib/cpv-ai-analytics';
import { cpvPermissions } from '@/lib/cpv';
import { useAuth } from '@/contexts/auth-context';
import { printPage } from '@/lib/export-utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { DataState, KpiCard, PageHeading } from '@/components/cpv/cpv-ui';
import { listCpvRecords } from '@/lib/cpv-service';
import { CPV_COLLECTIONS, CppRecord, CqaRecord } from '@/lib/cpv';
const SEVERITY_ICON: Record<AiSeverity, React.ElementType> = {
  critical: ShieldAlert,
  high: AlertTriangle,
  medium: AlertTriangle,
  low: CheckCircle2,
  info: Brain,
};

const PIE_COLORS = ['#2563eb', '#dc2626', '#d97706', '#059669', '#7c3aed', '#0891b2'];

function ScoreGauge({ label, score, level, tone }: {
  label: string; score: number; level: string; tone: 'risk' | 'health';
}) {
  const pct = Math.min(100, Math.max(0, score));
  const color = tone === 'risk'
    ? pct >= 75 ? '#dc2626' : pct >= 50 ? '#d97706' : pct >= 25 ? '#ca8a04' : '#059669'
    : pct >= 85 ? '#059669' : pct >= 70 ? '#2563eb' : pct >= 50 ? '#d97706' : '#dc2626';

  return (
    <div className="flex flex-col items-center">
      <div className="relative h-32 w-32">
        <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
          <circle cx="60" cy="60" r="52" fill="none" stroke="#e2e8f0" strokeWidth="10" />
          <circle
            cx="60" cy="60" r="52" fill="none" stroke={color} strokeWidth="10"
            strokeDasharray={`${(pct / 100) * 327} 327`} strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold tabular-nums">{Math.round(score)}</span>
          <span className="text-[10px] uppercase text-muted-foreground">{label}</span>
        </div>
      </div>
      <Badge variant="outline" className="mt-2">{level}</Badge>
    </div>
  );
}

export function AiAnalyticsWorkspace() {
  const { profile } = useAuth();
  const [productFilter, setProductFilter] = useState('all');
  const [products, setProducts] = useState<string[]>([]);
  const { loading, report, reload } = useCpvAiAnalytics({ product: productFilter });

  useEffect(() => {
    void (async () => {
      const [cpp, cqa] = await Promise.all([
        listCpvRecords<CppRecord>(CPV_COLLECTIONS.cpp),
        listCpvRecords<CqaRecord>(CPV_COLLECTIONS.cqa),
      ]);
      setProducts(uniqueProducts(cpp, cqa));
    })();
  }, []);

  const detectionChart = useMemo(() => {
    if (!report) return [];
    return (Object.entries(report.detectionCounts) as [AiDetectionType, number][])
      .filter(([, count]) => count > 0)
      .map(([type, count]) => ({ name: DETECTION_LABELS[type], count, type }));
  }, [report]);

  const severityChart = useMemo(() => {
    if (!report) return [];
    const map = new Map<string, number>();
    report.detections.forEach((d) => map.set(d.severity, (map.get(d.severity) || 0) + 1));
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [report]);

  if (!cpvPermissions.canView(profile?.role)) {
    return (
      <div className="p-6">
        <Card><CardContent className="py-8 text-center text-muted-foreground">Access denied.</CardContent></Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6" id="ai-analytics-print">
      <PageHeading
        title="AI Analytics"
        description="Predictive detection of process drift, OOS/OOT risk, yield loss, equipment impact, and CQA deterioration with risk scoring and management recommendations."
        actions={(
          <>
            <Select value={productFilter} onValueChange={setProductFilter}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="Product" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Products</SelectItem>
                {products.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => reload()} disabled={loading}>
              <RefreshCw className={cn('mr-1 h-4 w-4', loading && 'animate-spin')} />Run Analysis
            </Button>
            <Button variant="outline" onClick={() => printPage()}><Printer className="mr-1 h-4 w-4" />Print</Button>
          </>
        )}
      />

      {loading || !report ? (
        <DataState loading={loading} empty={!loading && !report} emptyText="Run analysis to generate AI insights from CPV data." />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard label="Risk Score" value={report.riskScore} detail={report.riskLevel} tone={report.riskScore >= 50 ? 'red' : 'amber'} />
            <KpiCard label="Health Score" value={report.healthScore} detail={report.healthLevel} tone="green" />
            <KpiCard label="Predictive Alerts" value={report.alerts.length} detail="Actionable signals" tone={report.alerts.length ? 'amber' : 'green'} />
            <KpiCard label="Model Accuracy" value={`${report.modelAccuracy}%`} detail="Trend back-test" tone="blue" />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-1">
              <CardHeader><CardTitle className="text-base">Composite Scores</CardTitle></CardHeader>
              <CardContent className="flex justify-around pb-6">
                <ScoreGauge label="Risk" score={report.riskScore} level={report.riskLevel} tone="risk" />
                <ScoreGauge label="Health" score={report.healthScore} level={report.healthLevel} tone="health" />
              </CardContent>
            </Card>

            <Card className="lg:col-span-1">
              <CardHeader><CardTitle className="text-base">Detection Breakdown</CardTitle></CardHeader>
              <CardContent className="h-[200px]">
                {detectionChart.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={detectionChart} layout="vertical" margin={{ left: 8, right: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" allowDecimals={false} />
                      <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#2563eb" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="py-8 text-center text-sm text-muted-foreground">No detections above threshold.</p>
                )}
              </CardContent>
            </Card>

            <Card className="lg:col-span-1">
              <CardHeader><CardTitle className="text-base">Severity Distribution</CardTitle></CardHeader>
              <CardContent className="h-[200px]">
                {severityChart.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={severityChart} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label>
                        {severityChart.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip /><Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="py-8 text-center text-sm text-muted-foreground">No severity data.</p>
                )}
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="detections">
            <TabsList className="no-print flex h-auto flex-wrap">
              <TabsTrigger value="detections">Detections ({report.detections.length})</TabsTrigger>
              <TabsTrigger value="alerts">Predictive Alerts ({report.alerts.length})</TabsTrigger>
              <TabsTrigger value="recommendations">AI Recommendations ({report.recommendations.length})</TabsTrigger>
              <TabsTrigger value="summary">Management Summary</TabsTrigger>
            </TabsList>

            <TabsContent value="detections" className="mt-4">
              <div className="grid gap-3 md:grid-cols-2">
                {report.detections.length === 0 ? (
                  <Card className="md:col-span-2"><CardContent className="py-8 text-center text-muted-foreground">No predictive detections — process appears stable.</CardContent></Card>
                ) : report.detections.map((d) => {
                  const Icon = SEVERITY_ICON[d.severity];
                  return (
                    <Card key={d.id} className={cn('border-l-4', SEVERITY_COLORS[d.severity].split(' ')[0])}>
                      <CardContent className="p-4">
                        <div className="mb-2 flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2">
                            <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                            <div>
                              <p className="font-semibold text-sm">{d.title}</p>
                              <Badge variant="outline" className="mt-1 text-[10px]">{DETECTION_LABELS[d.type]}</Badge>
                            </div>
                          </div>
                          <Badge>{d.confidence}%</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{d.description}</p>
                        <p className="mt-2 text-xs text-muted-foreground">{d.product} · {d.parameter}</p>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </TabsContent>

            <TabsContent value="alerts" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Zap className="h-5 w-5 text-amber-500" />Predictive Alerts</CardTitle>
                  <CardDescription>Prioritized alerts with recommended actions and response windows.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Severity</TableHead>
                          <TableHead>Alert</TableHead>
                          <TableHead>Product / Parameter</TableHead>
                          <TableHead>Confidence</TableHead>
                          <TableHead>Due Window</TableHead>
                          <TableHead>Recommended Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {report.alerts.length === 0 ? (
                          <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">No active predictive alerts.</TableCell></TableRow>
                        ) : report.alerts.map((a) => (
                          <TableRow key={a.id}>
                            <TableCell><Badge className={cn('capitalize', SEVERITY_COLORS[a.severity])}>{a.severity}</Badge></TableCell>
                            <TableCell className="max-w-[200px]"><p className="font-medium text-sm">{a.title}</p><p className="text-xs text-muted-foreground">{DETECTION_LABELS[a.type]}</p></TableCell>
                            <TableCell className="text-sm">{a.product}<br /><span className="text-muted-foreground">{a.parameter}</span></TableCell>
                            <TableCell>{a.confidence}%</TableCell>
                            <TableCell className="text-sm">{a.dueWindow}</TableCell>
                            <TableCell className="max-w-[280px] text-sm">{a.recommendedAction}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="recommendations" className="mt-4">
              <div className="space-y-3">
                {report.recommendations.map((rec) => (
                  <Card key={rec.id}>
                    <CardContent className="flex gap-4 p-4">
                      <Badge variant={rec.priority === 'Immediate' ? 'destructive' : rec.priority === 'High' ? 'default' : 'secondary'} className="h-fit shrink-0">
                        {rec.priority}
                      </Badge>
                      <div>
                        <p className="font-semibold">{rec.title}</p>
                        <p className="mt-1 text-sm"><span className="font-medium">Action:</span> {rec.action}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{rec.rationale}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="summary" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Brain className="h-5 w-5 text-blue-600" />Management Summary</CardTitle>
                  <CardDescription>Generated {new Date(report.generatedAt).toLocaleString()}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm leading-relaxed">{report.managementSummary}</p>
                  <div>
                    <p className="mb-2 text-sm font-semibold">Key Findings</p>
                    <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
                      {report.summaryBullets.map((b, i) => <li key={i}>{b}</li>)}
                    </ul>
                  </div>
                  <div className="rounded-lg border bg-muted/40 p-4">
                    <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
                      <TrendingDown className="h-4 w-4" />Predictive Models Active
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {Object.entries(DETECTION_LABELS).map(([key, label]) => (
                        <div key={key} className="flex items-center justify-between rounded border bg-background px-3 py-2 text-sm">
                          <span>{label}</span>
                          <Badge variant="outline" className="text-xs">
                            {report.detectionCounts[key as AiDetectionType]} signal(s)
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
