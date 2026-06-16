'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  AlertTriangle, ArrowLeft, CheckCircle, Loader2, Save, Send, XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/auth-context';
import {
  canApprovePhase1,
  canEditPhase1,
  computePhase1AutoRules,
  isPhase1ReadOnly,
  mapPhase1AuditTimeline,
} from '@/lib/oos-phase1-records';
import {
  fetchEquipmentOptions,
  fetchPhase1PageData,
  logPhase1PageViewed,
  reviewPhase1,
  savePhase1Draft,
  startPhase1Investigation,
  submitPhase1ToQa,
  uploadPhase1Attachment,
} from '@/lib/oos-phase1-service';
import {
  phase1ObjectSchema,
  phase1QaReviewSchema,
  type Phase1Input,
  type Phase1QaReviewInput,
} from '@/lib/oos-schemas';
import { PHASE1_OUTCOMES } from '@/lib/oos-types';
import type { OosAttachment, OosPhase1, OosRecord } from '@/lib/oos-types';
import { CpvPageHeader } from '@/components/cpv/product-master/cpv-page-header';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { EmptyState } from '@/components/admin/dashboard/empty-state';
import { OosStatusBadge, ResultStatusBadge } from '@/components/oos/oos-sub-nav';
import { OosPhase1AccessGuard } from './oos-phase1-access-guard';
import { Phase1StatusBadge } from './phase1-status-badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

function mapPhase1ToForm(phase1: OosPhase1 | null, record: OosRecord): Phase1Input {
  return {
    qc_investigator: phase1?.qc_investigator || record.assigned_to_name || '',
    qc_investigator_id: phase1?.qc_investigator_id || record.assigned_to || undefined,
    analyst_name: phase1?.analyst_name || record.analyst_name || '',
    instrument_used: phase1?.instrument_used || record.instrument_used || '',
    instrument_id: phase1?.instrument_id,
    instrument_calibration_status: phase1?.instrument_calibration_status || 'Valid',
    standard_used: phase1?.standard_used || '',
    standard_lot_number: phase1?.standard_lot_number,
    reagent_used: phase1?.reagent_used || '',
    reagent_lot_number: phase1?.reagent_lot_number,
    glassware_verified: phase1?.glassware_verified ?? false,
    calculation_verified: phase1?.calculation_verified ?? false,
    method_followed_correctly: phase1?.method_followed_correctly ?? false,
    sample_preparation_verified: phase1?.sample_preparation_verified ?? false,
    data_review_completed: phase1?.data_review_completed ?? false,
    chromatogram_attached: phase1?.chromatogram_attached ?? false,
    raw_data_attached: phase1?.raw_data_attached ?? false,
    chromatogram_raw_data_reviewed: phase1?.chromatogram_raw_data_reviewed ?? false,
    analyst_interview_completed: phase1?.analyst_interview_completed ?? false,
    lab_error_observed: phase1?.lab_error_observed ?? false,
    assignable_cause_identified: phase1?.assignable_cause_identified ?? false,
    investigation_findings: phase1?.investigation_findings || '',
    root_cause_identified: phase1?.root_cause_identified || '',
    root_cause: phase1?.root_cause || '',
    corrective_action: phase1?.corrective_action || '',
    phase1_conclusion: phase1?.phase1_conclusion || '',
    phase1_outcome: (phase1?.phase1_outcome as Phase1Input['phase1_outcome']) || undefined,
  };
}

