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
  canApproveCriticalComplaintImpact,
  canEditComplaintImpactAssessment,
  canReviewComplaintImpactAssessment,
  computeComplaintImpactAutoRules,
  isComplaintImpactReadOnly,
  mapComplaintImpactAuditTimeline,
  COMPLAINT_IMPACT_CHECKLIST_FIELDS,
} from '@/lib/complaint-impact-records';
import {
  fetchComplaintImpactPageData,
  logComplaintImpactPageViewed,
  mapComplaintImpactToFormInput,
  reviewComplaintImpactAssessment,
  saveComplaintImpactDraft,
  submitComplaintImpactAssessment,
} from '@/lib/complaint-impact-service';
import {
  complaintImpactObjectSchema,
  complaintImpactQaReviewSchema,
  complaintImpactSubmitSchema,
  type ComplaintImpactInput,
  type ComplaintImpactQaReviewInput,
} from '@/lib/complaint-impact-schemas';
import type { ComplaintImpactAssessment, ComplaintRecord } from '@/lib/complaint-types';
import { CpvPageHeader } from '@/components/cpv/product-master/cpv-page-header';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { EmptyState } from '@/components/admin/dashboard/empty-state';
import { ComplaintStatusBadge, CriticalityBadge, RiskBadge } from '@/components/complaints/complaint-sub-nav';
import { ComplaintImpactAccessGuard } from './complaint-impact-access-guard';
import { ComplaintImpactChecklistCard } from './complaint-impact-checklist-card';
import { ComplaintImpactStatusBadge } from './complaint-impact-status-badge';
import { ComplaintRiskCalculator } from './complaint-risk-calculator';
import { ComplaintImpactedBatchTable } from './complaint-impacted-batch-table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export function ComplaintImpactPage({ complaintId }: { complaintId: string }) {
  const { user, profile } = useAuth();
  const viewed = useRef(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [record, setRecord] = useState<ComplaintRecord | null>(null);
  const [impact, setImpact] = useState<ComplaintImpactAssessment | null>(null);
  const [auditLogs, setAuditLogs] = useState<Record<string, unknown>[]>([]);

  const actor = useMemo(() => ({
    id: user?.uid || 'system',
    name: profile?.full_name || profile?.email || 'User',
    role: profile?.role,
  }), [user?.uid, profile?.full_name, profile?.email, profile?.role]);

  const form = useForm<ComplaintImpactInput>({
    resolver: zodResolver(complaintImpactObjectSchema),
    defaultValues: {
      assessment_date: new Date().toISOString().split('T')[0],
      assessed_by_name: '',
      product_quality_impact: 'No',
      patient_safety_impact: 'No',
      regulatory_impact: 'No',
      market_impact: 'Not Applicable',
      batch_impact: 'No',
      distribution_impact: 'Not Applicable',
      distribution_notes: '',
      other_batches_impacted: 'No',
      severity: 3,
      occurrence: 3,
      detection: 3,
      capa_required: false,
      recall_evaluation_required: false,
    },
  });

  const qaForm = useForm<ComplaintImpactQaReviewInput>({
    resolver: zodResolver(complaintImpactQaReviewSchema),
    defaultValues: { decision: 'approved', qa_comments: '' },
  });

  const watchAll = form.watch();
  const autoRules = useMemo(() => computeComplaintImpactAutoRules(watchAll, record), [watchAll, record]);
  const riskLevel = useMemo(() => {
    const s = (watchAll.severity || 1) * (watchAll.occurrence || 1) * (watchAll.detection || 1);
    if (s > 100) return 'Critical';
    if (s > 60) return 'High';
    if (s > 30) return 'Medium';
    return 'Low';
  }, [watchAll.severity, watchAll.occurrence, watchAll.detection]);

  const canEdit = canEditComplaintImpactAssessment(actor.role) && !isComplaintImpactReadOnly(actor.role);
  const canReview = canReviewComplaintImpactAssessment(actor.role);
  const canApprove = canApproveCriticalComplaintImpact(actor.role, riskLevel);
  const impactStatus = impact?.status || 'Draft';
  const readOnly = !canEdit || (['Approved', 'QA Review'].includes(impactStatus) && !canReview);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const data = await fetchComplaintImpactPageData(complaintId);
    if (data.error || !data.record) {
      setError(data.error || 'Complaint not found');
      setLoading(false);
      return;
    }
    setRecord(data.record);
    setImpact(data.impact || null);
    setAuditLogs(data.auditLogs || []);
    form.reset(mapComplaintImpactToFormInput(data.impact || null, data.record, actor.name));
    setLoading(false);
    if (!viewed.current) {
      viewed.current = true;
      void logComplaintImpactPageViewed(complaintId, actor, data.record.complaint_number);
    }
  }, [complaintId, form, actor]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (autoRules.capaRequired) form.setValue('capa_required', true);
    if (autoRules.recallEvaluationRequired) form.setValue('recall_evaluation_required', true);
  }, [autoRules.capaRequired, autoRules.recallEvaluationRequired, form]);

  const handleSaveDraft = async () => {
    setBusy(true);
    const { error: err } = await saveComplaintImpactDraft(complaintId, form.getValues(), actor);
    setBusy(false);
    if (err) return toast.error(err);
    toast.success('Impact assessment draft saved');
    void load();
  };

  const handleSubmit = async () => {
    const values = form.getValues();
    const parsed = complaintImpactSubmitSchema.safeParse(values);
    if (!parsed.success) {
      toast.error(parsed.error.errors[0]?.message || 'Validation failed');
      return;
    }
    setBusy(true);
    const { error: err } = await submitComplaintImpactAssessment(complaintId, parsed.data, actor);
    setBusy(false);
    if (err) return toast.error(err);
    toast.success('Impact assessment submitted for QA review');
    void load();
  };

  const handleQaReview = async (data: ComplaintImpactQaReviewInput) => {
    if (impact?.risk_level === 'Critical' && data.decision === 'approved' && !canApproveCriticalComplaintImpact(actor.role, 'Critical')) {
      return toast.error('Critical impact assessments require Head QA approval.');
    }
    setBusy(true);
    const { error: err } = await reviewComplaintImpactAssessment(complaintId, data.decision, data.qa_comments, actor);
    setBusy(false);
    if (err) return toast.error(err);
    toast.success(data.decision === 'approved' ? 'Impact assessment approved' : 'Impact assessment rejected');
    void load();
  };

  const timeline = mapComplaintImpactAuditTimeline(auditLogs);
  const showActions = canEdit && impactStatus !== 'Approved' && impactStatus !== 'QA Review';

  return (
    <ComplaintImpactAccessGuard>
      <div className="space-y-6">
        <CpvPageHeader
          title="Complaint Impact Assessment"
          description={record ? `${record.complaint_number} — ${record.product_name}` : 'Loading...'}
          trail={[
            { label: 'Dashboard', href: '/dashboard' },
            { label: 'QMS', href: '/qms/complaints' },
            { label: 'Complaint Management', href: '/qms/complaints' },
            { label: 'Impact Assessment', href: '/qms/complaints/impact-assessment' },
            { label: record?.complaint_number || 'Assessment' },
          ]}
          actions={(
            <div className="flex flex-wrap gap-2">
              <Link href="/qms/complaints/impact-assessment"><Button variant="outline" size="sm"><ArrowLeft className="mr-1 h-4 w-4" /> Queue</Button></Link>
              {record && <Link href={`/qms/complaints/${complaintId}`}><Button variant="outline" size="sm">Complaint Record</Button></Link>}
            </div>
          )}
        />

        {loading ? <LoadingSkeleton rows={4} /> : error || !record ? (
          <ErrorCard title="Load error" message={error || 'Not found'} onRetry={() => void load()} />
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <ComplaintStatusBadge status={record.status} />
              <ComplaintImpactStatusBadge status={impactStatus} />
              <CriticalityBadge value={record.complaint_criticality} />
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
            {watchAll.regulatory_impact === 'Yes' && (
              <Alert variant="destructive">
                <ShieldAlert className="h-4 w-4" />
                <AlertTitle>Regulatory Impact</AlertTitle>
                <AlertDescription>Regulatory Affairs will be notified upon submission.</AlertDescription>
              </Alert>
            )}
            {watchAll.market_impact === 'Yes' && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Market Impact</AlertTitle>
                <AlertDescription>Recall evaluation is mandatory. Provide recall evaluation reason before submit.</AlertDescription>
              </Alert>
            )}
            {autoRules.warnings.filter((w) => !w.includes('Patient') && !w.includes('Market') && !w.includes('Regulatory')).length > 0 && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>GMP Auto Rules</AlertTitle>
                <AlertDescription>
                  <ul className="mt-1 list-disc pl-4 text-sm">
                    {autoRules.warnings.filter((w) => !w.includes('Patient') && !w.includes('Market') && !w.includes('Regulatory')).map((w) => <li key={w}>{w}</li>)}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            <Tabs defaultValue="checklist" className="space-y-4">
              <TabsList className="flex h-auto flex-wrap gap-1">
                {[
                  ['checklist', 'Impact Checklist'],
                  ['batch', 'Batch Impact'],
                  ['distribution', 'Distribution'],
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
                      <div><span className="text-muted-foreground">Complaint No:</span> <span className="font-mono font-medium">{record.complaint_number}</span></div>
                      <div><span className="text-muted-foreground">Product:</span> {record.product_name}</div>
                      <div><span className="text-muted-foreground">Batch:</span> {record.batch_number}</div>
                      <div><span className="text-muted-foreground">Category:</span> {record.complaint_category}</div>
                      <div><span className="text-muted-foreground">Customer:</span> {record.customer_name}</div>
                      <FormField control={form.control} name="assessment_date" render={({ field }) => (
                        <FormItem><FormLabel>Assessment Date *</FormLabel><FormControl><Input type="date" {...field} disabled={readOnly} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={form.control} name="assessed_by_name" render={({ field }) => (
                        <FormItem><FormLabel>Assessed By *</FormLabel><FormControl><Input {...field} disabled={readOnly} /></FormControl><FormMessage /></FormItem>
                      )} />
                    </CardContent>
                  </Card>

                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {COMPLAINT_IMPACT_CHECKLIST_FIELDS.map(({ key, label }) => (
                      <ComplaintImpactChecklistCard
                        key={key}
                        label={label}
                        value={String(watchAll[key as keyof ComplaintImpactInput] || 'Not Applicable')}
                        onValueChange={(v) => form.setValue(key as keyof ComplaintImpactInput, v as never)}
                        disabled={readOnly}
                        highlight={['patient_safety_impact', 'regulatory_impact', 'market_impact', 'product_quality_impact'].includes(key)}
                      />
                    ))}
                  </div>

                  <FormField control={form.control} name="impact_description" render={({ field }) => (
                    <FormItem>
                      <Card><CardHeader><CardTitle className="text-base">Impact Description</CardTitle></CardHeader>
                        <CardContent><FormControl><Textarea rows={4} {...field} disabled={readOnly} placeholder="Summarize overall complaint impact across all areas..." /></FormControl></CardContent>
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
                        <ComplaintImpactedBatchTable value={field.value || ''} onChange={field.onChange} disabled={readOnly} />
                        <FormMessage />
                      </FormItem>
                    )} />
                  )}
                </TabsContent>

                <TabsContent value="distribution" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Distribution Impact</CardTitle>
                      <CardDescription>Warehouse and distribution chain impact assessment</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <ComplaintImpactChecklistCard
                        label="Distribution Impact"
                        value={watchAll.distribution_impact || 'Not Applicable'}
                        onValueChange={(v) => form.setValue('distribution_impact', v)}
                        disabled={readOnly}
                        highlight={watchAll.distribution_impact === 'Yes'}
                      />
                      <FormField control={form.control} name="distribution_notes" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Distribution Notes</FormLabel>
                          <FormControl><Textarea rows={4} {...field} disabled={readOnly} placeholder="Shipment records, warehouse locations, distribution channels affected..." /></FormControl>
                        </FormItem>
                      )} />
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="risk">
                  <ComplaintRiskCalculator
                    severity={watchAll.severity || 3}
                    occurrence={watchAll.occurrence || 3}
                    detection={watchAll.detection || 3}
                    onChange={(field, value) => form.setValue(field, value)}
                    disabled={readOnly}
                  />
                </TabsContent>

                <TabsContent value="recommendations" className="space-y-4">
                  <Card>
                    <CardHeader><CardTitle className="text-base">CAPA & Recall Recommendations</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                      <FormField control={form.control} name="capa_required" render={({ field }) => (
                        <FormItem className="flex items-center justify-between rounded-md border p-4">
                          <div><FormLabel>CAPA Required</FormLabel><FormDescription>Mandatory when product quality impact is Yes</FormDescription></div>
                          <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} disabled={readOnly || autoRules.capaRequired} /></FormControl>
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
    </ComplaintImpactAccessGuard>
  );
}
