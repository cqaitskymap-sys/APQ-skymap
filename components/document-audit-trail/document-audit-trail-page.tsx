'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Download, RefreshCw, Printer, Lock, Shield, Search } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { KpiCard } from '@/components/cpv/cpv-ui';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { DmsPageHeader } from '@/components/dms/dms-page-header';
import { useDocumentAuditTrail } from '@/hooks/use-document-audit-trail';
import { DatCharts } from '@/components/document-audit-trail/dat-charts';
import {
  AuditTable, AuditTimeline, AuditDetailPanel, ExportHistoryTable,
  EntityHistoryViewer, CorrelationViewer, LoadingSkeleton as DatSkeleton,
} from '@/components/document-audit-trail/dat-ui';
import {
  exportDocumentAuditTrail, logDocumentAuditViewed, verifyAuditRecordIntegrity,
} from '@/lib/document-audit-trail-service';
import type { DocumentAuditKpis, DocumentAuditEntry } from '@/lib/document-audit-trail-types';
import { AUDIT_EVENT_TYPES, AUDIT_EVENT_CATEGORIES } from '@/lib/document-audit-trail-types';
import {
  DAT_KPI_FILTER_MAP, getEntityHistory, getCorrelationEvents, getCriticalEvents, verifyEntryHash,
} from '@/lib/document-audit-trail-records';
import { DMS_DEPARTMENTS } from '@/lib/dms-types';
import { cn } from '@/lib/utils';

const KPI_ITEMS: { label: string; key: keyof DocumentAuditKpis; filterKey?: string; tone?: 'blue' | 'green' | 'amber' | 'red' }[] = [
  { label: 'Audit Events Today', key: 'auditEventsToday', filterKey: 'today', tone: 'blue' },
  { label: 'Total Audit Records', key: 'totalAuditRecords', filterKey: 'total', tone: 'blue' },
  { label: 'Critical Events', key: 'criticalEvents', filterKey: 'critical', tone: 'red' },
  { label: 'E-Signature Events', key: 'electronicSignatureEvents', filterKey: 'esignature', tone: 'green' },
  { label: 'Security Events', key: 'securityEvents', filterKey: 'security', tone: 'amber' },
  { label: 'Configuration Changes', key: 'configurationChanges', filterKey: 'configuration', tone: 'amber' },
  { label: 'Export Requests', key: 'exportRequests', filterKey: 'exports', tone: 'blue' },
  { label: 'Tamper Verification', key: 'tamperVerificationStatus', tone: 'green' },
];

export function DocumentAuditTrailPage() {
  return (<Suspense fallback={<LoadingSkeleton rows={8} />}><DocumentAuditContent /></Suspense>);
}

