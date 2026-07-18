'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  ArrowLeft, CheckCircle2, Loader2, Save, Send, ShieldCheck, XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/auth-context';
import {
  canApproveCcEffectiveness,
  canApproveCriticalCcEffectiveness,
  canCreateCcEffectiveness,
  canProvideCcEffectivenessInput,
  canProvideCsvEffectivenessInput,
  canProvideRegulatoryEffectivenessInput,
  canProvideValidationEffectivenessInput,
  computeAutoCcEffectivenessResult,
  computeCcEffectivenessScore,
  computeEffectivenessProgress,
  generateCapaRecommendation,
  isCapaRecommendationRequired,
  isCcEffectivenessReadOnly,
  isDepartmentCcEffectivenessViewer,
} from '@/lib/cc-effectiveness-records';
import {
  ccEffectivenessQaReviewSchema,
  ccEffectivenessReviewSchema,
  type CcEffectivenessReviewInput,
} from '@/lib/cc-effectiveness-schemas';
import {
  fetchCcEffectivenessPageData,
  saveCcEffectivenessDraft,
  submitCcEffectivenessForReview,
  submitCcEffectivenessHeadQaReview,
  submitCcEffectivenessQaReview,
} from '@/lib/cc-effectiveness-service';
import { CC_DEPARTMENTS, requiresHeadQaApproval, type ChangeControlRecord, type ChangeEffectivenessReview } from '@/lib/change-control-types';
import { CpvPageHeader } from '@/components/cpv/product-master/cpv-page-header';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { CcStatusBadge } from '@/components/change-control/cc-sub-nav';
import { CcEffectivenessAccessGuard } from './cc-effectiveness-access-guard';
import {
  CcEffectivenessResultBadge,
  CcEffectivenessScoreBadge,
  CcEffectivenessStatusBadge,
  CcRiskBadge,
} from './cc-effectiveness-badges';
import { CcEffectivenessProgress } from './cc-effectiveness-progress';
import { CcEffectivenessTimeline } from './cc-effectiveness-timeline';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';

const CHECKLIST_ITEMS: { key: keyof CcEffectivenessReviewInput; label: string; points: number; tab?: string }[] = [
  { key: 'change_objective_achieved', label: 'Change objective achieved', points: 10, tab: 'checklist' },
  { key: 'implementation_successful', label: 'Implementation successful', points: 10, tab: 'checklist' },
  { key: 'validation_successful', label: 'Validation successful', points: 10, tab: 'checklist' },
  { key: 'training_completed', label: 'Training completed', points: 10, tab: 'checklist' },
  { key: 'risk_reduced', label: 'Risk reduced', points: 10, tab: 'performance' },
  { key: 'process_improved', label: 'Process improved', points: 10, tab: 'performance' },
  { key: 'performance_improved', label: 'Performance improved', points: 10, tab: 'performance' },
  { key: 'deviation_generated', label: 'Deviation generated (inverse)', points: -10, tab: 'deviation' },
  { key: 'oos_generated', label: 'OOS generated (inverse)', points: -10, tab: 'deviation' },
  { key: 'complaint_generated', label: 'Complaint generated (inverse)', points: -10, tab: 'deviation' },
];

function BoolField({
  form, name, label, disabled,
}: {
  form: ReturnType<typeof useForm<CcEffectivenessReviewInput>>;
  name: keyof CcEffectivenessReviewInput;
  label: string;
  disabled?: boolean;
}) {
  return (
    <FormField
      control={form.control}
      name={name as 'change_objective_achieved'}
      render={({ field }) => (
        <FormItem className="flex items-center justify-between rounded-lg border p-3">
          <FormLabel className="font-normal">{label}</FormLabel>
          <FormControl>
            <Switch checked={!!field.value} onCheckedChange={field.onChange} disabled={disabled} />
          </FormControl>
        </FormItem>
      )}
    />
  );
}

