'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Archive, Download, FileText, PenLine, RefreshCw, Save, Send,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/auth-context';
import type { AnnualCpvDocument, AnnualCpvSnapshot } from '@/lib/cpv-annual-review';
import { workflowStatusLabel } from '@/lib/cpv-annual-review';
import {
  archiveAnnualCpv,
  getAnnualCpvDocumentsByYear,
  loadAnnualReviewSourceData,
  saveAnnualCpvDraft,
  signAnnualCpv,
  updateAnnualCpvWorkflow,
} from '@/lib/cpv-annual-review-service';
import { printPage } from '@/lib/export-utils';
import { AnnualCpvPdfDocument } from '@/components/cpv/annual-cpv-pdf-document';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DataState, KpiCard, PageHeading, StatusBadge } from '@/components/cpv/cpv-ui';

function SignDialog({
  role,
  label,
  disabled,
  onSign,
}: {
  role: 'reviewed' | 'approved';
  label: string;
  disabled?: boolean;
  onSign: (payload: { signatureText: string; meaning: string; reason: string }) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [signatureText, setSignatureText] = useState('');
  const [meaning, setMeaning] = useState('review');
  const [reason, setReason] = useState('');
  const [signing, setSigning] = useState(false);

  const submit = async () => {
    if (!signatureText.trim()) return toast.error('Type your full name as e-signature');
    if (!reason.trim()) return toast.error('Reason for signing is required');
    setSigning(true);
    try {
      await onSign({ signatureText, meaning, reason });
      setOpen(false);
      toast.success(`${label} signature recorded`);
    } catch {
      toast.error('Signature could not be recorded');
    } finally {
      setSigning(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled}>
          <PenLine className="mr-2 h-4 w-4" />{label}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Electronic Signature — {label}</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">21 CFR Part 11 compliant e-signature. This action is legally binding.</p>
        <div className="space-y-3">
          <div>
            <Label>E-Signature (type full name) *</Label>
            <Input className="mt-1" value={signatureText} onChange={(e) => setSignatureText(e.target.value)} />
          </div>
          <div>
            <Label>Meaning *</Label>
            <Select value={meaning} onValueChange={setMeaning}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="review">Review</SelectItem>
                <SelectItem value="approve">Approve</SelectItem>
                <SelectItem value="author">Author</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Reason *</Label>
            <Textarea className="mt-1" value={reason} onChange={(e) => setReason(e.target.value)} rows={2} />
          </div>
          <Button onClick={submit} disabled={signing} className="w-full">
            {signing ? 'Signing...' : 'Apply E-Signature'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function AnnualReviewPage() {
  const { user, profile } = useAuth();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [product, setProduct] = useState('all');
  const [loading, setLoading] = useState(true);
  const [collecting, setCollecting] = useState(false);
  const [snapshot, setSnapshot] = useState<AnnualCpvSnapshot | null>(null);
  const [document, setDocument] = useState<AnnualCpvDocument | null>(null);
  const [conclusion, setConclusion] = useState('');
  const [recommendations, setRecommendations] = useState('');

  const actor = { id: user?.uid, name: profile?.full_name, role: profile?.role };

  const collectData = useCallback(async () => {
    setCollecting(true);
    try {
      const { snapshot: data } = await loadAnnualReviewSourceData(year, product);
      setSnapshot(data);
      setConclusion(data.conclusion);
      setRecommendations(data.recommendations);
      toast.success('Annual CPV data collected from CPP, CQA, QMS, and batch systems');
    } catch (error) {
      console.error(error);
      toast.error('Could not collect source data');
    } finally {
      setCollecting(false);
    }
  }, [year, product]);

  const loadExisting = useCallback(async () => {
    setLoading(true);
    try {
      const docs = await getAnnualCpvDocumentsByYear(year);
      const latest = docs[0];
      if (latest) {
        setDocument(latest);
        setSnapshot(latest.snapshot);
        setConclusion(latest.conclusion);
        setRecommendations(latest.recommendations);
      } else {
        setDocument(null);
        await collectData();
      }
    } catch {
      await collectData();
    } finally {
      setLoading(false);
    }
  }, [year, collectData]);

  useEffect(() => { void loadExisting(); }, [year]);

  const products = useMemo(() => {
    if (!snapshot) return [];
    const fromBatches = snapshot.batches.records.map((b) => String(b.product_name || b.productName || '')).filter(Boolean);
    return Array.from(new Set(fromBatches)).sort();
  }, [snapshot]);

  const previewDoc: AnnualCpvDocument | null = useMemo(() => {
    if (!snapshot) return null;
    return {
      id: document?.id,
      documentNumber: document?.documentNumber || `ACPV/${year}/DRAFT`,
      reviewYear: year,
      productName: product === 'all' ? 'All Products' : product,
      status: document?.status || 'draft',
      conclusion,
      recommendations,
      preparedBy: document?.preparedBy || profile?.full_name || 'System',
      preparedById: document?.preparedById || user?.uid || 'system',
      signatures: document?.signatures || [],
      snapshot,
      createdAt: document?.createdAt || new Date().toISOString(),
      updatedAt: document?.updatedAt || new Date().toISOString(),
      version: document?.version || 1,
    };
  }, [snapshot, document, year, product, conclusion, recommendations, profile, user]);

  const saveDraft = async () => {
    if (!snapshot) return toast.error('Collect data first');
    try {
      const saved = await saveAnnualCpvDraft({
        reviewYear: year,
        productName: product === 'all' ? 'All Products' : product,
        snapshot: { ...snapshot, conclusion, recommendations },
        conclusion,
        recommendations,
        existingId: document?.id,
      }, actor);
      setDocument(saved);
      toast.success('Annual CPV review saved as draft');
    } catch (error) {
      console.error(error);
      toast.error('Could not save draft');
    }
  };

  const submitReview = async () => {
    if (!document?.id) return toast.error('Save draft first');
    try {
      await updateAnnualCpvWorkflow(document.id, 'under_review', { conclusion, recommendations });
      setDocument({ ...document, status: 'under_review', conclusion, recommendations });
      toast.success('Submitted for QA review');
    } catch {
      toast.error('Could not submit for review');
    }
  };

  const handleSign = async (role: 'reviewed' | 'approved', payload: { signatureText: string; meaning: string; reason: string }) => {
    if (!document?.id) throw new Error('No document');
    await signAnnualCpv(document.id, role, {
      name: profile?.full_name || payload.signatureText,
      ...payload,
      userId: user?.uid,
    });
    const docs = await getAnnualCpvDocumentsByYear(year);
    setDocument(docs[0] || null);
  };

  const handleArchive = async () => {
    if (!document?.id) return;
    try {
      await archiveAnnualCpv(document.id);
      setDocument({ ...document, status: 'archived' });
      toast.success('Document archived');
    } catch {
      toast.error('Could not archive');
    }
  };

  const status = document?.status || 'draft';
  const isArchived = status === 'archived';
  const isApproved = status === 'approved' || isArchived;

  return (
    <div className="space-y-6">
      <PageHeading
        title="Annual CPV Review"
        description="Automated annual Continued Process Verification report — collects CPP, CQA, deviation, OOS, CAPA, change control, batch, and equipment data with PQR-style PDF output and e-signature workflow."
        actions={(
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => void collectData()} disabled={collecting}>
              <RefreshCw className={`mr-2 h-4 w-4 ${collecting ? 'animate-spin' : ''}`} />Collect Data
            </Button>
            <Button variant="outline" onClick={() => printPage()} disabled={!previewDoc}>
              <Download className="mr-2 h-4 w-4" />Export PDF
            </Button>
            <Button onClick={saveDraft} disabled={!snapshot || isArchived}>
              <Save className="mr-2 h-4 w-4" />Save Draft
            </Button>
          </div>
        )}
      />

      <Card className="no-print">
        <CardContent className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <Label>Review Year</Label>
            <Input className="mt-2" type="number" min="2000" max={currentYear} value={year}
              onChange={(e) => setYear(Number(e.target.value))} />
          </div>
          <div>
            <Label>Product Scope</Label>
            <Select value={product} onValueChange={setProduct}>
              <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Products</SelectItem>
                {products.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Document No.</Label>
            <Input className="mt-2 font-mono text-sm" value={document?.documentNumber || '—'} readOnly />
          </div>
          <div>
            <Label>Workflow Status</Label>
            <div className="mt-3"><StatusBadge status={workflowStatusLabel(status)} /></div>
          </div>
          <div>
            <Label>Prepared By</Label>
            <Input className="mt-2" value={profile?.full_name || ''} readOnly />
          </div>
        </CardContent>
      </Card>

      <Card className="no-print">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Workflow</CardTitle>
          <CardDescription>Draft → Review → Approval → Archive</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={submitReview} disabled={!document?.id || status !== 'draft'}>
            <Send className="mr-2 h-4 w-4" />Submit for Review
          </Button>
          <SignDialog role="reviewed" label="QA Review Sign" disabled={!document?.id || isApproved}
            onSign={(p) => handleSign('reviewed', p)} />
          <SignDialog role="approved" label="Head QA Approve" disabled={!document?.id || isApproved}
            onSign={(p) => handleSign('approved', p)} />
          <Button variant="outline" size="sm" onClick={handleArchive} disabled={!document?.id || status !== 'approved'}>
            <Archive className="mr-2 h-4 w-4" />Archive
          </Button>
        </CardContent>
      </Card>

      <DataState loading={loading} empty={!snapshot} emptyText="Collect annual source data to generate the CPV report." />

      {snapshot && (
        <>
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-6 no-print">
            <KpiCard label="CPP" value={snapshot.cpp.total} />
            <KpiCard label="CQA" value={snapshot.cqa.total} />
            <KpiCard label="Avg Cpk" value={snapshot.capability.averageCpk.toFixed(2)}
              tone={snapshot.capability.averageCpk >= 1.33 ? 'green' : snapshot.capability.averageCpk >= 1 ? 'amber' : 'red'} />
            <KpiCard label="Deviations" value={snapshot.deviations.total} />
            <KpiCard label="OOS" value={snapshot.oos.total} tone={snapshot.oos.total ? 'red' : 'green'} />
            <KpiCard label="CAPA" value={snapshot.capa.total} />
          </div>

          <Tabs defaultValue="preview" className="space-y-5">
            <TabsList className="no-print">
              <TabsTrigger value="preview"><FileText className="mr-2 h-4 w-4" />Report Preview</TabsTrigger>
              <TabsTrigger value="edit">Edit Narrative</TabsTrigger>
            </TabsList>

            <TabsContent value="edit" className="no-print space-y-4">
              <Card>
                <CardHeader><CardTitle>Conclusion</CardTitle></CardHeader>
                <CardContent>
                  <Textarea value={conclusion} onChange={(e) => setConclusion(e.target.value)} rows={5} disabled={isArchived} />
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>Recommendations</CardTitle></CardHeader>
                <CardContent>
                  <Textarea value={recommendations} onChange={(e) => setRecommendations(e.target.value)} rows={5} disabled={isArchived} />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="preview">
              {previewDoc && <AnnualCpvPdfDocument document={previewDoc} />}
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
