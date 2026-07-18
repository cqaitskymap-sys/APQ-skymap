'use client';

import {
  useCallback, useDeferredValue, useEffect, useMemo, useState,
} from 'react';
import Link from 'next/link';
import {
  Plus, Search, Download, Eye, Pencil, UserX, UserCheck, Lock, Unlock, Key, Filter,
  Trash2, RotateCcw, ArrowUpDown,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/admin/dashboard/page-header';
import { KpiCard } from '@/components/admin/dashboard/kpi-card';
import { StatusBadge } from '@/components/admin/dashboard/status-badge';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { EmptyState } from '@/components/admin/dashboard/empty-state';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { RoleBadge } from './role-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
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
import { canEditUsers } from '@/lib/permissions';
import { ADMIN_ROLES, USER_STATUSES } from '@/lib/admin/constants';
import type { AdminUser } from '@/lib/admin/schemas';
import {
  exportUsersCsv, fetchUsers, lockUser, resetUserPassword, restoreUser, setUserStatus,
  softDeleteUser, subscribeToUsers,
} from '@/lib/admin/user-service';

const PAGE_SIZE = 10;

type ConfirmAction = {
  type: 'deactivate' | 'activate' | 'lock' | 'unlock' | 'reset' | 'restore';
  user: AdminUser;
} | null;

export function UsersListPage() {
  const { user, profile } = useAuth();
  const { role, canDelete, hasPermission } = useAdminPermissions();
  const canEdit = canEditUsers(role) && hasPermission('Admin', 'edit');
  const canRetire = canDelete && hasPermission('Admin', 'delete');

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [roleFilter, setRoleFilter] = useState('all');
  const [deptFilter, setDeptFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'name' | 'employeeId' | 'department' | 'lastLogin'>('name');
  const [includeRetired, setIncludeRetired] = useState(false);
  const [page, setPage] = useState(0);
  const [confirm, setConfirm] = useState<ConfirmAction>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<AdminUser | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState('');
  const [actionReason, setActionReason] = useState('');
  const [bulkReason, setBulkReason] = useState('');

  const auditMeta = {
    userId: user?.uid || 'system',
    userName: profile?.full_name || profile?.email || 'Admin',
    role,
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setUsers(await fetchUsers(includeRetired));
      setSelectedIds(new Set());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [includeRetired]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    return subscribeToUsers(includeRetired, (nextUsers) => {
      setUsers(nextUsers);
      setSelectedIds(new Set());
      setLoading(false);
    }, (subscriptionError) => {
      setError(subscriptionError.message);
      setLoading(false);
    });
  }, [includeRetired]);

  const departments = useMemo(() =>
    Array.from(new Set(users.map((u) => u.department).filter(Boolean))),
    [users],
  );

  const filtered = useMemo(() => {
    return users.filter((u) => {
      const q = deferredSearch.toLowerCase();
      const matchSearch = !q ||
        u.fullName?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.employeeId?.toLowerCase().includes(q) ||
        u.employeeCode?.toLowerCase().includes(q) ||
        u.username?.toLowerCase().includes(q);
      const matchRole = roleFilter === 'all' || u.role === roleFilter;
      const matchDept = deptFilter === 'all' || u.department === deptFilter;
      const matchStatus = statusFilter === 'all' || u.userStatus === statusFilter;
      return matchSearch && matchRole && matchDept && matchStatus;
    });
  }, [users, deferredSearch, roleFilter, deptFilter, statusFilter]);

  const sorted = useMemo(() => [...filtered].sort((a, b) => {
    if (sortBy === 'employeeId') return a.employeeId.localeCompare(b.employeeId);
    if (sortBy === 'department') return a.department.localeCompare(b.department);
    if (sortBy === 'lastLogin') return String(b.lastLogin || '').localeCompare(String(a.lastLogin || ''));
    return a.fullName.localeCompare(b.fullName);
  }), [filtered, sortBy]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const paginated = sorted.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

  const stats = {
    total: users.length,
    active: users.filter((u) => u.userStatus === 'Active').length,
    inactive: users.filter((u) => u.userStatus === 'Inactive').length,
    locked: users.filter((u) => u.userStatus === 'Locked' || u.accountLocked).length,
  };

  const handleExport = () => {
    const csv = exportUsersCsv(filtered);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `users-export-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('User list exported');
  };

  const runConfirm = async () => {
    if (!confirm) return;
    setActionLoading(true);
    const target = confirm.user;
    let result: { success: boolean; error?: string } = { success: false };

    try {
      switch (confirm.type) {
        case 'deactivate':
          result = await setUserStatus(target, 'Inactive', auditMeta, role, user?.uid || '', actionReason);
          break;
        case 'activate':
          result = await setUserStatus(target, 'Active', auditMeta, role, user?.uid || '', actionReason);
          break;
        case 'lock':
          result = await lockUser(target, true, auditMeta, role, user?.uid || '', actionReason);
          break;
        case 'unlock':
          result = await lockUser(target, false, auditMeta, role, user?.uid || '', actionReason);
          break;
        case 'reset':
          result = await resetUserPassword(target, auditMeta, role, user?.uid || '', actionReason);
          break;
        case 'restore':
          result = await restoreUser(target, auditMeta, role, user?.uid || '', actionReason);
          break;
      }
      if (result.success) {
        toast.success('Action completed');
        load();
      } else {
        toast.error(result.error || 'Action failed');
      }
    } finally {
      setActionLoading(false);
      setConfirm(null);
      setActionReason('');
    }
  };

  const runBulkAction = async () => {
    if (!bulkAction || selectedIds.size === 0) return;
    setActionLoading(true);
    let succeeded = 0;
    const failures: string[] = [];

    for (const target of users.filter((item) => item.id && selectedIds.has(item.id))) {
      let result: { success: boolean; error?: string };
      if (bulkAction === 'activate') {
        result = await setUserStatus(target, 'Active', auditMeta, role, user?.uid || '', bulkReason);
      } else if (bulkAction === 'deactivate') {
        result = await setUserStatus(target, 'Inactive', auditMeta, role, user?.uid || '', bulkReason);
      } else if (bulkAction === 'lock') {
        result = await lockUser(target, true, auditMeta, role, user?.uid || '', bulkReason);
      } else if (bulkAction === 'unlock') {
        result = await lockUser(target, false, auditMeta, role, user?.uid || '', bulkReason);
      } else if (bulkAction === 'restore') {
        result = await restoreUser(target, auditMeta, role, user?.uid || '', bulkReason);
      } else {
        result = await softDeleteUser(target, auditMeta, role, user?.uid || '', bulkReason);
      }
      if (result.success) succeeded += 1;
      else failures.push(`${target.fullName}: ${result.error || 'failed'}`);
    }

    setActionLoading(false);
    setBulkAction('');
    setBulkReason('');
    if (succeeded) toast.success(`${succeeded} user${succeeded === 1 ? '' : 's'} updated`);
    if (failures.length) toast.error(failures.slice(0, 3).join('; '));
    await load();
  };

  const runDelete = async () => {
    if (!deleteConfirm?.id) return;
    if (deleteConfirm.id === user?.uid || deleteConfirm.userId === user?.uid) {
      toast.error('You cannot delete your own account');
      setDeleteConfirm(null);
      return;
    }
    try {
      const result = await softDeleteUser(
        deleteConfirm,
        auditMeta,
        role,
        user?.uid || '',
        actionReason,
      );
      if (result.success) {
        toast.success('User deactivated and removed from active use');
        load();
      } else {
        toast.error(result.error || 'Delete failed');
      }
    } catch {
      toast.error('Delete failed');
    } finally {
      setDeleteConfirm(null);
      setActionReason('');
    }
  };

  if (loading) {
    return (
      <div>
        <PageHeader title="User Management" description="Manage system users" basePath="/admin" />
        <LoadingSkeleton rows={2} />
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <PageHeader title="User Management" basePath="/admin" />
        <ErrorCard message={error} onRetry={load} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="User Management"
        description="Create, manage, and control user access across Pharma QMS + PQR + CPV"
        basePath="/admin"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-4 w-4 mr-1" />Export
            </Button>
            {canEdit && (
              <Button asChild size="sm" className="bg-blue-600 hover:bg-blue-700">
                <Link href="/admin/users/create"><Plus className="h-4 w-4 mr-1" />Create User</Link>
              </Button>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Total Users" value={stats.total} accent="border-l-blue-600" />
        <KpiCard label="Active" value={stats.active} accent="border-l-green-600" />
        <KpiCard label="Inactive" value={stats.inactive} accent="border-l-slate-400" />
        <KpiCard label="Locked" value={stats.locked} accent="border-l-red-500" />
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col lg:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search name, email, employee ID..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                className="pl-9"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Select value={roleFilter} onValueChange={(v) => { setRoleFilter(v); setPage(0); }}>
                <SelectTrigger className="w-[140px] h-9"><SelectValue placeholder="Role" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  {ADMIN_ROLES.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={deptFilter} onValueChange={(v) => { setDeptFilter(v); setPage(0); }}>
                <SelectTrigger className="w-[140px] h-9"><SelectValue placeholder="Department" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Depts</SelectItem>
                  {departments.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
                <SelectTrigger className="w-[130px] h-9"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  {USER_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={sortBy} onValueChange={(value) => setSortBy(value as typeof sortBy)}>
                <SelectTrigger className="w-[150px] h-9" aria-label="Sort users">
                  <ArrowUpDown className="h-4 w-4 mr-1" /><SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Sort: Name</SelectItem>
                  <SelectItem value="employeeId">Sort: Employee ID</SelectItem>
                  <SelectItem value="department">Sort: Department</SelectItem>
                  <SelectItem value="lastLogin">Sort: Last Login</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={() => { setSearch(''); setRoleFilter('all'); setDeptFilter('all'); setStatusFilter('all'); }}>
                <Filter className="h-4 w-4" /><span className="sr-only">Clear filters</span>
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t pt-3 sm:flex-row sm:items-center sm:justify-between">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={includeRetired}
                onCheckedChange={(checked) => {
                  setIncludeRetired(checked === true);
                  setPage(0);
                }}
              />
              Include retired users
            </label>
            {canEdit && selectedIds.size > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-muted-foreground">{selectedIds.size} selected</span>
                <Select value={bulkAction} onValueChange={setBulkAction}>
                  <SelectTrigger className="w-[170px] h-9"><SelectValue placeholder="Bulk action" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="activate">Activate</SelectItem>
                    <SelectItem value="deactivate">Deactivate</SelectItem>
                    <SelectItem value="lock">Lock</SelectItem>
                    <SelectItem value="unlock">Unlock</SelectItem>
                    {includeRetired && <SelectItem value="restore">Restore as inactive</SelectItem>}
                    {canRetire && <SelectItem value="retire">Retire</SelectItem>}
                  </SelectContent>
                </Select>
                <Textarea
                  value={bulkReason}
                  onChange={(event) => setBulkReason(event.target.value)}
                  placeholder="Reason for bulk change"
                  aria-label="Reason for bulk user change"
                  className="min-h-9 w-full sm:w-64"
                />
                <Button size="sm" onClick={runBulkAction} disabled={!bulkAction || bulkReason.trim().length < 8 || actionLoading}>
                  {actionLoading ? 'Applying…' : 'Apply'}
                </Button>
              </div>
            )}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  {canEdit && (
                    <TableHead className="w-10">
                      <Checkbox
                        aria-label="Select users on this page"
                        checked={paginated.length > 0 && paginated.every((item) => item.id && selectedIds.has(item.id))}
                        onCheckedChange={(checked) => {
                          setSelectedIds((current) => {
                            const next = new Set(current);
                            paginated.forEach((item) => {
                              if (!item.id) return;
                              if (checked === true) next.add(item.id);
                              else next.delete(item.id);
                            });
                            return next;
                          });
                        }}
                      />
                    </TableHead>
                  )}
                  <TableHead>Employee ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Login</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={canEdit ? 9 : 8}>
                      <EmptyState title="No users found" message="Adjust filters or create a new user." />
                    </TableCell>
                  </TableRow>
                ) : (
                  paginated.map((row) => (
                    <TableRow key={row.id} className="hover:bg-blue-50/30">
                      {canEdit && (
                        <TableCell>
                          <Checkbox
                            aria-label={`Select ${row.fullName}`}
                            checked={Boolean(row.id && selectedIds.has(row.id))}
                            onCheckedChange={(checked) => {
                              if (!row.id) return;
                              setSelectedIds((current) => {
                                const next = new Set(current);
                                if (checked === true) next.add(row.id!);
                                else next.delete(row.id!);
                                return next;
                              });
                            }}
                          />
                        </TableCell>
                      )}
                      <TableCell className="font-mono text-xs">{row.employeeId}</TableCell>
                      <TableCell className="font-medium">{row.fullName}</TableCell>
                      <TableCell className="text-sm">{row.email}</TableCell>
                      <TableCell>{row.department}</TableCell>
                      <TableCell><RoleBadge role={row.role} /></TableCell>
                      <TableCell><StatusBadge status={row.userStatus} /></TableCell>
                      <TableCell className="text-xs">{row.lastLogin ? new Date(row.lastLogin).toLocaleDateString() : '-'}</TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button asChild variant="ghost" size="icon"><Link href={`/admin/users/${row.id}`} aria-label={`View ${row.fullName}`}><Eye className="h-4 w-4" /></Link></Button>
                          {canEdit && !row.isDeleted && (
                            <>
                              <Button asChild variant="ghost" size="icon"><Link href={`/admin/users/${row.id}/edit`} aria-label={`Edit ${row.fullName}`}><Pencil className="h-4 w-4" /></Link></Button>
                              {row.userStatus === 'Active'
                                ? <Button variant="ghost" size="icon" aria-label={`Deactivate ${row.fullName}`} onClick={() => setConfirm({ type: 'deactivate', user: row })}><UserX className="h-4 w-4 text-amber-600" /></Button>
                                : <Button variant="ghost" size="icon" aria-label={`Activate ${row.fullName}`} onClick={() => setConfirm({ type: 'activate', user: row })}><UserCheck className="h-4 w-4 text-green-600" /></Button>}
                              {row.accountLocked || row.userStatus === 'Locked'
                                ? <Button variant="ghost" size="icon" aria-label={`Unlock ${row.fullName}`} onClick={() => setConfirm({ type: 'unlock', user: row })}><Unlock className="h-4 w-4" /></Button>
                                : <Button variant="ghost" size="icon" aria-label={`Lock ${row.fullName}`} onClick={() => setConfirm({ type: 'lock', user: row })}><Lock className="h-4 w-4" /></Button>}
                              <Button variant="ghost" size="icon" aria-label={`Reset password for ${row.fullName}`} onClick={() => setConfirm({ type: 'reset', user: row })}><Key className="h-4 w-4" /></Button>
                              {canRetire && (
                                <Button variant="ghost" size="icon" aria-label={`Retire ${row.fullName}`} onClick={() => setDeleteConfirm(row)}>
                                  <Trash2 className="h-4 w-4 text-red-600" />
                                </Button>
                              )}
                            </>
                          )}
                          {canEdit && row.isDeleted && (
                            <Button variant="ghost" size="icon" aria-label={`Restore ${row.fullName}`} onClick={() => setConfirm({ type: 'restore', user: row })}>
                              <RotateCcw className="h-4 w-4 text-green-600" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {paginated.length === 0 ? (
              <EmptyState title="No users found" />
            ) : (
              paginated.map((row) => (
                <Card key={row.id} className="border shadow-sm">
                  <CardContent className="p-4 space-y-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold">{row.fullName}</p>
                        <p className="text-xs text-muted-foreground">{row.email}</p>
                      </div>
                      <StatusBadge status={row.userStatus} />
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <RoleBadge role={row.role} />
                      <span className="text-muted-foreground">{row.department}</span>
                    </div>
                    <div className="flex gap-2 pt-2">
                      <Button asChild size="sm" variant="outline"><Link href={`/admin/users/${row.id}`}>View</Link></Button>
                      {canEdit && !row.isDeleted && (
                        <Button asChild size="sm" variant="outline"><Link href={`/admin/users/${row.id}/edit`}>Edit</Link></Button>
                      )}
                      {canRetire && !row.isDeleted && <Button size="sm" variant="destructive" onClick={() => setDeleteConfirm(row)}>Retire</Button>}
                      {canEdit && row.isDeleted && (
                        <Button size="sm" variant="outline" onClick={() => setConfirm({ type: 'restore', user: row })}>
                          Restore
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{filtered.length} of {users.length} users</span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={currentPage === 0} onClick={() => setPage((p) => p - 1)}>Prev</Button>
              <span>Page {currentPage + 1} / {totalPages}</span>
              <Button variant="outline" size="sm" disabled={currentPage >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={!!confirm} onOpenChange={(open) => {
        if (!open) {
          setConfirm(null);
          setActionReason('');
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Action</AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.type === 'deactivate' && `Deactivate ${confirm.user.fullName}?`}
              {confirm?.type === 'activate' && `Activate ${confirm.user.fullName}?`}
              {confirm?.type === 'lock' && `Lock account for ${confirm.user.fullName}?`}
              {confirm?.type === 'unlock' && `Unlock account for ${confirm.user.fullName}?`}
              {confirm?.type === 'reset' && `Send password reset to ${confirm.user.email}?`}
              {confirm?.type === 'restore' && `Restore ${confirm.user.fullName} to the inactive user directory?`}
            </AlertDialogDescription>
            <div className="space-y-1 pt-2">
              <label htmlFor="user-action-reason" className="text-sm font-medium">Reason *</label>
              <Textarea
                id="user-action-reason"
                value={actionReason}
                onChange={(event) => setActionReason(event.target.value)}
                placeholder="Enter the attributable reason for this action"
              />
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={runConfirm} disabled={actionLoading || actionReason.trim().length < 8} className="bg-blue-600">
              {actionLoading ? 'Processing…' : 'Confirm'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => {
        if (!open) {
          setDeleteConfirm(null);
          setActionReason('');
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Retire User</AlertDialogTitle>
            <AlertDialogDescription>
              {`Retire "${deleteConfirm?.fullName}" (${deleteConfirm?.email})? Authentication will be disabled while the governed user and audit records are retained.`}
            </AlertDialogDescription>
            <div className="space-y-1 pt-2">
              <label htmlFor="retire-user-reason" className="text-sm font-medium">Reason *</label>
              <Textarea
                id="retire-user-reason"
                value={actionReason}
                onChange={(event) => setActionReason(event.target.value)}
                placeholder="Enter the reason for retiring this user"
              />
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={runDelete}
              disabled={actionReason.trim().length < 8}
              className="bg-red-600 hover:bg-red-700"
            >
              Retire User
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
