'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, CheckCircle2, Loader2, Save, Send, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/auth-context';
import {
  canApproveCcValidation,
  canApproveCriticalCcValidation,
  canCreateCcValidation,
  canEditCsvSection,
  canEditQualificationSection,
  canEditRegulatorySection,
  generateValidationDeliverables,
  generateValidationRecommendations,
  isCcValidationReadOnly,
  recommendValidationCategory,
  requiresHeadQaValidationApproval,
} from '@/lib/cc-validation-records';
import {
  ccValidationAssessmentSchema,
  ccValidationQaReviewSchema,
  type CcValidationAssessmentInput,
} from '@/lib/cc-validation-schemas';
import {
  fetchCcValidationPageData,
  saveCcValidationDraft,
  submitCcValidationForQaReview,
  submitCcValidationHeadQaReview,
  submitCcValidationQaReview,
} from '@/lib/cc-validation-service';
import {
  CC_DEPARTMENTS,
  CC_GAMP_CATEGORIES,
  CC_VALIDATION_CATEGORIES,
  CC_VALIDATION_DELIVERABLES,
  CC_VALIDATION_SYSTEM_TYPES,
  type CcValidationAssessment,
  type ChangeControlRecord,
} from '@/lib/change-control-types';
import { CpvPageHeader } from '@/components/cpv/product-master/cpv-page-header';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { CcStatusBadge } from '@/components/change-control/cc-sub-nav';
import { CcRiskBadge } from '@/components/change-control/effectiveness/cc-effectiveness-badges';
import { CcValidationAccessGuard } from './cc-validation-access-guard';
import { CcImpactBadge, CcValidationCategoryBadge, CcValidationStatusBadge } from './cc-validation-badges';
import { CcValidationProgress } from './cc-validation-progress';
import { CcValidationTimeline } from './cc-validation-timeline';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

