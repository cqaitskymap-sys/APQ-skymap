'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  AlertTriangle, ArrowLeft, CheckCircle, Loader2, Save, Send, ShieldAlert,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/auth-context';
import {
  canApproveCriticalOosImpact,
  canEditOosImpactAssessment,
  canReviewOosImpactAssessment,
  computeOosImpactAutoRules,
  isOosImpactReadOnly,
  mapOosImpactAuditTimeline,
  OOS_IMPACT_CHECKLIST_FIELDS,
} from '@/lib/oos-impact-records';
import {
  fetchOosImpactPageData,
  logOosImpactPageViewed,
  mapOosImpactToFormInput,
  reviewOosImpactAssessment,
  saveOosImpactDraft,
  submitOosImpactAssessment,
} from '@/lib/oos-impact-service';
import {
  oosImpactObjectSchema,
  oosImpactQaReviewSchema,
  oosImpactSubmitSchema,
  type OosImpactInput,
  type OosImpactQaReviewInput,
} from '@/lib/oos-schemas';
import type { OosImpactAssessment, OosRecord } from '@/lib/oos-types';
import { CpvPageHeader } from '@/components/cpv/product-master/cpv-page-header';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { EmptyState } from '@/components/admin/dashboard/empty-state';
import { OosStatusBadge, ResultStatusBadge, RiskBadge } from '@/components/oos/oos-sub-nav';
import { OosImpactAccessGuard } from './oos-impact-access-guard';
import { OosImpactChecklistCard } from './oos-impact-checklist-card';
import { OosImpactStatusBadge } from './oos-impact-status-badge';
import { OosRiskCalculator } from './oos-risk-calculator';
import { ImpactedBatchTable } from './impacted-batch-table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export function OosImpactPage({ oosId }: { oosId: string }) {
  const { user, profile } = useAuth();
  const viewed = useRef(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [record, setRecord] = useState<OosRecord | null>(null);
  const [impact, setImpact] = useState<OosImpactAssessment | null>(null);
  const [auditLogs, setAuditLogs] = useState<Record<string, unknown>[]>([]);

  const actor = useMemo(() => ({
    id: user?.uid || 'system',
    name: profile?.full_name || profile?.email || 'User',
    role: profile?.role,
  }), [user?.uid, profile?.full_name, profile?.email, profile?.role]);

  const form = useForm<OosImpactInput>({
    resolver: zodResolver(oosImpactObjectSchema),
    defaultValues: {
      assessment_date: new Date().toISOString().split('T')[0],
      assessed_by_name: '',
      product_quality_impact: 'No',
      batch_impact: 'No',
      patient_safety_impact: 'No',
      regulatory_impact: 'No',
      market_impact: 'Not Applicable',
      stability_impact: 'Not Applicable',
      validation_impact: 'Not Applicable',
      other_batches_impacted: 'No',
      severity: 3,
      occurrence: 3,
      detection: 3,
      capa_required: false,
      deviation_required: false,
      recall_evaluation_required: false,
    },
  });

  const qaForm = useForm<OosImpactQaReviewInput>({
    resolver: zodResolver(oosImpactQaReviewSchema),
    defaultValues: { decision: 'approved', qa_comments: '' },
  });

  const watchAll = form.watch();
  const autoRules = useMemo(() => computeOosImpactAutoRules(watchAll, record), [watchAll, record]);
  const riskLevel = useMemo(() => {
    const s = (watchAll.severity || 1) * (watchAll.occurrence || 1) * (watchAll.detection || 1);
    if (s > 100) return 'Critical';
    if (s > 60) return 'High';
    if (s > 30) return 'Medium';
    return 'Low';
  }, [watchAll.severity, watchAll.occurrence, watchAll.detection]);

  const canEdit = canEditOosImpactAssessment(actor.role) && !isOosImpactReadOnly(actor.role);
  const canReview = canReviewOosImpactAssessment(actor.role);
  const canApprove = canApproveCriticalOosImpact(actor.role, riskLevel);
  const impactStatus = impact?.status || 'Draft';
  const readOnly = !canEdit || (['Approved', 'QA Review'].includes(impactStatus) && !canReview);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const data = await fetchOosImpactPageData(oosId);
    if (data.error || !data.record) {
      setError(data.error || 'OOS record not found');
      setLoading(false);
      return;
    }
    setRecord(data.record);
    setImpact(data.impact || null);
    setAuditLogs(data.auditLogs || []);
    form.reset(mapOosImpactToFormInput(data.impact || null, data.record, actor.name));
    setLoading(false);
    if (!viewed.current) {
      viewed.current = true;
      void logOosImpactPageViewed(oosId, actor, data.record.oos_number);
    }
  }, [oosId, form, actor]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (autoRules.capaRequired) form.setValue('capa_required', true);
    if (autoRules.recallEvaluationRequired) form.setValue('recall_evaluation_required', true);
    if (autoRules.deviationRecommended && !form.getValues('deviation_required')) {
      form.setValue('deviation_required', true);
    }
  }, [autoRules.capaRequired, autoRules.recallEvaluationRequired, autoRules.deviationRecommended, form]);

  const handleSaveDraft = async () => {
    setBusy(true);
    const { error: err } = await saveOosImpactDraft(oosId, form.getValues(), actor);
    setBusy(false);
    if (err) return toast.error(err);
    toast.success('Impact assessment draft saved');
    void load();
  };

  const handleSubmit = async () => {
    const values = form.getValues();
    const parsed = oosImpactSubmitSchema.safeParse(values);
    if (!parsed.success) {
      toast.error(parsed.error.errors[0]?.message || 'Validation failed');
      return;
    }
    setBusy(true);
    const { error: err } = await submitOosImpactAssessment(oosId, parsed.data, actor);
    setBusy(false);
    if (err) return toast.error(err);
    toast.success('Impact assessment submitted for QA review');
    void load();
  };

  const handleQaReview = async (data: OosImpactQaReviewInput) => {
    if (impact?.risk_level === 'Critical' && data.decision === 'approved' && !canApproveCriticalOosImpact(actor.role, 'Critical')) {
      return toast.error('Critical impact assessments require Head QA approval.');
    }
    setBusy(true);
    const { error: err } = await reviewOosImpactAssessment(oosId, data.decision, data.qa_comments, actor);
    setBusy(false);
    if (err) return toast.error(err);
    toast.success(data.decision === 'approved' ? 'Impact assessment approved' : 'Impact assessment rejected');
    void load();
  };

  const timeline = mapOosImpactAuditTimeline(auditLogs);
  const showActions = canEdit && impactStatus !== 'Approved' && impactStatus !== 'QA Review';

  return (
    <OosImpactAccessGuard record={record}>
      <div className="space-y-6">
        <CpvPageHeader
          title="OOS Impact Assessment"
          description={record ? `${record.oos_number} — ${record.test_name}` : 'Loading...'}
          trail={[
            { label: 'Dashboard', href: '/dashboard' },
            { label: 'QMS', href: '/qms/oos' },
            { label: 'OOS Management', href: '/qms/oos' },
            { label: 'Impact Assessment', href: '/qms/oos/impact-assessment' },
            { label: record?.oos_number || 'Assessment' },
          ]}
          actions={(
            <div className="flex flex-wrap gap-2">
              <Link href="/qms/oos/impact-assessment"><Button variant="outline" size="sm"><ArrowLeft className="mr-1 h-4 w-4" /> Queue</Button></Link>
              {record && <Link href={`/qms/oos/${oosId}`}><Button variant="outline" size="sm">OOS Record</Button></Link>}
            </div>
          )}
        />

        {loading ? <LoadingSkeleton rows={4} /> : error || !record ? (
          <ErrorCard title="Load error" message={error || 'Not found'} onRetry={() => void load()} />
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <OosStatusBadge status={record.status} />
              <OosImpactStatusBadge status={impactStatus} />
              <ResultStatusBadge status={record.result_status} />
              <RiskBadge level={impact?.risk_level || riskLevel} />
              {autoRules.capaRequired && <span className="rounded-md bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-800">CAPA Required</span>}
              {autoRules.recallEvaluationRequired && <span className="rounded-md bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">Recall Evaluation</span>}
            </div>

            {watchAll.patient_safety_impact === 'Yes' && (
              <Alert variant="destructive">
                <ShieldAlert className="h-4 w-4" />
                <AlertTitle>Patient Safety Impact</AlertTitle>
                <AlertDescription>Head QA will be notified immediately upon submission.</AlertDescription>
              </Alert>
            )}
            {watchAll.market_impact === 'Yes' && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Market Impact</AlertTitle>
                <AlertDescription>Recall evaluation is mandatory. Provide recall evaluation reason before submit.</AlertDescription>
              </Alert>
            )}
            {autoRules.warnings.filter((w) => !w.includes('Patient') && !w.includes('Market')).length > 0 && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>GMP Auto Rules</AlertTitle>
                <AlertDescription>
                  <ul className="mt-1 list-disc pl-4 text-sm">
                    {autoRules.warnings.filter((w) => !w.includes('Patient') && !w.includes('Market')).map((w) => <li key={w}>{w}</li>)}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            <Tabs defaultValue="checklist" className="space-y-4">
              <TabsList className="flex h-auto flex-wrap gap-1">
                {[
                  ['checklist', 'Impact Checklist'],
                  ['batch', 'Batch Impact'],
                  ['risk', 'Risk Calculator'],
                  ['recommendations', 'CAPA / Recall'],
                  ['qa', 'QA Review'],
                  ['audit', 'Audit Trail'],
                ].map(([value, label]) => (
                  <TabsTrigger key={value} value={value}>{label}</TabsTrigger>
                ))}
              </TabsList>

              <Form {...form}>
                <TabsContent value="checklist" className="space-y-4">
                  <Card>
                    <CardHeader><CardTitle className="text-base">Assessment Header</CardTitle></CardHeader>
                    <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 text-sm">
                      <div><span className="text-muted-foreground">OOS Number:</span> <span className="font-mono font-medium">{record.oos_number}</span></div>
                      <div><span className="text-muted-foreground">Product:</span> {record.product_name}</div>
                      <div><span className="text-muted-foreground">Batch:</span> {record.batch_number}</div>
                      <div><span className="text-muted-foreground">Test:</span> {record.test_name}</div>
                      <div><span className="text-muted-foreground">Parameter:</span> {record.parameter_name}</div>
                      <FormField control={form.control} name="assessment_date" render={({ field }) => (
                        <FormItem><FormLabel>Assessment Date *</FormLabel><FormControl><Input type="date" {...field} disabled={readOnly} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={form.control} name="assessed_by_name" render={({ field }) => (
                        <FormItem><FormLabel>Assessed By *</FormLabel><FormControl><Input {...field} disabled={readOnly} /></FormControl><FormMessage /></FormItem>
                      )} />
                    </CardContent>
                  </Card>

                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {OOS_IMPACT_CHECKLIST_FIELDS.map(({ key, label }) => (
                      <OosImpactChecklistCard
                        key={key}
                        label={label}
                        value={String(watchAll[key as keyof OosImpactInput] || 'Not Applicable')}
                        onValueChange={(v) => form.setValue(key as keyof OosImpactInput, v as never)}
                        disabled={readOnly}
                        highlight={key === 'patient_safety_impact' || key === 'market_impact' || key === 'product_quality_impact'}
                      />
                    ))}
                  </div>

                  <FormField control={form.control} name="impact_description" render={({ field }) => (
                    <FormItem>
                      <Card><CardHeader><CardTitle className="text-base">Impact Description</CardTitle></CardHeader>
                        <CardContent><FormControl><Textarea rows={4} {...field} disabled={readOnly} placeholder="Summarize overall OOS impact across all areas..." /></FormControl></CardContent>
                      </Card>
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="scientific_justification" render={({ field }) => (
                    <FormItem>
                      <Card><CardHeader><CardTitle className="text-base">Scientific Justification *</CardTitle><CardDescription>Required before submission to QA</CardDescription></CardHeader>
                        <CardContent><FormControl><Textarea rows={4} {...field} disabled={readOnly} placeholder="Provide scientific rationale for impact conclusions..." /></FormControl><FormMessage /></CardContent>
                      </Card>
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="conclusion" render={({ field }) => (
                    <FormItem>
                      <Card><CardHeader><CardTitle className="text-base">Impact Conclusion *</CardTitle></CardHeader>
                        <CardContent><FormControl><Textarea rows={3} {...field} disabled={readOnly} placeholder="Final impact assessment conclusion..." /></FormControl><FormMessage /></CardContent>
                      </Card>
                    </FormItem>
                  )} />
                </TabsContent>

                <TabsContent value="batch" className="space-y-4">
                  <FormField control={form.control} name="other_batches_impacted" render={({ field }) => (
                    <FormItem>
                      <Card><CardHeader><CardTitle className="text-base">Other Batches Impacted</CardTitle></CardHeader>
                        <CardContent>
                          <Select onValueChange={field.onChange} value={field.value} disabled={readOnly}>
                            <FormControl><SelectTrigger className="max-w-xs"><SelectValue /></SelectTrigger></FormControl>
                            <SelectContent><SelectItem value="No">No</SelectItem><SelectItem value="Yes">Yes</SelectItem></SelectContent>
                          </Select>
                        </CardContent>
                      </Card>
                    </FormItem>
                  )} />
                  {watchAll.other_batches_impacted === 'Yes' && (
                    <FormField control={form.control} name="impacted_batch_numbers" render={({ field }) => (
                      <FormItem>
                        <ImpactedBatchTable value={field.value || ''} onChange={field.onChange} disabled={readOnly} />
                        <FormMessage />
                      </FormItem>
                    )} />
                  )}
                </TabsContent>

                <TabsContent value="risk">
                  <OosRiskCalculator
                    severity={watchAll.severity || 3}
                    occurrence={watchAll.occurrence || 3}
                    detection={watchAll.detection || 3}
                    onChange={(field, value) => form.setValue(field, value)}
                    disabled={readOnly}
                  />
                </TabsContent>

                <TabsContent value="recommendations" className="space-y-4">
                  <Card>
                    <CardHeader><CardTitle className="text-base">CAPA & Deviation Recommendations</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                      <FormField control={form.control} name="capa_required" render={({ field }) => (
                        <FormItem className="flex items-center justify-between rounded-md border p-4">
                          <div><FormLabel>CAPA Required</FormLabel><FormDescription>Mandatory when product quality impact is Yes</FormDescription></div>
                          <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} disabled={readOnly || autoRules.capaRequired} /></FormControl>
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="deviation_required" render={({ field }) => (
                        <FormItem className="flex items-center justify-between rounded-md border p-4">
                          <div><FormLabel>Deviation Required</FormLabel><FormDescription>Recommended when batch or product quality impact identified</FormDescription></div>
                          <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} disabled={readOnly} /></FormControl>
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="recall_evaluation_required" render={({ field }) => (
                        <FormItem className="flex items-center justify-between rounded-md border p-4">
                          <div><FormLabel>Recall Evaluation Required</FormLabel><FormDescription>Auto-set when market impact is Yes</FormDescription></div>
                          <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} disabled={readOnly || autoRules.recallEvaluationRequired} /></FormControl>
                        </FormItem>
                      )} />
                      {(watchAll.market_impact === 'Yes' || watchAll.recall_evaluation_required) && (
                        <FormField control={form.control} name="recall_evaluation_reason" render={({ field }) => (
                          <FormItem><FormLabel>Recall Evaluation Reason *</FormLabel><FormControl><Textarea rows={3} {...field} disabled={readOnly} placeholder="Justify recall evaluation scope and urgency..." /></FormControl><FormMessage /></FormItem>
                        )} />
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              </Form>

              <TabsContent value="qa">
                <Card>
                  <CardHeader><CardTitle className="text-base">QA Review</CardTitle><CardDescription>QA approval required before impact assessment is finalized</CardDescription></CardHeader>
                  <CardContent className="space-y-4">
                    {impact?.qa_comments && (
                      <div className="rounded-md border bg-muted/30 p-3 text-sm">
                        <p className="font-medium">Previous QA Comments</p>
                        <p className="mt-1">{impact.qa_comments}</p>
                        {impact.qa_reviewer_name && <p className="mt-2 text-xs text-muted-foreground">— {impact.qa_reviewer_name} ({impact.qa_reviewed_at?.slice(0, 10)})</p>}
                      </div>
                    )}
                    {impactStatus === 'QA Review' && canReview ? (
                      <Form {...qaForm}><form onSubmit={qaForm.handleSubmit((d) => void handleQaReview(d))} className="space-y-4">
                        {!canApprove && riskLevel === 'Critical' && (
                          <Alert variant="destructive"><AlertDescription>Critical risk — only Head QA can approve this assessment.</AlertDescription></Alert>
                        )}
                        <FormField control={qaForm.control} name="decision" render={({ field }) => (
                          <FormItem><FormLabel>Decision</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                              <SelectContent><SelectItem value="approved">Approve</SelectItem><SelectItem value="rejected">Reject</SelectItem></SelectContent>
                            </Select></FormItem>
                        )} />
                        <FormField control={qaForm.control} name="qa_comments" render={({ field }) => (
                          <FormItem><FormLabel>QA Comments *</FormLabel><FormControl><Textarea rows={3} {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <Button type="submit" disabled={busy || !canApprove} className="bg-green-600 hover:bg-green-700"><CheckCircle className="mr-1 h-4 w-4" /> Submit Review</Button>
                      </form></Form>
                    ) : impactStatus === 'Approved' ? (
                      <p className="text-sm text-green-700">Impact assessment approved by QA.</p>
                    ) : impactStatus === 'Rejected' ? (
                      <p className="text-sm text-red-700">Impact assessment rejected — revise and resubmit.</p>
                    ) : (
                      <p className="text-sm text-muted-foreground">QA review is available after impact assessment is submitted.</p>
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
                    ) : <EmptyState title="No audit entries" message="Impact assessment activities will appear here." />}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            {showActions && (
              <div className="flex flex-wrap gap-2 border-t pt-4">
                <Button variant="outline" onClick={() => void handleSaveDraft()} disabled={busy}>
                  {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />} Save Draft
                </Button>
                <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => void handleSubmit()} disabled={busy}>
                  {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Send className="mr-1 h-4 w-4" />} Submit for QA Review
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </OosImpactAccessGuard>
  );
}
