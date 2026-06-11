'use client';

import { useMemo, useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ArrowRight, Printer, Package, FlaskConical, CheckCircle2,
  AlertTriangle, ShieldAlert, BarChart3, Activity, TestTube, TrendingUp,
} from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, Cell, ComposedChart,
} from 'recharts';
import { CPV_COLLECTIONS } from '@/lib/cpv';
import { useCpvData } from '@/hooks/use-cpv-data';
import { listCpvRecords } from '@/lib/cpv-service';
import { printPage } from '@/lib/export-utils';
import {
  filterCpvRecords, filterRiskRecords, uniqueProducts, uniqueBatches,
  countByStatus, computeCapabilityAverages, monthlyTrend, complianceTrend,
  riskTrend, productCompliance, openRiskCount, buildOotOosAlerts,
  mapAuditToActivities, availableYears, type CpvDashboardFilters,
} from '@/lib/cpv-dashboard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DataState, KpiCard, PageHeading, StatusBadge } from '@/components/cpv/cpv-ui';

const MONTHS = [
  { value: '01', label: 'January' }, { value: '02', label: 'February' }, { value: '03', label: 'March' },
  { value: '04', label: 'April' }, { value: '05', label: 'May' }, { value: '06', label: 'June' },
  { value: '07', label: 'July' }, { value: '08', label: 'August' }, { value: '09', label: 'September' },
  { value: '10', label: 'October' }, { value: '11', label: 'November' }, { value: '12', label: 'December' },
];

