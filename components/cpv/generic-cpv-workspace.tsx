'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, FieldValues, DefaultValues } from 'react-hook-form';
import { z } from 'zod';
import {
  CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer,
  Tooltip, XAxis, YAxis, BarChart, Bar, Cell,
} from 'recharts';
import { FileSpreadsheet, Loader2, Plus, Printer, Search } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/auth-context';
import { cpvPermissions } from '@/lib/cpv';
import { buildTrendPoints } from '@/lib/cpv-modules';
import { listModuleRecords } from '@/lib/cpv-module-service';
import { usePaginatedTable } from '@/hooks/use-paginated-table';
import { downloadCsv, printPage } from '@/lib/export-utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DataState, KpiCard, PageHeading, StatusBadge } from '@/components/cpv/cpv-ui';
import { TableSkeleton } from '@/components/ui/table-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { PaginatedTableFooter } from '@/components/ui/paginated-table-footer';
import { ChartContainer } from '@/components/ui/chart-container';

const colors = { blue: '#2563eb', green: '#059669', amber: '#d97706', red: '#dc2626' };

type FieldType = 'text' | 'number' | 'select' | 'date';

export interface ModuleFieldDef {
  name: string;
  label: string;
  type?: FieldType;
  options?: readonly string[];
  step?: string;
  readOnly?: boolean;
}

export interface ModuleColumnDef {
  key: string;
  label: string;
  render?: (value: unknown, row: Record<string, unknown>) => React.ReactNode;
}

export interface CpvModuleConfig<T extends FieldValues> {
  title: string;
  description: string;
  collection: string;
  schema: z.ZodType<T>;
  defaultValues: DefaultValues<T>;
  fields: ModuleFieldDef[];
  columns: ModuleColumnDef[];
  permission?: (role?: string) => boolean;
  trendValueKey?: string;
  trendLabelKey?: string;
  trendLimits?: { lower: number; upper: number };
  kpis?: (records: Record<string, unknown>[]) => Array<{ label: string; value: string | number; detail?: string; tone?: 'blue' | 'green' | 'amber' | 'red' }>;
  onSubmit: (values: T, actor: { id?: string; name?: string; role?: string }, records: Record<string, unknown>[]) => Promise<void>;
  statusKey?: string;
  extraTabs?: Array<{ id: string; label: string; render: (records: Record<string, unknown>[]) => React.ReactNode }>;
}

