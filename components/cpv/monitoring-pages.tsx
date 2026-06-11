'use client';

import { useEffect, useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Download, Plus, Search } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/auth-context';
import {
  CPP_PARAMETERS, CQA_PARAMETERS, CPV_COLLECTIONS, CppInput, CppRecord,
  CqaInput, CqaRecord, classifySpecification, cppSchema, cqaSchema, cpvPermissions,
} from '@/lib/cpv';
import { createCpp, createCqa, listCpvRecords } from '@/lib/cpv-service';
import { downloadCsv } from '@/lib/export-utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DataState, KpiCard, PageHeading, StatusBadge } from '@/components/cpv/cpv-ui';

const numberFields = new Set(['observedValue', 'targetValue', 'target', 'lsl', 'usl']);

function TextField({
  form,
  name,
  label,
  type = 'text',
}: {
  form: any;
  name: string;
  label: string;
  type?: string;
}) {
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input
              {...field}
              type={type}
              step={numberFields.has(name) ? 'any' : undefined}
              value={field.value ?? ''}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function ParameterField({
  form,
  name,
  label,
  options,
}: {
  form: any;
  name: string;
  label: string;
  options: string[];
}) {
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <Select onValueChange={field.onChange} value={field.value}>
            <FormControl><SelectTrigger><SelectValue placeholder={`Select ${label.toLowerCase()}`} /></SelectTrigger></FormControl>
            <SelectContent>{options.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent>
          </Select>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

export function CppMonitoringPage() {
  const { user, profile } = useAuth();
  const [records, setRecords] = useState<CppRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const canEnter = cpvPermissions.canEnterCpp(profile?.role);
  const form = useForm<CppInput>({
    resolver: zodResolver(cppSchema),
    defaultValues: {
      productName: '', batchNo: '', manufacturingDate: '', processStage: '',
      parameterName: '', observedValue: 0, targetValue: 0, lsl: 0, usl: 0,
      unit: '', recordedBy: profile?.full_name || '', reviewedBy: '',
    },
  });

  const load = async () => {
    setLoading(true);
    setRecords(await listCpvRecords<CppRecord>(CPV_COLLECTIONS.cpp));
    setLoading(false);
  };
  useEffect(() => { void load(); }, []);
  useEffect(() => {
    if (profile?.full_name && !form.getValues('recordedBy')) form.setValue('recordedBy', profile.full_name);
  }, [form, profile?.full_name]);

  const filtered = useMemo(() => records.filter((record) =>
    [record.productName, record.batchNo, record.parameterName, record.processStage]
      .some((value) => value?.toLowerCase().includes(search.toLowerCase()))), [records, search]);

  const submit = form.handleSubmit(async (values) => {
    try {
      await createCpp(values, { id: user?.uid, name: profile?.full_name, role: profile?.role });
      toast.success('CPP observation recorded with audit metadata');
      setOpen(false);
      form.reset({ ...form.formState.defaultValues, recordedBy: profile?.full_name || '' } as CppInput);
      await load();
    } catch (error) {
      console.error(error);
      toast.error('CPP record could not be saved');
    }
  });

  const preview = classifySpecification(
    Number(form.watch('observedValue')), Number(form.watch('targetValue')),
    Number(form.watch('lsl')), Number(form.watch('usl')),
  );

  return (
    <div className="space-y-6">
      <PageHeading
        title="CPP Monitoring"
        description="Continuous monitoring of critical process parameters with specification controls, attributable entries, and review readiness."
        actions={<>
          <Button variant="outline" onClick={() => downloadCsv('cpv-cpp.csv',
            ['Product', 'Batch', 'Stage', 'Parameter', 'Observed', 'Target', 'LSL', 'USL', 'Unit', 'Status'],
            filtered.map((r) => [r.productName, r.batchNo, r.processStage, r.parameterName, r.observedValue, r.targetValue, r.lsl, r.usl, r.unit, r.status]))}>
            <Download className="mr-2 h-4 w-4" />Export
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button disabled={!canEnter}><Plus className="mr-2 h-4 w-4" />Record CPP</Button></DialogTrigger>
            <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
              <DialogHeader><DialogTitle>Controlled CPP Entry</DialogTitle></DialogHeader>
              <Form {...form}>
                <form onSubmit={submit} className="space-y-5">
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <TextField form={form} name="productName" label="Product Name" />
                    <TextField form={form} name="batchNo" label="Batch No" />
                    <TextField form={form} name="manufacturingDate" label="Manufacturing Date" type="date" />
                    <TextField form={form} name="processStage" label="Process Stage" />
                    <div className="sm:col-span-2"><ParameterField form={form} name="parameterName" label="Parameter" options={CPP_PARAMETERS} /></div>
                    <TextField form={form} name="unit" label="Unit" />
                    <div className="rounded-lg border bg-slate-50 p-3"><p className="text-xs text-muted-foreground">Calculated Status</p><div className="mt-2"><StatusBadge status={preview} /></div></div>
                    <TextField form={form} name="observedValue" label="Observed Value" type="number" />
                    <TextField form={form} name="targetValue" label="Target Value" type="number" />
                    <TextField form={form} name="lsl" label="LSL" type="number" />
                    <TextField form={form} name="usl" label="USL" type="number" />
                    <TextField form={form} name="recordedBy" label="Recorded By" />
                    <TextField form={form} name="reviewedBy" label="Reviewed By" />
                  </div>
                  <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit">Save Controlled Record</Button></div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </>}
      />
      {!canEnter && <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">Your role has read-only access to CPP monitoring.</p>}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Parameters Reviewed" value={records.length} />
        <KpiCard label="Compliant" value={records.filter((r) => r.status === 'Complies').length} tone="green" />
        <KpiCard label="Out Of Trend" value={records.filter((r) => r.status === 'OOT').length} tone="amber" />
        <KpiCard label="Out Of Specification" value={records.filter((r) => r.status === 'OOS').length} tone="red" />
      </div>
      <Card>
        <CardHeader><div className="flex items-center justify-between gap-4"><CardTitle>CPP Register</CardTitle><div className="relative w-full max-w-sm"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Search product, batch, stage..." value={search} onChange={(event) => setSearch(event.target.value)} /></div></div></CardHeader>
        <CardContent className="p-0">
          <DataState loading={loading} empty={!filtered.length} />
          {!loading && filtered.length > 0 && <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Product / Batch</TableHead><TableHead>Stage</TableHead><TableHead>Parameter</TableHead><TableHead className="text-right">Observed</TableHead><TableHead>Limits</TableHead><TableHead>Status</TableHead><TableHead>Recorded By</TableHead></TableRow></TableHeader><TableBody>
            {filtered.map((record) => <TableRow key={record.id}><TableCell><p className="font-medium">{record.productName}</p><p className="text-xs text-muted-foreground">{record.batchNo}</p></TableCell><TableCell>{record.processStage}</TableCell><TableCell>{record.parameterName}</TableCell><TableCell className="text-right font-mono">{record.observedValue} {record.unit}</TableCell><TableCell className="text-xs">{record.lsl} - {record.usl}</TableCell><TableCell><StatusBadge status={record.status} /></TableCell><TableCell>{record.recordedBy}</TableCell></TableRow>)}
          </TableBody></Table></div>}
        </CardContent>
      </Card>
    </div>
  );
}

export function CqaMonitoringPage() {
  const { user, profile } = useAuth();
  const [records, setRecords] = useState<CqaRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const canEnter = cpvPermissions.canEnterCqa(profile?.role);
  const form = useForm<CqaInput>({
    resolver: zodResolver(cqaSchema),
    defaultValues: {
      productName: '', batchNo: '', testDate: new Date().toISOString().split('T')[0], testParameter: '',
      observedValue: 0, target: 0, lsl: 0, usl: 0, unit: '', recordedBy: profile?.full_name || '', reviewedBy: '',
    },
  });
  const load = async () => { setLoading(true); setRecords(await listCpvRecords<CqaRecord>(CPV_COLLECTIONS.cqa)); setLoading(false); };
  useEffect(() => { void load(); }, []);
  useEffect(() => {
    if (profile?.full_name && !form.getValues('recordedBy')) form.setValue('recordedBy', profile.full_name);
  }, [form, profile?.full_name]);
  const filtered = useMemo(() => records.filter((record) =>
    [record.productName, record.batchNo, record.testParameter].some((value) => value?.toLowerCase().includes(search.toLowerCase()))), [records, search]);
  const submit = form.handleSubmit(async (values) => {
    try {
      await createCqa(values, { id: user?.uid, name: profile?.full_name, role: profile?.role });
      toast.success('CQA result recorded with audit metadata');
      setOpen(false);
      form.reset({ ...form.formState.defaultValues, recordedBy: profile?.full_name || '' } as CqaInput);
      await load();
    } catch (error) {
      console.error(error);
      toast.error('CQA result could not be saved');
    }
  });
  const preview = classifySpecification(Number(form.watch('observedValue')), Number(form.watch('target')), Number(form.watch('lsl')), Number(form.watch('usl')));

  return (
    <div className="space-y-6">
      <PageHeading title="CQA Monitoring" description="Quality attribute results with automatic Pass, OOT, and OOS classification across released and in-process batches." actions={<>
        <Button variant="outline" onClick={() => downloadCsv('cpv-cqa.csv', ['Product', 'Batch', 'Test', 'Observed', 'Target', 'LSL', 'USL', 'Unit', 'Status'], filtered.map((r) => [r.productName, r.batchNo, r.testParameter, r.observedValue, r.target, r.lsl, r.usl, r.unit, r.status]))}><Download className="mr-2 h-4 w-4" />Export</Button>
        <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button disabled={!canEnter}><Plus className="mr-2 h-4 w-4" />Record CQA</Button></DialogTrigger><DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto"><DialogHeader><DialogTitle>Controlled CQA Entry</DialogTitle></DialogHeader>
          <Form {...form}><form onSubmit={submit} className="space-y-5"><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <TextField form={form} name="productName" label="Product Name" /><TextField form={form} name="batchNo" label="Batch No" /><ParameterField form={form} name="testParameter" label="Test Parameter" options={[...CQA_PARAMETERS]} />
            <TextField form={form} name="observedValue" label="Observed Value" type="number" /><TextField form={form} name="target" label="Target" type="number" /><TextField form={form} name="unit" label="Unit" />
            <TextField form={form} name="lsl" label="LSL" type="number" /><TextField form={form} name="usl" label="USL" type="number" /><div className="rounded-lg border bg-slate-50 p-3"><p className="text-xs text-muted-foreground">Calculated Status</p><div className="mt-2"><StatusBadge status={preview} /></div></div>
            <TextField form={form} name="recordedBy" label="Recorded By" /><TextField form={form} name="reviewedBy" label="Reviewed By" />
          </div><div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit">Save Controlled Result</Button></div></form></Form>
        </DialogContent></Dialog>
      </>} />
      {!canEnter && <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">Your role has read-only access to CQA monitoring.</p>}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><KpiCard label="CQA Results" value={records.length} /><KpiCard label="Pass" value={records.filter((r) => r.status === 'Complies').length} tone="green" /><KpiCard label="OOT" value={records.filter((r) => r.status === 'OOT').length} tone="amber" /><KpiCard label="OOS" value={records.filter((r) => r.status === 'OOS').length} tone="red" /></div>
      <Card><CardHeader><div className="flex items-center justify-between gap-4"><CardTitle>CQA Register</CardTitle><div className="relative w-full max-w-sm"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Search product, batch, test..." value={search} onChange={(event) => setSearch(event.target.value)} /></div></div></CardHeader><CardContent className="p-0">
        <DataState loading={loading} empty={!filtered.length} />
        {!loading && filtered.length > 0 && <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Product / Batch</TableHead><TableHead>Test Parameter</TableHead><TableHead className="text-right">Observed</TableHead><TableHead className="text-right">Target</TableHead><TableHead>Specification</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody>
          {filtered.map((record) => <TableRow key={record.id}><TableCell><p className="font-medium">{record.productName}</p><p className="text-xs text-muted-foreground">{record.batchNo}</p></TableCell><TableCell>{record.testParameter}</TableCell><TableCell className="text-right font-mono">{record.observedValue} {record.unit}</TableCell><TableCell className="text-right font-mono">{record.target}</TableCell><TableCell className="text-xs">{record.lsl} - {record.usl}</TableCell><TableCell><StatusBadge status={record.status === 'Complies' ? 'Pass' : record.status} /></TableCell></TableRow>)}
        </TableBody></Table></div>}
      </CardContent></Card>
    </div>
  );
}
