'use client';

import { useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, FieldValues, DefaultValues } from 'react-hook-form';
import { z } from 'zod';
import { Database, Download, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/auth-context';
import { cpvPermissions } from '@/lib/cpv';
import {
  CONFIG_TABS, CPV_CONFIG_COLLECTIONS, MODULE_OPTIONS, REVIEW_OPTIONS, SAMPLING_OPTIONS,
  alertThresholdSchema, approvalWorkflowSchema, controlLimitMasterSchema, cppMasterSchema,
  cqaMasterSchema, limitMasterSchema, productMasterSchema, reviewFrequencySchema,
  samplingFrequencySchema, targetMasterSchema, type ConfigTabId,
} from '@/lib/cpv-config';
import {
  createConfigRecord, removeConfigRecord, seedDefaultCpvConfig, updateConfigRecord,
} from '@/lib/cpv-config-service';
import { useCpvConfig } from '@/hooks/use-cpv-config';
import { downloadCsv, printPage } from '@/lib/export-utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { DataState, KpiCard, PageHeading } from '@/components/cpv/cpv-ui';

type FieldType = 'text' | 'number' | 'select' | 'switch' | 'date';

interface FieldDef {
  name: string;
  label: string;
  type?: FieldType;
  options?: readonly string[] | Array<{ label: string; value: string }>;
  step?: string;
}

interface TabConfig<T extends FieldValues> {
  id: ConfigTabId;
  collection: string;
  schema: z.ZodType<T>;
  defaultValues: DefaultValues<T>;
  fields: FieldDef[];
  columns: Array<{ key: keyof T & string; label: string }>;
}

const STATUS_OPTIONS = ['Active', 'Inactive'] as const;
const PARAM_TYPE_OPTIONS = ['CPP', 'CQA'] as const;
const CQA_TYPE_OPTIONS = ['numeric', 'qualitative', 'limit'] as const;
const CHART_TYPE_OPTIONS = ['I-MR', 'X-Bar-R', 'Both'] as const;

const TAB_CONFIGS: TabConfig<FieldValues>[] = [
  {
    id: 'products',
    collection: CPV_CONFIG_COLLECTIONS.products,
    schema: productMasterSchema,
    defaultValues: {
      productCode: '', productName: '', genericName: '', strength: '', dosageForm: '',
      packSize: '', market: '', shelfLife: '', bmrNumber: '', bprNumber: '', status: 'Active',
    },
    fields: [
      { name: 'productCode', label: 'Product Code' },
      { name: 'productName', label: 'Product Name' },
      { name: 'genericName', label: 'Generic Name' },
      { name: 'strength', label: 'Strength' },
      { name: 'dosageForm', label: 'Dosage Form' },
      { name: 'packSize', label: 'Pack Size' },
      { name: 'market', label: 'Market' },
      { name: 'shelfLife', label: 'Shelf Life' },
      { name: 'bmrNumber', label: 'BMR Number' },
      { name: 'bprNumber', label: 'BPR Number' },
      { name: 'status', label: 'Status', type: 'select', options: STATUS_OPTIONS },
    ],
    columns: [
      { key: 'productCode', label: 'Code' },
      { key: 'productName', label: 'Product' },
      { key: 'strength', label: 'Strength' },
      { key: 'dosageForm', label: 'Form' },
      { key: 'packSize', label: 'Pack Size' },
      { key: 'market', label: 'Market' },
      { key: 'status', label: 'Status' },
    ],
  },
  {
    id: 'cpp',
    collection: CPV_CONFIG_COLLECTIONS.cppMaster,
    schema: cppMasterSchema,
    defaultValues: {
      productName: 'All Products', parameterName: '', processStage: 'Manufacturing',
      target: 0, lsl: 0, usl: 0, unit: '', samplingFrequency: 'Per Batch', status: 'Active',
    },
    fields: [
      { name: 'productName', label: 'Product Name' },
      { name: 'parameterName', label: 'Parameter Name' },
      { name: 'processStage', label: 'Process Stage' },
      { name: 'target', label: 'Target', type: 'number', step: 'any' },
      { name: 'lsl', label: 'LSL', type: 'number', step: 'any' },
      { name: 'usl', label: 'USL', type: 'number', step: 'any' },
      { name: 'unit', label: 'Unit' },
      { name: 'samplingFrequency', label: 'Sampling Frequency', type: 'select', options: SAMPLING_OPTIONS },
      { name: 'status', label: 'Status', type: 'select', options: STATUS_OPTIONS },
    ],
    columns: [
      { key: 'productName', label: 'Product' },
      { key: 'parameterName', label: 'Parameter' },
      { key: 'target', label: 'Target' },
      { key: 'lsl', label: 'LSL' },
      { key: 'usl', label: 'USL' },
      { key: 'unit', label: 'Unit' },
      { key: 'status', label: 'Status' },
    ],
  },
  {
    id: 'cqa',
    collection: CPV_CONFIG_COLLECTIONS.cqaMaster,
    schema: cqaMasterSchema,
    defaultValues: {
      productName: 'All Products', testParameter: '', target: 0, lsl: 0, usl: 0,
      unit: '', parameterType: 'numeric', samplingFrequency: 'Per Batch', status: 'Active',
    },
    fields: [
      { name: 'productName', label: 'Product Name' },
      { name: 'testParameter', label: 'Test Parameter' },
      { name: 'target', label: 'Target', type: 'number', step: 'any' },
      { name: 'lsl', label: 'LSL', type: 'number', step: 'any' },
      { name: 'usl', label: 'USL', type: 'number', step: 'any' },
      { name: 'unit', label: 'Unit' },
      { name: 'parameterType', label: 'Parameter Type', type: 'select', options: CQA_TYPE_OPTIONS },
      { name: 'samplingFrequency', label: 'Sampling Frequency', type: 'select', options: SAMPLING_OPTIONS },
      { name: 'status', label: 'Status', type: 'select', options: STATUS_OPTIONS },
    ],
    columns: [
      { key: 'productName', label: 'Product' },
      { key: 'testParameter', label: 'Parameter' },
      { key: 'target', label: 'Target' },
      { key: 'lsl', label: 'LSL' },
      { key: 'usl', label: 'USL' },
      { key: 'unit', label: 'Unit' },
      { key: 'status', label: 'Status' },
    ],
  },
  {
    id: 'limits',
    collection: CPV_CONFIG_COLLECTIONS.limits,
    schema: limitMasterSchema,
    defaultValues: {
      productName: 'All Products', parameterName: '', parameterType: 'CPP',
      lsl: 0, usl: 0, unit: '', effectiveDate: '', status: 'Active',
    },
    fields: [
      { name: 'productName', label: 'Product Name' },
      { name: 'parameterName', label: 'Parameter Name' },
      { name: 'parameterType', label: 'Type', type: 'select', options: PARAM_TYPE_OPTIONS },
      { name: 'lsl', label: 'LSL', type: 'number', step: 'any' },
      { name: 'usl', label: 'USL', type: 'number', step: 'any' },
      { name: 'unit', label: 'Unit' },
      { name: 'effectiveDate', label: 'Effective Date', type: 'date' },
      { name: 'status', label: 'Status', type: 'select', options: STATUS_OPTIONS },
    ],
    columns: [
      { key: 'productName', label: 'Product' },
      { key: 'parameterName', label: 'Parameter' },
      { key: 'parameterType', label: 'Type' },
      { key: 'lsl', label: 'LSL' },
      { key: 'usl', label: 'USL' },
      { key: 'status', label: 'Status' },
    ],
  },
  {
    id: 'control',
    collection: CPV_CONFIG_COLLECTIONS.controlLimits,
    schema: controlLimitMasterSchema,
    defaultValues: {
      productName: 'All Products', parameterName: '', centerLine: 0, ucl: 0, lcl: 0,
      chartType: 'I-MR', subgroupSize: 4, status: 'Active',
    },
    fields: [
      { name: 'productName', label: 'Product Name' },
      { name: 'parameterName', label: 'Parameter Name' },
      { name: 'centerLine', label: 'Center Line (CL)', type: 'number', step: 'any' },
      { name: 'ucl', label: 'UCL', type: 'number', step: 'any' },
      { name: 'lcl', label: 'LCL', type: 'number', step: 'any' },
      { name: 'chartType', label: 'Chart Type', type: 'select', options: CHART_TYPE_OPTIONS },
      { name: 'subgroupSize', label: 'Subgroup Size', type: 'number' },
      { name: 'status', label: 'Status', type: 'select', options: STATUS_OPTIONS },
    ],
    columns: [
      { key: 'productName', label: 'Product' },
      { key: 'parameterName', label: 'Parameter' },
      { key: 'centerLine', label: 'CL' },
      { key: 'ucl', label: 'UCL' },
      { key: 'lcl', label: 'LCL' },
      { key: 'chartType', label: 'Chart' },
      { key: 'status', label: 'Status' },
    ],
  },
  {
    id: 'targets',
    collection: CPV_CONFIG_COLLECTIONS.targets,
    schema: targetMasterSchema,
    defaultValues: {
      productName: 'All Products', parameterName: '', parameterType: 'CPP',
      target: 0, unit: '', effectiveDate: '', status: 'Active',
    },
    fields: [
      { name: 'productName', label: 'Product Name' },
      { name: 'parameterName', label: 'Parameter Name' },
      { name: 'parameterType', label: 'Type', type: 'select', options: PARAM_TYPE_OPTIONS },
      { name: 'target', label: 'Target', type: 'number', step: 'any' },
      { name: 'unit', label: 'Unit' },
      { name: 'effectiveDate', label: 'Effective Date', type: 'date' },
      { name: 'status', label: 'Status', type: 'select', options: STATUS_OPTIONS },
    ],
    columns: [
      { key: 'productName', label: 'Product' },
      { key: 'parameterName', label: 'Parameter' },
      { key: 'parameterType', label: 'Type' },
      { key: 'target', label: 'Target' },
      { key: 'unit', label: 'Unit' },
      { key: 'status', label: 'Status' },
    ],
  },
  {
    id: 'sampling',
    collection: CPV_CONFIG_COLLECTIONS.sampling,
    schema: samplingFrequencySchema,
    defaultValues: {
      productName: 'All Products', parameterName: '', module: 'CPP',
      frequency: 'Per Batch', sampleSize: 1, status: 'Active',
    },
    fields: [
      { name: 'productName', label: 'Product Name' },
      { name: 'parameterName', label: 'Parameter Name' },
      { name: 'module', label: 'Module', type: 'select', options: PARAM_TYPE_OPTIONS },
      { name: 'frequency', label: 'Frequency', type: 'select', options: SAMPLING_OPTIONS },
      { name: 'sampleSize', label: 'Sample Size', type: 'number' },
      { name: 'status', label: 'Status', type: 'select', options: STATUS_OPTIONS },
    ],
    columns: [
      { key: 'productName', label: 'Product' },
      { key: 'parameterName', label: 'Parameter' },
      { key: 'module', label: 'Module' },
      { key: 'frequency', label: 'Frequency' },
      { key: 'sampleSize', label: 'N' },
      { key: 'status', label: 'Status' },
    ],
  },
  {
    id: 'alerts',
    collection: CPV_CONFIG_COLLECTIONS.alerts,
    schema: alertThresholdSchema,
    defaultValues: {
      productName: 'All Products', parameterName: '', module: 'CPP',
      ootWarningPercent: 10, cpkMinimum: 1.0, notifyRoles: 'qa,qc', status: 'Active',
    },
    fields: [
      { name: 'productName', label: 'Product Name' },
      { name: 'parameterName', label: 'Parameter Name' },
      { name: 'module', label: 'Module', type: 'select', options: PARAM_TYPE_OPTIONS },
      { name: 'ootWarningPercent', label: 'OOT Warning (%)', type: 'number', step: 'any' },
      { name: 'cpkMinimum', label: 'Minimum Cpk', type: 'number', step: 'any' },
      { name: 'notifyRoles', label: 'Notify Roles (comma-separated)' },
      { name: 'status', label: 'Status', type: 'select', options: STATUS_OPTIONS },
    ],
    columns: [
      { key: 'productName', label: 'Product' },
      { key: 'parameterName', label: 'Parameter' },
      { key: 'ootWarningPercent', label: 'OOT %' },
      { key: 'cpkMinimum', label: 'Min Cpk' },
      { key: 'notifyRoles', label: 'Notify' },
      { key: 'status', label: 'Status' },
    ],
  },
  {
    id: 'review',
    collection: CPV_CONFIG_COLLECTIONS.review,
    schema: reviewFrequencySchema,
    defaultValues: {
      module: 'CPV', productName: 'All Products', frequency: 'Annual',
      nextReviewDate: '', status: 'Active',
    },
    fields: [
      { name: 'module', label: 'Module', type: 'select', options: MODULE_OPTIONS },
      { name: 'productName', label: 'Product Name' },
      { name: 'frequency', label: 'Review Frequency', type: 'select', options: REVIEW_OPTIONS },
      { name: 'nextReviewDate', label: 'Next Review Date', type: 'date' },
      { name: 'status', label: 'Status', type: 'select', options: STATUS_OPTIONS },
    ],
    columns: [
      { key: 'module', label: 'Module' },
      { key: 'productName', label: 'Product' },
      { key: 'frequency', label: 'Frequency' },
      { key: 'nextReviewDate', label: 'Next Review' },
      { key: 'status', label: 'Status' },
    ],
  },
  {
    id: 'workflow',
    collection: CPV_CONFIG_COLLECTIONS.workflow,
    schema: approvalWorkflowSchema,
    defaultValues: {
      module: 'CPV', stepOrder: 1, designation: '', role: 'qa', eSignRequired: true, status: 'Active',
    },
    fields: [
      { name: 'module', label: 'Module', type: 'select', options: MODULE_OPTIONS },
      { name: 'stepOrder', label: 'Step Order', type: 'number' },
      { name: 'designation', label: 'Designation' },
      { name: 'role', label: 'Role' },
      { name: 'eSignRequired', label: 'E-Signature Required', type: 'switch' },
      { name: 'status', label: 'Status', type: 'select', options: STATUS_OPTIONS },
    ],
    columns: [
      { key: 'module', label: 'Module' },
      { key: 'stepOrder', label: 'Step' },
      { key: 'designation', label: 'Designation' },
      { key: 'role', label: 'Role' },
      { key: 'eSignRequired', label: 'E-Sign' },
      { key: 'status', label: 'Status' },
    ],
  },
];

function ConfigField({
  field,
  form,
  productOptions,
}: {
  field: FieldDef;
  form: ReturnType<typeof useForm<FieldValues>>;
  productOptions: string[];
}) {
  const type = field.type || 'text';

  if (field.name === 'productName') {
    return (
      <FormField control={form.control} name={field.name} render={({ field: f }) => (
        <FormItem>
          <FormLabel>{field.label}</FormLabel>
          <Select value={f.value || ''} onValueChange={f.onChange}>
            <FormControl><SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger></FormControl>
            <SelectContent>
              <SelectItem value="All Products">All Products</SelectItem>
              {productOptions.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
          <FormMessage />
        </FormItem>
      )} />
    );
  }

  if (type === 'select' && field.options) {
    return (
      <FormField control={form.control} name={field.name} render={({ field: f }) => (
        <FormItem>
          <FormLabel>{field.label}</FormLabel>
          <Select value={String(f.value ?? '')} onValueChange={f.onChange}>
            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
            <SelectContent>
              {field.options!.map((opt) => {
                const value = typeof opt === 'string' ? opt : opt.value;
                const label = typeof opt === 'string' ? opt : opt.label;
                return <SelectItem key={value} value={value}>{label}</SelectItem>;
              })}
            </SelectContent>
          </Select>
          <FormMessage />
        </FormItem>
      )} />
    );
  }

  if (type === 'switch') {
    return (
      <FormField control={form.control} name={field.name} render={({ field: f }) => (
        <FormItem className="flex items-center justify-between rounded-lg border p-3">
          <FormLabel>{field.label}</FormLabel>
          <FormControl>
            <Switch checked={Boolean(f.value)} onCheckedChange={f.onChange} />
          </FormControl>
        </FormItem>
      )} />
    );
  }

  return (
    <FormField control={form.control} name={field.name} render={({ field: f }) => (
      <FormItem>
        <FormLabel>{field.label}</FormLabel>
        <FormControl>
          <Input
            {...f}
            type={type === 'number' ? 'number' : type === 'date' ? 'date' : 'text'}
            step={field.step}
            value={f.value ?? ''}
            onChange={(e) => {
              if (type === 'number') f.onChange(e.target.value === '' ? '' : Number(e.target.value));
              else f.onChange(e.target.value);
            }}
          />
        </FormControl>
        <FormMessage />
      </FormItem>
    )} />
  );
}

function ConfigTabPanel({
  tabConfig,
  records,
  readOnly,
  productOptions,
  onRefresh,
  actor,
}: {
  tabConfig: TabConfig<FieldValues>;
  records: Array<FieldValues & { id?: string }>;
  readOnly: boolean;
  productOptions: string[];
  onRefresh: () => void;
  actor: { id?: string; name?: string; role?: string };
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editing, setEditing] = useState<(FieldValues & { id?: string }) | null>(null);

  const form = useForm<FieldValues>({
    resolver: zodResolver(tabConfig.schema),
    defaultValues: tabConfig.defaultValues,
  });

  const openCreate = () => {
    setEditing(null);
    form.reset(tabConfig.defaultValues);
    setDrawerOpen(true);
  };

  const openEdit = (record: FieldValues & { id?: string }) => {
    setEditing(record);
    form.reset(record);
    setDrawerOpen(true);
  };

  const onSubmit = form.handleSubmit(async (data) => {
    try {
      if (editing?.id) {
        await updateConfigRecord(tabConfig.collection, editing.id, data, actor);
        toast.success('Configuration updated');
      } else {
        await createConfigRecord(tabConfig.collection, data, actor);
        toast.success('Configuration saved');
      }
      setDrawerOpen(false);
      onRefresh();
    } catch {
      toast.error('Could not save configuration');
    }
  });

  const confirmDelete = async () => {
    if (!deleteId) return;
    try {
      await removeConfigRecord(tabConfig.collection, deleteId, actor);
      toast.success('Record deleted');
      setDeleteId(null);
      onRefresh();
    } catch {
      toast.error('Could not delete record');
    }
  };

  const exportCsv = () => {
    const headers = tabConfig.columns.map((c) => c.label);
    const rows = records.map((r) => tabConfig.columns.map((c) => String(r[c.key] ?? '')));
    downloadCsv(`${tabConfig.id}-config.csv`, headers, rows);
  };

  const tabMeta = CONFIG_TABS.find((t) => t.id === tabConfig.id);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>{tabMeta?.label}</CardTitle>
          <CardDescription>{tabMeta?.description}</CardDescription>
        </div>
        <div className="no-print flex shrink-0 gap-2">
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={!records.length}>
            <Download className="mr-1 h-4 w-4" />Export
          </Button>
          {!readOnly && (
            <Button size="sm" onClick={openCreate}>
              <Plus className="mr-1 h-4 w-4" />Add
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                {tabConfig.columns.map((col) => (
                  <TableHead key={col.key}>{col.label}</TableHead>
                ))}
                {!readOnly && <TableHead className="w-24">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={tabConfig.columns.length + (readOnly ? 0 : 1)} className="py-8 text-center text-muted-foreground">
                    No records configured. {readOnly ? '' : 'Click Add to create one or import defaults from the header.'}
                  </TableCell>
                </TableRow>
              ) : records.map((row) => (
                <TableRow key={row.id}>
                  {tabConfig.columns.map((col) => (
                    <TableCell key={col.key} className="max-w-[180px] truncate">
                      {col.key === 'status' ? (
                        <Badge variant={row[col.key] === 'Active' ? 'default' : 'secondary'}>{String(row[col.key] ?? '')}</Badge>
                      ) : col.key === 'eSignRequired' ? (
                        row[col.key] ? 'Yes' : 'No'
                      ) : String(row[col.key] ?? '')}
                    </TableCell>
                  ))}
                  {!readOnly && (
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(row)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteId(row.id || null)}><Trash2 className="h-4 w-4 text-red-600" /></Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent className="overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>{editing ? 'Edit' : 'Add'} {tabMeta?.label}</SheetTitle>
            <SheetDescription>Changes apply immediately to CPV monitoring modules.</SheetDescription>
          </SheetHeader>
          <Form {...form}>
            <form onSubmit={onSubmit} className="mt-6 space-y-4">
              {tabConfig.fields.map((f) => (
                <ConfigField key={f.name} field={f} form={form} productOptions={productOptions} />
              ))}
              <SheetFooter className="pt-4">
                <Button type="submit">Save</Button>
              </SheetFooter>
            </form>
          </Form>
        </SheetContent>
      </Sheet>

      <AlertDialog open={Boolean(deleteId)} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete configuration?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone. Monitoring modules will fall back to defaults for this entry.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

export function ConfigWorkspace() {
  const { user, profile } = useAuth();
  const { config, loading, reload } = useCpvConfig();
  const [activeTab, setActiveTab] = useState<ConfigTabId>('products');
  const [seeding, setSeeding] = useState(false);

  const role = profile?.role;
  const canEdit = cpvPermissions.canConfigure(role);
  const readOnly = cpvPermissions.isReadOnly(role) || !canEdit;

  const actor = useMemo(() => ({
    id: user?.uid,
    name: profile?.full_name || profile?.email || 'User',
    role,
  }), [user?.uid, profile?.full_name, profile?.email, role]);

  const productOptions = useMemo(() => {
    const fromMaster = config.products.filter((p) => p.status === 'Active').map((p) => p.productName);
    return Array.from(new Set(fromMaster));
  }, [config.products]);

  const recordMap = useMemo(() => ({
    products: config.products,
    cpp: config.cppMaster,
    cqa: config.cqaMaster,
    limits: config.limits,
    control: config.controlLimits,
    targets: config.targets,
    sampling: config.sampling,
    alerts: config.alerts,
    review: config.review,
    workflow: config.workflow,
  }), [config]);

  const totalRecords = Object.values(recordMap).reduce((sum, arr) => sum + arr.length, 0);
  const activeMasters = Object.values(recordMap).filter((arr) => arr.some((r) => r.status === 'Active')).length;

  const handleSeed = async () => {
    setSeeding(true);
    try {
      const { created } = await seedDefaultCpvConfig(actor);
      if (created === 0) {
        toast.info('Defaults already imported or CPP/CQA master is not empty');
      } else {
        toast.success(`Imported ${created} default configuration records`);
      }
      await reload();
    } catch {
      toast.error('Could not import defaults');
    } finally {
      setSeeding(false);
    }
  };

  if (!cpvPermissions.canView(role)) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            You do not have permission to view CPV configuration.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <PageHeading
        title="CPV Configuration"
        description="Configure Product, CPP, CQA, limits, control limits, targets, sampling, alerts, review cycles, and approval workflows without code changes."
        actions={(
          <>
            <Button variant="outline" onClick={() => printPage()}>Print</Button>
            {!readOnly && (
              <Button variant="outline" onClick={handleSeed} disabled={seeding}>
                <Database className="mr-1 h-4 w-4" />
                {seeding ? 'Importing…' : 'Import Defaults'}
              </Button>
            )}
          </>
        )}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Total Records" value={totalRecords} detail="Across all masters" />
        <KpiCard label="Active Masters" value={`${activeMasters}/10`} tone="green" detail="Tabs with active config" />
        <KpiCard label="Products" value={config.products.filter((p) => p.status === 'Active').length} tone="blue" />
        <KpiCard label="Workflow Steps" value={config.workflow.filter((w) => w.status === 'Active').length} tone="amber" />
      </div>

      {readOnly && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="py-3 text-sm text-amber-900">
            View-only mode — contact QA Admin to modify CPV configuration.
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ConfigTabId)}>
        <TabsList className="no-print flex h-auto flex-wrap justify-start gap-1">
          {CONFIG_TABS.map((tab) => (
            <TabsTrigger key={tab.id} value={tab.id} className="text-xs sm:text-sm">
              {tab.label}
              <Badge variant="secondary" className="ml-2 hidden sm:inline-flex">
                {recordMap[tab.id].length}
              </Badge>
            </TabsTrigger>
          ))}
        </TabsList>

        {TAB_CONFIGS.map((tabConfig) => (
          <TabsContent key={tabConfig.id} value={tabConfig.id} className="mt-4">
            {loading ? (
              <DataState loading empty={false} emptyText="Loading configuration…" />
            ) : (
              <ConfigTabPanel
                tabConfig={tabConfig}
                records={recordMap[tabConfig.id]}
                readOnly={readOnly}
                productOptions={productOptions}
                onRefresh={reload}
                actor={actor}
              />
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
