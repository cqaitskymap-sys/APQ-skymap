'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Plus, Search, Download, Eye, Pencil, UserCheck, UserX, Trash2, Copy, RotateCcw,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/admin/dashboard/page-header';
import { StatusBadge } from '@/components/admin/dashboard/status-badge';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { EmptyState } from '@/components/admin/dashboard/empty-state';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
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
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { useAuth } from '@/contexts/auth-context';
import { useAdminPermissions } from '@/hooks/use-admin-permissions';
import { canEditRoles } from '@/lib/permissions';
import { RECORD_STATUSES } from '@/lib/admin/constants';
import type { AdminRole } from '@/lib/admin/schemas';
import {
  subscribeToRoles, setRoleStatus, exportRolesCsv, softDeleteRole, restoreRole,
  cloneRole, bulkUpdateRoleStatus, canDeleteRole, isSystemRoleId,
} from '@/lib/admin/role-service';

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
  const [typeFilter, setTypeFilter] = useState('all');
  const [showDeleted, setShowDeleted] = useState(false);
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [actionBusy, setActionBusy] = useState(false);

  const [confirm, setConfirm] = useState<{ role: AdminRole; activate: boolean } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<AdminRole | null>(null);
  const [restoreConfirm, setRestoreConfirm] = useState<AdminRole | null>(null);
  const [cloneTarget, setCloneTarget] = useState<AdminRole | null>(null);
  const [cloneRoleId, setCloneRoleId] = useState('');
  const [cloneRoleName, setCloneRoleName] = useState('');
  const [changeReason, setChangeReason] = useState('');
  const [bulkAction, setBulkAction] = useState<'activate' | 'deactivate' | null>(null);

  useEffect(() => {
    setLoading(true);
    const unsubscribe = subscribeToRoles(
      showDeleted,
      (next) => {
        setRoles(next);
        setError(null);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );
    return unsubscribe;
  }, [showDeleted]);

  const filtered = useMemo(() => {
    return roles.filter((r) => {
      const q = search.toLowerCase();
      const matchSearch = !q
        || r.roleName?.toLowerCase().includes(q)
        || r.roleId?.toLowerCase().includes(q)
        || r.departmentAccess?.toLowerCase().includes(q);
      const matchStatus = statusFilter === 'all' || r.status === statusFilter;
      const isSystem = Boolean(r.isSystemRole || isSystemRoleId(r.roleId));
      const matchType = typeFilter === 'all'
        || (typeFilter === 'system' && isSystem)
        || (typeFilter === 'custom' && !isSystem);
      const matchDeleted = showDeleted ? true : !r.isDeleted;
      return matchSearch && matchStatus && matchType && matchDeleted;
    });
  }, [roles, search, statusFilter, typeFilter, showDeleted]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const paginated = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

  const toggleSelected = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleAllPage = (checked: boolean) => {
    const ids = paginated.map((r) => r.id!).filter(Boolean);
    setSelected((prev) => {
      if (!checked) return prev.filter((id) => !ids.includes(id));
      return Array.from(new Set([...prev, ...ids]));
    });
  };

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

  const requireReason = useCallback(() => {
    if (changeReason.trim().length < 5) {
      toast.error('Change reason is required (min 5 characters)');
      return false;
    }
    return true;
  }, [changeReason]);

  const runConfirm = async () => {
    if (!confirm || !requireReason()) return;
    setActionBusy(true);
    const status = confirm.activate ? 'Active' : 'Inactive';
    const result = await setRoleStatus(
      confirm.role.id!,
      confirm.role,
      status,
      { userId: user?.uid || 'system', userName: profile?.full_name || profile?.email || 'Admin', role },
      role,
      changeReason,
    );
    setActionBusy(false);
    if (result.success) {
      toast.success(`Role ${status.toLowerCase()}`);
      setChangeReason('');
    } else {
      toast.error(result.error || 'Action failed');
    }
    setConfirm(null);
  };

  const runDelete = async () => {
    if (!deleteConfirm?.id || !requireReason()) return;
    const check = canDeleteRole(role, deleteConfirm);
    if (!check.allowed) {
      toast.error(check.reason);
      setDeleteConfirm(null);
      return;
    }
    setActionBusy(true);
    const result = await softDeleteRole(deleteConfirm.id, deleteConfirm, role, changeReason);
    setActionBusy(false);
    if (result.success) {
      toast.success('Role soft-deleted');
      setChangeReason('');
      setSelected((prev) => prev.filter((id) => id !== deleteConfirm.id));
    } else {
      toast.error(result.error || 'Delete failed');
    }
    setDeleteConfirm(null);
  };

  const runRestore = async () => {
    if (!restoreConfirm?.id || !requireReason()) return;
    setActionBusy(true);
    const result = await restoreRole(restoreConfirm.id, role, changeReason);
    setActionBusy(false);
    if (result.success) {
      toast.success('Role restored');
      setChangeReason('');
    } else {
      toast.error(result.error || 'Restore failed');
    }
    setRestoreConfirm(null);
  };

  const runClone = async () => {
    if (!cloneTarget?.id || !requireReason()) return;
    if (!cloneRoleId.trim() || !cloneRoleName.trim()) {
      toast.error('Clone role ID and name are required');
      return;
    }
    setActionBusy(true);
    const result = await cloneRole(cloneTarget.id, cloneRoleId.trim(), cloneRoleName.trim(), role, changeReason);
    setActionBusy(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success('Role cloned');
    setCloneTarget(null);
    setCloneRoleId('');
    setCloneRoleName('');
    setChangeReason('');
  };

  const runBulk = async () => {
    if (!bulkAction || selected.length === 0 || !requireReason()) return;
    setActionBusy(true);
    const result = await bulkUpdateRoleStatus(
      selected,
      bulkAction === 'activate' ? 'Active' : 'Inactive',
      role,
      changeReason,
    );
    setActionBusy(false);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(`Updated ${result.successCount} role(s)`);
      setSelected([]);
      setChangeReason('');
    }
    setBulkAction(null);
  };

  if (loading) {
    return (
      <div>
        <PageHeader title="Role & Permission" basePath="/admin" />
        <LoadingSkeleton rows={2} />
      </div>
    );
  }

  if (error) {
    return (
      <ErrorCard
        message={error}
        onRetry={() => {
          setLoading(true);
          setError(null);
          setShowDeleted((value) => value);
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Role & Permission Management"
        description="Enterprise RBAC for Pharma QMS + PQR + CPV with matrix, field, and row-level controls"
        basePath="/admin"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={handleExport} aria-label="Export roles">
              <Download className="h-4 w-4 mr-1" />Export
            </Button>
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
          <div className="flex flex-col lg:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search roles, IDs, departments…"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
              <SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {RECORD_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(0); }}>
              <SelectTrigger className="w-[140px]"><SelectValue placeholder="Type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="system">System Roles</SelectItem>
                <SelectItem value="custom">Custom Roles</SelectItem>
              </SelectContent>
            </Select>
            {canDelete && (
              <label className="flex items-center gap-2 text-sm whitespace-nowrap">
                <Checkbox checked={showDeleted} onCheckedChange={(v) => { setShowDeleted(Boolean(v)); setPage(0); }} />
                Show deleted
              </label>
            )}
          </div>

          {canEdit && selected.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/40 p-3">
              <span className="text-sm font-medium">{selected.length} selected</span>
              <Button size="sm" variant="outline" onClick={() => setBulkAction('activate')}>Activate</Button>
              <Button size="sm" variant="outline" onClick={() => setBulkAction('deactivate')}>Deactivate</Button>
              <Button size="sm" variant="ghost" onClick={() => setSelected([])}>Clear</Button>
            </div>
          )}

          <div className="hidden md:block overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  {canEdit && (
                    <TableHead className="w-10">
                      <Checkbox
                        checked={paginated.length > 0 && paginated.every((r) => selected.includes(r.id!))}
                        onCheckedChange={(v) => toggleAllPage(Boolean(v))}
                        aria-label="Select all on page"
                      />
                    </TableHead>
                  )}
                  <TableHead>Role ID</TableHead>
                  <TableHead>Role Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Level</TableHead>
                  <TableHead>Scope</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.length === 0 ? (
                  <TableRow><TableCell colSpan={canEdit ? 8 : 7}><EmptyState title="No roles found" /></TableCell></TableRow>
                ) : (
                  paginated.map((row) => {
                    const isSystem = Boolean(row.isSystemRole || isSystemRoleId(row.roleId));
                    return (
                      <TableRow key={row.id} className={row.isDeleted ? 'opacity-60' : undefined}>
                        {canEdit && (
                          <TableCell>
                            <Checkbox
                              checked={selected.includes(row.id!)}
                              onCheckedChange={() => toggleSelected(row.id!)}
                              aria-label={`Select ${row.roleName}`}
                            />
                          </TableCell>
                        )}
                        <TableCell className="font-mono text-xs">{row.roleId}</TableCell>
                        <TableCell className="font-medium">{row.roleName}</TableCell>
                        <TableCell>{isSystem ? 'System' : 'Custom'}</TableCell>
                        <TableCell>{row.roleLevel ?? row.level}</TableCell>
                        <TableCell className="text-xs">{row.dataScope || row.departmentAccess || 'Organization'}</TableCell>
                        <TableCell>
                          <StatusBadge status={row.isDeleted ? 'Inactive' : row.status} />
                          {row.isDeleted && <span className="ml-2 text-[10px] uppercase text-muted-foreground">Deleted</span>}
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Button asChild variant="ghost" size="icon" aria-label="View role">
                              <Link href={`/admin/roles/${row.id}`}><Eye className="h-4 w-4" /></Link>
                            </Button>
                            {canEdit && !row.isDeleted && (
                              <>
                                <Button asChild variant="ghost" size="icon" aria-label="Edit role">
                                  <Link href={`/admin/roles/${row.id}/edit`}><Pencil className="h-4 w-4" /></Link>
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  aria-label="Clone role"
                                  onClick={() => {
                                    setCloneTarget(row);
                                    setCloneRoleId(`${row.roleId}_copy`);
                                    setCloneRoleName(`${row.roleName} Copy`);
                                  }}
                                >
                                  <Copy className="h-4 w-4" />
                                </Button>
                                {row.roleId !== 'super_admin' && (
                                  row.status === 'Active'
                                    ? (
                                      <Button variant="ghost" size="icon" aria-label="Deactivate role" onClick={() => setConfirm({ role: row, activate: false })}>
                                        <UserX className="h-4 w-4 text-amber-600" />
                                      </Button>
                                    )
                                    : (
                                      <Button variant="ghost" size="icon" aria-label="Activate role" onClick={() => setConfirm({ role: row, activate: true })}>
                                        <UserCheck className="h-4 w-4 text-green-600" />
                                      </Button>
                                    )
                                )}
                                {canDelete && canDeleteRole(role, row).allowed && (
                                  <Button variant="ghost" size="icon" aria-label="Delete role" onClick={() => setDeleteConfirm(row)}>
                                    <Trash2 className="h-4 w-4 text-red-600" />
                                  </Button>
                                )}
                              </>
                            )}
                            {canEdit && row.isDeleted && (
                              <Button variant="ghost" size="icon" aria-label="Restore role" onClick={() => setRestoreConfirm(row)}>
                                <RotateCcw className="h-4 w-4 text-green-600" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          <div className="md:hidden space-y-3">
            {paginated.map((row) => (
              <Card key={row.id} className="border">
                <CardContent className="p-4 space-y-2">
                  <div className="flex justify-between gap-2">
                    <p className="font-semibold">{row.roleName}</p>
                    <StatusBadge status={row.status} />
                  </div>
                  <p className="text-xs text-muted-foreground">{row.roleId}</p>
                  <div className="flex flex-wrap gap-2 pt-2">
                    <Button asChild size="sm" variant="outline"><Link href={`/admin/roles/${row.id}`}>View</Link></Button>
                    {canEdit && !row.isDeleted && <Button asChild size="sm" variant="outline"><Link href={`/admin/roles/${row.id}/edit`}>Edit</Link></Button>}
                    {canEdit && !row.isDeleted && (
                      <Button size="sm" variant="outline" onClick={() => {
                        setCloneTarget(row);
                        setCloneRoleId(`${row.roleId}_copy`);
                        setCloneRoleName(`${row.roleName} Copy`);
                      }}>
                        Clone
                      </Button>
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
          <div className="space-y-2 py-2">
            <Label>Change Reason *</Label>
            <Textarea value={changeReason} onChange={(e) => setChangeReason(e.target.value)} rows={2} />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={actionBusy} onClick={runConfirm} className="bg-blue-600">Confirm</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Soft Delete Role</AlertDialogTitle>
            <AlertDialogDescription>
              Retire &quot;{deleteConfirm?.roleName}&quot;? The record is retained for audit and can be restored.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 py-2">
            <Label>Change Reason *</Label>
            <Textarea value={changeReason} onChange={(e) => setChangeReason(e.target.value)} rows={2} />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={actionBusy} onClick={runDelete} className="bg-red-600 hover:bg-red-700">Soft Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!restoreConfirm} onOpenChange={() => setRestoreConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore Role</AlertDialogTitle>
            <AlertDialogDescription>
              Restore &quot;{restoreConfirm?.roleName}&quot; to Active?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 py-2">
            <Label>Change Reason *</Label>
            <Textarea value={changeReason} onChange={(e) => setChangeReason(e.target.value)} rows={2} />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={actionBusy} onClick={runRestore} className="bg-blue-600">Restore</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!bulkAction} onOpenChange={() => setBulkAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bulk {bulkAction === 'activate' ? 'Activate' : 'Deactivate'}</AlertDialogTitle>
            <AlertDialogDescription>
              Apply to {selected.length} selected role(s). Protected system roles may be skipped.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 py-2">
            <Label>Change Reason *</Label>
            <Textarea value={changeReason} onChange={(e) => setChangeReason(e.target.value)} rows={2} />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={actionBusy} onClick={runBulk} className="bg-blue-600">Confirm</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!cloneTarget} onOpenChange={() => setCloneTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clone Role</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Copy permissions from &quot;{cloneTarget?.roleName}&quot; into a new role.
            </p>
            <div className="space-y-1">
              <Label>New Role ID *</Label>
              <Input value={cloneRoleId} onChange={(e) => setCloneRoleId(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>New Role Name *</Label>
              <Input value={cloneRoleName} onChange={(e) => setCloneRoleName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Change Reason *</Label>
              <Textarea value={changeReason} onChange={(e) => setChangeReason(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCloneTarget(null)}>Cancel</Button>
            <Button disabled={actionBusy} onClick={runClone} className="bg-blue-600 hover:bg-blue-700">Clone Role</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
