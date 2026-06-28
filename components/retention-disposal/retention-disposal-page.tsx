'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Download, RefreshCw, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { KpiCard } from '@/components/cpv/cpv-ui';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { DmsPageHeader } from '@/components/dms/dms-page-header';
import { useRetentionDisposal } from '@/hooks/use-retention-disposal';
import { RdmCharts } from '@/components/retention-disposal/rdm-charts';
import {
  RetentionScheduleTable, DisposalRequestTable, RetentionPolicyCard,
  RetentionCalendar, DisposalCertificateViewer, LegalHoldPanel, RegulatoryHoldPanel,
  LoadingSkeleton as RdmSkeleton,
} from '@/components/retention-disposal/rdm-ui';
import { DisposalRequestDialog } from '@/components/retention-disposal/disposal-request-dialog';
import {
  exportRetentionCsv, exportRetentionExcel, logRetentionExported, logRetentionDashboardViewed,
  approveDisposalRequest, completeDisposal, createDisposalRequest, applyHold, activateRetentionPolicy,
} from '@/lib/retention-disposal-service';
import type { RetentionDisposalKpis, RetentionScheduleRecord } from '@/lib/retention-disposal-types';
import { RETENTION_STATUSES } from '@/lib/retention-disposal-types';
import {
  RDM_KPI_FILTER_MAP, getUpcomingExpiry, getPendingDisposal, getDisposedSchedules,
  getLegalHoldSchedules, getRegulatoryHoldSchedules,
} from '@/lib/retention-disposal-records';
import { DMS_DEPARTMENTS } from '@/lib/dms-types';
import { cn } from '@/lib/utils';
import type { CreateDisposalRequestInput } from '@/lib/retention-disposal-schemas';

const KPI_ITEMS: { label: string; key: keyof RetentionDisposalKpis; filterKey?: string; tone?: 'blue' | 'green' | 'amber' | 'red' }[] = [
  { label: 'Active Policies', key: 'activePolicies', filterKey: 'policies', tone: 'blue' },
  { label: 'Under Retention', key: 'documentsUnderRetention', filterKey: 'retention', tone: 'green' },
  { label: 'Expiring Soon', key: 'retentionExpiringSoon', filterKey: 'expiring', tone: 'amber' },
  { label: 'Pending Disposal', key: 'pendingDisposal', filterKey: 'disposal', tone: 'amber' },
  { label: 'Disposed Records', key: 'disposedRecords', filterKey: 'disposed', tone: 'red' },
  { label: 'Legal Holds', key: 'legalHolds', filterKey: 'legal', tone: 'red' },
  { label: 'Regulatory Holds', key: 'regulatoryHolds', filterKey: 'regulatory', tone: 'amber' },
  { label: 'Permanent Records', key: 'permanentRecords', filterKey: 'permanent', tone: 'blue' },
];

export function RetentionDisposalPage() {
  return (<Suspense fallback={<LoadingSkeleton rows={8} />}><RetentionDisposalContent /></Suspense>);
}

