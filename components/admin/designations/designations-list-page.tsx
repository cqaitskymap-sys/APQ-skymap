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
import { DesignationLevelBadge } from './designation-level-badge';
import { DepartmentBadge } from './department-badge';
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
import { canEditDesignations } from '@/lib/permissions';
import { DESIGNATION_LEVELS, RECORD_STATUSES } from '@/lib/admin/constants';
import type { Designation } from '@/lib/admin/schemas';
import {
  fetchDesignations, setDesignationStatus, exportDesignationsCsv, logDesignationExport,
} from '@/lib/admin/designation-service';
import { fetchDepartments } from '@/lib/admin/department-service';

const PAGE_SIZE = 10;

export function DesignationsListPage() {
  const { user, profile } = useAuth();
  const { role } = useAdminPermissions();
  const canEdit = canEditDesignations(role);

  const [designations, setDesignations] = useState<Designation[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [deptFilter, setDeptFilter] = useState('all');
  const [levelFilter, setLevelFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [confirm, setConfirm] = useState<{ des: Designation; activate: boolean } | null>(null);

  const auditMeta = {
    userId: user?.uid || 'system',
    userName: profile?.full_name || profile?.email || 'Admin',
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setDesignations(await fetchDesignations());
      const depts = await fetchDepartments();
      setDepartments(depts.map((d) => d.departmentName));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return designations.filter((d) => {
      const matchSearch = !q ||
        d.designationName?.toLowerCase().includes(q) ||
        d.designationCode?.toLowerCase().includes(q) ||
        d.designationId?.toLowerCase().includes(q);
      const matchStatus = statusFilter === 'all' || d.status === statusFilter;
      const matchDept = deptFilter === 'all' || d.department === deptFilter;
      const matchLevel = levelFilter === 'all' || d.designationLevel === levelFilter;
      return matchSearch && matchStatus && matchDept && matchLevel;
    });
  }, [designations, search, statusFilter, deptFilter, levelFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const paginated = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

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

  const runConfirm = async () => {
    if (!confirm) return;
    const status = confirm.activate ? 'Active' : 'Inactive';
    const result = await setDesignationStatus(confirm.des.id!, confirm.des, status, auditMeta);
    if (result.success) {
      if (!confirm.activate && result.linkedUsers) {
        toast.warning(`${result.linkedUsers} linked user(s) remain assigned — inactive designation warning applies`);
      } else {
        toast.success(`Designation ${status.toLowerCase()}`);
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
        <PageHeader title="Designation Master" basePath="/admin" />
        <LoadingSkeleton rows={2} />
      </div>
    );
  }

  if (error) return <ErrorCard message={error} onRetry={load} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Designation Master"
        description="Manage employee designations for Pharma QMS + PQR + CPV"
        basePath="/admin"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-4 w-4 mr-1" />Export
            </Button>
            {canEdit && (
              <Button asChild size="sm" className="bg-blue-600 hover:bg-blue-700">
                <Link href="/admin/designations/create"><Plus className="h-4 w-4 mr-1" />Create Designation</Link>
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
          </div>

          <div className="hidden md:block overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
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
                  <TableRow><TableCell colSpan={6}><EmptyState title="No designations found" /></TableCell></TableRow>
                ) : (
                  paginated.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-mono text-xs">{row.designationCode}</TableCell>
                      <TableCell className="font-medium">{row.designationName}</TableCell>
                      <TableCell><DepartmentBadge department={row.department} /></TableCell>
                      <TableCell><DesignationLevelBadge level={row.designationLevel} /></TableCell>
                      <TableCell><StatusBadge status={row.status} /></TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button asChild variant="ghost" size="icon">
                            <Link href={`/admin/designations/${row.id}`}><Eye className="h-4 w-4" /></Link>
                          </Button>
                          {canEdit && (
                            <>
                              <Button asChild variant="ghost" size="icon">
                                <Link href={`/admin/designations/${row.id}/edit`}><Pencil className="h-4 w-4" /></Link>
                              </Button>
                              {row.status === 'Active'
                                ? <Button variant="ghost" size="icon" onClick={() => setConfirm({ des: row, activate: false })}><UserX className="h-4 w-4 text-amber-600" /></Button>
                                : <Button variant="ghost" size="icon" onClick={() => setConfirm({ des: row, activate: true })}><UserCheck className="h-4 w-4 text-green-600" /></Button>
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
                      <p className="font-semibold">{row.designationName}</p>
                      <p className="text-xs text-muted-foreground">{row.designationCode}</p>
                    </div>
                    <StatusBadge status={row.status} />
                  </div>
                  <div className="flex gap-2">
                    <DepartmentBadge department={row.department} />
                    <DesignationLevelBadge level={row.designationLevel} />
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button asChild size="sm" variant="outline"><Link href={`/admin/designations/${row.id}`}>View</Link></Button>
                    {canEdit && <Button asChild size="sm" variant="outline"><Link href={`/admin/designations/${row.id}/edit`}>Edit</Link></Button>}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{filtered.length} designations</span>
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
            <AlertDialogTitle>{confirm?.activate ? 'Activate Designation' : 'Deactivate Designation'}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.activate
                ? `Activate designation "${confirm?.des.designationName}"?`
                : `Deactivate "${confirm?.des.designationName}"? Linked users remain assigned but new assignments will be blocked.`}
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
