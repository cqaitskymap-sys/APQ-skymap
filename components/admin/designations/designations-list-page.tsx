'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Plus, Search, Download, Eye, Pencil, UserCheck, UserX, Trash2, RotateCcw, Network, Upload,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/admin/dashboard/page-header';
import { StatusBadge } from '@/components/admin/dashboard/status-badge';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { EmptyState } from '@/components/admin/dashboard/empty-state';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { DesignationLevelBadge } from './designation-level-badge';
import { DepartmentBadge } from './department-badge';
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
import { canEditDesignations } from '@/lib/permissions';
import { DESIGNATION_LEVELS, RECORD_STATUSES } from '@/lib/admin/constants';
import type { Designation } from '@/lib/admin/schemas';
import {
  subscribeToDesignations, setDesignationStatus, deleteDesignation, restoreDesignation,
  exportDesignationsCsv, logDesignationExport, bulkUpdateDesignations,
  buildDesignationHierarchy, canDeleteDesignationRecord, isSystemDesignation,
  importDesignations, parseDesignationImportCsv,
} from '@/lib/admin/designation-service';

const PAGE_SIZE = 10;

export function DesignationsListPage() {
  const { user, profile } = useAuth();
  const { role, canDelete } = useAdminPermissions();
  const canEdit = canEditDesignations(role);
  const importInputRef = useRef<HTMLInputElement>(null);

  const [designations, setDesignations] = useState<Designation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [deptFilter, setDeptFilter] = useState('all');
  const [levelFilter, setLevelFilter] = useState('all');
  const [showDeleted, setShowDeleted] = useState(false);
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [actionBusy, setActionBusy] = useState(false);
  const [changeReason, setChangeReason] = useState('');

  const [confirm, setConfirm] = useState<{ des: Designation; activate: boolean } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Designation | null>(null);
  const [restoreConfirm, setRestoreConfirm] = useState<Designation | null>(null);
  const [bulkAction, setBulkAction] = useState<'activate' | 'deactivate' | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importRows, setImportRows] = useState<Array<Record<string, string>>>([]);

  const auditMeta = {
    userId: user?.uid || 'system',
    userName: profile?.full_name || profile?.email || 'Admin',
    role,
  };

  useEffect(() => {
    setLoading(true);
    const unsubscribe = subscribeToDesignations(
      showDeleted,
      (next) => {
        setDesignations(next);
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

  const departments = useMemo(() => {
    const set = new Set<string>();
    designations.forEach((d) => { if (d.department) set.add(d.department); });
    return Array.from(set).sort();
  }, [designations]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return designations.filter((d) => {
      const matchSearch = !q
        || d.designationName?.toLowerCase().includes(q)
        || d.designationCode?.toLowerCase().includes(q)
        || d.designationId?.toLowerCase().includes(q)
        || d.shortName?.toLowerCase().includes(q)
        || d.department?.toLowerCase().includes(q);
      const matchStatus = statusFilter === 'all' || d.status === statusFilter;
      const matchDept = deptFilter === 'all' || d.department === deptFilter;
      const matchLevel = levelFilter === 'all' || d.designationLevel === levelFilter;
      return matchSearch && matchStatus && matchDept && matchLevel;
    });
  }, [designations, search, statusFilter, deptFilter, levelFilter]);

  const hierarchy = useMemo(
    () => buildDesignationHierarchy(filtered.filter((d) => !d.isDeleted)),
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
    const csv = exportDesignationsCsv(filtered);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `designations-export-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    await logDesignationExport(auditMeta, filtered.length);
    toast.success('Designation list exported');
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const rows = parseDesignationImportCsv(String(reader.result));
      if (!rows.length) {
        toast.error('No valid rows found in CSV (code, name, and department required)');
        return;
      }
      setImportRows(rows);
      setImportOpen(true);
    };
    reader.onerror = () => toast.error('Unable to read CSV file');
    reader.readAsText(file);
    e.target.value = '';
  };

  const runImport = async () => {
    if (!importRows.length || !requireReason()) return;
    setActionBusy(true);
    const result = await importDesignations(importRows, changeReason);
    setActionBusy(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    if (result.successCount) toast.success(`Imported ${result.successCount} designation(s)`);
    if (result.errorCount) toast.warning(`${result.errorCount} row(s) failed`);
    if (result.errors.length) {
      result.errors.slice(0, 3).forEach((msg) => toast.warning(msg));
    }
    setChangeReason('');
    setImportRows([]);
    setImportOpen(false);
  };

  const runConfirm = async () => {
    if (!confirm || !requireReason()) return;
    setActionBusy(true);
    const status = confirm.activate ? 'Active' : 'Inactive';
    const result = await setDesignationStatus(confirm.des.id!, confirm.des, status, auditMeta, changeReason);
    setActionBusy(false);
    if (result.success) {
      if (!confirm.activate && result.linkedUsers) {
        toast.warning(`${result.linkedUsers} linked user(s) remain assigned — new assignments blocked`);
      } else {
        toast.success(`Designation ${status.toLowerCase()}`);
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
    const result = await deleteDesignation(deleteConfirm.id, deleteConfirm, auditMeta, changeReason);
    setActionBusy(false);
    if (result.success) {
      toast.success('Designation soft-deleted');
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
    const result = await restoreDesignation(restoreConfirm.id, changeReason);
    setActionBusy(false);
    if (result.success) {
      toast.success('Designation restored');
      setChangeReason('');
    } else {
      toast.error(result.error || 'Restore failed');
    }
    setRestoreConfirm(null);
  };

  const runBulk = async () => {
    if (!bulkAction || selected.length === 0 || !requireReason()) return;
    setActionBusy(true);
    const result = await bulkUpdateDesignations(selected, bulkAction, changeReason);
    setActionBusy(false);
    if (result.error) toast.error(result.error);
    else {
      toast.success(`Updated ${result.successCount} designation(s)`);
      setSelected([]);
      setChangeReason('');
    }
    setBulkAction(null);
  };

  if (loading) {
    return (
      <div>
        <PageHeader title="Designation Master" basePath="/admin" />
        <LoadingSkeleton rows={2} />
      </div>
    );
  }

  if (error) return <ErrorCard message={error} onRetry={() => setShowDeleted((v) => v)} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Designation Master"
        description="Employee designations, hierarchy, and approval authority for Pharma QMS"
        basePath="/admin"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-4 w-4 mr-1" />Export
            </Button>
            {canEdit && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => importInputRef.current?.click()}
                  aria-label="Import designations from CSV"
                >
                  <Upload className="h-4 w-4 mr-1" />Import CSV
                </Button>
                <input
                  ref={importInputRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={handleImportFile}
                  aria-hidden
                />
                <Button asChild size="sm" className="bg-blue-600 hover:bg-blue-700">
                  <Link href="/admin/designations/create"><Plus className="h-4 w-4 mr-1" />Create Designation</Link>
                </Button>
              </>
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
                placeholder="Search name, code, short name, department…"
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
            <Select value={deptFilter} onValueChange={(v) => { setDeptFilter(v); setPage(0); }}>
              <SelectTrigger className="w-[150px]"><SelectValue placeholder="Department" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {departments.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={levelFilter} onValueChange={(v) => { setLevelFilter(v); setPage(0); }}>
              <SelectTrigger className="w-[150px]"><SelectValue placeholder="Level" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                {DESIGNATION_LEVELS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
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
                      <TableHead>Department</TableHead>
                      <TableHead>Level</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginated.length === 0 ? (
                      <TableRow><TableCell colSpan={canEdit ? 7 : 6}><EmptyState title="No designations found" /></TableCell></TableRow>
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
                                aria-label={`Select ${row.designationName}`}
                              />
                            </TableCell>
                          )}
                          <TableCell className="font-mono text-xs">
                            {row.designationCode}
                            {isSystemDesignation(row) && (
                              <span className="ml-1 text-[10px] uppercase text-muted-foreground">SYS</span>
                            )}
                          </TableCell>
                          <TableCell className="font-medium">{row.designationName}</TableCell>
                          <TableCell><DepartmentBadge department={row.department} /></TableCell>
                          <TableCell><DesignationLevelBadge level={row.designationLevel} /></TableCell>
                          <TableCell>
                            <StatusBadge status={row.isDeleted ? 'Inactive' : row.status} />
                          </TableCell>
                          <TableCell>
                            <div className="flex justify-end gap-1">
                              <Button asChild variant="ghost" size="icon" aria-label="View designation">
                                <Link href={`/admin/designations/${row.id}`}><Eye className="h-4 w-4" /></Link>
                              </Button>
                              {canEdit && !row.isDeleted && (
                                <>
                                  <Button asChild variant="ghost" size="icon" aria-label="Edit designation">
                                    <Link href={`/admin/designations/${row.id}/edit`}><Pencil className="h-4 w-4" /></Link>
                                  </Button>
                                  {row.status === 'Active'
                                    ? (
                                      <Button variant="ghost" size="icon" aria-label="Deactivate" onClick={() => setConfirm({ des: row, activate: false })}>
                                        <UserX className="h-4 w-4 text-amber-600" />
                                      </Button>
                                    )
                                    : (
                                      <Button variant="ghost" size="icon" aria-label="Activate" onClick={() => setConfirm({ des: row, activate: true })}>
                                        <UserCheck className="h-4 w-4 text-green-600" />
                                      </Button>
                                    )}
                                  {canDelete && canDeleteDesignationRecord(row).allowed && (
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
                {paginated.length === 0 ? (
                  <EmptyState title="No designations found" />
                ) : (
                  paginated.map((row) => (
                    <Card key={row.id} className="border">
                      <CardContent className="p-4 space-y-2">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-semibold">{row.designationName}</p>
                            <p className="text-xs text-muted-foreground">{row.designationCode}</p>
                          </div>
                          <StatusBadge status={row.isDeleted ? 'Inactive' : row.status} />
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <DepartmentBadge department={row.department} />
                          <DesignationLevelBadge level={row.designationLevel} />
                        </div>
                        <div className="flex gap-2 pt-2">
                          <Button asChild size="sm" variant="outline"><Link href={`/admin/designations/${row.id}`}>View</Link></Button>
                          {canEdit && !row.isDeleted && (
                            <Button asChild size="sm" variant="outline"><Link href={`/admin/designations/${row.id}/edit`}>Edit</Link></Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>

              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{filtered.length} designations</span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={currentPage === 0} onClick={() => setPage((p) => p - 1)}>Prev</Button>
                  <span>Page {currentPage + 1}/{totalPages}</span>
                  <Button variant="outline" size="sm" disabled={currentPage >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>Next</Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="hierarchy">
              <Card>
                <CardHeader><CardTitle className="text-base">Designation Hierarchy</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {hierarchy.length === 0 ? (
                    <EmptyState title="No hierarchy data" message="Create designations with parent relationships to visualize the tree." />
                  ) : (
                    hierarchy.map((node) => (
                      <div
                        key={node.id}
                        className="flex items-center justify-between rounded-lg border bg-card p-3"
                        style={{ marginLeft: `${node.depth * 20}px` }}
                      >
                        <div>
                          <p className="font-medium text-sm">
                            {node.depth > 0 ? '↳ ' : ''}{node.designationName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {node.designationCode}
                            {node.parentDesignationName ? ` · Parent: ${node.parentDesignationName}` : ' · Top-level'}
                            {node.department ? ` · ${node.department}` : ''}
                            {node.designationLevel ? ` · ${node.designationLevel}` : ''}
                          </p>
                        </div>
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/admin/designations/${node.id}`}>Open</Link>
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
            <AlertDialogTitle>{confirm?.activate ? 'Activate Designation' : 'Deactivate Designation'}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.activate
                ? `Activate designation "${confirm?.des.designationName}"?`
                : `Deactivate "${confirm?.des.designationName}"? Linked users remain assigned but new assignments are blocked.`}
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
            <AlertDialogTitle>Soft Delete Designation</AlertDialogTitle>
            <AlertDialogDescription>
              Retire &quot;{deleteConfirm?.designationName}&quot;? Record is retained for audit and can be restored.
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
            <AlertDialogTitle>Restore Designation</AlertDialogTitle>
            <AlertDialogDescription>
              Restore &quot;{restoreConfirm?.designationName}&quot; to Active?
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
            <AlertDialogDescription>Apply to {selected.length} selected designation(s).</AlertDialogDescription>
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

      <AlertDialog open={importOpen} onOpenChange={(open) => { if (!open) { setImportOpen(false); setImportRows([]); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Import Designations</AlertDialogTitle>
            <AlertDialogDescription>
              Import {importRows.length} row(s) from CSV. Required columns: code, name, department.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 py-2">
            <Label>Change Reason *</Label>
            <Textarea value={changeReason} onChange={(e) => setChangeReason(e.target.value)} rows={2} />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionBusy}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={actionBusy} onClick={runImport} className="bg-blue-600">
              {actionBusy ? 'Importing…' : 'Import'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