function RetentionDisposalContent() {
  const searchParams = useSearchParams();
  const viewedLogged = useRef(false);
  const [activeKpi, setActiveKpi] = useState<string | null>(null);
  const [detailSchedule, setDetailSchedule] = useState<RetentionScheduleRecord | null>(null);
  const [disposalSchedule, setDisposalSchedule] = useState<RetentionScheduleRecord | null>(null);

  const {
    policies, schedules, paginatedSchedules, disposals, certificates,
    metrics, charts, filters, setFilters,
    loading, refreshing, error, refresh, actor, page, setPage, totalPages, pagination,
    selectedIds, toggleSelect, toggleSelectAll,
    canExport, canManagePolicies, canManageDisposal, canApprove, canManageHolds, isReadOnly, canView,
  } = useRetentionDisposal();

  useEffect(() => {
    if (!viewedLogged.current && !loading && actor.id) {
      viewedLogged.current = true;
      void logRetentionDashboardViewed(actor);
    }
  }, [loading, actor.id, actor]);

  useEffect(() => {
    const kpi = searchParams.get('kpi');
    if (kpi && RDM_KPI_FILTER_MAP[kpi]) {
      setActiveKpi(kpi);
      setFilters((p) => ({ ...p, ...RDM_KPI_FILTER_MAP[kpi] }));
    }
  }, [searchParams, setFilters]);

  const handleExport = useCallback((format: 'csv' | 'excel' | 'print') => {
    if (!schedules.length) { toast.error('No records to export'); return; }
    if (format === 'csv') exportRetentionCsv(schedules, disposals);
    else if (format === 'excel') exportRetentionExcel(schedules, disposals);
    else window.print();
    void logRetentionExported(actor, format, schedules.length);
    toast.success('Export complete');
  }, [schedules, disposals, actor]);

  const handleApproveDisposal = async (id: string) => {
    try {
      await approveDisposalRequest(id, { signature_meaning: 'I approve disposal of this record', comments: '' }, actor);
      toast.success('Disposal approved');
      refresh(true);
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Approval failed'); }
  };

  const handleCompleteDisposal = async (id: string) => {
    try {
      const cert = await completeDisposal(id, actor);
      toast.success(`Disposal completed — certificate ${cert.certificate_number}`);
      refresh(true);
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Completion failed'); }
  };

  const handleDisposalSubmit = async (input: CreateDisposalRequestInput) => {
    await createDisposalRequest(input, actor);
    toast.success('Disposal request submitted');
    refresh(true);
  };

  const handleApplyHold = async (s: RetentionScheduleRecord, type: 'legal' | 'regulatory') => {
    try {
      await applyHold({ schedule_id: s.id, document_id: s.document_id, hold_type: type, reason: `${type} hold applied from dashboard` }, actor);
      toast.success(`${type === 'legal' ? 'Legal' : 'Regulatory'} hold applied`);
      refresh(true);
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Hold failed'); }
  };

  const handleActivatePolicy = async (id: string) => {
    try {
      await activateRetentionPolicy(id, actor);
      toast.success('Policy activated');
      refresh(true);
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Activation failed'); }
  };

  if (!canView) return <ErrorCard message="You do not have access to retention & disposal management." />;
  if (loading && !schedules.length) return <RdmSkeleton rows={8} />;
  if (error) return <ErrorCard message={error} onRetry={() => refresh()} />;

  const draftPolicies = policies.filter((p) => p.status === 'Draft').slice(0, 4);

  return (
    <div className="space-y-6 animate-in fade-in print:space-y-4">
      <DmsPageHeader
        title="Retention & Disposal Management"
        description="Manage retention schedules, legal holds, and compliant disposal of GMP records."
        trail={[{ label: 'Retention & Disposal Management' }]}
        actions={<>
          <Button variant="outline" size="sm" onClick={() => refresh(true)} disabled={refreshing}>
            <RefreshCw className={cn('h-4 w-4 mr-1', refreshing && 'animate-spin')} /> Refresh
          </Button>
          {canExport && (<>
            <Button variant="outline" size="sm" onClick={() => handleExport('csv')}><Download className="h-4 w-4 mr-1" /> CSV</Button>
            <Button variant="outline" size="sm" onClick={() => handleExport('excel')}><Download className="h-4 w-4 mr-1" /> Excel</Button>
            <Button variant="outline" size="sm" onClick={() => handleExport('print')}><Printer className="h-4 w-4 mr-1" /> Print</Button>
          </>)}
        </>}
      />

      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-3 items-center">
            <Input placeholder="Search schedules..." value={filters.search || ''}
              onChange={(e) => { setFilters({ ...filters, search: e.target.value }); setPage(1); }} className="max-w-xs" />
            <select className="rounded-md border bg-background px-3 py-2 text-sm" value={filters.retention_status || ''}
              onChange={(e) => { setFilters({ ...filters, retention_status: e.target.value || undefined }); setPage(1); }}>
              <option value="">All Statuses</option>
              {RETENTION_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select className="rounded-md border bg-background px-3 py-2 text-sm" value={filters.department || ''}
              onChange={(e) => { setFilters({ ...filters, department: e.target.value || undefined }); setPage(1); }}>
              <option value="">All Departments</option>
              {DMS_DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
        {KPI_ITEMS.map((item) => item.filterKey ? (
          <button key={item.key} type="button" onClick={() => {
            const active = activeKpi === item.filterKey;
            setActiveKpi(active ? null : item.filterKey!);
            setFilters(active ? {} : RDM_KPI_FILTER_MAP[item.filterKey!] || {});
            setPage(1);
          }} className={cn('text-left', activeKpi === item.filterKey && 'ring-2 ring-teal-500 rounded-lg')}>
            <KpiCard label={item.label} value={metrics[item.key]} tone={item.tone} />
          </button>
        ) : (
          <KpiCard key={item.key} label={item.label} value={metrics[item.key]} tone={item.tone} />
        ))}
      </div>

      <RdmCharts charts={charts} />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Retention Calendar</CardTitle></CardHeader>
          <CardContent><RetentionCalendar schedules={schedules} /></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Recent Certificates</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {certificates.slice(0, 3).map((c) => <DisposalCertificateViewer key={c.id} certificate={c} />)}
            {!certificates.length && <p className="text-sm text-muted-foreground text-center py-4">No certificates yet.</p>}
          </CardContent>
        </Card>
      </div>

      {canManagePolicies && draftPolicies.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Draft Retention Policies</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {draftPolicies.map((p) => (
              <div key={p.id}>
                <RetentionPolicyCard policy={p} />
                <Button size="sm" variant="outline" className="mt-2 w-full" onClick={() => void handleActivatePolicy(p.id)}>
                  Activate Policy
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {detailSchedule && (
        <Card>
          <CardContent className="pt-4 space-y-4">
            <div className="flex justify-between items-start">
              <h3 className="font-semibold">Schedule Detail — {detailSchedule.document_number}</h3>
              <Button variant="ghost" size="sm" onClick={() => setDetailSchedule(null)}>Close</Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <LegalHoldPanel schedule={detailSchedule} />
              <RegulatoryHoldPanel schedule={detailSchedule} />
            </div>
            <p className="text-sm">Policy: {detailSchedule.policy_name} ({detailSchedule.policy_number})</p>
            <p className="text-xs text-muted-foreground">
              Trigger: {detailSchedule.retention_trigger} · Expiry: {detailSchedule.retention_expiry_date || 'Permanent'}
            </p>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="expiry" className="space-y-4">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="expiry">Upcoming Expiry ({getUpcomingExpiry(schedules).length})</TabsTrigger>
          <TabsTrigger value="disposal">Pending Disposal ({getPendingDisposal(disposals).length})</TabsTrigger>
          <TabsTrigger value="disposed">Disposed ({getDisposedSchedules(schedules).length})</TabsTrigger>
          <TabsTrigger value="legal">Legal Holds ({getLegalHoldSchedules(schedules).length})</TabsTrigger>
          <TabsTrigger value="regulatory">Regulatory Holds ({getRegulatoryHoldSchedules(schedules).length})</TabsTrigger>
          <TabsTrigger value="certificates">Certificates ({certificates.length})</TabsTrigger>
          <TabsTrigger value="all">All Schedules ({schedules.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="expiry">
          <Card><CardContent className="p-0">
            <RetentionScheduleTable schedules={getUpcomingExpiry(schedules)} selectedIds={selectedIds}
              toggleSelect={toggleSelect} toggleSelectAll={toggleSelectAll} isReadOnly={isReadOnly}
              onDetail={setDetailSchedule} onDisposal={canManageDisposal ? setDisposalSchedule : undefined}
              onHold={canManageHolds ? handleApplyHold : undefined} />
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="disposal">
          <Card><CardContent className="p-0">
            <DisposalRequestTable disposals={getPendingDisposal(disposals)} isReadOnly={isReadOnly}
              onApprove={canApprove ? handleApproveDisposal : undefined}
              onComplete={canManageDisposal ? handleCompleteDisposal : undefined} />
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="disposed">
          <Card><CardContent className="p-0">
            <RetentionScheduleTable schedules={getDisposedSchedules(schedules)} selectedIds={[]} toggleSelect={() => {}} toggleSelectAll={() => {}} isReadOnly onDetail={setDetailSchedule} />
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="legal">
          <Card><CardContent className="p-0">
            <RetentionScheduleTable schedules={getLegalHoldSchedules(schedules)} selectedIds={[]} toggleSelect={() => {}} toggleSelectAll={() => {}} isReadOnly onDetail={setDetailSchedule} />
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="regulatory">
          <Card><CardContent className="p-0">
            <RetentionScheduleTable schedules={getRegulatoryHoldSchedules(schedules)} selectedIds={[]} toggleSelect={() => {}} toggleSelectAll={() => {}} isReadOnly onDetail={setDetailSchedule} />
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="certificates">
          <Card><CardContent className="pt-4 space-y-3">
            {certificates.map((c) => <DisposalCertificateViewer key={c.id} certificate={c} />)}
            {!certificates.length && <p className="text-sm text-muted-foreground text-center py-8">No disposal certificates.</p>}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="all">
          <Card><CardContent className="p-0">
            <RetentionScheduleTable schedules={paginatedSchedules} selectedIds={selectedIds}
              toggleSelect={toggleSelect} toggleSelectAll={toggleSelectAll} isReadOnly={isReadOnly}
              onDetail={setDetailSchedule} onDisposal={canManageDisposal ? setDisposalSchedule : undefined}
              onHold={canManageHolds ? handleApplyHold : undefined} />
            {totalPages > 1 && (
              <div className="flex items-center justify-between p-4 border-t">
                <p className="text-sm text-muted-foreground">
                  {(page - 1) * pagination.pageSize + 1}–{Math.min(page * pagination.pageSize, pagination.total)} of {pagination.total}
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</Button>
                  <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage(page + 1)}>Next</Button>
                </div>
              </div>
            )}
          </CardContent></Card>
        </TabsContent>
      </Tabs>

      <DisposalRequestDialog
        schedule={disposalSchedule}
        open={!!disposalSchedule}
        onOpenChange={(o) => !o && setDisposalSchedule(null)}
        onSubmit={handleDisposalSubmit}
      />
    </div>
  );
}