function FormFieldInput({ form, field }: { form: ReturnType<typeof useForm<FieldValues>>; field: ModuleFieldDef }) {
  return (
    <FormField control={form.control} name={field.name} render={({ field: f }) => (
      <FormItem>
        <FormLabel>{field.label}</FormLabel>
        <FormControl>
          {field.type === 'select' && field.options ? (
            <Select value={String(f.value ?? '')} onValueChange={f.onChange}>
              <SelectTrigger><SelectValue placeholder={`Select ${field.label}`} /></SelectTrigger>
              <SelectContent>
                {field.options.map((opt) => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
              </SelectContent>
            </Select>
          ) : (
            <Input
              {...f}
              type={field.type || 'text'}
              readOnly={field.readOnly}
              step={field.type === 'number' ? field.step || 'any' : undefined}
              value={f.value ?? ''}
            />
          )}
        </FormControl>
        <FormMessage />
      </FormItem>
    )} />
  );
}

function TrendChart({ title, data, limits }: {
  title: string;
  data: Array<{ label: string; value: number }>;
  limits?: { lower: number; upper: number };
}) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">{title}</CardTitle></CardHeader>
      <CardContent className="p-0">
        <ChartContainer height={320} empty={!data.length} emptyText="Record data to generate trend charts.">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis domain={['auto', 'auto']} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="value" name="Observed" stroke={colors.blue} strokeWidth={2} dot={{ r: 3 }} />
              {limits && (
                <>
                  <ReferenceLine y={limits.lower} stroke={colors.red} strokeDasharray="5 5" label="LSL" />
                  <ReferenceLine y={limits.upper} stroke={colors.red} strokeDasharray="5 5" label="USL" />
                </>
              )}
            </LineChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

export function GenericCpvWorkspace<T extends FieldValues>({ config }: { config: CpvModuleConfig<T> }) {
  const { user, profile } = useAuth();
  const canEdit = config.permission ? config.permission(profile?.role) : cpvPermissions.canView(profile?.role);
  const isReadOnly = cpvPermissions.isReadOnly(profile?.role);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [records, setRecords] = useState<Record<string, unknown>[]>([]);
  const [open, setOpen] = useState(false);
  const [productFilter, setProductFilter] = useState('all');
  const actor = { id: user?.uid, name: profile?.full_name, role: profile?.role };

  const form = useForm<T>({
    resolver: zodResolver(config.schema),
    defaultValues: config.defaultValues,
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listModuleRecords<Record<string, unknown>>(config.collection, 300);
      setRecords(data);
    } catch {
      setError('Unable to load records. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, [config.collection]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (profile?.full_name && config.defaultValues && 'recordedBy' in (config.defaultValues as object)) {
      form.setValue('recordedBy' as never, profile.full_name as never);
    }
  }, [profile?.full_name, form, config.defaultValues]);

  const filtered = useMemo(() => {
    if (productFilter === 'all') return records;
    return records.filter((r) =>
      String(r.productName || r.product_name || r.area || '') === productFilter
      || String(r.utilityType || '') === productFilter,
    );
  }, [records, productFilter]);

  const searchKeys = useMemo(
    () => config.columns.map((c) => c.key).filter((k) => k !== 'id') as Array<keyof Record<string, unknown> & string>,
    [config.columns],
  );

  const table = usePaginatedTable({
    data: filtered,
    searchKeys,
    initialPageSize: 15,
    initialSortKey: config.columns[0]?.key,
  });

  const products = useMemo(() => {
    const set = new Set<string>();
    records.forEach((r) => {
      const p = String(r.productName || r.product_name || r.area || r.utilityType || '');
      if (p) set.add(p);
    });
    return Array.from(set).sort();
  }, [records]);

  const kpis = useMemo(() => config.kpis?.(filtered) ?? [
    { label: 'Total Records', value: filtered.length, tone: 'blue' as const },
    { label: 'Products / Areas', value: products.length, tone: 'green' as const },
  ], [filtered, products, config]);

  const trendData = useMemo(() => {
    if (!config.trendValueKey) return [];
    return buildTrendPoints(filtered, config.trendValueKey, (config.trendLabelKey || 'batchNo') as keyof Record<string, unknown>);
  }, [filtered, config.trendValueKey, config.trendLabelKey]);

  const vendorTrend = useMemo(() => {
    const vendorMap = new Map<string, number>();
    filtered.forEach((r) => {
      const vendor = String(r.vendor || '');
      const score = Number(r.vendorScore || 0);
      if (vendor) vendorMap.set(vendor, score);
    });
    return Array.from(vendorMap.entries()).map(([label, value]) => ({ label, value }));
  }, [filtered]);

  const handleSubmit = form.handleSubmit(async (values) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await config.onSubmit(values, actor, records);
      toast.success(`${config.title} record saved successfully`);
      setOpen(false);
      form.reset({ ...config.defaultValues, recordedBy: profile?.full_name || '' } as DefaultValues<T>);
      await load();
    } catch {
      toast.error(`Could not save ${config.title} record`);
    } finally {
      setSubmitting(false);
    }
  });

  const lastUpdated = useMemo(() => {
    const ts = records.map((r) => String(r.updatedAt || r.createdAt || '')).filter(Boolean).sort().reverse()[0];
    return ts ? new Date(ts).toLocaleString() : null;
  }, [records]);

  const exportExcel = () => {
    if (!filtered.length) return toast.error('No data to export');
    const headers = config.columns.map((c) => c.label);
    const keys = config.columns.map((c) => c.key);
    downloadCsv(`${config.title.replace(/\s+/g, '_')}.csv`, headers, filtered.map((r) =>
      keys.map((k) => String(r[k] ?? '')),
    ));
    toast.success('Export downloaded');
  };

  return (
    <div className="space-y-6">
      <PageHeading
        title={config.title}
        description={config.description}
        actions={
          <>
            <Button variant="outline" className="gap-2" onClick={() => printPage()}><Printer className="h-4 w-4" />PDF</Button>
            <Button variant="outline" className="gap-2" onClick={exportExcel}><FileSpreadsheet className="h-4 w-4" />Excel</Button>
            {canEdit && !isReadOnly && (
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2"><Plus className="h-4 w-4" />New Record</Button>
                </DialogTrigger>
                <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
                  <DialogHeader><DialogTitle>Record {config.title}</DialogTitle></DialogHeader>
                  <Form {...form}>
                    <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
                      {config.fields.map((field) => (
                        <FormFieldInput key={field.name} form={form as ReturnType<typeof useForm<FieldValues>>} field={field} />
                      ))}
                      <div className="sm:col-span-2 flex justify-end gap-2">
                        <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={submitting}>Cancel</Button>
                        <Button type="submit" disabled={submitting}>
                          {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : 'Save Record'}
                        </Button>
                      </div>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            )}
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <Select value={productFilter} onValueChange={setProductFilter}>
          <SelectTrigger className="w-[220px]"><SelectValue placeholder="Filter" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Products / Areas</SelectItem>
            {products.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="relative min-w-[200px] flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search records..."
            className="pl-8"
            value={table.search}
            onChange={(e) => table.setSearch(e.target.value)}
          />
        </div>
        {lastUpdated && (
          <p className="ml-auto text-xs text-muted-foreground">Last updated: {lastUpdated}</p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => <KpiCard key={kpi.label} {...kpi} />)}
      </div>

      <Tabs defaultValue="register">
        <TabsList className="flex h-auto flex-wrap gap-1">
          <TabsTrigger value="register">Register</TabsTrigger>
          {config.trendValueKey && <TabsTrigger value="trends">Trend Analysis</TabsTrigger>}
          {vendorTrend.length > 0 && <TabsTrigger value="vendor">Vendor Performance</TabsTrigger>}
          {config.extraTabs?.map((tab) => <TabsTrigger key={tab.id} value={tab.id}>{tab.label}</TabsTrigger>)}
        </TabsList>

        <TabsContent value="register" className="mt-4">
          <Card>
            <CardContent className="p-0">
              {loading ? (
                <TableSkeleton rows={8} cols={config.columns.length + (config.statusKey ? 1 : 0)} />
              ) : error ? (
                <ErrorState message={error} onRetry={() => void load()} />
              ) : table.filtered.length === 0 ? (
                <DataState loading={false} empty />
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {config.columns.map((col) => (
                            <TableHead
                              key={col.key}
                              className="cursor-pointer whitespace-nowrap select-none"
                              onClick={() => table.toggleSort(col.key)}
                            >
                              {col.label}{table.sortKey === col.key ? (table.sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
                            </TableHead>
                          ))}
                          {config.statusKey && <TableHead>Status</TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {table.pageRows.map((row) => (
                          <TableRow key={String(row.id)}>
                            {config.columns.map((col) => (
                              <TableCell key={col.key} className="whitespace-nowrap">
                                {col.render ? col.render(row[col.key], row) : String(row[col.key] ?? '—')}
                              </TableCell>
                            ))}
                            {config.statusKey && (
                              <TableCell>
                                <StatusBadge status={String(row[config.statusKey] || 'Complies')} />
                              </TableCell>
                            )}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <PaginatedTableFooter
                    page={table.page}
                    totalPages={table.totalPages}
                    total={table.total}
                    from={table.from}
                    to={table.to}
                    pageSize={table.pageSize}
                    onPageChange={table.setPage}
                    onPageSizeChange={(size) => { table.setPageSize(size); table.setPage(1); }}
                  />
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {config.trendValueKey && (
          <TabsContent value="trends" className="mt-4 space-y-4">
            <TrendChart title={`${config.title} Trend`} data={trendData} limits={config.trendLimits} />
            {trendData.length > 0 && (
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Statistics</CardTitle></CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-4">
                  {(() => {
                    const vals = trendData.map((d) => d.value);
                    const mean = vals.reduce((a, b) => a + b, 0) / (vals.length || 1);
                    const sd = Math.sqrt(vals.reduce((s, v) => s + (v - mean) ** 2, 0) / (vals.length || 1));
                    return (
                      <>
                        <KpiCard label="Mean" value={mean.toFixed(2)} tone="blue" />
                        <KpiCard label="Min" value={Math.min(...vals).toFixed(2)} tone="green" />
                        <KpiCard label="Max" value={Math.max(...vals).toFixed(2)} tone="amber" />
                        <KpiCard label="SD" value={sd.toFixed(3)} tone="blue" />
                      </>
                    );
                  })()}
                </CardContent>
              </Card>
            )}
          </TabsContent>
        )}

        {vendorTrend.length > 0 && (
          <TabsContent value="vendor" className="mt-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Vendor Performance Score</CardTitle></CardHeader>
              <CardContent className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={vendorTrend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis domain={[0, 100]} />
                    <Tooltip />
                    <Bar dataKey="value" name="Score %" radius={[4, 4, 0, 0]}>
                      {vendorTrend.map((entry, i) => (
                        <Cell key={entry.label} fill={entry.value >= 90 ? colors.green : entry.value >= 75 ? colors.amber : colors.red} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {config.extraTabs?.map((tab) => (
          <TabsContent key={tab.id} value={tab.id} className="mt-4">{tab.render(filtered)}</TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
