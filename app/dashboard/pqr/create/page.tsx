'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Trash2, Save, Send, FileText, Upload, UserCheck, History, BookOpen, ArrowLeft, GripVertical, CheckCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/hooks/use-toast';
import type { CompositionRow, BrandNameRow, PqrApprovalForm, RevisionRow } from '@/lib/pqr-schemas';

const defaultComposition: CompositionRow = { ingredient_name: '', grade: '', equivalent_claim: '', quantity: '', unit: '', purpose: '', sort_order: 0 };
const defaultBrand: BrandNameRow = { brand_name: '' };

const defaultApprovals: PqrApprovalForm[] = [
  { approval_type: 'prepared', designation: 'Executive QA', name: '', signature_url: '', signature_text: '', approval_date: null, status: 'pending', remarks: '' },
  { approval_type: 'reviewed', designation: 'Manager QA', name: '', signature_url: '', signature_text: '', approval_date: null, status: 'pending', remarks: '' },
  { approval_type: 'reviewed', designation: 'Manager QC', name: '', signature_url: '', signature_text: '', approval_date: null, status: 'pending', remarks: '' },
  { approval_type: 'reviewed', designation: 'Manager Production', name: '', signature_url: '', signature_text: '', approval_date: null, status: 'pending', remarks: '' },
  { approval_type: 'reviewed', designation: 'Manager Warehouse', name: '', signature_url: '', signature_text: '', approval_date: null, status: 'pending', remarks: '' },
  { approval_type: 'reviewed', designation: 'Manager Engineering', name: '', signature_url: '', signature_text: '', approval_date: null, status: 'pending', remarks: '' },
  { approval_type: 'approved', designation: 'Head QA', name: '', signature_url: '', signature_text: '', approval_date: null, status: 'pending', remarks: '' },
];

const defaultRevision: RevisionRow = { revision_no: '00', change_control_no: 'Not Applicable', details_of_changes: 'Not Applicable', reason_of_changes: 'New PQR', effective_date: null, is_locked: false };

const defaultBrands = ['Skymicin', 'Siomika', 'Tramycin', 'Amytic', 'Amitas', 'Mikachm', 'Nikachem', 'Winkacin', 'Amcin', 'Mikabest', 'Bakton', 'Zoramika', 'Amikasky'];

