'use client';

import Link from 'next/link';
import { ArrowRight, BrainCircuit, CheckCircle2, Database, ShieldAlert } from 'lucide-react';
import { Pie, PieChart, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { calculateAiRiskScore, calculateCapability } from '@/lib/cpv';
import { useCpvData } from '@/hooks/use-cpv-data';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DataState, KpiCard, PageHeading, StatusBadge } from '@/components/cpv/cpv-ui';

export function CpvDashboardPage() {
  const { loading, cpp, cqa, risks, integrations } = useCpvData(true);
  const all = [...cpp, ...cqa];
  const compliant = all.filter((record) => record.status === 'Complies').length;
  const oot = all.filter((record) => record.status === 'OOT').length;
  const oos = all.filter((record) => record.status === 'OOS').length;
  const grouped = new Map<string, typeof all>();
  all.forEach((record) => {
    const parameter = 'parameterName' in record ? record.parameterName : record.testParameter;
    grouped.set(parameter, [...(grouped.get(parameter) || []), record]);
  });
  const capability = Array.from(grouped.values())
    .filter((records) => records.length >= 2)
    .map((records) => calculateCapability(records.map((r) => r.observedValue), records[0].lsl, records[0].usl));
  const averageCpk = capability.length ? capability.reduce((sum, item) => sum + item.cpk, 0) / capability.length : 0;
  const batches = (integrations?.batches || []) as any[];
  const yields = batches.map((batch) => Number(batch.yield_percentage ?? batch.yieldPercentage)).filter(Number.isFinite);
  const averageYield = yields.length ? yields.reduce((sum, value) => sum + value, 0) / yields.length : 0;
  const riskScore = risks.length ? risks.reduce((sum, risk) => sum + risk.rpn, 0) / risks.length : 0;
  const aiRisk = calculateAiRiskScore({
    oot, oos, deviations: integrations?.deviations.length || 0, averageCpk,
    yieldTrend: yields.length > 1 ? yields[yields.length - 1] - yields[0] : 0,
    controlViolations: oos,
  });
  const stability = Math.max(0, Math.round(100 - aiRisk));
  const chartData = [
    { name: 'Compliant', value: compliant, color: '#059669' },
    { name: 'OOT', value: oot, color: '#d97706' },
    { name: 'OOS', value: oos, color: '#dc2626' },
  ];

  return <div className="space-y-6">
    <PageHeading title="Continued Process Verification" description="Enterprise Stage 3 process verification command center for process performance, product quality, statistical control, and risk." actions={<Link href="/cpv/annual-review"><Button>Open Annual Review<ArrowRight className="ml-2 h-4 w-4" /></Button></Link>} />
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard label="Total CPP Reviewed" value={cpp.length} />
      <KpiCard label="Total CQA Reviewed" value={cqa.length} />
      <KpiCard label="Compliant Parameters" value={compliant} tone="green" />
      <KpiCard label="OOT / OOS" value={`${oot} / ${oos}`} tone={oos ? 'red' : oot ? 'amber' : 'green'} />
      <KpiCard label="Average Cpk" value={averageCpk.toFixed(2)} tone={averageCpk >= 1.33 ? 'green' : averageCpk >= 1 ? 'amber' : 'red'} />
      <KpiCard label="Average Yield" value={averageYield ? `${averageYield.toFixed(1)}%` : 'N/A'} />
      <KpiCard label="Average RPN" value={riskScore.toFixed(0)} tone={riskScore >= 50 ? 'red' : riskScore >= 20 ? 'amber' : 'green'} />
      <KpiCard label="Process Stability" value={`${stability}%`} tone={stability >= 80 ? 'green' : stability >= 60 ? 'amber' : 'red'} />
    </div>
    <DataState loading={loading} empty={false} />
    {!loading && <div className="grid gap-6 xl:grid-cols-3">
      <Card><CardHeader><CardTitle>Compliance Distribution</CardTitle></CardHeader><CardContent className="h-[290px]">{all.length ? <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={chartData} dataKey="value" nameKey="name" innerRadius={65} outerRadius={95} paddingAngle={3}>{chartData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer> : <DataState loading={false} empty emptyText="CPP and CQA entries will populate this distribution." />}</CardContent></Card>
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><BrainCircuit className="h-5 w-5 text-blue-600" />AI-Ready Risk Analytics</CardTitle></CardHeader><CardContent className="space-y-5">
        <div>
          <div className="mb-2 flex justify-between text-sm"><span>AI Risk Score</span><strong>{aiRisk}/100</strong></div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-200">
            <div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${aiRisk}%` }} />
          </div>
        </div>
        {[['Process Drift', oot > 0], ['Future OOS Risk', oos > 0 || averageCpk < 1], ['Yield Reduction', yields.length > 1 && yields[yields.length - 1] < yields[0]], ['Equipment Variability', risks.some((r) => r.factor === 'Equipment Issues')]].map(([label, alert]) => <div key={String(label)} className="flex items-center justify-between rounded-lg border p-3 text-sm"><span>{label}</span><StatusBadge status={alert ? 'Risk' : 'Stable'} /></div>)}
        <p className="text-xs text-muted-foreground">Feature-ready inputs are normalized for future predictive model or external AI endpoint integration.</p>
      </CardContent></Card>
      <Card><CardHeader><CardTitle>Connected Quality Data</CardTitle></CardHeader><CardContent className="space-y-3">
        {[
          ['Batch / Yield', integrations?.batches.length || 0],
          ['PQR', integrations?.pqr.length || 0],
          ['Deviations', integrations?.deviations.length || 0],
          ['OOS', integrations?.oos.length || 0],
          ['CAPA', integrations?.capa.length || 0],
          ['Stability', integrations?.stability.length || 0],
        ].map(([label, count]) => <div key={String(label)} className="flex items-center justify-between rounded-lg border p-3"><span className="flex items-center gap-2 text-sm"><Database className="h-4 w-4 text-blue-600" />{label}</span><span className="flex items-center gap-2 font-semibold">{count}{Number(count) > 0 ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <ShieldAlert className="h-4 w-4 text-slate-300" />}</span></div>)}
      </CardContent></Card>
    </div>}
  </div>;
}