export function CpvDashboardPage() {
  const { loading, cpp, cqa, risks, integrations } = useCpvData(true);
  const [audit, setAudit] = useState<Record<string, unknown>[]>([]);
  const [filters, setFilters] = useState<CpvDashboardFilters>({
    product: 'all', year: 'all', month: 'all', quarter: 'all',
  });
  const [generatedAt] = useState(() => new Date().toISOString());

  useEffect(() => {
    listCpvRecords<Record<string, unknown>>(CPV_COLLECTIONS.audit, 50).then(setAudit);
  }, []);

  const filteredCpp = useMemo(() => filterCpvRecords(cpp, filters), [cpp, filters]);
  const filteredCqa = useMemo(() => filterCpvRecords(cqa, filters), [cqa, filters]);
  const filteredRisks = useMemo(() => filterRiskRecords(risks, filters), [risks, filters]);
  const allFiltered = useMemo(() => [...filteredCpp, ...filteredCqa], [filteredCpp, filteredCqa]);

  const products = useMemo(() => uniqueProducts(cpp, cqa), [cpp, cqa]);
  const years = useMemo(() => availableYears([...cpp, ...cqa]), [cpp, cqa]);

  const cppStats = useMemo(() => countByStatus(filteredCpp), [filteredCpp]);
  const cqaStats = useMemo(() => countByStatus(filteredCqa), [filteredCqa]);
  const totalStats = useMemo(() => ({
    complies: cppStats.complies + cqaStats.complies,
    oot: cppStats.oot + cqaStats.oot,
    oos: cppStats.oos + cqaStats.oos,
  }), [cppStats, cqaStats]);

  const { averageCpk, averagePpk } = useMemo(
    () => computeCapabilityAverages(filteredCpp, filteredCqa),
    [filteredCpp, filteredCqa],
  );

  const batches = (integrations?.batches || []) as Record<string, unknown>[];
  const kpis = useMemo(() => ({
    products: filters.product && filters.product !== 'all' ? 1 : products.length,
    batches: uniqueBatches(filteredCpp, filteredCqa, batches),
    cppParams: filteredCpp.length,
    cqaParams: filteredCqa.length,
    compliant: totalStats.complies,
    oot: totalStats.oot,
    oos: totalStats.oos,
    openRisks: openRiskCount(filteredRisks),
    avgCpk: averageCpk,
    avgPpk: averagePpk,
  }), [filters, products, filteredCpp, filteredCqa, batches, totalStats, filteredRisks, averageCpk, averagePpk]);

  const charts = useMemo(() => ({
    monthly: monthlyTrend(allFiltered),
    cppCompliance: complianceTrend(filteredCpp),
    cqaCompliance: complianceTrend(filteredCqa),
    risk: riskTrend(filteredRisks),
    product: productCompliance(filteredCpp, filteredCqa),
  }), [allFiltered, filteredCpp, filteredCqa, filteredRisks]);

  const alerts = useMemo(() => buildOotOosAlerts(filteredCpp, filteredCqa), [filteredCpp, filteredCqa]);
  const activities = useMemo(() => mapAuditToActivities(audit), [audit]);

  const setFilter = (key: keyof CpvDashboardFilters, value: string) =>
    setFilters((prev) => ({ ...prev, [key]: value }));

  const cpkTone = averageCpk >= 1.33 ? 'green' : averageCpk >= 1 ? 'amber' : 'red';
  const ppkTone = averagePpk >= 1.33 ? 'green' : averagePpk >= 1 ? 'amber' : 'red';

  return (
    <div id="cpv-dashboard-root" className="space-y-6">
      {/* Print-only header */}
      <div className="hidden print:block border-2 border-black mb-4">
        <div className="grid grid-cols-3 border-b border-black">
          <div className="p-3 border-r border-black text-center font-bold text-blue-800 text-sm">SKYMAP PHARMACEUTICALS</div>
          <div className="p-3 border-r border-black text-center"><p className="font-bold text-sm uppercase">CPV Dashboard Report</p><p className="text-[10px]">FDA Stage 3 | ALCOA+ | 21 CFR Part 11</p></div>
          <div className="p-3 text-[10px]"><p><strong>Generated:</strong> {new Date(generatedAt).toLocaleString('en-GB')}</p></div>
        </div>
      </div>

      <div className="no-print">
        <PageHeading
          title="CPV Dashboard"
          description="Continued Process Verification command center — process performance, product quality, statistical control, and risk monitoring."
          actions={
            <>
              <Button variant="outline" className="gap-2" onClick={() => printPage()}>
                <Printer className="h-4 w-4" />Export PDF
              </Button>
              <Link href="/cpv/annual-review">
                <Button className="gap-2">Annual Review<ArrowRight className="h-4 w-4" /></Button>
              </Link>
            </>
          }
        />
      </div>

      {/* Filters */}
      <Card className="no-print">
        <CardHeader className="pb-3"><CardTitle className="text-base">Dashboard Filters</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Select value={filters.product || 'all'} onValueChange={(v) => setFilter('product', v)}>
              <SelectTrigger><SelectValue placeholder="Product" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Products</SelectItem>
                {products.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filters.year || 'all'} onValueChange={(v) => setFilter('year', v)}>
              <SelectTrigger><SelectValue placeholder="Year" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Years</SelectItem>
                {years.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filters.month || 'all'} onValueChange={(v) => setFilter('month', v)}>
              <SelectTrigger><SelectValue placeholder="Month" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Months</SelectItem>
                {MONTHS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filters.quarter || 'all'} onValueChange={(v) => setFilter('quarter', v)}>
              <SelectTrigger><SelectValue placeholder="Quarter" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Quarters</SelectItem>
                <SelectItem value="Q1">Q1 (Jan–Mar)</SelectItem>
                <SelectItem value="Q2">Q2 (Apr–Jun)</SelectItem>
                <SelectItem value="Q3">Q3 (Jul–Sep)</SelectItem>
                <SelectItem value="Q4">Q4 (Oct–Dec)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <DataState loading={loading} empty={false} />

      {!loading && (
        <>
          {/* KPI Cards */}
          <div className="grid gap-3 grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
            <KpiCard label="Products Under CPV" value={kpis.products} detail="Unique products monitored" tone="blue" />
            <KpiCard label="Batches Reviewed" value={kpis.batches} detail="Unique batch numbers" tone="blue" />
            <KpiCard label="CPP Parameters" value={kpis.cppParams} detail="Critical process parameters" tone="blue" />
            <KpiCard label="CQA Parameters" value={kpis.cqaParams} detail="Critical quality attributes" tone="blue" />
            <KpiCard label="Compliant Parameters" value={kpis.compliant} tone="green" />
            <KpiCard label="OOT Parameters" value={kpis.oot} tone={kpis.oot ? 'amber' : 'green'} />
            <KpiCard label="OOS Parameters" value={kpis.oos} tone={kpis.oos ? 'red' : 'green'} />
            <KpiCard label="Open Risks" value={kpis.openRisks} tone={kpis.openRisks ? 'red' : 'green'} />
            <KpiCard label="Average Cpk" value={averageCpk.toFixed(2)} tone={cpkTone} />
            <KpiCard label="Average Ppk" value={averagePpk.toFixed(2)} tone={ppkTone} />
          </div>

          {/* Charts */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center gap-2"><TrendingUp className="h-4 w-4 text-blue-600" />Monthly CPV Trend</CardTitle></CardHeader>
              <CardContent className="h-[280px]">
                {charts.monthly.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={charts.monthly}>
                      <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" tick={{ fontSize: 11 }} /><YAxis /><Tooltip /><Legend />
                      <Line type="monotone" dataKey="count" name="Records" stroke="#2563eb" strokeWidth={2} dot={{ r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : <DataState loading={false} empty emptyText="No CPV data for selected filters." />}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center gap-2"><Activity className="h-4 w-4 text-emerald-600" />CPP Compliance Trend</CardTitle></CardHeader>
              <CardContent className="h-[280px]">
                {charts.cppCompliance.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={charts.cppCompliance}>
                      <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" tick={{ fontSize: 11 }} /><YAxis domain={[0, 100]} unit="%" /><Tooltip formatter={(v) => [`${v}%`, 'Compliance Rate']} />
                      <Line type="monotone" dataKey="rate" name="Compliance %" stroke="#059669" strokeWidth={2} dot={{ r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : <DataState loading={false} empty emptyText="No CPP data for selected filters." />}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center gap-2"><TestTube className="h-4 w-4 text-violet-600" />CQA Compliance Trend</CardTitle></CardHeader>
              <CardContent className="h-[280px]">
                {charts.cqaCompliance.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={charts.cqaCompliance}>
                      <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" tick={{ fontSize: 11 }} /><YAxis domain={[0, 100]} unit="%" /><Tooltip formatter={(v) => [`${v}%`, 'Compliance Rate']} />
                      <Line type="monotone" dataKey="rate" name="Compliance %" stroke="#7c3aed" strokeWidth={2} dot={{ r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : <DataState loading={false} empty emptyText="No CQA data for selected filters." />}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center gap-2"><ShieldAlert className="h-4 w-4 text-red-600" />Risk Trend</CardTitle></CardHeader>
              <CardContent className="h-[280px]">
                {charts.risk.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={charts.risk}>
                      <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" tick={{ fontSize: 11 }} /><YAxis yAxisId="left" /><YAxis yAxisId="right" orientation="right" /><Tooltip /><Legend />
                      <Bar yAxisId="left" dataKey="count" name="Risk Count" fill="#dc2626" radius={[4, 4, 0, 0]} />
                      <Line yAxisId="right" type="monotone" dataKey="avgRpn" name="Avg RPN" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                ) : <DataState loading={false} empty emptyText="No risk assessments for selected filters." />}
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center gap-2"><BarChart3 className="h-4 w-4 text-blue-600" />Product Wise Compliance</CardTitle></CardHeader>
              <CardContent className="h-[300px]">
                {charts.product.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={charts.product} layout="vertical" margin={{ left: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" /><XAxis type="number" domain={[0, 100]} unit="%" /><YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} /><Tooltip formatter={(v) => [`${v}%`, 'Compliance']} />
                      <Bar dataKey="rate" name="Compliance %" radius={[0, 4, 4, 0]}>
                        {charts.product.map((entry) => (
                          <Cell key={entry.name} fill={entry.rate >= 95 ? '#059669' : entry.rate >= 80 ? '#d97706' : '#dc2626'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : <DataState loading={false} empty emptyText="No product compliance data." />}
              </CardContent>
            </Card>
          </div>

          {/* Tables */}
          <div className="grid gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Recent Activities</CardTitle>
                <CardDescription>CPV audit trail — latest system actions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg border overflow-x-auto max-h-[360px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead>Date/Time</TableHead>
                        <TableHead>Module</TableHead>
                        <TableHead>Action</TableHead>
                        <TableHead>User</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {activities.length ? activities.map((a) => (
                        <TableRow key={a.id || a.timestamp}>
                          <TableCell className="text-xs whitespace-nowrap">{a.timestamp ? new Date(a.timestamp).toLocaleString('en-IN') : '—'}</TableCell>
                          <TableCell className="text-sm">{a.module}</TableCell>
                          <TableCell className="text-sm font-medium">{a.action}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{a.actorName}</TableCell>
                        </TableRow>
                      )) : (
                        <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No recent activities</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />Recent OOT/OOS Alerts
                </CardTitle>
                <CardDescription>Out-of-trend and out-of-specification parameter alerts</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg border overflow-x-auto max-h-[360px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead>Type</TableHead>
                        <TableHead>Product</TableHead>
                        <TableHead>Batch</TableHead>
                        <TableHead>Parameter</TableHead>
                        <TableHead>Result</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {alerts.length ? alerts.map((a, i) => (
                        <TableRow key={a.id || i} className={a.status === 'OOS' ? 'bg-red-50/50 dark:bg-red-950/10' : 'bg-amber-50/50 dark:bg-amber-950/10'}>
                          <TableCell><span className="text-xs font-medium">{a.type}</span></TableCell>
                          <TableCell className="text-sm">{a.productName}</TableCell>
                          <TableCell className="text-sm font-mono">{a.batchNo}</TableCell>
                          <TableCell className="text-sm">{a.parameter}</TableCell>
                          <TableCell className="text-sm font-mono">{a.observedValue} {a.unit}</TableCell>
                          <TableCell><StatusBadge status={a.status} /></TableCell>
                        </TableRow>
                      )) : (
                        <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          <CheckCircle2 className="h-5 w-5 mx-auto mb-2 text-emerald-600" />No OOT/OOS alerts — all parameters compliant
                        </TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Connected modules summary */}
          <Card className="no-print">
            <CardHeader><CardTitle className="text-base">Connected Quality Modules</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {[
                  { label: 'Batches', count: integrations?.batches.length || 0, icon: Package },
                  { label: 'Deviations', count: integrations?.deviations.length || 0, icon: AlertTriangle },
                  { label: 'OOS Records', count: integrations?.oos.length || 0, icon: TestTube },
                  { label: 'CAPA', count: integrations?.capa.length || 0, icon: ShieldAlert },
                  { label: 'PQR', count: integrations?.pqr.length || 0, icon: FlaskConical },
                  { label: 'Stability', count: integrations?.stability.length || 0, icon: Activity },
                ].map(({ label, count, icon: Icon }) => (
                  <div key={label} className="rounded-lg border p-3 text-center">
                    <Icon className="h-5 w-5 mx-auto mb-1 text-blue-600" />
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="text-xl font-bold">{count}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
