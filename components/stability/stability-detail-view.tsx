'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Printer, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { StudyStatusBadge, ResultStatusBadge, PullStatusBadge } from './stability-sub-nav';
import { StabilityPdfDocument } from './stability-pdf-document';
import {
  samplePullSchema, resultEntrySchema, stabilityApprovalSchema,
  type SamplePullInput, type ResultEntryInput, type StabilityApprovalInput,
  STABILITY_PARAMETERS, SAMPLE_PULL_STATUSES,
} from '@/lib/stability-schemas';
import {
  getSchedules, getSamplePulls, getResults, getApprovals, getAttachments,
  getAuditLogsForStudy, generateSchedule, updateSamplePull, addStabilityResult,
  submitApproval, closeStudy, uploadAttachment,
} from '@/lib/stability-service';
import type {
  StabilityStudy, StabilitySchedule, StabilitySamplePull, StabilityResult,
  StabilityApproval, StabilityAttachment,
} from '@/lib/stability-types';
import {
  canApproveStudy, canEnterResults, isStabilityReadOnly, parseSpecificationLimits,
} from '@/lib/stability-types';
import { printPage } from '@/lib/export-utils';
import { useStabilityActor } from '@/hooks/use-stability';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

interface StabilityDetailViewProps {
  record: StabilityStudy;
  onRefresh: () => void;
  defaultTab?: string;
}

