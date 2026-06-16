'use client';

import { useMemo, useState } from 'react';
import {
  CartesianGrid, ComposedChart, Legend, Line, LineChart, ReferenceLine,
  ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis,
} from 'recharts';
import { Activity, AlertTriangle, Save } from 'lucide-react';
import { addDoc, collection } from 'firebase/firestore';
import { toast } from 'sonner';
import { getFirebaseFirestore } from '@/lib/firebase';
import {
  CPV_COLLECTIONS, calculateCapability, calculateControlLimits,
} from '@/lib/cpv';
import { useCpvData } from '@/hooks/use-cpv-data';
import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DataState, KpiCard, PageHeading, StatusBadge } from '@/components/cpv/cpv-ui';

const chartColors = { blue: '#2563eb', green: '#059669', amber: '#d97706', red: '#dc2626', slate: '#64748b' };

export function ProcessCapabilityPage() {
  const { loading, cpp, cqa } = useCpvData();
  const { user, profile } = useAuth();
  const [source, setSource] = useState<'cpp' | 'cqa'>('cpp');
  const records = source === 'cpp' ? cpp : cqa;
  const parameters = Array.from(new Set(records.map((record) => source === 'cpp' ? (record as any).parameterName : (record as any).testParameter)));
  const [parameter, setParameter] = useState('');
  const selectedParameter = parameter || parameters[0] || '';
  const selected = records.filter((record) => (source === 'cpp' ? (record as any).parameterName : (record as any).testParameter) === selectedParameter);
  const lsl = selected[0]?.lsl ?? 0;
  const usl = selected[0]?.usl ?? 0;
  const result = calculateCapability(selected.map((record) => record.observedValue), lsl, usl);

  const save = async () => {
    if (result.status === 'Insufficient Data') return toast.error('At least two observations are required');
    await addDoc(collection(getFirebaseFirestore(), CPV_COLLECTIONS.capability), {
      source, parameter: selectedParameter, lsl, usl, ...result,
      createdAt: new Date().toISOString(), createdBy: user?.uid || 'system',
      createdByName: profile?.full_name || 'System',
    });
    toast.success('Capability analysis snapshot saved');
  };

  const data = selected.slice().reverse().map((record, index) => ({
    sample: index + 1, value: record.observedValue, lsl, usl,
  }));

  return <div className="space-y-6">
    <PageHeading title="Process Capability Analysis" description="Statistical assessment of within-specification performance using Cp, Cpk, Pp, Ppk, CPU, CPL, and sigma level." actions={<Button onClick={save} disabled={result.status === 'Insufficient Data'}><Save className="mr-2 h-4 w-4" />Save Analysis</Button>} />
    <Card><CardContent className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
      <div><Label>Data Source</Label><Select value={source} onValueChange={(value: 'cpp' | 'cqa') => { setSource(value); setParameter(''); }}><SelectTrigger className="mt-2"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="cpp">CPP Observations</SelectItem><SelectItem value="cqa">CQA Results</SelectItem></SelectContent></Select></div>
      <div className="sm:col-span-2"><Label>Parameter</Label><Select value={selectedParameter} onValueChange={setParameter}><SelectTrigger className="mt-2"><SelectValue placeholder="Select parameter" /></SelectTrigger><SelectContent>{parameters.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></div>
      <div><Label>Capability Status</Label><div className="mt-3"><StatusBadge status={result.status} /></div></div>
    </CardContent></Card>
    <DataState loading={loading} empty={!selected.length} emptyText="Record multiple observations for the same CPP or CQA parameter to calculate capability." />
    {!loading && selected.length > 0 && <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><KpiCard label="Cpk" value={result.cpk} tone={result.cpk >= 1.33 ? 'green' : result.cpk >= 1 ? 'amber' : 'red'} /><KpiCard label="Cp" value={result.cp} /><KpiCard label="Ppk" value={result.ppk} /><KpiCard label="Sigma Level" value={result.sigmaLevel} /></div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><KpiCard label="Mean" value={result.mean} /><KpiCard label="Median" value={result.median} /><KpiCard label="Std. Deviation" value={result.standardDeviation} /><KpiCard label="Performance Index" value={`${result.performanceIndex}%`} /></div>
      <Card><CardHeader><CardTitle>{selectedParameter} Capability Distribution</CardTitle></CardHeader><CardContent className="h-[360px]"><ResponsiveContainer width="100%" height="100%"><LineChart data={data}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="sample" /><YAxis domain={['auto', 'auto']} /><Tooltip /><Legend /><ReferenceLine y={lsl} stroke={chartColors.red} strokeDasharray="5 5" label="LSL" /><ReferenceLine y={usl} stroke={chartColors.red} strokeDasharray="5 5" label="USL" /><Line type="monotone" dataKey="value" stroke={chartColors.blue} strokeWidth={2} dot /></LineChart></ResponsiveContainer></CardContent></Card>
    </>}
  </div>;
}

export function TrendsPage() {
  const { loading, cpp, cqa, integrations } = useCpvData(true);
  const [product, setProduct] = useState('all');
  const [period, setPeriod] = useState('12');
  const products = Array.from(new Set([...cpp.map((r) => r.productName), ...cqa.map((r) => r.productName)]));
  const cutoff = new Date(); cutoff.setMonth(cutoff.getMonth() - Number(period));
  const source = [...cpp.map((r) => ({ ...r, parameter: r.parameterName, type: 'CPP' })), ...cqa.map((r) => ({ ...r, parameter: r.testParameter, type: 'CQA' }))]
    .filter((r) => product === 'all' || r.productName === product)
    .filter((r) => !r.createdAt || new Date(r.createdAt) >= cutoff)
    .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
  const trendData = source.map((r, index) => ({ index: index + 1, batch: r.batchNo, value: r.observedValue, target: 'targetValue' in r ? r.targetValue : r.target, parameter: r.parameter, type: r.type }));
  const batches = integrations?.batches as any[] | undefined;
  const yieldData = (batches || []).map((batch, index) => ({ index: index + 1, batch: batch.batch_number || batch.batchNo || `Batch ${index + 1}`, value: Number(batch.yield_percentage ?? batch.yieldPercentage ?? 0) })).filter((item) => item.value);

  return <div className="space-y-6">
    <PageHeading title="Trend Analysis" description="Cross-batch CPP, CQA, assay, pH, particulate, preservative, and yield trend surveillance." />
    <Card><CardContent className="grid gap-4 p-5 sm:grid-cols-3"><div><Label>Product</Label><Select value={product} onValueChange={setProduct}><SelectTrigger className="mt-2"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All Products</SelectItem>{products.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></div><div><Label>Review Period</Label><Select value={period} onValueChange={setPeriod}><SelectTrigger className="mt-2"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="3">Last 3 months</SelectItem><SelectItem value="6">Last 6 months</SelectItem><SelectItem value="12">Last 12 months</SelectItem><SelectItem value="24">Last 24 months</SelectItem></SelectContent></Select></div><div><Label>Records in Scope</Label><Input className="mt-2" value={trendData.length} readOnly /></div></CardContent></Card>
    <DataState loading={loading} empty={!trendData.length && !yieldData.length} emptyText="Trend charts populate automatically as CPV and connected batch data are recorded." />
    {!loading && (trendData.length > 0 || yieldData.length > 0) && <div className="grid gap-6 xl:grid-cols-2">
      <Card><CardHeader><CardTitle>CPP / CQA Trend</CardTitle></CardHeader><CardContent className="h-[380px]"><ResponsiveContainer width="100%" height="100%"><LineChart data={trendData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="batch" hide={trendData.length > 20} /><YAxis /><Tooltip /><Legend /><Line dataKey="value" name="Observed" stroke={chartColors.blue} strokeWidth={2} /><Line dataKey="target" name="Target" stroke={chartColors.green} strokeDasharray="5 5" /></LineChart></ResponsiveContainer></CardContent></Card>
      <Card><CardHeader><CardTitle>Yield Trend</CardTitle></CardHeader><CardContent className="h-[380px]">{yieldData.length ? <ResponsiveContainer width="100%" height="100%"><LineChart data={yieldData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="batch" /><YAxis domain={['auto', 'auto']} /><Tooltip /><Line dataKey="value" name="Yield %" stroke={chartColors.green} strokeWidth={2} /></LineChart></ResponsiveContainer> : <DataState loading={false} empty emptyText="No yield values were found in connected batch collections." />}</CardContent></Card>
    </div>}
  </div>;
}

export function ControlChartsPage() {
  const { loading, cpp, cqa } = useCpvData();
  const [source, setSource] = useState<'cpp' | 'cqa'>('cpp');
  const records = source === 'cpp' ? cpp : cqa;
  const parameters = Array.from(new Set(records.map((record) => source === 'cpp' ? (record as any).parameterName : (record as any).testParameter)));
  const [parameter, setParameter] = useState('');
  const selectedParameter = parameter || parameters[0] || '';
  const selected = records.filter((record) => (source === 'cpp' ? (record as any).parameterName : (record as any).testParameter) === selectedParameter).slice().reverse();
  const limits = calculateControlLimits(selected.map((r) => r.observedValue));

  const chartData = limits.points.map((point) => ({
    ...point, cl: limits.centerLine, ucl: limits.ucl, lcl: limits.lcl,
    violation: point.outOfControl ? point.value : null,
  }));
  return <div className="space-y-6">
    <PageHeading title="Control Charts" description="Individuals and moving-range process control with calculated center lines, three-sigma limits, and highlighted special-cause points." />
    <Card><CardContent className="grid gap-4 p-5 sm:grid-cols-2"><div><Label>Data Source</Label><Select value={source} onValueChange={(value: 'cpp' | 'cqa') => { setSource(value); setParameter(''); }}><SelectTrigger className="mt-2"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="cpp">CPP</SelectItem><SelectItem value="cqa">CQA</SelectItem></SelectContent></Select></div><div><Label>Parameter</Label><Select value={selectedParameter} onValueChange={setParameter}><SelectTrigger className="mt-2"><SelectValue placeholder="Select parameter" /></SelectTrigger><SelectContent>{parameters.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></div></CardContent></Card>
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><KpiCard label="Center Line" value={limits.centerLine} /><KpiCard label="UCL" value={limits.ucl} /><KpiCard label="LCL" value={limits.lcl} /><KpiCard label="Violations" value={limits.points.filter((p) => p.outOfControl).length} tone={limits.points.some((p) => p.outOfControl) ? 'red' : 'green'} /></div>
    <DataState loading={loading} empty={!selected.length} emptyText="A control chart requires observations for a selected parameter." />
    {!loading && selected.length > 0 && <div className="grid gap-6">
      <Card><CardHeader><CardTitle>Individuals / X-Bar View</CardTitle></CardHeader><CardContent className="h-[390px]"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={chartData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="index" /><YAxis domain={['auto', 'auto']} /><Tooltip /><Legend /><Line dataKey="ucl" stroke={chartColors.red} dot={false} strokeDasharray="5 5" /><Line dataKey="cl" stroke={chartColors.green} dot={false} /><Line dataKey="lcl" stroke={chartColors.red} dot={false} strokeDasharray="5 5" /><Line dataKey="value" stroke={chartColors.blue} strokeWidth={2} /><Scatter dataKey="violation" fill={chartColors.red} name="Out of control" /></ComposedChart></ResponsiveContainer></CardContent></Card>
      <Card><CardHeader><CardTitle>Moving Range / R Chart View</CardTitle></CardHeader><CardContent className="h-[330px]"><ResponsiveContainer width="100%" height="100%"><LineChart data={chartData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="index" /><YAxis /><Tooltip /><ReferenceLine y={limits.mrCenterLine} stroke={chartColors.green} label="MR CL" /><ReferenceLine y={limits.mrUcl} stroke={chartColors.red} strokeDasharray="5 5" label="MR UCL" /><Line dataKey="movingRange" stroke={chartColors.amber} strokeWidth={2} /></LineChart></ResponsiveContainer></CardContent></Card>
    </div>}
  </div>;
}
