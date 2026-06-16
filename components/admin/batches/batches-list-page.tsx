'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Plus, Search, Download, Eye, Pencil, Upload, CheckCircle, XCircle, PauseCircle } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/admin/dashboard/page-header';
import { KpiCard } from '@/components/admin/dashboard/kpi-card';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { EmptyState } from '@/components/admin/dashboard/empty-state';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { BatchStatusBadge } from './batch-status-badge';
import { ReleaseStatusBadge } from './release-status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAuth } from '@/contexts/auth-context';
import { useAdminPermissions } from '@/hooks/use-admin-permissions';
import {
  canEditBatches, canImportBatches, canReleaseBatches, canProductionCreateBatches,
} from '@/lib/permissions';
import { BATCH_STATUSES, RELEASE_STATUSES } from '@/lib/admin/constants';
import type { AdminBatch } from '@/lib/admin/schemas';
import { fetchProducts } from '@/lib/admin/product-service';
import {
  fetchBatches, getBatchSummaryCounts, setBatchStatusAction,
  exportBatchesCsv, logBatchExport, importBatchesFromFile,
} from '@/lib/admin/batch-service';

const PAGE_SIZE = 10;

type StatusAction = { batch: AdminBatch; action: 'release' | 'reject' | 'hold' } | null;

