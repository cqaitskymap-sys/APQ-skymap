'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Plus, Search, Download, Eye, Pencil, UserCheck, UserX, Database } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/admin/dashboard/page-header';
import { KpiCard } from '@/components/admin/dashboard/kpi-card';
import { StatusBadge } from '@/components/admin/dashboard/status-badge';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { EmptyState } from '@/components/admin/dashboard/empty-state';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { ModuleBadge } from '@/components/admin/workflows/module-badge';
import { ResetFrequencyBadge } from './reset-frequency-badge';
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
import { canEditDocumentNumbering } from '@/lib/permissions';
import {
  DOCUMENT_NUMBERING_MODULES, NUMBERING_RESET_FREQUENCIES, RECORD_STATUSES,
} from '@/lib/admin/constants';
import type { DocumentNumbering } from '@/lib/admin/schemas';
import {
  fetchDocumentNumberings, getDocumentNumberingSummaryCounts, setDocumentNumberingStatus,
  exportDocumentNumberingsCsv, logDocumentNumberingExport, seedDefaultDocumentNumberings,
} from '@/lib/admin/document-numbering-service';

const PAGE_SIZE = 10;

export function DocumentNumberingsListPage() {
  const { user, profile } = useAuth();
  const { role } = useAdminPermissions();
  const canEdit = canEditDocumentNumbering(role);

  const [formats, setFormats] = useState<DocumentNumbering[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [moduleFilter, setModuleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [resetFilter, setResetFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [confirm, setConfirm] = useState<{ format: DocumentNumbering; activate: boolean } | null>(null);
  const [seeding, setSeeding] = useState(false);

  const auditMeta = {
    userId: user?.uid || 'system',
    userName: profile?.full_name || profile?.email || 'Admin',
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await fetchDocumentNumberings();
      setFormats(list);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return formats.filter((n) => {
      const matchSearch = !q ||
        n.numberingCode?.toLowerCase().includes(q) ||
        n.moduleName?.toLowerCase().includes(q) ||
        n.documentType?.toLowerCase().includes(q) ||
        n.prefix?.toLowerCase().includes(q);
      const matchModule = moduleFilter === 'all' || n.moduleName === moduleFilter;
      const matchStatus = statusFilter === 'all' || n.status === statusFilter;
      const matchReset = resetFilter === 'all' || n.resetFrequency === resetFilter;
      return matchSearch && matchModule && matchStatus && matchReset;
    });
  }, [formats, search, moduleFilter, statusFilter, resetFilter]);

  const stats = getDocumentNumberingSummaryCounts(formats);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const paginated = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

  const handleExport = async () => {
    const csv = exportDocumentNumberingsCsv(filtered);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `document-numbering-export-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    await logDocumentNumberingExport(auditMeta, filtered.length);
    toast.success('Numbering configuration exported');
  };

  const handleSeed = async () => {
    setSeeding(true);
    const result = await seedDefaultDocumentNumberings(auditMeta);
    setSeeding(false);
    toast.success(`Created ${result.created} format(s), skipped ${result.skipped}`);
    load();
  };

  const runConfirm = async () => {
    if (!confirm) return;
    const status = confirm.activate ? 'Active' : 'Inactive';
    const result = await setDocumentNumberingStatus(confirm.format.id!, confirm.format, status, auditMeta);
    if (result.success) {
      toast.success(`Format ${status === 'Active' ? 'activated' : 'deactivated'}`);
      load();
    } else toast.error(result.error || 'Action failed');
    setConfirm(null);
  };

  if (loading) return <div><PageHeader title="Document Numbering" basePath="/admin" /><LoadingSkeleton rows={2} /></div>;
  if (error) return <ErrorCard message={error} onRetry={load} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Document Numbering"
        description="Configure automatic numbering formats for PQR, CPV, and QMS records"
        basePath="/admin"
        actions={
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-4 w-4 mr-1" />Export
            </Button>
            {canEdit && (
              <>
                <Button variant="outline" size="sm" disabled={seeding} onClick={handleSeed}>
                  <Database className="h-4 w-4 mr-1" />{seeding ? 'Seeding...' : 'Seed Defaults'}
                </Button>
                <Button asChild size="sm" className="bg-blue-600 hover:bg-blue-700">
                  <Link href="/admin/document-numbering/create">
                    <Plus className="h-4 w-4 mr-1" />Create Format
                  </Link>
                </Button>
              </>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
        <KpiCard label="Total Formats" value={stats.total} />
        <KpiCard label="Active" value={stats.active} />
        <KpiCard label="Inactive" value={stats.inactive} />
        <KpiCard label="Auto Generate" value={stats.autoGenerateEnabled} />
        <KpiCard label="Manual Override" value={stats.manualOverrideEnabled} />
        <KpiCard label="Yearly Reset" value={stats.yearlyReset} />
        <KpiCard label="Monthly Reset" value={stats.monthlyReset} />
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col lg:flex-row gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search module, document type, prefix..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                className="pl-9"
              />
            </div>
            <Select value={moduleFilter} onValueChange={(v) => { setModuleFilter(v); setPage(0); }}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Module" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Modules</SelectItem>
                {DOCUMENT_NUMBERING_MODULES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={resetFilter} onValueChange={(v) => { setResetFilter(v); setPage(0); }}>
              <SelectTrigger className="w-[140px]"><SelectValue placeholder="Reset" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Reset</SelectItem>
                {NUMBERING_RESET_FREQUENCIES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
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
                  <TableHead>Module</TableHead>
                  <TableHead>Document Type</TableHead>
                  <TableHead>Prefix</TableHead>
                  <TableHead>Preview</TableHead>
                  <TableHead>Reset</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8}><EmptyState title="No numbering formats found" /></TableCell>
                  </TableRow>
                ) : (
                  paginated.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-mono text-xs">{row.numberingCode}</TableCell>
                      <TableCell><ModuleBadge module={row.moduleName} /></TableCell>
                      <TableCell className="text-sm">{row.documentType}</TableCell>
                      <TableCell>{row.prefix}</TableCell>
                      <TableCell className="font-mono text-xs max-w-[180px] truncate">{row.exampleNumberPreview}</TableCell>
                      <TableCell><ResetFrequencyBadge value={row.resetFrequency} /></TableCell>
                      <TableCell><StatusBadge status={row.status} /></TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button asChild variant="ghost" size="icon">
                            <Link href={`/admin/document-numbering/${row.id}`}><Eye className="h-4 w-4" /></Link>
                          </Button>
                          {canEdit && (
                            <>
                              <Button asChild variant="ghost" size="icon">
                                <Link href={`/admin/document-numbering/${row.id}/edit`}><Pencil className="h-4 w-4" /></Link>
                              </Button>
                              {row.status === 'Active'
                                ? (
                                  <Button variant="ghost" size="icon" onClick={() => setConfirm({ format: row, activate: false })}>
                                    <UserX className="h-4 w-4 text-amber-600" />
                                  </Button>
                                )
                                : (
                                  <Button variant="ghost" size="icon" onClick={() => setConfirm({ format: row, activate: true })}>
                                    <UserCheck className="h-4 w-4 text-green-600" />
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
                    <p className="font-semibold font-mono text-sm">{row.numberingCode}</p>
                    <StatusBadge status={row.status} />
                  </div>
                  <p className="text-xs font-mono text-muted-foreground break-all">{row.exampleNumberPreview}</p>
                  <div className="flex flex-wrap gap-2">
                    <ModuleBadge module={row.moduleName} />
                    <ResetFrequencyBadge value={row.resetFrequency} />
                  </div>
                  <p className="text-sm">{row.documentType}</p>
                  <div className="flex gap-2 pt-2">
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/admin/document-numbering/${row.id}`}>View</Link>
                    </Button>
                    {canEdit && (
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/admin/document-numbering/${row.id}/edit`}>Edit</Link>
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{filtered.length} formats</span>
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
            <AlertDialogTitle>{confirm?.activate ? 'Activate Format' : 'Deactivate Format'}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.activate
                ? `Activate "${confirm?.format.numberingCode}"?`
                : `Deactivate "${confirm?.format.numberingCode}"? New records will not use this format.`}
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