export function CcEffectivenessPage({ changeId }: { changeId: string }) {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [change, setChange] = useState<ChangeControlRecord | null>(null);
  const [review, setReview] = useState<ChangeEffectivenessReview | null>(null);
  const [auditLogs, setAuditLogs] = useState<Record<string, unknown>[]>([]);

  const actor = useMemo(() => ({
    id: user?.uid || 'system',
    name: profile?.full_name || profile?.email || 'User',
    role: profile?.role,
    department: profile?.department,
  }), [user?.uid, profile?.full_name, profile?.email, profile?.role, profile?.department]);

  const readOnly = isCcEffectivenessReadOnly(actor.role) || isDepartmentCcEffectivenessViewer(actor.role);
  const canCreate = canCreateCcEffectiveness(actor.role) && !isCcEffectivenessReadOnly(actor.role);
  const canInput = change ? canProvideCcEffectivenessInput(actor.role, change, actor.id) : false;
  const canEditValidation = canProvideValidationEffectivenessInput(actor.role) && !isCcEffectivenessReadOnly(actor.role);
  const canEditCsv = canProvideCsvEffectivenessInput(actor.role) && !isCcEffectivenessReadOnly(actor.role);
  const canEditRegulatory = canProvideRegulatoryEffectivenessInput(actor.role) && !isCcEffectivenessReadOnly(actor.role);
  const canEdit = (canCreate || canInput) && !isCcEffectivenessReadOnly(actor.role) && (!review || ['Draft', 'Under Review', 'Rejected'].includes(review.status || 'Draft'));
  const canApprove = canApproveCcEffectiveness(actor.role) && !readOnly;
  const canApproveCritical = change ? canApproveCriticalCcEffectiveness(actor.role, change.change_category) : false;
  const needsHeadQa = change ? requiresHeadQaApproval(change.change_category) : false;

  const form = useForm<CcEffectivenessReviewInput>({
    resolver: zodResolver(ccEffectivenessReviewSchema),
    defaultValues: {
      change_id: changeId,
      review_date: new Date().toISOString().split('T')[0],
      review_owner: user?.uid || '',
      review_owner_name: profile?.full_name || '',
      department: profile?.department || 'QA',
      review_period_start: '',
      review_period_end: new Date().toISOString().split('T')[0],
      change_objective_achieved: false,
      implementation_successful: false,
      validation_successful: false,
      csv_requirements_met: false,
      training_completed: false,
      no_adverse_quality_impact: false,
      no_regulatory_impact: false,
      no_data_integrity_impact: true,
      no_patient_safety_impact: false,
      performance_improved: false,
      process_improved: false,
      risk_reduced: false,
      deviation_generated: false,
      oos_generated: false,
      complaint_generated: false,
      capa_generated: false,
      review_findings: '',
      recommendations: '',
      additional_actions_required: false,
      qa_comments: '',
      head_qa_comments: '',
    },
  });

  const qaForm = useForm<{ decision: 'approved' | 'rejected'; qa_comments: string; head_qa_comments: string }>({
    resolver: zodResolver(ccEffectivenessQaReviewSchema),
    defaultValues: { decision: 'approved', qa_comments: '', head_qa_comments: '' },
  });

  const watched = form.watch();
  const computedScore = useMemo(() => computeCcEffectivenessScore(watched), [watched]);
  const computedResult = useMemo(() => computeAutoCcEffectivenessResult(computedScore), [computedScore]);
  const capaNotes = useMemo(() => generateCapaRecommendation(watched, computedScore, computedResult), [watched, computedScore, computedResult]);
  const capaRequired = isCapaRecommendationRequired(computedResult);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const data = await fetchCcEffectivenessPageData(changeId);
    if ('error' in data && data.error) {
      setError(data.error);
      setLoading(false);
      return;
    }
    if (!data.change) {
      setError('Change control not found');
      setLoading(false);
      return;
    }
    setChange(data.change);
    setReview(data.review || null);
    setAuditLogs(data.auditLogs || []);

    const implDate = data.change.actual_implementation_date || data.change.planned_implementation_date || '';
    form.reset({
      change_id: changeId,
      review_date: data.review?.review_date || new Date().toISOString().split('T')[0],
      review_owner: data.review?.review_owner || user?.uid || '',
      review_owner_name: data.review?.review_owner_name || profile?.full_name || '',
      department: data.review?.department || data.change.department || 'QA',
      review_period_start: data.review?.review_period_start || implDate,
      review_period_end: data.review?.review_period_end || new Date().toISOString().split('T')[0],
      change_objective_achieved: data.review?.change_objective_achieved ?? false,
      implementation_successful: data.review?.implementation_successful ?? false,
      validation_successful: data.review?.validation_successful ?? false,
      csv_requirements_met: data.review?.csv_requirements_met ?? false,
      training_completed: data.review?.training_completed ?? false,
      no_adverse_quality_impact: data.review?.no_adverse_quality_impact ?? true,
      no_regulatory_impact: data.review?.no_regulatory_impact ?? !data.change.regulatory_impact,
      no_data_integrity_impact: data.review?.no_data_integrity_impact ?? true,
      no_patient_safety_impact: data.review?.no_patient_safety_impact ?? true,
      performance_improved: data.review?.performance_improved ?? false,
      process_improved: data.review?.process_improved ?? false,
      risk_reduced: data.review?.risk_reduced ?? false,
      deviation_generated: data.review?.deviation_generated ?? false,
      oos_generated: data.review?.oos_generated ?? false,
      complaint_generated: data.review?.complaint_generated ?? false,
      capa_generated: data.review?.capa_generated ?? false,
      review_findings: data.review?.review_findings || data.review?.conclusion || '',
      recommendations: data.review?.recommendations || '',
      additional_actions_required: data.review?.additional_actions_required ?? false,
      qa_comments: data.review?.qa_comments || '',
      head_qa_comments: data.review?.head_qa_comments || '',
    });
    setLoading(false);
  }, [changeId, form, user?.uid, profile?.full_name]);

  useEffect(() => { void load(); }, [load]);

  const handleSave = async () => {
    setBusy(true);
    const res = await saveCcEffectivenessDraft({ ...form.getValues(), effectiveness_result: computedResult, effectiveness_score: computedScore }, actor);
    setBusy(false);
    if (res.error) { toast.error(res.error); return; }
    setReview(res.review || null);
    toast.success('Draft saved');
    void load();
  };

  const handleSubmit = async () => {
    const valid = await form.trigger();
    if (!valid) { toast.error('Please complete required fields'); return; }
    if (capaRequired && !form.getValues('additional_actions_required')) {
      form.setValue('additional_actions_required', true);
    }
    setBusy(true);
    const res = await submitCcEffectivenessForReview({
      ...form.getValues(),
      effectiveness_result: computedResult,
      effectiveness_score: computedScore,
      recommendations: capaNotes || form.getValues('recommendations'),
    }, actor);
    setBusy(false);
    if (res.error) { toast.error(res.error); return; }
    setReview(res.review || null);
    toast.success('Submitted for QA review');
    void load();
  };

  const handleQaReview = async () => {
    const valid = await qaForm.trigger();
    if (!valid) return;
    setBusy(true);
    const fn = review?.status === 'Head QA Review'
      ? submitCcEffectivenessHeadQaReview
      : submitCcEffectivenessQaReview;
    const res = await fn(changeId, qaForm.getValues(), actor);
    setBusy(false);
    if (res.error) { toast.error(res.error); return; }
    setReview(res.review || null);
    toast.success('Review decision recorded');
    void load();
  };

  if (loading) return <LoadingSkeleton rows={8} />;
  if (error || !change) return <ErrorCard message={error || 'Not found'} onRetry={() => void load()} />;

  const displayResult = review?.effectiveness_result || review?.result || computedResult;
  const displayScore = review?.effectiveness_score ?? computedScore;

  return (
    <CcEffectivenessAccessGuard>
      <div className="space-y-6">
        <CpvPageHeader
          title="Change Effectiveness Review"
          description="Verify that implemented changes achieved intended GMP objectives"
          trail={[
            { label: 'Dashboard', href: '/dashboard' },
            { label: 'QMS', href: '/qms/change-control' },
            { label: 'Change Control', href: '/qms/change-control' },
            { label: 'Effectiveness Review', href: '/qms/change-control/effectiveness' },
            { label: change.change_control_number },
          ]}
          actions={(
            <Link href="/qms/change-control/effectiveness">
              <Button variant="outline" size="sm"><ArrowLeft className="mr-2 h-4 w-4" />Back to List</Button>
            </Link>
          )}
        />

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Effectiveness Score</CardTitle></CardHeader>
            <CardContent><CcEffectivenessScoreBadge score={displayScore} /><Progress value={displayScore} className="mt-3 h-2" /></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Result</CardTitle></CardHeader>
            <CardContent><CcEffectivenessResultBadge result={displayResult} /></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Status</CardTitle></CardHeader>
            <CardContent><CcEffectivenessStatusBadge status={review?.status} /><CcEffectivenessProgress review={review} /></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Change Control</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-sm">
              <p className="font-mono font-medium">{change.change_control_number}</p>
              <CcStatusBadge status={change.status} />
              <CcRiskBadge category={change.change_category} />
            </CardContent>
          </Card>
        </div>

        {isDepartmentCcEffectivenessViewer(actor.role) && (
          <Alert>
            <AlertTitle>Department view</AlertTitle>
            <AlertDescription>You can provide review inputs. QA authorization is required to approve effectiveness.</AlertDescription>
          </Alert>
        )}

        {capaRequired && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertTitle>CAPA Recommendation Mandatory</AlertTitle>
            <AlertDescription>Effectiveness score indicates Not Effective. CAPA initiation is required before change closure.</AlertDescription>
          </Alert>
        )}

        {needsHeadQa && review?.status !== 'Approved' && review?.status !== 'Closed' && (
          <Alert>
            <ShieldCheck className="h-4 w-4" />
            <AlertTitle>Critical Change — Head QA Review Required</AlertTitle>
            <AlertDescription>This critical change requires Head QA approval before closure.</AlertDescription>
          </Alert>
        )}

        <Form {...form}>
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="flex h-auto flex-wrap">
              {['overview', 'checklist', 'performance', 'quality', 'deviation', 'capa', 'qa', 'audit'].map((t) => (
                <TabsTrigger key={t} value={t} className="capitalize">
                  {t === 'qa' ? 'QA Review' : t === 'deviation' ? 'Deviation/OOS' : t === 'capa' ? 'CAPA Rec.' : t === 'audit' ? 'Audit Trail' : t.replace('-', ' ')}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="overview" className="mt-4 space-y-4">
              <Card>
                <CardHeader><CardTitle>Review Overview</CardTitle><CardDescription>{change.change_title}</CardDescription></CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <FormField control={form.control} name="review_date" render={({ field }) => (
                    <FormItem><FormLabel>Review Date *</FormLabel><FormControl><Input type="date" {...field} disabled={!canEdit} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="department" render={({ field }) => (
                    <FormItem><FormLabel>Department *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value} disabled={!canEdit}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>{CC_DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                      </Select><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="review_period_start" render={({ field }) => (
                    <FormItem><FormLabel>Review Period Start *</FormLabel><FormControl><Input type="date" {...field} disabled={!canEdit} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="review_period_end" render={({ field }) => (
                    <FormItem><FormLabel>Review Period End *</FormLabel><FormControl><Input type="date" {...field} disabled={!canEdit} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <div className="md:col-span-2">
                    <FormField control={form.control} name="review_findings" render={({ field }) => (
                      <FormItem><FormLabel>Review Findings *</FormLabel><FormControl><Textarea rows={4} {...field} disabled={!canEdit} /></FormControl><FormMessage /></FormItem>
                    )} />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>Scoring Summary</CardTitle></CardHeader>
                <CardContent className="grid gap-2 sm:grid-cols-2">
                  {CHECKLIST_ITEMS.map((item) => {
                    const val = watched[item.key];
                    const earned = item.key.includes('generated') ? !val : !!val;
                    return (
                      <div key={item.key} className="flex justify-between rounded border px-3 py-2 text-sm">
                        <span>{item.label}</span>
                        <span className={earned ? 'text-green-600' : 'text-red-600'}>{earned ? `+${Math.abs(item.points)}` : '0'}</span>
                      </div>
                    );
                  })}
                  <div className="sm:col-span-2 flex justify-between rounded-lg bg-muted px-3 py-2 font-semibold">
                    <span>Total Effectiveness Score</span>
                    <span>{computedScore}/100 → {computedResult}</span>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="checklist" className="mt-4">
              <Card><CardHeader><CardTitle>Effectiveness Checklist</CardTitle><CardDescription>KPI evaluation — each criterion contributes +10 to score (max 100)</CardDescription></CardHeader>
                <CardContent className="grid gap-3 md:grid-cols-2">
                  <BoolField form={form} name="change_objective_achieved" label="Change objective achieved (+10)" disabled={!canEdit} />
                  <BoolField form={form} name="implementation_successful" label="Implementation successful (+10)" disabled={!canEdit} />
                  <BoolField form={form} name="validation_successful" label="Validation successful (+10)" disabled={!canEdit && !canEditValidation} />
                  <BoolField form={form} name="training_completed" label="Training completed (+10)" disabled={!canEdit} />
                  <BoolField form={form} name="csv_requirements_met" label="CSV requirements met" disabled={!canEdit && !canEditCsv} />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="performance" className="mt-4">
              <Card><CardHeader><CardTitle>Performance Review</CardTitle></CardHeader>
                <CardContent className="grid gap-3 md:grid-cols-2">
                  <BoolField form={form} name="performance_improved" label="Performance improved (+10)" disabled={!canEdit} />
                  <BoolField form={form} name="process_improved" label="Process improved (+10)" disabled={!canEdit} />
                  <BoolField form={form} name="risk_reduced" label="Risk reduced (+10)" disabled={!canEdit} />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="quality" className="mt-4">
              <Card><CardHeader><CardTitle>Quality Review</CardTitle></CardHeader>
                <CardContent className="grid gap-3 md:grid-cols-2">
                  <BoolField form={form} name="no_adverse_quality_impact" label="No adverse quality impact" disabled={!canEdit} />
                  <BoolField form={form} name="no_regulatory_impact" label="No regulatory impact" disabled={!canEdit && !canEditRegulatory} />
                  <BoolField form={form} name="no_data_integrity_impact" label="No data integrity impact" disabled={!canEdit && !canEditCsv} />
                  <BoolField form={form} name="no_patient_safety_impact" label="No patient safety impact" disabled={!canEdit} />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="deviation" className="mt-4">
              <Card><CardHeader><CardTitle>Deviation / OOS / Complaint Linkage</CardTitle><CardDescription>Events after implementation reduce effectiveness score</CardDescription></CardHeader>
                <CardContent className="grid gap-3 md:grid-cols-2">
                  <BoolField form={form} name="deviation_generated" label="Deviation generated (−10 if yes)" disabled={!canEdit} />
                  <BoolField form={form} name="oos_generated" label="OOS generated — notifies QA (−10 if yes)" disabled={!canEdit} />
                  <BoolField form={form} name="complaint_generated" label="Complaint generated — notifies QA & Head QA (−10 if yes)" disabled={!canEdit} />
                  <BoolField form={form} name="capa_generated" label="CAPA generated from change" disabled={!canEdit} />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="capa" className="mt-4">
              <Card>
                <CardHeader><CardTitle>CAPA Recommendations</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <BoolField form={form} name="additional_actions_required" label="Additional actions required" disabled={!canEdit} />
                  <div className="rounded-lg border bg-muted/50 p-4 text-sm whitespace-pre-wrap">{capaNotes || 'No CAPA recommendations at this time.'}</div>
                  <FormField control={form.control} name="recommendations" render={({ field }) => (
                    <FormItem><FormLabel>Recommendations</FormLabel><FormControl><Textarea rows={4} {...field} disabled={!canEdit} placeholder={capaNotes} /></FormControl></FormItem>
                  )} />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="qa" className="mt-4 space-y-4">
              <Card>
                <CardHeader><CardTitle>QA Review</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <FormField control={form.control} name="qa_comments" render={({ field }) => (
                    <FormItem><FormLabel>QA Comments *</FormLabel><FormControl><Textarea rows={3} {...field} disabled={!canEdit && !canApprove} /></FormControl><FormMessage /></FormItem>
                  )} />
                  {needsHeadQa && (
                    <FormField control={form.control} name="head_qa_comments" render={({ field }) => (
                      <FormItem><FormLabel>Head QA Comments</FormLabel><FormControl><Textarea rows={3} {...field} disabled={!canApproveCritical} /></FormControl></FormItem>
                    )} />
                  )}
                  {review?.qa_comments && <p className="text-sm text-muted-foreground">Saved QA comments: {review.qa_comments}</p>}
                  {review?.head_qa_comments && <p className="text-sm text-muted-foreground">Head QA: {review.head_qa_comments}</p>}
                </CardContent>
              </Card>
              {canApprove && !readOnly && ['QA Review', 'Head QA Review'].includes(review?.status || '') && (
                <Form {...qaForm}>
                  <Card>
                    <CardHeader><CardTitle>QA Approval Decision</CardTitle></CardHeader>
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
                      {needsHeadQa && review?.status === 'Head QA Review' && (
                        <FormField control={qaForm.control} name="head_qa_comments" render={({ field }) => (
                          <FormItem><FormLabel>Head QA Comments</FormLabel><FormControl><Textarea rows={3} {...field} /></FormControl></FormItem>
                        )} />
                      )}
                      <Button onClick={() => void handleQaReview()} disabled={busy || (review?.status === 'Head QA Review' && !canApproveCritical)}>
                        {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                        {review?.status === 'Head QA Review' ? 'Submit Head QA Decision' : 'Submit QA Decision'}
                      </Button>
                    </CardContent>
                  </Card>
                </Form>
              )}
            </TabsContent>

            <TabsContent value="audit" className="mt-4">
              <CcEffectivenessTimeline auditLogs={auditLogs} />
            </TabsContent>
          </Tabs>
        </Form>

        {canEdit && (
          <div className="flex flex-wrap gap-2 border-t pt-4">
            <Button variant="outline" onClick={() => void handleSave()} disabled={busy}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Save Draft
            </Button>
            <Button onClick={() => void handleSubmit()} disabled={busy}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}Submit for QA Review
            </Button>
          </div>
        )}
      </div>
    </CcEffectivenessAccessGuard>
  );
}
