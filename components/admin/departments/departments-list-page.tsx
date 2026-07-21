'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Plus, Search, Download, Eye, Pencil, UserCheck, UserX, Trash2, RotateCcw, Network,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/admin/dashboard/page-header';
import { StatusBadge } from '@/components/admin/dashboard/status-badge';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { EmptyState } from '@/components/admin/dashboard/empty-state';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { DepartmentTypeBadge } from './department-type-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/auth-context';
import { useAdminPermissions } from '@/hooks/use-admin-permissions';
import { canEditDepartments } from '@/lib/permissions';
import { DEPARTMENT_TYPES, RECORD_STATUSES } from '@/lib/admin/constants';
import type { Department } from '@/lib/admin/schemas';
import {
  subscribeToDepartments, setDepartmentStatus, deleteDepartment, restoreDepartment,
  exportDepartmentsCsv, logDepartmentExport, bulkUpdateDepartments,
  buildDepartmentHierarchy, canDeleteDepartmentRecord, isSystemDepartment,
} from '@/lib/admin/department-service';

const PAGE_SIZE = 10;

export function DepartmentsListPage() {
  const { user, profile } = useAuth();
  const { role, canDelete } = useAdminPermissions();
  const canEdit = canEditDepartments(role);

  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [siteFilter, setSiteFilter] = useState('all');
  const [showDeleted, setShowDeleted] = useState(false);
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [actionBusy, setActionBusy] = useState(false);
  const [changeReason, setChangeReason] = useState('');

  const [confirm, setConfirm] = useState<{ dept: Department; activate: boolean } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Department | null>(null);
  const [restoreConfirm, setRestoreConfirm] = useState<Department | null>(null);
  const [bulkAction, setBulkAction] = useState<'activate' | 'deactivate' | null>(null);

  const auditMeta = {
    userId: user?.uid || 'system',
    userName: profile?.full_name || profile?.email || 'Admin',
    role,
  };

  useEffect(() => {
    setLoading(true);
    const unsubscribe = subscribeToDepartments(
      showDeleted,
      (next) => {
        setDepartments(next);
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

  const sites = useMemo(() => {
    const set = new Set<string>();
    departments.forEach((d) => { if (d.siteLocation) set.add(d.siteLocation); });
    return Array.from(set).sort();
  }, [departments]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return departments.filter((d) => {
      const matchSearch = !q
        || d.departmentName?.toLowerCase().includes(q)
        || d.departmentCode?.toLowerCase().includes(q)
        || d.departmentId?.toLowerCase().includes(q)
        || d.departmentHead?.toLowerCase().includes(q)
        || d.costCenter?.toLowerCase().includes(q);
      const matchStatus = statusFilter === 'all' || d.status === statusFilter;
      const matchType = typeFilter === 'all' || d.departmentType === typeFilter;
      const matchSite = siteFilter === 'all' || d.siteLocation === siteFilter;
      return matchSearch && matchStatus && matchType && matchSite;
    });
  }, [departments, search, statusFilter, typeFilter, siteFilter]);

  const hierarchy = useMemo(
    () => buildDepartmentHierarchy(filtered.filter((d) => !d.isDeleted)),
    [filtered],
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const paginated = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

  const requireReason = () => {
    if (changeReason.trim().length < 5) {
      toast.error('Change reason is required (min 5 characters)');
      return false;
    }
    return true;
  };

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
    if (!confirm || !requireReason()) return;
    setActionBusy(true);
    const status = confirm.activate ? 'Active' : 'Inactive';
    const result = await setDepartmentStatus(confirm.dept.id!, confirm.dept, status, auditMeta, changeReason);
    setActionBusy(false);
    if (result.success) {
      if (!confirm.activate && result.linkedUsers) {
        toast.warning(`${result.linkedUsers} linked user(s) remain assigned — new assignments blocked`);
      } else {
        toast.success(`Department ${status.toLowerCase()}`);
      }
      setChangeReason('');
    } else {
      toast.error(result.error || 'Action failed');
    }
    setConfirm(null);
  };

  const runDelete = async () => {
    if (!deleteConfirm?.id || !requireReason()) return;
    setActionBusy(true);
    const result = await deleteDepartment(deleteConfirm.id, deleteConfirm, auditMeta, changeReason);
    setActionBusy(false);
    if (result.success) {
      toast.success('Department soft-deleted');
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
    const result = await restoreDepartment(restoreConfirm.id, changeReason);
    setActionBusy(false);
    if (result.success) {
      toast.success('Department restored');
      setChangeReason('');
    } else {
      toast.error(result.error || 'Restore failed');
    }
    setRestoreConfirm(null);
  };

  const runBulk = async () => {
    if (!bulkAction || selected.length === 0 || !requireReason()) return;
    setActionBusy(true);
    const result = await bulkUpdateDepartments(selected, bulkAction, changeReason);
    setActionBusy(false);
    if (result.error) toast.error(result.error);
    else {
      toast.success(`Updated ${result.successCount} department(s)`);
      setSelected([]);
      setChangeReason('');
    }
    setBulkAction(null);
  };

  if (loading) {
    return (
      <div>
        <PageHeader title="Department Master" basePath="/admin" />
        <LoadingSkeleton rows={2} />
      </div>
    );
  }

  if (error) return <ErrorCard message={error} onRetry={() => setShowDeleted((v) => v)} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Department Master"
        description="Organizational departments, hierarchy, and HOD assignment for Pharma QMS"
        basePath="/admin"
        actions={
          <div className="flex flex-wrap gap-2">
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
                placeholder="Search name, code, head, cost center…"
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

          <Tabs defaultValue="list">
            <TabsList>
              <TabsTrigger value="list">List</TabsTrigger>
              <TabsTrigger value="hierarchy"><Network className="h-3.5 w-3.5 mr-1" />Hierarchy</TabsTrigger>
            </TabsList>

            <TabsContent value="list" className="space-y-4">
              <div className="hidden md:block overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      {canEdit && (
                        <TableHead className="w-10">
                          <Checkbox
                            checked={paginated.length > 0 && paginated.every((r) => selected.includes(r.id!))}
                            onCheckedChange={(v) => {
                              const ids = paginated.map((r) => r.id!).filter(Boolean);
                              setSelected((prev) => (v
                                ? Array.from(new Set([...prev, ...ids]))
                                : prev.filter((id) => !ids.includes(id))));
                            }}
                            aria-label="Select all on page"
                          />
                        </TableHead>
                      )}
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
                      <TableRow><TableCell colSpan={canEdit ? 8 : 7}><EmptyState title="No departments found" /></TableCell></TableRow>
                    ) : (
                      paginated.map((row) => (
                        <TableRow key={row.id} className={row.isDeleted ? 'opacity-60' : undefined}>
                          {canEdit && (
                            <TableCell>
                              <Checkbox
                                checked={selected.includes(row.id!)}
                                onCheckedChange={() => setSelected((prev) => (
                                  prev.includes(row.id!) ? prev.filter((id) => id !== row.id) : [...prev, row.id!]
                                ))}
                                aria-label={`Select ${row.departmentName}`}
                              />
                            </TableCell>
                          )}
                          <TableCell className="font-mono text-xs">
                            {row.departmentCode}
                            {isSystemDepartment(row) && (
                              <span className="ml-1 text-[10px] uppercase text-muted-foreground">SYS</span>
                            )}
                          </TableCell>
                          <TableCell className="font-medium">{row.departmentName}</TableCell>
                          <TableCell><DepartmentTypeBadge type={row.departmentType} /></TableCell>
                          <TableCell>{row.departmentHead || '-'}</TableCell>
                          <TableCell>{row.siteLocation || '-'}</TableCell>
                          <TableCell>
                            <StatusBadge status={row.isDeleted ? 'Inactive' : row.status} />
                          </TableCell>
                          <TableCell>
                            <div className="flex justify-end gap-1">
                              <Button asChild variant="ghost" size="icon" aria-label="View department">
                                <Link href={`/admin/departments/${row.id}`}><Eye className="h-4 w-4" /></Link>
                              </Button>
                              {canEdit && !row.isDeleted && (
                                <>
                                  <Button asChild variant="ghost" size="icon" aria-label="Edit department">
                                    <Link href={`/admin/departments/${row.id}/edit`}><Pencil className="h-4 w-4" /></Link>
                                  </Button>
                                  {row.status === 'Active'
                                    ? (
                                      <Button variant="ghost" size="icon" aria-label="Deactivate" onClick={() => setConfirm({ dept: row, activate: false })}>
                                        <UserX className="h-4 w-4 text-amber-600" />
                                      </Button>
                                    )
                                    : (
                                      <Button variant="ghost" size="icon" aria-label="Activate" onClick={() => setConfirm({ dept: row, activate: true })}>
                                        <UserCheck className="h-4 w-4 text-green-600" />
                                      </Button>
                                    )}
                                  {canDelete && canDeleteDepartmentRecord(row).allowed && (
                                    <Button variant="ghost" size="icon" aria-label="Delete" onClick={() => setDeleteConfirm(row)}>
                                      <Trash2 className="h-4 w-4 text-red-600" />
                                    </Button>
                                  )}
                                </>
                              )}
                              {canEdit && row.isDeleted && (
                                <Button variant="ghost" size="icon" aria-label="Restore" onClick={() => setRestoreConfirm(row)}>
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
                        {canEdit && !row.isDeleted && (
                          <Button asChild size="sm" variant="outline"><Link href={`/admin/departments/${row.id}/edit`}>Edit</Link></Button>
                        )}
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
            </TabsContent>

            <TabsContent value="hierarchy">
              <Card>
                <CardHeader><CardTitle className="text-base">Department Hierarchy</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {hierarchy.length === 0 ? (
                    <EmptyState title="No hierarchy data" message="Create departments with parent relationships to visualize the tree." />
                  ) : (
                    hierarchy.map((node) => (
                      <div
                        key={node.id}
                        className="flex items-center justify-between rounded-lg border p-3"
                        style={{ marginLeft: `${node.depth * 20}px` }}
                      >
                        <div>
                          <p className="font-medium text-sm">
                            {node.depth > 0 ? '↳ ' : ''}{node.departmentName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {node.departmentCode}
                            {node.parentDepartmentName ? ` · Parent: ${node.parentDepartmentName}` : ' · Top-level'}
                            {node.departmentHead ? ` · Head: ${node.departmentHead}` : ''}
                          </p>
                        </div>
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/admin/departments/${node.id}`}>Open</Link>
                        </Button>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <AlertDialog open={!!confirm} onOpenChange={() => setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm?.activate ? 'Activate Department' : 'Deactivate Department'}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.activate
                ? `Activate department "${confirm?.dept.departmentName}"?`
                : `Deactivate "${confirm?.dept.departmentName}"? Linked users remain assigned but new assignments are blocked.`}
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
            <AlertDialogTitle>Soft Delete Department</AlertDialogTitle>
            <AlertDialogDescription>
              Retire &quot;{deleteConfirm?.departmentName}&quot;? Record is retained for audit and can be restored.
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
            <AlertDialogTitle>Restore Department</AlertDialogTitle>
            <AlertDialogDescription>
              Restore &quot;{restoreConfirm?.departmentName}&quot; to Active?
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
            <AlertDialogDescription>Apply to {selected.length} selected department(s).</AlertDialogDescription>
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
    </div>
  );
}