export function StabilityDetailView({ record, onRefresh, defaultTab = 'overview' }: StabilityDetailViewProps) {
  const actor = useStabilityActor();
  const readOnly = isStabilityReadOnly(actor.role);
  const [schedules, setSchedules] = useState<StabilitySchedule[]>([]);
  const [pulls, setPulls] = useState<StabilitySamplePull[]>([]);
  const [results, setResults] = useState<StabilityResult[]>([]);
  const [approvals, setApprovals] = useState<StabilityApproval[]>([]);
  const [attachments, setAttachments] = useState<StabilityAttachment[]>([]);
  const [auditLogs, setAuditLogs] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadSub = async () => {
    setLoading(true);
    const [sch, pull, res, ap, att, al] = await Promise.all([
      getSchedules(record.id), getSamplePulls(record.id), getResults(record.id),
      getApprovals(record.id), getAttachments(record.id), getAuditLogsForStudy(record.id),
    ]);
    setSchedules(sch);
    setPulls(pull);
    setResults(res);
    setApprovals(ap);
    setAttachments(att);
    setAuditLogs(al);
    setLoading(false);
  };

  useEffect(() => { void loadSub(); }, [record.id]);

  const pullForm = useForm<SamplePullInput>({
    resolver: zodResolver(samplePullSchema),
    defaultValues: { interval: '', pulling_due_date: '', sample_quantity: '', pulled_by_name: actor.name, checked_by_name: '', status: 'Pending', remarks: '' },
  });

  const resultForm = useForm<ResultEntryInput>({
    resolver: zodResolver(resultEntrySchema),
    defaultValues: {
      interval: '', test_date: new Date().toISOString().split('T')[0],
      parameter_name: 'Assay', specification: '', observed_result: 0, unit: '%',
      analyst_name: actor.name, reviewed_by_name: '', remarks: '',
    },
  });

  const approvalForm = useForm<StabilityApprovalInput>({
    resolver: zodResolver(stabilityApprovalSchema),
    defaultValues: { decision: 'approved', comments: '', e_signature: actor.name },
  });

  const handleGenerateSchedule = async () => {
    try {
      setSaving(true);
      await generateSchedule(record.id, actor);
      toast.success('Schedule and sample pulling plan generated');
      onRefresh();
      await loadSub();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally { setSaving(false); }
  };

  const handleClose = async () => {
    try {
      setSaving(true);
      await closeStudy(record.id, actor);
      toast.success('Study closed');
      onRefresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Close failed');
    } finally { setSaving(false); }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await uploadAttachment(record.id, file, actor);
      toast.success('Attachment uploaded');
      await loadSub();
    } catch { toast.error('Upload failed'); }
  };

  const assayTrend = results.filter((r) => r.parameter_name === 'Assay').map((r) => ({
    interval: r.interval, value: Number(r.observed_result),
  }));
  const phTrend = results.filter((r) => r.parameter_name === 'pH').map((r) => ({
    interval: r.interval, value: Number(r.observed_result),
  }));
  const oosOot = results.filter((r) => ['OOS', 'OOT'].includes(r.result_status));

  if (loading) return <LoadingSpinner label="Loading stability study..." />;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h1 className="text-xl font-bold font-mono">{record.stability_study_number}</h1>
            <StudyStatusBadge status={record.status} />
          </div>
          <p className="text-muted-foreground">{record.product_name} — {record.batch_number}</p>
          <p className="text-xs text-muted-foreground mt-1">{record.study_type} | {record.storage_condition}</p>
        </div>
        <div className="no-print flex flex-wrap gap-2">
          {record.status === 'draft' && canApproveStudy(actor.role) && !readOnly && (
            <Button onClick={handleGenerateSchedule} disabled={saving || schedules.length > 0} className="bg-blue-600">
              Approve & Generate Schedule
            </Button>
          )}
          {schedules.length === 0 && record.status === 'approved_protocol' && !readOnly && (
            <Button onClick={handleGenerateSchedule} disabled={saving}>Generate Schedule</Button>
          )}
          {['completed', 'testing_completed'].includes(record.status) && canApproveStudy(actor.role) && (
            <Button variant="outline" onClick={handleClose} disabled={saving}>Close Study</Button>
          )}
          <Button variant="outline" onClick={() => printPage()} className="gap-1"><Printer className="h-4 w-4" />Print PDF</Button>
        </div>
      </div>

      <Tabs defaultValue={defaultTab}>
        <TabsList className="flex h-auto flex-wrap">
          {['overview', 'schedule', 'pulling', 'results', 'trends', 'oos-oot', 'attachments', 'approval', 'audit'].map((t) => (
            <TabsTrigger key={t} value={t} className="capitalize">{t === 'oos-oot' ? 'OOS/OOT Link' : t.replace('-', ' ')}</TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <Card>
            <CardContent className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
              {[
                ['Product', record.product_name], ['Generic', record.generic_name || '—'],
                ['Strength', record.strength], ['Dosage Form', record.dosage_form],
                ['Batch', record.batch_number], ['Batch Size', record.batch_size || '—'],
                ['Mfg Date', record.manufacturing_date], ['Expiry', record.expiry_date],
                ['Study Type', record.study_type], ['Storage', record.storage_condition],
                ['Market', record.market], ['Protocol', `${record.protocol_number} v${record.protocol_version}`],
                ['Initiation', record.study_initiation_date], ['End Date', record.study_end_date || '—'],
              ].map(([k, v]) => (
                <div key={String(k)}><span className="text-muted-foreground">{k}: </span><strong>{v}</strong></div>
              ))}
              {record.remarks && <div className="md:col-span-3"><span className="text-muted-foreground">Remarks: </span>{record.remarks}</div>}
              {record.pqr_id && (
                <div className="md:col-span-3">
                  <Link href="/pqr/stability" className="text-blue-600 underline">View in PQR Stability Review</Link>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="schedule" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Testing Schedule</CardTitle></CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Interval</TableHead><TableHead>Scheduled Date</TableHead><TableHead>Status</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {schedules.length === 0 ? (
                    <TableRow><TableCell colSpan={3} className="text-center py-6 text-muted-foreground">No schedule — approve protocol to generate</TableCell></TableRow>
                  ) : schedules.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell>{s.interval}</TableCell>
                      <TableCell>{s.scheduled_date}</TableCell>
                      <TableCell className="capitalize">{s.status}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pulling" className="mt-4 space-y-4">
          {!readOnly && pulls.some((p) => p.status === 'Pending') && (
            <Card>
              <CardHeader><CardTitle className="text-base">Record Sample Pull</CardTitle></CardHeader>
              <CardContent>
                <Form {...pullForm}>
                  <form onSubmit={pullForm.handleSubmit(async (data) => {
                    const pull = pulls.find((p) => p.interval === data.interval && p.status === 'Pending');
                    if (!pull) { toast.error('Select a pending interval'); return; }
                    try {
                      setSaving(true);
                      await updateSamplePull(pull.id, record.id, {
                        ...data,
                        actual_pulling_date: data.actual_pulling_date || new Date().toISOString().split('T')[0],
                        pulled_by: actor.id, checked_by: actor.id, status: 'Pulled',
                      }, actor);
                      toast.success('Sample pull recorded');
                      pullForm.reset();
                      await loadSub();
                      onRefresh();
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : 'Failed');
                    } finally { setSaving(false); }
                  })} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField control={pullForm.control} name="interval" render={({ field }) => (
                      <FormItem><FormLabel>Interval *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl><SelectTrigger><SelectValue placeholder="Select interval" /></SelectTrigger></FormControl>
                          <SelectContent>
                            {pulls.filter((p) => p.status === 'Pending').map((p) => (
                              <SelectItem key={p.id} value={p.interval}>{p.interval} — due {p.pulling_due_date}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select><FormMessage /></FormItem>
                    )} />
                    <FormField control={pullForm.control} name="sample_quantity" render={({ field }) => (
                      <FormItem><FormLabel>Sample Quantity *</FormLabel><FormControl><Input {...field} placeholder="e.g. 3 units" /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={pullForm.control} name="pulled_by_name" render={({ field }) => (
                      <FormItem><FormLabel>Pulled By *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={pullForm.control} name="checked_by_name" render={({ field }) => (
                      <FormItem><FormLabel>Checked By *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <div className="md:col-span-2"><Button type="submit" disabled={saving}>Record Pull</Button></div>
                  </form>
                </Form>
              </CardContent>
            </Card>
          )}
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Interval</TableHead><TableHead>Due Date</TableHead><TableHead>Actual Pull</TableHead>
                  <TableHead>Qty</TableHead><TableHead>Status</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {pulls.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">No sample pulls scheduled</TableCell></TableRow>
                  ) : pulls.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>{p.interval}</TableCell>
                      <TableCell>{p.pulling_due_date}</TableCell>
                      <TableCell>{p.actual_pulling_date || '—'}</TableCell>
                      <TableCell>{p.sample_quantity || '—'}</TableCell>
                      <TableCell><PullStatusBadge status={p.status} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="results" className="mt-4 space-y-4">
          {canEnterResults(actor.role) && !readOnly && (
            <Card>
              <CardHeader><CardTitle className="text-base">Enter Test Result</CardTitle></CardHeader>
              <CardContent>
                <Form {...resultForm}>
                  <form onSubmit={resultForm.handleSubmit(async (data) => {
                    try {
                      setSaving(true);
                      const limits = parseSpecificationLimits(data.specification);
                      const result = await addStabilityResult(record.id, {
                        ...data,
                        spec_lower_limit: data.spec_lower_limit ?? limits.lsl,
                        spec_upper_limit: data.spec_upper_limit ?? limits.usl,
                      }, actor);
                      toast.success(`Result saved — ${result.result_status}`);
                      resultForm.reset({ interval: data.interval, test_date: new Date().toISOString().split('T')[0], parameter_name: 'Assay', specification: '', observed_result: 0, unit: '%', analyst_name: actor.name });
                      await loadSub();
                      onRefresh();
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : 'Failed');
                    } finally { setSaving(false); }
                  })} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <FormField control={resultForm.control} name="interval" render={({ field }) => (
                        <FormItem><FormLabel>Interval *</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger></FormControl>
                            <SelectContent>
                              {schedules.map((s) => <SelectItem key={s.id} value={s.interval}>{s.interval}</SelectItem>)}
                            </SelectContent>
                          </Select><FormMessage /></FormItem>
                      )} />
                      <FormField control={resultForm.control} name="test_date" render={({ field }) => (
                        <FormItem><FormLabel>Test Date *</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={resultForm.control} name="parameter_name" render={({ field }) => (
                        <FormItem><FormLabel>Parameter *</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                            <SelectContent>{STABILITY_PARAMETERS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                          </Select><FormMessage /></FormItem>
                      )} />
                      <FormField control={resultForm.control} name="specification" render={({ field }) => (
                        <FormItem><FormLabel>Specification *</FormLabel><FormControl><Input {...field} placeholder="98.0 - 102.0 %" /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={resultForm.control} name="observed_result" render={({ field }) => (
                        <FormItem><FormLabel>Observed Result *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={resultForm.control} name="unit" render={({ field }) => (
                        <FormItem><FormLabel>Unit</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={resultForm.control} name="analyst_name" render={({ field }) => (
                        <FormItem><FormLabel>Analyst *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={resultForm.control} name="reviewed_by_name" render={({ field }) => (
                        <FormItem><FormLabel>Reviewed By</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                    </div>
                    <Button type="submit" disabled={saving}>Save Result</Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          )}
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Interval</TableHead><TableHead>Parameter</TableHead><TableHead>Result</TableHead>
                  <TableHead>Spec</TableHead><TableHead>Status</TableHead><TableHead>Date</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {results.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">No results entered</TableCell></TableRow>
                  ) : results.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{r.interval}</TableCell>
                      <TableCell>{r.parameter_name}</TableCell>
                      <TableCell>{r.observed_result} {r.unit}</TableCell>
                      <TableCell className="text-xs">{r.specification}</TableCell>
                      <TableCell><ResultStatusBadge status={r.result_status} /></TableCell>
                      <TableCell>{r.test_date}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trends" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-sm">Assay Trend</CardTitle></CardHeader>
              <CardContent className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={assayTrend.length ? assayTrend : [{ interval: 'N/A', value: 0 }]}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="interval" tick={{ fontSize: 10 }} />
                    <YAxis domain={['auto', 'auto']} />
                    <Tooltip /><Legend />
                    <Line type="monotone" dataKey="value" stroke="#16a34a" strokeWidth={2} dot={{ r: 4 }} name="Assay" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm">pH Trend</CardTitle></CardHeader>
              <CardContent className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={phTrend.length ? phTrend : [{ interval: 'N/A', value: 0 }]}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="interval" tick={{ fontSize: 10 }} />
                    <YAxis domain={['auto', 'auto']} />
                    <Tooltip /><Legend />
                    <Line type="monotone" dataKey="value" stroke="#2563eb" strokeWidth={2} dot={{ r: 4 }} name="pH" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
          <p className="text-xs text-muted-foreground mt-2">Trend data syncs to CPV Trend Analysis module automatically.</p>
        </TabsContent>

        <TabsContent value="oos-oot" className="mt-4">
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Parameter</TableHead><TableHead>Interval</TableHead><TableHead>Status</TableHead>
                  <TableHead>OOS Link</TableHead><TableHead>CPV Risk</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {oosOot.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">No OOS/OOT results</TableCell></TableRow>
                  ) : oosOot.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{r.parameter_name}</TableCell>
                      <TableCell>{r.interval}</TableCell>
                      <TableCell><ResultStatusBadge status={r.result_status} /></TableCell>
                      <TableCell>
                        {r.linked_oos_id ? (
                          <Link href={`/qms/oos/${r.linked_oos_id}`} className="text-blue-600 underline">{r.linked_oos_number}</Link>
                        ) : '—'}
                      </TableCell>
                      <TableCell>{r.cpv_risk_id ? <Link href="/cpv/risk-assessment" className="text-blue-600 underline">View CPV Alert</Link> : '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="attachments" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Attachments</CardTitle>
              {!readOnly && (
                <label className="cursor-pointer">
                  <Button variant="outline" size="sm" className="gap-1" asChild><span><Upload className="h-4 w-4" />Upload</span></Button>
                  <input type="file" className="hidden" onChange={handleFileUpload} />
                </label>
              )}
            </CardHeader>
            <CardContent>
              {attachments.length === 0 ? (
                <p className="text-sm text-muted-foreground">No attachments</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {attachments.map((a) => (
                    <li key={a.id}><a href={a.file_url} target="_blank" rel="noreferrer" className="text-blue-600 underline">{a.file_name}</a></li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="approval" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Approval History</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {approvals.length > 0 && (
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Approver</TableHead><TableHead>Level</TableHead><TableHead>Decision</TableHead><TableHead>Date</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {approvals.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell>{a.approver_name}</TableCell>
                        <TableCell>{a.approval_level}</TableCell>
                        <TableCell className="capitalize">{a.decision}</TableCell>
                        <TableCell>{new Date(a.signed_at).toLocaleDateString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              {canApproveStudy(actor.role) && !readOnly && !['closed', 'cancelled'].includes(record.status) && (
                <Form {...approvalForm}>
                  <form className="space-y-4 border-t pt-4">
                    <FormField control={approvalForm.control} name="comments" render={({ field }) => (
                      <FormItem><FormLabel>Comments *</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={approvalForm.control} name="e_signature" render={({ field }) => (
                      <FormItem><FormLabel>E-Signature *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <div className="flex gap-2">
                      <Button type="button" disabled={saving} onClick={approvalForm.handleSubmit(async (data) => {
                        try {
                          setSaving(true);
                          await submitApproval(record.id, { ...data, decision: 'approved' }, actor);
                          toast.success('Study approved');
                          onRefresh();
                          await loadSub();
                        } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed'); }
                        finally { setSaving(false); }
                      })}>Approve</Button>
                      <Button type="button" variant="destructive" disabled={saving} onClick={approvalForm.handleSubmit(async (data) => {
                        try {
                          setSaving(true);
                          await submitApproval(record.id, { ...data, decision: 'rejected' }, actor);
                          toast.success('Study rejected');
                          onRefresh();
                          await loadSub();
                        } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed'); }
                        finally { setSaving(false); }
                      })}>Reject</Button>
                    </div>
                  </form>
                </Form>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="mt-4">
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Action</TableHead><TableHead>User</TableHead><TableHead>Date</TableHead></TableRow></TableHeader>
                <TableBody>
                  {auditLogs.length === 0 ? (
                    <TableRow><TableCell colSpan={3} className="text-center py-6 text-muted-foreground">No audit entries</TableCell></TableRow>
                  ) : auditLogs.map((log, i) => (
                    <TableRow key={i}>
                      <TableCell>{String(log.action || '')}</TableCell>
                      <TableCell>{String(log.userName || '')}</TableCell>
                      <TableCell>{String(log.dateTime || log.timestamp || '')}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div id="stability-pdf-document" className="sr-only">
        <StabilityPdfDocument
          record={record} schedules={schedules} pulls={pulls} results={results}
          approvals={approvals} auditLogs={auditLogs}
        />
      </div>
    </div>
  );
}