export function BatchesListPage() {
  const { user, profile } = useAuth();
  const { role } = useAdminPermissions();
  const canEdit = canEditBatches(role);
  const canCreate = canProductionCreateBatches(role);
  const canImport = canImportBatches(role);
  const canRelease = canReleaseBatches(role);

  const [batches, setBatches] = useState<AdminBatch[]>([]);
  const [productOptions, setProductOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [productFilter, setProductFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [releaseFilter, setReleaseFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(0);
  const [statusAction, setStatusAction] = useState<StatusAction>(null);
  const [actionReason, setActionReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const auditMeta = {
    userId: user?.uid || 'system',
    userName: profile?.full_name || profile?.email || 'Admin',
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [batchList, products] = await Promise.all([fetchBatches(), fetchProducts()]);
      setBatches(batchList);
      setProductOptions(Array.from(new Set(products.map((p) => p.productCode).filter(Boolean))));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return batches.filter((b) => {
      const matchSearch = !q ||
        b.batchNumber?.toLowerCase().includes(q) ||
        b.productCode?.toLowerCase().includes(q) ||
        b.productName?.toLowerCase().includes(q) ||
        b.customerName?.toLowerCase().includes(q);
      const matchProduct = productFilter === 'all' || b.productCode === productFilter;
      const matchStatus = statusFilter === 'all' || b.batchStatus === statusFilter;
      const matchRelease = releaseFilter === 'all' || b.releaseStatus === releaseFilter;
      const mfg = b.manufacturingDate || '';
      const matchFrom = !dateFrom || mfg >= dateFrom;
      const matchTo = !dateTo || mfg <= dateTo;
      return matchSearch && matchProduct && matchStatus && matchRelease && matchFrom && matchTo;
    });
  }, [batches, search, productFilter, statusFilter, releaseFilter, dateFrom, dateTo]);

  const stats = getBatchSummaryCounts(batches);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const paginated = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

  const handleExport = async () => {
    const csv = exportBatchesCsv(filtered);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `batches-export-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    await logBatchExport(auditMeta, filtered.length);
    toast.success('Batch list exported');
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const result = await importBatchesFromFile(file, auditMeta);
    if (result.imported) toast.success(`Imported ${result.imported} batch(es)`);
    if (result.errors.length) toast.warning(`${result.errors.length} row(s) failed`);
    load();
    e.target.value = '';
  };

  const runStatusAction = async () => {
    if (!statusAction) return;
    setActionLoading(true);
    const result = await setBatchStatusAction(
      statusAction.batch.id!,
      statusAction.batch,
      statusAction.action,
      actionReason,
      auditMeta,
    );
    setActionLoading(false);
    if (result.success) {
      toast.success(`Batch ${statusAction.action}d successfully`);
      setStatusAction(null);
      setActionReason('');
      load();
    } else toast.error(result.error || 'Action failed');
  };

  if (loading) return <div><PageHeader title="Batch Master" basePath="/admin" /><LoadingSkeleton rows={2} /></div>;
  if (error) return <ErrorCard message={error} onRetry={load} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Batch Master"
        description="Product batch master for PQR, CPV, CPP, CQA, Deviation, OOS, CAPA, and Stability"
        basePath="/admin"
        actions={
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={handleExport}><Download className="h-4 w-4 mr-1" />Export</Button>
            {canImport && (
              <Button variant="outline" size="sm" asChild>
                <label className="cursor-pointer">
                  <Upload className="h-4 w-4 mr-1" />Import CSV
                  <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleImport} />
                </label>
              </Button>
            )}
            {canCreate && (
              <Button asChild size="sm" className="bg-blue-600 hover:bg-blue-700">
                <Link href="/admin/batches/create"><Plus className="h-4 w-4 mr-1" />Create Batch</Link>
              </Button>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        <KpiCard label="Total" value={stats.total} />
        <KpiCard label="Planned" value={stats.planned} />
        <KpiCard label="Manufacturing" value={stats.manufacturing} />
        <KpiCard label="QC Testing" value={stats.qcTesting} />
        <KpiCard label="QA Review" value={stats.qaReview} />
        <KpiCard label="Released" value={stats.released} />
        <KpiCard label="Rejected" value={stats.rejected} />
        <KpiCard label="Hold" value={stats.hold} />
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col lg:flex-row gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search batch, product, customer..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                className="pl-9"
              />
            </div>
            <Select value={productFilter} onValueChange={(v) => { setProductFilter(v); setPage(0); }}>
              <SelectTrigger className="w-[150px]"><SelectValue placeholder="Product" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Products</SelectItem>
                {productOptions.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Batch Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {BATCH_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={releaseFilter} onValueChange={(v) => { setReleaseFilter(v); setPage(0); }}>
              <SelectTrigger className="w-[150px]"><SelectValue placeholder="Release" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Release</SelectItem>
                {RELEASE_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(0); }} className="w-[140px]" />
            <Input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(0); }} className="w-[140px]" />
          </div>

          <div className="hidden md:block overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead>Batch No</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Mfg Date</TableHead>
                  <TableHead>Expiry</TableHead>
                  <TableHead>Batch Status</TableHead>
                  <TableHead>Release</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.length === 0 ? (
                  <TableRow><TableCell colSpan={8}><EmptyState title="No batches found" /></TableCell></TableRow>
                ) : (
                  paginated.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-mono text-xs font-medium">{row.batchNumber}</TableCell>
                      <TableCell>
                        <div className="text-sm">{row.productName}</div>
                        <div className="text-xs text-muted-foreground">{row.productCode}</div>
                      </TableCell>
                      <TableCell className="text-sm">{row.customerName || '-'}</TableCell>
                      <TableCell className="text-sm">{row.manufacturingDate}</TableCell>
                      <TableCell className="text-sm">{row.expiryDate}</TableCell>
                      <TableCell><BatchStatusBadge status={row.batchStatus} /></TableCell>
                      <TableCell><ReleaseStatusBadge status={row.releaseStatus} /></TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button asChild variant="ghost" size="icon"><Link href={`/admin/batches/${row.id}`}><Eye className="h-4 w-4" /></Link></Button>
                          {canEdit && row.batchStatus !== 'Released' && (
                            <Button asChild variant="ghost" size="icon"><Link href={`/admin/batches/${row.id}/edit`}><Pencil className="h-4 w-4" /></Link></Button>
                          )}
                          {canRelease && row.batchStatus !== 'Released' && row.batchStatus !== 'Rejected' && (
                            <>
                              <Button variant="ghost" size="icon" onClick={() => setStatusAction({ batch: row, action: 'release' })}>
                                <CheckCircle className="h-4 w-4 text-green-600" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => setStatusAction({ batch: row, action: 'hold' })}>
                                <PauseCircle className="h-4 w-4 text-amber-600" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => setStatusAction({ batch: row, action: 'reject' })}>
                                <XCircle className="h-4 w-4 text-red-600" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="md:hidden space-y-3">
            {paginated.length === 0 ? (
              <EmptyState title="No batches found" />
            ) : (
              paginated.map((row) => (
                <Card key={row.id} className="border">
                  <CardContent className="p-4 space-y-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold font-mono">{row.batchNumber}</p>
                        <p className="text-sm">{row.productName}</p>
                      </div>
                      <BatchStatusBadge status={row.batchStatus} />
                    </div>
                    <ReleaseStatusBadge status={row.releaseStatus} />
                    <p className="text-xs text-muted-foreground">{row.manufacturingDate} → {row.expiryDate}</p>
                    <div className="flex gap-2 pt-2 flex-wrap">
                      <Button asChild size="sm" variant="outline"><Link href={`/admin/batches/${row.id}`}>View</Link></Button>
                      {canEdit && row.batchStatus !== 'Released' && (
                        <Button asChild size="sm" variant="outline"><Link href={`/admin/batches/${row.id}/edit`}>Edit</Link></Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{filtered.length} batches</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={currentPage === 0} onClick={() => setPage((p) => p - 1)}>Prev</Button>
              <span>Page {currentPage + 1}/{totalPages}</span>
              <Button variant="outline" size="sm" disabled={currentPage >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={!!statusAction} onOpenChange={() => { setStatusAction(null); setActionReason(''); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {statusAction?.action === 'release' ? 'Release Batch' : statusAction?.action === 'reject' ? 'Reject Batch' : 'Hold Batch'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {statusAction?.action === 'release'
                ? `Release batch "${statusAction?.batch.batchNumber}" for distribution?`
                : statusAction?.action === 'reject'
                  ? `Reject batch "${statusAction?.batch.batchNumber}"? This action requires a reason.`
                  : `Place batch "${statusAction?.batch.batchNumber}" on hold?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 py-2">
            <Label>Reason *</Label>
            <Textarea value={actionReason} onChange={(e) => setActionReason(e.target.value)} rows={3} placeholder="Enter reason for this action..." />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={statusAction?.action === 'reject' ? 'bg-red-600' : statusAction?.action === 'hold' ? 'bg-amber-600' : 'bg-green-600'}
              disabled={!actionReason.trim() || actionLoading}
              onClick={runStatusAction}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
