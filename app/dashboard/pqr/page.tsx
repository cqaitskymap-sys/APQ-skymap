'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Download, Eye, Search, FileText, Edit, Trash2, Clock, CheckCircle, AlertCircle, Archive } from 'lucide-react';
import { firestore } from '@/lib/firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { PageLoader } from '@/components/loaders/page-loader';
import Link from 'next/link';

const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
  under_review: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  approved: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  archived: 'bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-400',
};

const statusIcons: Record<string, React.ReactNode> = {
  draft: <Clock className="h-3 w-3" />,
  under_review: <AlertCircle className="h-3 w-3" />,
  approved: <CheckCircle className="h-3 w-3" />,
  rejected: <AlertCircle className="h-3 w-3" />,
  archived: <Archive className="h-3 w-3" />,
};

interface PqrDoc {
  id: string;
  pqr_number: string;
  document_title: string;
  product_name: string;
  document_status: string;
  review_period_from: string;
  review_period_to: string;
  revision_number: string;
  created_at: string;
}

export default function PQRListPage() {
  const [documents, setDocuments] = useState<PqrDoc[]>([]);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      const q = query(collection(firestore, 'pqr_documents'), orderBy('created_at', 'desc'));
      const querySnapshot = await getDocs(q);
      const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PqrDoc));
      setDocuments(data);
    } catch (error) {
      console.error('Error fetching documents:', error);
    }
    setIsLoading(false);
  };

  if (isLoading) return <PageLoader />;

  const filtered = documents.filter(d => {
    const matchesSearch = d.pqr_number.toLowerCase().includes(search.toLowerCase()) ||
      d.product_name.toLowerCase().includes(search.toLowerCase()) ||
      d.document_title.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = filterStatus === 'all' || d.document_status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">PQR Management</h1>
          <p className="text-muted-foreground">Product Quality Review — yearly compliance documentation</p>
        </div>
        <Link href="/dashboard/pqr/create">
          <Button className="bg-blue-600 hover:bg-blue-500 gap-2">
            <Plus className="h-4 w-4" />New PQR
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-6"><p className="text-sm text-muted-foreground mb-1">Total PQRs</p><p className="text-3xl font-bold">{documents.length}</p></CardContent></Card>
        <Card><CardContent className="p-6"><p className="text-sm text-muted-foreground mb-1">Drafts</p><p className="text-3xl font-bold">{documents.filter(d => d.document_status === 'draft').length}</p></CardContent></Card>
        <Card><CardContent className="p-6"><p className="text-sm text-muted-foreground mb-1">Under Review</p><p className="text-3xl font-bold text-amber-600">{documents.filter(d => d.document_status === 'under_review').length}</p></CardContent></Card>
        <Card><CardContent className="p-6"><p className="text-sm text-muted-foreground mb-1">Approved</p><p className="text-3xl font-bold text-green-600">{documents.filter(d => d.document_status === 'approved').length}</p></CardContent></Card>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="flex-1 min-w-[200px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by PQR number, product, or title..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="under_review">Under Review</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-3">
        {filtered.map(doc => (
          <Card key={doc.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <FileText className="h-4 w-4 text-blue-600" />
                    <p className="font-mono font-semibold text-sm">{doc.pqr_number}</p>
                    <Badge className={statusColors[doc.document_status] || ''} variant="outline">
                      <span className="flex items-center gap-1">{statusIcons[doc.document_status]}{doc.document_status.replace('_', ' ')}</span>
                    </Badge>
                  </div>
                  <h3 className="font-semibold text-base">{doc.document_title}</h3>
                  <p className="text-sm text-muted-foreground">{doc.product_name} | Rev: {doc.revision_number}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Review: {doc.review_period_from ? new Date(doc.review_period_from).toLocaleDateString() : 'N/A'} — {doc.review_period_to ? new Date(doc.review_period_to).toLocaleDateString() : 'N/A'}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Link href={`/dashboard/pqr/${doc.id}`}>
                    <Button variant="outline" size="sm" className="gap-1"><Eye className="h-3.5 w-3.5" />View</Button>
                  </Link>
                  {doc.document_status === 'draft' && (
                    <Link href={`/dashboard/pqr/${doc.id}/edit`}>
                      <Button variant="outline" size="sm" className="gap-1"><Edit className="h-3.5 w-3.5" />Edit</Button>
                    </Link>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {filtered.length === 0 && (
          <Card>
            <CardContent className="p-12 text-center">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No PQR documents match your filters</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
