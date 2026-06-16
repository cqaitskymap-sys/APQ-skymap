'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  AlertTriangle, ArrowLeft, CheckCircle, ExternalLink, Link2, Loader2, Plus, Save, Send,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/auth-context';
import {
  canApprovePhase2,
  canEditPhase2,
  computePhase2AutoRules,
  isPhase2ReadOnly,
  mapPhase2AuditTimeline,
} from '@/lib/oos-phase2-records';
import {
  createCapaDraftFromPhase2,
  fetchPhase2PageData,
  linkCapaToPhase2,
  logPhase2PageViewed,
  reviewPhase2,
  savePhase2Draft,
  startPhase2Investigation,
  submitPhase2ToQa,
} from '@/lib/oos-phase2-service';
import {
  phase2ObjectSchema,
  phase2QaReviewSchema,
  type Phase2Input,
  type Phase2QaReviewInput,
} from '@/lib/oos-schemas';
import { PHASE2_OUTCOMES } from '@/lib/oos-types';
import type { OosCapaLink, OosImpactAssessment, OosPhase1, OosPhase2, OosRecord } from '@/lib/oos-types';
import { CpvPageHeader } from '@/components/cpv/product-master/cpv-page-header';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { EmptyState } from '@/components/admin/dashboard/empty-state';
import { OosStatusBadge, ResultStatusBadge } from '@/components/oos/oos-sub-nav';
import { OosPhase2AccessGuard } from './oos-phase2-access-guard';
import { Phase2StatusBadge } from './phase2-status-badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

function mapPhase2ToForm(phase2: OosPhase2 | null, record: OosRecord): Phase2Input {
  return {
    assigned_investigator: phase2?.assigned_investigator || record.assigned_to_name || '',
    assigned_investigator_id: phase2?.assigned_investigator_id || record.assigned_to || undefined,
    manufacturing_review: phase2?.manufacturing_review || phase2?.process_review || '',
    batch_record_review: phase2?.batch_record_review || '',
    raw_material_review: phase2?.raw_material_review || '',
    packing_material_review: phase2?.packing_material_review || '',
    equipment_review: phase2?.equipment_review || '',
    cleaning_review: phase2?.cleaning_review || '',
    utility_review: phase2?.utility_review || '',
    environmental_review: phase2?.environmental_review || '',
    operator_review: phase2?.operator_review || '',
    process_parameter_review: phase2?.process_parameter_review || '',
    process_review: phase2?.process_review || '',
    deviation_review: phase2?.deviation_review || '',
    change_control_review: phase2?.change_control_review || '',
    previous_batch_trend_review: phase2?.previous_batch_trend_review || '',
    other_batch_impact_review: phase2?.other_batch_impact_review || '',
    other_batches_impacted_list: phase2?.other_batches_impacted_list || '',
    root_cause: phase2?.root_cause || '',
    contributing_factors: phase2?.contributing_factors || '',
    impact_assessment: phase2?.impact_assessment || '',
    product_quality_impact: (phase2?.product_quality_impact as Phase2Input['product_quality_impact']) || 'No',
    corrective_action: phase2?.corrective_action || '',
    preventive_action: phase2?.preventive_action || '',
    capa_required: phase2?.capa_required ?? false,
    linked_capa_number: phase2?.linked_capa_number || '',
    final_investigation_conclusion: phase2?.final_investigation_conclusion || phase2?.conclusion || '',
    conclusion: phase2?.conclusion || '',
    phase2_outcome: (phase2?.phase2_outcome as Phase2Input['phase2_outcome']) || undefined,
    qa_justification: phase2?.qa_justification || '',
  };
}

function ReviewField({
  form, name, label, rows = 3, disabled,
}: {
  form: ReturnType<typeof useForm<Phase2Input>>;
  name: keyof Phase2Input;
  label: string;
  rows?: number;
  disabled: boolean;
}) {
  return (
    <FormField control={form.control} name={name} render={({ field }) => (
      <FormItem>
        <FormLabel>{label}</FormLabel>
        <FormControl><Textarea rows={rows} {...field} value={String(field.value ?? '')} disabled={disabled} /></FormControl>
        <FormMessage />
      </FormItem>
    )} />
  );
}

