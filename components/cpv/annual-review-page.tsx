'use client';

import { useMemo, useState } from 'react';
import { addDoc, collection } from 'firebase/firestore';
import { Download, Save } from 'lucide-react';
import { toast } from 'sonner';
import { firestore } from '@/lib/firebase';
import { CPV_COLLECTIONS, calculateCapability, calculateControlLimits } from '@/lib/cpv';
import { useCpvData } from '@/hooks/use-cpv-data';
import { useAuth } from '@/contexts/auth-context';
import { printPage } from '@/lib/export-utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { KpiCard, PageHeading, StatusBadge } from '@/components/cpv/cpv-ui';

export function AnnualReviewPage() {
  const { user, profile } = useAuth();
  const { loading, cpp, cqa, risks, integrations } = useCpvData(true);
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [recommendations, setRecommendations] = useState('');
  const inYear = (createdAt?: string) => !createdAt || new Date(createdAt).getFullYear() === year;
  const cppYear = cpp.filter((record) => inYear(record.createdAt));
  const cqaYear = cqa.filter((record) => inYear(record.createdAt));
  const riskYear = risks.filter((record) => inYear(record.createdAt));
  const all = [...cppYear, ...cqaYear];
  const grouped = useMemo(() => {
    const map = new Map<string, typeof all>();
    all.forEach((record) => {
      const key = 'parameterName' in record ? record.parameterName : record.testParameter;
      map.set(key, [...(map.get(key) || []), record]);
    });
    return map;
  }, [all]);
  const capabilities = Array.from(grouped.entries()).map(([parameter, records]) => ({
    parameter, ...calculateCapability(records.map((r) => r.observedValue), records[0].lsl, records[0].usl),
  })).filter((item) => item.count >= 2);
  const averageCpk = capabilities.length ? capabilities.reduce((sum, item) => sum + item.cpk, 0) / capabilities.length : 0;
  const violations = Array.from(grouped.values()).reduce((sum, records) => sum + calculateControlLimits(records.map((r) => r.observedValue)).points.filter((p) => p.outOfControl).length, 0);
  const oot = all.filter((r) => r.status === 'OOT').length;
  const oos = all.filter((r) => r.status === 'OOS').length;
  const criticalRisks = riskYear.filter((r) => r.riskLevel === 'Critical' || r.riskLevel === 'High').length;
  const stable = oos === 0 && criticalRisks === 0 && (capabilities.length === 0 || averageCpk >= 1);
  const conclusion = stable
    ? 'The process remains in a state of control. Available CPP and CQA evidence supports continued commercial manufacturing under the approved control strategy.'
    : 'The process requires enhanced monitoring and documented remediation. Identified OOS events, capability concerns, control-chart signals, or elevated risks should be linked to investigation and CAPA.';

  const save = async () => {
    try {
      await addDoc(collection(firestore, CPV_COLLECTIONS.annualReview), {
        reviewYear: year, cppCount: cppYear.length, cqaCount: cqaYear.length, oot,
        oos, averageCpk, controlViolations: violations, riskCount: riskYear.length,
        criticalRisks, conclusion, recommendations, status: 'draft',
        preparedBy: profile?.full_name || 'System', preparedById: user?.uid || 'system',
        createdAt: new Date().toISOString(), version: 1,
        sourceSnapshot: {
          batches: integrations?.batches.length || 0, deviations: integrations?.deviations.length || 0,
          oos: integrations?.oos.length || 0, capa: integrations?.capa.length || 0,
          stability: integrations?.stability.length || 0, pqr: integrations?.pqr.length || 0,
        },
      });
      toast.success('Annual CPV review saved as draft');
    } catch (error) {
      console.error(error);
      toast.error('Annual review could not be saved');
    }
  };

  return <div className="space-y-6">
    <div className="no-print"><PageHeading title="Annual CPV Review" description="Controlled annual synthesis of process parameters, quality attributes, capability, control, integrated quality events, and risk." actions={<><Button variant="outline" onClick={printPage}><Download className="mr-2 h-4 w-4" />Generate PDF</Button><Button onClick={save}><Save className="mr-2 h-4 w-4" />Save Draft</Button></>} /></div>
    <Card className="no-print"><CardContent className="grid gap-4 p-5 sm:grid-cols-3"><div><Label>Review Year</Label><Input className="mt-2" type="number" min="2000" max={currentYear} value={year} onChange={(event) => setYear(Number(event.target.value))} /></div><div><Label>Prepared By</Label><Input className="mt-2" value={profile?.full_name || ''} readOnly /></div><div><Label>Document Status</Label><div className="mt-3"><StatusBadge status="Draft" /></div></div></CardContent></Card>
    <article className="space-y-6 bg-white p-2 text-slate-950 print:p-0 dark:bg-transparent dark:text-foreground">
      <div className="hidden border-b-2 border-blue-800 pb-5 print:block"><p className="text-sm font-bold text-blue-800">SKYMAP PHARMACEUTICALS</p><h1 className="mt-2 text-3xl font-bold">Annual Continued Process Verification Report</h1><p className="mt-2 text-sm">Review Year: {year} | Generated: {new Date().toLocaleDateString()}</p></div>
      <section><h2 className="mb-3 text-xl font-bold">Executive Summary</h2><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><KpiCard label="CPP Reviewed" value={cppYear.length} /><KpiCard label="CQA Reviewed" value={cqaYear.length} /><KpiCard label="Average Cpk" value={averageCpk.toFixed(2)} tone={averageCpk >= 1.33 ? 'green' : averageCpk >= 1 ? 'amber' : 'red'} /><KpiCard label="OOT / OOS" value={`${oot} / ${oos}`} tone={oos ? 'red' : oot ? 'amber' : 'green'} /></div></section>
      <section className="grid gap-6 lg:grid-cols-2"><Card><CardHeader><CardTitle>CPP Summary</CardTitle></CardHeader><CardContent><p className="text-sm">Parameters reviewed: <strong>{cppYear.length}</strong></p><p className="mt-2 text-sm">Compliant: {cppYear.filter((r) => r.status === 'Complies').length}; OOT: {cppYear.filter((r) => r.status === 'OOT').length}; OOS: {cppYear.filter((r) => r.status === 'OOS').length}.</p></CardContent></Card><Card><CardHeader><CardTitle>CQA Summary</CardTitle></CardHeader><CardContent><p className="text-sm">Results reviewed: <strong>{cqaYear.length}</strong></p><p className="mt-2 text-sm">Pass: {cqaYear.filter((r) => r.status === 'Complies').length}; OOT: {cqaYear.filter((r) => r.status === 'OOT').length}; OOS: {cqaYear.filter((r) => r.status === 'OOS').length}.</p></CardContent></Card></section>
      <section><Card><CardHeader><CardTitle>Process Capability Analysis</CardTitle></CardHeader><CardContent>{capabilities.length ? <div className="grid gap-2 sm:grid-cols-2">{capabilities.map((item) => <div key={item.parameter} className="flex items-center justify-between rounded border p-3 text-sm"><span>{item.parameter}</span><span className="flex items-center gap-3"><strong>Cpk {item.cpk}</strong><StatusBadge status={item.status} /></span></div>)}</div> : <p className="text-sm text-muted-foreground">Insufficient repeated parameter data for capability analysis.</p>}</CardContent></Card></section>
      <section className="grid gap-6 lg:grid-cols-2"><Card><CardHeader><CardTitle>Trend and Control Review</CardTitle></CardHeader><CardContent><p className="text-sm">Special-cause control signals identified: <strong>{violations}</strong>.</p><p className="mt-2 text-sm">OOT observations: <strong>{oot}</strong>. OOS observations: <strong>{oos}</strong>.</p></CardContent></Card><Card><CardHeader><CardTitle>Risk and Quality System Review</CardTitle></CardHeader><CardContent><p className="text-sm">CPV risk assessments: <strong>{riskYear.length}</strong>; high/critical: <strong>{criticalRisks}</strong>.</p><p className="mt-2 text-sm">Connected deviations: {integrations?.deviations.length || 0}; OOS: {integrations?.oos.length || 0}; CAPA: {integrations?.capa.length || 0}; stability: {integrations?.stability.length || 0}.</p></CardContent></Card></section>
      <section><Card><CardHeader><CardTitle>Process Stability Conclusion</CardTitle></CardHeader><CardContent><div className="mb-3"><StatusBadge status={stable ? 'Stable' : 'Risk'} /></div><p className="text-sm leading-6">{conclusion}</p></CardContent></Card></section>
      <section><Card><CardHeader><CardTitle>Recommendations</CardTitle></CardHeader><CardContent><Textarea className="no-print min-h-32" value={recommendations} onChange={(event) => setRecommendations(event.target.value)} placeholder="Document monitoring actions, investigations, CAPA, control strategy updates, or validation commitments..." /><p className="hidden whitespace-pre-wrap text-sm print:block">{recommendations || 'No additional recommendations documented.'}</p></CardContent></Card></section>
      <section className="print-break"><Card><CardHeader><CardTitle>QA Approval and Electronic Signature</CardTitle></CardHeader><CardContent className="grid gap-8 sm:grid-cols-3"><div><p className="text-xs text-muted-foreground">Prepared By</p><p className="mt-6 border-t pt-2 text-sm">{profile?.full_name || '________________'}</p></div><div><p className="text-xs text-muted-foreground">Reviewed By (QA)</p><p className="mt-6 border-t pt-2 text-sm">Electronic signature pending</p></div><div><p className="text-xs text-muted-foreground">Approved By</p><p className="mt-6 border-t pt-2 text-sm">Electronic signature pending</p></div></CardContent></Card></section>
    </article>
    {loading && <p className="text-sm text-muted-foreground">Refreshing annual source data...</p>}
  </div>;
}
