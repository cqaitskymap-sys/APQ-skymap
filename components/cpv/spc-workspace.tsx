'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  CartesianGrid, ComposedChart, Legend, Line, LineChart,
  ReferenceLine, ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis,
} from 'recharts';
import { addDoc, collection } from 'firebase/firestore';
import { AlertTriangle, Link2, Printer, Save } from 'lucide-react';
import { toast } from 'sonner';
import { firestore } from '@/lib/firebase';
import { useAuth } from '@/contexts/auth-context';
import { CPV_COLLECTIONS, CppRecord, CqaRecord } from '@/lib/cpv';
import {
  SpcChartResult, SpcDataSource, buildSpcReport, filterSpcObservations,
  mergeSpcObservations, runSpcAnalysis, spcFilterOptions,
} from '@/lib/cpv-spc';
import { listCpvRecords } from '@/lib/cpv-service';
import { printPage } from '@/lib/export-utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { DataState, KpiCard, PageHeading, StatusBadge } from '@/components/cpv/cpv-ui';

const colors = { blue: '#2563eb', green: '#059669', amber: '#d97706', red: '#dc2626' };

function chartPlotData(result: SpcChartResult) {
  return result.points.map((p) => ({
    index: p.index,
    batch: p.batch,
    value: p.value,
    cl: result.limits.centerLine,
    ucl: result.limits.ucl,
    lcl: result.limits.lcl,
    violation: p.specialCause ? p.value : null,
    outOfControl: p.outOfControl,
  }));
}

