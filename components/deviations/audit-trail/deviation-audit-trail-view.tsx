'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FileSpreadsheet, FileText, Lock, Search } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/auth-context';
import {
  DEVIATION_AUDIT_ACTION_TYPES,
  applyDeviationAuditFilters,
  canExportDeviationAuditTrail,
  exportDeviationAuditCsv,
  isDeviationAuditReadOnly,
  type DeviationAuditEntry,
  type DeviationAuditFilters,
} from '@/lib/deviation-audit-trail-records';
import {
  getFilteredDeviationAuditTrail,
  logDeviationAuditExport,
  logDeviationAuditPreviewed,
  openDeviationAuditPdfReport,
} from '@/lib/deviation-audit-trail-service';
import { getDeviationById } from '@/lib/deviation-service';
import { downloadCsv } from '@/lib/export-utils';
import { CpvPageHeader } from '@/components/cpv/product-master/cpv-page-header';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { EmptyState } from '@/components/admin/dashboard/empty-state';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { DeviationAuditTimeline } from './deviation-audit-timeline';
import { DeviationAuditTable } from './deviation-audit-table';
import { DeviationAuditTrailAccessGuard } from './deviation-audit-trail-access-guard';
import { DeviationStatusBadge, DeviationCriticalityBadge } from '@/components/deviations/deviation-sub-nav';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import type { DeviationRecord } from '@/lib/deviation-types';

interface DeviationAuditTrailViewProps {
  deviationId: string;
  compact?: boolean;
  showHeader?: boolean;
}

