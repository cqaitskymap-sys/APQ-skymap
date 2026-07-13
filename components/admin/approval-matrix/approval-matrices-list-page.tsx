'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Plus, Search, Download, Eye, Pencil, UserCheck, UserX, Copy, Database, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/admin/dashboard/page-header';
import { KpiCard } from '@/components/admin/dashboard/kpi-card';
import { StatusBadge } from '@/components/admin/dashboard/status-badge';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { EmptyState } from '@/components/admin/dashboard/empty-state';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { ModuleBadge } from '@/components/admin/workflows/module-badge';
import { RiskBadge } from './risk-badge';
import { DepartmentBadge } from './department-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import {
  canEditApprovalMatrix, canActivateApprovalMatrix, canRecommendWorkflowChanges,
} from '@/lib/permissions';
import { APPROVAL_MATRIX_MODULES, RISK_LEVELS, RECORD_STATUSES } from '@/lib/admin/constants';
import type { ApprovalMatrix } from '@/lib/admin/schemas';
import {
  fetchApprovalMatrices, getApprovalMatrixSummaryCounts, setApprovalMatrixStatus,
  exportApprovalMatricesCsv, logApprovalMatrixExport, copyApprovalMatrix, seedDefaultApprovalMatrices,
} from '@/lib/admin/approval-matrix-service';
import { deleteAdminRecord } from '@/lib/admin/admin-service';
import { ADMIN_COLLECTIONS } from '@/lib/admin/constants';

const PAGE_SIZE = 10;

