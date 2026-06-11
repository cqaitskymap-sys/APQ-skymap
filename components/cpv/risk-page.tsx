'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { Plus, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/auth-context';
import {
  RISK_SOURCES, RiskInput, RiskRecord, calculateRisk, cpvPermissions,
  generateRiskId, riskSchema,
} from '@/lib/cpv';
import {
  buildRiskHeatMap, buildRiskMatrix, buildRiskReport, displayRiskId,
  filterRiskRegister, riskDescriptionText, riskFilterOptions, riskLevelColor,
  riskOccurrence,
} from '@/lib/cpv-risk-report';
import { createRisk } from '@/lib/cpv-service';
import { useCpvData } from '@/hooks/use-cpv-data';
import { printPage } from '@/lib/export-utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { DataState, KpiCard, PageHeading, StatusBadge } from '@/components/cpv/cpv-ui';

const LEVEL_TONE = { Low: 'green', Medium: 'amber', High: 'amber', Critical: 'red' } as const;

function ScoreSelect({ form, name, label }: {
  form: ReturnType<typeof useForm<RiskInput>>;
  name: 'severity' | 'occurrence' | 'detectability';
  label: string;
}) {
  return (
    <FormField control={form.control} name={name} render={({ field }) => (
      <FormItem>
        <FormLabel>{label}</FormLabel>
        <Select value={String(field.value)} onValueChange={(v) => field.onChange(Number(v))}>
          <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
          <SelectContent>
            {[1, 2, 3, 4, 5].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
          </SelectContent>
        </Select>
        <FormMessage />
      </FormItem>
    )} />
  );
}

function RiskMatrixGrid({ matrix }: { matrix: ReturnType<typeof buildRiskMatrix> }) {
  const severities = [5, 4, 3, 2, 1];
  const occurrences = [1, 2, 3, 4, 5];

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[480px] border-collapse text-center text-sm">
        <thead>
          <tr>
            <th className="border bg-slate-50 p-2 text-xs font-medium text-muted-foreground">Severity ↓ / Occurrence →</th>
            {occurrences.map((o) => (
              <th key={o} className="border bg-slate-50 p-2 text-xs font-medium">{o}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {severities.map((s) => (
            <tr key={s}>
              <td className="border bg-slate-50 p-2 font-medium">{s}</td>
              {occurrences.map((o) => {
                const cell = matrix.find((c) => c.severity === s && c.occurrence === o);
                const level = cell?.level || 'Low';
                return (
                  <td
                    key={o}
                    className="border p-2 transition-colors"
                    style={{ backgroundColor: cell?.count ? `${riskLevelColor(level)}22` : undefined }}
                  >
                    <div className="font-bold tabular-nums">{cell?.count || 0}</div>
                    {cell?.count ? (
                      <>
                        <div className="text-[10px] text-muted-foreground">max RPN {cell.maxRpn}</div>
                        <Badge variant="outline" className="mt-1 text-[10px]">{level}</Badge>
                      </>
                    ) : (
                      <div className="text-[10px] text-muted-foreground">{level}</div>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RiskHeatMap({ heatMap }: { heatMap: ReturnType<typeof buildRiskHeatMap> }) {
  const severities = [5, 4, 3, 2, 1];
  const occurrences = [1, 2, 3, 4, 5];

  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-[480px] gap-1" style={{ gridTemplateColumns: 'auto repeat(5, 1fr)' }}>
        <div />
        {occurrences.map((o) => (
          <div key={o} className="text-center text-xs font-medium text-muted-foreground py-1">O={o}</div>
        ))}
        {severities.map((s) => (
          <Fragment key={s}>
            <div className="flex items-center text-xs font-medium text-muted-foreground pr-2">S={s}</div>
            {occurrences.map((o) => {
              const cell = heatMap.find((c) => c.severity === s && c.occurrence === o);
              const level = cell?.level || 'Low';
              const opacity = cell?.count ? 0.25 + (cell.intensity * 0.75) : 0.05;
              return (
                <div
                  key={`${s}-${o}`}
                  className={cn(
                    'flex min-h-[52px] flex-col items-center justify-center rounded-md border p-2 text-center',
                    cell?.count && 'ring-1 ring-inset',
                  )}
                  style={{
                    backgroundColor: `${riskLevelColor(level)}${Math.round(opacity * 255).toString(16).padStart(2, '0')}`,
                    borderColor: cell?.count ? riskLevelColor(level) : undefined,
                  }}
                  title={cell?.count ? `${cell.count} risk(s), max RPN ${cell.maxRpn}` : 'No risks'}
                >
                  <span className="text-lg font-bold tabular-nums">{cell?.count || ''}</span>
                  {cell?.count ? (
                    <span className="text-[10px] font-medium" style={{ color: riskLevelColor(level) }}>{level}</span>
                  ) : null}
                </div>
              );
            })}
          </Fragment>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-3 text-xs">
        {(['Low', 'Medium', 'High', 'Critical'] as const).map((level) => (
          <span key={level} className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded" style={{ backgroundColor: riskLevelColor(level) }} />
            {level}
          </span>
        ))}
      </div>
    </div>
  );
}

export function RiskAssessmentPage() {
  const { user, profile } = useAuth();
  const { loading, risks, reload } = useCpvData();
  const [open, setOpen] = useState(false);
  const [product, setProduct] = useState('all');
  const [source, setSource] = useState('all');
  const [level, setLevel] = useState('all');
  const readOnly = cpvPermissions.isReadOnly(profile?.role);

  const form = useForm<RiskInput>({
    resolver: zodResolver(riskSchema),
    defaultValues: {
      riskId: '',
      productName: '',
      batchNo: '',
      factor: '',
      riskDescription: '',
      severity: 1,
      occurrence: 1,
      detectability: 1,
      mitigation: '',
      owner: profile?.full_name || '',
      dueDate: '',
    },
  });

  useEffect(() => {
    if (profile?.full_name && !form.getValues('owner')) form.setValue('owner', profile.full_name);
  }, [form, profile?.full_name]);

  useEffect(() => {
    if (open) form.setValue('riskId', generateRiskId(risks.length));
  }, [open, risks.length, form]);

  const score = calculateRisk(
    Number(form.watch('occurrence')),
    Number(form.watch('severity')),
    Number(form.watch('detectability')),
  );

  const filtered = useMemo(
    () => filterRiskRegister(risks, { product, source, level }),
    [risks, product, source, level],
  );

  const { products, sources: existingSources } = useMemo(
    () => riskFilterOptions(risks),
    [risks],
  );

  const matrix = useMemo(() => buildRiskMatrix(filtered), [filtered]);
  const heatMap = useMemo(() => buildRiskHeatMap(filtered), [filtered]);
  const report = useMemo(() => buildRiskReport(filtered), [filtered]);

  const pieData = useMemo(() => (
    (['Low', 'Medium', 'High', 'Critical'] as const)
      .map((name) => ({ name, value: report.byLevel[name], fill: riskLevelColor(name) }))
      .filter((d) => d.value > 0)
  ), [report]);

  const submit = form.handleSubmit(async (values) => {
    try {
      await createRisk({ ...values, riskId: values.riskId || generateRiskId(risks.length) }, {
        id: user?.uid,
        name: profile?.full_name,
        role: profile?.role,
      }, risks.length);
      toast.success('Risk assessment saved');
      setOpen(false);
      form.reset({
        ...form.formState.defaultValues,
        owner: profile?.full_name || '',
        riskId: generateRiskId(risks.length + 1),
      } as RiskInput);
      await reload();
    } catch (error) {
      console.error(error);
      toast.error('Risk assessment could not be saved');
    }
  });

  return (
    <div className="space-y-6">
      <PageHeading
        title="CPV Risk Assessment"
        description="FMEA-style risk register for CPP drift, CQA drift, OOT, OOS, deviations, CAPA, equipment, utility, and vendor risks — with auto RPN, risk level, matrix, and heat map."
        actions={(
          <>
            <Button variant="outline" onClick={() => printPage()}>
              <Printer className="mr-2 h-4 w-4" />Export PDF
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button disabled={readOnly}><Plus className="mr-2 h-4 w-4" />New Risk</Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
                <DialogHeader><DialogTitle>Risk Assessment Entry</DialogTitle></DialogHeader>
                <Form {...form}>
                  <form onSubmit={submit} className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <FormField control={form.control} name="riskId" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Risk ID</FormLabel>
                          <FormControl><Input {...field} readOnly className="font-mono bg-slate-50" /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="productName" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Product</FormLabel>
                          <FormControl><Input {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="batchNo" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Batch (optional)</FormLabel>
                          <FormControl><Input {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="factor" render={({ field }) => (
                        <FormItem className="sm:col-span-2">
                          <FormLabel>Risk Source</FormLabel>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Select source" /></SelectTrigger></FormControl>
                            <SelectContent>
                              {RISK_SOURCES.map((item) => (
                                <SelectItem key={item} value={item}>{item}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="riskDescription" render={({ field }) => (
                        <FormItem className="sm:col-span-2">
                          <FormLabel>Risk Description</FormLabel>
                          <FormControl><Textarea {...field} rows={3} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <ScoreSelect form={form} name="severity" label="Severity (1–5)" />
                      <ScoreSelect form={form} name="occurrence" label="Occurrence (1–5)" />
                      <ScoreSelect form={form} name="detectability" label="Detectability (1–5)" />
                      <div className="rounded-lg border bg-slate-50 p-4 dark:bg-slate-900/30">
                        <p className="text-xs text-muted-foreground">Auto-calculated</p>
                        <p className="mt-1 text-2xl font-bold tabular-nums">RPN {score.rpn}</p>
                        <div className="mt-2"><StatusBadge status={score.riskLevel} /></div>
                        <p className="mt-1 text-[10px] text-muted-foreground">RPN = Severity × Occurrence × Detectability</p>
                      </div>
                      <FormField control={form.control} name="mitigation" render={({ field }) => (
                        <FormItem className="sm:col-span-2">
                          <FormLabel>Mitigation / Control</FormLabel>
                          <FormControl><Textarea {...field} rows={2} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="owner" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Owner</FormLabel>
                          <FormControl><Input {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="dueDate" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Due Date</FormLabel>
                          <FormControl><Input type="date" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                      <Button type="submit">Save Risk</Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </>
        )}
      />

      <Card className="no-print">
        <CardContent className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Label>Product</Label>
            <Select value={product} onValueChange={setProduct}>
              <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Products</SelectItem>
                {products.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Risk Source</Label>
            <Select value={source} onValueChange={setSource}>
              <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                {RISK_SOURCES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                {existingSources.filter((s) => !RISK_SOURCES.includes(s as typeof RISK_SOURCES[number])).map((s) => (
                  <SelectItem key={s} value={s}>{s} (legacy)</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Risk Level</Label>
            <Select value={level} onValueChange={setLevel}>
              <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                {(['Low', 'Medium', 'High', 'Critical'] as const).map((l) => (
                  <SelectItem key={l} value={l}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-5 no-print">
        <KpiCard label="Total Risks" value={filtered.length} />
        <KpiCard label="Low" value={report.byLevel.Low} tone="green" />
        <KpiCard label="Medium" value={report.byLevel.Medium} tone="amber" />
        <KpiCard label="High" value={report.byLevel.High} tone="amber" />
        <KpiCard label="Critical" value={report.byLevel.Critical} tone="red" />
      </div>

      <Tabs defaultValue="register" className="space-y-5">
        <TabsList className="no-print grid h-auto w-full grid-cols-2 gap-1 p-1 lg:grid-cols-4">
          <TabsTrigger value="register">Risk Register</TabsTrigger>
          <TabsTrigger value="matrix">Risk Matrix</TabsTrigger>
          <TabsTrigger value="heatmap">Heat Map</TabsTrigger>
          <TabsTrigger value="report">Risk Report</TabsTrigger>
        </TabsList>

        <TabsContent value="register">
          <Card>
            <CardHeader><CardTitle>Risk Register</CardTitle></CardHeader>
            <CardContent className="p-0">
              <DataState loading={loading} empty={!filtered.length} emptyText="No risk assessments recorded." />
              {!loading && filtered.length > 0 && (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Risk ID</TableHead>
                        <TableHead>Product / Batch</TableHead>
                        <TableHead>Source</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>S</TableHead>
                        <TableHead>O</TableHead>
                        <TableHead>D</TableHead>
                        <TableHead>RPN</TableHead>
                        <TableHead>Level</TableHead>
                        <TableHead>Owner</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((risk: RiskRecord) => (
                        <TableRow key={risk.id}>
                          <TableCell className="font-mono text-xs">{displayRiskId(risk)}</TableCell>
                          <TableCell>
                            <p className="font-medium">{risk.productName}</p>
                            <p className="text-xs text-muted-foreground">{risk.batchNo || 'All batches'}</p>
                          </TableCell>
                          <TableCell>{risk.factor}</TableCell>
                          <TableCell className="max-w-[200px] truncate text-sm" title={riskDescriptionText(risk)}>
                            {riskDescriptionText(risk)}
                          </TableCell>
                          <TableCell>{risk.severity}</TableCell>
                          <TableCell>{riskOccurrence(risk)}</TableCell>
                          <TableCell>{risk.detectability}</TableCell>
                          <TableCell className="font-mono font-bold">{risk.rpn}</TableCell>
                          <TableCell><StatusBadge status={risk.riskLevel} /></TableCell>
                          <TableCell>
                            <p className="text-sm">{risk.owner}</p>
                            {risk.dueDate && <p className="text-xs text-muted-foreground">{risk.dueDate}</p>}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="matrix">
          <Card>
            <CardHeader>
              <CardTitle>Risk Matrix</CardTitle>
              <CardDescription>Severity vs Occurrence — cell count and max RPN for filtered risks</CardDescription>
            </CardHeader>
            <CardContent>
              <DataState loading={loading} empty={!filtered.length} />
              {!loading && filtered.length > 0 && <RiskMatrixGrid matrix={matrix} />}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="heatmap">
          <Card>
            <CardHeader>
              <CardTitle>Risk Heat Map</CardTitle>
              <CardDescription>Color intensity reflects risk concentration by Severity × Occurrence</CardDescription>
            </CardHeader>
            <CardContent>
              <DataState loading={loading} empty={!filtered.length} />
              {!loading && filtered.length > 0 && <RiskHeatMap heatMap={heatMap} />}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="report">
          <section id="risk-report" className="space-y-5 bg-white print:p-4 dark:bg-transparent">
            <div className="hidden border-b-2 border-blue-800 pb-4 print:block">
              <p className="text-sm font-bold text-blue-800">SKYMAP PHARMACEUTICALS</p>
              <h1 className="mt-1 text-2xl font-bold">CPV Risk Assessment Report</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Generated: {new Date(report.generatedAt).toLocaleString()} · {filtered.length} risks in scope
              </p>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader><CardTitle>Risk Level Distribution</CardTitle></CardHeader>
                <CardContent className="h-[280px]">
                  {pieData.length ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                          {pieData.map((entry) => <Cell key={entry.name} fill={entry.fill} />)}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <DataState loading={false} empty emptyText="No risks to chart." />
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>By Risk Source</CardTitle></CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Source</TableHead>
                        <TableHead>Count</TableHead>
                        <TableHead>Avg RPN</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {report.bySource.map((row) => (
                        <TableRow key={row.source}>
                          <TableCell>{row.source}</TableCell>
                          <TableCell>{row.count}</TableCell>
                          <TableCell className="font-mono">{row.avgRpn}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader><CardTitle>Top Risks by RPN</CardTitle></CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Risk ID</TableHead>
                        <TableHead>Source</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>S×O×D</TableHead>
                        <TableHead>RPN</TableHead>
                        <TableHead>Level</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {report.topRisks.map((risk) => (
                        <TableRow key={risk.id}>
                          <TableCell className="font-mono text-xs">{displayRiskId(risk)}</TableCell>
                          <TableCell>{risk.factor}</TableCell>
                          <TableCell className="max-w-xs truncate">{riskDescriptionText(risk)}</TableCell>
                          <TableCell>{risk.severity}×{riskOccurrence(risk)}×{risk.detectability}</TableCell>
                          <TableCell className="font-bold">{risk.rpn}</TableCell>
                          <TableCell><StatusBadge status={risk.riskLevel} /></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Risk Matrix Summary</CardTitle></CardHeader>
              <CardContent><RiskMatrixGrid matrix={matrix} /></CardContent>
            </Card>
          </section>
        </TabsContent>
      </Tabs>

      <Card className="no-print">
        <CardHeader><CardTitle>RPN Scoring Guide</CardTitle></CardHeader>
        <CardContent className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <p><strong className="text-emerald-700">Low:</strong> RPN 1–19</p>
          <p><strong className="text-amber-700">Medium:</strong> RPN 20–49</p>
          <p><strong className="text-orange-700">High:</strong> RPN 50–79</p>
          <p><strong className="text-red-700">Critical:</strong> RPN ≥ 80</p>
        </CardContent>
      </Card>
    </div>
  );
}
