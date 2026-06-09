'use client';

import { useEffect, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import {
  CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/auth-context';
import {
  AssayInput, AssayRecord, CPV_COLLECTIONS, ParticulateInput, ParticulateRecord,
  PhysicalInput, PhysicalRecord, PreservativeInput, PreservativeRecord,
  SterilityInput, SterilityRecord, assaySchema, classifySpecification,
  cpvPermissions, particulateSchema, physicalSchema, preservativeSchema, sterilitySchema,
} from '@/lib/cpv';
import {
  createAssay, createParticulate, createPhysical, createPreservative,
  createSterility, listCpvRecords,
} from '@/lib/cpv-service';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DataState, KpiCard, PageHeading, StatusBadge } from '@/components/cpv/cpv-ui';

const colors = ['#2563eb', '#059669', '#7c3aed', '#d97706', '#dc2626'];

function Field({ form, name, label, type = 'text' }: { form: any; name: string; label: string; type?: string }) {
  return <FormField control={form.control} name={name} render={({ field }) => <FormItem>
    <FormLabel>{label}</FormLabel>
    <FormControl><Input {...field} type={type} step={type === 'number' ? 'any' : undefined} value={field.value ?? ''} /></FormControl>
    <FormMessage />
  </FormItem>} />;
}

function SelectField({ form, name, label, options }: { form: any; name: string; label: string; options: string[] }) {
  return <FormField control={form.control} name={name} render={({ field }) => <FormItem>
    <FormLabel>{label}</FormLabel>
    <Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue placeholder={`Select ${label.toLowerCase()}`} /></SelectTrigger></FormControl>
      <SelectContent>{options.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent>
    </Select><FormMessage />
  </FormItem>} />;
}

function CqaTrend({
  title,
  data,
  lines,
}: {
  title: string;
  data: any[];
  lines: Array<{ key: string; label: string }>;
}) {
  return <Card><CardHeader><CardTitle>{title}</CardTitle></CardHeader><CardContent className="h-[360px]">
    {!data.length ? <DataState loading={false} empty emptyText="CQA records will generate this PQR-style trend chart." /> :
      <ResponsiveContainer width="100%" height="100%"><LineChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
        <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="batch" /><YAxis domain={['auto', 'auto']} /><Tooltip /><Legend />
        {lines.map((line, index) => <Line key={line.key} type="monotone" dataKey={line.key} name={line.label} stroke={colors[index % colors.length]} strokeWidth={2} dot={{ r: 3 }} connectNulls />)}
      </LineChart></ResponsiveContainer>}
  </CardContent></Card>;
}

function EntryDialog({
  open,
  onOpenChange,
  title,
  button,
  disabled,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  button: string;
  disabled: boolean;
  children: React.ReactNode;
}) {
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogTrigger asChild><Button disabled={disabled}><Plus className="mr-2 h-4 w-4" />{button}</Button></DialogTrigger>
    <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto"><DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>{children}</DialogContent>
  </Dialog>;
}

export function CqaWorkspace() {
  const { user, profile } = useAuth();
  const canEnter = cpvPermissions.canEnterCqa(profile?.role);
  const actor = { id: user?.uid, name: profile?.full_name, role: profile?.role };
  const [loading, setLoading] = useState(true);
  const [assays, setAssays] = useState<AssayRecord[]>([]);
  const [physical, setPhysical] = useState<PhysicalRecord[]>([]);
  const [sterility, setSterility] = useState<SterilityRecord[]>([]);
  const [preservatives, setPreservatives] = useState<PreservativeRecord[]>([]);
  const [particulates, setParticulates] = useState<ParticulateRecord[]>([]);
  const [open, setOpen] = useState('');

  const assayForm = useForm<AssayInput>({ resolver: zodResolver(assaySchema), defaultValues: { productName: '', batchNo: '', assayPercent: 100, observedValue: 0, lowerLimit: 98, upperLimit: 102, recordedBy: profile?.full_name || '' } });
  const physicalForm = useForm<PhysicalInput>({ resolver: zodResolver(physicalSchema), defaultValues: { productName: '', batchNo: '', testDate: '', ph: 7, extractableVolume: 0, colour: '', description: '', clarity: '', status: 'Complies', recordedBy: profile?.full_name || '' } });
  const sterilityForm = useForm<SterilityInput>({ resolver: zodResolver(sterilitySchema), defaultValues: { productName: '', batchNo: '', testDate: '', result: '', passFail: 'Pass', mediaLotNo: '', analyst: profile?.full_name || '' } });
  const preservativeForm = useForm<PreservativeInput>({ resolver: zodResolver(preservativeSchema), defaultValues: { productName: '', batchNo: '', methylParaben: 0, propylParaben: 0, observedValue: 0, lsl: 0, usl: 0, unit: '%', recordedBy: profile?.full_name || '' } });
  const particulateForm = useForm<ParticulateInput>({ resolver: zodResolver(particulateSchema), defaultValues: { productName: '', batchNo: '', particles10Micron: 0, particles25Micron: 0, observedValue: 0, limit: 0, recordedBy: profile?.full_name || '' } });

  const load = async () => {
    setLoading(true);
    const [assayData, physicalData, sterilityData, preservativeData, particulateData] = await Promise.all([
      listCpvRecords<AssayRecord>(CPV_COLLECTIONS.cqaAssay),
      listCpvRecords<PhysicalRecord>(CPV_COLLECTIONS.cqaPhysical),
      listCpvRecords<SterilityRecord>(CPV_COLLECTIONS.cqaSterility),
      listCpvRecords<PreservativeRecord>(CPV_COLLECTIONS.cqaPreservative),
      listCpvRecords<ParticulateRecord>(CPV_COLLECTIONS.cqaParticulate),
    ]);
    setAssays(assayData); setPhysical(physicalData); setSterility(sterilityData);
    setPreservatives(preservativeData); setParticulates(particulateData); setLoading(false);
  };
  useEffect(() => { void load(); }, []);

  const save = async (action: () => Promise<unknown>, form: any, defaults: any, message: string) => {
    try {
      await action();
      toast.success(message);
      setOpen('');
      form.reset(defaults);
      await load();
    } catch (error) {
      console.error(error);
      toast.error('CQA record could not be saved');
    }
  };

  const assayStatus = classifySpecification(Number(assayForm.watch('observedValue')), Number(assayForm.watch('assayPercent')), Number(assayForm.watch('lowerLimit')), Number(assayForm.watch('upperLimit')));
  const preservativeStatus = classifySpecification(Number(preservativeForm.watch('observedValue')), (Number(preservativeForm.watch('lsl')) + Number(preservativeForm.watch('usl'))) / 2, Number(preservativeForm.watch('lsl')), Number(preservativeForm.watch('usl')));
  const particulateObserved = Number(particulateForm.watch('observedValue'));
  const particulateLimit = Number(particulateForm.watch('limit'));
  const particulateStatus = particulateObserved > particulateLimit ? 'OOS' : particulateObserved >= particulateLimit * 0.9 ? 'OOT' : 'Complies';

  return <div className="space-y-6">
    <PageHeading title="CQA Monitoring" description="Batch-wise analytical, physical, sterility, preservative, and particulate quality surveillance with controlled records and PQR-style charts." />
    {!canEnter && <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">Your role has read-only access. QC and QA roles can record CQA results.</p>}
    <Tabs defaultValue="assay" className="space-y-5">
      <TabsList className="grid h-auto w-full grid-cols-2 gap-1 p-1 lg:grid-cols-5">
        <TabsTrigger value="assay">1. Assay Monitoring</TabsTrigger>
        <TabsTrigger value="physical">2. Physical Parameters</TabsTrigger>
        <TabsTrigger value="sterility">3. Sterility Monitoring</TabsTrigger>
        <TabsTrigger value="preservative">4. Preservative Monitoring</TabsTrigger>
        <TabsTrigger value="particulate">5. Particulate Monitoring</TabsTrigger>
      </TabsList>

      <TabsContent value="assay" className="space-y-5">
        <div className="flex justify-end"><EntryDialog open={open === 'assay'} onOpenChange={(value) => setOpen(value ? 'assay' : '')} title="Assay Monitoring Entry" button="Record Assay" disabled={!canEnter}>
          <Form {...assayForm}><form onSubmit={assayForm.handleSubmit((values) => save(() => createAssay(values, actor), assayForm, { ...assayForm.formState.defaultValues, recordedBy: profile?.full_name || '' }, 'Assay result saved'))} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><Field form={assayForm} name="productName" label="Product Name" /><Field form={assayForm} name="batchNo" label="Batch No" /><Field form={assayForm} name="assayPercent" label="Assay %" type="number" /><Field form={assayForm} name="observedValue" label="Observed Value" type="number" /><Field form={assayForm} name="lowerLimit" label="Lower Limit" type="number" /><Field form={assayForm} name="upperLimit" label="Upper Limit" type="number" /><Field form={assayForm} name="recordedBy" label="Recorded By" /><div className="rounded-lg border bg-slate-50 p-3"><p className="text-xs text-muted-foreground">Status</p><div className="mt-2"><StatusBadge status={assayStatus} /></div></div></div>
            <div className="flex justify-end"><Button type="submit">Save Assay</Button></div>
          </form></Form>
        </EntryDialog></div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><KpiCard label="Assay Batches" value={assays.length} /><KpiCard label="Complies" value={assays.filter((r) => r.status === 'Complies').length} tone="green" /><KpiCard label="OOT" value={assays.filter((r) => r.status === 'OOT').length} tone="amber" /><KpiCard label="OOS" value={assays.filter((r) => r.status === 'OOS').length} tone="red" /></div>
        <CqaTrend title="Assay Trend" data={assays.slice().reverse().map((r) => ({ batch: r.batchNo, assay: r.assayPercent, observed: r.observedValue, lower: r.lowerLimit, upper: r.upperLimit }))} lines={[{ key: 'assay', label: 'Assay %' }, { key: 'observed', label: 'Observed' }, { key: 'lower', label: 'Lower Limit' }, { key: 'upper', label: 'Upper Limit' }]} />
        <CqaTable loading={loading} empty={!assays.length} headers={['Product / Batch', 'Assay %', 'Observed', 'Limits', 'Status']} rows={assays.map((r) => [<RecordKey key="key" product={r.productName} batch={r.batchNo} />, r.assayPercent, r.observedValue, `${r.lowerLimit} - ${r.upperLimit}`, <StatusBadge key="status" status={r.status} />])} />
      </TabsContent>

      <TabsContent value="physical" className="space-y-5">
        <div className="flex justify-end"><EntryDialog open={open === 'physical'} onOpenChange={(value) => setOpen(value ? 'physical' : '')} title="Physical Parameter Entry" button="Record Physical Results" disabled={!canEnter}>
          <Form {...physicalForm}><form onSubmit={physicalForm.handleSubmit((values) => save(() => createPhysical(values, actor), physicalForm, { ...physicalForm.formState.defaultValues, recordedBy: profile?.full_name || '' }, 'Physical parameters saved'))} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><Field form={physicalForm} name="productName" label="Product Name" /><Field form={physicalForm} name="batchNo" label="Batch No" /><Field form={physicalForm} name="testDate" label="Test Date" type="date" /><Field form={physicalForm} name="ph" label="pH" type="number" /><Field form={physicalForm} name="extractableVolume" label="Extractable Volume" type="number" /><Field form={physicalForm} name="colour" label="Colour" /><Field form={physicalForm} name="description" label="Description" /><Field form={physicalForm} name="clarity" label="Clarity" /><SelectField form={physicalForm} name="status" label="Status" options={['Complies', 'OOT', 'OOS']} /><Field form={physicalForm} name="recordedBy" label="Recorded By" /></div>
            <div className="flex justify-end"><Button type="submit">Save Physical Results</Button></div>
          </form></Form>
        </EntryDialog></div>
        <CqaTrend title="Physical Parameter Trend" data={physical.slice().reverse().map((r) => ({ batch: r.batchNo, ph: r.ph, volume: r.extractableVolume }))} lines={[{ key: 'ph', label: 'pH' }, { key: 'volume', label: 'Extractable Volume' }]} />
        <CqaTable loading={loading} empty={!physical.length} headers={['Product / Batch', 'pH', 'Extractable Volume', 'Colour', 'Description / Clarity', 'Status']} rows={physical.map((r) => [<RecordKey key="key" product={r.productName} batch={r.batchNo} />, r.ph, r.extractableVolume, r.colour, `${r.description} / ${r.clarity}`, <StatusBadge key="status" status={r.status} />])} />
      </TabsContent>

      <TabsContent value="sterility" className="space-y-5">
        <div className="flex justify-end"><EntryDialog open={open === 'sterility'} onOpenChange={(value) => setOpen(value ? 'sterility' : '')} title="Sterility Monitoring Entry" button="Record Sterility Test" disabled={!canEnter}>
          <Form {...sterilityForm}><form onSubmit={sterilityForm.handleSubmit((values) => save(() => createSterility(values, actor), sterilityForm, { ...sterilityForm.formState.defaultValues, analyst: profile?.full_name || '' }, 'Sterility test saved'))} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><Field form={sterilityForm} name="productName" label="Product Name" /><Field form={sterilityForm} name="batchNo" label="Batch No" /><Field form={sterilityForm} name="testDate" label="Test Date" type="date" /><Field form={sterilityForm} name="result" label="Result" /><SelectField form={sterilityForm} name="passFail" label="Pass / Fail" options={['Pass', 'Fail']} /><Field form={sterilityForm} name="mediaLotNo" label="Media Lot No" /><Field form={sterilityForm} name="analyst" label="Analyst" /></div>
            <div className="flex justify-end"><Button type="submit">Save Sterility Test</Button></div>
          </form></Form>
        </EntryDialog></div>
        <div className="grid gap-4 sm:grid-cols-3"><KpiCard label="Tests" value={sterility.length} /><KpiCard label="Pass" value={sterility.filter((r) => r.status === 'Pass').length} tone="green" /><KpiCard label="Fail" value={sterility.filter((r) => r.status === 'Fail').length} tone="red" /></div>
        <CqaTable loading={loading} empty={!sterility.length} headers={['Product / Batch', 'Test Date', 'Result', 'Pass / Fail', 'Media Lot No', 'Analyst']} rows={sterility.map((r) => [<RecordKey key="key" product={r.productName} batch={r.batchNo} />, r.testDate, r.result, <StatusBadge key="status" status={r.status} />, r.mediaLotNo, r.analyst])} />
      </TabsContent>

      <TabsContent value="preservative" className="space-y-5">
        <div className="flex justify-end"><EntryDialog open={open === 'preservative'} onOpenChange={(value) => setOpen(value ? 'preservative' : '')} title="Preservative Monitoring Entry" button="Record Preservatives" disabled={!canEnter}>
          <Form {...preservativeForm}><form onSubmit={preservativeForm.handleSubmit((values) => save(() => createPreservative(values, actor), preservativeForm, { ...preservativeForm.formState.defaultValues, recordedBy: profile?.full_name || '' }, 'Preservative result saved'))} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><Field form={preservativeForm} name="productName" label="Product Name" /><Field form={preservativeForm} name="batchNo" label="Batch No" /><Field form={preservativeForm} name="methylParaben" label="Methyl Paraben" type="number" /><Field form={preservativeForm} name="propylParaben" label="Propyl Paraben" type="number" /><Field form={preservativeForm} name="observedValue" label="Observed" type="number" /><Field form={preservativeForm} name="lsl" label="LSL" type="number" /><Field form={preservativeForm} name="usl" label="USL" type="number" /><Field form={preservativeForm} name="unit" label="Unit" /><Field form={preservativeForm} name="recordedBy" label="Recorded By" /><div className="rounded-lg border bg-slate-50 p-3"><p className="text-xs text-muted-foreground">Status</p><div className="mt-2"><StatusBadge status={preservativeStatus} /></div></div></div>
            <div className="flex justify-end"><Button type="submit">Save Preservatives</Button></div>
          </form></Form>
        </EntryDialog></div>
        <CqaTrend title="Preservative Trend" data={preservatives.slice().reverse().map((r) => ({ batch: r.batchNo, methyl: r.methylParaben, propyl: r.propylParaben, observed: r.observedValue, lsl: r.lsl, usl: r.usl }))} lines={[{ key: 'methyl', label: 'Methyl Paraben' }, { key: 'propyl', label: 'Propyl Paraben' }, { key: 'observed', label: 'Observed' }, { key: 'lsl', label: 'LSL' }, { key: 'usl', label: 'USL' }]} />
        <CqaTable loading={loading} empty={!preservatives.length} headers={['Product / Batch', 'Methyl', 'Propyl', 'Observed', 'LSL - USL', 'Status']} rows={preservatives.map((r) => [<RecordKey key="key" product={r.productName} batch={r.batchNo} />, r.methylParaben, r.propylParaben, `${r.observedValue} ${r.unit}`, `${r.lsl} - ${r.usl}`, <StatusBadge key="status" status={r.status} />])} />
      </TabsContent>

      <TabsContent value="particulate" className="space-y-5">
        <div className="flex justify-end"><EntryDialog open={open === 'particulate'} onOpenChange={(value) => setOpen(value ? 'particulate' : '')} title="Particulate Monitoring Entry" button="Record Particulate Test" disabled={!canEnter}>
          <Form {...particulateForm}><form onSubmit={particulateForm.handleSubmit((values) => save(() => createParticulate(values, actor), particulateForm, { ...particulateForm.formState.defaultValues, recordedBy: profile?.full_name || '' }, 'Particulate result saved'))} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><Field form={particulateForm} name="productName" label="Product Name" /><Field form={particulateForm} name="batchNo" label="Batch No" /><Field form={particulateForm} name="particles10Micron" label="Particles >=10 micron" type="number" /><Field form={particulateForm} name="particles25Micron" label="Particles >=25 micron" type="number" /><Field form={particulateForm} name="observedValue" label="Observed" type="number" /><Field form={particulateForm} name="limit" label="Limit" type="number" /><Field form={particulateForm} name="recordedBy" label="Recorded By" /><div className="rounded-lg border bg-slate-50 p-3"><p className="text-xs text-muted-foreground">Status</p><div className="mt-2"><StatusBadge status={particulateStatus} /></div></div></div>
            <div className="flex justify-end"><Button type="submit">Save Particulate Test</Button></div></form>
          </Form>
        </EntryDialog></div>
        <CqaTrend title="Particulate Trend" data={particulates.slice().reverse().map((r) => ({ batch: r.batchNo, particles10: r.particles10Micron, particles25: r.particles25Micron, observed: r.observedValue, limit: r.limit }))} lines={[{ key: 'particles10', label: 'Particles >=10 micron' }, { key: 'particles25', label: 'Particles >=25 micron' }, { key: 'observed', label: 'Observed' }, { key: 'limit', label: 'Limit' }]} />
        <CqaTable loading={loading} empty={!particulates.length} headers={['Product / Batch', '>=10 micron', '>=25 micron', 'Observed', 'Limit', 'Status']} rows={particulates.map((r) => [<RecordKey key="key" product={r.productName} batch={r.batchNo} />, r.particles10Micron, r.particles25Micron, r.observedValue, r.limit, <StatusBadge key="status" status={r.status} />])} />
      </TabsContent>
    </Tabs>
  </div>;
}

function RecordKey({ product, batch }: { product: string; batch: string }) {
  return <div><p className="font-medium">{product}</p><p className="text-xs text-muted-foreground">{batch}</p></div>;
}

function CqaTable({
  loading,
  empty,
  headers,
  rows,
}: {
  loading: boolean;
  empty: boolean;
  headers: string[];
  rows: React.ReactNode[][];
}) {
  return <Card><CardContent className="p-0"><DataState loading={loading} empty={empty} />{!loading && !empty && <div className="overflow-x-auto"><Table><TableHeader><TableRow>{headers.map((header) => <TableHead key={header}>{header}</TableHead>)}</TableRow></TableHeader><TableBody>{rows.map((row, rowIndex) => <TableRow key={rowIndex}>{row.map((cell, cellIndex) => <TableCell key={cellIndex}>{cell}</TableCell>)}</TableRow>)}</TableBody></Table></div>}</CardContent></Card>;
}