export default function CreatePQRPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('header');

  // Tab 1: PQR Header
  const [header, setHeader] = useState({
    company_name: 'Skymap Pharmaceuticals Pvt. Ltd., Roorkee',
    site_name: '',
    address: '',
    document_title: 'Product Quality Review for Amikacin Injection IP',
    product_name: 'Amikacin Injection IP',
    pqr_number: '',
    page_number: '1',
    revision_number: '00',
    format_number: 'SOP/QA/055/F01-03',
    product_code: '',
    company_logo_url: '',
  });

  // Tab 2: Product Details
  const [product, setProduct] = useState({
    generic_name: 'Amikacin Sulphate IP',
    product_name: 'Amikacin Injection IP',
    strength: '500mg/2ml',
    shelf_life: '24 Months',
    standard_batch_size: '',
    manufacturing_license_no: '',
    final_packing_details: '',
    product_code: '',
    dosage_form: 'Injection',
    market_type: 'Domestic',
    review_period_from: '',
    review_period_to: '',
  });
  const [compositions, setCompositions] = useState<CompositionRow[]>([
    { ingredient_name: 'Amikacin Sulphate IP', grade: '', equivalent_claim: 'Eq. to Amikacin', quantity: '500', unit: 'mg', purpose: 'Active', sort_order: 0 },
    { ingredient_name: 'Methylparaben IP', grade: '', equivalent_claim: '', quantity: '0.04', unit: '% w/v', purpose: 'Preservative', sort_order: 1 },
    { ingredient_name: 'Propylparaben IP', grade: '', equivalent_claim: '', quantity: '0.01', unit: '% w/v', purpose: 'Preservative', sort_order: 2 },
    { ingredient_name: 'Water for Injection IP', grade: '', equivalent_claim: '', quantity: 'q.s.', unit: '', purpose: 'Vehicle', sort_order: 3 },
  ]);
  const [brandNames, setBrandNames] = useState<BrandNameRow[]>(
    defaultBrands.map(b => ({ brand_name: b }))
  );

  // Tab 3: Document Control
  const [docControl, setDocControl] = useState({
    document_type: 'PQR',
    document_status: 'draft',
    pqr_year: new Date().getFullYear(),
    review_frequency: 'yearly',
    current_revision: '00',
    previous_revision: '',
    next_review_due_date: '',
    document_owner_department: 'Quality Assurance',
    effective_date: '',
    prepared_date: new Date().toISOString().split('T')[0],
  });

  // Tab 4: Review Period
  const [reviewPeriod, setReviewPeriod] = useState({
    total_batches_manufactured: 0,
    total_released_batches: 0,
    total_rejected_batches: 0,
    total_reworked_batches: 0,
    total_reprocessed_batches: 0,
  });

  // Tab 5: Approvals
  const [approvals, setApprovals] = useState<PqrApprovalForm[]>(defaultApprovals);

  // Tab 6: Revision History
  const [revisions, setRevisions] = useState<RevisionRow[]>([defaultRevision]);

  // Compute review months
  const computeReviewMonths = () => {
    if (product.review_period_from && product.review_period_to) {
      const from = new Date(product.review_period_from);
      const to = new Date(product.review_period_to);
      const months = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
      return Math.max(0, months);
    }
    return 0;
  };

  const handleSave = async (submitStatus: 'draft' | 'under_review') => {
    setSaving(true);
    try {
      // Upsert product master
      const { data: productData, error: productError } = await supabase
        .from('product_master')
        .upsert({
          generic_name: product.generic_name,
          product_name: product.product_name,
          strength: product.strength,
          shelf_life: product.shelf_life,
          standard_batch_size: product.standard_batch_size,
          manufacturing_license_no: product.manufacturing_license_no,
          final_packing_details: product.final_packing_details,
          product_code: product.product_code || header.product_code,
          dosage_form: product.dosage_form,
          market_type: product.market_type,
          created_by: user?.uid,
        })
        .select()
        .maybeSingle();

      if (productError) throw productError;

      const productId = productData?.id;

      // Insert PQR document
      const { data: pqrData, error: pqrError } = await supabase
        .from('pqr_documents')
        .insert({
          company_name: header.company_name,
          site_name: header.site_name,
          address: header.address,
          document_title: header.document_title,
          product_name: header.product_name || product.product_name,
          pqr_number: header.pqr_number,
          page_number: header.page_number,
          revision_number: header.revision_number,
          format_number: header.format_number,
          product_code: product.product_code || header.product_code,
          review_period_from: product.review_period_from || null,
          review_period_to: product.review_period_to || null,
          total_review_months: computeReviewMonths(),
          total_batches_manufactured: reviewPeriod.total_batches_manufactured,
          total_released_batches: reviewPeriod.total_released_batches,
          total_rejected_batches: reviewPeriod.total_rejected_batches,
          total_reworked_batches: reviewPeriod.total_reworked_batches,
          total_reprocessed_batches: reviewPeriod.total_reprocessed_batches,
          pqr_year: docControl.pqr_year,
          document_status: submitStatus,
          review_frequency: docControl.review_frequency,
          current_revision: docControl.current_revision,
          previous_revision: docControl.previous_revision,
          next_review_due_date: docControl.next_review_due_date || null,
          document_owner_department: docControl.document_owner_department,
          effective_date: docControl.effective_date || null,
          prepared_date: docControl.prepared_date || null,
          company_logo_url: header.company_logo_url,
          created_by: user?.uid,
        })
        .select()
        .maybeSingle();

      if (pqrError) throw pqrError;

      const pqrId = pqrData?.id;

      // Insert approvals
      if (pqrId) {
        await supabase.from('pqr_approvals').insert(
          approvals.map(a => ({
            pqr_id: pqrId,
            approval_type: a.approval_type,
            designation: a.designation,
            name: a.name,
            signature_url: a.signature_url,
            signature_text: a.signature_text,
            approval_date: a.approval_date,
            status: a.status,
            remarks: a.remarks,
            created_by: user?.uid,
          }))
        );

        // Insert revisions
        await supabase.from('pqr_revision_history').insert(
          revisions.map(r => ({
            pqr_id: pqrId,
            revision_no: r.revision_no,
            change_control_no: r.change_control_no,
            details_of_changes: r.details_of_changes,
            reason_of_changes: r.reason_of_changes,
            effective_date: r.effective_date,
            is_locked: r.is_locked,
            updated_by: user?.uid,
          }))
        );
      }

      // Insert composition and brand names if product exists
      if (productId) {
        await supabase.from('pqr_composition').insert(
          compositions.map((c, i) => ({
            product_id: productId,
            ...c,
            sort_order: i,
          }))
        );
        await supabase.from('pqr_brand_names').insert(
          brandNames.filter(b => b.brand_name.trim()).map(b => ({
            product_id: productId,
            brand_name: b.brand_name,
          }))
        );
      }

      // Audit log
      await supabase.from('audit_logs').insert({
        user_id: user?.uid,
        user_name: user?.email || 'Unknown',
        user_role: 'qa',
        action: 'CREATE',
        module: 'PQR',
        record_id: pqrId,
        record_number: header.pqr_number,
        field_name: 'document',
        old_value: '',
        new_value: submitStatus,
        ip_address: '',
        user_agent: '',
      });

      toast({ title: submitStatus === 'draft' ? 'Draft saved' : 'Submitted for review' });
      router.push('/dashboard/pqr');
    } catch (err: any) {
      toast({ title: 'Error saving PQR', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard/pqr')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Create New PQR</h1>
            <p className="text-muted-foreground text-sm">Product Quality Review Document Setup</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => handleSave('draft')} disabled={saving} className="gap-2">
            <Save className="h-4 w-4" />Save Draft
          </Button>
          <Button className="bg-blue-600 hover:bg-blue-500 gap-2" onClick={() => handleSave('under_review')} disabled={saving}>
            <Send className="h-4 w-4" />Submit for Review
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="header" className="gap-1 text-xs"><FileText className="h-3.5 w-3.5" />PQR Header</TabsTrigger>
          <TabsTrigger value="product" className="gap-1 text-xs"><FileText className="h-3.5 w-3.5" />Product Details</TabsTrigger>
          <TabsTrigger value="doccontrol" className="gap-1 text-xs"><FileText className="h-3.5 w-3.5" />Document Control</TabsTrigger>
          <TabsTrigger value="review" className="gap-1 text-xs"><FileText className="h-3.5 w-3.5" />Review Period</TabsTrigger>
          <TabsTrigger value="approvals" className="gap-1 text-xs"><UserCheck className="h-3.5 w-3.5" />Approvals</TabsTrigger>
          <TabsTrigger value="revisions" className="gap-1 text-xs"><History className="h-3.5 w-3.5" />Revision History</TabsTrigger>
          <TabsTrigger value="abbreviations" className="gap-1 text-xs"><BookOpen className="h-3.5 w-3.5" />Abbreviations</TabsTrigger>
        </TabsList>

        {/* TAB 1: PQR HEADER */}
        <TabsContent value="header">
          <Card>
            <CardHeader><CardTitle className="text-lg">PQR Header Information</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Company Logo</Label>
                  <div className="mt-1 flex items-center gap-3">
                    <div className="h-16 w-16 border-2 border-dashed rounded-lg flex items-center justify-center bg-muted">
                      {header.company_logo_url ? (
                        <img src={header.company_logo_url} alt="Logo" className="h-14 w-14 object-contain" />
                      ) : (
                        <Upload className="h-6 w-6 text-muted-foreground" />
                      )}
                    </div>
                    <Input type="file" accept="image/*" className="max-w-[200px]" onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const url = URL.createObjectURL(file);
                        setHeader(h => ({ ...h, company_logo_url: url }));
                      }
                    }} />
                  </div>
                </div>
                <div>
                  <Label>Company Name *</Label>
                  <Input className="mt-1" value={header.company_name} onChange={e => setHeader(h => ({ ...h, company_name: e.target.value }))} />
                </div>
                <div>
                  <Label>Plant / Site Name</Label>
                  <Input className="mt-1" value={header.site_name} onChange={e => setHeader(h => ({ ...h, site_name: e.target.value }))} />
                </div>
                <div>
                  <Label>Address</Label>
                  <Input className="mt-1" value={header.address} onChange={e => setHeader(h => ({ ...h, address: e.target.value }))} />
                </div>
                <div>
                  <Label>Document Title *</Label>
                  <Input className="mt-1" value={header.document_title} onChange={e => setHeader(h => ({ ...h, document_title: e.target.value }))} />
                </div>
                <div>
                  <Label>Product Name *</Label>
                  <Input className="mt-1" value={header.product_name} onChange={e => setHeader(h => ({ ...h, product_name: e.target.value }))} />
                </div>
                <div>
                  <Label>PQR Number *</Label>
                  <Input className="mt-1 font-mono" placeholder="e.g. PQR/HMF-0041/040/2025" value={header.pqr_number} onChange={e => setHeader(h => ({ ...h, pqr_number: e.target.value }))} />
                </div>
                <div>
                  <Label>Page Number</Label>
                  <Input className="mt-1" value={header.page_number} onChange={e => setHeader(h => ({ ...h, page_number: e.target.value }))} />
                </div>
                <div>
                  <Label>Revision Number *</Label>
                  <Input className="mt-1 font-mono" value={header.revision_number} onChange={e => setHeader(h => ({ ...h, revision_number: e.target.value }))} />
                </div>
                <div>
                  <Label>Format Number</Label>
                  <Input className="mt-1 font-mono" value={header.format_number} onChange={e => setHeader(h => ({ ...h, format_number: e.target.value }))} />
                </div>
                <div>
                  <Label>Product Code</Label>
                  <Input className="mt-1 font-mono" value={header.product_code} onChange={e => setHeader(h => ({ ...h, product_code: e.target.value }))} />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: PRODUCT DETAILS */}
        <TabsContent value="product">
          <div className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-lg">Product Details</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label>Generic Name *</Label>
                    <Input className="mt-1" value={product.generic_name} onChange={e => setProduct(p => ({ ...p, generic_name: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Product / Brand Name *</Label>
                    <Input className="mt-1" value={product.product_name} onChange={e => setProduct(p => ({ ...p, product_name: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Strength / Label Claim *</Label>
                    <Input className="mt-1" value={product.strength} onChange={e => setProduct(p => ({ ...p, strength: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Shelf Life</Label>
                    <Input className="mt-1" value={product.shelf_life} onChange={e => setProduct(p => ({ ...p, shelf_life: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Standard Batch Size</Label>
                    <Input className="mt-1" value={product.standard_batch_size} onChange={e => setProduct(p => ({ ...p, standard_batch_size: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Manufacturing License No.</Label>
                    <Input className="mt-1" value={product.manufacturing_license_no} onChange={e => setProduct(p => ({ ...p, manufacturing_license_no: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Final Packing Details</Label>
                    <Input className="mt-1" value={product.final_packing_details} onChange={e => setProduct(p => ({ ...p, final_packing_details: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Product Code</Label>
                    <Input className="mt-1" value={product.product_code} onChange={e => setProduct(p => ({ ...p, product_code: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Dosage Form</Label>
                    <Select value={product.dosage_form} onValueChange={v => setProduct(p => ({ ...p, dosage_form: v }))}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Injection">Injection</SelectItem>
                        <SelectItem value="Tablet">Tablet</SelectItem>
                        <SelectItem value="Capsule">Capsule</SelectItem>
                        <SelectItem value="Syrup">Syrup</SelectItem>
                        <SelectItem value="Cream">Cream</SelectItem>
                        <SelectItem value="Ointment">Ointment</SelectItem>
                        <SelectItem value="Dry Syrup">Dry Syrup</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Market Type</Label>
                    <Select value={product.market_type} onValueChange={v => setProduct(p => ({ ...p, market_type: v }))}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Domestic">Domestic</SelectItem>
                        <SelectItem value="Export">Export</SelectItem>
                        <SelectItem value="Both">Both</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Review Period From *</Label>
                    <Input className="mt-1" type="date" value={product.review_period_from} onChange={e => setProduct(p => ({ ...p, review_period_from: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Review Period To *</Label>
                    <Input className="mt-1" type="date" value={product.review_period_to} onChange={e => setProduct(p => ({ ...p, review_period_to: e.target.value }))} />
                  </div>
                </div>
                {product.review_period_from && product.review_period_to && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg text-sm">
                    Total Review Period: <span className="font-semibold">{computeReviewMonths()} months</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Composition Table */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Composition</CardTitle>
                  <Button variant="outline" size="sm" className="gap-1" onClick={() => setCompositions(c => [...c, { ...defaultComposition, sort_order: c.length }])}>
                    <Plus className="h-3.5 w-3.5" />Add Row
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border">
                    <thead className="bg-muted/50 border-b">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold">#</th>
                        <th className="px-3 py-2 text-left font-semibold">Ingredient Name</th>
                        <th className="px-3 py-2 text-left font-semibold">Grade</th>
                        <th className="px-3 py-2 text-left font-semibold">Equivalent Claim</th>
                        <th className="px-3 py-2 text-left font-semibold">Quantity</th>
                        <th className="px-3 py-2 text-left font-semibold">Unit</th>
                        <th className="px-3 py-2 text-left font-semibold">Purpose</th>
                        <th className="px-3 py-2 text-left font-semibold"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {compositions.map((row, i) => (
                        <tr key={i} className="border-b">
                          <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                          <td className="px-3 py-1"><Input className="h-8 text-sm" value={row.ingredient_name} onChange={e => setCompositions(c => c.map((r, j) => j === i ? { ...r, ingredient_name: e.target.value } : r))} /></td>
                          <td className="px-3 py-1"><Input className="h-8 text-sm" value={row.grade} onChange={e => setCompositions(c => c.map((r, j) => j === i ? { ...r, grade: e.target.value } : r))} /></td>
                          <td className="px-3 py-1"><Input className="h-8 text-sm" value={row.equivalent_claim} onChange={e => setCompositions(c => c.map((r, j) => j === i ? { ...r, equivalent_claim: e.target.value } : r))} /></td>
                          <td className="px-3 py-1"><Input className="h-8 text-sm" value={row.quantity} onChange={e => setCompositions(c => c.map((r, j) => j === i ? { ...r, quantity: e.target.value } : r))} /></td>
                          <td className="px-3 py-1"><Input className="h-8 text-sm" value={row.unit} onChange={e => setCompositions(c => c.map((r, j) => j === i ? { ...r, unit: e.target.value } : r))} /></td>
                          <td className="px-3 py-1"><Input className="h-8 text-sm" value={row.purpose} onChange={e => setCompositions(c => c.map((r, j) => j === i ? { ...r, purpose: e.target.value } : r))} /></td>
                          <td className="px-3 py-1"><Button variant="ghost" size="icon" className="h-7 w-7 text-red-600" onClick={() => setCompositions(c => c.filter((_, j) => j !== i))}><Trash2 className="h-3.5 w-3.5" /></Button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Brand Names */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Brand Names</CardTitle>
                  <Button variant="outline" size="sm" className="gap-1" onClick={() => setBrandNames(b => [...b, defaultBrand])}>
                    <Plus className="h-3.5 w-3.5" />Add Brand
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {brandNames.map((b, i) => (
                    <div key={i} className="flex items-center gap-1">
                      <Input className="h-8 text-sm w-32" value={b.brand_name} onChange={e => setBrandNames(br => br.map((r, j) => j === i ? { brand_name: e.target.value } : r))} />
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-red-600" onClick={() => setBrandNames(br => br.filter((_, j) => j !== i))}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* TAB 3: DOCUMENT CONTROL */}
        <TabsContent value="doccontrol">
          <Card>
            <CardHeader><CardTitle className="text-lg">Document Control</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label>Document Type</Label>
                  <Input className="mt-1" value={docControl.document_type} disabled />
                </div>
                <div>
                  <Label>Document Status</Label>
                  <Select value={docControl.document_status} onValueChange={v => setDocControl(d => ({ ...d, document_status: v }))}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="under_review">Under Review</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                      <SelectItem value="archived">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>PQR Year</Label>
                  <Input className="mt-1" type="number" value={docControl.pqr_year} onChange={e => setDocControl(d => ({ ...d, pqr_year: parseInt(e.target.value) || new Date().getFullYear() }))} />
                </div>
                <div>
                  <Label>Review Frequency</Label>
                  <Select value={docControl.review_frequency} onValueChange={v => setDocControl(d => ({ ...d, review_frequency: v }))}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="quarterly">Quarterly</SelectItem>
                      <SelectItem value="half_yearly">Half Yearly</SelectItem>
                      <SelectItem value="yearly">Yearly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Current Revision</Label>
                  <Input className="mt-1 font-mono" value={docControl.current_revision} onChange={e => setDocControl(d => ({ ...d, current_revision: e.target.value }))} />
                </div>
                <div>
                  <Label>Previous Revision</Label>
                  <Input className="mt-1 font-mono" value={docControl.previous_revision} onChange={e => setDocControl(d => ({ ...d, previous_revision: e.target.value }))} />
                </div>
                <div>
                  <Label>Next Review Due Date</Label>
                  <Input className="mt-1" type="date" value={docControl.next_review_due_date} onChange={e => setDocControl(d => ({ ...d, next_review_due_date: e.target.value }))} />
                </div>
                <div>
                  <Label>Document Owner Department</Label>
                  <Input className="mt-1" value={docControl.document_owner_department} onChange={e => setDocControl(d => ({ ...d, document_owner_department: e.target.value }))} />
                </div>
                <div>
                  <Label>Effective Date</Label>
                  <Input className="mt-1" type="date" value={docControl.effective_date} onChange={e => setDocControl(d => ({ ...d, effective_date: e.target.value }))} />
                </div>
                <div>
                  <Label>Prepared Date</Label>
                  <Input className="mt-1" type="date" value={docControl.prepared_date} onChange={e => setDocControl(d => ({ ...d, prepared_date: e.target.value }))} />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 4: REVIEW PERIOD */}
        <TabsContent value="review">
          <Card>
            <CardHeader><CardTitle className="text-lg">Review Period Summary</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                <p className="text-sm">Review Period: <span className="font-semibold">
                  {product.review_period_from ? new Date(product.review_period_from).toLocaleDateString() : 'Not set'} — {product.review_period_to ? new Date(product.review_period_to).toLocaleDateString() : 'Not set'}
                </span> ({computeReviewMonths()} months)</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div>
                  <Label>Total Batches Manufactured</Label>
                  <Input className="mt-1" type="number" value={reviewPeriod.total_batches_manufactured} onChange={e => setReviewPeriod(r => ({ ...r, total_batches_manufactured: parseInt(e.target.value) || 0 }))} />
                </div>
                <div>
                  <Label>Total Released</Label>
                  <Input className="mt-1" type="number" value={reviewPeriod.total_released_batches} onChange={e => setReviewPeriod(r => ({ ...r, total_released_batches: parseInt(e.target.value) || 0 }))} />
                </div>
                <div>
                  <Label>Total Rejected</Label>
                  <Input className="mt-1" type="number" value={reviewPeriod.total_rejected_batches} onChange={e => setReviewPeriod(r => ({ ...r, total_rejected_batches: parseInt(e.target.value) || 0 }))} />
                </div>
                <div>
                  <Label>Total Reworked</Label>
                  <Input className="mt-1" type="number" value={reviewPeriod.total_reworked_batches} onChange={e => setReviewPeriod(r => ({ ...r, total_reworked_batches: parseInt(e.target.value) || 0 }))} />
                </div>
                <div>
                  <Label>Total Reprocessed</Label>
                  <Input className="mt-1" type="number" value={reviewPeriod.total_reprocessed_batches} onChange={e => setReviewPeriod(r => ({ ...r, total_reprocessed_batches: parseInt(e.target.value) || 0 }))} />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 5: APPROVALS */}
        <TabsContent value="approvals">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Prepared / Reviewed / Approved By</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {(['prepared', 'reviewed', 'approved'] as const).map(type => (
                <div key={type}>
                  <h3 className="font-semibold text-sm mb-2 capitalize flex items-center gap-2">
                    {type === 'prepared' && <Save className="h-4 w-4 text-blue-600" />}
                    {type === 'reviewed' && <UserCheck className="h-4 w-4 text-amber-600" />}
                    {type === 'approved' && <CheckCircle className="h-4 w-4 text-green-600" />}
                    {type} By
                  </h3>
                  <div className="space-y-2">
                    {approvals.filter(a => a.approval_type === type).map((a, idx) => {
                      const globalIdx = approvals.findIndex(x => x === a);
                      return (
                        <div key={globalIdx} className="grid grid-cols-1 md:grid-cols-5 gap-3 p-3 bg-muted/30 rounded-lg">
                          <div>
                            <Label className="text-xs">Designation</Label>
                            <Input className="h-8 text-sm mt-0.5" value={a.designation} onChange={e => setApprovals(ap => ap.map((x, j) => j === globalIdx ? { ...x, designation: e.target.value } : x))} />
                          </div>
                          <div>
                            <Label className="text-xs">Name</Label>
                            <Input className="h-8 text-sm mt-0.5" value={a.name} onChange={e => setApprovals(ap => ap.map((x, j) => j === globalIdx ? { ...x, name: e.target.value } : x))} />
                          </div>
                          <div>
                            <Label className="text-xs">Digital Signature</Label>
                            <Input className="h-8 text-sm mt-0.5" placeholder="Type signature" value={a.signature_text} onChange={e => setApprovals(ap => ap.map((x, j) => j === globalIdx ? { ...x, signature_text: e.target.value } : x))} />
                          </div>
                          <div>
                            <Label className="text-xs">Date</Label>
                            <Input className="h-8 text-sm mt-0.5" type="date" value={a.approval_date || ''} onChange={e => setApprovals(ap => ap.map((x, j) => j === globalIdx ? { ...x, approval_date: e.target.value } : x))} />
                          </div>
                          <div>
                            <Label className="text-xs">Status</Label>
                            <Select value={a.status} onValueChange={v => setApprovals(ap => ap.map((x, j) => j === globalIdx ? { ...x, status: v as 'pending' | 'approved' | 'rejected' } : x))}>
                              <SelectTrigger className="h-8 text-sm mt-0.5"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="pending">Pending</SelectItem>
                                <SelectItem value="approved">Approved</SelectItem>
                                <SelectItem value="rejected">Rejected</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {type === 'reviewed' && (
                    <Button variant="outline" size="sm" className="mt-2 gap-1" onClick={() => setApprovals(ap => [...ap, { approval_type: 'reviewed', designation: '', name: '', signature_url: '', signature_text: '', approval_date: null, status: 'pending', remarks: '' }])}>
                      <Plus className="h-3.5 w-3.5" />Add Reviewer
                    </Button>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 6: REVISION HISTORY */}
        <TabsContent value="revisions">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Revision History</CardTitle>
                <Button variant="outline" size="sm" className="gap-1" onClick={() => setRevisions(r => [...r, { revision_no: String(r.length).padStart(2, '0'), change_control_no: '', details_of_changes: '', reason_of_changes: '', effective_date: null, is_locked: false }])}>
                  <Plus className="h-3.5 w-3.5" />Add Revision
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border">
                  <thead className="bg-muted/50 border-b">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold">Rev No.</th>
                      <th className="px-3 py-2 text-left font-semibold">Change Control No.</th>
                      <th className="px-3 py-2 text-left font-semibold">Details of Changes</th>
                      <th className="px-3 py-2 text-left font-semibold">Reason</th>
                      <th className="px-3 py-2 text-left font-semibold">Effective Date</th>
                      <th className="px-3 py-2 text-left font-semibold"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {revisions.map((r, i) => (
                      <tr key={i} className="border-b">
                        <td className="px-3 py-1"><Input className="h-8 text-sm font-mono w-16" value={r.revision_no} disabled={r.is_locked} onChange={e => setRevisions(rv => rv.map((x, j) => j === i ? { ...x, revision_no: e.target.value } : x))} /></td>
                        <td className="px-3 py-1"><Input className="h-8 text-sm" value={r.change_control_no} disabled={r.is_locked} onChange={e => setRevisions(rv => rv.map((x, j) => j === i ? { ...x, change_control_no: e.target.value } : x))} /></td>
                        <td className="px-3 py-1"><Input className="h-8 text-sm" value={r.details_of_changes} disabled={r.is_locked} onChange={e => setRevisions(rv => rv.map((x, j) => j === i ? { ...x, details_of_changes: e.target.value } : x))} /></td>
                        <td className="px-3 py-1"><Input className="h-8 text-sm" value={r.reason_of_changes} disabled={r.is_locked} onChange={e => setRevisions(rv => rv.map((x, j) => j === i ? { ...x, reason_of_changes: e.target.value } : x))} /></td>
                        <td className="px-3 py-1"><Input className="h-8 text-sm" type="date" value={r.effective_date || ''} disabled={r.is_locked} onChange={e => setRevisions(rv => rv.map((x, j) => j === i ? { ...x, effective_date: e.target.value } : x))} /></td>
                        <td className="px-3 py-1">{r.is_locked ? <Badge variant="outline" className="text-xs">Locked</Badge> : <Button variant="ghost" size="icon" className="h-7 w-7 text-red-600" onClick={() => setRevisions(rv => rv.filter((_, j) => j !== i))}><Trash2 className="h-3.5 w-3.5" /></Button>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 7: ABBREVIATION MASTER */}
        <TabsContent value="abbreviations">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Abbreviation Master</CardTitle>
              <p className="text-sm text-muted-foreground">Pre-loaded standard abbreviations used in PQR documents</p>
            </CardHeader>
            <CardContent>
              <AbbreviationTable />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function AbbreviationTable() {
  const [abbreviations, setAbbreviations] = useState<{ id: string; abbreviation: string; full_form: string; description: string; is_active: boolean }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase.from('abbreviation_master').select('*').order('abbreviation');
      if (data) setAbbreviations(data);
      setLoading(false);
    };
    fetch();
  }, []);

  if (loading) return <p className="text-sm text-muted-foreground">Loading abbreviations...</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border">
        <thead className="bg-muted/50 border-b">
          <tr>
            <th className="px-3 py-2 text-left font-semibold">Abbreviation</th>
            <th className="px-3 py-2 text-left font-semibold">Full Form</th>
            <th className="px-3 py-2 text-left font-semibold">Description</th>
            <th className="px-3 py-2 text-left font-semibold">Active</th>
          </tr>
        </thead>
        <tbody>
          {abbreviations.map(abbr => (
            <tr key={abbr.id} className="border-b">
              <td className="px-3 py-2 font-mono font-semibold">{abbr.abbreviation}</td>
              <td className="px-3 py-2">{abbr.full_form}</td>
              <td className="px-3 py-2 text-muted-foreground">{abbr.description}</td>
              <td className="px-3 py-2"><Badge variant={abbr.is_active ? 'default' : 'outline'} className="text-xs">{abbr.is_active ? 'Active' : 'Inactive'}</Badge></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
