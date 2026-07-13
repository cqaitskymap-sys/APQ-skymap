'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Plus, Search, Download, Eye, Pencil, UserCheck, UserX, Upload, Database, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/admin/dashboard/page-header';
import { KpiCard } from '@/components/admin/dashboard/kpi-card';
import { StatusBadge } from '@/components/admin/dashboard/status-badge';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { EmptyState } from '@/components/admin/dashboard/empty-state';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { ParameterTypeBadge } from './parameter-type-badge';
import { CriticalityBadge } from './criticality-badge';
import { ProductLinkBadge } from './product-link-badge';
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
import {
  canEditParameters, canEditQcParameters, canEditUtilityParameters,
  canImportParameters, canActivateParameters, canViewCppParametersOnly,
} from '@/lib/permissions';
import {
  PARAMETER_TYPES, PARAMETER_CATEGORIES, PROCESS_STAGES,
  CRITICALITY_OPTIONS, RECORD_STATUSES,
} from '@/lib/admin/constants';
import type { Parameter } from '@/lib/admin/schemas';
import {
  fetchParameters, getParameterSummaryCounts, setParameterStatus, deleteParameter,
  exportParametersCsv, logParameterExport, importParametersFromFile, seedDefaultParameters,
} from '@/lib/admin/parameter-service';

const PAGE_SIZE = 10;

