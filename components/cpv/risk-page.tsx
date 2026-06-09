'use client';

import { useEffect, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/auth-context';
import { RISK_FACTORS, RiskInput, calculateRisk, cpvPermissions, riskSchema } from '@/lib/cpv';
import { createRisk } from '@/lib/cpv-service';
import { useCpvData } from '@/hooks/use-cpv-data';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { DataState, KpiCard, PageHeading, StatusBadge } from '@/components/cpv/cpv-ui';

export function RiskAssessmentPage() {
  const { user, profile } = useAuth();
  const { loading, risks, reload } = useCpvData();
  const [open, setOpen] = useState(false);
  const readOnly = cpvPermissions.isReadOnly(profile?.role);
  const form = useForm<RiskInput>({
    resolver: zodResolver(riskSchema),
    defaultValues: {
      productName: '', batchNo: '', factor: '', likelihood: 1, severity: 1,
      detectability: 1, rationale: '', mitigation: '', owner: profile?.full_name || '', dueDate: '',
    },
  });
  useEffect(() => {
    if (profile?.full_name && !form.getValues('owner')) form.setValue('owner', profile.full_name);
  }, [form, profile?.full_name]);
  const score = calculateRisk(Number(form.watch('likelihood')), Number(form.watch('severity')), Number(form.watch('detectability')));
  const submit = form.handleSubmit(async (values) => {
    try {
      await createRisk(values, { id: user?.uid, name: profile?.full_name, role: profile?.role });
      toast.success('Risk assessment recorded');
      setOpen(false);
      form.reset({ ...form.formState.defaultValues, owner: profile?.full_name || '' } as RiskInput);
      await reload();
    } catch (error) {
      console.error(error);
      toast.error('Risk assessment could not be saved');
    }
  });
  const scoreField = (name: 'likelihood' | 'severity' | 'detectability', label: string) => (
    <FormField control={form.control} name={name} render={({ field }) => <FormItem><FormLabel>{label}</FormLabel><Select value={String(field.value)} onValueChange={(value) => field.onChange(Number(value))}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent>{[1, 2, 3, 4, 5].map((value) => <SelectItem key={value} value={String(value)}>{value}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>} />
  );

  return <div className="space-y-6">
    <PageHeading title="CPV Risk Assessment" description="Structured FMEA-style scoring of process drift, quality trends, loss, deviations, vendors, and equipment." actions={
      <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button disabled={readOnly}><Plus className="mr-2 h-4 w-4" />New Assessment</Button></DialogTrigger><DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto"><DialogHeader><DialogTitle>Risk Assessment</DialogTitle></DialogHeader><Form {...form}><form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2"><FormField control={form.control} name="productName" render={({ field }) => <FormItem><FormLabel>Product Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>} /><FormField control={form.control} name="batchNo" render={({ field }) => <FormItem><FormLabel>Batch No (optional)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>} />
          <FormField control={form.control} name="factor" render={({ field }) => <FormItem className="sm:col-span-2"><FormLabel>Risk Factor</FormLabel><Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue placeholder="Select factor" /></SelectTrigger></FormControl><SelectContent>{RISK_FACTORS.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>} />
          {scoreField('likelihood', 'Likelihood (1-5)')}{scoreField('severity', 'Severity (1-5)')}{scoreField('detectability', 'Detectability (1-5)')}
          <div className="rounded-lg border bg-slate-50 p-3"><p className="text-xs text-muted-foreground">Calculated RPN</p><p className="mt-1 text-2xl font-bold">{score.rpn}</p><StatusBadge status={score.riskLevel} /></div>
          <FormField control={form.control} name="rationale" render={({ field }) => <FormItem className="sm:col-span-2"><FormLabel>Risk Rationale</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>} />
          <FormField control={form.control} name="mitigation" render={({ field }) => <FormItem className="sm:col-span-2"><FormLabel>Mitigation / Control</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>} />
          <FormField control={form.control} name="owner" render={({ field }) => <FormItem><FormLabel>Owner</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>} /><FormField control={form.control} name="dueDate" render={({ field }) => <FormItem><FormLabel>Due Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>} />
        </div><div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit">Save Assessment</Button></div>
      </form></Form></DialogContent></Dialog>
    } />
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><KpiCard label="Assessments" value={risks.length} /><KpiCard label="Low" value={risks.filter((r) => r.riskLevel === 'Low').length} tone="green" /><KpiCard label="High" value={risks.filter((r) => r.riskLevel === 'High').length} tone="amber" /><KpiCard label="Critical" value={risks.filter((r) => r.riskLevel === 'Critical').length} tone="red" /></div>
    <Card><CardHeader><CardTitle>Risk Register</CardTitle></CardHeader><CardContent className="p-0"><DataState loading={loading} empty={!risks.length} />{!loading && risks.length > 0 && <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Product / Batch</TableHead><TableHead>Risk Factor</TableHead><TableHead>L</TableHead><TableHead>S</TableHead><TableHead>D</TableHead><TableHead>RPN</TableHead><TableHead>Level</TableHead><TableHead>Owner / Due</TableHead></TableRow></TableHeader><TableBody>{risks.map((risk) => <TableRow key={risk.id}><TableCell><p className="font-medium">{risk.productName}</p><p className="text-xs text-muted-foreground">{risk.batchNo || 'All batches'}</p></TableCell><TableCell>{risk.factor}</TableCell><TableCell>{risk.likelihood}</TableCell><TableCell>{risk.severity}</TableCell><TableCell>{risk.detectability}</TableCell><TableCell className="font-mono font-bold">{risk.rpn}</TableCell><TableCell><StatusBadge status={risk.riskLevel} /></TableCell><TableCell><p>{risk.owner}</p><p className="text-xs text-muted-foreground">{risk.dueDate}</p></TableCell></TableRow>)}</TableBody></Table></div>}</CardContent></Card>
  </div>;
}