export function OosPhase1Page({ oosId }: { oosId: string }) {
  const { user, profile } = useAuth();
  const viewed = useRef(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [record, setRecord] = useState<OosRecord | null>(null);
  const [phase1, setPhase1] = useState<OosPhase1 | null>(null);
  const [attachments, setAttachments] = useState<OosAttachment[]>([]);
  const [auditLogs, setAuditLogs] = useState<Record<string, unknown>[]>([]);
  const [equipment, setEquipment] = useState<Awaited<ReturnType<typeof fetchEquipmentOptions>>>([]);

  const actor = useMemo(() => ({
    id: user?.uid || 'system',
    name: profile?.full_name || profile?.email || 'User',
    role: profile?.role,
  }), [user?.uid, profile?.full_name, profile?.email, profile?.role]);

  const canEdit = canEditPhase1(actor.role) && !isPhase1ReadOnly(actor.role);
  const canApprove = canApprovePhase1(actor.role, record);
  const readOnly = isPhase1ReadOnly(actor.role) || phase1?.status === 'Completed';

  const form = useForm<Phase1Input>({
    resolver: zodResolver(phase1ObjectSchema),
    defaultValues: { analyst_name: '', instrument_used: '', instrument_calibration_status: 'Valid', standard_used: '', reagent_used: '', calculation_verified: false, investigation_findings: '', phase1_conclusion: '' },
  });

  const qaForm = useForm<Phase1QaReviewInput>({
    resolver: zodResolver(phase1QaReviewSchema),
    defaultValues: { decision: 'approved', qa_review_comments: '' },
  });

  const watchAll = form.watch();
  const autoRules = useMemo(() => computePhase1AutoRules(watchAll), [watchAll]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [data, equip] = await Promise.all([fetchPhase1PageData(oosId), fetchEquipmentOptions()]);
    setEquipment(equip);
    if ('error' in data && data.error) {
      setError(data.error);
      setLoading(false);
      return;
    }
    setRecord(data.record!);
    setPhase1(data.phase1 || null);
    setAttachments(data.attachments || []);
    setAuditLogs(data.auditLogs || []);
    form.reset(mapPhase1ToForm(data.phase1 || null, data.record!));
    setLoading(false);
    if (!viewed.current) {
      viewed.current = true;
      void logPhase1PageViewed(oosId, actor, data.record!.oos_number);
    }
  }, [oosId, actor, form]);

  useEffect(() => { void load(); }, [load]);

  const handleStart = async () => {
    setBusy(true);
    const { phase1: p1, error: err } = await startPhase1Investigation(oosId, actor);
    setBusy(false);
    if (err) return toast.error(err);
    toast.success('Phase-I investigation started');
    void load();
  };

  const handleSaveDraft = async () => {
    setBusy(true);
    const { error: err } = await savePhase1Draft(oosId, form.getValues(), actor);
    setBusy(false);
    if (err) return toast.error(err);
    toast.success('Phase-I draft saved');
    void load();
  };

  const handleSubmitQa = async () => {
    const valid = await form.trigger();
    if (!valid) return toast.error('Fix validation errors before submitting to QA.');
    setBusy(true);
    const { error: err } = await submitPhase1ToQa(oosId, form.getValues(), actor);
    setBusy(false);
    if (err) return toast.error(err);
    toast.success('Phase-I submitted for QA review');
    void load();
  };

  const handleQaReview = async (data: Phase1QaReviewInput) => {
    setBusy(true);
    const { error: err } = await reviewPhase1(oosId, data, actor);
    setBusy(false);
    if (err) return toast.error(err);
    toast.success(data.decision === 'approved' ? 'Phase-I approved' : 'Phase-I rejected');
    void load();
  };

  const handleUpload = async (file: File, category: OosAttachment['category']) => {
    setBusy(true);
    const { error: err } = await uploadPhase1Attachment(oosId, file, category, actor);
    setBusy(false);
    if (err) return toast.error(err);
    toast.success(`${file.name} uploaded`);
    void load();
  };

  const checklistFields = [
    ['glassware_verified', 'Glassware Verified'],
    ['calculation_verified', 'Calculation Verified'],
    ['method_followed_correctly', 'Method Followed Correctly'],
    ['sample_preparation_verified', 'Sample Preparation Verified'],
    ['chromatogram_raw_data_reviewed', 'Chromatogram / Raw Data Reviewed'],
    ['analyst_interview_completed', 'Analyst Interview Completed'],
    ['data_review_completed', 'Data Review Completed'],
    ['chromatogram_attached', 'Chromatogram Attached'],
    ['raw_data_attached', 'Raw Data Attached'],
    ['lab_error_observed', 'Lab Error Observed'],
    ['assignable_cause_identified', 'Assignable Cause Identified'],
  ] as const;

  const timeline = mapPhase1AuditTimeline(auditLogs);

  return (
    <OosPhase1AccessGuard record={record}>
      <div className="space-y-6">
        <CpvPageHeader
          title="Phase-I Laboratory Investigation"
          description={record ? `${record.oos_number} — ${record.test_name}` : 'Loading...'}
          trail={[
            { label: 'Dashboard', href: '/dashboard' },
            { label: 'QMS', href: '/qms/oos' },
            { label: 'OOS Management', href: '/qms/oos' },
            { label: 'Phase-I', href: '/qms/oos/phase1' },
            { label: record?.oos_number || 'Investigation' },
          ]}
          actions={(
            <div className="flex flex-wrap gap-2">
              <Link href="/qms/oos/phase1"><Button variant="outline" size="sm"><ArrowLeft className="mr-1 h-4 w-4" /> Queue</Button></Link>
              {record && <Link href={`/qms/oos/${oosId}`}><Button variant="outline" size="sm">OOS Record</Button></Link>}
            </div>
          )}
        />

        {loading ? <LoadingSkeleton rows={4} /> : error ? (
          <ErrorCard title="Load error" message={error} onRetry={() => void load()} />
        ) : record ? (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <OosStatusBadge status={record.status} />
              <Phase1StatusBadge status={phase1?.status} />
              {record.is_critical_test && <span className="rounded-md bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">Critical OOS</span>}
            </div>

            {(!phase1 || phase1.status === 'Not Started') && canEdit && (
              <Card><CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                <p className="text-sm text-muted-foreground">Phase-I investigation has not been started for this OOS record.</p>
                <Button onClick={() => void handleStart()} disabled={busy} className="bg-blue-600 hover:bg-blue-700">Start Phase-I</Button>
              </CardContent></Card>
            )}

            {autoRules.warnings.length > 0 && (
              <Alert variant={autoRules.deviationRecommended ? 'destructive' : 'default'}>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Auto Rules</AlertTitle>
                <AlertDescription><ul className="mt-1 list-disc pl-4 text-sm">{autoRules.warnings.map((w) => <li key={w}>{w}</li>)}</ul></AlertDescription>
              </Alert>
            )}

            <Tabs defaultValue="overview" className="space-y-4">
              <TabsList className="flex h-auto flex-wrap gap-1">
                {['overview', 'checklist', 'rawdata', 'findings', 'qa', 'attachments', 'audit'].map((t) => (
                  <TabsTrigger key={t} value={t} className="capitalize">
                    {t === 'rawdata' ? 'Raw Data Review' : t === 'qa' ? 'QA Review' : t === 'audit' ? 'Audit Trail' : t === 'checklist' ? 'Lab Checklist' : t === 'findings' ? 'Findings & RCA' : 'OOS Overview'}
                  </TabsTrigger>
                ))}
              </TabsList>

              <TabsContent value="overview">
                <Card>
                  <CardHeader><CardTitle className="text-base">OOS Overview</CardTitle></CardHeader>
                  <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 text-sm">
                    <div><span className="text-muted-foreground">OOS Number:</span> <span className="font-mono font-medium">{record.oos_number}</span></div>
                    <div><span className="text-muted-foreground">OOS Date:</span> {record.oos_date}</div>
                    <div><span className="text-muted-foreground">Department:</span> {record.department}</div>
                    <div><span className="text-muted-foreground">Product:</span> {record.product_name}</div>
                    <div><span className="text-muted-foreground">Batch:</span> {record.batch_number}</div>
                    <div><span className="text-muted-foreground">Test:</span> {record.test_name}</div>
                    <div><span className="text-muted-foreground">Parameter:</span> {record.parameter_name}</div>
                    <div><span className="text-muted-foreground">Specification:</span> {record.spec_lower_limit} – {record.spec_upper_limit} {record.unit}</div>
                    <div><span className="text-muted-foreground">Observed:</span> {record.observed_result} {record.unit}</div>
                    <div><span className="text-muted-foreground">Result:</span> <ResultStatusBadge status={record.result_status} /></div>
                    <div><span className="text-muted-foreground">Phase-I ID:</span> {phase1?.phase1_id || phase1?.id || '—'}</div>
                    <div><span className="text-muted-foreground">Investigation Start:</span> {phase1?.investigation_start_date || '—'}</div>
                    <div><span className="text-muted-foreground">Due Date:</span> {phase1?.investigation_due_date || record.target_closure_date || '—'}</div>
                    <div><span className="text-muted-foreground">QC Investigator:</span> {phase1?.qc_investigator || record.assigned_to_name || '—'}</div>
                    {phase1?.phase2_recommended && <div className="sm:col-span-2 text-amber-700">Phase-II manufacturing investigation recommended</div>}
                    {phase1?.deviation_recommended && <div className="sm:col-span-2 text-red-700">Deviation creation recommended (calibration issue)</div>}
                  </CardContent>
                </Card>
              </TabsContent>

              <Form {...form}>
                <TabsContent value="checklist">
                  <Card>
                    <CardHeader><CardTitle className="text-base">Laboratory Investigation Checklist</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid gap-4 md:grid-cols-2">
                        <FormField control={form.control} name="qc_investigator" render={({ field }) => (
                          <FormItem><FormLabel>QC Investigator *</FormLabel><FormControl><Input {...field} disabled={readOnly || !canEdit} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="analyst_name" render={({ field }) => (
                          <FormItem><FormLabel>Analyst Name *</FormLabel><FormControl><Input {...field} disabled={readOnly || !canEdit} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="instrument_used" render={({ field }) => (
                          <FormItem><FormLabel>Instrument Used *</FormLabel>
                            <Select
                              onValueChange={(v) => {
                                const eq = equipment.find((e) => e.name === v);
                                field.onChange(v);
                                if (eq) {
                                  form.setValue('instrument_id', eq.equipmentId);
                                  form.setValue('instrument_calibration_status', eq.calibrationStatus || 'Valid');
                                }
                              }}
                              value={field.value}
                              disabled={readOnly || !canEdit}
                            >
                              <FormControl><SelectTrigger><SelectValue placeholder="Select instrument" /></SelectTrigger></FormControl>
                              <SelectContent>{equipment.map((e) => <SelectItem key={e.id} value={e.name}>{e.name}</SelectItem>)}</SelectContent>
                            </Select>
                            <FormControl><Input {...field} className="mt-2" disabled={readOnly || !canEdit} /></FormControl>
                            <FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="instrument_id" render={({ field }) => (
                          <FormItem><FormLabel>Instrument ID</FormLabel><FormControl><Input {...field} value={field.value || ''} disabled={readOnly || !canEdit} /></FormControl></FormItem>
                        )} />
                        <FormField control={form.control} name="instrument_calibration_status" render={({ field }) => (
                          <FormItem><FormLabel>Calibration Status *</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value} disabled={readOnly || !canEdit}>
                              <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                              <SelectContent>{['Valid', 'Expired', 'Overdue', 'Failed', 'Out of Calibration'].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                            </Select><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="standard_used" render={({ field }) => (
                          <FormItem><FormLabel>Standard Used *</FormLabel><FormControl><Input {...field} disabled={readOnly || !canEdit} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="standard_lot_number" render={({ field }) => (
                          <FormItem><FormLabel>Standard Lot Number</FormLabel><FormControl><Input {...field} value={field.value || ''} disabled={readOnly || !canEdit} /></FormControl></FormItem>
                        )} />
                        <FormField control={form.control} name="reagent_used" render={({ field }) => (
                          <FormItem><FormLabel>Reagent Used *</FormLabel><FormControl><Input {...field} disabled={readOnly || !canEdit} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="reagent_lot_number" render={({ field }) => (
                          <FormItem><FormLabel>Reagent Lot Number</FormLabel><FormControl><Input {...field} value={field.value || ''} disabled={readOnly || !canEdit} /></FormControl></FormItem>
                        )} />
                      </div>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {checklistFields.map(([name, label]) => (
                          <FormField key={name} control={form.control} name={name} render={({ field }) => (
                            <FormItem className="flex items-center justify-between rounded-md border p-3">
                              <FormLabel className="text-sm font-normal">{label}</FormLabel>
                              <FormControl><Switch checked={Boolean(field.value)} onCheckedChange={field.onChange} disabled={readOnly || !canEdit} /></FormControl>
                            </FormItem>
                          )} />
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="rawdata">
                  <Card>
                    <CardHeader><CardTitle className="text-base">Raw Data Review</CardTitle><CardDescription>Verify chromatograms, raw data, and calculation accuracy</CardDescription></CardHeader>
                    <CardContent className="space-y-4">
                      <FormField control={form.control} name="calculation_verified" render={({ field }) => (
                        <FormItem className="flex items-center justify-between rounded-md border border-blue-200 bg-blue-50/50 p-4">
                          <div><FormLabel>Calculation Verified *</FormLabel><FormDescription>Required before submission to QA</FormDescription></div>
                          <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} disabled={readOnly || !canEdit} /></FormControl>
                        </FormItem>
                      )} />
                      <p className="text-sm text-muted-foreground">Upload raw data files in the Attachments tab (category: Raw Data or Chromatogram).</p>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="findings">
                  <Card>
                    <CardHeader><CardTitle className="text-base">Findings & Root Cause Analysis</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                      <FormField control={form.control} name="investigation_findings" render={({ field }) => (
                        <FormItem><FormLabel>Investigation Findings *</FormLabel><FormControl><Textarea rows={4} {...field} disabled={readOnly || !canEdit} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={form.control} name="root_cause_identified" render={({ field }) => (
                        <FormItem><FormLabel>Root Cause {autoRules.requireRootCause ? '*' : ''}</FormLabel><FormControl><Textarea rows={2} {...field} disabled={readOnly || !canEdit} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={form.control} name="corrective_action" render={({ field }) => (
                        <FormItem><FormLabel>Corrective Action {autoRules.requireCorrection ? '*' : ''}</FormLabel><FormControl><Textarea rows={2} {...field} value={field.value || ''} disabled={readOnly || !canEdit} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={form.control} name="phase1_conclusion" render={({ field }) => (
                        <FormItem><FormLabel>Phase-I Conclusion *</FormLabel><FormControl><Textarea rows={3} {...field} disabled={readOnly || !canEdit} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={form.control} name="phase1_outcome" render={({ field }) => (
                        <FormItem><FormLabel>Phase-I Outcome *</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value} disabled={readOnly || !canEdit}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Select outcome" /></SelectTrigger></FormControl>
                            <SelectContent>{PHASE1_OUTCOMES.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                          </Select><FormMessage /></FormItem>
                      )} />
                    </CardContent>
                  </Card>
                </TabsContent>
              </Form>

              <TabsContent value="qa">
                <Card>
                  <CardHeader><CardTitle className="text-base">QA Review</CardTitle><CardDescription>Phase-I cannot be completed without QA review and approval</CardDescription></CardHeader>
                  <CardContent className="space-y-4">
                    {phase1?.qa_review_comments && (
                      <div className="rounded-md border bg-muted/30 p-3 text-sm">
                        <p className="font-medium">Previous QA Comments</p>
                        <p className="mt-1">{phase1.qa_review_comments}</p>
                        {phase1.qa_reviewer_name && <p className="mt-2 text-xs text-muted-foreground">— {phase1.qa_reviewer_name} ({phase1.qa_reviewed_at?.slice(0, 10)})</p>}
                      </div>
                    )}
                    {phase1?.status === 'QA Review' && canApprove ? (
                      <Form {...qaForm}><form onSubmit={qaForm.handleSubmit((d) => void handleQaReview(d))} className="space-y-4">
                        <FormField control={qaForm.control} name="decision" render={({ field }) => (
                          <FormItem><FormLabel>Decision</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                              <SelectContent><SelectItem value="approved">Approve Phase-I</SelectItem><SelectItem value="rejected">Reject Phase-I</SelectItem></SelectContent>
                            </Select></FormItem>
                        )} />
                        <FormField control={qaForm.control} name="qa_review_comments" render={({ field }) => (
                          <FormItem><FormLabel>QA Review Comments *</FormLabel><FormControl><Textarea rows={3} {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <div className="flex gap-2">
                          <Button type="submit" disabled={busy} className="bg-green-600 hover:bg-green-700"><CheckCircle className="mr-1 h-4 w-4" /> Submit Review</Button>
                        </div>
                      </form></Form>
                    ) : phase1?.status === 'Completed' ? (
                      <p className="text-sm text-green-700">Phase-I completed and approved by QA.</p>
                    ) : phase1?.status === 'Rejected' ? (
                      <p className="text-sm text-red-700">Phase-I was rejected — QC must revise and resubmit.</p>
                    ) : (
                      <p className="text-sm text-muted-foreground">QA review is available after QC submits Phase-I investigation.</p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="attachments">
                <Card>
                  <CardHeader><CardTitle className="text-base">Attachments</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    {canEdit && !readOnly && (
                      <div className="flex flex-wrap gap-2">
                        {([
                          { label: 'Raw Data', cat: 'report' as const },
                          { label: 'Chromatogram', cat: 'chromatogram' as const },
                          { label: 'Other', cat: 'other' as const },
                        ]).map(({ label, cat }) => (
                          <div key={label}>
                            <Input
                              id={`upload-${cat}`}
                              type="file"
                              className="hidden"
                              onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleUpload(f, cat); e.target.value = ''; }}
                            />
                            <Button type="button" variant="outline" size="sm" onClick={() => document.getElementById(`upload-${cat}`)?.click()}>
                              Upload {label}
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                    {attachments.length ? (
                      <ul className="space-y-2">{attachments.map((a) => (
                        <li key={a.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                          <span>{a.file_name} <span className="text-muted-foreground">({a.category})</span></span>
                          {a.file_url ? <a href={a.file_url} target="_blank" rel="noreferrer" className="text-blue-600 text-xs">View</a> : null}
                        </li>
                      ))}</ul>
                    ) : <EmptyState title="No attachments" message="Upload raw data or chromatogram files." />}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="audit">
                <Card>
                  <CardHeader><CardTitle className="text-base">Audit Trail</CardTitle></CardHeader>
                  <CardContent>
                    {timeline.length ? (
                      <ul className="space-y-3">{timeline.map((e, i) => (
                        <li key={i} className="border-l-2 border-blue-200 pl-3 text-sm">
                          <p className="font-medium">{e.action}</p>
                          <p className="text-muted-foreground">{e.detail}</p>
                          <p className="text-xs text-muted-foreground">{e.user} · {e.at?.slice(0, 19).replace('T', ' ')}</p>
                        </li>
                      ))}</ul>
                    ) : <EmptyState title="No audit entries" message="Phase-I activities will appear here." />}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            {canEdit && phase1?.status !== 'Completed' && phase1?.status !== 'QA Review' && (
              <div className="flex flex-wrap gap-2 border-t pt-4">
                <Button variant="outline" onClick={() => void handleSaveDraft()} disabled={busy}>
                  {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />} Save Draft
                </Button>
                <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => void handleSubmitQa()} disabled={busy || phase1?.status === 'Not Started'}>
                  {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Send className="mr-1 h-4 w-4" />} Submit to QA
                </Button>
              </div>
            )}
          </>
        ) : null}
      </div>
    </OosPhase1AccessGuard>
  );
}
