'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, ArrowRight, Loader2, Paperclip, Save, Send } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/auth-context';
import {
  buildCreateSummary,
  computeCcCreateAutoRules,
  suggestRiskAssessment,
} from '@/lib/cc-create-records';
import {
  changeCreateSchema,
  ccCreateStep1Schema,
  ccCreateStep2Schema,
  ccCreateStep3Schema,
  ccCreateStep4Schema,
  ccCreateStep5Schema,
  CHANGE_TYPES,
  CHANGE_CATEGORIES,
  CHANGE_PRIORITIES,
  CC_DEPARTMENTS,
  TEMPORARY_OPTIONS,
  type ChangeCreateInput,
} from '@/lib/change-control-schemas';
import {
  fetchCcCreateLookups,
  lookupCcBatch,
  saveCcCreateDraft,
  submitCcChangeControl,
} from '@/lib/cc-create-service';
import { CpvPageHeader } from '@/components/cpv/product-master/cpv-page-header';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { CcCreateAccessGuard } from './cc-create-access-guard';
import { CcCreateWizard } from './cc-create-wizard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { CcBatchOption, CcProductOption } from '@/lib/cc-create-records';

const STEP_SCHEMAS = [ccCreateStep1Schema, ccCreateStep2Schema, ccCreateStep3Schema, ccCreateStep4Schema, ccCreateStep5Schema, changeCreateSchema];

function ImpactSwitch({ form, name, label }: { form: ReturnType<typeof useForm<ChangeCreateInput>>; name: keyof ChangeCreateInput; label: string }) {
  return (
    <FormField control={form.control} name={name as 'regulatory_impact'} render={({ field }) => (
      <FormItem className="flex items-center justify-between rounded-lg border p-3">
        <FormLabel className="text-sm font-normal">{label}</FormLabel>
        <FormControl><Switch checked={!!field.value} onCheckedChange={field.onChange} /></FormControl>
      </FormItem>
    )} />
  );
}

