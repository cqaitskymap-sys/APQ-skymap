'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Plus, Search, Download, Eye, Pencil, UserCheck, UserX, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/admin/dashboard/page-header';
import { StatusBadge } from '@/components/admin/dashboard/status-badge';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { EmptyState } from '@/components/admin/dashboard/empty-state';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
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
import { canEditRoles } from '@/lib/permissions';
import { RECORD_STATUSES } from '@/lib/admin/constants';
import type { AdminRole } from '@/lib/admin/schemas';
import { fetchRoles, setRoleStatus, exportRolesCsv } from '@/lib/admin/role-service';
import { deleteAdminRecord } from '@/lib/admin/admin-service';
import { ADMIN_COLLECTIONS } from '@/lib/admin/constants';

const PAGE_SIZE = 10;

export function RolesListPage() {
  const { user, profile } = useAuth();
  const { role, canDelete } = useAdminPermissions();
  const canEdit = canEditRoles(role);

  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [confirm, setConfirm] = useState<{ role: AdminRole; activate: boolean } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<AdminRole | null>(null);

  const auditMeta = {
    userId: user?.uid || 'system',
    userName: profile?.full_name || profile?.email || 'Admin',
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRoles(await fetchRoles());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    return roles.filter((r) => {
      const q = search.toLowerCase();
      const matchSearch = !q ||
        r.roleName?.toLowerCase().includes(q) ||
        r.roleId?.toLowerCase().includes(q);
      const matchStatus = statusFilter === 'all' || r.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [roles, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const paginated = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

  const handleExport = () => {
    const csv = exportRolesCsv(filtered);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `roles-export-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const runConfirm = async () => {
    if (!confirm) return;
    const status = confirm.activate ? 'Active' : 'Inactive';
    const result = await setRoleStatus(confirm.role.id!, confirm.role, status, auditMeta, role);
    if (result.success) {
      toast.success(`Role ${status.toLowerCase()}`);
      load();
    } else {
      toast.error(result.error || 'Action failed');
    }
    setConfirm(null);
  };

  const runDelete = async () => {
    if (!deleteConfirm?.id) return;
    if (deleteConfirm.roleId === 'super_admin') {
      toast.error('Super Admin role cannot be deleted');
      setDeleteConfirm(null);
      return;
    }
    try {
      const ok = await deleteAdminRecord(ADMIN_COLLECTIONS.roles, deleteConfirm.id, {
        userId: auditMeta.userId,
        userName: auditMeta.userName,
        module: 'Role & Permission',
      });
      if (ok) {
        toast.success('Role deleted');
        load();
      } else {
        toast.error('Delete failed');
      }
    } catch {
      toast.error('Delete failed');
    } finally {
      setDeleteConfirm(null);
    }
  };

  if (loading) {
    return (
      <div>
        <PageHeader title="Role & Permission" basePath="/admin" />
        <LoadingSkeleton rows={2} />
      </div>
    );
  }

  if (error) return <ErrorCard message={error} onRetry={load} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Role & Permission Management"
        description="Configure role-based access control for Pharma QMS + PQR + CPV"
        basePath="/admin"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleExport}><Download className="h-4 w-4 mr-1" />Export</Button>
            {canEdit && (
              <Button asChild size="sm" className="bg-blue-600 hover:bg-blue-700">
                <Link href="/admin/roles/create"><Plus className="h-4 w-4 mr-1" />Create Role</Link>
              </Button>
            )}
          </div>
        }
      />

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search roles..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} className="pl-9" />
            </div>
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
              <SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {RECORD_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="hidden md:block overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead>Role ID</TableHead>
                  <TableHead>Role Name</TableHead>
                  <TableHead>Level</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.length === 0 ? (
                  <TableRow><TableCell colSpan={6}><EmptyState title="No roles found" /></TableCell></TableRow>
                ) : (
                  paginated.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-mono text-xs">{row.roleId}</TableCell>
                      <TableCell className="font-medium">{row.roleName}</TableCell>
                      <TableCell>{row.roleLevel ?? row.level}</TableCell>
                      <TableCell>{row.departmentAccess || 'All'}</TableCell>
                      <TableCell><StatusBadge status={row.status} /></TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button asChild variant="ghost" size="icon"><Link href={`/admin/roles/${row.id}`}><Eye className="h-4 w-4" /></Link></Button>
                          {canEdit && (
                            <>
                              <Button asChild variant="ghost" size="icon"><Link href={`/admin/roles/${row.id}/edit`}><Pencil className="h-4 w-4" /></Link></Button>
                              {row.roleId !== 'super_admin' && (
                                row.status === 'Active'
                                  ? <Button variant="ghost" size="icon" onClick={() => setConfirm({ role: row, activate: false })}><UserX className="h-4 w-4 text-amber-600" /></Button>
                                  : <Button variant="ghost" size="icon" onClick={() => setConfirm({ role: row, activate: true })}><UserCheck className="h-4 w-4 text-green-600" /></Button>
                              )}
                              {canDelete && row.roleId !== 'super_admin' && (
                                <Button variant="ghost" size="icon" onClick={() => setDeleteConfirm(row)}>
                                  <Trash2 className="h-4 w-4 text-red-600" />
                                </Button>
                              )}
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
                    <p className="font-semibold">{row.roleName}</p>
                    <StatusBadge status={row.status} />
                  </div>
                  <p className="text-xs text-muted-foreground">{row.roleId}</p>
                  <div className="flex gap-2 pt-2">
                    <Button asChild size="sm" variant="outline"><Link href={`/admin/roles/${row.id}`}>View</Link></Button>
                    {canEdit && <Button asChild size="sm" variant="outline"><Link href={`/admin/roles/${row.id}/edit`}>Edit</Link></Button>}
                    {canDelete && row.roleId !== 'super_admin' && (
                      <Button size="sm" variant="destructive" onClick={() => setDeleteConfirm(row)}>Delete</Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{filtered.length} roles</span>
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
            <AlertDialogTitle>{confirm?.activate ? 'Activate Role' : 'Deactivate Role'}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.activate ? 'Activate' : 'Deactivate'} role &quot;{confirm?.role.roleName}&quot;?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={runConfirm} className="bg-blue-600">Confirm</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Role</AlertDialogTitle>
            <AlertDialogDescription>
              {`Delete "${deleteConfirm?.roleName}"? This action cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={runDelete} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