export function OosPhase2Page({ oosId }: { oosId: string }) {
  const { user, profile } = useAuth();
  const viewed = useRef(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [record, setRecord] = useState<OosRecord | null>(null);
  const [phase1, setPhase1] = useState<OosPhase1 | null>(null);
  const [phase2, setPhase2] = useState<OosPhase2 | null>(null);
  const [impact, setImpact] = useState<OosImpactAssessment | null>(null);
  const [capa, setCapa] = useState<OosCapaLink | null>(null);
  const [auditLogs, setAuditLogs] = useState<Record<string, unknown>[]>([]);
  const [capaNumberInput, setCapaNumberInput] = useState('');

  const actor = useMemo(() => ({
    id: user?.uid || 'system',
    name: profile?.full_name || profile?.email || 'User',
    role: profile?.role,
  }), [user?.uid, profile?.full_name, profile?.email, profile?.role]);

  const canEdit = canEditPhase2(actor.role) && !isPhase2ReadOnly(actor.role);
  const canApprove = canApprovePhase2(actor.role, record);
  const readOnly = isPhase2ReadOnly(actor.role) || phase2?.status === 'Completed' || phase2?.status === 'CAPA Required';

  const form = useForm<Phase2Input>({
    resolver: zodResolver(phase2ObjectSchema),
    defaultValues: {
      assigned_investigator: '', manufacturing_review: '', batch_record_review: '',
      raw_material_review: '', equipment_review: '', environmental_review: '',
      operator_review: '', impact_assessment: '', final_investigation_conclusion: '',
      product_quality_impact: 'No', capa_required: false,
    },
  });

  const qaForm = useForm<Phase2QaReviewInput>({
    resolver: zodResolver(phase2QaReviewSchema),
    defaultValues: { decision: 'approved', qa_review_comments: '' },
  });

  const watchAll = form.watch();
  const autoRules = useMemo(() => computePhase2AutoRules(watchAll), [watchAll]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const data = await fetchPhase2PageData(oosId);
    if ('error' in data && data.error && !data.record) {
      setError(data.error);
      setLoading(false);
      return;
    }
    if (data.record) setRecord(data.record);
    if (data.phase1) setPhase1(data.phase1);
    setPhase2(data.phase2 || null);
    setImpact(data.impact || null);
    setCapa(data.capa || null);
    setAuditLogs(data.auditLogs || []);
    if (data.error) setError(data.error);
    else setError(null);
    if (data.record) form.reset(mapPhase2ToForm(data.phase2 || null, data.record));
    setCapaNumberInput(data.phase2?.linked_capa_number || data.capa?.capa_number || '');
    setLoading(false);
    if (!viewed.current && data.record) {
      viewed.current = true;
      void logPhase2PageViewed(oosId, actor, data.record.oos_number);
    }
  }, [oosId, actor, form]);

  useEffect(() => { void load(); }, [load]);

  const handleStart = async () => {
    setBusy(true);
    const { error: err } = await startPhase2Investigation(oosId, actor);
    setBusy(false);
    if (err) return toast.error(err);
    toast.success('Phase-II investigation started');
    void load();
  };

  const handleSaveDraft = async () => {
    setBusy(true);
    const { error: err } = await savePhase2Draft(oosId, form.getValues(), actor);
    setBusy(false);
    if (err) return toast.error(err);
    toast.success('Phase-II draft saved');
    void load();
  };

  const handleSubmitQa = async () => {
    const valid = await form.trigger();
    if (!valid) return toast.error('Fix validation errors before submitting to QA.');
    setBusy(true);
    const { error: err } = await submitPhase2ToQa(oosId, form.getValues(), actor);
    setBusy(false);
    if (err) return toast.error(err);
    toast.success('Phase-II submitted for QA review');
    void load();
  };

  const handleQaReview = async (data: Phase2QaReviewInput) => {
    setBusy(true);
    const { error: err } = await reviewPhase2(oosId, data, actor);
    setBusy(false);
    if (err) return toast.error(err);
    toast.success(data.decision === 'approved' ? 'Phase-II approved' : 'Phase-II rejected');
    void load();
  };

  const handleLinkCapa = async () => {
    if (!capaNumberInput.trim()) return toast.error('Enter a CAPA number to link.');
    setBusy(true);
    const { error: err } = await linkCapaToPhase2(oosId, capaNumberInput.trim(), actor);
    setBusy(false);
    if (err) return toast.error(err);
    toast.success('CAPA linked');
    void load();
  };

  const handleCreateCapaDraft = async () => {
    setBusy(true);
    const { capaNumber, error: err } = await createCapaDraftFromPhase2(oosId, actor);
    setBusy(false);
    if (err) return toast.error(err);
    toast.success(`CAPA draft created: ${capaNumber}`);
    void load();
  };

  const timeline = mapPhase2AuditTimeline(auditLogs);
  const formDisabled = readOnly || !canEdit || phase2?.status === 'QA Review';
  const showActions = canEdit && phase2?.status !== 'Completed' && phase2?.status !== 'CAPA Required' && phase2?.status !== 'QA Review';

  return (
    <OosPhase2AccessGuard record={record}>
      <div className="space-y-6">
        <CpvPageHeader
          title="Phase-II Manufacturing Investigation"
          description={record ? `${record.oos_number} — ${record.test_name}` : 'Loading...'}
          trail={[
            { label: 'Dashboard', href: '/dashboard' },
            { label: 'QMS', href: '/qms/oos' },
            { label: 'OOS Management', href: '/qms/oos' },
            { label: 'Phase-II', href: '/qms/oos/phase2' },
            { label: record?.oos_number || 'Investigation' },
          ]}
          actions={(
            <div className="flex flex-wrap gap-2">
              <Link href="/qms/oos/phase2"><Button variant="outline" size="sm"><ArrowLeft className="mr-1 h-4 w-4" /> Queue</Button></Link>
              {record && <Link href={`/qms/oos/${oosId}`}><Button variant="outline" size="sm">OOS Record</Button></Link>}
            </div>
          )}
        />

        {loading ? <LoadingSkeleton rows={4} /> : error && !record ? (
          <ErrorCard title="Load error" message={error} onRetry={() => void load()} />
        ) : record ? (
          <>
            {error && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Eligibility Notice</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="flex flex-wrap items-center gap-3">
              <OosStatusBadge status={record.status} />
              <Phase2StatusBadge status={phase2?.status} />
              {record.is_critical_test && <span className="rounded-md bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">Critical OOS</span>}
              {phase1?.phase1_outcome && <span className="text-xs text-muted-foreground">Phase-I: {phase1.phase1_outcome}</span>}
            </div>

            {(!phase2 || phase2.status === 'Not Started') && canEdit && !error && (
              <Card><CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                <p className="text-sm text-muted-foreground">Phase-II manufacturing investigation has not been started for this OOS record.</p>
                <Button onClick={() => void handleStart()} disabled={busy} className="bg-blue-600 hover:bg-blue-700">Start Phase-II</Button>
              </CardContent></Card>
            )}

            {autoRules.warnings.length > 0 && (
              <Alert variant={autoRules.capaMandatory ? 'destructive' : 'default'}>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>GMP Auto Rules</AlertTitle>
                <AlertDescription><ul className="mt-1 list-disc pl-4 text-sm">{autoRules.warnings.map((w) => <li key={w}>{w}</li>)}</ul></AlertDescription>
              </Alert>
            )}

            <Tabs defaultValue="overview" className="space-y-4">
              <TabsList className="flex h-auto flex-wrap gap-1">
                {[
                  ['overview', 'OOS Overview'],
                  ['manufacturing', 'Manufacturing Review'],
                  ['material', 'Material Review'],
                  ['equipment', 'Equipment & Utility Review'],
                  ['impact', 'Impact Assessment'],
                  ['capa', 'CAPA Link'],
                  ['qa', 'QA Review'],
                  ['audit', 'Audit Trail'],
                ].map(([value, label]) => (
                  <TabsTrigger key={value} value={value}>{label}</TabsTrigger>
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
                    <div><span className="text-muted-foreground">Phase-II ID:</span> {phase2?.phase2_id || phase2?.id || '—'}</div>
                    <div><span className="text-muted-foreground">Investigation Start:</span> {phase2?.investigation_start_date || phase2?.started_at?.slice(0, 10) || '—'}</div>
                    <div><span className="text-muted-foreground">Due Date:</span> {phase2?.investigation_due_date || record.target_closure_date || '—'}</div>
                    <div><span className="text-muted-foreground">Assigned Investigator:</span> {phase2?.assigned_investigator || record.assigned_to_name || '—'}</div>
                    <div><span className="text-muted-foreground">Phase-I Outcome:</span> {phase1?.phase1_outcome || '—'}</div>
                    <div><span className="text-muted-foreground">Phase-II Outcome:</span> {phase2?.phase2_outcome || '—'}</div>
                    {phase2?.capa_required && <div className="sm:col-span-2 text-red-700">CAPA required for this investigation</div>}
                  </CardContent>
                </Card>
              </TabsContent>

              <Form {...form}>
                <TabsContent value="manufacturing">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Manufacturing Review</CardTitle>
                      <CardDescription>Production review of batch records, process parameters, and linked deviations/change controls</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <FormField control={form.control} name="assigned_investigator" render={({ field }) => (
                        <FormItem><FormLabel>Assigned Investigator *</FormLabel><FormControl><Input {...field} disabled={formDisabled} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <ReviewField form={form} name="manufacturing_review" label="Manufacturing Review *" disabled={formDisabled} />
                      <ReviewField form={form} name="batch_record_review" label="Batch Record Review *" disabled={formDisabled} />
                      <ReviewField form={form} name="operator_review" label="Operator Review *" disabled={formDisabled} />
                      <ReviewField form={form} name="process_parameter_review" label="Process Parameter Review" disabled={formDisabled} />
                      <ReviewField form={form} name="previous_batch_trend_review" label="Previous Batch Trend Review" disabled={formDisabled} />
                      <ReviewField form={form} name="deviation_review" label="Deviation Review" disabled={formDisabled} />
                      <ReviewField form={form} name="change_control_review" label="Change Control Review" disabled={formDisabled} />
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="material">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Material Review</CardTitle>
                      <CardDescription>Raw and packing material review (Warehouse / QC support)</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <ReviewField form={form} name="raw_material_review" label="Raw Material Review *" disabled={formDisabled} />
                      <ReviewField form={form} name="packing_material_review" label="Packing Material Review" disabled={formDisabled} />
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="equipment">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Equipment & Utility Review</CardTitle>
                      <CardDescription>Engineering review of equipment, cleaning, utilities, and environmental monitoring</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <ReviewField form={form} name="equipment_review" label="Equipment Review *" disabled={formDisabled} />
                      <ReviewField form={form} name="cleaning_review" label="Cleaning Review" disabled={formDisabled} />
                      <ReviewField form={form} name="utility_review" label="Utility Review" disabled={formDisabled} />
                      <ReviewField form={form} name="environmental_review" label="Environmental Review *" disabled={formDisabled} />
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="impact">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Impact Assessment & Root Cause</CardTitle>
                      <CardDescription>Document impact, root cause analysis, and investigation conclusion</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <FormField control={form.control} name="product_quality_impact" render={({ field }) => (
                        <FormItem><FormLabel>Product Quality Impact</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value} disabled={formDisabled}>
                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                            <SelectContent>{['Yes', 'No', 'Unknown'].map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
                          </Select>
                          {field.value === 'Yes' && <FormDescription className="text-red-600">CAPA is mandatory when product quality impact is Yes.</FormDescription>}
                        </FormItem>
                      )} />
                      <ReviewField form={form} name="impact_assessment" label="Impact Assessment *" rows={4} disabled={formDisabled} />
                      <ReviewField form={form} name="other_batch_impact_review" label="Other Batch Impact Review" disabled={formDisabled} />
                      <ReviewField form={form} name="other_batches_impacted_list" label="Impacted Batch List" disabled={formDisabled} />
                      <ReviewField form={form} name="root_cause" label={`Root Cause ${watchAll.phase2_outcome !== 'No Assignable Cause' ? '*' : ''}`} disabled={formDisabled} />
                      <ReviewField form={form} name="contributing_factors" label="Contributing Factors" disabled={formDisabled} />
                      {watchAll.phase2_outcome === 'No Assignable Cause' && (
                        <ReviewField form={form} name="qa_justification" label="QA Justification (No Assignable Cause) *" disabled={formDisabled} />
                      )}
                      <ReviewField form={form} name="corrective_action" label="Corrective Action" disabled={formDisabled} />
                      <ReviewField form={form} name="preventive_action" label="Preventive Action" disabled={formDisabled} />
                      <ReviewField form={form} name="final_investigation_conclusion" label="Final Investigation Conclusion *" rows={4} disabled={formDisabled} />
                      <FormField control={form.control} name="phase2_outcome" render={({ field }) => (
                        <FormItem><FormLabel>Phase-II Outcome *</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value} disabled={formDisabled}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Select outcome" /></SelectTrigger></FormControl>
                            <SelectContent>{PHASE2_OUTCOMES.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                          </Select><FormMessage /></FormItem>
                      )} />
                      <FormField control={form.control} name="capa_required" render={({ field }) => (
                        <FormItem className="flex items-center justify-between rounded-md border p-4">
                          <div><FormLabel>CAPA Required</FormLabel><FormDescription>Auto-recommended when root cause is identified</FormDescription></div>
                          <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} disabled={formDisabled || autoRules.capaMandatory} /></FormControl>
                        </FormItem>
                      )} />
                      {impact && (
                        <div className="rounded-md border bg-muted/30 p-3 text-sm">
                          <p className="font-medium">Linked Impact Assessment</p>
                          <p className="mt-1 text-muted-foreground">{impact.product_impact}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              </Form>

              <TabsContent value="capa">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">CAPA Link</CardTitle>
                    <CardDescription>Link existing CAPA or create a CAPA draft from this investigation</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {capa && (
                      <div className="rounded-md border bg-green-50/50 p-3 text-sm">
                        <p className="font-medium">Linked CAPA: {capa.capa_number}</p>
                        <p className="text-muted-foreground">Status: {capa.capa_status}</p>
                      </div>
                    )}
                    {phase2?.linked_capa_number && !capa && (
                      <p className="text-sm">Linked CAPA Number: <span className="font-mono">{phase2.linked_capa_number}</span></p>
                    )}
                    {canEdit && !readOnly && (
                      <div className="flex flex-wrap gap-2">
                        <Input
                          placeholder="CAPA Number"
                          value={capaNumberInput}
                          onChange={(e) => setCapaNumberInput(e.target.value)}
                          className="max-w-xs"
                        />
                        <Button variant="outline" onClick={() => void handleLinkCapa()} disabled={busy}>
                          <Link2 className="mr-1 h-4 w-4" /> Link CAPA
                        </Button>
                        <Button variant="outline" onClick={() => void handleCreateCapaDraft()} disabled={busy}>
                          <Plus className="mr-1 h-4 w-4" /> Create CAPA Draft
                        </Button>
                      </div>
                    )}
                    <div className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
                      Attachment upload placeholder — supporting documents can be attached from the OOS record Attachments tab.
                      {record && (
                        <div className="mt-2">
                          <Link href={`/qms/oos/${oosId}`} className="inline-flex items-center text-blue-600 hover:underline">
                            Open OOS Record <ExternalLink className="ml-1 h-3.5 w-3.5" />
                          </Link>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="qa">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">QA Review</CardTitle>
                    <CardDescription>Phase-II cannot complete without QA review and approval</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {phase2?.qa_review_comments && (
                      <div className="rounded-md border bg-muted/30 p-3 text-sm">
                        <p className="font-medium">Previous QA Comments</p>
                        <p className="mt-1">{phase2.qa_review_comments}</p>
                        {phase2.qa_reviewer_name && <p className="mt-2 text-xs text-muted-foreground">— {phase2.qa_reviewer_name} ({phase2.qa_reviewed_at?.slice(0, 10)})</p>}
                      </div>
                    )}
                    {phase2?.status === 'QA Review' && canApprove ? (
                      <Form {...qaForm}><form onSubmit={qaForm.handleSubmit((d) => void handleQaReview(d))} className="space-y-4">
                        <FormField control={qaForm.control} name="decision" render={({ field }) => (
                          <FormItem><FormLabel>Decision</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                              <SelectContent><SelectItem value="approved">Approve Phase-II</SelectItem><SelectItem value="rejected">Reject Phase-II</SelectItem></SelectContent>
                            </Select></FormItem>
                        )} />
                        <FormField control={qaForm.control} name="qa_review_comments" render={({ field }) => (
                          <FormItem><FormLabel>QA Review Comments *</FormLabel><FormControl><Textarea rows={3} {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <Button type="submit" disabled={busy} className="bg-green-600 hover:bg-green-700"><CheckCircle className="mr-1 h-4 w-4" /> Submit Review</Button>
                      </form></Form>
                    ) : phase2?.status === 'Completed' ? (
                      <p className="text-sm text-green-700">Phase-II completed and approved by QA.</p>
                    ) : phase2?.status === 'CAPA Required' ? (
                      <p className="text-sm text-amber-700">Phase-II approved — CAPA action required before closure.</p>
                    ) : phase2?.status === 'Rejected' ? (
                      <p className="text-sm text-red-700">Phase-II was rejected — investigation team must revise and resubmit.</p>
                    ) : (
                      <p className="text-sm text-muted-foreground">QA review is available after the investigation team submits Phase-II.</p>
                    )}
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
                    ) : <EmptyState title="No audit entries" message="Phase-II activities will appear here." />}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            {showActions && (
              <div className="flex flex-wrap gap-2 border-t pt-4">
                <Button variant="outline" onClick={() => void handleSaveDraft()} disabled={busy}>
                  {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />} Save Draft
                </Button>
                <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => void handleSubmitQa()} disabled={busy || !phase2 || phase2.status === 'Not Started'}>
                  {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Send className="mr-1 h-4 w-4" />} Submit to QA
                </Button>
              </div>
            )}
          </>
        ) : null}
      </div>
    </OosPhase2AccessGuard>
  );
}
