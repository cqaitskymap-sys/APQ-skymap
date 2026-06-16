'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  AlertTriangle, ArrowLeft, Loader2, Save, Send, ShieldAlert,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/auth-context';
import {
  canApproveCriticalImpact,
  canEditImpactAssessment,
  canReviewImpactAssessment,
  computeImpactAutoRules,
  IMPACT_CHECKLIST_FIELDS,
} from '@/lib/deviation-impact-records';
import {
  fetchImpactAssessmentPageData,
  mapImpactToFormInput,
  reviewImpactAssessment,
  saveImpactAssessmentDraft,
  submitImpactAssessment,
} from '@/lib/deviation-impact-service';
import {
  impactAssessmentSchema,
  impactAssessmentSubmitSchema,
  impactQaReviewSchema,
  type ImpactAssessmentInput,
} from '@/lib/deviation-schemas';
import type { DeviationImpactAssessment, DeviationRecord } from '@/lib/deviation-types';
import { getAuditLogsForDeviation } from '@/lib/deviation-service';
import { CpvPageHeader } from '@/components/cpv/product-master/cpv-page-header';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { DeviationCriticalityBadge, DeviationStatusBadge } from '@/components/deviations/deviation-sub-nav';
import { DeviationImpactAccessGuard } from './deviation-impact-access-guard';
import { ImpactChecklistCard } from './impact-checklist-card';
import { ImpactStatusBadge } from './impact-status-badge';
import { RiskCalculator } from './risk-calculator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const DETAIL_MAP: Record<string, keyof ImpactAssessmentInput> = {
  batch_impact: 'batch_impact_details',
  product_quality_impact: 'product_quality_impact_details',
  patient_safety_impact: 'patient_safety_impact_details',
  regulatory_impact: 'regulatory_impact_details',
};

