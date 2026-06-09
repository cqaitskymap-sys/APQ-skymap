'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Plus, Trash2, Save, Send, FileText, ArrowLeft, CheckCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/hooks/use-toast';
import { PageLoader } from '@/components/loaders/page-loader';

export default function PQREditPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const [header, setHeader] = useState({
    company_name: '', site_name: '', address: '', document_title: '', product_name: '',
    pqr_number: '', page_number: '1', revision_number: '00', format_number: '',
    product_code: '', company_logo_url: '',
  });

  const [reviewPeriod, setReviewPeriod] = useState({
    total_batches_manufactured: 0, total_released_batches: 0,
    total_rejected_batches: 0, total_reworked_batches: 0, total_reprocessed_batches: 0,
  });

  const [docControl, setDocControl] = useState({
    document_status: 'draft', pqr_year: new Date().getFullYear(),
    review_frequency: 'yearly', current_revision: '00', previous_revision: '',
    next_review_due_date: '', document_owner_department: 'Quality Assurance',
    effective_date: '', prepared_date: '',
  });

  const [product, setProduct] = useState({
    generic_name: '', product_name: '', strength: '', shelf_life: '',
    standard_batch_size: '', manufacturing_license_no: '', final_packing_details: '',
    product_code: '', dosage_form: '', market_type: '',
    review_period_from: '', review_period_to: '',
  });

  useEffect(() => {
    const fetch = async () => {
      const id = params.id as string;
      const { data } = await supabase.from('pqr_documents').select('*').eq('id', id).maybeSingle();
      if (data) {
        const d = data as any;
        setHeader({
          company_name: d.company_name || '', site_name: d.site_name || '', address: d.address || '',
          document_title: d.document_title || '', product_name: d.product_name || '',
          pqr_number: d.pqr_number || '', page_number: d.page_number || '1',
          revision_number: d.revision_number || '00', format_number: d.format_number || '',
          product_code: d.product_code || '', company_logo_url: d.company_logo_url || '',
        });
        setReviewPeriod({
          total_batches_manufactured: d.total_batches_manufactured || 0,
          total_released_batches: d.total_released_batches || 0,
          total_rejected_batches: d.total_rejected_batches || 0,
          total_reworked_batches: d.total_reworked_batches || 0,
          total_reprocessed_batches: d.total_reprocessed_batches || 0,
        });
        setDocControl({
          document_status: d.document_status || 'draft', pqr_year: d.pqr_year || new Date().getFullYear(),
          review_frequency: d.review_frequency || 'yearly', current_revision: d.current_revision || '00',
          previous_revision: d.previous_revision || '', next_review_due_date: d.next_review_due_date || '',
          document_owner_department: d.document_owner_department || 'Quality Assurance',
          effective_date: d.effective_date || '', prepared_date: d.prepared_date || '',
        });
        setProduct({
          generic_name: '', product_name: d.product_name || '', strength: '',
          shelf_life: '', standard_batch_size: '', manufacturing_license_no: '',
          final_packing_details: '', product_code: d.product_code || '',
          dosage_form: '', market_type: '',
          review_period_from: d.review_period_from || '', review_period_to: d.review_period_to || '',
        });
      }
      setIsLoading(false);
    };
    fetch();
  }, [params.id]);

  if (isLoading) return <PageLoader />;

  const handleSave = async (submitStatus: 'draft' | 'under_review') => {
    setSaving(true);
    try {
      const id = params.id as string;
      const { error } = await supabase.from('pqr_documents').update({
        company_name: header.company_name,
        site_name: header.site_name,
        address: header.address,
        document_title: header.document_title,
        product_name: header.product_name,
        pqr_number: header.pqr_number,
        page_number: header.page_number,
        revision_number: header.revision_number,
        format_number: header.format_number,
        product_code: header.product_code,
        company_logo_url: header.company_logo_url,
        review_period_from: product.review_period_from || null,
        review_period_to: product.review_period_to || null,
        total_batches_manufactured: reviewPeriod.total_batches_manufactured,
        total_released_batches: reviewPeriod.total_released_batches,
        total_rejected_batches: reviewPeriod.total_rejected_batches,
        total_reworked_batches: reviewPeriod.total_reworked_batches,
        total_reprocessed_batches: reviewPeriod.total_reprocessed_batches,
        document_status: submitStatus,
        review_frequency: docControl.review_frequency,
        current_revision: docControl.current_revision,
        previous_revision: docControl.previous_revision,
        next_review_due_date: docControl.next_review_due_date || null,
        document_owner_department: docControl.document_owner_department,
        effective_date: docControl.effective_date || null,
        prepared_date: docControl.prepared_date || null,
        pqr_year: docControl.pqr_year,
        updated_by: user?.uid,
        updated_at: new Date().toISOString(),
      }).eq('id', id);

      if (error) throw error;

      await supabase.from('audit_logs').insert({
        user_id: user?.uid, user_name: user?.email || 'Unknown', user_role: 'qa',
        action: 'UPDATE', module: 'PQR', record_id: id, record_number: header.pqr_number,
        field_name: 'document', old_value: 'draft', new_value: submitStatus,
        ip_address: '', user_agent: '',
      });

      toast({ title: 'PQR updated successfully' });
      router.push(`/dashboard/pqr/${id}`);
    } catch (err: any) {
      toast({ title: 'Error updating PQR', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push(`/dashboard/pqr/${params.id}`)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Edit PQR</h1>
            <p className="text-muted-foreground text-sm font-mono">{header.pqr_number}</p>
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

      <div className="space-y-4">
        <Card>
          <CardHeader><CardTitle className="text-lg">PQR Header</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><Label>Company Name</Label><Input className="mt-1" value={header.company_name} onChange={e => setHeader(h => ({ ...h, company_name: e.target.value }))} /></div>
              <div><Label>Site Name</Label><Input className="mt-1" value={header.site_name} onChange={e => setHeader(h => ({ ...h, site_name: e.target.value }))} /></div>
              <div><Label>Document Title</Label><Input className="mt-1" value={header.document_title} onChange={e => setHeader(h => ({ ...h, document_title: e.target.value }))} /></div>
              <div><Label>Product Name</Label><Input className="mt-1" value={header.product_name} onChange={e => setHeader(h => ({ ...h, product_name: e.target.value }))} /></div>
              <div><Label>PQR Number</Label><Input className="mt-1 font-mono" value={header.pqr_number} onChange={e => setHeader(h => ({ ...h, pqr_number: e.target.value }))} /></div>
              <div><Label>Revision Number</Label><Input className="mt-1 font-mono" value={header.revision_number} onChange={e => setHeader(h => ({ ...h, revision_number: e.target.value }))} /></div>
              <div><Label>Format Number</Label><Input className="mt-1 font-mono" value={header.format_number} onChange={e => setHeader(h => ({ ...h, format_number: e.target.value }))} /></div>
              <div><Label>Product Code</Label><Input className="mt-1 font-mono" value={header.product_code} onChange={e => setHeader(h => ({ ...h, product_code: e.target.value }))} /></div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-lg">Review Period</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><Label>Review Period From</Label><Input className="mt-1" type="date" value={product.review_period_from} onChange={e => setProduct(p => ({ ...p, review_period_from: e.target.value }))} /></div>
              <div><Label>Review Period To</Label><Input className="mt-1" type="date" value={product.review_period_to} onChange={e => setProduct(p => ({ ...p, review_period_to: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div><Label>Batches Manufactured</Label><Input className="mt-1" type="number" value={reviewPeriod.total_batches_manufactured} onChange={e => setReviewPeriod(r => ({ ...r, total_batches_manufactured: parseInt(e.target.value) || 0 }))} /></div>
              <div><Label>Released</Label><Input className="mt-1" type="number" value={reviewPeriod.total_released_batches} onChange={e => setReviewPeriod(r => ({ ...r, total_released_batches: parseInt(e.target.value) || 0 }))} /></div>
              <div><Label>Rejected</Label><Input className="mt-1" type="number" value={reviewPeriod.total_rejected_batches} onChange={e => setReviewPeriod(r => ({ ...r, total_rejected_batches: parseInt(e.target.value) || 0 }))} /></div>
              <div><Label>Reworked</Label><Input className="mt-1" type="number" value={reviewPeriod.total_reworked_batches} onChange={e => setReviewPeriod(r => ({ ...r, total_reworked_batches: parseInt(e.target.value) || 0 }))} /></div>
              <div><Label>Reprocessed</Label><Input className="mt-1" type="number" value={reviewPeriod.total_reprocessed_batches} onChange={e => setReviewPeriod(r => ({ ...r, total_reprocessed_batches: parseInt(e.target.value) || 0 }))} /></div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-lg">Document Control</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div><Label>PQR Year</Label><Input className="mt-1" type="number" value={docControl.pqr_year} onChange={e => setDocControl(d => ({ ...d, pqr_year: parseInt(e.target.value) || new Date().getFullYear() }))} /></div>
              <div><Label>Review Frequency</Label>
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
              <div><Label>Department</Label><Input className="mt-1" value={docControl.document_owner_department} onChange={e => setDocControl(d => ({ ...d, document_owner_department: e.target.value }))} /></div>
              <div><Label>Effective Date</Label><Input className="mt-1" type="date" value={docControl.effective_date} onChange={e => setDocControl(d => ({ ...d, effective_date: e.target.value }))} /></div>
              <div><Label>Next Review Due</Label><Input className="mt-1" type="date" value={docControl.next_review_due_date} onChange={e => setDocControl(d => ({ ...d, next_review_due_date: e.target.value }))} /></div>
              <div><Label>Current Revision</Label><Input className="mt-1 font-mono" value={docControl.current_revision} onChange={e => setDocControl(d => ({ ...d, current_revision: e.target.value }))} /></div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

