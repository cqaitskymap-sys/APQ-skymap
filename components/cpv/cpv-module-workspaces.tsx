'use client';

import { useEffect, useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Plus, Printer, FileSpreadsheet, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/auth-context';
import { cpvPermissions } from '@/lib/cpv';
import {
  CPV_CONFIG_COLLECTIONS, productMasterSchema, type ProductMaster,
} from '@/lib/cpv-config';
import {
  CPV_MODULE_COLLECTIONS, batchSchema, rawMaterialSchema, packingMaterialSchema,
  utilityMonitoringSchema, environmentSchema, yieldMonitoringSchema, stabilitySchema,
  holdTimeSchema, SHIFTS, STABILITY_CONDITIONS, STABILITY_TIMEPOINTS,
  YIELD_STAGES, UTILITY_TYPES, UTILITY_PARAMS, EM_GRADES, PACKING_TYPES,
  type BatchInput,
} from '@/lib/cpv-modules';
import {
  createBatch, createRawMaterial, createPackingMaterial, createUtilityRecord,
  createEnvironment, createYieldRecord, createStability, createHoldTime,
  updateBatchStatus, listBatches, listAlerts, acknowledgeAlert, closeAlert,
  loadAllCpvModules,
} from '@/lib/cpv-module-service';
import {
  createConfigRecord, updateConfigRecord,
} from '@/lib/cpv-config-service';
import { useCpvConfig } from '@/hooks/use-cpv-config';
import { useCpvData } from '@/hooks/use-cpv-data';
import { downloadCsv, printPage } from '@/lib/export-utils';
import { GenericCpvWorkspace } from '@/components/cpv/generic-cpv-workspace';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { DataState, KpiCard, PageHeading, StatusBadge } from '@/components/cpv/cpv-ui';

const today = () => new Date().toISOString().split('T')[0];

export function RawMaterialWorkspace() {
  return (
    <GenericCpvWorkspace
      config={{
        title: 'Raw Material Monitoring',
        description: 'API and excipient quality tracking with vendor-wise trend analysis and performance scoring.',
        collection: CPV_MODULE_COLLECTIONS.rawMaterials,
        schema: rawMaterialSchema,
        defaultValues: {
          productName: '', batchNo: '', apiName: '', vendor: '', grnNo: '', arNo: '',
          coaNumber: '', assay: 0, impurity: 0, waterContent: 0, particleSize: '',
          lsl: 95, usl: 105, recordedBy: '',
        },
        fields: [
          { name: 'productName', label: 'Product Name' },
          { name: 'batchNo', label: 'Batch No' },
          { name: 'apiName', label: 'API Name' },
          { name: 'vendor', label: 'Vendor' },
          { name: 'grnNo', label: 'GRN No' },
          { name: 'arNo', label: 'AR No' },
          { name: 'coaNumber', label: 'COA Number' },
          { name: 'assay', label: 'Assay %', type: 'number' },
          { name: 'impurity', label: 'Impurity %', type: 'number' },
          { name: 'waterContent', label: 'Water Content %', type: 'number' },
          { name: 'particleSize', label: 'Particle Size' },
          { name: 'lsl', label: 'LSL', type: 'number' },
          { name: 'usl', label: 'USL', type: 'number' },
          { name: 'recordedBy', label: 'Recorded By' },
        ],
        columns: [
          { key: 'batchNo', label: 'Batch' },
          { key: 'apiName', label: 'API' },
          { key: 'vendor', label: 'Vendor' },
          { key: 'grnNo', label: 'GRN' },
          { key: 'assay', label: 'Assay %' },
          { key: 'impurity', label: 'Impurity %' },
          { key: 'vendorScore', label: 'Vendor Score', render: (v) => `${v}%` },
        ],
        trendValueKey: 'assay',
        trendLimits: { lower: 95, upper: 105 },
        statusKey: 'status',
        permission: cpvPermissions.canEnterCqa,
        kpis: (records) => {
          const pass = records.filter((r) => r.status === 'Complies').length;
          const vendors = new Set(records.map((r) => r.vendor)).size;
          return [
            { label: 'Total Records', value: records.length, tone: 'blue' },
            { label: 'Compliant', value: pass, tone: 'green' },
            { label: 'Vendors', value: vendors, tone: 'amber' },
            { label: 'Avg Assay', value: records.length ? (records.reduce((s, r) => s + Number(r.assay || 0), 0) / records.length).toFixed(2) : '0', tone: 'blue' },
          ];
        },
        onSubmit: async (values, actor, records) => {
          await createRawMaterial(
            values as Parameters<typeof createRawMaterial>[0],
            actor,
            records as unknown as Parameters<typeof createRawMaterial>[2],
          );
        },
      }}
    />
  );
}

export function PackingMaterialWorkspace() {
  return (
    <GenericCpvWorkspace
      config={{
        title: 'Packing Material Monitoring',
        description: 'Primary and secondary packaging component quality verification — vials, stoppers, seals, cartons, labels.',
        collection: CPV_MODULE_COLLECTIONS.packingMaterials,
        schema: packingMaterialSchema,
        defaultValues: {
          productName: '', batchNo: '', materialType: 'Vial', vendor: '',
          grnNo: '', arNo: '', testResult: 'Pass', status: 'Pass', recordedBy: '',
        },
        fields: [
          { name: 'productName', label: 'Product Name' },
          { name: 'batchNo', label: 'Batch No' },
          { name: 'materialType', label: 'Material Type', type: 'select', options: PACKING_TYPES },
          { name: 'vendor', label: 'Vendor' },
          { name: 'grnNo', label: 'GRN No' },
          { name: 'arNo', label: 'AR No' },
          { name: 'testResult', label: 'Test Result' },
          { name: 'status', label: 'Status', type: 'select', options: ['Pass', 'Fail', 'Pending'] },
          { name: 'recordedBy', label: 'Recorded By' },
        ],
        columns: [
          { key: 'batchNo', label: 'Batch' },
          { key: 'materialType', label: 'Material' },
          { key: 'vendor', label: 'Vendor' },
          { key: 'grnNo', label: 'GRN' },
          { key: 'arNo', label: 'AR No' },
          { key: 'testResult', label: 'Result' },
          { key: 'status', label: 'Status', render: (v) => <StatusBadge status={String(v)} /> },
        ],
        permission: cpvPermissions.canEnterCqa,
        onSubmit: async (values, actor) => { await createPackingMaterial(values as Parameters<typeof createPackingMaterial>[0], actor); },
      }}
    />
  );
}

export function UtilityMonitoringWorkspace() {
  return (
    <GenericCpvWorkspace
      config={{
        title: 'Utility Monitoring',
        description: 'Purified water, WFI, compressed air, nitrogen, and steam system parameter monitoring with alert generation.',
        collection: CPV_MODULE_COLLECTIONS.utilityMonitoring,
        schema: utilityMonitoringSchema,
        defaultValues: {
          utilityType: 'Purified Water', parameterName: 'Conductivity', observedValue: 0,
          lsl: 0, usl: 1.3, unit: 'µS/cm', recordedDate: today(), recordedBy: '',
          batchNo: '', productName: '',
        },
        fields: [
          { name: 'utilityType', label: 'Utility Type', type: 'select', options: UTILITY_TYPES },
          { name: 'parameterName', label: 'Parameter', type: 'select', options: UTILITY_PARAMS },
          { name: 'observedValue', label: 'Observed Value', type: 'number' },
          { name: 'lsl', label: 'LSL', type: 'number' },
          { name: 'usl', label: 'USL', type: 'number' },
          { name: 'unit', label: 'Unit' },
          { name: 'recordedDate', label: 'Date', type: 'date' },
          { name: 'batchNo', label: 'Batch No (optional)' },
          { name: 'productName', label: 'Product (optional)' },
          { name: 'recordedBy', label: 'Recorded By' },
        ],
        columns: [
          { key: 'utilityType', label: 'Utility' },
          { key: 'parameterName', label: 'Parameter' },
          { key: 'observedValue', label: 'Value' },
          { key: 'unit', label: 'Unit' },
          { key: 'recordedDate', label: 'Date' },
        ],
        trendValueKey: 'observedValue',
        trendLabelKey: 'recordedDate',
        statusKey: 'status',
        permission: cpvPermissions.canEnterCpp,
        onSubmit: async (values, actor) => { await createUtilityRecord(values as Parameters<typeof createUtilityRecord>[0], actor); },
      }}
    />
  );
}

export function EnvironmentalWorkspace() {
  return (
    <GenericCpvWorkspace
      config={{
        title: 'Environmental Monitoring',
        description: 'Cleanroom grade monitoring — temperature, humidity, differential pressure, and viable counts.',
        collection: CPV_MODULE_COLLECTIONS.environment,
        schema: environmentSchema,
        defaultValues: {
          area: '', grade: 'A', recordedDate: today(), temperature: 22, humidity: 50,
          differentialPressure: 15, viableCountAir: 0, viableCountSettle: 0, viableCountContact: 0,
          tempLsl: 18, tempUsl: 25, humidityLsl: 30, humidityUsl: 65, recordedBy: '',
        },
        fields: [
          { name: 'area', label: 'Area' },
          { name: 'grade', label: 'Grade', type: 'select', options: EM_GRADES },
          { name: 'recordedDate', label: 'Date', type: 'date' },
          { name: 'temperature', label: 'Temperature °C', type: 'number' },
          { name: 'humidity', label: 'Humidity %', type: 'number' },
          { name: 'differentialPressure', label: 'Diff. Pressure Pa', type: 'number' },
          { name: 'viableCountAir', label: 'Air Sample CFU', type: 'number' },
          { name: 'viableCountSettle', label: 'Settle Plate CFU', type: 'number' },
          { name: 'viableCountContact', label: 'Contact Plate CFU', type: 'number' },
          { name: 'recordedBy', label: 'Recorded By' },
        ],
        columns: [
          { key: 'area', label: 'Area' },
          { key: 'grade', label: 'Grade' },
          { key: 'recordedDate', label: 'Date' },
          { key: 'temperature', label: 'Temp °C' },
          { key: 'humidity', label: 'RH %' },
          { key: 'differentialPressure', label: 'DP Pa' },
          { key: 'viableCountAir', label: 'Air CFU' },
        ],
        trendValueKey: 'temperature',
        trendLabelKey: 'recordedDate',
        statusKey: 'status',
        permission: cpvPermissions.canEnterCpp,
        onSubmit: async (values, actor) => { await createEnvironment(values as Parameters<typeof createEnvironment>[0], actor); },
      }}
    />
  );
}

export function YieldMonitoringWorkspace() {
  return (
    <GenericCpvWorkspace
      config={{
        title: 'Yield Monitoring',
        description: 'Bulk, filling, and packing yield tracking with automatic yield % and variance calculation.',
        collection: CPV_MODULE_COLLECTIONS.yieldMonitoring,
        schema: yieldMonitoringSchema,
        defaultValues: {
          productName: '', batchNo: '', stage: 'Bulk Yield', expectedYield: 100,
          actualYield: 0, recordedBy: '', manufacturingDate: today(),
        },
        fields: [
          { name: 'productName', label: 'Product Name' },
          { name: 'batchNo', label: 'Batch No' },
          { name: 'stage', label: 'Stage', type: 'select', options: YIELD_STAGES },
          { name: 'expectedYield', label: 'Expected Yield', type: 'number' },
          { name: 'actualYield', label: 'Actual Yield', type: 'number' },
          { name: 'manufacturingDate', label: 'Mfg Date', type: 'date' },
          { name: 'recordedBy', label: 'Recorded By' },
        ],
        columns: [
          { key: 'batchNo', label: 'Batch' },
          { key: 'stage', label: 'Stage' },
          { key: 'expectedYield', label: 'Expected' },
          { key: 'actualYield', label: 'Actual' },
          { key: 'yieldPercent', label: 'Yield %', render: (v) => `${v}%` },
          { key: 'variancePercent', label: 'Variance %', render: (v) => `${v}%` },
        ],
        trendValueKey: 'yieldPercent',
        statusKey: 'status',
        permission: cpvPermissions.canEnterCpp,
        onSubmit: async (values, actor) => { await createYieldRecord(values as Parameters<typeof createYieldRecord>[0], actor); },
      }}
    />
  );
}

export function StabilityWorkspace() {
  return (
    <GenericCpvWorkspace
      config={{
        title: 'Stability Monitoring',
        description: 'ICH stability study data — assay, pH, related substances, and endotoxin at defined time points.',
        collection: CPV_MODULE_COLLECTIONS.stability,
        schema: stabilitySchema,
        defaultValues: {
          productName: '', batchNo: '', condition: '25°C / 60% RH', timePoint: '0 Month',
          parameterName: 'Assay', observedValue: 0, lsl: 95, usl: 105, unit: '%',
          recordedBy: '', testDate: today(),
        },
        fields: [
          { name: 'productName', label: 'Product Name' },
          { name: 'batchNo', label: 'Batch No' },
          { name: 'condition', label: 'Condition', type: 'select', options: STABILITY_CONDITIONS },
          { name: 'timePoint', label: 'Time Point', type: 'select', options: STABILITY_TIMEPOINTS },
          { name: 'parameterName', label: 'Parameter', type: 'select', options: ['Assay', 'pH', 'Related Substance', 'Endotoxin'] },
          { name: 'observedValue', label: 'Observed Value', type: 'number' },
          { name: 'lsl', label: 'LSL', type: 'number' },
          { name: 'usl', label: 'USL', type: 'number' },
          { name: 'unit', label: 'Unit' },
          { name: 'testDate', label: 'Test Date', type: 'date' },
          { name: 'recordedBy', label: 'Recorded By' },
        ],
        columns: [
          { key: 'batchNo', label: 'Batch' },
          { key: 'condition', label: 'Condition' },
          { key: 'timePoint', label: 'Time Point' },
          { key: 'parameterName', label: 'Parameter' },
          { key: 'observedValue', label: 'Result' },
          { key: 'unit', label: 'Unit' },
        ],
        trendValueKey: 'observedValue',
        trendLabelKey: 'timePoint',
        statusKey: 'status',
        permission: cpvPermissions.canEnterCqa,
        onSubmit: async (values, actor) => { await createStability(values as Parameters<typeof createStability>[0], actor); },
      }}
    />
  );
}

export function HoldTimeWorkspace() {
  return (
    <GenericCpvWorkspace
      config={{
        title: 'Hold Time Monitoring',
        description: 'Process hold time verification against validated limits — Pass/Fail with trend analysis.',
        collection: CPV_MODULE_COLLECTIONS.holdTime,
        schema: holdTimeSchema,
        defaultValues: {
          productName: '', batchNo: '', stage: 'Bulk Hold', allowedTime: 24,
          actualTime: 0, unit: 'hr', recordedBy: '', manufacturingDate: today(),
        },
        fields: [
          { name: 'productName', label: 'Product Name' },
          { name: 'batchNo', label: 'Batch No' },
          { name: 'stage', label: 'Stage' },
          { name: 'allowedTime', label: 'Allowed Time', type: 'number' },
          { name: 'actualTime', label: 'Actual Time', type: 'number' },
          { name: 'unit', label: 'Unit' },
          { name: 'manufacturingDate', label: 'Mfg Date', type: 'date' },
          { name: 'recordedBy', label: 'Recorded By' },
        ],
        columns: [
          { key: 'batchNo', label: 'Batch' },
          { key: 'stage', label: 'Stage' },
          { key: 'allowedTime', label: 'Allowed' },
          { key: 'actualTime', label: 'Actual' },
          { key: 'unit', label: 'Unit' },
          { key: 'variancePercent', label: 'Variance %', render: (v) => `${v}%` },
          { key: 'status', label: 'Status', render: (v) => <StatusBadge status={String(v)} /> },
        ],
        trendValueKey: 'actualTime',
        permission: cpvPermissions.canEnterCpp,
        onSubmit: async (values, actor) => { await createHoldTime(values as Parameters<typeof createHoldTime>[0], actor); },
      }}
    />
  );
}

export function ProductMasterWorkspace() {
  const { user, profile } = useAuth();
  const { config, reload } = useCpvConfig();
  const canConfigure = cpvPermissions.canConfigure(profile?.role);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ProductMaster | null>(null);
  const actor = { id: user?.uid, name: profile?.full_name, role: profile?.role };

  const form = useForm<ProductMaster>({
    resolver: zodResolver(productMasterSchema),
    defaultValues: {
      productCode: '', productName: '', genericName: '', strength: '', dosageForm: '',
      packSize: '', market: '', shelfLife: '', bmrNumber: '', bprNumber: '', status: 'Active',
    },
  });

  const products = config.products;

  const submit = form.handleSubmit(async (values) => {
    try {
      if (editing?.id) {
        await updateConfigRecord(CPV_CONFIG_COLLECTIONS.products, editing.id, values, actor);
        toast.success('Product updated');
      } else {
        await createConfigRecord(CPV_CONFIG_COLLECTIONS.products, values, actor);
        toast.success('Product registered');
      }
      setOpen(false);
      setEditing(null);
      form.reset();
      await reload();
    } catch { toast.error('Could not save product'); }
  });

  return (
    <div className="space-y-6">
      <PageHeading
        title="Product Master"
        description="GMP product registry for CPV scope — dosage form, strength, BMR/BPR numbers, and market authorization."
        actions={
          canConfigure ? (
            <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditing(null); form.reset(); } }}>
              <DialogTrigger asChild><Button className="gap-2"><Plus className="h-4 w-4" />Add Product</Button></DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader><DialogTitle>{editing ? 'Edit' : 'Register'} Product</DialogTitle></DialogHeader>
                <Form {...form}>
                  <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
                    {[
                      ['productCode', 'Product Code'], ['productName', 'Product Name'],
                      ['genericName', 'Generic Name'], ['strength', 'Strength'],
                      ['dosageForm', 'Dosage Form'], ['packSize', 'Pack Size'],
                      ['market', 'Market'], ['shelfLife', 'Shelf Life'],
                      ['bmrNumber', 'BMR Number'], ['bprNumber', 'BPR Number'],
                    ].map(([name, label]) => (
                      <FormField key={name} control={form.control} name={name as 'productCode'} render={({ field }) => (
                        <FormItem><FormLabel>{label}</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                    ))}
                    <FormField control={form.control} name="status" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Active">Active</SelectItem>
                            <SelectItem value="Inactive">Inactive</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )} />
                    <div className="sm:col-span-2 flex justify-end gap-2">
                      <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                      <Button type="submit">Save</Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          ) : undefined
        }
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard label="Total Products" value={products.length} tone="blue" />
        <KpiCard label="Active" value={products.filter((p) => p.status === 'Active').length} tone="green" />
        <KpiCard label="Inactive" value={products.filter((p) => p.status !== 'Active').length} tone="amber" />
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                {['Code', 'Product', 'Strength', 'Dosage Form', 'Pack Size', 'Market', 'BMR', 'Status', 'Actions'].map((h) => (
                  <TableHead key={h}>{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{p.productCode}</TableCell>
                  <TableCell className="font-medium">{p.productName}</TableCell>
                  <TableCell>{p.strength}</TableCell>
                  <TableCell>{p.dosageForm}</TableCell>
                  <TableCell>{(p as ProductMaster & { packSize?: string }).packSize || '—'}</TableCell>
                  <TableCell>{(p as ProductMaster & { market?: string }).market || '—'}</TableCell>
                  <TableCell>{(p as ProductMaster & { bmrNumber?: string }).bmrNumber || '—'}</TableCell>
                  <TableCell><StatusBadge status={p.status} /></TableCell>
                  <TableCell>
                    {canConfigure && (
                      <Button size="sm" variant="ghost" onClick={() => {
                        setEditing(p);
                        form.reset(p as typeof form.formState.defaultValues);
                        setOpen(true);
                      }}>Edit</Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

export function BatchRegistrationWorkspace() {
  const { user, profile } = useAuth();
  const canEdit = cpvPermissions.canEnterCpp(profile?.role);
  const canReview = cpvPermissions.canReview(profile?.role);
  const [loading, setLoading] = useState(true);
  const [batches, setBatches] = useState<Awaited<ReturnType<typeof listBatches>>>([]);
  const [open, setOpen] = useState(false);
  const { config } = useCpvConfig();
  const actor = { id: user?.uid, name: profile?.full_name, role: profile?.role };

  const form = useForm<BatchInput>({
    resolver: zodResolver(batchSchema),
    defaultValues: {
      batchNumber: '', productName: '', productCode: '', manufacturingDate: today(),
      expiryDate: '', batchSize: '', market: '', shift: 'A', manufacturingLine: '',
      bmrNumber: '', status: 'Open', recordedBy: profile?.full_name || '', reviewedBy: '', approvedBy: '',
    },
  });

  const load = async () => {
    setLoading(true);
    setBatches(await listBatches());
    setLoading(false);
  };
  useEffect(() => { void load(); }, []);

  const submit = form.handleSubmit(async (values) => {
    await createBatch(values, actor);
    toast.success('Batch registered');
    setOpen(false);
    form.reset({ ...form.formState.defaultValues, recordedBy: profile?.full_name || '' });
    await load();
  });

  const statusCounts = useMemo(() => ({
    open: batches.filter((b) => b.status === 'Open').length,
    review: batches.filter((b) => b.status === 'Under Review').length,
    approved: batches.filter((b) => b.status === 'Approved').length,
    rejected: batches.filter((b) => b.status === 'Rejected').length,
  }), [batches]);

  return (
    <div className="space-y-6">
      <PageHeading
        title="Batch Registration"
        description="Register manufacturing batches for CPV monitoring with electronic approval workflow."
        actions={canEdit && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button className="gap-2"><Plus className="h-4 w-4" />Register Batch</Button></DialogTrigger>
            <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
              <DialogHeader><DialogTitle>Register New Batch</DialogTitle></DialogHeader>
              <Form {...form}>
                <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
                  <FormField control={form.control} name="batchNumber" render={({ field }) => (
                    <FormItem><FormLabel>Batch Number</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="productName" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Product</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                        <SelectContent>
                          {config.products.filter((p) => p.status === 'Active').map((p) => (
                            <SelectItem key={p.id} value={p.productName}>{p.productName}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )} />
                  {[
                    ['manufacturingDate', 'Manufacturing Date', 'date'],
                    ['expiryDate', 'Expiry Date', 'date'],
                    ['batchSize', 'Batch Size', 'text'],
                    ['market', 'Market', 'text'],
                    ['manufacturingLine', 'Manufacturing Line', 'text'],
                    ['bmrNumber', 'BMR Number', 'text'],
                    ['recordedBy', 'Recorded By', 'text'],
                  ].map(([name, label, type]) => (
                    <FormField key={name} control={form.control} name={name as keyof BatchInput} render={({ field }) => (
                      <FormItem><FormLabel>{label}</FormLabel><FormControl><Input {...field} type={type} value={String(field.value ?? '')} /></FormControl></FormItem>
                    )} />
                  ))}
                  <FormField control={form.control} name="shift" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Shift</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{SHIFTS.map((s) => <SelectItem key={s} value={s}>Shift {s}</SelectItem>)}</SelectContent>
                      </Select>
                    </FormItem>
                  )} />
                  <div className="sm:col-span-2 flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                    <Button type="submit">Register</Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        )}
      />
      <div className="grid gap-4 sm:grid-cols-4">
        <KpiCard label="Open" value={statusCounts.open} tone="blue" />
        <KpiCard label="Under Review" value={statusCounts.review} tone="amber" />
        <KpiCard label="Approved" value={statusCounts.approved} tone="green" />
        <KpiCard label="Rejected" value={statusCounts.rejected} tone="red" />
      </div>
      <Card>
        <CardContent className="p-0">
          {loading ? <DataState loading empty={false} /> : (
            <Table>
              <TableHeader>
                <TableRow>
                  {['Batch No', 'Product', 'Mfg Date', 'Expiry', 'Batch Size', 'Shift', 'Line', 'Status', 'Actions'].map((h) => (
                    <TableHead key={h}>{h}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {batches.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-mono font-medium">{b.batchNumber}</TableCell>
                    <TableCell>{b.productName}</TableCell>
                    <TableCell>{b.manufacturingDate}</TableCell>
                    <TableCell>{b.expiryDate}</TableCell>
                    <TableCell>{b.batchSize}</TableCell>
                    <TableCell>{b.shift}</TableCell>
                    <TableCell>{b.manufacturingLine || '—'}</TableCell>
                    <TableCell><StatusBadge status={b.status} /></TableCell>
                    <TableCell className="flex gap-1">
                      {canReview && b.status === 'Open' && (
                        <Button size="sm" variant="outline" onClick={async () => {
                          await updateBatchStatus(b.id!, 'Under Review', actor);
                          await load();
                        }}>Submit Review</Button>
                      )}
                      {canReview && b.status === 'Under Review' && (
                        <>
                          <Button size="sm" variant="outline" className="text-emerald-700" onClick={async () => {
                            await updateBatchStatus(b.id!, 'Approved', actor);
                            await load();
                          }}><CheckCircle className="h-3 w-3 mr-1" />Approve</Button>
                          <Button size="sm" variant="outline" className="text-red-700" onClick={async () => {
                            await updateBatchStatus(b.id!, 'Rejected', actor);
                            await load();
                          }}><XCircle className="h-3 w-3 mr-1" />Reject</Button>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function AlertsWorkspace() {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState<Awaited<ReturnType<typeof listAlerts>>>([]);
  const [filter, setFilter] = useState('Open');
  const actor = { id: user?.uid, name: profile?.full_name, role: profile?.role };

  const load = async () => {
    setLoading(true);
    setAlerts(await listAlerts());
    setLoading(false);
  };
  useEffect(() => { void load(); }, []);

  const filtered = alerts.filter((a) => filter === 'all' || a.status === filter);
  const openCount = alerts.filter((a) => a.status === 'Open').length;
  const criticalCount = alerts.filter((a) => a.severity === 'Critical' && a.status === 'Open').length;

  return (
    <div className="space-y-6">
      <PageHeading title="Alert Engine" description="Automated CPV alerts for limit excursions, low Cpk, OOT, and high-risk conditions." />
      <div className="grid gap-4 sm:grid-cols-4">
        <KpiCard label="Open Alerts" value={openCount} tone={openCount > 0 ? 'red' : 'green'} />
        <KpiCard label="Critical" value={criticalCount} tone="red" />
        <KpiCard label="Acknowledged" value={alerts.filter((a) => a.status === 'Acknowledged').length} tone="amber" />
        <KpiCard label="Closed" value={alerts.filter((a) => a.status === 'Closed').length} tone="green" />
      </div>
      <Select value={filter} onValueChange={setFilter}>
        <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All</SelectItem>
          <SelectItem value="Open">Open</SelectItem>
          <SelectItem value="Acknowledged">Acknowledged</SelectItem>
          <SelectItem value="Closed">Closed</SelectItem>
        </SelectContent>
      </Select>
      <Card>
        <CardContent className="p-0">
          {loading ? <DataState loading empty={false} /> : filtered.length === 0 ? (
            <DataState loading={false} empty emptyText="No alerts — process is in control." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  {['Type', 'Severity', 'Module', 'Product', 'Batch', 'Parameter', 'Message', 'Status', 'Actions'].map((h) => (
                    <TableHead key={h}>{h}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell><Badge variant="outline">{a.alertType}</Badge></TableCell>
                    <TableCell><StatusBadge status={a.severity} /></TableCell>
                    <TableCell>{a.module}</TableCell>
                    <TableCell>{a.productName}</TableCell>
                    <TableCell>{a.batchNo}</TableCell>
                    <TableCell>{a.parameterName}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{a.message}</TableCell>
                    <TableCell><StatusBadge status={a.status} /></TableCell>
                    <TableCell className="flex gap-1">
                      {a.status === 'Open' && (
                        <Button size="sm" variant="outline" onClick={async () => { await acknowledgeAlert(a.id, actor); await load(); }}>Ack</Button>
                      )}
                      {a.status !== 'Closed' && (
                        <Button size="sm" variant="outline" onClick={async () => { await closeAlert(a.id, actor); await load(); }}>Close</Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function ReportsWorkspace() {
  const { loading, cpp, cqa, risks, modules } = useCpvData(true);
  const [product, setProduct] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const allRecords = useMemo(() => [
    ...cpp.map((r) => ({ ...r, _module: 'CPP', _date: r.manufacturingDate })),
    ...cqa.map((r) => ({ ...r, _module: 'CQA', _date: r.testDate })),
    ...risks.map((r) => ({ ...r, _module: 'Risk', _date: r.createdAt })),
  ] as Record<string, unknown>[], [cpp, cqa, risks]);

  const filtered = allRecords.filter((r) => {
    if (product !== 'all' && String(r.productName) !== product) return false;
    const d = String(r._date || '');
    if (dateFrom && d < dateFrom) return false;
    if (dateTo && d > dateTo) return false;
    return true;
  });

  const products = useMemo(() => {
    const set = new Set(allRecords.map((r) => String(r.productName || '')).filter(Boolean));
    return Array.from(set).sort();
  }, [allRecords]);

  const exportReport = (format: 'csv' | 'pdf') => {
    if (!filtered.length) return toast.error('No data for selected filters');
    if (format === 'pdf') {
      printPage();
      return;
    }
    downloadCsv('CPV_Report.csv', ['Module', 'Product', 'Batch', 'Parameter', 'Status', 'Date'],
      filtered.map((r) => [
        String(r._module),
        String(r.productName || ''),
        String(r.batchNo || ''),
        String(r.parameterName || r.testParameter || r.factor || ''),
        String(r.status || r.riskLevel || ''),
        String(r._date || ''),
      ]),
    );
    toast.success('Report exported');
  };

  return (
    <div className="space-y-6">
      <PageHeading
        title="Reports & Analytics"
        description="Unified CPV reporting — filter by product, batch, date, and parameter. Export to Excel or PDF."
        actions={
          <>
            <Button variant="outline" className="gap-2" onClick={() => exportReport('pdf')}><Printer className="h-4 w-4" />PDF</Button>
            <Button variant="outline" className="gap-2" onClick={() => exportReport('csv')}><FileSpreadsheet className="h-4 w-4" />Excel</Button>
          </>
        }
      />
      <div className="flex flex-wrap gap-3">
        <Select value={product} onValueChange={setProduct}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Product" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Products</SelectItem>
            {products.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-[160px]" placeholder="From" />
        <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-[160px]" placeholder="To" />
      </div>
      <div className="grid gap-4 sm:grid-cols-4">
        <KpiCard label="CPP Records" value={cpp.length} tone="blue" />
        <KpiCard label="CQA Records" value={cqa.length} tone="green" />
        <KpiCard label="Risk Items" value={risks.length} tone="amber" />
        <KpiCard label="Filtered Results" value={filtered.length} tone="blue" />
      </div>
      <Tabs defaultValue="summary">
        <TabsList>
          <TabsTrigger value="summary">Summary</TabsTrigger>
          <TabsTrigger value="detail">Detail Register</TabsTrigger>
        </TabsList>
        <TabsContent value="summary" className="mt-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ['Batches', modules?.batches?.length || 0],
              ['Raw Materials', modules?.rawMaterials?.length || 0],
              ['Packing Materials', modules?.packingMaterials?.length || 0],
              ['Utilities', modules?.utilityMonitoring?.length || 0],
              ['Environmental', modules?.environment?.length || 0],
              ['Yield', modules?.yieldMonitoring?.length || 0],
              ['Stability', modules?.stability?.length || 0],
              ['Hold Time', modules?.holdTime?.length || 0],
              ['Open Alerts', modules?.alerts?.filter((a) => a.status === 'Open').length || 0],
            ].map(([label, value]) => (
              <KpiCard key={String(label)} label={String(label)} value={Number(value)} tone="blue" />
            ))}
          </div>
        </TabsContent>
        <TabsContent value="detail" className="mt-4">
          <Card>
            <CardContent className="p-0">
              {loading ? <DataState loading empty={false} /> : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      {['Module', 'Product', 'Batch', 'Parameter', 'Status', 'Date'].map((h) => (
                        <TableHead key={h}>{h}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.slice(0, 100).map((r, i) => (
                      <TableRow key={i}>
                        <TableCell>{String(r._module)}</TableCell>
                        <TableCell>{String(r.productName || '')}</TableCell>
                        <TableCell>{String(r.batchNo || '')}</TableCell>
                        <TableCell>{String(r.parameterName || r.testParameter || r.factor || '')}</TableCell>
                        <TableCell><StatusBadge status={String(r.status || r.riskLevel || '')} /></TableCell>
                        <TableCell>{String(r._date || '').slice(0, 10)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
