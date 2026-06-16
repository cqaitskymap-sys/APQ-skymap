'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Plus, Search, Download, Eye, Pencil, UserCheck, UserX, Star } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/admin/dashboard/page-header';
import { StatusBadge } from '@/components/admin/dashboard/status-badge';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { EmptyState } from '@/components/admin/dashboard/empty-state';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { SiteTypeBadge } from './site-type-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
import { canEditCompanySites } from '@/lib/permissions';
import { SITE_TYPES, RECORD_STATUSES } from '@/lib/admin/constants';
import type { CompanySite } from '@/lib/admin/schemas';
import {
  fetchCompanySites, setCompanySiteStatus, setDefaultCompanySite,
  exportCompanySitesCsv, logCompanySiteExport,
} from '@/lib/admin/company-site-service';

const PAGE_SIZE = 10;

type ConfirmState = {
  type: 'activate' | 'deactivate' | 'default';
  site: CompanySite;
} | null;

export function CompanySitesListPage() {
  const { user, profile } = useAuth();
  const { role } = useAdminPermissions();
  const canEdit = canEditCompanySites(role);

  const [sites, setSites] = useState<CompanySite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [confirm, setConfirm] = useState<ConfirmState>(null);

  const auditMeta = {
    userId: user?.uid || 'system',
    userName: profile?.full_name || profile?.email || 'Admin',
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setSites(await fetchCompanySites());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return sites.filter((s) => {
      const matchSearch = !q ||
        s.companyName?.toLowerCase().includes(q) ||
        s.siteName?.toLowerCase().includes(q) ||
        s.companyCode?.toLowerCase().includes(q) ||
        s.siteCode?.toLowerCase().includes(q);
      const matchStatus = statusFilter === 'all' || s.status === statusFilter;
      const matchType = typeFilter === 'all' || s.siteType === typeFilter;
      return matchSearch && matchStatus && matchType;
    });
  }, [sites, search, statusFilter, typeFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const paginated = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

  const handleExport = async () => {
    const csv = exportCompanySitesCsv(filtered);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `company-sites-export-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    await logCompanySiteExport(auditMeta, filtered.length);
    toast.success('Company/site list exported');
  };

  const runConfirm = async () => {
    if (!confirm) return;
    if (confirm.type === 'default') {
      const result = await setDefaultCompanySite(confirm.site.id!, confirm.site, auditMeta);
      if (result.success) {
        toast.success('Default site updated');
        load();
      } else toast.error(result.error || 'Failed');
    } else {
      const status = confirm.type === 'activate' ? 'Active' : 'Inactive';
      const result = await setCompanySiteStatus(confirm.site.id!, confirm.site, status, auditMeta);
      if (result.success) {
        if (status === 'Inactive') toast.warning('Inactive site — new PQR/CPV/QMS records cannot use this site');
        else toast.success('Site activated');
        load();
      } else toast.error(result.error || 'Action failed');
    }
    setConfirm(null);
  };

  if (loading) {
    return (
      <div>
        <PageHeader title="Company / Site Master" basePath="/admin" />
        <LoadingSkeleton rows={2} />
      </div>
    );
  }

  if (error) return <ErrorCard message={error} onRetry={load} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Company / Site Master"
        description="Manage company, plant, site and document header details"
        basePath="/admin"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleExport}><Download className="h-4 w-4 mr-1" />Export</Button>
            {canEdit && (
              <Button asChild size="sm" className="bg-blue-600 hover:bg-blue-700">
                <Link href="/admin/company-site/create"><Plus className="h-4 w-4 mr-1" />Create Site</Link>
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
              <Input placeholder="Search company, site, or code..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} className="pl-9" />
            </div>
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
              <SelectTrigger className="w-[130px]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {RECORD_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(0); }}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="Site Type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {SITE_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="hidden md:block overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead>Company</TableHead>
                  <TableHead>Site</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.length === 0 ? (
                  <TableRow><TableCell colSpan={6}><EmptyState title="No company/sites found" /></TableCell></TableRow>
                ) : (
                  paginated.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <div className="font-medium">{row.companyName}</div>
                        <div className="text-xs text-muted-foreground font-mono">{row.companyCode}</div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{row.siteName}</div>
                        <div className="text-xs text-muted-foreground font-mono">{row.siteCode}</div>
                        {row.isDefault && <Badge className="mt-1 text-[10px] bg-blue-100 text-blue-700">Default</Badge>}
                      </TableCell>
                      <TableCell><SiteTypeBadge type={row.siteType} /></TableCell>
                      <TableCell className="text-sm">{row.city}{row.state ? `, ${row.state}` : ''}</TableCell>
                      <TableCell><StatusBadge status={row.status} /></TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button asChild variant="ghost" size="icon"><Link href={`/admin/company-site/${row.id}`}><Eye className="h-4 w-4" /></Link></Button>
                          {canEdit && (
                            <>
                              <Button asChild variant="ghost" size="icon"><Link href={`/admin/company-site/${row.id}/edit`}><Pencil className="h-4 w-4" /></Link></Button>
                              {!row.isDefault && row.status === 'Active' && (
                                <Button variant="ghost" size="icon" onClick={() => setConfirm({ type: 'default', site: row })}><Star className="h-4 w-4 text-blue-600" /></Button>
                              )}
                              {row.status === 'Active'
                                ? <Button variant="ghost" size="icon" onClick={() => setConfirm({ type: 'deactivate', site: row })}><UserX className="h-4 w-4 text-amber-600" /></Button>
                                : <Button variant="ghost" size="icon" onClick={() => setConfirm({ type: 'activate', site: row })}><UserCheck className="h-4 w-4 text-green-600" /></Button>
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
                    <div>
                      <p className="font-semibold">{row.companyName}</p>
                      <p className="text-sm">{row.siteName}</p>
                    </div>
                    <StatusBadge status={row.status} />
                  </div>
                  <SiteTypeBadge type={row.siteType} />
                  <div className="flex gap-2 pt-2">
                    <Button asChild size="sm" variant="outline"><Link href={`/admin/company-site/${row.id}`}>View</Link></Button>
                    {canEdit && <Button asChild size="sm" variant="outline"><Link href={`/admin/company-site/${row.id}/edit`}>Edit</Link></Button>}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{filtered.length} sites</span>
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
            <AlertDialogTitle>
              {confirm?.type === 'default' ? 'Set Default Site'
                : confirm?.type === 'activate' ? 'Activate Site' : 'Deactivate Site'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.type === 'default'
                ? `Set "${confirm?.site.siteName}" as the default site for document headers?`
                : confirm?.type === 'activate'
                  ? `Activate site "${confirm?.site.siteName}"?`
                  : `Deactivate "${confirm?.site.siteName}"? Existing records remain viewable; new PQR/CPV/QMS records cannot use this site.`}
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
