'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Edit, Download, FileText, UserCheck, History, CheckCircle, AlertCircle, Clock, PackageSearch } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { PageLoader } from '@/components/loaders/page-loader';
import Link from 'next/link';

const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
  under_review: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  approved: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  archived: 'bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-400',
};

interface PqrDoc {
  id: string;
  company_name: string;
  site_name: string;
  address: string;
  document_title: string;
  product_name: string;
  pqr_number: string;
  page_number: string;
  revision_number: string;
  format_number: string;
  product_code: string;
  review_period_from: string;
  review_period_to: string;
  total_review_months: number;
  total_batches_manufactured: number;
  total_released_batches: number;
  total_rejected_batches: number;
  total_reworked_batches: number;
  total_reprocessed_batches: number;
  pqr_year: number;
  document_status: string;
  review_frequency: string;
  current_revision: string;
  previous_revision: string;
  next_review_due_date: string;
  document_owner_department: string;
  effective_date: string;
  prepared_date: string;
  company_logo_url: string;
  observations: string;
  conclusions: string;
  recommendations: string;
  overall_compliance: string;
  created_at: string;
  updated_at: string;
}

interface Approval {
  id: string;
  approval_type: string;
  designation: string;
  name: string;
  signature_url: string;
  signature_text: string;
  approval_date: string;
  status: string;
  remarks: string;
}

interface Revision {
  id: string;
  revision_no: string;
  change_control_no: string;
  details_of_changes: string;
  reason_of_changes: string;
  effective_date: string;
  is_locked: boolean;
}

