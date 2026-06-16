'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, ReferenceLine,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { addDoc, collection } from 'firebase/firestore';
import { Download, FileBarChart, Printer, Save } from 'lucide-react';
import { toast } from 'sonner';
import { getFirebaseFirestore } from '@/lib/firebase';
import { useAuth } from '@/contexts/auth-context';
import {
  CPV_COLLECTIONS, CapabilityResult, CppRecord, CqaRecord, capabilityStatusTone,
} from '@/lib/cpv';
import {
  CapabilityDataSource, CapabilityObservation, buildCapabilityReport,
  buildHistogram, capabilityIndexChartData, filterObservations,
  mergeCapabilityObservations, parameterCpkComparison,
} from '@/lib/cpv-capability-report';
import { listCpvRecords } from '@/lib/cpv-service';
import { calculateCapability } from '@/lib/cpv';
import { downloadCsv, printPage } from '@/lib/export-utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DataState, KpiCard, PageHeading, StatusBadge } from '@/components/cpv/cpv-ui';

type ReportPeriod = 'monthly' | 'yearly';
type SourceFilter = CapabilityDataSource | 'all';

const chartColors = {
  blue: '#2563eb',
  green: '#059669',
  amber: '#d97706',
  red: '#dc2626',
  violet: '#7c3aed',
};

const getDate = (value?: string) => {
  const date = value ? new Date(value) : new Date();
  return Number.isNaN(date.getTime()) ? new Date() : date;
};

function MetricGrid({ result }: { result: CapabilityResult }) {
  const tone = capabilityStatusTone(result.status);
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
      <KpiCard label="Mean" value={result.mean} />
      <KpiCard label="Median" value={result.median} />
      <KpiCard label="Range" value={result.range} />
      <KpiCard label="Variance" value={result.variance} />
      <KpiCard label="Standard Deviation" value={result.standardDeviation} />
      <KpiCard label="Samples (n)" value={result.count} />
      <KpiCard label="Cp" value={result.cp} />
      <KpiCard label="Cpk" value={result.cpk} tone={result.cpk >= 1.33 ? 'green' : result.cpk >= 1 ? 'amber' : 'red'} />
      <KpiCard label="CPU" value={result.cpu} />
      <KpiCard label="CPL" value={result.cpl} />
      <KpiCard label="Pp" value={result.pp} />
      <KpiCard label="Ppk" value={result.ppk} tone={result.ppk >= 1.33 ? 'green' : result.ppk >= 1 ? 'amber' : 'red'} />
      <KpiCard label="Sigma Level" value={result.sigmaLevel} />
      <KpiCard label="Capability Status" value={result.status} tone={tone} />
    </div>
  );
}

function exportReportCsv(rows: ReturnType<typeof buildCapabilityReport>['rows'], filename: string) {
  if (!rows.length) return toast.error('No data to export');
  const headers = [
    'Source', 'Product', 'Parameter', 'Samples', 'Mean', 'Median', 'Range', 'Variance',
    'Std Dev', 'Cp', 'Cpk', 'CPU', 'CPL', 'Pp', 'Ppk', 'Sigma Level', 'LSL', 'USL', 'Status',
  ];
  downloadCsv(filename, headers, rows.map((r) => [
    r.source.toUpperCase(), r.product, r.parameter, r.count, r.mean, r.median, r.range,
    r.variance, r.standardDeviation, r.cp, r.cpk, r.cpu, r.cpl, r.pp, r.ppk, r.sigmaLevel,
    r.lsl, r.usl, r.status,
  ]));
}

