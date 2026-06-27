'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, CheckCircle2, Loader2, Save, Send } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/auth-context';
import {
  canApproveCcImpact,
  canManageCcImpact,
  computeOverallImpactRating,
  generateImpactRecommendations,
  isCcImpactReadOnly,
  isImpactYes,
} from '@/lib/cc-impact-records';
import { ccImpactFormSchema, ccImpactQaReviewSchema, type CcImpactFormInput } from '@/lib/cc-impact-schemas';
import {
  fetchCcImpactPageData,
  saveCcImpactDraft,
  submitCcImpactForReview,
  submitCcImpactQaReview,
} from '@/lib/cc-impact-service';
import {
  CC_DEPARTMENTS,
  CC_IMPACT_LIKELIHOODS,
  CC_IMPACT_OPTIONS,
  CC_IMPACT_RATINGS,
  CC_IMPACT_SEVERITIES,
  type ChangeControlRecord,
  type ChangeImpactAssessment,
} from '@/lib/change-control-types';
import { CpvPageHeader } from '@/components/cpv/product-master/cpv-page-header';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { CcStatusBadge } from '@/components/change-control/cc-sub-nav';
import { CcImpactAccessGuard } from './cc-impact-access-guard';
import { CcImpactOptionBadge, CcImpactRatingBadge, CcImpactStatusBadge } from './cc-impact-badges';
import { CcImpactMatrix } from './cc-impact-matrix';
import { CcImpactTimeline } from './cc-impact-timeline';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const IMPACT_FIELDS: { key: keyof CcImpactFormInput; label: string; tab: string }[] = [
  { key: 'product_impact', label: 'Product Impact', tab: 'quality' },
  { key: 'quality_impact', label: 'Quality Impact', tab: 'quality' },
  { key: 'patient_safety_impact', label: 'Patient Safety Impact', tab: 'quality' },
  { key: 'stability_impact', label: 'Stability Impact', tab: 'quality' },
  { key: 'process_impact', label: 'Process Impact', tab: 'quality' },
  { key: 'validation_impact', label: 'Validation Impact', tab: 'validation' },
  { key: 'csv_impact', label: 'CSV Impact', tab: 'csv' },
  { key: 'data_integrity_impact', label: 'Data Integrity Impact', tab: 'csv' },
  { key: 'regulatory_impact', label: 'Regulatory Impact', tab: 'regulatory' },
  { key: 'market_impact', label: 'Market Impact', tab: 'regulatory' },
  { key: 'training_impact', label: 'Training Impact', tab: 'training' },
  { key: 'document_impact', label: 'Document Impact', tab: 'training' },
  { key: 'equipment_impact', label: 'Equipment Impact', tab: 'overview' },
  { key: 'utility_impact', label: 'Utility Impact', tab: 'overview' },
  { key: 'facility_impact', label: 'Facility Impact', tab: 'overview' },
  { key: 'business_impact', label: 'Business Impact', tab: 'overview' },
  { key: 'supplier_impact', label: 'Supplier Impact', tab: 'overview' },
  { key: 'environmental_impact', label: 'Environmental Impact', tab: 'overview' },
];