export function ParametersListPage() {
  const { user, profile } = useAuth();
  const { role, canDelete } = useAdminPermissions();
  const canEdit = canEditParameters(role) || canEditQcParameters(role) || canEditUtilityParameters(role);
  const canImport = canImportParameters(role);
  const canActivate = canActivateParameters(role);
  const cppOnly = canViewCppParametersOnly(role);

  const [parameters, setParameters] = useState<Parameter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [stageFilter, setStageFilter] = useState('all');
  const [criticalityFilter, setCriticalityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [confirm, setConfirm] = useState<{ param: Parameter; activate: boolean } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Parameter | null>(null);
  const [seeding, setSeeding] = useState(false);

  const auditMeta = {
    userId: user?.uid || 'system',
    userName: profile?.full_name || profile?.email || 'Admin',
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setParameters(await fetchParameters());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const roleFiltered = useMemo(() => {
    if (!cppOnly) return parameters;
    return parameters.filter((p) => p.parameterType === 'CPP' || p.parameterType === 'IPC' || p.parameterType === 'Yield Parameter');
  }, [parameters, cppOnly]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return roleFiltered.filter((p) => {
      const matchSearch = !q ||
        p.parameterCode?.toLowerCase().includes(q) ||
        p.parameterName?.toLowerCase().includes(q) ||
        p.parameterType?.toLowerCase().includes(q) ||
        p.productLink?.toLowerCase().includes(q);
      const matchType = typeFilter === 'all' || p.parameterType === typeFilter;
      const matchCategory = categoryFilter === 'all' || p.parameterCategory === categoryFilter;
      const matchStage = stageFilter === 'all' || p.processStage === stageFilter;
      const matchCriticality = criticalityFilter === 'all' || p.criticality === criticalityFilter;
      const matchStatus = statusFilter === 'all' || p.status === statusFilter;
      return matchSearch && matchType && matchCategory && matchStage && matchCriticality && matchStatus;
    });
  }, [roleFiltered, search, typeFilter, categoryFilter, stageFilter, criticalityFilter, statusFilter]);

  const stats = getParameterSummaryCounts(roleFiltered);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const paginated = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

  const handleExport = async () => {
    const csv = exportParametersCsv(filtered);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `parameters-export-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    await logParameterExport(auditMeta, filtered.length);
    toast.success('Parameter list exported');
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const result = await importParametersFromFile(file, auditMeta);
    if (result.imported) toast.success(`Imported ${result.imported} parameter(s)`);
    if (result.errors.length) toast.warning(`${result.errors.length} row(s) failed`);
    load();
    e.target.value = '';
  };

  const handleSeedDefaults = async () => {
    setSeeding(true);
    const result = await seedDefaultParameters(auditMeta);
    setSeeding(false);
    toast.success(`Created ${result.created} default parameter(s), skipped ${result.skipped}`);
    load();
  };

  const runConfirm = async () => {
    if (!confirm) return;
    const status = confirm.activate ? 'Active' : 'Inactive';
    const result = await setParameterStatus(confirm.param.id!, confirm.param, status, auditMeta);
    if (result.success) {
      toast.success(`Parameter ${status === 'Active' ? 'activated' : 'deactivated'}`);
      load();
    } else toast.error(result.error || 'Action failed');
    setConfirm(null);
  };

  const runDelete = async () => {
    if (!deleteConfirm?.id) return;
    const result = await deleteParameter(deleteConfirm.id, deleteConfirm, auditMeta);
    if (result.success) {
      toast.success('Parameter deleted');
      load();
    } else {
      toast.error(result.error || 'Delete failed');
    }
    setDeleteConfirm(null);
  };

  if (loading) return <div><PageHeader title="Parameter Master" basePath="/admin" /><LoadingSkeleton rows={2} /></div>;
  if (error) return <ErrorCard message={error} onRetry={load} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Parameter Master"
        description="CPP, CQA, IPC, QC, Stability, Utility and Environmental parameters for CPV and QMS"
        basePath="/admin"
        actions={
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={handleExport}><Download className="h-4 w-4 mr-1" />Export</Button>
            {canImport && (
              <>
                <Button variant="outline" size="sm" asChild>
                  <label className="cursor-pointer">
                    <Upload className="h-4 w-4 mr-1" />Import CSV
                    <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleImport} />
                  </label>
                </Button>
                <Button variant="outline" size="sm" disabled={seeding} onClick={handleSeedDefaults}>
                  <Database className="h-4 w-4 mr-1" />{seeding ? 'Seeding...' : 'Seed Defaults'}
                </Button>
              </>
            )}
            {canEdit && !cppOnly && (
              <Button asChild size="sm" className="bg-blue-600 hover:bg-blue-700">
                <Link href="/admin/parameters/create"><Plus className="h-4 w-4 mr-1" />Create Parameter</Link>
              </Button>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        <KpiCard label="Total" value={stats.total} />
        <KpiCard label="CPP" value={stats.cpp} />
        <KpiCard label="CQA" value={stats.cqa} />
        <KpiCard label="IPC" value={stats.ipc} />
        <KpiCard label="Utility" value={stats.utility} />
        <KpiCard label="Environmental" value={stats.environmental} />
        <KpiCard label="Active" value={stats.active} />
        <KpiCard label="Critical" value={stats.critical} />
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col lg:flex-row gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search code, name, type, product..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                className="pl-9"
              />
            </div>
            <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(0); }}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {PARAMETER_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v); setPage(0); }}>
              <SelectTrigger className="w-[150px]"><SelectValue placeholder="Category" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {PARAMETER_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={stageFilter} onValueChange={(v) => { setStageFilter(v); setPage(0); }}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Stage" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Stages</SelectItem>
                {PROCESS_STAGES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={criticalityFilter} onValueChange={(v) => { setCriticalityFilter(v); setPage(0); }}>
              <SelectTrigger className="w-[130px]"><SelectValue placeholder="Criticality" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {CRITICALITY_OPTIONS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
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
                  <TableHead>Type</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead>Limits</TableHead>
                  <TableHead>Criticality</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.length === 0 ? (
                  <TableRow><TableCell colSpan={9}><EmptyState title="No parameters found" /></TableCell></TableRow>
                ) : (
                  paginated.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-mono text-xs">{row.parameterCode}</TableCell>
                      <TableCell className="font-medium text-sm">{row.parameterName}</TableCell>
                      <TableCell><ParameterTypeBadge type={row.parameterType} /></TableCell>
                      <TableCell><ProductLinkBadge product={row.productLink} /></TableCell>
                      <TableCell className="text-sm">{row.processStage || '-'}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {row.lowerLimit && row.upperLimit ? `${row.lowerLimit} – ${row.upperLimit} ${row.unit}` : row.unit || '-'}
                      </TableCell>
                      <TableCell><CriticalityBadge criticality={row.criticality} /></TableCell>
                      <TableCell><StatusBadge status={row.status} /></TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button asChild variant="ghost" size="icon"><Link href={`/admin/parameters/${row.id}`}><Eye className="h-4 w-4" /></Link></Button>
                          {canEdit && !cppOnly && (
                            <>
                              <Button asChild variant="ghost" size="icon"><Link href={`/admin/parameters/${row.id}/edit`}><Pencil className="h-4 w-4" /></Link></Button>
                              {canActivate && (
                                row.status === 'Active'
                                  ? <Button variant="ghost" size="icon" onClick={() => setConfirm({ param: row, activate: false })}><UserX className="h-4 w-4 text-amber-600" /></Button>
                                  : <Button variant="ghost" size="icon" onClick={() => setConfirm({ param: row, activate: true })}><UserCheck className="h-4 w-4 text-green-600" /></Button>
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
            {paginated.length === 0 ? (
              <EmptyState title="No parameters found" />
            ) : (
              paginated.map((row) => (
                <Card key={row.id} className="border">
                  <CardContent className="p-4 space-y-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold">{row.parameterName}</p>
                        <p className="text-xs font-mono text-muted-foreground">{row.parameterCode}</p>
                      </div>
                      <StatusBadge status={row.status} />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <ParameterTypeBadge type={row.parameterType} />
                      <CriticalityBadge criticality={row.criticality} />
                      <ProductLinkBadge product={row.productLink} />
                    </div>
                    <div className="flex gap-2 pt-2">
                      <Button asChild size="sm" variant="outline"><Link href={`/admin/parameters/${row.id}`}>View</Link></Button>
                      {canEdit && !cppOnly && (
                        <>
                          <Button asChild size="sm" variant="outline"><Link href={`/admin/parameters/${row.id}/edit`}>Edit</Link></Button>
                          {canDelete && (
                            <Button size="sm" variant="destructive" onClick={() => setDeleteConfirm(row)}>Delete</Button>
                          )}
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{filtered.length} parameters</span>
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
            <AlertDialogTitle>{confirm?.activate ? 'Activate Parameter' : 'Deactivate Parameter'}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.activate
                ? `Activate "${confirm?.param.parameterName}"?`
                : `Deactivate "${confirm?.param.parameterName}"? CPV monitoring may be affected.`}
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
            <AlertDialogTitle>Delete Parameter</AlertDialogTitle>
            <AlertDialogDescription>
              {`Delete "${deleteConfirm?.parameterName}"? This action will remove it from active lists.`}
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
