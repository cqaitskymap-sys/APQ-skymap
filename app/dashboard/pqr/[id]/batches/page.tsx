'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Plus,
  Search,
  Download,
  Upload,
  ArrowLeft,
  Filter,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { PageLoader } from '@/components/loaders/page-loader';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/hooks/use-toast';

interface PqrDocument {
  id: string;
  pqr_number: string;
  product_name: string;
  document_status: string;
}

interface PqrBatch {
  id: string;
  pqr_id: string;
  batch_no: string;
  semi_finish_batch_no?: string;
  finish_product_batch_no?: string;
  manufacturing_date: string;
  expiry_date: string;
  batch_size: string;
  manufactured_for: string;
  batch_status: string;
  product_name: string;
  created_at: string;
  updated_at: string;
}

const batchStatusOptions = [
  'manufactured',
  'released',
  'rejected',
  'hold',
  'reprocessed',
  'reworked',
  'cancelled',
];

const getStatusColor = (status: string) => {
  switch (status) {
    case 'manufactured':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
    case 'released':
      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
    case 'rejected':
      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
    case 'hold':
      return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400';
    case 'reprocessed':
      return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400';
    case 'reworked':
      return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400';
    case 'cancelled':
      return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
  }
};

const formatLabel = (value: string) => {
  return value
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

export default function PQRBatchesPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();

  const [pqrDoc, setPqrDoc] = useState<PqrDocument | null>(null);
  const [batches, setBatches] = useState<PqrBatch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const pqrId = params.id as string;

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);

        // Fetch PQR document
        const { data: pqrData, error: pqrError } = await supabase
          .from('pqr_documents')
          .select('id, pqr_number, product_name, document_status')
          .eq('id', pqrId)
          .maybeSingle();

        if (pqrError) {
          console.error('Error fetching PQR:', pqrError);
          toast({
            title: 'Error',
            description: 'Failed to fetch PQR document',
            variant: 'destructive',
          });
          return;
        }

        if (pqrData) {
          setPqrDoc(pqrData as PqrDocument);
        }

        // Fetch batches
        const { data: batchesData, error: batchesError } = await supabase
          .from('pqr_batches')
          .select('*')
          .eq('pqr_id', pqrId)
          .order('created_at', { ascending: false });

        if (batchesError) {
          console.error('Error fetching batches:', batchesError);
          toast({
            title: 'Error',
            description: 'Failed to fetch batches',
            variant: 'destructive',
          });
          return;
        }

        if (batchesData) {
          setBatches(batchesData as PqrBatch[]);
        }
      } catch (error) {
        console.error('Unexpected error:', error);
        toast({
          title: 'Error',
          description: 'An unexpected error occurred',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    if (pqrId && user) {
      fetchData();
    }
  }, [pqrId, user, toast]);

  // Filter and search batches
  const filteredBatches = useMemo(() => {
    return batches.filter((batch) => {
      const matchesSearch =
        batch.batch_no.toLowerCase().includes(searchTerm.toLowerCase()) ||
        batch.product_name.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus =
        statusFilter === 'all' || batch.batch_status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [batches, searchTerm, statusFilter]);

  // Calculate summary statistics
  const summaryStats = useMemo(() => {
    return {
      total: batches.length,
      released: batches.filter((b) => b.batch_status === 'released').length,
      rejected: batches.filter((b) => b.batch_status === 'rejected').length,
      hold: batches.filter((b) => b.batch_status === 'hold').length,
      reprocessed: batches.filter((b) => b.batch_status === 'reprocessed')
        .length,
    };
  }, [batches]);

  const handleExportPDF = () => {
    toast({
      title: 'Export',
      description: 'PDF export functionality coming soon',
    });
  };

  if (isLoading) {
    return <PageLoader />;
  }

  return (
    <div className="space-y-6">
      {/* Header with back button */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.back()}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
      </div>

      {/* Page Title */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          {pqrDoc ? `PQR ${pqrDoc.pqr_number} - Batch Manufacturing` : 'Batch Manufacturing'}
        </h1>
        {pqrDoc && (
          <p className="text-muted-foreground mt-1">
            Product: {pqrDoc.product_name}
          </p>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Batches
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{summaryStats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Released
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              {summaryStats.released}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Rejected
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">
              {summaryStats.rejected}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              On Hold
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-amber-600">
              {summaryStats.hold}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Reprocessed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-600">
              {summaryStats.reprocessed}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Toolbar */}
      <div className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-1">
            <div className="relative flex-1 sm:max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search batch no, product name..."
                className="pl-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {batchStatusOptions.map((status) => (
                  <SelectItem key={status} value={status}>
                    {formatLabel(status)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportPDF}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Export PDF</span>
            </Button>

            <Link
              href={`/dashboard/pqr/${pqrId}/batches/import`}
              className="flex"
            >
              <Button variant="outline" size="sm" className="gap-2">
                <Upload className="h-4 w-4" />
                <span className="hidden sm:inline">Import</span>
              </Button>
            </Link>

            <Link href={`/dashboard/pqr/${pqrId}/batches/create`}>
              <Button
                size="sm"
                className="gap-2 bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">New Batch</span>
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Batches Table */}
      <Card>
        <CardHeader>
          <CardTitle>Manufacturing Batches</CardTitle>
          <CardDescription>
            {filteredBatches.length} of {batches.length} batches
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="font-semibold w-12">Sr No</TableHead>
                    <TableHead className="font-semibold min-w-32">
                      Batch No
                    </TableHead>
                    <TableHead className="font-semibold min-w-40">
                      Semi Finish Batch No
                    </TableHead>
                    <TableHead className="font-semibold min-w-40">
                      Finish Product Batch No
                    </TableHead>
                    <TableHead className="font-semibold min-w-28">
                      MFG Date
                    </TableHead>
                    <TableHead className="font-semibold min-w-28">
                      EXP Date
                    </TableHead>
                    <TableHead className="font-semibold min-w-24">
                      Batch Size
                    </TableHead>
                    <TableHead className="font-semibold min-w-32">
                      Manufactured For
                    </TableHead>
                    <TableHead className="font-semibold min-w-24">
                      Status
                    </TableHead>
                    <TableHead className="font-semibold text-center w-20">
                      Action
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBatches.length > 0 ? (
                    filteredBatches.map((batch, index) => (
                      <TableRow
                        key={batch.id}
                        className="hover:bg-muted/50 transition-colors"
                      >
                        <TableCell className="font-medium text-center text-sm">
                          {index + 1}
                        </TableCell>
                        <TableCell className="font-mono font-semibold text-sm">
                          {batch.batch_no}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {batch.semi_finish_batch_no || '—'}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {batch.finish_product_batch_no || '—'}
                        </TableCell>
                        <TableCell className="text-sm">
                          {new Date(batch.manufacturing_date).toLocaleDateString(
                            'en-US',
                            {
                              year: 'numeric',
                              month: '2-digit',
                              day: '2-digit',
                            }
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {new Date(batch.expiry_date).toLocaleDateString(
                            'en-US',
                            {
                              year: 'numeric',
                              month: '2-digit',
                              day: '2-digit',
                            }
                          )}
                        </TableCell>
                        <TableCell className="text-sm font-medium">
                          {batch.batch_size}
                        </TableCell>
                        <TableCell className="text-sm">
                          {batch.manufactured_for}
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={cn('text-xs', getStatusColor(batch.batch_status))}
                            variant="outline"
                          >
                            {formatLabel(batch.batch_status)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Link
                            href={`/dashboard/pqr/${pqrId}/batches/${batch.id}/edit`}
                          >
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                            >
                              <svg
                                className="h-4 w-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                />
                              </svg>
                            </Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center py-8">
                        <p className="text-muted-foreground">
                          {batches.length === 0
                            ? 'No batches found for this PQR'
                            : 'No batches match your search criteria'}
                        </p>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