export function ApprovalMatricesListPage() {
  const { user, profile } = useAuth();
  const { role, canDelete } = useAdminPermissions();
  const canEdit = canEditApprovalMatrix(role);
  const canActivate = canActivateApprovalMatrix(role);
  const canRecommend = canRecommendWorkflowChanges(role);

  const [matrices, setMatrices] = useState<ApprovalMatrix[]>([]);
  const [sites, setSites] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [moduleFilter, setModuleFilter] = useState('all');
  const [riskFilter, setRiskFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [siteFilter, setSiteFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [confirm, setConfirm] = useState<{ matrix: ApprovalMatrix; activate: boolean } | null>(null);
  const [copySource, setCopySource] = useState<ApprovalMatrix | null>(null);
  const [copyCode, setCopyCode] = useState('');
  const [copyName, setCopyName] = useState('');
  const [seeding, setSeeding] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<ApprovalMatrix | null>(null);

  const auditMeta = {
    userId: user?.uid || 'system',
    userName: profile?.full_name || profile?.email || 'Admin',
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await fetchApprovalMatrices();
      setMatrices(list);
      setSites(Array.from(new Set(list.map((m) => m.siteLocation).filter(Boolean))));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return matrices.filter((m) => {
      const matchSearch = !q ||
        m.matrixCode?.toLowerCase().includes(q) ||
        m.matrixName?.toLowerCase().includes(q) ||
        m.moduleName?.toLowerCase().includes(q) ||
        m.department?.toLowerCase().includes(q);
      const matchModule = moduleFilter === 'all' || m.moduleName === moduleFilter;
      const matchRisk = riskFilter === 'all' || m.riskLevel === riskFilter;
      const matchStatus = statusFilter === 'all' || m.status === statusFilter;
      const matchSite = siteFilter === 'all' || m.siteLocation === siteFilter || !m.siteLocation;
      return matchSearch && matchModule && matchRisk && matchStatus && matchSite;
    });
  }, [matrices, search, moduleFilter, riskFilter, statusFilter, siteFilter]);

  const stats = getApprovalMatrixSummaryCounts(matrices);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const paginated = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

  const handleExport = async () => {
    const csv = exportApprovalMatricesCsv(filtered);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `approval-matrix-export-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    await logApprovalMatrixExport(auditMeta, filtered.length);
    toast.success('Approval matrix list exported');
  };

  const handleSeed = async () => {
    setSeeding(true);
    const result = await seedDefaultApprovalMatrices(auditMeta);
    setSeeding(false);
    toast.success(`Created ${result.created} matrix(es), skipped ${result.skipped}`);
    load();
  };

  const runConfirm = async () => {
    if (!confirm) return;
    const status = confirm.activate ? 'Active' : 'Inactive';
    const result = await setApprovalMatrixStatus(confirm.matrix.id!, confirm.matrix, status, auditMeta);
    if (result.success) {
      toast.success(`Matrix ${status === 'Active' ? 'activated' : 'deactivated'}`);
      load();
    } else toast.error(result.error || 'Action failed');
    setConfirm(null);
  };

  const runCopy = async () => {
    if (!copySource || !copyCode.trim() || !copyName.trim()) return;
    const result = await copyApprovalMatrix(copySource.id!, copyCode.trim(), copyName.trim(), auditMeta);
    if (result.error) toast.error(result.error);
    else {
      toast.success('Matrix copied');
      load();
    }
    setCopySource(null);
    setCopyCode('');
    setCopyName('');
  };

  const runDelete = async () => {
    if (!deleteConfirm?.id) return;
    try {
      const ok = await deleteAdminRecord(ADMIN_COLLECTIONS.approvalMatrix, deleteConfirm.id, {
        userId: auditMeta.userId,
        userName: auditMeta.userName,
        module: 'Approval Matrix',
      });
      if (ok) {
        toast.success('Approval matrix deleted');
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

  if (loading) return <div><PageHeader title="Approval Matrix" basePath="/admin" /><LoadingSkeleton rows={2} /></div>;
  if (error) return <ErrorCard message={error} onRetry={load} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Approval Matrix"
        description="Module-wise and department-wise approval authority for PQR, CPV, and QMS"
        basePath="/admin"
        actions={
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={handleExport}><Download className="h-4 w-4 mr-1" />Export</Button>
            {canEdit && (
              <>
                <Button variant="outline" size="sm" disabled={seeding} onClick={handleSeed}>
                  <Database className="h-4 w-4 mr-1" />{seeding ? 'Seeding...' : 'Seed Defaults'}
                </Button>
                <Button asChild size="sm" className="bg-blue-600 hover:bg-blue-700">
                  <Link href="/admin/approval-matrix/create"><Plus className="h-4 w-4 mr-1" />Create Matrix</Link>
                </Button>
              </>
            )}
          </div>
        }
      />

      {canRecommend && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
          Head QA: review approval matrices and recommend changes to Admin.
        </p>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
        <KpiCard label="Total" value={stats.total} />
        <KpiCard label="Active" value={stats.active} />
        <KpiCard label="Inactive" value={stats.inactive} />
        <KpiCard label="Critical" value={stats.critical} />
        <KpiCard label="E-Sign Req." value={stats.eSignRequired} />
        <KpiCard label="Dept-wise" value={stats.departmentWise} />
        <KpiCard label="Product-specific" value={stats.productSpecific} />
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col lg:flex-row gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search code, name, module..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} className="pl-9" />
            </div>
            <Select value={moduleFilter} onValueChange={(v) => { setModuleFilter(v); setPage(0); }}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Module" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Modules</SelectItem>
                {APPROVAL_MATRIX_MODULES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={riskFilter} onValueChange={(v) => { setRiskFilter(v); setPage(0); }}>
              <SelectTrigger className="w-[130px]"><SelectValue placeholder="Risk" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Risk</SelectItem>
                {RISK_LEVELS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={siteFilter} onValueChange={(v) => { setSiteFilter(v); setPage(0); }}>
              <SelectTrigger className="w-[140px]"><SelectValue placeholder="Site" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sites</SelectItem>
                {sites.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
              <SelectTrigger className="w-[120px]"><SelectValue placeholder="Status" /></SelectTrigger>
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
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Module</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Risk</TableHead>
                  <TableHead>Final Approver</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.length === 0 ? (
                  <TableRow><TableCell colSpan={8}><EmptyState title="No approval matrices found" /></TableCell></TableRow>
                ) : (
                  paginated.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-mono text-xs">{row.matrixCode}</TableCell>
                      <TableCell className="font-medium text-sm">{row.matrixName}</TableCell>
                      <TableCell><ModuleBadge module={row.moduleName} /></TableCell>
                      <TableCell><DepartmentBadge department={row.department} /></TableCell>
                      <TableCell><RiskBadge risk={row.riskLevel} /></TableCell>
                      <TableCell className="text-xs">{row.finalApproverRole?.replace(/_/g, ' ') || '-'}</TableCell>
                      <TableCell><StatusBadge status={row.status} /></TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button asChild variant="ghost" size="icon"><Link href={`/admin/approval-matrix/${row.id}`}><Eye className="h-4 w-4" /></Link></Button>
                          {canEdit && (
                            <>
                              <Button asChild variant="ghost" size="icon"><Link href={`/admin/approval-matrix/${row.id}/edit`}><Pencil className="h-4 w-4" /></Link></Button>
                              <Button variant="ghost" size="icon" onClick={() => { setCopySource(row); setCopyCode(`${row.matrixCode}-COPY`); setCopyName(`${row.matrixName} (Copy)`); }}>
                                <Copy className="h-4 w-4" />
                              </Button>
                              {canActivate && (
                                row.status === 'Active'
                                  ? <Button variant="ghost" size="icon" onClick={() => setConfirm({ matrix: row, activate: false })}><UserX className="h-4 w-4 text-amber-600" /></Button>
                                  : <Button variant="ghost" size="icon" onClick={() => setConfirm({ matrix: row, activate: true })}><UserCheck className="h-4 w-4 text-green-600" /></Button>
                              )}
                              {canDelete && (
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
                    <p className="font-semibold">{row.matrixName}</p>
                    <StatusBadge status={row.status} />
                  </div>
                  <p className="text-xs font-mono text-muted-foreground">{row.matrixCode}</p>
                  <div className="flex flex-wrap gap-2">
                    <ModuleBadge module={row.moduleName} />
                    <RiskBadge risk={row.riskLevel} />
                    <DepartmentBadge department={row.department} />
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button asChild size="sm" variant="outline"><Link href={`/admin/approval-matrix/${row.id}`}>View</Link></Button>
                    {canEdit && <Button asChild size="sm" variant="outline"><Link href={`/admin/approval-matrix/${row.id}/edit`}>Edit</Link></Button>}
                    {canDelete && <Button size="sm" variant="destructive" onClick={() => setDeleteConfirm(row)}>Delete</Button>}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{filtered.length} matrices</span>
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
            <AlertDialogTitle>{confirm?.activate ? 'Activate Matrix' : 'Deactivate Matrix'}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.activate
                ? `Activate "${confirm?.matrix.matrixName}"?`
                : `Deactivate "${confirm?.matrix.matrixName}"? New records will not use this matrix.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={runConfirm} className="bg-blue-600">Confirm</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!copySource} onOpenChange={() => setCopySource(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Copy Approval Matrix</AlertDialogTitle>
            <AlertDialogDescription>Copy from &quot;{copySource?.matrixName}&quot;</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1"><Label>New Matrix Code</Label><Input value={copyCode} onChange={(e) => setCopyCode(e.target.value)} /></div>
            <div className="space-y-1"><Label>New Matrix Name</Label><Input value={copyName} onChange={(e) => setCopyName(e.target.value)} /></div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={runCopy} className="bg-blue-600">Copy Matrix</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Approval Matrix</AlertDialogTitle>
            <AlertDialogDescription>
              {`Delete "${deleteConfirm?.matrixName}"? This action cannot be undone.`}
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