export default function PQRViewPage() {
  const params = useParams();
  const router = useRouter();
  const [doc, setDoc] = useState<PqrDoc | null>(null);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const id = params.id as string;
      const { data: pqrData } = await supabase.from('pqr_documents').select('*').eq('id', id).maybeSingle();
      if (pqrData) setDoc(pqrData as PqrDoc);

      const { data: approvalData } = await supabase.from('pqr_approvals').select('*').eq('pqr_id', id).order('created_at');
      if (approvalData) setApprovals(approvalData as Approval[]);

      const { data: revisionData } = await supabase.from('pqr_revision_history').select('*').eq('pqr_id', id).order('created_at');
      if (revisionData) setRevisions(revisionData as Revision[]);

      setIsLoading(false);
    };
    fetch();
  }, [params.id]);

  if (isLoading) return <PageLoader />;
  if (!doc) return <div className="p-12 text-center"><p>PQR document not found</p></div>;

  const formatDate = (d: string | null) => d ? new Date(d).toLocaleDateString() : 'N/A';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard/pqr')}><ArrowLeft className="h-4 w-4" /></Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">{doc.pqr_number}</h1>
              <Badge className={statusColors[doc.document_status] || ''} variant="outline">
                {doc.document_status.replace('_', ' ')}
              </Badge>
            </div>
            <p className="text-muted-foreground text-sm">{doc.document_title}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href={`/dashboard/packaging/reviews?pqrId=${doc.id}`}>
            <Button variant="outline" className="gap-1">
              <PackageSearch className="h-4 w-4" />Packaging Review
            </Button>
          </Link>
          {doc.document_status === 'draft' && (
            <Link href={`/dashboard/pqr/${doc.id}/edit`}>
              <Button variant="outline" className="gap-1"><Edit className="h-4 w-4" />Edit</Button>
            </Link>
          )}
          <Button variant="outline" className="gap-1"><Download className="h-4 w-4" />Export PDF</Button>
        </div>
      </div>

      {/* Header Card */}
      <Card>
        <CardHeader className="bg-blue-50 dark:bg-blue-900/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {doc.company_logo_url && <img src={doc.company_logo_url} alt="Logo" className="h-10 w-10 object-contain" />}
              <div>
                <CardTitle className="text-lg">{doc.company_name}</CardTitle>
                {doc.site_name && <p className="text-sm text-muted-foreground">{doc.site_name}</p>}
              </div>
            </div>
            <div className="text-right text-sm">
              <p className="font-mono">PQR No: {doc.pqr_number}</p>
              <p className="font-mono">Rev: {doc.revision_number} | Format: {doc.format_number}</p>
              <p className="font-mono">Page: {doc.page_number}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div><span className="text-muted-foreground">Product:</span> <span className="font-semibold">{doc.product_name}</span></div>
            <div><span className="text-muted-foreground">Product Code:</span> {doc.product_code || 'N/A'}</div>
            <div><span className="text-muted-foreground">Review Period:</span> {formatDate(doc.review_period_from)} — {formatDate(doc.review_period_to)}</div>
            <div><span className="text-muted-foreground">Total Months:</span> {doc.total_review_months}</div>
          </div>
        </CardContent>
      </Card>

      {/* Review Period Summary */}
      <Card>
        <CardHeader><CardTitle className="text-lg">Review Period Summary</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-5 gap-4 p-4 bg-muted/50 rounded-lg">
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600">{doc.total_batches_manufactured}</p>
              <p className="text-xs text-muted-foreground">Manufactured</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">{doc.total_released_batches}</p>
              <p className="text-xs text-muted-foreground">Released</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-red-600">{doc.total_rejected_batches}</p>
              <p className="text-xs text-muted-foreground">Rejected</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-amber-600">{doc.total_reworked_batches}</p>
              <p className="text-xs text-muted-foreground">Reworked</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-orange-600">{doc.total_reprocessed_batches}</p>
              <p className="text-xs text-muted-foreground">Reprocessed</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Approvals */}
      <Card>
        <CardHeader><CardTitle className="text-lg flex items-center gap-2"><UserCheck className="h-5 w-5" />Approvals</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold">Type</th>
                  <th className="px-4 py-2 text-left font-semibold">Designation</th>
                  <th className="px-4 py-2 text-left font-semibold">Name</th>
                  <th className="px-4 py-2 text-left font-semibold">Signature</th>
                  <th className="px-4 py-2 text-left font-semibold">Date</th>
                  <th className="px-4 py-2 text-left font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {approvals.map(a => (
                  <tr key={a.id} className="border-b">
                    <td className="px-4 py-2 capitalize">{a.approval_type}</td>
                    <td className="px-4 py-2">{a.designation}</td>
                    <td className="px-4 py-2">{a.name || '—'}</td>
                    <td className="px-4 py-2 font-signature italic">{a.signature_text || '—'}</td>
                    <td className="px-4 py-2">{formatDate(a.approval_date)}</td>
                    <td className="px-4 py-2">
                      <Badge variant="outline" className={a.status === 'approved' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : a.status === 'rejected' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' : 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'}>
                        {a.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Revision History */}
      <Card>
        <CardHeader><CardTitle className="text-lg flex items-center gap-2"><History className="h-5 w-5" />Revision History</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold">Rev No.</th>
                  <th className="px-4 py-2 text-left font-semibold">Change Control</th>
                  <th className="px-4 py-2 text-left font-semibold">Details</th>
                  <th className="px-4 py-2 text-left font-semibold">Reason</th>
                  <th className="px-4 py-2 text-left font-semibold">Effective Date</th>
                </tr>
              </thead>
              <tbody>
                {revisions.map(r => (
                  <tr key={r.id} className="border-b">
                    <td className="px-4 py-2 font-mono">{r.revision_no}</td>
                    <td className="px-4 py-2">{r.change_control_no}</td>
                    <td className="px-4 py-2">{r.details_of_changes}</td>
                    <td className="px-4 py-2">{r.reason_of_changes}</td>
                    <td className="px-4 py-2">{formatDate(r.effective_date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Document Control Info */}
      <Card>
        <CardHeader><CardTitle className="text-lg flex items-center gap-2"><FileText className="h-5 w-5" />Document Control</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div><span className="text-muted-foreground">PQR Year:</span> {doc.pqr_year}</div>
            <div><span className="text-muted-foreground">Frequency:</span> {doc.review_frequency}</div>
            <div><span className="text-muted-foreground">Current Rev:</span> {doc.current_revision}</div>
            <div><span className="text-muted-foreground">Department:</span> {doc.document_owner_department}</div>
            <div><span className="text-muted-foreground">Effective:</span> {formatDate(doc.effective_date)}</div>
            <div><span className="text-muted-foreground">Prepared:</span> {formatDate(doc.prepared_date)}</div>
            <div><span className="text-muted-foreground">Next Review:</span> {formatDate(doc.next_review_due_date)}</div>
            <div><span className="text-muted-foreground">Compliance:</span> <Badge variant="outline">{doc.overall_compliance.replace('_', ' ')}</Badge></div>
          </div>
          {(doc.observations || doc.conclusions || doc.recommendations) && (
            <div className="mt-4 space-y-3">
              {doc.observations && <div><Label className="text-xs text-muted-foreground">Observations</Label><p className="text-sm mt-1">{doc.observations}</p></div>}
              {doc.conclusions && <div><Label className="text-xs text-muted-foreground">Conclusions</Label><p className="text-sm mt-1">{doc.conclusions}</p></div>}
              {doc.recommendations && <div><Label className="text-xs text-muted-foreground">Recommendations</Label><p className="text-sm mt-1">{doc.recommendations}</p></div>}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Label({ className, children }: { className?: string; children: React.ReactNode }) {
  return <label className={className}>{children}</label>;
}
