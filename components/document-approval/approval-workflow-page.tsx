'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Download, RefreshCw, Printer, Bell, AlertTriangle, Settings, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { KpiCard } from '@/components/cpv/cpv-ui';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { DmsPageHeader } from '@/components/dms/dms-page-header';
import { useDocumentApproval } from '@/hooks/use-document-approval';
import { ApprovalCharts } from '@/components/document-approval/approval-charts';
import {
  ApprovalTable, ApprovalInbox, LoadingSkeleton as ApprovalSkeleton,
} from '@/components/document-approval/approval-ui';
import { ApprovalCompleteDialog } from '@/components/document-approval/approval-complete-dialog';
import { DelegationDialog } from '@/components/document-approval/delegation-dialog';
import {
  exportApprovalsCsv, exportApprovalsExcel, logApprovalExported, logApprovalDashboardViewed,
  sendApprovalReminders, startApproval, completeApproval, delegateApproval, bulkCompleteApprovals,
} from '@/lib/document-approval-service';
import type { ApprovalKpis, DocumentApprovalRecord } from '@/lib/document-approval-types';
import { APPROVAL_TYPES } from '@/lib/document-approval-types';
import type { ApprovalCompleteInput } from '@/lib/document-approval-schemas';
import {
  getPendingApprovals, getOverdueApprovals, getRecentlyApproved, getReturnedDocuments,
  getDelegatedApprovals, getEscalatedApprovals, getApproverQueue,
  APPROVAL_KPI_FILTER_MAP,
} from '@/lib/document-approval-records';
import { DMS_DEPARTMENTS, DOCUMENT_TYPES } from '@/lib/dms-types';
import { cn } from '@/lib/utils';

const KPI_ITEMS: { label: string; key: keyof ApprovalKpis; filterKey?: string; tone?: 'blue' | 'green' | 'amber' | 'red' }[] = [
  { label: 'Pending Approvals', key: 'pendingApprovals', filterKey: 'pending', tone: 'amber' },
  { label: 'Approved Today', key: 'approvedToday', filterKey: 'approved_today', tone: 'green' },
  { label: 'Rejected Today', key: 'rejectedToday', filterKey: 'rejected_today', tone: 'red' },
  { label: 'Returned For Revision', key: 'returnedForRevision', filterKey: 'returned', tone: 'amber' },
  { label: 'Overdue Approvals', key: 'overdueApprovals', filterKey: 'overdue', tone: 'red' },
  { label: 'Avg Approval Time (days)', key: 'averageApprovalTimeDays' },
  { label: 'SLA Compliance %', key: 'slaCompliancePct', tone: 'green' },
  { label: 'Delegated Approvals', key: 'delegatedApprovals', filterKey: 'delegated', tone: 'blue' },
  { label: 'Escalated Approvals', key: 'escalatedApprovals', filterKey: 'escalated', tone: 'red' },
];

export function DocumentApprovalWorkflowPage() {
  return (<Suspense fallback={<LoadingSkeleton rows={8} />}><DocumentApprovalWorkflowContent /></Suspense>);
}