export function CcCreatePage() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [previewNumber, setPreviewNumber] = useState('');
  const [draftId, setDraftId] = useState<string | null>(null);
  const [products, setProducts] = useState<CcProductOption[]>([]);
  const [batches, setBatches] = useState<CcBatchOption[]>([]);
  const [batchLink, setBatchLink] = useState<{ pqr_id?: string | null; cpv_id?: string | null }>({});

  const actor = useMemo(() => ({
    id: user?.uid || 'system',
    name: profile?.full_name || profile?.email || 'User',
    role: profile?.role || '',
    department: profile?.department || '',
  }), [user?.uid, profile?.full_name, profile?.email, profile?.role, profile?.department]);

  const form = useForm<ChangeCreateInput>({
    resolver: zodResolver(changeCreateSchema),
    defaultValues: {
      change_date: new Date().toISOString().split('T')[0],
      department: (profile?.department as ChangeCreateInput['department']) || 'QA',
      initiated_by_name: profile?.full_name || '',
      product_name: '',
      batch_number: '',
      change_title: '',
      change_description: '',
      current_system: '',
      proposed_change: '',
      reason_for_change: '',
      change_type: 'Process Change',
      change_category: 'Minor',
      change_priority: 'Medium',
      temporary_permanent: 'Permanent',
      planned_implementation_date: '',
      target_closure_date: '',
      affected_documents: '',
      affected_equipment: '',
      affected_material: '',
      affected_vendor: '',
      affected_process: '',
      affected_product: '',
      regulatory_impact: false,
      validation_impact: false,
      csv_impact: false,
      training_impact: false,
      stability_impact: false,
      quality_impact: false,
      patient_safety_impact: false,
      market_impact: false,
      risk_assessment_required: true,
      capa_required: false,
      effectiveness_check_required: true,
      assigned_owner: user?.uid || '',
      assigned_owner_name: profile?.full_name || '',
      qa_reviewer: '',
      qa_reviewer_name: '',
      remarks: '',
      qa_remarks: '',
    },
  });

  const watchCategory = form.watch('change_category');
  const watchValues = form.watch();
  const autoRules = computeCcCreateAutoRules({
    change_category: watchCategory,
    regulatory_impact: watchValues.regulatory_impact,
    csv_impact: watchValues.csv_impact,
    validation_impact: watchValues.validation_impact,
    training_impact: watchValues.training_impact,
    capa_required: watchValues.capa_required,
  });

  const load = useCallback(async () => {
    setLoading(true);
    const data = await fetchCcCreateLookups();
    setProducts(data.products);
    setBatches(data.batches);
    setPreviewNumber(data.previewNumber);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (suggestRiskAssessment({
      change_category: watchCategory,
      regulatory_impact: watchValues.regulatory_impact,
      patient_safety_impact: watchValues.patient_safety_impact,
      validation_impact: watchValues.validation_impact,
    })) {
      form.setValue('risk_assessment_required', true);
    }
  }, [watchCategory, watchValues.regulatory_impact, watchValues.patient_safety_impact, watchValues.validation_impact, form]);

  const handleBatchChange = async (batchNumber: string) => {
    form.setValue('batch_number', batchNumber);
    if (!batchNumber) { setBatchLink({}); return; }
    const link = await lookupCcBatch(batchNumber);
    setBatchLink(link);
    const batch = batches.find((b) => b.batch_number === batchNumber);
    if (batch?.product_name) form.setValue('product_name', batch.product_name);
  };

  const validateStep = async () => {
    const schema = STEP_SCHEMAS[step - 1];
    const values = form.getValues();
    const result = schema.safeParse(values);
    if (!result.success) {
      for (const issue of result.error.issues) {
        const path = issue.path[0] as keyof ChangeCreateInput;
        form.setError(path, { message: issue.message });
      }
      return false;
    }
    return true;
  };

  const handleNext = async () => {
    if (!(await validateStep())) return;
    setStep((s) => Math.min(s + 1, 6));
  };

  const handleSaveDraft = async () => {
    setBusy(true);
    const res = await saveCcCreateDraft(form.getValues(), actor, draftId);
    setBusy(false);
    if (res.error) { toast.error(res.error); return; }
    setDraftId(res.record?.id || null);
    toast.success(`Draft saved — ${res.record?.change_control_number}`);
  };

  const handleSubmit = async () => {
    const valid = await form.trigger();
    if (!valid) return;
    setBusy(true);
    const res = await submitCcChangeControl(form.getValues(), actor, draftId);
    setBusy(false);
    if (res.error) { toast.error(res.error); return; }
    toast.success(`Change ${res.record?.change_control_number} submitted`);
    router.push(`/qms/change-control/${res.record?.id}`);
  };

  if (loading) return <LoadingSkeleton rows={6} />;

  const summary = buildCreateSummary({
    change_control_number: draftId ? undefined : previewNumber,
    ...form.getValues(),
  });

  return (
    <CcCreateAccessGuard>
      <div className="space-y-6">
        <CpvPageHeader
          title="Create Change Control"
          description="Initiate GMP change control with impact, risk and implementation routing"
          trail={[
            { label: 'Dashboard', href: '/dashboard' },
            { label: 'QMS', href: '/qms/change-control' },
            { label: 'Change Control', href: '/qms/change-control' },
            { label: 'Create Change Control' },
          ]}
          actions={(
            <Link href="/qms/change-control">
              <Button variant="outline" size="sm"><ArrowLeft className="mr-2 h-4 w-4" />Back</Button>
            </Link>
          )}
        />

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Preview Change Control Number</CardDescription>
            <CardTitle className="font-mono text-blue-600">{previewNumber}</CardTitle>
          </CardHeader>
        </Card>

        <CcCreateWizard step={step} />

        {(autoRules.headQaRequired || autoRules.notifyRegulatory || autoRules.notifyCsv) && (
          <Alert>
            <AlertTitle>Workflow Alerts</AlertTitle>
            <AlertDescription className="space-y-1">
              {autoRules.headQaRequired && <p>Head QA approval is mandatory for Critical changes.</p>}
              {autoRules.notifyRegulatory && <p>Regulatory Affairs will be notified on submit.</p>}
              {autoRules.notifyCsv && <p>IT/CSV team will be notified on submit.</p>}
            </AlertDescription>
          </Alert>
        )}

        <Form {...form}>
          <form onSubmit={(e) => e.preventDefault()} className="space-y-6">
            {step === 1 && (
              <Card>
                <CardHeader><CardTitle>General Information</CardTitle></CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  <FormField control={form.control} name="change_date" render={({ field }) => (
                    <FormItem><FormLabel>Change Date *</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="department" render={({ field }) => (
                    <FormItem><FormLabel>Department *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>{CC_DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                      </Select><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="initiated_by_name" render={({ field }) => (
                    <FormItem><FormLabel>Initiated By *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="change_type" render={({ field }) => (
                    <FormItem><FormLabel>Change Type *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>{CHANGE_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                      </Select><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="change_category" render={({ field }) => (
                    <FormItem><FormLabel>Change Category *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>{CHANGE_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                      </Select>
                      {field.value === 'Critical' && <FormDescription className="text-amber-600">Head QA approval mandatory.</FormDescription>}
                      <FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="change_priority" render={({ field }) => (
                    <FormItem><FormLabel>Priority *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>{CHANGE_PRIORITIES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                      </Select><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="temporary_permanent" render={({ field }) => (
                    <FormItem><FormLabel>Temporary / Permanent</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>{TEMPORARY_OPTIONS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                      </Select></FormItem>
                  )} />
                </CardContent>
              </Card>
            )}

            {step === 2 && (
              <Card>
                <CardHeader><CardTitle>Change Description</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <FormField control={form.control} name="change_title" render={({ field }) => (
                    <FormItem><FormLabel>Change Title *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="change_description" render={({ field }) => (
                    <FormItem><FormLabel>Change Description *</FormLabel><FormControl><Textarea rows={3} {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <div className="grid md:grid-cols-2 gap-4">
                    <FormField control={form.control} name="current_system" render={({ field }) => (
                      <FormItem><FormLabel>Current System / Process *</FormLabel><FormControl><Textarea rows={3} {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="proposed_change" render={({ field }) => (
                      <FormItem><FormLabel>Proposed Change *</FormLabel><FormControl><Textarea rows={3} {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                  </div>
                  <FormField control={form.control} name="reason_for_change" render={({ field }) => (
                    <FormItem><FormLabel>Reason For Change *</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </CardContent>
              </Card>
            )}

            {step === 3 && (
              <Card>
                <CardHeader><CardTitle>Product & Affected Areas</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <FormField control={form.control} name="product_name" render={({ field }) => (
                      <FormItem><FormLabel>Product Name</FormLabel>
                        <Select onValueChange={(v) => field.onChange(v === 'none' ? '' : v)} value={field.value || 'none'}>
                          <FormControl><SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="none">None</SelectItem>
                            {products.map((p) => <SelectItem key={p.id} value={p.product_name}>{p.product_name}</SelectItem>)}
                          </SelectContent>
                        </Select></FormItem>
                    )} />
                    <FormField control={form.control} name="batch_number" render={({ field }) => (
                      <FormItem><FormLabel>Batch Number</FormLabel>
                        <Select onValueChange={(v) => void handleBatchChange(v === 'none' ? '' : v)} value={field.value || 'none'}>
                          <FormControl><SelectTrigger><SelectValue placeholder="Select batch" /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="none">None</SelectItem>
                            {batches.filter((b) => !form.watch('product_name') || b.product_name === form.watch('product_name')).map((b) => (
                              <SelectItem key={b.id} value={b.batch_number}>{b.batch_number}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {(batchLink.pqr_id || batchLink.cpv_id) && (
                          <FormDescription>Linked to PQR {batchLink.pqr_id ? '✓' : ''} CPV {batchLink.cpv_id ? '✓' : ''}</FormDescription>
                        )}</FormItem>
                    )} />
                  </div>
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {([
                      ['affected_documents', 'Affected Documents'],
                      ['affected_equipment', 'Affected Equipment'],
                      ['affected_material', 'Affected Material'],
                      ['affected_vendor', 'Affected Vendor'],
                      ['affected_process', 'Affected Process'],
                      ['affected_product', 'Affected Product'],
                    ] as const).map(([name, label]) => (
                      <FormField key={name} control={form.control} name={name} render={({ field }) => (
                        <FormItem><FormLabel>{label}</FormLabel><FormControl><Input {...field} placeholder="Comma-separated" /></FormControl></FormItem>
                      )} />
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {step === 4 && (
              <Card>
                <CardHeader><CardTitle>Impact Quick Checklist</CardTitle></CardHeader>
                <CardContent className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <ImpactSwitch form={form} name="regulatory_impact" label="Regulatory Impact" />
                  <ImpactSwitch form={form} name="validation_impact" label="Validation Impact" />
                  <ImpactSwitch form={form} name="csv_impact" label="CSV Impact" />
                  <ImpactSwitch form={form} name="training_impact" label="Training Impact" />
                  <ImpactSwitch form={form} name="stability_impact" label="Stability Impact" />
                  <ImpactSwitch form={form} name="quality_impact" label="Quality Impact" />
                  <ImpactSwitch form={form} name="patient_safety_impact" label="Patient Safety Impact" />
                  <ImpactSwitch form={form} name="market_impact" label="Market Impact" />
                  <ImpactSwitch form={form} name="risk_assessment_required" label="Risk Assessment Required" />
                  <ImpactSwitch form={form} name="capa_required" label="CAPA Required" />
                  <ImpactSwitch form={form} name="effectiveness_check_required" label="Effectiveness Check Required" />
                </CardContent>
              </Card>
            )}

            {step === 5 && (
              <Card>
                <CardHeader><CardTitle>Assignment & Workflow</CardTitle></CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <FormField control={form.control} name="planned_implementation_date" render={({ field }) => (
                    <FormItem><FormLabel>Planned Implementation Date *</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="target_closure_date" render={({ field }) => (
                    <FormItem><FormLabel>Target Closure Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl></FormItem>
                  )} />
                  <FormField control={form.control} name="assigned_owner" render={({ field }) => (
                    <FormItem><FormLabel>Assigned Owner ID *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="assigned_owner_name" render={({ field }) => (
                    <FormItem><FormLabel>Assigned Owner Name</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                  )} />
                  <FormField control={form.control} name="qa_reviewer" render={({ field }) => (
                    <FormItem><FormLabel>QA Reviewer ID *</FormLabel><FormControl><Input {...field} placeholder="User UID" /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="qa_reviewer_name" render={({ field }) => (
                    <FormItem><FormLabel>QA Reviewer Name</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                  )} />
                  <FormField control={form.control} name="remarks" render={({ field }) => (
                    <FormItem className="md:col-span-2"><FormLabel>Remarks</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl></FormItem>
                  )} />
                  <div className="md:col-span-2 rounded-lg border border-dashed p-4 text-sm text-muted-foreground flex items-center gap-2">
                    <Paperclip className="h-4 w-4" />
                    Attachment upload available after change control is created.
                  </div>
                </CardContent>
              </Card>
            )}

            {step === 6 && (
              <Card>
                <CardHeader><CardTitle>Review & Submit</CardTitle><CardDescription>Verify all details before submitting to QA.</CardDescription></CardHeader>
                <CardContent>
                  <dl className="grid gap-2 sm:grid-cols-2 text-sm">
                    {summary.map((row) => (
                      <div key={row.label} className="flex justify-between gap-4 border-b py-2">
                        <dt className="text-muted-foreground">{row.label}</dt>
                        <dd className="font-medium text-right">{row.value || '—'}</dd>
                      </div>
                    ))}
                  </dl>
                  <div className="mt-4 flex flex-wrap gap-2 text-xs">
                    {watchValues.regulatory_impact && <span className="rounded-full bg-amber-100 px-2 py-1 text-amber-800">Regulatory</span>}
                    {watchValues.validation_impact && <span className="rounded-full bg-purple-100 px-2 py-1 text-purple-800">Validation</span>}
                    {watchValues.csv_impact && <span className="rounded-full bg-indigo-100 px-2 py-1 text-indigo-800">CSV</span>}
                    {watchValues.training_impact && <span className="rounded-full bg-green-100 px-2 py-1 text-green-800">Training</span>}
                    {watchValues.capa_required && <span className="rounded-full bg-red-100 px-2 py-1 text-red-800">CAPA</span>}
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="flex flex-wrap gap-2 justify-between border-t pt-4">
              <div className="flex gap-2">
                {step > 1 && (
                  <Button type="button" variant="outline" onClick={() => setStep((s) => s - 1)} disabled={busy}>
                    <ArrowLeft className="mr-2 h-4 w-4" />Back
                  </Button>
                )}
                <Button type="button" variant="outline" onClick={() => void handleSaveDraft()} disabled={busy}>
                  {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Save Draft
                </Button>
              </div>
              <div className="flex gap-2">
                {step < 6 ? (
                  <Button type="button" onClick={() => void handleNext()} disabled={busy}>
                    Next<ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                ) : (
                  <Button type="button" onClick={() => void handleSubmit()} disabled={busy} className="bg-blue-600 hover:bg-blue-700">
                    {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                    Submit Change Control
                  </Button>
                )}
              </div>
            </div>
          </form>
        </Form>
      </div>
    </CcCreateAccessGuard>
  );
}
