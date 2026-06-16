'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Plus, Search, Download, Eye, Pencil, UserCheck, UserX } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/admin/dashboard/page-header';
import { StatusBadge } from '@/components/admin/dashboard/status-badge';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { EmptyState } from '@/components/admin/dashboard/empty-state';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { DepartmentTypeBadge } from './department-type-badge';
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
import { canEditDepartments } from '@/lib/permissions';
import { DEPARTMENT_TYPES, RECORD_STATUSES } from '@/lib/admin/constants';
import type { Department } from '@/lib/admin/schemas';
import {
  fetchDepartments, setDepartmentStatus, exportDepartmentsCsv, logDepartmentExport,
} from '@/lib/admin/department-service';

const PAGE_SIZE = 10;

export function DepartmentsListPage() {
  const { user, profile } = useAuth();
  const { role } = useAdminPermissions();
  const canEdit = canEditDepartments(role);

  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [siteFilter, setSiteFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [confirm, setConfirm] = useState<{ dept: Department; activate: boolean } | null>(null);

  const auditMeta = {
    userId: user?.uid || 'system',
    userName: profile?.full_name || profile?.email || 'Admin',
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setDepartments(await fetchDepartments());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const sites = useMemo(() => {
    const set = new Set<string>();
    departments.forEach((d) => { if (d.siteLocation) set.add(d.siteLocation); });
    return Array.from(set).sort();
  }, [departments]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return departments.filter((d) => {
      const matchSearch = !q ||
        d.departmentName?.toLowerCase().includes(q) ||
        d.departmentCode?.toLowerCase().includes(q) ||
        d.departmentId?.toLowerCase().includes(q);
      const matchStatus = statusFilter === 'all' || d.status === statusFilter;
      const matchType = typeFilter === 'all' || d.departmentType === typeFilter;
      const matchSite = siteFilter === 'all' || d.siteLocation === siteFilter;
      return matchSearch && matchStatus && matchType && matchSite;
    });
  }, [departments, search, statusFilter, typeFilter, siteFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const paginated = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

  const handleExport = async () => {
    const csv = exportDepartmentsCsv(filtered);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `departments-export-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    await logDepartmentExport(auditMeta, filtered.length);
    toast.success('Department list exported');
  };

  const runConfirm = async () => {
    if (!confirm) return;
    const status = confirm.activate ? 'Active' : 'Inactive';
    const result = await setDepartmentStatus(confirm.dept.id!, confirm.dept, status, auditMeta);
    if (result.success) {
      if (!confirm.activate && result.linkedUsers) {
        toast.warning(`${result.linkedUsers} linked user(s) remain assigned — inactive department warning applies`);
      } else {
        toast.success(`Department ${status.toLowerCase()}`);
      }
      load();
    } else {
      toast.error(result.error || 'Action failed');
    }
    setConfirm(null);
  };

  if (loading) {
    return (
      <div>
        <PageHeader title="Department Master" basePath="/admin" />
        <LoadingSkeleton rows={2} />
      </div>
    );
  }

  if (error) return <ErrorCard message={error} onRetry={load} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Department Master"
        description="Manage company departments for Pharma QMS + PQR + CPV"
        basePath="/admin"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-4 w-4 mr-1" />Export
            </Button>
            {canEdit && (
              <Button asChild size="sm" className="bg-blue-600 hover:bg-blue-700">
                <Link href="/admin/departments/create"><Plus className="h-4 w-4 mr-1" />Create Department</Link>
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
              <Input
                placeholder="Search by name or code..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
              <SelectTrigger className="w-[130px]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {RECORD_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(0); }}>
              <SelectTrigger className="w-[140px]"><SelectValue placeholder="Type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {DEPARTMENT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={siteFilter} onValueChange={(v) => { setSiteFilter(v); setPage(0); }}>
              <SelectTrigger className="w-[140px]"><SelectValue placeholder="Site" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sites</SelectItem>
                {sites.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="hidden md:block overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Head</TableHead>
                  <TableHead>Site</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.length === 0 ? (
                  <TableRow><TableCell colSpan={7}><EmptyState title="No departments found" /></TableCell></TableRow>
                ) : (
                  paginated.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-mono text-xs">{row.departmentCode}</TableCell>
                      <TableCell className="font-medium">{row.departmentName}</TableCell>
                      <TableCell><DepartmentTypeBadge type={row.departmentType} /></TableCell>
                      <TableCell>{row.departmentHead || '-'}</TableCell>
                      <TableCell>{row.siteLocation || '-'}</TableCell>
                      <TableCell><StatusBadge status={row.status} /></TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button asChild variant="ghost" size="icon">
                            <Link href={`/admin/departments/${row.id}`}><Eye className="h-4 w-4" /></Link>
                          </Button>
                          {canEdit && (
                            <>
                              <Button asChild variant="ghost" size="icon">
                                <Link href={`/admin/departments/${row.id}/edit`}><Pencil className="h-4 w-4" /></Link>
                              </Button>
                              {row.status === 'Active'
                                ? <Button variant="ghost" size="icon" onClick={() => setConfirm({ dept: row, activate: false })}><UserX className="h-4 w-4 text-amber-600" /></Button>
                                : <Button variant="ghost" size="icon" onClick={() => setConfirm({ dept: row, activate: true })}><UserCheck className="h-4 w-4 text-green-600" /></Button>
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
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold">{row.departmentName}</p>
                      <p className="text-xs text-muted-foreground">{row.departmentCode}</p>
                    </div>
                    <StatusBadge status={row.status} />
                  </div>
                  <DepartmentTypeBadge type={row.departmentType} />
                  <div className="flex gap-2 pt-2">
                    <Button asChild size="sm" variant="outline"><Link href={`/admin/departments/${row.id}`}>View</Link></Button>
                    {canEdit && <Button asChild size="sm" variant="outline"><Link href={`/admin/departments/${row.id}/edit`}>Edit</Link></Button>}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{filtered.length} departments</span>
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
            <AlertDialogTitle>{confirm?.activate ? 'Activate Department' : 'Deactivate Department'}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.activate
                ? `Activate department "${confirm?.dept.departmentName}"?`
                : `Deactivate "${confirm?.dept.departmentName}"? Linked users will remain assigned but new assignments will be blocked.`}
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
