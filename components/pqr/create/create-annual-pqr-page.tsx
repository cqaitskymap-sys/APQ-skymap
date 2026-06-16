'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, ArrowRight, CheckCircle2, FileSpreadsheet, FileText, Loader2, Save, Send, Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/auth-context';
import { isFirebaseConfigured } from '@/lib/firebase';
import {
  PQR_FREQUENCIES, REVIEW_SCOPE_OPTIONS,
  canExportAnnualPqr, defaultReviewScope, reviewPeriodSchema,
  type PqrCollectedData, type PqrProductOption, type PqrSectionRecord,
} from '@/lib/pqr-create-records';
import {
  checkPqrPeriodOverlap, collectPqrData, computeOverallAssessment,
  createAnnualPqrDraft, fetchPqrCreateProducts, fetchPqrSections,
  generateAnnualPqrNumber, logPqrCreateExport, logPqrCreateOverride,
  logPqrCreatePeriodSelected, logPqrCreateProductSelected, logPqrCreateView,
  savePqrDraft, submitPqrForReview, updatePqrSectionNarrative, uploadPqrAttachment,
} from '@/lib/pqr-create-service';
import { CpvPageHeader } from '@/components/cpv/product-master/cpv-page-header';
import { KpiCard } from '@/components/cpv/cpv-ui';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { EmptyState } from '@/components/admin/dashboard/empty-state';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { PqrCreateAccessGuard } from './pqr-create-access-guard';
import { DataPreviewCard } from './data-preview-card';
import { PqrSectionEditor } from './pqr-section-editor';
import { AttachmentUploader } from './attachment-uploader';
import { PqrWizard } from './pqr-wizard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { qualityStatusColor, riskLevelColor } from '@/lib/pqr-create-records';

const YEAR_OPTIONS = [2023, 2024, 2025, 2026, 2027];