export function DeviationImpactPage({ deviationId }: { deviationId: string }) {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [record, setRecord] = useState<DeviationRecord | null>(null);
  const [impact, setImpact] = useState<DeviationImpactAssessment | null>(null);
  const [auditLogs, setAuditLogs] = useState<Record<string, unknown>[]>([]);

  const actor = useMemo(() => ({
    id: user?.uid || 'system',
    name: profile?.full_name || profile?.email || 'User',
    role: profile?.role,
    email: profile?.email,
  }), [user?.uid, profile?.full_name, profile?.email, profile?.role]);

  const form = useForm<ImpactAssessmentInput>({
    resolver: zodResolver(impactAssessmentSchema),
    defaultValues: {
      assessment_date: new Date().toISOString().split('T')[0],
      assessed_by_name: profile?.full_name || '',
      batch_impact: 'No',
      product_quality_impact: 'No',
      patient_safety_impact: 'No',
      regulatory_impact: 'No',
      stability_impact: 'Not Applicable',
      validation_impact: 'Not Applicable',
      equipment_impact: 'Not Applicable',
      utility_impact: 'Not Applicable',
      material_impact: 'Not Applicable',
      packaging_impact: 'Not Applicable',
      cleaning_impact: 'Not Applicable',
      documentation_impact: 'Not Applicable',
      training_impact: 'Not Applicable',
      market_impact: 'Not Applicable',
      other_batches_impacted: 'No',
      severity: 3,
      occurrence: 3,
      detection: 3,
      impact_summary: '',
    },
  });

  const qaForm = useForm<{ decision: 'approved' | 'rejected'; qa_comments: string }>({
    resolver: zodResolver(impactQaReviewSchema),
    defaultValues: { decision: 'approved', qa_comments: '' },
  });

  const watchAll = form.watch();
  const autoRules = useMemo(() => computeImpactAutoRules(watchAll, record || undefined), [watchAll, record]);
  const riskLevel = useMemo(() => {
    const s = (watchAll.severity || 1) * (watchAll.occurrence || 1) * (watchAll.detection || 1);
    if (s > 100) return 'Critical';
    if (s > 60) return 'High';
    if (s > 30) return 'Medium';
    return 'Low';
  }, [watchAll.severity, watchAll.occurrence, watchAll.detection]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const data = await fetchImpactAssessmentPageData(deviationId);
    if (data.error || !data.record) {
      setError(data.error || 'Deviation not found');
      setLoading(false);
      return;
    }
    setRecord(data.record);
    setImpact(data.impact || null);
    const logs = await getAuditLogsForDeviation(deviationId);
    setAuditLogs(logs);
    form.reset(mapImpactToFormInput(data.impact || null, data.record, actor.name));
    setLoading(false);
  }, [deviationId, form, actor.name]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (autoRules.capaRequired) form.setValue('capa_required', true);
    if (autoRules.recallEvaluationRequired) form.setValue('recall_evaluation_required', true);
  }, [autoRules.capaRequired, autoRules.recallEvaluationRequired, form]);

  const canEdit = record ? canEditImpactAssessment(profile?.role, record, actor.id) : false;
  const canReview = canReviewImpactAssessment(profile?.role);
  const canApprove = canApproveCriticalImpact(profile?.role, riskLevel);
  const impactStatus = impact?.status || 'Draft';
  const readOnly = !canEdit || ['Approved', 'Submitted'].includes(impactStatus) && !canReview;

  const handleSaveDraft = async () => {
    if (!record) return;
    const valid = await form.trigger();
    if (!valid) { toast.error('Fix validation errors before saving'); return; }
    setBusy(true);
    const { error: err } = await saveImpactAssessmentDraft(deviationId, form.getValues(), actor);
    setBusy(false);
    if (err) toast.error(err);
    else { toast.success('Impact assessment draft saved'); void load(); }
  };

  const handleSubmit = async () => {
    if (!record) return;
    const values = form.getValues();
    const parsed = impactAssessmentSubmitSchema.safeParse(values);
    if (!parsed.success) {
      toast.error(parsed.error.errors[0]?.message || 'Validation failed');
      return;
    }
    setBusy(true);
    const { error: err } = await submitImpactAssessment(deviationId, parsed.data, actor);
    setBusy(false);
    if (err) toast.error(err);
    else { toast.success('Impact assessment submitted for QA review'); void load(); }
  };

  const handleQaReview = async (decision: 'approved' | 'rejected') => {
    if (!record) return;
    const comments = qaForm.getValues('qa_comments');
    if (decision === 'rejected' && !comments.trim()) {
      toast.error('QA comments required for rejection');
      return;
    }
    setBusy(true);
    const { error: err } = await reviewImpactAssessment(deviationId, decision, comments, actor, record);
    setBusy(false);
    if (err) toast.error(err);
    else { toast.success(decision === 'approved' ? 'Impact assessment approved' : 'Impact assessment rejected'); void load(); }
  };

  if (loading) return <LoadingSkeleton rows={3} />;
  if (error || !record) return <ErrorCard title="Unable to load impact assessment" message={error || 'Not found'} onRetry={load} />;

  const showQaPanel = ['Submitted', 'QA Review'].includes(impactStatus) && canReview && canApprove;

  return (
    <DeviationImpactAccessGuard>
      <div className="space-y-6">
        <CpvPageHeader
          title="Deviation Impact Assessment"
          description={`${record.deviation_number} — GMP impact evaluation for batch, product, patient safety & regulatory compliance`}
          trail={[
            { label: 'QMS', href: '/qms/deviation' },
            { label: 'Deviation Management', href: '/qms/deviation' },
            { label: record.deviation_number, href: `/qms/deviation/${deviationId}` },
            { label: 'Impact Assessment' },
          ]}
          actions={(
            <>
              <Link href={`/qms/deviation/${deviationId}`}>
                <Button variant="outline" size="sm"><ArrowLeft className="mr-1 h-4 w-4" />Deviation Detail</Button>
              </Link>
              <Link href="/qms/deviation/impact-assessment">
                <Button variant="outline" size="sm">All Assessments</Button>
              </Link>
            </>
          )}
        />

        <div className="flex flex-wrap items-center gap-2">
          <DeviationStatusBadge status={record.status} />
          <DeviationCriticalityBadge criticality={record.criticality} />
          <ImpactStatusBadge status={impactStatus} />
          {impact?.risk_level && (
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${riskLevel === 'Critical' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}`}>
              Risk: {impact.risk_score} ({impact.risk_level})
            </span>
          )}
          {autoRules.capaRequired && <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs text-orange-800">CAPA Required</span>}
          {autoRules.recallEvaluationRequired && <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-800">Recall Evaluation</span>}
        </div>

        {watchAll.patient_safety_impact === 'Yes' && (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
            Patient safety impact identified — Head QA notification will be triggered on submit.
          </div>
        )}
        {watchAll.market_impact === 'Yes' && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            Market impact identified — recall evaluation is mandatory.
          </div>
        )}
        {autoRules.warnings.filter((w) => !w.includes('Patient') && !w.includes('Market')).map((w) => (
          <div key={w} className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{w}</div>
        ))}

        <Tabs defaultValue="assessment" className="space-y-4">
          <TabsList className="flex h-auto flex-wrap gap-1">
            {['assessment', 'batch', 'risk', 'capa', 'qa', 'audit'].map((t) => (
              <TabsTrigger key={t} value={t} className="capitalize">
                {t === 'batch' ? 'Batch Impact' : t === 'capa' ? 'CAPA / Recall' : t === 'qa' ? 'QA Review' : t === 'audit' ? 'Audit Trail' : 'Impact Checklist'}
              </TabsTrigger>
            ))}
          </TabsList>

          <Form {...form}>
            <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
              <TabsContent value="assessment" className="space-y-4">
                <Card>
                  <CardHeader><CardTitle className="text-base">Assessment Header</CardTitle></CardHeader>
                  <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <div><p className="text-xs text-muted-foreground">Deviation No</p><p className="font-mono font-medium">{record.deviation_number}</p></div>
                    <div><p className="text-xs text-muted-foreground">Product</p><p className="font-medium">{record.product_name || '—'}</p></div>
                    <div><p className="text-xs text-muted-foreground">Batch Number</p><p className="font-mono font-medium">{record.batch_number || '—'}</p></div>
                    <FormField control={form.control} name="assessment_date" render={({ field }) => (
                      <FormItem><FormLabel>Assessment Date *</FormLabel><FormControl><Input type="date" {...field} disabled={readOnly} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="assessed_by_name" render={({ field }) => (
                      <FormItem><FormLabel>Assessed By *</FormLabel><FormControl><Input {...field} disabled={readOnly} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="department" render={({ field }) => (
                      <FormItem><FormLabel>Department</FormLabel><FormControl><Input {...field} disabled={readOnly} /></FormControl></FormItem>
                    )} />
                  </CardContent>
                </Card>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {IMPACT_CHECKLIST_FIELDS.map(({ key, label }) => (
                    <ImpactChecklistCard
                      key={key}
                      label={label}
                      value={String(watchAll[key as keyof ImpactAssessmentInput] || 'Not Applicable')}
                      details={DETAIL_MAP[key] ? String(watchAll[DETAIL_MAP[key]] || '') : undefined}
                      onValueChange={(v) => form.setValue(key as keyof ImpactAssessmentInput, v as never)}
                      onDetailsChange={DETAIL_MAP[key] ? (v) => form.setValue(DETAIL_MAP[key], v) : undefined}
                      disabled={readOnly}
                      highlight={key === 'patient_safety_impact' || key === 'market_impact'}
                    />
                  ))}
                </div>

                <FormField control={form.control} name="impact_summary" render={({ field }) => (
                  <FormItem>
                    <Card><CardHeader><CardTitle className="text-base">Impact Description / Summary *</CardTitle></CardHeader>
                      <CardContent>
                        <FormControl><Textarea rows={4} {...field} disabled={readOnly} placeholder="Summarize overall deviation impact across all areas..." /></FormControl>
                        <FormMessage />
                      </CardContent>
                    </Card>
                  </FormItem>
                )} />

                <FormField control={form.control} name="conclusion" render={({ field }) => (
                  <FormItem>
                    <Card><CardHeader><CardTitle className="text-base">Conclusion</CardTitle>
                      <CardDescription>Required before submit</CardDescription></CardHeader>
                      <CardContent>
                        <FormControl><Textarea rows={3} {...field} disabled={readOnly} /></FormControl>
                        <FormMessage />
                      </CardContent>
                    </Card>
                  </FormItem>
                )} />
              </TabsContent>

              <TabsContent value="batch" className="space-y-4">
                <Card>
                  <CardHeader><CardTitle className="text-base">Batch Impact Table</CardTitle>
                    <CardDescription>Primary batch and other potentially impacted batches</CardDescription></CardHeader>
                  <CardContent className="space-y-4">
                    <div className="overflow-x-auto rounded-md border">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50"><tr>
                          <th className="px-3 py-2 text-left font-medium">Batch Number</th>
                          <th className="px-3 py-2 text-left font-medium">Product</th>
                          <th className="px-3 py-2 text-left font-medium">Impact Status</th>
                        </tr></thead>
                        <tbody>
                          <tr className="border-t">
                            <td className="px-3 py-2 font-mono">{record.batch_number || '—'}</td>
                            <td className="px-3 py-2">{record.product_name || '—'}</td>
                            <td className="px-3 py-2">{watchAll.batch_impact}</td>
                          </tr>
                          {watchAll.other_batches_impacted === 'Yes' && watchAll.impacted_batch_numbers?.split(/[,;\n]/).filter(Boolean).map((bn) => (
                            <tr key={bn.trim()} className="border-t">
                              <td className="px-3 py-2 font-mono">{bn.trim()}</td>
                              <td className="px-3 py-2">{record.product_name || '—'}</td>
                              <td className="px-3 py-2 text-amber-700">Impacted</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <FormField control={form.control} name="other_batches_impacted" render={({ field }) => (
                      <FormItem><FormLabel>Other Batches Impacted?</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange} disabled={readOnly}>
                          <FormControl><SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger></FormControl>
                          <SelectContent><SelectItem value="Yes">Yes</SelectItem><SelectItem value="No">No</SelectItem></SelectContent>
                        </Select></FormItem>
                    )} />
                    {watchAll.other_batches_impacted === 'Yes' && (
                      <FormField control={form.control} name="impacted_batch_numbers" render={({ field }) => (
                        <FormItem><FormLabel>Impacted Batch Numbers *</FormLabel>
                          <FormControl><Textarea rows={2} {...field} disabled={readOnly} placeholder="Comma or line-separated batch numbers" /></FormControl>
                          <FormMessage /></FormItem>
                      )} />
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="risk">
                <RiskCalculator
                  severity={watchAll.severity || 3}
                  occurrence={watchAll.occurrence || 3}
                  detection={watchAll.detection || 3}
                  disabled={readOnly}
                  onChange={(field, value) => form.setValue(field, value)}
                />
              </TabsContent>

              <TabsContent value="capa" className="space-y-4">
                <Card>
                  <CardHeader><CardTitle className="text-base">CAPA & Recall Evaluation</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    <FormField control={form.control} name="capa_required" render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-3">
                        <div><FormLabel>CAPA Required</FormLabel>
                          <p className="text-xs text-muted-foreground">Auto-set when product quality impact = Yes</p></div>
                        <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} disabled={readOnly || autoRules.capaRequired} /></FormControl>
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="capa_justification" render={({ field }) => (
                      <FormItem><FormLabel>CAPA Justification</FormLabel><FormControl><Textarea rows={2} {...field} disabled={readOnly} /></FormControl></FormItem>
                    )} />
                    <FormField control={form.control} name="recall_evaluation_required" render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50/50 p-3">
                        <div><FormLabel>Recall Evaluation Required</FormLabel>
                          <p className="text-xs text-muted-foreground">Auto-set when market impact = Yes</p></div>
                        <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} disabled={readOnly || autoRules.recallEvaluationRequired} /></FormControl>
                      </FormItem>
                    )} />
                  </CardContent>
                </Card>
              </TabsContent>
            </form>
          </Form>

          <TabsContent value="qa">
            {showQaPanel ? (
              <Card>
                <CardHeader><CardTitle className="text-base">QA Review</CardTitle>
                  <CardDescription>{riskLevel === 'Critical' ? 'Head QA approval required for critical risk' : 'QA review and approval'}</CardDescription></CardHeader>
                <CardContent className="space-y-4">
                  {impact?.qa_comments && <p className="text-sm text-muted-foreground">Previous: {impact.qa_comments}</p>}
                  <Form {...qaForm}>
                    <FormField control={qaForm.control} name="qa_comments" render={({ field }) => (
                      <FormItem><FormLabel>QA Comments *</FormLabel><FormControl><Textarea rows={3} {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                  </Form>
                  <div className="flex flex-wrap gap-2">
                    <Button className="bg-green-600 hover:bg-green-700" disabled={busy} onClick={() => handleQaReview('approved')}>
                      {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}Approve
                    </Button>
                    <Button variant="destructive" disabled={busy} onClick={() => handleQaReview('rejected')}>Reject</Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">
                QA review is available after impact assessment is submitted.
              </CardContent></Card>
            )}
          </TabsContent>

          <TabsContent value="audit">
            <Card><CardHeader><CardTitle className="text-base">Audit Trail</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {auditLogs.length ? auditLogs.slice(0, 20).map((log, i) => (
                  <div key={i} className="flex flex-col gap-0.5 border-b pb-2 text-sm last:border-0">
                    <div className="flex justify-between gap-2">
                      <span className="font-medium">{String(log.action || log.actionType || 'Action')}</span>
                      <span className="text-xs text-muted-foreground">{String(log.dateTime || log.created_at || '')}</span>
                    </div>
                    <p className="text-muted-foreground">{String(log.reason || log.actionDescription || '')}</p>
                    <p className="text-xs">{String(log.userName || log.user_name || '')}</p>
                  </div>
                )) : <p className="text-sm text-muted-foreground">No audit entries yet.</p>}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {canEdit && !['Approved'].includes(impactStatus) && (
          <div className="flex flex-wrap gap-2 border-t pt-4">
            <Button variant="outline" disabled={busy} onClick={handleSaveDraft}>
              {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}Save Draft
            </Button>
            <Button className="bg-blue-600 hover:bg-blue-700" disabled={busy || impactStatus === 'Submitted'} onClick={handleSubmit}>
              {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Send className="mr-1 h-4 w-4" />}Submit Impact Assessment
            </Button>
          </div>
        )}
      </div>
    </DeviationImpactAccessGuard>
  );
}
