'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Plus, Search, Download, Eye, Pencil, UserCheck, UserX, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/admin/dashboard/page-header';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { EmptyState } from '@/components/admin/dashboard/empty-state';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { DosageFormBadge } from './dosage-form-badge';
import { ProductStatusBadge } from './product-status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
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
import { canEditProducts, canImportProducts } from '@/lib/permissions';
import { DOSAGE_FORMS, MARKET_OPTIONS, PRODUCT_STATUSES } from '@/lib/admin/constants';
import type { AdminProduct } from '@/lib/admin/schemas';
import {
  fetchProducts, setProductStatus, exportProductsCsv, logProductExport, importProductsFromFile,
} from '@/lib/admin/product-service';

const PAGE_SIZE = 10;

export function ProductsListPage() {
  const { user, profile } = useAuth();
  const { role } = useAdminPermissions();
  const canEdit = canEditProducts(role);
  const canImport = canImportProducts(role);

  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [formFilter, setFormFilter] = useState('all');
  const [marketFilter, setMarketFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [confirm, setConfirm] = useState<{ product: AdminProduct; activate: boolean } | null>(null);

  const auditMeta = {
    userId: user?.uid || 'system',
    userName: profile?.full_name || profile?.email || 'Admin',
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setProducts(await fetchProducts());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return products.filter((p) => {
      const matchSearch = !q ||
        p.productName?.toLowerCase().includes(q) ||
        p.productCode?.toLowerCase().includes(q) ||
        p.genericName?.toLowerCase().includes(q);
      const matchForm = formFilter === 'all' || p.dosageForm === formFilter;
      const matchMarket = marketFilter === 'all' || p.market === marketFilter;
      const matchStatus = statusFilter === 'all' || p.productStatus === statusFilter;
      return matchSearch && matchForm && matchMarket && matchStatus;
    });
  }, [products, search, formFilter, marketFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const paginated = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

  const handleExport = async () => {
    const csv = exportProductsCsv(filtered);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `products-export-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    await logProductExport(auditMeta, filtered.length);
    toast.success('Product list exported');
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const result = await importProductsFromFile(file, auditMeta);
    if (result.imported) toast.success(`Imported ${result.imported} product(s)`);
    if (result.errors.length) toast.warning(`${result.errors.length} row(s) failed`);
    load();
    e.target.value = '';
  };

  const runConfirm = async () => {
    if (!confirm) return;
    const status = confirm.activate ? 'Active' : 'Inactive';
    const result = await setProductStatus(confirm.product.id!, confirm.product, status, auditMeta);
    if (result.success) {
      toast.success(`Product ${status === 'Active' ? 'activated' : 'deactivated'}`);
      load();
    } else toast.error(result.error || 'Action failed');
    setConfirm(null);
  };

  if (loading) return <div><PageHeader title="Product Master" basePath="/admin" /><LoadingSkeleton rows={2} /></div>;
  if (error) return <ErrorCard message={error} onRetry={load} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Product Master"
        description="Pharma product master for PQR, CPV, Batch, Stability, and QMS modules"
        basePath="/admin"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleExport}><Download className="h-4 w-4 mr-1" />Export</Button>
            {canImport && (
              <Button variant="outline" size="sm" asChild>
                <label className="cursor-pointer">
                  <Upload className="h-4 w-4 mr-1" />Import CSV
                  <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleImport} />
                </label>
              </Button>
            )}
            {canEdit && (
              <Button asChild size="sm" className="bg-blue-600 hover:bg-blue-700">
                <Link href="/admin/products/create"><Plus className="h-4 w-4 mr-1" />Create Product</Link>
              </Button>
            )}
          </div>
        }
      />

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col lg:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search name, code, generic..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} className="pl-9" />
            </div>
            <Select value={formFilter} onValueChange={(v) => { setFormFilter(v); setPage(0); }}>
              <SelectTrigger className="w-[140px]"><SelectValue placeholder="Dosage Form" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Forms</SelectItem>
                {DOSAGE_FORMS.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={marketFilter} onValueChange={(v) => { setMarketFilter(v); setPage(0); }}>
              <SelectTrigger className="w-[130px]"><SelectValue placeholder="Market" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Markets</SelectItem>
                {MARKET_OPTIONS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
              <SelectTrigger className="w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {PRODUCT_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="hidden md:block overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead>Code</TableHead>
                  <TableHead>Product Name</TableHead>
                  <TableHead>Generic</TableHead>
                  <TableHead>Strength</TableHead>
                  <TableHead>Form</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.length === 0 ? (
                  <TableRow><TableCell colSpan={7}><EmptyState title="No products found" /></TableCell></TableRow>
                ) : (
                  paginated.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-mono text-xs">{row.productCode}</TableCell>
                      <TableCell className="font-medium">{row.productName}</TableCell>
                      <TableCell className="text-sm">{row.genericName}</TableCell>
                      <TableCell>{row.strength}</TableCell>
                      <TableCell><DosageFormBadge form={row.dosageForm} /></TableCell>
                      <TableCell><ProductStatusBadge status={row.productStatus} /></TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button asChild variant="ghost" size="icon"><Link href={`/admin/products/${row.id}`}><Eye className="h-4 w-4" /></Link></Button>
                          {canEdit && (
                            <>
                              <Button asChild variant="ghost" size="icon"><Link href={`/admin/products/${row.id}/edit`}><Pencil className="h-4 w-4" /></Link></Button>
                              {row.productStatus === 'Active'
                                ? <Button variant="ghost" size="icon" onClick={() => setConfirm({ product: row, activate: false })}><UserX className="h-4 w-4 text-amber-600" /></Button>
                                : <Button variant="ghost" size="icon" onClick={() => setConfirm({ product: row, activate: true })}><UserCheck className="h-4 w-4 text-green-600" /></Button>
                              }
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
            {paginated.map((row) => (
              <Card key={row.id} className="border">
                <CardContent className="p-4 space-y-2">
                  <div className="flex justify-between">
                    <p className="font-semibold">{row.productName}</p>
                    <ProductStatusBadge status={row.productStatus} />
                  </div>
                  <p className="text-xs text-muted-foreground">{row.productCode} · {row.genericName}</p>
                  <DosageFormBadge form={row.dosageForm} />
                  <div className="flex gap-2 pt-2">
                    <Button asChild size="sm" variant="outline"><Link href={`/admin/products/${row.id}`}>View</Link></Button>
                    {canEdit && <Button asChild size="sm" variant="outline"><Link href={`/admin/products/${row.id}/edit`}>Edit</Link></Button>}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{filtered.length} products</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={currentPage === 0} onClick={() => setPage((p) => p - 1)}>Prev</Button>
              <span>Page {currentPage + 1}/{totalPages}</span>
              <Button variant="outline" size="sm" disabled={currentPage >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={!!confirm} onOpenChange={() => setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm?.activate ? 'Activate Product' : 'Deactivate Product'}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.activate
                ? `Activate "${confirm?.product.productName}"?`
                : `Deactivate "${confirm?.product.productName}"? New PQR and CPV batch registration will be blocked.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={runConfirm} className="bg-blue-600">Confirm</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