function DocumentAuditContent() {
  const searchParams = useSearchParams();
  const viewedLogged = useRef(false);
  const [activeKpi, setActiveKpi] = useState<string | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<DocumentAuditEntry | null>(null);
  const [verification, setVerification] = useState<{ valid: boolean; computed: string; stored: string; message?: string } | null>(null);
  const [entityIdFilter, setEntityIdFilter] = useState('');
  const [correlationFilter, setCorrelationFilter] = useState('');

  const {
    entries, paginatedEntries, exports, metrics, charts, users, tamperCount,
    filters, setFilters, loading, refreshing, error, refresh, actor,
    page, setPage, totalPages, pagination,
    inspectionMode, setInspectionMode, canExport, isReadOnly, canView,
  } = useDocumentAuditTrail();

  useEffect(() => {
    if (!viewedLogged.current && !loading && actor.id) {
      viewedLogged.current = true;
      void logDocumentAuditViewed(actor, undefined, inspectionMode);
    }
  }, [loading, actor, inspectionMode]);

  useEffect(() => {
    const kpi = searchParams.get('kpi');
    if (kpi && DAT_KPI_FILTER_MAP[kpi]) {
      setActiveKpi(kpi);
      setFilters((p) => ({ ...p, ...DAT_KPI_FILTER_MAP[kpi] }));
    }
  }, [searchParams, setFilters]);

  const handleSelect = async (entry: DocumentAuditEntry) => {
    setSelectedEntry(entry);
    const local = verifyEntryHash(entry);
    const result = await verifyAuditRecordIntegrity(entry);
    setVerification({ ...local, message: result.message });
  };

  const handleExport = useCallback(async (format: 'csv' | 'excel' | 'pdf') => {
    if (!entries.length) { toast.error('No records to export'); return; }
    try {
      await exportDocumentAuditTrail(entries, { format, include_hash: true }, actor);
      toast.success('Export complete');
      refresh(true);
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Export failed'); }
  }, [entries, actor, refresh]);

  if (!canView) return <ErrorCard message="You do not have access to document audit trail." />;
  if (loading && !entries.length) return <DatSkeleton rows={8} />;
  if (error) return <ErrorCard message={error} onRetry={() => refresh()} />;

  const criticalEvents = getCriticalEvents(entries);
  const esigEvents = entries.filter((e) => e.event_type.includes('Signature') || e.electronic_signature_id);
  const securityEvents = entries.filter((e) => e.event_category === 'Security');
  const configEvents = entries.filter((e) => e.event_type === 'Configuration Changed');
  const entityHistory = entityIdFilter ? getEntityHistory(entries, entityIdFilter.trim()) : [];
  const correlationEvents = correlationFilter ? getCorrelationEvents(entries, correlationFilter.trim()) : [];

  return (
    <div className="space-y-6 animate-in fade-in print:space-y-4">
      <DmsPageHeader
        title="Document Audit Trail"
        description="Maintain immutable, inspection-ready audit records for every controlled document event."
        trail={[{ label: 'Document Audit Trail' }]}
        actions={<>
          <Button variant="outline" size="sm" onClick={() => refresh(true)} disabled={refreshing}>
            <RefreshCw className={cn('h-4 w-4 mr-1', refreshing && 'animate-spin')} /> Refresh
          </Button>
          <Button variant={inspectionMode ? 'default' : 'outline'} size="sm"
            onClick={() => setInspectionMode(!inspectionMode)}>
            <Shield className="h-4 w-4 mr-1" /> Inspection Mode
          </Button>
          {canExport && (<>
            <Button variant="outline" size="sm" onClick={() => handleExport('csv')}><Download className="h-4 w-4 mr-1" /> CSV</Button>
            <Button variant="outline" size="sm" onClick={() => handleExport('excel')}><Download className="h-4 w-4 mr-1" /> Excel</Button>
            <Button variant="outline" size="sm" onClick={() => handleExport('pdf')}><Printer className="h-4 w-4 mr-1" /> Print</Button>
          </>)}
        </>}
      />

      <div className="flex flex-wrap gap-1.5">
        <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700 text-xs">21 CFR Part 11</Badge>
        <Badge variant="outline" className="text-xs">EU GMP Annex 11</Badge>
        <Badge variant="outline" className="text-xs">ALCOA+</Badge>
        <Badge variant="outline" className="text-xs gap-1"><Lock className="h-3 w-3" /> Append-Only</Badge>
      </div>

      {isReadOnly && (
        <Alert><AlertTitle>Read-Only Access</AlertTitle><AlertDescription>Auditor view — records cannot be modified or deleted.</AlertDescription></Alert>
      )}

      {tamperCount > 0 && (
        <Alert variant="destructive">
          <AlertTitle>Tamper Detection Alert</AlertTitle>
          <AlertDescription>{tamperCount} audit record(s) failed hash verification.</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-3 items-center">
            <Input placeholder="Search audit records..." value={filters.search || ''}
              onChange={(e) => { setFilters({ ...filters, search: e.target.value }); setPage(1); }} className="max-w-xs" />
            <select className="rounded-md border bg-background px-3 py-2 text-sm" value={filters.event_type || ''}
              onChange={(e) => { setFilters({ ...filters, event_type: e.target.value || undefined }); setPage(1); }}>
              <option value="">All Event Types</option>
              {AUDIT_EVENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <select className="rounded-md border bg-background px-3 py-2 text-sm" value={filters.event_category || ''}
              onChange={(e) => { setFilters({ ...filters, event_category: e.target.value || undefined }); setPage(1); }}>
              <option value="">All Categories</option>
              {AUDIT_EVENT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select className="rounded-md border bg-background px-3 py-2 text-sm" value={filters.department || ''}
              onChange={(e) => { setFilters({ ...filters, department: e.target.value || undefined }); setPage(1); }}>
              <option value="">All Departments</option>
              {DMS_DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
            <select className="rounded-md border bg-background px-3 py-2 text-sm" value={filters.user_id || ''}
              onChange={(e) => { setFilters({ ...filters, user_id: e.target.value || undefined }); setPage(1); }}>
              <option value="">All Users</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
            <Input type="date" value={filters.start_date || ''} onChange={(e) => setFilters({ ...filters, start_date: e.target.value || undefined })}
              className="max-w-[150px]" />
            <Input type="date" value={filters.end_date || ''} onChange={(e) => setFilters({ ...filters, end_date: e.target.value || undefined })}
              className="max-w-[150px]" />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
        {KPI_ITEMS.map((item) => item.filterKey ? (
          <button key={item.key} type="button" onClick={() => {
            const active = activeKpi === item.filterKey;
            setActiveKpi(active ? null : item.filterKey!);
            setFilters(active ? {} : DAT_KPI_FILTER_MAP[item.filterKey!] || {});
            setPage(1);
          }} className={cn('text-left', activeKpi === item.filterKey && 'ring-2 ring-blue-500 rounded-lg')}>
            <KpiCard label={item.label} value={metrics[item.key]} tone={item.tone} />
          </button>
        ) : (
          <KpiCard key={item.key} label={item.label} value={metrics[item.key]} tone={item.tone} />
        ))}
      </div>

      <DatCharts charts={charts} />

      {selectedEntry && (
        <AuditDetailPanel entry={selectedEntry} verification={verification || undefined} />
      )}

      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Entity History</label>
              <div className="flex gap-2">
                <Input placeholder="Document / Entity ID" value={entityIdFilter} onChange={(e) => setEntityIdFilter(e.target.value)} className="max-w-xs" />
                <Button variant="outline" size="sm"><Search className="h-4 w-4" /></Button>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Correlation ID</label>
              <Input placeholder="Correlation ID" value={correlationFilter} onChange={(e) => setCorrelationFilter(e.target.value)} className="max-w-xs" />
            </div>
          </div>
          {entityHistory.length > 0 && <EntityHistoryViewer events={entityHistory} entityId={entityIdFilter} />}
          {correlationEvents.length > 0 && <CorrelationViewer events={correlationEvents} correlationId={correlationFilter} />}
        </CardContent>
      </Card>

      <Tabs defaultValue="timeline">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="recent">Recent Events</TabsTrigger>
          <TabsTrigger value="critical">Critical ({criticalEvents.length})</TabsTrigger>
          <TabsTrigger value="esignature">E-Signatures ({esigEvents.length})</TabsTrigger>
          <TabsTrigger value="config">Configuration ({configEvents.length})</TabsTrigger>
          <TabsTrigger value="security">Security ({securityEvents.length})</TabsTrigger>
          <TabsTrigger value="exports">Export History ({exports.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="timeline">
          <Card><CardContent className="p-0">
            <AuditTimeline events={paginatedEntries.slice(0, 30)} onSelect={handleSelect} />
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="recent">
          <Card><CardContent className="p-0">
            <AuditTable entries={paginatedEntries} onSelect={handleSelect} />
            {totalPages > 1 && (
              <div className="flex justify-between items-center p-4 border-t text-sm">
                <span className="text-muted-foreground">Page {page} of {totalPages} ({pagination.total} records)</span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
                  <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</Button>
                </div>
              </div>
            )}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="critical"><Card><CardContent className="p-0"><AuditTable entries={criticalEvents.slice(0, 50)} onSelect={handleSelect} /></CardContent></Card></TabsContent>
        <TabsContent value="esignature"><Card><CardContent className="p-0"><AuditTable entries={esigEvents.slice(0, 50)} onSelect={handleSelect} /></CardContent></Card></TabsContent>
        <TabsContent value="config"><Card><CardContent className="p-0"><AuditTable entries={configEvents.slice(0, 50)} onSelect={handleSelect} /></CardContent></Card></TabsContent>
        <TabsContent value="security"><Card><CardContent className="p-0"><AuditTable entries={securityEvents.slice(0, 50)} onSelect={handleSelect} /></CardContent></Card></TabsContent>
        <TabsContent value="exports"><Card><CardContent className="p-0"><ExportHistoryTable records={exports} /></CardContent></Card></TabsContent>
      </Tabs>
    </div>
  );
}