function DocumentApprovalWorkflowContent() {
  const searchParams = useSearchParams();
  const viewedLogged = useRef(false);
  const [activeKpi, setActiveKpi] = useState<string | null>(null);
  const [completeRecord, setCompleteRecord] = useState<DocumentApprovalRecord | null>(null);
  const [delegateId, setDelegateId] = useState<string | null>(null);

  const {
    records, paginatedRecords, metrics, charts, filters, setFilters,
    loading, refreshing, error, refresh, actor, page, setPage, totalPages, pagination,
    selectedIds, toggleSelect, toggleSelectAll, clearSelection,
    canExport, canApprove, canDesign, canBulk, isReadOnly, canView, assignedOnly,
  } = useDocumentApproval();

  useEffect(() => {
    if (!viewedLogged.current && !loading && actor.id) {
      viewedLogged.current = true;
      void logApprovalDashboardViewed(actor);
    }
  }, [loading, actor.id, actor]);

  useEffect(() => {
    const kpi = searchParams.get('kpi');
    if (kpi && APPROVAL_KPI_FILTER_MAP[kpi]) {
      setActiveKpi(kpi);
      setFilters((p) => ({ ...p, ...APPROVAL_KPI_FILTER_MAP[kpi] }));
    }
  }, [searchParams, setFilters]);

  const handleExport = useCallback((format: 'csv' | 'excel' | 'print') => {
    if (!records.length) { toast.error('No approvals to export'); return; }
    if (format === 'csv') exportApprovalsCsv(records);
    else if (format === 'excel') exportApprovalsExcel(records);
    else window.print();
    void logApprovalExported(actor, format, records.length);
    toast.success('Export complete');
  }, [records, actor]);

  const inboxRecords = getApproverQueue(records, assignedOnly ? actor.id : undefined);

  const handleInboxAction = async (id: string, action: 'start' | 'complete' | 'delegate') => {
    try {
      if (action === 'start') {
        await startApproval(id, actor);
        toast.success('Approval started');
        refresh(true);
      } else if (action === 'complete') {
        const rec = records.find((r) => r.id === id) || null;
        setCompleteRecord(rec);
      } else if (action === 'delegate') {
        setDelegateId(id);
      }
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Action failed'); }
  };

  const handleComplete = async (input: ApprovalCompleteInput) => {
    if (!completeRecord) return;
    try {
      await completeApproval(completeRecord.id, input, actor);
      toast.success('Approval completed');
      setCompleteRecord(null);
      refresh(true);
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Completion failed'); }
  };

  const handleDelegate = async (input: { delegate_to_id: string; delegate_to_name: string; reason: string }) => {
    if (!delegateId) return;
    try {
      await delegateApproval(delegateId, input, actor);
      toast.success('Approval delegated');
      setDelegateId(null);
      refresh(true);
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Delegation failed'); }
  };

  const handleBulk = async (decision: ApprovalCompleteInput['decision']) => {
    if (!selectedIds.length) { toast.error('Select approvals first'); return; }
    const count = await bulkCompleteApprovals(selectedIds, decision, actor);
    toast.success(`${count} approval(s) processed`);
    clearSelection();
    refresh(true);
  };

  if (!canView) return <ErrorCard message="You do not have access to document approvals." />;
  if (loading && !records.length) return <ApprovalSkeleton rows={8} />;
  if (error) return <ErrorCard message={error} onRetry={() => refresh()} />;

  return (
    <div className="space-y-6 animate-in fade-in print:space-y-4">
      <DmsPageHeader
        title="Document Approval Workflow"
        description="Manage regulated approval workflows for GMP controlled documents."
        trail={[{ label: 'Approval Workflow' }]}
        actions={<>
          {canDesign && (
            <Button size="sm" variant="outline" asChild>
              <Link href="/qms/documents/approval-workflow/workflows"><Settings className="h-4 w-4 mr-1" /> Workflow Designer</Link>
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => refresh(true)} disabled={refreshing}>
            <RefreshCw className={cn('h-4 w-4 mr-1', refreshing && 'animate-spin')} /> Refresh
          </Button>
          {canExport && (<>
            <Button variant="outline" size="sm" onClick={() => handleExport('csv')}><Download className="h-4 w-4 mr-1" /> CSV</Button>
            <Button variant="outline" size="sm" onClick={() => handleExport('excel')}><Download className="h-4 w-4 mr-1" /> Excel</Button>
            <Button variant="outline" size="sm" onClick={() => handleExport('print')}><Printer className="h-4 w-4 mr-1" /> Print</Button>
          </>)}
          {selectedIds.length > 0 && canBulk && (<>
            <Button variant="outline" size="sm" onClick={() => void handleBulk('Approved')}><CheckCircle className="h-4 w-4 mr-1" /> Bulk Approve</Button>
            <Button variant="outline" size="sm" onClick={() => void handleBulk('Rejected')}><XCircle className="h-4 w-4 mr-1" /> Bulk Reject</Button>
            <Button variant="outline" size="sm" onClick={async () => {
              const c = await sendApprovalReminders(selectedIds, actor);
              toast.success(`Sent ${c} reminder(s)`);
              clearSelection();
            }}><Bell className="h-4 w-4 mr-1" /> Remind ({selectedIds.length})</Button>
          </>)}
        </>}
      />

      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-3 items-center">
            <Input placeholder="Search approvals..." value={filters.search || ''} onChange={(e) => { setFilters({ ...filters, search: e.target.value }); setPage(1); }} className="max-w-xs" />
            <select className="rounded-md border bg-background px-3 py-2 text-sm" value={filters.status || ''} onChange={(e) => { setFilters({ ...filters, status: e.target.value || undefined }); setPage(1); }}>
              <option value="">All Statuses</option>
              {['Pending Approval', 'In Progress', 'Approved', 'Rejected', 'Returned', 'Cancelled', 'Expired'].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select className="rounded-md border bg-background px-3 py-2 text-sm" value={filters.approval_type || ''} onChange={(e) => { setFilters({ ...filters, approval_type: e.target.value || undefined }); setPage(1); }}>
              <option value="">All Types</option>
              {APPROVAL_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <select className="rounded-md border bg-background px-3 py-2 text-sm" value={filters.department || ''} onChange={(e) => { setFilters({ ...filters, department: e.target.value || undefined }); setPage(1); }}>
              <option value="">All Departments</option>
              {DMS_DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
            <select className="rounded-md border bg-background px-3 py-2 text-sm" value={filters.document_type || ''} onChange={(e) => { setFilters({ ...filters, document_type: e.target.value || undefined }); setPage(1); }}>
              <option value="">All Document Types</option>
              {DOCUMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {KPI_ITEMS.map((item) => item.filterKey ? (
          <button key={item.key} type="button" onClick={() => {
            const active = activeKpi === item.filterKey;
            setActiveKpi(active ? null : item.filterKey!);
            setFilters(active ? {} : APPROVAL_KPI_FILTER_MAP[item.filterKey!] || {});
            setPage(1);
          }} className={cn('text-left', activeKpi === item.filterKey && 'ring-2 ring-indigo-500 rounded-lg')}>
            <KpiCard label={item.label} value={metrics[item.key]} tone={item.tone} />
          </button>
        ) : (
          <KpiCard key={item.key} label={item.label} value={metrics[item.key]} tone={item.tone} />
        ))}
      </div>

      <ApprovalCharts charts={charts} />

      {canApprove && inboxRecords.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold flex items-center gap-2"><Bell className="h-5 w-5" /> Approval Inbox</h2>
          <ApprovalInbox records={inboxRecords.slice(0, 6)} onAction={(id, action) => void handleInboxAction(id, action)} />
        </div>
      )}

      <Tabs defaultValue="pending" className="space-y-4">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="pending">Pending ({getPendingApprovals(records).length})</TabsTrigger>
          <TabsTrigger value="overdue">Overdue ({getOverdueApprovals(records).length})</TabsTrigger>
          <TabsTrigger value="approved">Recently Approved ({getRecentlyApproved(records).length})</TabsTrigger>
          <TabsTrigger value="returned">Returned ({getReturnedDocuments(records).length})</TabsTrigger>
          <TabsTrigger value="delegated">Delegated ({getDelegatedApprovals(records).length})</TabsTrigger>
          <TabsTrigger value="escalated">Escalated ({getEscalatedApprovals(records).length})</TabsTrigger>
          <TabsTrigger value="history">Approval History ({records.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="history">
          <Card>
            <CardContent className="p-0">
              <ApprovalTable records={paginatedRecords} selectedIds={selectedIds} toggleSelect={toggleSelect} toggleSelectAll={toggleSelectAll} isReadOnly={isReadOnly} />
              {totalPages > 1 && (
                <div className="flex items-center justify-between p-4 border-t">
                  <p className="text-sm text-muted-foreground">{(page - 1) * pagination.pageSize + 1}–{Math.min(page * pagination.pageSize, pagination.total)} of {pagination.total}</p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</Button>
                    <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage(page + 1)}>Next</Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {[
          { v: 'pending', d: getPendingApprovals(records) },
          { v: 'overdue', d: getOverdueApprovals(records) },
          { v: 'approved', d: getRecentlyApproved(records) },
          { v: 'returned', d: getReturnedDocuments(records) },
          { v: 'delegated', d: getDelegatedApprovals(records) },
          { v: 'escalated', d: getEscalatedApprovals(records) },
        ].map(({ v, d }) => (
          <TabsContent key={v} value={v}>
            <Card>
              <CardContent className="p-0">
                {v === 'overdue' && d.length > 0 && (
                  <div className="p-3 bg-red-50 dark:bg-red-950/20 border-b flex items-center gap-2 text-sm text-red-700">
                    <AlertTriangle className="h-4 w-4" /> {d.length} overdue approval(s)
                  </div>
                )}
                <ApprovalTable records={d.slice(0, 20)} isReadOnly={isReadOnly} compact />
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      <ApprovalCompleteDialog
        open={Boolean(completeRecord)}
        onOpenChange={(o) => { if (!o) setCompleteRecord(null); }}
        record={completeRecord}
        onComplete={(input) => void handleComplete(input)}
      />
      <DelegationDialog
        open={Boolean(delegateId)}
        onOpenChange={(o) => { if (!o) setDelegateId(null); }}
        onDelegate={(input) => void handleDelegate(input)}
      />
    </div>
  );
}