export function CcImpactPage({ changeId }: { changeId: string }) {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [change, setChange] = useState<ChangeControlRecord | null>(null);
  const [assessment, setAssessment] = useState<ChangeImpactAssessment | null>(null);
  const [auditLogs, setAuditLogs] = useState<Record<string, unknown>[]>([]);

  const actor = useMemo(() => ({
    id: user?.uid || 'system',
    name: profile?.full_name || profile?.email || 'User',
    role: profile?.role,
    department: profile?.department,
  }), [user?.uid, profile?.full_name, profile?.email, profile?.role, profile?.department]);

  const readOnly = isCcImpactReadOnly(actor.role);
  const canManage = canManageCcImpact(actor.role, assessment?.assessed_by, actor.id) && !readOnly;
  const canApprove = canApproveCcImpact(actor.role) && !readOnly;

  const form = useForm<CcImpactFormInput>({
    resolver: zodResolver(ccImpactFormSchema),
    defaultValues: defaultFormValues(changeId, user?.uid, profile),
  });

  const qaForm = useForm<{ decision: 'approved' | 'rejected'; qa_comments: string }>({
    resolver: zodResolver(ccImpactQaReviewSchema),
    defaultValues: { decision: 'approved', qa_comments: '' },
  });

  const severity = form.watch('impact_severity');
  const likelihood = form.watch('impact_likelihood');
  const liveRating = computeOverallImpactRating(severity, likelihood);
  const formValues = form.watch();
  const recommendations = useMemo(() => (
    change ? generateImpactRecommendations({ ...formValues, overall_impact_rating: liveRating } as CcImpactFormInput, change) : []
  ), [change, formValues, liveRating]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const data = await fetchCcImpactPageData(changeId);
    if ('error' in data && data.error) {
      setError(data.error);
      setLoading(false);
      return;
    }
    if (!('change' in data) || !data.change) {
      setError('Change control not found');
      setLoading(false);
      return;
    }
    setChange(data.change);
    setAssessment(data.assessment || null);
    setAuditLogs(data.auditLogs || []);
    form.reset(buildFormFromData(changeId, data.change, data.assessment, user?.uid, profile));
    setLoading(false);
  }, [changeId, form, user?.uid, profile]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (severity && likelihood) form.setValue('overall_impact_rating', liveRating as CcImpactFormInput['overall_impact_rating']);
  }, [severity, likelihood, liveRating, form]);

  const handleSave = async () => {
    const valid = await form.trigger();
    if (!valid) return;
    setBusy(true);
    const res = await saveCcImpactDraft(form.getValues(), actor);
    setBusy(false);
    if (res.error) { toast.error(res.error); return; }
    toast.success('Impact assessment saved');
    void load();
  };

  const handleSubmitReview = async () => {
    setBusy(true);
    const res = await submitCcImpactForReview(changeId, actor);
    setBusy(false);
    if ('error' in res && res.error) { toast.error(res.error); return; }
    toast.success('Submitted for review');
    void load();
  };

  const handleQaReview = async () => {
    const valid = await qaForm.trigger();
    if (!valid) return;
    setBusy(true);
    const res = await submitCcImpactQaReview(changeId, qaForm.getValues(), actor);
    setBusy(false);
    if (res.error) { toast.error(res.error); return; }
    toast.success('QA review recorded');
    void load();
  };

  const fieldsForTab = (tab: string) => IMPACT_FIELDS.filter((f) => f.tab === tab);

  if (loading) return <LoadingSkeleton rows={8} />;
  if (error || !change) return <ErrorCard message={error || 'Not found'} onRetry={() => void load()} />;

  return (
    <CcImpactAccessGuard>
      <div className="space-y-6">
        <CpvPageHeader
          title="Change Impact Assessment"
          description="Evaluate GMP, quality, validation and regulatory impact of proposed changes"
          trail={[
            { label: 'Dashboard', href: '/dashboard' },
            { label: 'QMS', href: '/qms/change-control' },
            { label: 'Change Control', href: '/qms/change-control' },
            { label: 'Impact Assessment', href: '/qms/change-control/impact-assessment' },
            { label: change.change_control_number },
          ]}
          actions={(
            <Link href="/qms/change-control/impact-assessment">
              <Button variant="outline" size="sm"><ArrowLeft className="mr-2 h-4 w-4" />Back</Button>
            </Link>
          )}
        />

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Change Control</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-1">
              <p className="font-mono font-medium">{change.change_control_number}</p>
              <CcStatusBadge status={change.status} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Status</CardTitle></CardHeader>
            <CardContent><CcImpactStatusBadge status={assessment?.status} /></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Overall Impact</CardTitle></CardHeader>
            <CardContent><CcImpactRatingBadge rating={assessment?.overall_impact_rating || liveRating} /></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Assessment ID</CardTitle></CardHeader>
            <CardContent className="text-xs font-mono">{assessment?.impact_assessment_id || '—'}</CardContent>
          </Card>
        </div>

        {(isImpactYes(form.watch('patient_safety_impact')) || liveRating === 'Critical') && (
          <Alert>
            <AlertTitle>Mandatory Review</AlertTitle>
            <AlertDescription>
              {isImpactYes(form.watch('patient_safety_impact')) && 'Patient safety impact requires Head QA review. '}
              {liveRating === 'Critical' && 'Critical overall impact requires Head QA approval.'}
            </AlertDescription>
          </Alert>
        )}

        <Form {...form}>
          <Tabs defaultValue="overview">
            <TabsList className="flex h-auto flex-wrap">
              {['overview', 'quality', 'validation', 'csv', 'regulatory', 'training', 'recommendations', 'qa', 'audit'].map((t) => {
                const labels: Record<string, string> = {
                  overview: 'Overview', quality: 'Quality Impact', validation: 'Validation Impact',
                  csv: 'CSV Impact', regulatory: 'Regulatory Impact', training: 'Training Impact',
                  recommendations: 'Recommendations', qa: 'QA Review', audit: 'Audit Trail',
                };
                return <TabsTrigger key={t} value={t}>{labels[t]}</TabsTrigger>;
              })}
            </TabsList>

            <TabsContent value="overview" className="mt-4 space-y-4">
              <Card>
                <CardHeader><CardTitle>Assessment Overview</CardTitle></CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-3">
                  <FormField control={form.control} name="assessment_date" render={({ field }) => (
                    <FormItem><FormLabel>Assessment Date *</FormLabel><FormControl><Input type="date" {...field} disabled={!canManage} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="assessed_by" render={({ field }) => (
                    <FormItem><FormLabel>Assessed By *</FormLabel><FormControl><Input {...field} disabled={!canManage} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="department" render={({ field }) => (
                    <FormItem><FormLabel>Department</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value} disabled={!canManage}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>{CC_DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                      </Select></FormItem>
                  )} />
                  <FormField control={form.control} name="impact_description" render={({ field }) => (
                    <FormItem className="md:col-span-3"><FormLabel>Impact Description *</FormLabel><FormControl><Textarea rows={3} {...field} disabled={!canManage} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="scientific_justification" render={({ field }) => (
                    <FormItem className="md:col-span-3"><FormLabel>Scientific Justification *</FormLabel><FormControl><Textarea rows={3} {...field} disabled={!canManage} /></FormControl><FormMessage /></FormItem>
                  )} />
                </CardContent>
              </Card>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {fieldsForTab('overview').map((f) => (
                  <ImpactField key={f.key} form={form} name={f.key} label={f.label} disabled={!canManage} />
                ))}
              </div>
              <Card>
                <CardHeader><CardTitle>Impact Matrix</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-3">
                    <FormField control={form.control} name="impact_severity" render={({ field }) => (
                      <FormItem><FormLabel>Severity</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value} disabled={!canManage}>
                          <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                          <SelectContent>{CC_IMPACT_SEVERITIES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                        </Select></FormItem>
                    )} />
                    <FormField control={form.control} name="impact_likelihood" render={({ field }) => (
                      <FormItem><FormLabel>Likelihood</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value} disabled={!canManage}>
                          <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                          <SelectContent>{CC_IMPACT_LIKELIHOODS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
                        </Select></FormItem>
                    )} />
                    <FormItem>
                      <FormLabel>Overall Impact Rating</FormLabel>
                      <div className="pt-2"><CcImpactRatingBadge rating={liveRating} /></div>
                    </FormItem>
                  </div>
                  {assessment && <CcImpactMatrix assessments={[assessment]} />}
                </CardContent>
              </Card>
            </TabsContent>

            {['quality', 'validation', 'csv', 'regulatory', 'training'].map((tab) => (
              <TabsContent key={tab} value={tab} className="mt-4">
                <div className="grid gap-4 md:grid-cols-2">
                  {fieldsForTab(tab).map((f) => (
                    <ImpactCard key={f.key} form={form} name={f.key} label={f.label} disabled={!canManage} />
                  ))}
                </div>
              </TabsContent>
            ))}

            <TabsContent value="recommendations" className="mt-4">
              <Card>
                <CardHeader><CardTitle>Generated Recommendations</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {recommendations.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Save assessment to generate recommendations.</p>
                  ) : (
                    <ul className="list-disc pl-5 space-y-2 text-sm">
                      {recommendations.map((r, i) => <li key={i}>{r}</li>)}
                    </ul>
                  )}
                  <FormField control={form.control} name="recommended_actions" render={({ field }) => (
                    <FormItem><FormLabel>Recommended Actions</FormLabel><FormControl><Textarea rows={4} {...field} disabled={!canManage} /></FormControl></FormItem>
                  )} />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="qa" className="mt-4">
              {canApprove && assessment && (
                <Form {...qaForm}>
                  <Card>
                    <CardHeader><CardTitle>QA Review</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                      <FormField control={qaForm.control} name="decision" render={({ field }) => (
                        <FormItem><FormLabel>Decision</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                            <SelectContent>
                              <SelectItem value="approved">Approve</SelectItem>
                              <SelectItem value="rejected">Reject</SelectItem>
                            </SelectContent>
                          </Select></FormItem>
                      )} />
                      <FormField control={qaForm.control} name="qa_comments" render={({ field }) => (
                        <FormItem><FormLabel>QA Comments *</FormLabel><FormControl><Textarea rows={3} {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <Button onClick={() => void handleQaReview()} disabled={busy}>
                        {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                        Submit QA Review
                      </Button>
                    </CardContent>
                  </Card>
                </Form>
              )}
            </TabsContent>

            <TabsContent value="audit" className="mt-4">
              <CcImpactTimeline auditLogs={auditLogs} />
            </TabsContent>
          </Tabs>
        </Form>

        {canManage && (
          <div className="flex flex-wrap gap-2 border-t pt-4">
            <Button variant="outline" onClick={() => void handleSave()} disabled={busy}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Save Draft
            </Button>
            <Button onClick={() => void handleSubmitReview()} disabled={busy}>
              <Send className="mr-2 h-4 w-4" />Submit for Review
            </Button>
          </div>
        )}
      </div>
    </CcImpactAccessGuard>
  );
}

function ImpactField({ form, name, label, disabled }: {
  form: ReturnType<typeof useForm<CcImpactFormInput>>;
  name: keyof CcImpactFormInput;
  label: string;
  disabled?: boolean;
}) {
  return (
    <FormField control={form.control} name={name as 'product_impact'} render={({ field }) => (
      <FormItem>
        <FormLabel>{label}</FormLabel>
        <Select onValueChange={field.onChange} value={String(field.value || 'No')} disabled={disabled}>
          <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
          <SelectContent>{CC_IMPACT_OPTIONS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
        </Select>
      </FormItem>
    )} />
  );
}

function ImpactCard({ form, name, label, disabled }: {
  form: ReturnType<typeof useForm<CcImpactFormInput>>;
  name: keyof CcImpactFormInput;
  label: string;
  disabled?: boolean;
}) {
  const value = form.watch(name as 'product_impact');
  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm">{label}</CardTitle>
        <CcImpactOptionBadge value={String(value || 'No')} />
      </CardHeader>
      <CardContent><ImpactField form={form} name={name} label={label} disabled={disabled} /></CardContent>
    </Card>
  );
}

function defaultFormValues(changeId: string, uid?: string, profile?: { full_name?: string; department?: string } | null): CcImpactFormInput {
  const opt = 'No' as const;
  return {
    change_id: changeId,
    assessment_date: new Date().toISOString().split('T')[0],
    assessed_by: uid || '',
    assessed_by_name: profile?.full_name || '',
    department: (profile?.department as CcImpactFormInput['department']) || 'QA',
    product_impact: opt, process_impact: opt, equipment_impact: opt, utility_impact: opt,
    facility_impact: opt, document_impact: opt, training_impact: opt, validation_impact: opt,
    csv_impact: opt, regulatory_impact: opt, quality_impact: opt, patient_safety_impact: opt,
    stability_impact: opt, market_impact: opt, business_impact: opt, supplier_impact: opt,
    environmental_impact: opt, data_integrity_impact: opt,
    impact_description: '', scientific_justification: '', recommended_actions: '',
    impact_severity: 'Negligible', impact_likelihood: 'Rare', overall_impact_rating: 'Low',
    qa_comments: '',
  };
}

function buildFormFromData(
  changeId: string,
  change: ChangeControlRecord,
  assessment: ChangeImpactAssessment | null | undefined,
  uid?: string,
  profile?: { full_name?: string; department?: string } | null,
): CcImpactFormInput {
  const base = defaultFormValues(changeId, uid, profile);
  if (!assessment) {
    return {
      ...base,
      validation_impact: change.validation_impact ? 'Yes' : 'No',
      csv_impact: change.csv_impact ? 'Yes' : 'No',
      training_impact: change.training_impact ? 'Yes' : 'No',
      regulatory_impact: change.regulatory_impact ? 'Yes' : 'No',
      patient_safety_impact: change.patient_safety_impact ? 'Yes' : 'No',
      stability_impact: change.stability_impact ? 'Yes' : 'No',
      quality_impact: change.quality_impact ? 'Yes' : 'No',
      market_impact: change.market_impact ? 'Yes' : 'No',
      impact_description: change.proposed_change || '',
      scientific_justification: change.reason_for_change || '',
    };
  }
  return {
    ...base,
    assessment_date: assessment.assessment_date || assessment.assessed_at?.split('T')[0] || base.assessment_date,
    assessed_by: assessment.assessed_by || base.assessed_by,
    assessed_by_name: assessment.assessed_by_name || base.assessed_by_name,
    department: (assessment.department || change.department) as CcImpactFormInput['department'],
    product_impact: (assessment.product_impact || 'No') as CcImpactFormInput['product_impact'],
    process_impact: (assessment.process_impact || 'No') as CcImpactFormInput['process_impact'],
    equipment_impact: (assessment.equipment_impact || 'No') as CcImpactFormInput['equipment_impact'],
    utility_impact: (assessment.utility_impact || 'No') as CcImpactFormInput['utility_impact'],
    facility_impact: (assessment.facility_impact || 'No') as CcImpactFormInput['facility_impact'],
    document_impact: (assessment.document_impact || assessment.documentation_impact || 'No') as CcImpactFormInput['document_impact'],
    training_impact: (assessment.training_impact || 'No') as CcImpactFormInput['training_impact'],
    validation_impact: (assessment.validation_impact || 'No') as CcImpactFormInput['validation_impact'],
    csv_impact: (assessment.csv_impact || assessment.computerized_system_impact || 'No') as CcImpactFormInput['csv_impact'],
    regulatory_impact: (assessment.regulatory_impact || 'No') as CcImpactFormInput['regulatory_impact'],
    quality_impact: (assessment.quality_impact || 'No') as CcImpactFormInput['quality_impact'],
    patient_safety_impact: (assessment.patient_safety_impact || assessment.safety_impact || 'No') as CcImpactFormInput['patient_safety_impact'],
    stability_impact: (assessment.stability_impact || 'No') as CcImpactFormInput['stability_impact'],
    market_impact: (assessment.market_impact || 'No') as CcImpactFormInput['market_impact'],
    business_impact: (assessment.business_impact || 'No') as CcImpactFormInput['business_impact'],
    supplier_impact: (assessment.supplier_impact || 'No') as CcImpactFormInput['supplier_impact'],
    environmental_impact: (assessment.environmental_impact || 'No') as CcImpactFormInput['environmental_impact'],
    data_integrity_impact: (assessment.data_integrity_impact || 'No') as CcImpactFormInput['data_integrity_impact'],
    impact_description: assessment.impact_description || '',
    scientific_justification: assessment.scientific_justification || '',
    recommended_actions: assessment.recommended_actions || '',
    impact_severity: (assessment.impact_severity || 'Negligible') as CcImpactFormInput['impact_severity'],
    impact_likelihood: (assessment.impact_likelihood || 'Rare') as CcImpactFormInput['impact_likelihood'],
    overall_impact_rating: (assessment.overall_impact_rating || 'Low') as CcImpactFormInput['overall_impact_rating'],
    qa_comments: assessment.qa_comments || '',
  };
}