function ControlChart({ result, height = 360 }: { result: SpcChartResult; height?: number }) {
  const data = chartPlotData(result);
  const { limits } = result;

  return (
    <Card className="break-inside-avoid shadow-sm">
      <CardHeader className="border-b bg-slate-50/70 py-3 dark:bg-slate-900/30">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-sm font-medium">{result.title}</CardTitle>
          <div className="flex gap-2 text-xs">
            <Badge variant={result.inControl ? 'outline' : 'destructive'} className="text-xs">
              {result.inControl ? 'In Control' : 'Special Cause'}
            </Badge>
            {result.outOfControlCount > 0 && (
              <Badge variant="destructive" className="text-xs">{result.outOfControlCount} OOC</Badge>
            )}
          </div>
        </div>
        <CardDescription className="text-xs">
          CL {limits.centerLine} · UCL {limits.ucl} · LCL {limits.lcl}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-4" style={{ height }}>
        {!data.length ? (
          <DataState loading={false} empty emptyText="Insufficient data for this chart." />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 10, right: 20, left: 5, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="index" tick={{ fontSize: 11 }} label={{ value: 'Sample', position: 'insideBottom', offset: -5, fontSize: 11 }} />
              <YAxis domain={['auto', 'auto']} tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={(value: number, name: string) => [value, name]}
                labelFormatter={(label) => {
                  const point = data.find((d) => d.index === label);
                  return point ? `Sample ${label} · ${point.batch}` : `Sample ${label}`;
                }}
              />
              <Legend verticalAlign="top" height={28} />
              <ReferenceLine y={limits.ucl} stroke={colors.red} strokeDasharray="5 5" label={{ value: 'UCL', fontSize: 10 }} />
              <ReferenceLine y={limits.centerLine} stroke={colors.green} label={{ value: 'CL', fontSize: 10 }} />
              <ReferenceLine y={limits.lcl} stroke={colors.red} strokeDasharray="5 5" label={{ value: 'LCL', fontSize: 10 }} />
              <Line type="monotone" dataKey="value" name="Observed" stroke={colors.blue} strokeWidth={2} dot={{ r: 4, fill: colors.blue }} />
              <Scatter dataKey="violation" name="Out of Control" fill={colors.red} shape="circle" />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

function MrChart({ result }: { result: SpcChartResult }) {
  const data = result.points.map((p) => ({
    index: p.index,
    batch: p.batch,
    value: p.value,
    violation: p.outOfControl ? p.value : null,
  }));

  return (
    <Card className="break-inside-avoid shadow-sm">
      <CardHeader className="border-b bg-slate-50/70 py-3 dark:bg-slate-900/30">
        <CardTitle className="text-sm font-medium">{result.title}</CardTitle>
        <CardDescription className="text-xs">
          CL {result.limits.centerLine} · UCL {result.limits.ucl} · LCL {result.limits.lcl}
        </CardDescription>
      </CardHeader>
      <CardContent className="h-[360px] pt-4">
        {!data.length ? (
          <DataState loading={false} empty emptyText="Insufficient data for MR chart." />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 10, right: 20, left: 5, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="index" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <ReferenceLine y={result.limits.ucl} stroke={colors.red} strokeDasharray="5 5" label="UCL" />
              <ReferenceLine y={result.limits.centerLine} stroke={colors.green} label="CL" />
              <ReferenceLine y={result.limits.lcl} stroke={colors.red} strokeDasharray="5 5" label="LCL" />
              <Line type="monotone" dataKey="value" name="Moving Range" stroke={colors.amber} strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

export function SpcWorkspace() {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [observations, setObservations] = useState<ReturnType<typeof mergeSpcObservations>>([]);
  const [source, setSource] = useState<SpcDataSource | 'all'>('all');
  const [product, setProduct] = useState('all');
  const [parameter, setParameter] = useState('');
  const [subgroupSize, setSubgroupSize] = useState(4);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [cpp, cqa] = await Promise.all([
        listCpvRecords<CppRecord>(CPV_COLLECTIONS.cpp),
        listCpvRecords<CqaRecord>(CPV_COLLECTIONS.cqa),
      ]);
      setObservations(mergeSpcObservations(cpp, cqa));
      setLoading(false);
    };
    void load();
  }, []);

  const { products, parameters } = useMemo(
    () => spcFilterOptions(observations, source, product),
    [observations, source, product],
  );

  useEffect(() => {
    if (!parameter && parameters.length) setParameter(parameters[0]);
    if (parameter && parameters.length && !parameters.includes(parameter)) setParameter(parameters[0]);
  }, [parameter, parameters]);

  const filtered = useMemo(
    () => filterSpcObservations(observations, { source, product, parameter }),
    [observations, source, product, parameter],
  );

  const analysis = useMemo(
    () => runSpcAnalysis(filtered, subgroupSize),
    [filtered, subgroupSize],
  );

  const report = useMemo(
    () => buildSpcReport(analysis, { source, product, parameter }),
    [analysis, source, product, parameter],
  );

  const saveReport = async () => {
    if (analysis.processStatus === 'Insufficient Data') {
      return toast.error('Insufficient data to save SPC report');
    }
    await addDoc(collection(firestore, CPV_COLLECTIONS.controlCharts), {
      recordType: 'spc_report',
      source,
      product,
      parameter,
      subgroupSize,
      processStatus: analysis.processStatus,
      totalViolations: analysis.totalViolations,
      limits: {
        individuals: analysis.individuals.limits,
        movingRange: analysis.movingRange.limits,
        xbar: analysis.xbar.limits,
        rChart: analysis.rChart.limits,
      },
      violations: report.violations,
      createdAt: new Date().toISOString(),
      createdBy: user?.uid || 'system',
      createdByName: profile?.full_name || 'System',
    });
    toast.success('SPC report saved to control charts archive');
  };

  const statusTone = analysis.processStatus === 'In Control'
    ? 'green'
    : analysis.processStatus === 'Special Cause Present'
      ? 'red'
      : 'amber';

  return (
    <div className="space-y-6">
      <PageHeading
        title="Statistical Process Control"
        description="SPC control charts linked to CPP and CQA data — Individuals, Moving Range, X-Bar, and R charts with UCL/CL/LCL, out-of-control highlighting, Western Electric rule violations, and special cause detection."
        actions={(
          <>
            <Button variant="outline" onClick={() => printPage()}>
              <Printer className="mr-2 h-4 w-4" />Export PDF
            </Button>
            <Button onClick={saveReport} disabled={analysis.processStatus === 'Insufficient Data'}>
              <Save className="mr-2 h-4 w-4" />Save SPC Report
            </Button>
          </>
        )}
      />

      <Card className="no-print">
        <CardContent className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <Label>Data Source</Label>
            <Select value={source} onValueChange={(v: SpcDataSource | 'all') => { setSource(v); setParameter(''); }}>
              <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">CPP + CQA</SelectItem>
                <SelectItem value="cpp">CPP Data</SelectItem>
                <SelectItem value="cqa">CQA Data</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Product</Label>
            <Select value={product} onValueChange={(v) => { setProduct(v); setParameter(''); }}>
              <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Products</SelectItem>
                {products.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Parameter</Label>
            <Select value={parameter} onValueChange={setParameter} disabled={!parameters.length}>
              <SelectTrigger className="mt-2"><SelectValue placeholder="Select parameter" /></SelectTrigger>
              <SelectContent>
                {parameters.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>X-Bar / R Subgroup Size</Label>
            <Select value={String(subgroupSize)} onValueChange={(v) => setSubgroupSize(Number(v))}>
              <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                  <SelectItem key={n} value={String(n)}>n = {n}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Process Status</Label>
            <div className="mt-3"><StatusBadge status={analysis.processStatus} /></div>
            <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              <Link2 className="h-3 w-3" />Linked to CPP / CQA
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-6 no-print">
        <KpiCard label="Observations" value={filtered.length} />
        <KpiCard label="Process Status" value={analysis.processStatus} tone={statusTone} />
        <KpiCard label="Rule Violations" value={analysis.totalViolations} tone={analysis.totalViolations ? 'red' : 'green'} />
        <KpiCard label="Special Cause Points" value={analysis.specialCausePoints} tone={analysis.specialCausePoints ? 'red' : 'green'} />
        <KpiCard label="I-Chart OOC" value={analysis.individuals.outOfControlCount} tone={analysis.individuals.outOfControlCount ? 'red' : 'green'} />
        <KpiCard label="MR-Chart OOC" value={analysis.movingRange.outOfControlCount} tone={analysis.movingRange.outOfControlCount ? 'red' : 'green'} />
      </div>

      <Tabs defaultValue="charts" className="space-y-5">
        <TabsList className="no-print grid h-auto w-full grid-cols-2 gap-1 p-1 lg:grid-cols-3">
          <TabsTrigger value="charts">Control Charts</TabsTrigger>
          <TabsTrigger value="violations">Rule Violations</TabsTrigger>
          <TabsTrigger value="report">SPC Report</TabsTrigger>
        </TabsList>

        <TabsContent value="charts" className="space-y-5">
          <DataState
            loading={loading}
            empty={!filtered.length}
            emptyText="No CPP or CQA observations for the selected parameter. Record data in CPP/CQA monitoring first."
          />
          {!loading && filtered.length >= 2 && (
            <section id="spc-report" className="grid gap-6 xl:grid-cols-2 print:grid-cols-1">
              <ControlChart result={analysis.individuals} />
              <MrChart result={analysis.movingRange} />
              <ControlChart result={analysis.xbar} />
              <ControlChart result={analysis.rChart} />
            </section>
          )}
        </TabsContent>

        <TabsContent value="violations" className="space-y-5">
          {analysis.totalViolations === 0 ? (
            <Card>
              <CardContent className="flex items-center gap-3 p-6 text-sm text-muted-foreground">
                <AlertTriangle className="h-5 w-5 text-emerald-600" />
                No Western Electric rule violations detected. Process appears in statistical control.
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Rule Violations & Special Cause Variation</CardTitle>
                <CardDescription>Western Electric rules applied to Individuals and X-Bar charts</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Chart</TableHead>
                        <TableHead>Sample</TableHead>
                        <TableHead>Batch</TableHead>
                        <TableHead>Rule</TableHead>
                        <TableHead>Description</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {report.violations.map((v, i) => (
                        <TableRow key={`${v.chart}-${v.pointIndex}-${i}`}>
                          <TableCell className="uppercase text-xs font-medium">{v.chart}</TableCell>
                          <TableCell>{v.pointIndex}</TableCell>
                          <TableCell className="font-mono text-sm">{v.batch}</TableCell>
                          <TableCell><Badge variant="destructive">{v.ruleName}</Badge></TableCell>
                          <TableCell className="text-sm">{v.description}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {!loading && filtered.length >= 2 && (
            <Card>
              <CardHeader><CardTitle>Out-of-Control Points by Chart</CardTitle></CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {(['individuals', 'movingRange', 'xbar', 'rChart'] as const).map((key) => {
                  const chart = analysis[key];
                  const oocPoints = chart.points.filter((p) => p.outOfControl);
                  return (
                    <div key={key} className="rounded-lg border p-4">
                      <p className="text-sm font-medium">{chart.title}</p>
                      <p className="mt-1 text-2xl font-bold tabular-nums">{oocPoints.length}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {oocPoints.length
                          ? oocPoints.map((p) => `#${p.index}`).join(', ')
                          : 'None detected'}
                      </p>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="report" className="space-y-5">
          <section className="space-y-5 bg-white print:p-4 dark:bg-transparent">
            <div className="hidden border-b-2 border-blue-800 pb-4 print:block">
              <p className="text-sm font-bold text-blue-800">SKYMAP PHARMACEUTICALS</p>
              <h1 className="mt-1 text-2xl font-bold">Statistical Process Control Report</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Generated: {new Date(report.generatedAt).toLocaleString()} · {parameter} · {source === 'all' ? 'CPP + CQA' : source.toUpperCase()} · {product === 'all' ? 'All Products' : product}
              </p>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>SPC Summary</CardTitle>
                <CardDescription>{report.summary}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-6">
                  <KpiCard label="Observations" value={report.observationCount} />
                  <KpiCard label="Subgroup Size" value={report.subgroupSize} />
                  <KpiCard label="Violations" value={report.violations.length} tone={report.violations.length ? 'red' : 'green'} />
                  <KpiCard label="Status" value={report.processStatus} tone={statusTone} />
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Chart</TableHead>
                      <TableHead>CL</TableHead>
                      <TableHead>UCL</TableHead>
                      <TableHead>LCL</TableHead>
                      <TableHead>OOC Points</TableHead>
                      <TableHead>Special Cause</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.entries(report.charts).map(([key, chart]) => (
                      <TableRow key={key}>
                        <TableCell className="font-medium">{chart.title}</TableCell>
                        <TableCell>{chart.limits.centerLine}</TableCell>
                        <TableCell>{chart.limits.ucl}</TableCell>
                        <TableCell>{chart.limits.lcl}</TableCell>
                        <TableCell>{chart.outOfControlCount}</TableCell>
                        <TableCell>{chart.specialCauseCount}</TableCell>
                        <TableCell>
                          <StatusBadge status={chart.inControl ? 'In Control' : 'Special Cause Present'} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {report.violations.length > 0 && (
              <Card>
                <CardHeader><CardTitle>Documented Rule Violations</CardTitle></CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Chart</TableHead>
                          <TableHead>Sample</TableHead>
                          <TableHead>Batch</TableHead>
                          <TableHead>Rule</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {report.violations.map((v, i) => (
                          <TableRow key={`r-${i}`}>
                            <TableCell className="uppercase text-xs">{v.chart}</TableCell>
                            <TableCell>{v.pointIndex}</TableCell>
                            <TableCell className="font-mono text-sm">{v.batch}</TableCell>
                            <TableCell>{v.ruleName}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}
          </section>
        </TabsContent>
      </Tabs>

      <Card className="no-print">
        <CardHeader><CardTitle>Chart Reference</CardTitle></CardHeader>
        <CardContent className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <p><strong className="text-blue-700">Individuals (I):</strong> single observation per batch from CPP/CQA.</p>
          <p><strong className="text-amber-700">Moving Range (MR):</strong> |xᵢ − xᵢ₋₁| with UCL = 3.267·MR̄.</p>
          <p><strong className="text-violet-700">X-Bar:</strong> subgroup means with A₂·R̄ limits.</p>
          <p><strong className="text-emerald-700">R Chart:</strong> subgroup ranges with D₃/D₄ limits.</p>
        </CardContent>
      </Card>
    </div>
  );
}
