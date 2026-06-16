'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Plus, Search, Download, Eye, Pencil, UserCheck, UserX, Copy, Database } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/admin/dashboard/page-header';
import { KpiCard } from '@/components/admin/dashboard/kpi-card';
import { StatusBadge } from '@/components/admin/dashboard/status-badge';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { EmptyState } from '@/components/admin/dashboard/empty-state';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { ModuleBadge } from './module-badge';
import { WorkflowTypeBadge } from './workflow-type-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
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
  canEditWorkflows, canActivateWorkflows, canRecommendWorkflowChanges,
} from '@/lib/permissions';
import { WORKFLOW_MODULE_OPTIONS, WORKFLOW_TYPES, RECORD_STATUSES } from '@/lib/admin/constants';
import type { Workflow } from '@/lib/admin/schemas';
import {
  fetchWorkflows, getWorkflowSummaryCounts, setWorkflowStatus,
  exportWorkflowsCsv, logWorkflowExport, copyWorkflow, seedDefaultWorkflows,
} from '@/lib/admin/workflow-service';

const PAGE_SIZE = 10;

export function WorkflowsListPage() {
  const { user, profile } = useAuth();
  const { role } = useAdminPermissions();
  const canEdit = canEditWorkflows(role);
  const canActivate = canActivateWorkflows(role);
  const canRecommend = canRecommendWorkflowChanges(role);

  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [moduleFilter, setModuleFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [confirm, setConfirm] = useState<{ wf: Workflow; activate: boolean } | null>(null);
  const [copySource, setCopySource] = useState<Workflow | null>(null);
  const [copyCode, setCopyCode] = useState('');
  const [copyName, setCopyName] = useState('');
  const [seeding, setSeeding] = useState(false);

  const auditMeta = {
    userId: user?.uid || 'system',
    userName: profile?.full_name || profile?.email || 'Admin',
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setWorkflows(await fetchWorkflows());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return workflows.filter((w) => {
      const matchSearch = !q ||
        w.workflowCode?.toLowerCase().includes(q) ||
        w.workflowName?.toLowerCase().includes(q) ||
        w.moduleName?.toLowerCase().includes(q) ||
        w.department?.toLowerCase().includes(q);
      const matchModule = moduleFilter === 'all' || w.moduleName === moduleFilter;
      const matchType = typeFilter === 'all' || w.workflowType === typeFilter;
      const matchStatus = statusFilter === 'all' || w.status === statusFilter;
      return matchSearch && matchModule && matchType && matchStatus;
    });
  }, [workflows, search, moduleFilter, typeFilter, statusFilter]);

  const stats = getWorkflowSummaryCounts(workflows);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const paginated = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

  const handleExport = async () => {
    const csv = exportWorkflowsCsv(filtered);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `workflows-export-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    await logWorkflowExport(auditMeta, filtered.length);
    toast.success('Workflow list exported');
  };

  const handleSeed = async () => {
    setSeeding(true);
    const result = await seedDefaultWorkflows(auditMeta);
    setSeeding(false);
    toast.success(`Created ${result.created} workflow(s), skipped ${result.skipped}`);
    load();
  };

  const runConfirm = async () => {
    if (!confirm) return;
    const status = confirm.activate ? 'Active' : 'Inactive';
    const result = await setWorkflowStatus(confirm.wf.id!, confirm.wf, status, auditMeta);
    if (result.success) {
      toast.success(`Workflow ${status === 'Active' ? 'activated' : 'deactivated'}`);
      load();
    } else toast.error(result.error || 'Action failed');
    setConfirm(null);
  };

  const runCopy = async () => {
    if (!copySource || !copyCode.trim() || !copyName.trim()) return;
    const result = await copyWorkflow(copySource.id!, copyCode.trim(), copyName.trim(), auditMeta);
    if (result.error) toast.error(result.error);
    else {
      toast.success('Workflow copied');
      load();
    }
    setCopySource(null);
    setCopyCode('');
    setCopyName('');
  };

  if (loading) return <div><PageHeader title="Workflow Configuration" basePath="/admin" /><LoadingSkeleton rows={2} /></div>;
  if (error) return <ErrorCard message={error} onRetry={load} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Workflow Configuration"
        description="Configure approval and review workflows for PQR, CPV, QMS modules without code changes"
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
                  <Link href="/admin/workflows/create"><Plus className="h-4 w-4 mr-1" />Create Workflow</Link>
                </Button>
              </>
            )}
          </div>
        }
      />

      {canRecommend && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
          Head QA: you can view workflows and recommend changes to Admin for implementation.
        </p>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard label="Total" value={stats.total} />
        <KpiCard label="Active" value={stats.active} />
        <KpiCard label="Inactive" value={stats.inactive} />
        <KpiCard label="Multi-Level" value={stats.multiLevel} />
        <KpiCard label="E-Sign Req." value={stats.eSignRequired} />
        <KpiCard label="Escalation" value={stats.escalationEnabled} />
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col lg:flex-row gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search workflow, module, department..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} className="pl-9" />
            </div>
            <Select value={moduleFilter} onValueChange={(v) => { setModuleFilter(v); setPage(0); }}>
              <SelectTrigger className="w-[150px]"><SelectValue placeholder="Module" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Modules</SelectItem>
                {WORKFLOW_MODULE_OPTIONS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(0); }}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="Type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {WORKFLOW_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
              <SelectTrigger className="w-[130px]"><SelectValue placeholder="Status" /></SelectTrigger>
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
                  <TableHead>Type</TableHead>
                  <TableHead>Levels</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.length === 0 ? (
                  <TableRow><TableCell colSpan={7}><EmptyState title="No workflows found" /></TableCell></TableRow>
                ) : (
                  paginated.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-mono text-xs">{row.workflowCode}</TableCell>
                      <TableCell className="font-medium text-sm">{row.workflowName}</TableCell>
                      <TableCell><ModuleBadge module={row.moduleName} /></TableCell>
                      <TableCell><WorkflowTypeBadge type={row.workflowType} /></TableCell>
                      <TableCell>{row.approvalLevels}</TableCell>
                      <TableCell><StatusBadge status={row.status} /></TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button asChild variant="ghost" size="icon"><Link href={`/admin/workflows/${row.id}`}><Eye className="h-4 w-4" /></Link></Button>
                          {canEdit && (
                            <>
                              <Button asChild variant="ghost" size="icon"><Link href={`/admin/workflows/${row.id}/edit`}><Pencil className="h-4 w-4" /></Link></Button>
                              <Button variant="ghost" size="icon" onClick={() => { setCopySource(row); setCopyCode(`${row.workflowCode}-COPY`); setCopyName(`${row.workflowName} (Copy)`); }}>
                                <Copy className="h-4 w-4" />
                              </Button>
                              {canActivate && (
                                row.status === 'Active'
                                  ? <Button variant="ghost" size="icon" onClick={() => setConfirm({ wf: row, activate: false })}><UserX className="h-4 w-4 text-amber-600" /></Button>
                                  : <Button variant="ghost" size="icon" onClick={() => setConfirm({ wf: row, activate: true })}><UserCheck className="h-4 w-4 text-green-600" /></Button>
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
                    <p className="font-semibold">{row.workflowName}</p>
                    <StatusBadge status={row.status} />
                  </div>
                  <p className="text-xs font-mono text-muted-foreground">{row.workflowCode}</p>
                  <ModuleBadge module={row.moduleName} />
                  <WorkflowTypeBadge type={row.workflowType} />
                  <div className="flex gap-2 pt-2">
                    <Button asChild size="sm" variant="outline"><Link href={`/admin/workflows/${row.id}`}>View</Link></Button>
                    {canEdit && <Button asChild size="sm" variant="outline"><Link href={`/admin/workflows/${row.id}/edit`}>Edit</Link></Button>}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{filtered.length} workflows</span>
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
            <AlertDialogTitle>{confirm?.activate ? 'Activate Workflow' : 'Deactivate Workflow'}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.activate
                ? `Activate "${confirm?.wf.workflowName}"?`
                : `Deactivate "${confirm?.wf.workflowName}"? New records will not use this workflow.`}
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
            <AlertDialogTitle>Copy Workflow</AlertDialogTitle>
            <AlertDialogDescription>Copy from &quot;{copySource?.workflowName}&quot;</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label>New Workflow Code</Label>
              <Input value={copyCode} onChange={(e) => setCopyCode(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>New Workflow Name</Label>
              <Input value={copyName} onChange={(e) => setCopyName(e.target.value)} />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={runCopy} className="bg-blue-600">Copy Workflow</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