export function DeviationAuditTrailView({
  deviationId,
  compact,
  showHeader = true,
}: DeviationAuditTrailViewProps) {
  const { user, profile } = useAuth();
  const role = profile?.role;
  const canExport = canExportDeviationAuditTrail(role);
  const readOnly = isDeviationAuditReadOnly(role);

  const [record, setRecord] = useState<DeviationRecord | null>(null);
  const [allEntries, setAllEntries] = useState<DeviationAuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const previewLogged = useRef(false);

  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const actor = useMemo(() => ({
    id: user?.uid || 'system',
    name: profile?.full_name || 'System',
    role: role || '',
    department: profile?.department || '',
  }), [user?.uid, profile?.full_name, profile?.department, role]);

  const filters: DeviationAuditFilters = useMemo(() => ({
    search,
    action_type: actionFilter,
    start_date: startDate,
    end_date: endDate,
  }), [search, actionFilter, startDate, endDate]);

  const load = useCallback(async () => {
    if (!deviationId) {
      setError('Deviation ID is required');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const dev = await getDeviationById(deviationId);
      if (!dev) {
        setError('Deviation not found');
        setRecord(null);
        setAllEntries([]);
        return;
      }
      setRecord(dev);
      const rows = await getFilteredDeviationAuditTrail({
        deviationId,
        deviationNumber: dev.deviation_number,
        role,
        userDepartment: profile?.department,
        userId: user?.uid,
      });
      setAllEntries(rows);
    } catch {
      setError('Failed to load audit trail.');
    } finally {
      setLoading(false);
    }
  }, [deviationId, role, profile?.department, user?.uid]);

  useEffect(() => { void load(); }, [load]);

  const entries = useMemo(
    () => applyDeviationAuditFilters(allEntries, filters),
    [allEntries, filters],
  );

  useEffect(() => {
    if (record && !compact && !previewLogged.current) {
      previewLogged.current = true;
      void logDeviationAuditPreviewed(actor, deviationId, record.deviation_number);
    }
  }, [record, compact, actor, deviationId]);

  const users = useMemo(() => {
    const set = new Set(entries.map((e) => e.changed_by_name).filter(Boolean));
    return Array.from(set).sort();
  }, [entries]);

  const handleExportPdf = async () => {
    if (!canExport) return toast.error('No export permission');
    if (!record) return;
    openDeviationAuditPdfReport(entries, record.deviation_number, actor.name, filters);
    await logDeviationAuditExport(actor, deviationId, record.deviation_number, 'PDF', entries.length);
    toast.success('PDF export placeholder opened (audit logged)');
  };

  const handleExportExcel = async () => {
    if (!canExport) return toast.error('No export permission');
    if (!record) return;
    const { headers, rows } = exportDeviationAuditCsv(entries);
    downloadCsv(`${record.deviation_number}-audit-trail.csv`, headers, rows);
    await logDeviationAuditExport(actor, deviationId, record.deviation_number, 'Excel', entries.length);
    toast.success('Excel export downloaded (audit logged)');
  };

  const content = (
    <div className="space-y-4">
      {showHeader && record && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono font-bold text-lg">{record.deviation_number}</span>
          <DeviationStatusBadge status={record.status} />
          <DeviationCriticalityBadge criticality={record.criticality} />
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground border rounded-full px-2 py-0.5">
            <Lock className="h-3 w-3" /> Read-only · Append-only audit log
          </span>
        </div>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filters</CardTitle>
          {!compact && (
            <CardDescription>Search by field, action, or user. Audit records cannot be edited or deleted.</CardDescription>
          )}
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1 sm:col-span-2">
            <Label>Search</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Field, action, user, value..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Action Type</Label>
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                {DEVIATION_AUDIT_ACTION_TYPES.map((a) => (
                  <SelectItem key={a} value={a}>{a}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>From Date</Label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>To Date</Label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          {canExport && (
            <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-4">
              <Button variant="outline" size="sm" onClick={() => void handleExportPdf()}>
                <FileText className="mr-1 h-4 w-4" /> Export PDF
              </Button>
              <Button variant="outline" size="sm" onClick={() => void handleExportExcel()}>
                <FileSpreadsheet className="mr-1 h-4 w-4" /> Export Excel
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {loading ? (
        <LoadingSkeleton rows={3} />
      ) : error ? (
        <ErrorCard title="Load error" message={error} />
      ) : !entries.length ? (
        <EmptyState
          title="No audit trail entries"
          message="No activity has been logged for this deviation yet, or filters exclude all records."
        />
      ) : (
        <Tabs defaultValue="timeline">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <TabsList>
              <TabsTrigger value="timeline">Timeline</TabsTrigger>
              <TabsTrigger value="table">Table</TabsTrigger>
            </TabsList>
            <p className="text-xs text-muted-foreground">{entries.length} record(s) · {users.length} user(s)</p>
          </div>
          <TabsContent value="timeline" className="mt-4">
            <DeviationAuditTimeline entries={entries} />
          </TabsContent>
          <TabsContent value="table" className="mt-4">
            <DeviationAuditTable entries={entries} compact={compact} />
          </TabsContent>
        </Tabs>
      )}

      {readOnly && (
        <p className="text-xs text-muted-foreground text-center">Auditor access: read-only. Export permitted when authorized.</p>
      )}
    </div>
  );

  if (compact) return content;

  return (
    <DeviationAuditTrailAccessGuard>
      <div className="space-y-6">
        <CpvPageHeader
          title="Deviation Audit Trail"
          description="Complete read-only audit trail and activity timeline — 21 CFR Part 11 compliant"
          trail={[
            { label: 'QMS', href: '/qms/deviation' },
            { label: 'Deviation Management', href: '/qms/deviation' },
            { label: record?.deviation_number || 'Audit Trail' },
          ]}
        />
        {content}
      </div>
    </DeviationAuditTrailAccessGuard>
  );
}

export function DeviationAuditTrailListPage() {
  const { user, profile } = useAuth();
  const role = profile?.role;

  const [entries, setEntries] = useState<DeviationAuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        const rows = await getFilteredDeviationAuditTrail({
          role,
          userDepartment: profile?.department,
          userId: user?.uid,
          filters: { search },
        });
        setEntries(rows);
      } catch {
        setError('Failed to load deviation audit trail.');
      } finally {
        setLoading(false);
      }
    })();
  }, [role, profile?.department, user?.uid, search]);

  return (
    <DeviationAuditTrailAccessGuard>
      <div className="space-y-6">
        <CpvPageHeader
          title="Deviation Audit Trail"
          description="Browse deviation-related audit events across the QMS module"
          trail={[
            { label: 'QMS', href: '/qms/deviation' },
            { label: 'Deviation Management', href: '/qms/deviation' },
            { label: 'Audit Trail' },
          ]}
        />

        <Card>
          <CardContent className="pt-6">
            <div className="relative max-w-md">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-8" placeholder="Search deviations, actions, users..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </CardContent>
        </Card>

        {loading ? <LoadingSkeleton rows={3} /> : error ? (
          <ErrorCard title="Load error" message={error} />
        ) : entries.length ? (
          <DeviationAuditTable entries={entries.slice(0, 100)} />
        ) : (
          <EmptyState title="No audit entries" message="Deviation audit activity will appear here as actions are performed." />
        )}
      </div>
    </DeviationAuditTrailAccessGuard>
  );
}