function BoolField({
  form, name, label, disabled,
}: {
  form: ReturnType<typeof useForm<CcValidationAssessmentInput>>;
  name: keyof CcValidationAssessmentInput;
  label: string;
  disabled?: boolean;
}) {
  return (
    <FormField
      control={form.control}
      name={name as 'validation_impact'}
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

export function CcValidationPage({ changeId }: { changeId: string }) {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [change, setChange] = useState<ChangeControlRecord | null>(null);
  const [assessment, setAssessment] = useState<CcValidationAssessment | null>(null);
  const [auditLogs, setAuditLogs] = useState<Record<string, unknown>[]>([]);

  const actor = useMemo(() => ({
    id: user?.uid || 'system',
    name: profile?.full_name || profile?.email || 'User',
    role: profile?.role,
    department: profile?.department,
  }), [user?.uid, profile?.full_name, profile?.email, profile?.role, profile?.department]);

  const readOnly = isCcValidationReadOnly(actor.role);
  const canEdit = canCreateCcValidation(actor.role) && !readOnly && (!assessment || ['Draft', 'Under Assessment', 'Rejected'].includes(assessment.status));
  const canQualification = canEditQualificationSection(actor.role) && !readOnly;
  const canCsv = canEditCsvSection(actor.role) && !readOnly;
  const canRegulatory = canEditRegulatorySection(actor.role) && !readOnly;
  const canApprove = canApproveCcValidation(actor.role, assessment?.validation_category) && !readOnly;
  const canApproveCritical = canApproveCriticalCcValidation(actor.role) && !readOnly;

  const form = useForm<CcValidationAssessmentInput>({
    resolver: zodResolver(ccValidationAssessmentSchema),
    defaultValues: {
      change_id: changeId,
      assessment_date: new Date().toISOString().split('T')[0],
      assessed_by: user?.uid || '',
      assessed_by_name: profile?.full_name || '',
      department: profile?.department || 'QA',
      validation_impact: false,
      qualification_impact: false,
      csv_impact: false,
      data_integrity_impact: false,
      regulatory_impact: false,
      revalidation_required: false,
      validation_category: 'No Validation Required',
      system_type: 'Process',
      affected_system: '',
      affected_equipment: '',
      affected_documents: '',
      affected_sops: '',
      affected_process: '',
      validation_scope: '',
      validation_justification: '',
      risk_based_rationale: '',
      validation_deliverables: [],
      validation_owner: user?.uid || '',
      validation_owner_name: profile?.full_name || '',
      target_completion_date: '',
      qa_comments: '',
      head_qa_comments: '',
      gamp_category: undefined,
      electronic_records_impact: false,
      electronic_signature_impact: false,
      audit_trail_impact: false,
      security_impact: false,
      backup_impact: false,
      disaster_recovery_impact: false,
      part_11_impact: false,
      annex_11_impact: false,
      annex_11_review_completed: false,
      csv_assessment_completed: false,
      qualification_review_completed: false,
      recommendations: '',
    },
  });

  const qaForm = useForm<{ decision: 'approved' | 'rejected'; qa_comments: string; head_qa_comments: string }>({
    resolver: zodResolver(ccValidationQaReviewSchema),
    defaultValues: { decision: 'approved', qa_comments: '', head_qa_comments: '' },
  });

  const watched = form.watch();
  const recommendations = useMemo(() => change ? generateValidationRecommendations(watched, change) : [], [watched, change]);
  const suggestedDeliverables = useMemo(() => generateValidationDeliverables(watched), [watched]);
  const needsHeadQa = useMemo(() => {
    if (!change) return false;
    if (assessment) return requiresHeadQaValidationApproval(change, assessment);
    return requiresHeadQaValidationApproval(change, { validation_category: watched.validation_category });
  }, [change, assessment, watched.validation_category]);
  const showQaDecision = canApprove
    && assessment?.status === 'QA Review'
    && !assessment?.head_qa_review_pending;
  const showHeadQaDecision = canApproveCritical
    && assessment?.status === 'QA Review'
    && Boolean(assessment?.head_qa_review_pending)
    && needsHeadQa;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const data = await fetchCcValidationPageData(changeId);
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
    setAssessment(data.assessment || null);
    setAuditLogs(data.auditLogs || []);

    const recCategory = data.assessment?.validation_category || recommendValidationCategory(data.change);
    form.reset({
      change_id: changeId,
      assessment_date: data.assessment?.assessment_date || new Date().toISOString().split('T')[0],
      assessed_by: data.assessment?.assessed_by || user?.uid || '',
      assessed_by_name: data.assessment?.assessed_by_name || profile?.full_name || '',
      department: data.assessment?.department || data.change.department || 'QA',
      validation_impact: data.assessment?.validation_impact ?? data.change.validation_impact,
      qualification_impact: data.assessment?.qualification_impact ?? Boolean(data.change.affected_equipment?.trim()),
      csv_impact: data.assessment?.csv_impact ?? data.change.csv_impact,
      data_integrity_impact: data.assessment?.data_integrity_impact ?? data.change.csv_impact,
      regulatory_impact: data.assessment?.regulatory_impact ?? data.change.regulatory_impact,
      revalidation_required: data.assessment?.revalidation_required ?? data.change.change_category !== 'Minor',
      validation_category: recCategory,
      system_type: data.assessment?.system_type || (data.change.csv_impact ? 'Software' : 'Process'),
      affected_system: data.assessment?.affected_system || '',
      affected_equipment: data.assessment?.affected_equipment || data.change.affected_equipment,
      affected_documents: data.assessment?.affected_documents || data.change.affected_documents,
      affected_sops: data.assessment?.affected_sops || '',
      affected_process: data.assessment?.affected_process || data.change.affected_process,
      validation_scope: data.assessment?.validation_scope || '',
      validation_justification: data.assessment?.validation_justification || '',
      risk_based_rationale: data.assessment?.risk_based_rationale || '',
      validation_deliverables: data.assessment?.validation_deliverables || generateValidationDeliverables({
        validation_category: recCategory,
        csv_impact: data.change.csv_impact,
        qualification_impact: Boolean(data.change.affected_equipment),
        validation_impact: data.change.validation_impact,
        revalidation_required: data.change.change_category !== 'Minor',
        affected_equipment: data.change.affected_equipment,
        system_type: data.change.csv_impact ? 'Software' : 'Process',
      }),
      validation_owner: data.assessment?.validation_owner || user?.uid || '',
      validation_owner_name: data.assessment?.validation_owner_name || profile?.full_name || '',
      target_completion_date: data.assessment?.target_completion_date || data.change.planned_implementation_date || '',
      qa_comments: data.assessment?.qa_comments || '',
      head_qa_comments: data.assessment?.head_qa_comments || '',
      gamp_category: data.assessment?.gamp_category as CcValidationAssessmentInput['gamp_category'],
      electronic_records_impact: data.assessment?.electronic_records_impact ?? false,
      electronic_signature_impact: data.assessment?.electronic_signature_impact ?? false,
      audit_trail_impact: data.assessment?.audit_trail_impact ?? false,
      security_impact: data.assessment?.security_impact ?? false,
      backup_impact: data.assessment?.backup_impact ?? false,
      disaster_recovery_impact: data.assessment?.disaster_recovery_impact ?? false,
      part_11_impact: data.assessment?.part_11_impact ?? false,
      annex_11_impact: data.assessment?.annex_11_impact ?? data.change.csv_impact,
      annex_11_review_completed: data.assessment?.annex_11_review_completed ?? false,
      csv_assessment_completed: data.assessment?.csv_assessment_completed ?? false,
      qualification_review_completed: data.assessment?.qualification_review_completed ?? false,
      recommendations: data.assessment?.recommendations || '',
    });
    setLoading(false);
  }, [changeId, form, user?.uid, profile?.full_name]);

  useEffect(() => { void load(); }, [load]);

  const handleSave = async () => {
    setBusy(true);
    const res = await saveCcValidationDraft(form.getValues(), actor);
    setBusy(false);
    if (res.error) { toast.error(res.error); return; }
    setAssessment(res.assessment || null);
    toast.success('Draft saved');
    void load();
  };

  const handleSubmit = async () => {
    const valid = await form.trigger();
    if (!valid) { toast.error('Please complete required fields'); return; }
    setBusy(true);
    const res = await submitCcValidationForQaReview(form.getValues(), actor);
    setBusy(false);
    if (res.error) { toast.error(res.error); return; }
    setAssessment(res.assessment || null);
    toast.success('Submitted for QA review');
    void load();
  };

  const handleQaReview = async (headQa = false) => {
    const valid = await qaForm.trigger();
    if (!valid) return;
    const values = qaForm.getValues();
    const payload = headQa
      ? { ...values, qa_comments: values.head_qa_comments || values.qa_comments }
      : values;
    if (headQa && (payload.qa_comments?.trim().length || 0) < 10) {
      toast.error('Head QA comments are required (min 10 characters)');
      return;
    }
    setBusy(true);
    const fn = headQa ? submitCcValidationHeadQaReview : submitCcValidationQaReview;
    const res = await fn(changeId, payload, actor);
    setBusy(false);
    if (res.error) { toast.error(res.error); return; }
    setAssessment(res.assessment || null);
    toast.success(headQa ? 'Head QA decision recorded' : 'QA review decision recorded');
    void load();
  };

  if (loading) return <LoadingSkeleton rows={8} />;
  if (error || !change) return <ErrorCard message={error || 'Not found'} onRetry={() => void load()} />;

  return (
    <CcValidationAccessGuard>
      <div className="space-y-6">
        <CpvPageHeader
          title="Validation Assessment"
          description="Assess validation, qualification and CSV impact of proposed changes"
          trail={[
            { label: 'Dashboard', href: '/dashboard' },
            { label: 'QMS', href: '/qms/change-control' },
            { label: 'Change Control', href: '/qms/change-control' },
            { label: 'Validation Assessment', href: '/qms/change-control/validation-assessment' },
            { label: change.change_control_number },
          ]}
          actions={(
            <Link href="/qms/change-control/validation-assessment">
              <Button variant="outline" size="sm"><ArrowLeft className="mr-2 h-4 w-4" />Back to List</Button>
            </Link>
          )}
        />

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Change Control</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-sm">
              <p className="font-mono font-medium">{change.change_control_number}</p>
              <CcStatusBadge status={change.status} />
              <CcRiskBadge category={change.change_category} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Validation Category</CardTitle></CardHeader>
            <CardContent><CcValidationCategoryBadge category={assessment?.validation_category || watched.validation_category} /></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Status</CardTitle></CardHeader>
            <CardContent><CcValidationStatusBadge status={assessment?.status} /><CcValidationProgress assessment={assessment} /></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Impact Summary</CardTitle></CardHeader>
            <CardContent className="flex flex-wrap gap-1">
              <CcImpactBadge label="Validation" active={watched.validation_impact} />
              <CcImpactBadge label="CSV" active={watched.csv_impact} />
              <CcImpactBadge label="Revalidation" active={watched.revalidation_required} />
            </CardContent>
          </Card>
        </div>

        {recommendations.length > 0 && (
          <Alert>
            <ShieldCheck className="h-4 w-4" />
            <AlertTitle>Validation Recommendations</AlertTitle>
            <AlertDescription><ul className="list-disc pl-4 mt-1">{recommendations.map((r) => <li key={r}>{r}</li>)}</ul></AlertDescription>
          </Alert>
        )}

        <Form {...form}>
          <Tabs defaultValue="overview">
            <TabsList className="flex h-auto flex-wrap">
              {['overview', 'impact', 'qualification', 'csv', 'annex11', 'deliverables', 'qa', 'audit'].map((t) => {
                const labels: Record<string, string> = {
                  overview: 'Overview', impact: 'Validation Impact', qualification: 'Qualification Review',
                  csv: 'CSV Assessment', annex11: 'Annex 11 Review', deliverables: 'Deliverables',
                  qa: 'QA Review', audit: 'Audit Trail',
                };
                return <TabsTrigger key={t} value={t}>{labels[t]}</TabsTrigger>;
              })}
            </TabsList>

            <TabsContent value="overview" className="mt-4 space-y-4">
              <Card>
                <CardHeader><CardTitle>Assessment Overview</CardTitle><CardDescription>{change.change_title}</CardDescription></CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <FormField control={form.control} name="assessment_date" render={({ field }) => (
                    <FormItem><FormLabel>Assessment Date *</FormLabel><FormControl><Input type="date" {...field} disabled={!canEdit} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="department" render={({ field }) => (
                    <FormItem><FormLabel>Department *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value} disabled={!canEdit}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>{CC_DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                      </Select><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="validation_category" render={({ field }) => (
                    <FormItem><FormLabel>Validation Category *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value} disabled={!canEdit}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>{CC_VALIDATION_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                      </Select><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="system_type" render={({ field }) => (
                    <FormItem><FormLabel>System Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value} disabled={!canEdit}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>{CC_VALIDATION_SYSTEM_TYPES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                      </Select></FormItem>
                  )} />
                  <FormField control={form.control} name="validation_owner" render={({ field }) => (
                    <FormItem><FormLabel>Validation Owner *</FormLabel><FormControl><Input {...field} disabled={!canEdit} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="target_completion_date" render={({ field }) => (
                    <FormItem><FormLabel>Target Completion Date *</FormLabel><FormControl><Input type="date" {...field} disabled={!canEdit} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <div className="md:col-span-2">
                    <FormField control={form.control} name="validation_justification" render={({ field }) => (
                      <FormItem><FormLabel>Validation Justification *</FormLabel><FormControl><Textarea rows={4} {...field} disabled={!canEdit} /></FormControl><FormMessage /></FormItem>
                    )} />
                  </div>
                  <div className="md:col-span-2">
                    <FormField control={form.control} name="validation_scope" render={({ field }) => (
                      <FormItem><FormLabel>Validation Scope / Revalidation Plan</FormLabel><FormControl><Textarea rows={3} {...field} disabled={!canEdit} placeholder="Define revalidation scope when required..." /></FormControl></FormItem>
                    )} />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="impact" className="mt-4">
              <Card>
                <CardHeader><CardTitle>Validation Impact</CardTitle></CardHeader>
                <CardContent className="grid gap-3 md:grid-cols-2">
                  <BoolField form={form} name="validation_impact" label="Validation Impact" disabled={!canEdit} />
                  <BoolField form={form} name="qualification_impact" label="Qualification Impact" disabled={!canEdit} />
                  <BoolField form={form} name="csv_impact" label="CSV Impact" disabled={!canEdit} />
                  <BoolField form={form} name="data_integrity_impact" label="Data Integrity Impact" disabled={!canEdit} />
                  <BoolField form={form} name="regulatory_impact" label="Regulatory Impact" disabled={!canEdit && !canRegulatory} />
                  <BoolField form={form} name="revalidation_required" label="Revalidation Required" disabled={!canEdit} />
                  <FormField control={form.control} name="affected_system" render={({ field }) => (
                    <FormItem className="md:col-span-2"><FormLabel>Affected System</FormLabel><FormControl><Input {...field} disabled={!canEdit} /></FormControl></FormItem>
                  )} />
                  <FormField control={form.control} name="risk_based_rationale" render={({ field }) => (
                    <FormItem className="md:col-span-2"><FormLabel>Risk Based Rationale</FormLabel><FormControl><Textarea rows={3} {...field} disabled={!canEdit} /></FormControl></FormItem>
                  )} />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="qualification" className="mt-4">
              <Card>
                <CardHeader><CardTitle>Qualification Review</CardTitle><CardDescription>IQ/OQ/PQ assessment for equipment and utility impacts</CardDescription></CardHeader>
                <CardContent className="space-y-4">
                  <FormField control={form.control} name="affected_equipment" render={({ field }) => (
                    <FormItem><FormLabel>Affected Equipment</FormLabel><FormControl><Textarea rows={2} {...field} disabled={!canEdit && !canQualification} /></FormControl></FormItem>
                  )} />
                  <FormField control={form.control} name="affected_process" render={({ field }) => (
                    <FormItem><FormLabel>Affected Process</FormLabel><FormControl><Textarea rows={2} {...field} disabled={!canEdit && !canQualification} /></FormControl></FormItem>
                  )} />
                  <BoolField form={form} name="qualification_review_completed" label="Qualification review completed" disabled={!canEdit && !canQualification} />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="csv" className="mt-4">
              <Card>
                <CardHeader><CardTitle>CSV Assessment (GAMP5)</CardTitle></CardHeader>
                <CardContent className="grid gap-3 md:grid-cols-2">
                  <FormField control={form.control} name="gamp_category" render={({ field }) => (
                    <FormItem><FormLabel>GAMP Category {watched.csv_impact ? '*' : ''}</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value} disabled={!canCsv}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger></FormControl>
                        <SelectContent>{CC_GAMP_CATEGORIES.map((g) => <SelectItem key={g} value={g}>Category {g}</SelectItem>)}</SelectContent>
                      </Select></FormItem>
                  )} />
                  <BoolField form={form} name="csv_assessment_completed" label="CSV assessment completed" disabled={!canCsv} />
                  <BoolField form={form} name="electronic_records_impact" label="Electronic records impact" disabled={!canCsv} />
                  <BoolField form={form} name="electronic_signature_impact" label="Electronic signature impact" disabled={!canCsv} />
                  <BoolField form={form} name="audit_trail_impact" label="Audit trail impact" disabled={!canCsv} />
                  <BoolField form={form} name="security_impact" label="Security impact" disabled={!canCsv} />
                  <BoolField form={form} name="backup_impact" label="Backup impact" disabled={!canCsv} />
                  <BoolField form={form} name="disaster_recovery_impact" label="Disaster recovery impact" disabled={!canCsv} />
                  <BoolField form={form} name="part_11_impact" label="21 CFR Part 11 impact" disabled={!canCsv} />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="annex11" className="mt-4">
              <Card>
                <CardHeader><CardTitle>Annex 11 Review</CardTitle><CardDescription>Required when data integrity impact is identified</CardDescription></CardHeader>
                <CardContent className="space-y-4">
                  <BoolField form={form} name="annex_11_impact" label="Annex 11 impact identified" disabled={!canCsv} />
                  <BoolField form={form} name="annex_11_review_completed" label="Annex 11 review completed" disabled={!canCsv} />
                  {watched.data_integrity_impact && !watched.annex_11_review_completed && (
                    <Alert variant="destructive">
                      <AlertTitle>Annex 11 Review Mandatory</AlertTitle>
                      <AlertDescription>Data integrity impact requires Annex 11 compliance review before approval.</AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="deliverables" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Validation Deliverables</CardTitle>
                  <CardDescription>Suggested: {suggestedDeliverables.join(', ') || 'None'}</CardDescription>
                </CardHeader>
                <CardContent>
                  <FormField control={form.control} name="validation_deliverables" render={({ field }) => (
                    <FormItem>
                      <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
                        {CC_VALIDATION_DELIVERABLES.map((d) => (
                          <label key={d} className="flex items-center gap-2 rounded border p-2 text-sm">
                            <Checkbox
                              checked={field.value?.includes(d)}
                              disabled={!canEdit}
                              onCheckedChange={(checked) => {
                                const next = checked ? [...(field.value || []), d] : (field.value || []).filter((x) => x !== d);
                                field.onChange(next);
                              }}
                            />
                            {d}
                          </label>
                        ))}
                      </div>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="affected_documents" render={({ field }) => (
                    <FormItem className="mt-4"><FormLabel>Affected Documents</FormLabel><FormControl><Textarea rows={2} {...field} disabled={!canEdit} /></FormControl></FormItem>
                  )} />
                  <FormField control={form.control} name="affected_sops" render={({ field }) => (
                    <FormItem className="mt-4"><FormLabel>Affected SOPs</FormLabel><FormControl><Textarea rows={2} {...field} disabled={!canEdit} /></FormControl></FormItem>
                  )} />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="qa" className="mt-4 space-y-4">
              <Card>
                <CardHeader><CardTitle>QA Review</CardTitle></CardHeader>
                <CardContent>
                  <FormField control={form.control} name="qa_comments" render={({ field }) => (
                    <FormItem><FormLabel>QA Comments</FormLabel><FormControl><Textarea rows={3} {...field} disabled={!canEdit && !canApprove} /></FormControl></FormItem>
                  )} />
                  {needsHeadQa && (
                    <FormField control={form.control} name="head_qa_comments" render={({ field }) => (
                      <FormItem className="mt-4"><FormLabel>Head QA Comments</FormLabel><FormControl><Textarea rows={3} {...field} disabled={!canApprove} /></FormControl></FormItem>
                    )} />
                  )}
                </CardContent>
              </Card>
              {showQaDecision && (
                <Form {...qaForm}>
                  <Card>
                    <CardHeader><CardTitle>QA Approval Decision</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                      <FormField control={qaForm.control} name="decision" render={({ field }) => (
                        <FormItem><FormLabel>Decision</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                            <SelectContent>
                              <SelectItem value="approved">Approve{needsHeadQa ? ' (forward to Head QA)' : ''}</SelectItem>
                              <SelectItem value="rejected">Reject</SelectItem>
                            </SelectContent>
                          </Select></FormItem>
                      )} />
                      <FormField control={qaForm.control} name="qa_comments" render={({ field }) => (
                        <FormItem><FormLabel>QA Comments *</FormLabel><FormControl><Textarea rows={3} {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <Button onClick={() => void handleQaReview(false)} disabled={busy}>
                        {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                        Submit QA Decision
                      </Button>
                    </CardContent>
                  </Card>
                </Form>
              )}
              {showHeadQaDecision && (
                <Form {...qaForm}>
                  <Card>
                    <CardHeader><CardTitle>Head QA Approval Decision</CardTitle></CardHeader>
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
                      <FormField control={qaForm.control} name="head_qa_comments" render={({ field }) => (
                        <FormItem><FormLabel>Head QA Comments *</FormLabel><FormControl><Textarea rows={3} {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <Button onClick={() => void handleQaReview(true)} disabled={busy}>
                        {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                        Submit Head QA Decision
                      </Button>
                    </CardContent>
                  </Card>
                </Form>
              )}
            </TabsContent>

            <TabsContent value="audit" className="mt-4">
              <CcValidationTimeline auditLogs={auditLogs} />
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
    </CcValidationAccessGuard>
  );
}