export function CapabilityWorkspace() {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [observations, setObservations] = useState<CapabilityObservation[]>([]);
  const [source, setSource] = useState<SourceFilter>('all');
  const [parameter, setParameter] = useState('');
  const [product, setProduct] = useState('all');
  const [reportPeriod, setReportPeriod] = useState<ReportPeriod>('monthly');
  const [reportYear, setReportYear] = useState(new Date().getFullYear());
  const [reportMonth, setReportMonth] = useState(new Date().getMonth() + 1);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [cppRecords, cqaRecords] = await Promise.all([
        listCpvRecords<CppRecord>(CPV_COLLECTIONS.cpp),
        listCpvRecords<CqaRecord>(CPV_COLLECTIONS.cqa),
      ]);
      setObservations(mergeCapabilityObservations(cppRecords, cqaRecords));
      setLoading(false);
    };
    void load();
  }, []);

  const parameters = useMemo(() => {
    const scoped = filterObservations(observations, { source, product });
    return Array.from(new Set(scoped.map((item) => item.parameter))).sort();
  }, [observations, source, product]);

  const products = useMemo(() => {
    const scoped = filterObservations(observations, { source });
    return Array.from(new Set(scoped.map((item) => item.product))).sort();
  }, [observations, source]);

  useEffect(() => {
    if (!parameter && parameters.length) setParameter(parameters[0]);
    if (parameter && parameters.length && !parameters.includes(parameter)) setParameter(parameters[0]);
  }, [parameter, parameters]);

  const selectedParameter = parameter && parameters.includes(parameter)
    ? parameter
    : parameters[0] || '';

  const selected = useMemo(() => filterObservations(observations, { source, product })
    .filter((item) => item.parameter === selectedParameter)
    .sort((a, b) => getDate(a.date).getTime() - getDate(b.date).getTime()),
  [observations, source, product, selectedParameter]);

  const analysisRecords = selected;
  const lsl = analysisRecords[0]?.lsl ?? 0;
  const usl = analysisRecords[0]?.usl ?? 0;
  const result = calculateCapability(analysisRecords.map((item) => item.value), lsl, usl);

  const runChart = selected.map((item, index) => ({
    sample: index + 1,
    batch: item.batch,
    value: item.value,
    mean: result.mean,
  }));

  const histogram = useMemo(
    () => buildHistogram(selected.map((item) => item.value)),
    [selected],
  );

  const indexChart = useMemo(() => capabilityIndexChartData(result), [result]);

  const report = useMemo(
    () => buildCapabilityReport(observations, {
      period: reportPeriod,
      year: reportYear,
      month: reportPeriod === 'monthly' ? reportMonth : null,
      source,
      product,
    }),
    [observations, reportPeriod, reportYear, reportMonth, source, product],
  );

  const cpkComparison = useMemo(() => parameterCpkComparison(report.rows), [report.rows]);

  const saveAnalysis = async () => {
    if (result.status === 'Insufficient Data') return toast.error('At least two observations are required');
    await addDoc(collection(getFirebaseFirestore(), CPV_COLLECTIONS.capability), {
      recordType: 'analysis',
      source,
      product,
      parameter: selectedParameter || parameter,
      lsl,
      usl,
      ...result,
      createdAt: new Date().toISOString(),
      createdBy: user?.uid || 'system',
      createdByName: profile?.full_name || 'System',
    });
    toast.success('Capability analysis saved');
  };

  const saveReport = async () => {
    if (!report.rows.length) return toast.error('No capability data for this report period');
    await addDoc(collection(getFirebaseFirestore(), CPV_COLLECTIONS.capability), {
      recordType: `${reportPeriod}_report`,
      source,
      product,
      reportYear,
      reportMonth: reportPeriod === 'monthly' ? reportMonth : null,
      summary: report.summary,
      rows: report.rows,
      createdAt: new Date().toISOString(),
      createdBy: user?.uid || 'system',
      createdByName: profile?.full_name || 'System',
    });
    toast.success(`${reportPeriod === 'monthly' ? 'Monthly' : 'Yearly'} capability report saved`);
  };

  const analysisLabel = selectedParameter || 'Select parameter';

  const onSourceChange = (v: SourceFilter) => {
    setSource(v);
    setParameter('');
  };

  return (
    <div className="space-y-6">
      <PageHeading
        title="Process Capability"
        description="Statistical process capability from CPP and CQA data — Mean, Median, Range, Variance, Cp, Cpk, CPU, CPL, Pp, Ppk, Sigma Level, and capability status (Excellent / Acceptable / Needs Improvement)."
        actions={(
          <Button onClick={saveAnalysis} disabled={result.status === 'Insufficient Data'}>
            <Save className="mr-2 h-4 w-4" />Save Analysis
          </Button>
        )}
      />

      <Tabs defaultValue="analysis" className="space-y-5">
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1 p-1 lg:grid-cols-3">
          <TabsTrigger value="analysis">Capability Analysis</TabsTrigger>
          <TabsTrigger value="charts">Capability Charts</TabsTrigger>
          <TabsTrigger value="report">Capability Report</TabsTrigger>
        </TabsList>

        {/* ── Analysis ── */}
        <TabsContent value="analysis" className="space-y-5">
          <Card>
            <CardContent className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <Label>Input Data</Label>
                <Select value={source} onValueChange={onSourceChange}>
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
                <Select value={product} onValueChange={setProduct}>
                  <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Products</SelectItem>
                    {products.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Parameter</Label>
                <Select value={selectedParameter} onValueChange={setParameter} disabled={!parameters.length}>
                  <SelectTrigger className="mt-2"><SelectValue placeholder="Select parameter" /></SelectTrigger>
                  <SelectContent>
                    {parameters.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Specification</Label>
                <p className="mt-3 font-mono text-sm">{analysisRecords.length ? `${lsl} – ${usl} ${analysisRecords[0]?.unit || ''}` : '—'}</p>
                <div className="mt-2"><StatusBadge status={result.status} /></div>
              </div>
            </CardContent>
          </Card>

          <DataState
            loading={loading}
            empty={!analysisRecords.length}
            emptyText="Record CPP or CQA observations (minimum 2 per parameter) to calculate process capability."
          />

          {!loading && analysisRecords.length > 0 && (
            <>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{analysisLabel} — Statistical Summary</CardTitle>
                  <CardDescription>
                    Cpk ≥ 1.33 = Excellent · Cpk ≥ 1.0 = Acceptable · Cpk &lt; 1.0 = Needs Improvement
                  </CardDescription>
                </CardHeader>
                <CardContent><MetricGrid result={result} /></CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Observation Register</CardTitle></CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Source</TableHead>
                          <TableHead>Product / Batch</TableHead>
                          <TableHead>Parameter</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead className="text-right">Observed</TableHead>
                          <TableHead>Spec (LSL – USL)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {analysisRecords.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="uppercase text-xs font-medium">{item.source}</TableCell>
                            <TableCell>
                              <p className="font-medium">{item.product}</p>
                              <p className="text-xs font-mono text-muted-foreground">{item.batch}</p>
                            </TableCell>
                            <TableCell>{item.parameter}</TableCell>
                            <TableCell className="text-sm">{item.date?.split('T')[0] || '—'}</TableCell>
                            <TableCell className="text-right font-mono">{item.value} {item.unit}</TableCell>
                            <TableCell className="text-sm">{item.lsl} – {item.usl}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* ── Charts ── */}
        <TabsContent value="charts" className="space-y-5">
          <DataState loading={loading} empty={!selected.length} emptyText="Select a specific parameter with at least 2 observations to view charts." />

          {!loading && selected.length >= 2 && (
            <>
              <div className="grid gap-6 xl:grid-cols-2">
                <Card>
                  <CardHeader><CardTitle>{selectedParameter} Run Chart</CardTitle></CardHeader>
                  <CardContent className="h-[380px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={runChart}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="batch" tick={{ fontSize: 11 }} />
                        <YAxis domain={['auto', 'auto']} />
                        <Tooltip />
                        <Legend />
                        <ReferenceLine y={lsl} stroke={chartColors.red} strokeDasharray="5 5" label="LSL" />
                        <ReferenceLine y={usl} stroke={chartColors.red} strokeDasharray="5 5" label="USL" />
                        <ReferenceLine y={result.mean} stroke={chartColors.green} label="Mean" />
                        <Line type="monotone" dataKey="value" name="Observed" stroke={chartColors.blue} strokeWidth={2} dot={{ r: 4 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader><CardTitle>Distribution Histogram</CardTitle></CardHeader>
                  <CardContent className="h-[380px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={histogram}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="range" angle={-25} textAnchor="end" height={70} tick={{ fontSize: 10 }} />
                        <YAxis allowDecimals={false} />
                        <Tooltip />
                        <Bar dataKey="count" name="Frequency">
                          {histogram.map((_, index) => (
                            <Cell key={index} fill={index % 2 ? chartColors.violet : chartColors.blue} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-6 xl:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Capability Indices</CardTitle>
                    <CardDescription>Cp, Cpk, CPU, CPL, Pp, Ppk vs target 1.33</CardDescription>
                  </CardHeader>
                  <CardContent className="h-[360px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={indexChart} layout="vertical" margin={{ left: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" domain={[0, 'auto']} />
                        <YAxis type="category" dataKey="index" width={50} />
                        <Tooltip />
                        <ReferenceLine x={1.33} stroke={chartColors.green} strokeDasharray="4 4" label="1.33" />
                        <ReferenceLine x={1} stroke={chartColors.amber} strokeDasharray="4 4" label="1.0" />
                        <Bar dataKey="value" name="Index" fill={chartColors.blue} radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Cpk / Ppk Comparison</CardTitle>
                    <CardDescription>Report period parameters with sufficient data</CardDescription>
                  </CardHeader>
                  <CardContent className="h-[360px]">
                    {!cpkComparison.length ? (
                      <DataState loading={false} empty emptyText="Generate a report period with repeated observations." />
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={cpkComparison} margin={{ bottom: 60 }}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="label" angle={-30} textAnchor="end" height={80} tick={{ fontSize: 10 }} />
                          <YAxis domain={[0, 'auto']} />
                          <Tooltip />
                          <Legend />
                          <ReferenceLine y={1.33} stroke={chartColors.green} strokeDasharray="4 4" />
                          <ReferenceLine y={1} stroke={chartColors.amber} strokeDasharray="4 4" />
                          <Bar dataKey="cpk" name="Cpk" fill={chartColors.blue} />
                          <Bar dataKey="ppk" name="Ppk" fill={chartColors.violet} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </TabsContent>

        {/* ── Report ── */}
        <TabsContent value="report" className="space-y-5">
          <Card className="no-print">
            <CardContent className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-6">
              <div>
                <Label>Report Type</Label>
                <Select value={reportPeriod} onValueChange={(v: ReportPeriod) => setReportPeriod(v)}>
                  <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly Report</SelectItem>
                    <SelectItem value="yearly">Yearly Report</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Data Source</Label>
                <Select value={source} onValueChange={(v: SourceFilter) => setSource(v)}>
                  <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">CPP + CQA</SelectItem>
                    <SelectItem value="cpp">CPP Only</SelectItem>
                    <SelectItem value="cqa">CQA Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Year</Label>
                <Input className="mt-2" type="number" min="2000" max={new Date().getFullYear()} value={reportYear} onChange={(e) => setReportYear(Number(e.target.value))} />
              </div>
              <div>
                <Label>Month</Label>
                <Select value={String(reportMonth)} onValueChange={(v) => setReportMonth(Number(v))} disabled={reportPeriod === 'yearly'}>
                  <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }, (_, i) => (
                      <SelectItem key={i + 1} value={String(i + 1)}>
                        {new Date(2000, i).toLocaleString('en-US', { month: 'long' })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button className="self-end" onClick={saveReport}>
                <FileBarChart className="mr-2 h-4 w-4" />Save Report
              </Button>
              <Button className="self-end" variant="outline" onClick={() => printPage()}>
                <Printer className="mr-2 h-4 w-4" />Print
              </Button>
              <Button className="self-end" variant="outline" onClick={() => exportReportCsv(report.rows, `capability-report-${reportYear}.csv`)}>
                <Download className="mr-2 h-4 w-4" />Export CSV
              </Button>
            </CardContent>
          </Card>

          <section id="capability-report" className="space-y-5 bg-white print:p-4 dark:bg-transparent">
            <div className="border-b pb-4">
              <p className="text-sm font-semibold text-blue-700">SKYMAP PHARMACEUTICALS</p>
              <h2 className="mt-1 text-2xl font-bold">Process Capability Report</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {reportPeriod === 'monthly'
                  ? `${new Date(2000, reportMonth - 1).toLocaleString('en-US', { month: 'long' })} `
                  : ''}
                {reportYear} · {source === 'all' ? 'CPP + CQA' : source.toUpperCase()} · {product === 'all' ? 'All Products' : product}
              </p>
            </div>

            <div className="grid gap-3 grid-cols-2 lg:grid-cols-6">
              <KpiCard label="Parameters" value={report.summary.total} />
              <KpiCard label="Excellent" value={report.summary.excellent} tone="green" />
              <KpiCard label="Acceptable" value={report.summary.acceptable} tone="amber" />
              <KpiCard label="Needs Improvement" value={report.summary.needsImprovement} tone="red" />
              <KpiCard label="Avg Cpk" value={report.summary.averageCpk.toFixed(2)} tone={report.summary.averageCpk >= 1.33 ? 'green' : report.summary.averageCpk >= 1 ? 'amber' : 'red'} />
              <KpiCard label="Avg Ppk" value={report.summary.averagePpk.toFixed(2)} />
            </div>

            <DataState loading={loading} empty={!report.rows.length} emptyText="No repeated CPP/CQA observations for the selected reporting period." />

            {!loading && report.rows.length > 0 && (
              <Card>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Source</TableHead>
                          <TableHead>Product</TableHead>
                          <TableHead>Parameter</TableHead>
                          <TableHead>n</TableHead>
                          <TableHead>Mean</TableHead>
                          <TableHead>Median</TableHead>
                          <TableHead>Range</TableHead>
                          <TableHead>Std Dev</TableHead>
                          <TableHead>Cp</TableHead>
                          <TableHead>Cpk</TableHead>
                          <TableHead>CPU</TableHead>
                          <TableHead>CPL</TableHead>
                          <TableHead>Pp</TableHead>
                          <TableHead>Ppk</TableHead>
                          <TableHead>Sigma</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {report.rows.map((row) => (
                          <TableRow key={`${row.source}-${row.product}-${row.parameter}`}>
                            <TableCell className="uppercase text-xs">{row.source}</TableCell>
                            <TableCell>{row.product}</TableCell>
                            <TableCell>{row.parameter}</TableCell>
                            <TableCell>{row.count}</TableCell>
                            <TableCell>{row.mean}</TableCell>
                            <TableCell>{row.median}</TableCell>
                            <TableCell>{row.range}</TableCell>
                            <TableCell>{row.standardDeviation}</TableCell>
                            <TableCell>{row.cp}</TableCell>
                            <TableCell>{row.cpk}</TableCell>
                            <TableCell>{row.cpu}</TableCell>
                            <TableCell>{row.cpl}</TableCell>
                            <TableCell>{row.pp}</TableCell>
                            <TableCell>{row.ppk}</TableCell>
                            <TableCell>{row.sigmaLevel}</TableCell>
                            <TableCell><StatusBadge status={row.status} /></TableCell>
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
    </div>
  );
}