export function CreateAnnualPqrPage() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const canExport = canExportAnnualPqr(profile?.role);

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [products, setProducts] = useState<PqrProductOption[]>([]);

  const [productId, setProductId] = useState('');
  const [reviewYear, setReviewYear] = useState(new Date().getFullYear());
  const [periodFrom, setPeriodFrom] = useState(`${reviewYear}-01-01`);
  const [periodTo, setPeriodTo] = useState(`${reviewYear}-12-31`);
  const [pqrFrequency, setPqrFrequency] = useState<(typeof PQR_FREQUENCIES)[number]>('Yearly');
  const [dueDate, setDueDate] = useState(`${reviewYear + 1}-03-31`);
  const [pqrOwner, setPqrOwner] = useState('');
  const [reviewScope, setReviewScope] = useState(defaultReviewScope());
  const [collectedData, setCollectedData] = useState<PqrCollectedData | null>(null);
  const [pqrNumber, setPqrNumber] = useState('');
  const [pqrId, setPqrId] = useState<string | null>(null);
  const [sections, setSections] = useState<PqrSectionRecord[]>([]);
  const [executiveSummary, setExecutiveSummary] = useState('');
  const [conclusion, setConclusion] = useState('');
  const [recommendations, setRecommendations] = useState('');
  const [remarks, setRemarks] = useState('');
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [overlapWarning, setOverlapWarning] = useState<string | null>(null);

  const selected = useMemo(() => {
    const [source, id] = productId.includes(':') ? productId.split(':') : ['', productId];
    return products.find((p) => (source ? p.source === source && p.id === id : p.id === productId)) || null;
  }, [products, productId]);
  const actor = useMemo(() => ({
    id: user?.uid || 'system',
    name: profile?.full_name || profile?.email || 'System',
    role: profile?.role,
  }), [user?.uid, profile?.full_name, profile?.email, profile?.role]);

  const assessment = useMemo(
    () => (collectedData ? computeOverallAssessment(collectedData.summary) : null),
    [collectedData],
  );

  const loadProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (!isFirebaseConfigured()) {
        setError('Firebase is not configured. Set environment variables to create PQR records.');
        return;
      }
      setProducts(await fetchPqrCreateProducts());
    } catch {
      setError('Failed to load products.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadProducts(); void logPqrCreateView(actor); }, [loadProducts, actor]);

  useEffect(() => {
    setPeriodFrom(`${reviewYear}-01-01`);
    setPeriodTo(`${reviewYear}-12-31`);
    setDueDate(`${reviewYear + 1}-03-31`);
  }, [reviewYear]);

  useEffect(() => {
    if (selected) {
      void generateAnnualPqrNumber(selected.productCode, reviewYear).then(setPqrNumber);
    }
  }, [selected, reviewYear]);

  useEffect(() => {
    if (assessment) {
      setConclusion(assessment.conclusion);
      setRecommendations(assessment.recommendations);
    }
  }, [assessment]);

  const validatePeriod = async (allowOverride = false) => {
    const parsed = reviewPeriodSchema.safeParse({
      reviewPeriodFrom: periodFrom,
      reviewPeriodTo: periodTo,
      reviewYear,
      pqrFrequency,
      dueDate,
    });
    if (!parsed.success) {
      toast.error(parsed.error.errors[0]?.message || 'Invalid review period');
      return false;
    }
    if (!selected) return false;
    const { overlap, existingPqrNumber } = await checkPqrPeriodOverlap(selected.id, selected.productName, periodFrom, periodTo);
    if (overlap && !allowOverride) {
      setOverlapWarning(`Approved PQR ${existingPqrNumber} exists for overlapping period. QA override required.`);
      setOverrideOpen(true);
      return false;
    }
    setOverlapWarning(null);
    await logPqrCreatePeriodSelected(actor, periodFrom, periodTo);
    return true;
  };

  const runDataCollection = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      const data = await collectPqrData(selected, periodFrom, periodTo, reviewScope, actor);
      setCollectedData(data);
      setExecutiveSummary(
        `Annual PQR for ${selected.productName} (${periodFrom} to ${periodTo}). `
        + `${data.summary.totalBatches} batches, ${data.summary.deviations} deviations, ${data.summary.oos} OOS reviewed.`,
      );
      toast.success('Data collection completed');
      setStep(5);
    } catch {
      toast.error('Data collection failed');
    } finally {
      setBusy(false);
    }
  };

  const generateDraft = async () => {
    if (!selected || !collectedData) return;
    setBusy(true);
    try {
      const result = await createAnnualPqrDraft({
        product: selected,
        reviewPeriodFrom: periodFrom,
        reviewPeriodTo: periodTo,
        reviewYear,
        pqrFrequency,
        dueDate,
        pqrOwner: pqrOwner || actor.name,
        reviewScope,
        collectedData,
        pqrNumber,
        qaOverride: Boolean(overlapWarning),
        actor,
      });
      if (result.error || !result.pqrId) {
        toast.error(result.error || 'Failed to generate PQR draft');
        return;
      }
      setPqrId(result.pqrId);
      const loaded = await fetchPqrSections(result.pqrId);
      setSections(loaded.length ? loaded : result.sections.map((s, i) => ({ ...s, id: `local-${i}` })));
      toast.success(`PQR ${result.pqrNumber} draft generated with ${loaded.length || result.sections.length} sections`);
      setStep(7);
    } catch {
      toast.error('Failed to generate PQR draft');
    } finally {
      setBusy(false);
    }
  };

  const handleSectionChange = async (sectionId: string, narrative: string) => {
    setSections((prev) => prev.map((s) => (s.id === sectionId ? { ...s, narrative } : s)));
    if (!sectionId.startsWith('local-')) {
      await updatePqrSectionNarrative(sectionId, narrative, actor);
    }
  };

  const handleSaveDraft = async () => {
    if (!pqrId) return;
    setBusy(true);
    const { error: err } = await savePqrDraft(pqrId, {
      executiveSummary, conclusion, recommendations, remarks, status: 'Draft',
    }, actor);
    setBusy(false);
    if (err) toast.error(err);
    else toast.success('Draft saved');
  };

  const handleSubmit = async () => {
    if (!pqrId) return;
    setBusy(true);
    await savePqrDraft(pqrId, { executiveSummary, conclusion, recommendations, remarks }, actor);
    const { error: err } = await submitPqrForReview(pqrId, actor);
    setBusy(false);
    if (err) toast.error(err);
    else {
      toast.success('PQR submitted for review');
      router.push(`/pqr/${pqrId}`);
    }
  };

  const nextStep = async () => {
    if (step === 1) {
      if (!selected) return toast.error('Select a product');
      await logPqrCreateProductSelected(actor, selected);
      setStep(2);
    } else if (step === 2) {
      const ok = await validatePeriod();
      if (ok) setStep(3);
    } else if (step === 3) {
      setStep(4);
    } else if (step === 4) {
      await runDataCollection();
    } else if (step === 5) {
      setStep(6);
    } else if (step === 6) {
      await generateDraft();
    } else if (step === 7) {
      setStep(8);
    }
  };

  const exportPdf = () => {
    void logPqrCreateExport(actor, 'pdf');
    toast.info('PDF generation will be available in a future release.');
  };

  const exportExcel = () => {
    void logPqrCreateExport(actor, 'excel');
    toast.info('Excel export will be available in a future release.');
  };

  if (loading) {
    return (
      <PqrCreateAccessGuard>
        <div className="p-4 sm:p-6"><LoadingSkeleton rows={3} /></div>
      </PqrCreateAccessGuard>
    );
  }

  if (error) {
    return (
      <PqrCreateAccessGuard>
        <div className="p-4 sm:p-6"><ErrorCard message={error} onRetry={() => void loadProducts()} /></div>
      </PqrCreateAccessGuard>
    );
  }

  const summary = collectedData?.summary;

  return (
    <PqrCreateAccessGuard>
      <div className="space-y-6 p-4 sm:p-6 max-w-5xl mx-auto">
        <CpvPageHeader
          title="Create Annual PQR"
          description="Generate annual Product Quality Review from batch, quality, stability and QMS data"
          trail={[
            { label: 'Dashboard', href: '/dashboard' },
            { label: 'PQR Management', href: '/pqr/dashboard' },
            { label: 'Create Annual PQR' },
          ]}
          actions={canExport ? (
            <>
              <Button variant="outline" size="sm" onClick={exportPdf}><FileText className="h-4 w-4 mr-1" />PDF</Button>
              <Button variant="outline" size="sm" onClick={exportExcel}><FileSpreadsheet className="h-4 w-4 mr-1" />Excel</Button>
            </>
          ) : undefined}
        />

        <PqrWizard step={step} />

        {/* Step 1: Product */}
        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle>Step 1 — Select Product</CardTitle>
              <CardDescription>Choose product from Product Master or CPV Product Master</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Product *</Label>
                <Select value={productId} onValueChange={setProductId}>
                  <SelectTrigger><SelectValue placeholder="Select product..." /></SelectTrigger>
                  <SelectContent>
                    {products.map((p) => (
                      <SelectItem key={`${p.source}-${p.id}`} value={`${p.source}:${p.id}`}>
                        {p.productName} ({p.productCode})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {selected && (
                <div className="grid gap-3 sm:grid-cols-2 rounded-lg border bg-blue-50/50 p-4 text-sm">
                  {[
                    ['Product Code', selected.productCode], ['Generic Name', selected.genericName],
                    ['Brand Name', selected.brandName], ['Strength', selected.strength],
                    ['Dosage Form', selected.dosageForm], ['Route', selected.routeOfAdministration],
                    ['Pack Size', selected.packSize], ['Market', selected.market],
                    ['Shelf Life', selected.shelfLife], ['Storage', selected.storageCondition],
                    ['Mfg License', selected.manufacturingLicenseNumber], ['MFR', selected.mfrNumber],
                    ['BMR', selected.bmrNumber], ['BPR', selected.bprNumber],
                    ['Specification', selected.specificationNumber], ['STP', selected.stpNumber],
                  ].map(([k, v]) => (
                    <div key={k}><span className="text-muted-foreground">{k}: </span><span className="font-medium">{v || '—'}</span></div>
                  ))}
                </div>
              )}
              {!products.length && <EmptyState title="No products" message="Add products in Admin or CPV Product Master first." />}
            </CardContent>
          </Card>
        )}

        {/* Step 2: Review Period */}
        {step === 2 && (
          <Card>
            <CardHeader><CardTitle>Step 2 — Select Review Period</CardTitle></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label>Review Period From</Label><Input type="date" value={periodFrom} onChange={(e) => setPeriodFrom(e.target.value)} /></div>
              <div className="space-y-2"><Label>Review Period To</Label><Input type="date" value={periodTo} onChange={(e) => setPeriodTo(e.target.value)} /></div>
              <div className="space-y-2">
                <Label>Review Year</Label>
                <Select value={String(reviewYear)} onValueChange={(v) => setReviewYear(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{YEAR_OPTIONS.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>PQR Frequency</Label>
                <Select value={pqrFrequency} onValueChange={(v) => setPqrFrequency(v as typeof pqrFrequency)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PQR_FREQUENCIES.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Due Date</Label><Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></div>
              <div className="space-y-2"><Label>PQR Owner</Label><Input value={pqrOwner} onChange={(e) => setPqrOwner(e.target.value)} placeholder={actor.name} /></div>
              <div className="sm:col-span-2 space-y-2">
                <Label>PQR Number (Auto)</Label>
                <Input readOnly value={pqrNumber} className="font-mono bg-slate-50" />
              </div>
              {overlapWarning && <p className="sm:col-span-2 text-sm text-amber-700">{overlapWarning}</p>}
            </CardContent>
          </Card>
        )}

        {/* Step 3: Scope */}
        {step === 3 && (
          <Card>
            <CardHeader><CardTitle>Step 3 — Select Review Scope</CardTitle></CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2">
                {REVIEW_SCOPE_OPTIONS.map((opt) => (
                  <label key={opt.key} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={reviewScope[opt.key]}
                      onCheckedChange={(v) => setReviewScope((s) => ({ ...s, [opt.key]: Boolean(v) }))}
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 4: Collect */}
        {step === 4 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-blue-600" />Step 4 — Auto Collect Data</CardTitle>
              <CardDescription>Fetch batch, material, QC, yield, stability, deviation, OOS, CAPA and QMS data</CardDescription>
            </CardHeader>
            <CardContent>
              {busy ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
                  <Loader2 className="h-5 w-5 animate-spin" />Collecting data from Firebase...
                </div>
              ) : (
                <EmptyState title="Ready to collect" message="Click Next to pull data for the selected product and review period." />
              )}
            </CardContent>
          </Card>
        )}

        {/* Step 5: Preview */}
        {step === 5 && summary && (
          <div className="space-y-4">
            <div className="grid gap-3 grid-cols-2 md:grid-cols-4 lg:grid-cols-6">
              {[
                ['Total Batches', summary.totalBatches], ['Released', summary.releasedBatches], ['Rejected', summary.rejectedBatches],
                ['Raw Material Lots', summary.rawMaterialLots], ['Packing Lots', summary.packingMaterialLots],
                ['CPP Records', summary.cppRecords], ['CQA Records', summary.cqaRecords],
                ['Yield Records', summary.yieldRecords], ['Stability', summary.stabilityRecords],
                ['Deviations', summary.deviations], ['OOS', summary.oos], ['CAPA', summary.capa],
                ['Change Controls', summary.changeControls], ['Complaints', summary.complaints],
                ['Recalls', summary.recalls], ['Validation', summary.validationRecords],
                ['Equipment', summary.equipmentRecords], ['Avg Cpk', summary.averageCpk.toFixed(2)],
              ].map(([label, value]) => (
                <KpiCard key={String(label)} label={String(label)} value={value as string | number} />
              ))}
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <DataPreviewCard title="Batch Summary" items={[
                { label: 'Total', value: summary.totalBatches }, { label: 'Released', value: summary.releasedBatches },
                { label: 'Rejected', value: summary.rejectedBatches },
              ]} />
              <DataPreviewCard title="Material Summary" items={[
                { label: 'Raw Material Lots', value: summary.rawMaterialLots },
                { label: 'Packing Material Lots', value: summary.packingMaterialLots },
              ]} />
              <DataPreviewCard title="CPP / CQA Summary" items={[
                { label: 'CPP Records', value: summary.cppRecords }, { label: 'CQA Records', value: summary.cqaRecords },
              ]} />
              <DataPreviewCard title="Yield / Stability" items={[
                { label: 'Yield Records', value: summary.yieldRecords }, { label: 'Stability Records', value: summary.stabilityRecords },
              ]} />
              <DataPreviewCard title="Deviation / OOS / CAPA" items={[
                { label: 'Deviations', value: summary.deviations }, { label: 'OOS', value: summary.oos }, { label: 'CAPA', value: summary.capa },
              ]} />
              <DataPreviewCard title="Complaint / Recall" items={[
                { label: 'Complaints', value: summary.complaints }, { label: 'Recalls', value: summary.recalls },
              ]} />
              <DataPreviewCard title="Validation / Equipment" items={[
                { label: 'Validation', value: summary.validationRecords }, { label: 'Equipment', value: summary.equipmentRecords },
              ]} />
            </div>
            {assessment && (
              <Card>
                <CardContent className="pt-6 flex flex-wrap gap-3">
                  <Badge className={qualityStatusColor(assessment.overallQualityStatus)}>{assessment.overallQualityStatus}</Badge>
                  <Badge className={riskLevelColor(assessment.overallRiskLevel)}>Risk: {assessment.overallRiskLevel}</Badge>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Step 6: Generate */}
        {step === 6 && (
          <Card>
            <CardHeader><CardTitle>Step 6 — Generate PQR Draft</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p>PQR Number: <strong className="font-mono">{pqrNumber}</strong></p>
              <p>Product: <strong>{selected?.productName}</strong></p>
              <p>Review Period: <strong>{periodFrom}</strong> to <strong>{periodTo}</strong></p>
              <p>31 PQR sections will be generated with auto narratives from collected data.</p>
              {busy && (
                <div className="flex items-center gap-2 text-muted-foreground py-4">
                  <Loader2 className="h-5 w-5 animate-spin" />Generating PQR draft...
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step 7: Edit sections */}
        {step === 7 && (
          <div className="space-y-4">
            <Card>
              <CardHeader><CardTitle>Step 7 — Edit Section Narratives</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2"><Label>Executive Summary</Label><Textarea value={executiveSummary} onChange={(e) => setExecutiveSummary(e.target.value)} /></div>
                <div className="space-y-2"><Label>Conclusion</Label><Textarea value={conclusion} onChange={(e) => setConclusion(e.target.value)} /></div>
                <div className="space-y-2"><Label>Recommendations</Label><Textarea value={recommendations} onChange={(e) => setRecommendations(e.target.value)} /></div>
                <div className="space-y-2"><Label>Remarks</Label><Textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} /></div>
                {pqrId && (
                  <AttachmentUploader
                    onUpload={(file) => uploadPqrAttachment(pqrId, file, actor)}
                    disabled={busy}
                  />
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Section Editor</CardTitle></CardHeader>
              <CardContent>
                <PqrSectionEditor sections={sections} onChange={handleSectionChange} />
              </CardContent>
            </Card>
          </div>
        )}

        {/* Step 8: Submit */}
        {step === 8 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-green-600" />Step 8 — Submit for Review</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm">PQR <strong>{pqrNumber}</strong> is ready for QA review workflow.</p>
              {assessment && (
                <div className="flex flex-wrap gap-2">
                  <Badge className={qualityStatusColor(assessment.overallQualityStatus)}>{assessment.overallQualityStatus}</Badge>
                  <Badge className={riskLevelColor(assessment.overallRiskLevel)}>{assessment.overallRiskLevel} Risk</Badge>
                </div>
              )}
              <div className="flex flex-wrap gap-3">
                <Button variant="outline" onClick={() => void handleSaveDraft()} disabled={busy}>
                  <Save className="h-4 w-4 mr-1" />Save as Draft
                </Button>
                <Button onClick={() => void handleSubmit()} disabled={busy} className="bg-blue-600 hover:bg-blue-700">
                  <Send className="h-4 w-4 mr-1" />Submit for Review
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Navigation */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
          <Button variant="outline" disabled={step <= 1 || busy} onClick={() => setStep((s) => Math.max(1, s - 1))}>
            <ArrowLeft className="h-4 w-4 mr-1" />Back
          </Button>
          {step < 8 && (
            <Button onClick={() => void nextStep()} disabled={busy || (step === 1 && !productId)}>
              {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <ArrowRight className="h-4 w-4 mr-1" />}
              {step === 4 ? 'Collect Data' : step === 6 ? 'Generate Draft' : 'Next'}
            </Button>
          )}
        </div>

        <ConfirmDialog
          open={overrideOpen}
          onOpenChange={setOverrideOpen}
          title="QA Period Override"
          description={overlapWarning || 'An approved PQR exists for an overlapping period. Proceed with QA override?'}
          confirmLabel="Override & Continue"
          onConfirm={async () => {
            await logPqrCreateOverride(actor, overlapWarning || 'period overlap');
            setOverrideOpen(false);
            setStep(3);
            toast.warning('QA override applied');
          }}
        />
      </div>
    </PqrCreateAccessGuard>
  );
}
