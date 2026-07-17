'use client';

import { useCallback, useState } from 'react';
import { Plus, RefreshCw, Link2, AlertTriangle, Map, GitMerge } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { KpiCard } from '@/components/cpv/cpv-ui';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { EmptyState } from '@/components/admin/dashboard/empty-state';
import { ResponsiveDataTable } from '@/components/cpv/product-master/responsive-data-table';
import type { ColumnDef } from '@/components/admin/admin-data-table';
import { TmsPageHeader } from '@/components/training/tms-page-header';
import { useLmsIntegration } from '@/hooks/use-lms';
import { testConnection, updateConnectionFieldMappings } from '@/lib/lms-service';
import { formatSyncDuration } from '@/lib/lms-types';
import type { LmsCourse, TrainingCertificate } from '@/lib/lms-types';
import { ConnectionCard } from './connection-card';
import { ConnectionWizard } from './connection-wizard';
import { SyncJobTable } from './sync-job-table';
import { FieldMappingDialog } from './field-mapping-dialog';
import { ConflictResolutionDialog } from './conflict-resolution-dialog';
import { SyncProgress } from './sync-progress';
import { IntegrationLogViewer } from './integration-log-viewer';
import { LmsDashboardCharts } from './lms-dashboard-charts';
import { LmsStatusBadge } from './status-badge';

const KPI_CONFIG = [
  { label: 'Connected LMS', key: 'connectedLms' as const, tone: 'blue' as const },
  { label: 'Courses Imported', key: 'coursesImported' as const, tone: 'blue' as const },
  { label: 'Users Synced', key: 'usersSynced' as const, tone: 'green' as const },
  { label: 'Assignments Synced', key: 'assignmentsSynced' as const, tone: 'green' as const },
  { label: 'Certificates Imported', key: 'certificatesImported' as const, tone: 'green' as const },
  { label: 'Failed Syncs', key: 'failedSyncs' as const, tone: 'red' as const },
  { label: 'Pending Sync Jobs', key: 'pendingSyncJobs' as const, tone: 'amber' as const },
  { label: "Today's Sync Jobs", key: 'todaysSyncJobs' as const, tone: 'blue' as const },
];

export function LmsIntegrationPage() {
  const {
    data, loading, refreshing, error, actor, syncing,
    conflicts, refresh, triggerSync, retrySync, loadConflicts,
    canView, canSync, canManage, isReadOnly,
  } = useLmsIntegration();

  const [wizardOpen, setWizardOpen] = useState(false);
  const [mappingOpen, setMappingOpen] = useState(false);
  const [conflictOpen, setConflictOpen] = useState(false);
  const [selectedConnection, setSelectedConnection] = useState<string | null>(null);

  const handleTest = useCallback(async (id: string) => {
    try {
      const result = await testConnection(id, actor);
      toast[result.success ? 'success' : 'error'](result.message);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Connection test failed');
    }
  }, [actor, refresh]);

  const handleSync = useCallback(async (id: string) => {
    try {
      await triggerSync(id);
      toast.success('Sync completed');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Sync failed');
    }
  }, [triggerSync]);

  const handleConflicts = useCallback(async (connectionId: string) => {
    setSelectedConnection(connectionId);
    await loadConflicts(connectionId);
    setConflictOpen(true);
  }, [loadConflicts]);

  const courseColumns: ColumnDef<LmsCourse>[] = [
    { key: 'course_code', header: 'Code', render: (c) => c.course_code },
    { key: 'course_title', header: 'Title', render: (c) => c.course_title },
    { key: 'course_type', header: 'Type', render: (c) => c.course_type },
    { key: 'status', header: 'Status', render: (c) => <LmsStatusBadge status={c.status} /> },
    { key: 'imported_at', header: 'Imported', render: (c) => new Date(c.imported_at).toLocaleDateString() },
  ];

  const certColumns: ColumnDef<TrainingCertificate>[] = [
    { key: 'certificate_number', header: 'Certificate #', render: (c) => c.certificate_number },
    { key: 'employee_name', header: 'Employee', render: (c) => c.employee_name },
    { key: 'course_title', header: 'Course', render: (c) => c.course_title },
    { key: 'issued_date', header: 'Issued', render: (c) => new Date(c.issued_date).toLocaleDateString() },
  ];

  if (!canView) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Access Denied</AlertTitle>
        <AlertDescription>
          You do not have permission to view LMS Integration. Contact your Training Coordinator or QA Administrator.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <TmsPageHeader
        title="LMS Integration"
        description="Connect enterprise LMS platforms for automated GMP training synchronization."
        trail={[{ label: 'LMS Integration' }]}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={refresh} disabled={refreshing}>
              <RefreshCw className={`h-4 w-4 mr-1 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
            </Button>
            {canManage && (
              <Button onClick={() => setWizardOpen(true)}>
                <Plus className="h-4 w-4 mr-1" /> Add Connection
              </Button>
            )}
          </div>
        }
      />

      {isReadOnly && (
        <Alert>
          <AlertTitle>Read-Only Mode</AlertTitle>
          <AlertDescription>Auditor access — view only. Sync and configuration changes are disabled.</AlertDescription>
        </Alert>
      )}

      {error && <ErrorCard message={error} onRetry={refresh} />}

      {syncing && (
        <SyncProgress
          progress={{
            jobId: syncing,
            status: 'Running',
            progress: 50,
            currentStep: 'Synchronizing LMS data…',
            recordsProcessed: 0,
            recordsImported: 0,
            recordsSkipped: 0,
            recordsFailed: 0,
          }}
        />
      )}

      {loading ? (
        <LoadingSkeleton rows={6} />
      ) : data ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-5 gap-3">
            {KPI_CONFIG.map(({ label, key, tone }) => (
              <KpiCard key={key} label={label} value={data.kpis[key]} tone={tone} />
            ))}
            <KpiCard
              label="Avg Sync Duration"
              value={formatSyncDuration(data.kpis.averageSyncDurationMs)}
              tone="blue"
            />
          </div>

          <LmsDashboardCharts charts={data.charts} />

          <Tabs defaultValue="connections" className="space-y-4">
            <TabsList className="flex flex-wrap h-auto gap-1">
              <TabsTrigger value="connections"><Link2 className="h-3.5 w-3.5 mr-1" />Connections</TabsTrigger>
              <TabsTrigger value="sync-jobs">Sync Jobs</TabsTrigger>
              <TabsTrigger value="failed">Failed Jobs</TabsTrigger>
              <TabsTrigger value="courses">Courses</TabsTrigger>
              <TabsTrigger value="certificates">Certificates</TabsTrigger>
              <TabsTrigger value="logs">Integration Logs</TabsTrigger>
            </TabsList>

            <TabsContent value="connections" className="space-y-4">
              {data.connections.length === 0 ? (
                <>
                  <EmptyState
                    title="No LMS connections"
                    message="Add a connection to start synchronizing training data from your enterprise LMS."
                  />
                  {canManage && (
                    <div className="flex justify-center -mt-6">
                      <Button onClick={() => setWizardOpen(true)}><Plus className="h-4 w-4 mr-1" />Add Connection</Button>
                    </div>
                  )}
                </>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {data.connections.map((conn) => (
                    <ConnectionCard
                      key={conn.id}
                      connection={conn}
                      onTest={handleTest}
                      onSync={handleSync}
                      onEdit={(id) => { setSelectedConnection(id); setMappingOpen(true); }}
                      syncing={!!syncing}
                      canSync={canSync && !isReadOnly}
                    />
                  ))}
                </div>
              )}
              {canSync && data.connections.length > 0 && (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => selectedConnection && handleConflicts(selectedConnection)} disabled={!selectedConnection}>
                    <GitMerge className="h-3.5 w-3.5 mr-1" /> Resolve Conflicts
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setMappingOpen(true)}>
                    <Map className="h-3.5 w-3.5 mr-1" /> Field Mapping
                  </Button>
                </div>
              )}
            </TabsContent>

            <TabsContent value="sync-jobs">
              <SyncJobTable
                jobs={data.recentSyncJobs}
                onRetry={canSync ? retrySync : undefined}
                canSync={canSync && !isReadOnly}
                syncing={syncing}
              />
            </TabsContent>

            <TabsContent value="failed">
              <SyncJobTable
                jobs={data.failedSyncJobs}
                onRetry={canSync ? retrySync : undefined}
                canSync={canSync && !isReadOnly}
                syncing={syncing}
              />
            </TabsContent>

            <TabsContent value="courses">
              <ResponsiveDataTable
                data={data.courses}
                columns={courseColumns}
                emptyMessage="No imported courses"
                searchKeys={['course_code', 'course_title']}
                mobileTitleKey="course_title"
                mobileSubtitleKey="course_code"
              />
            </TabsContent>

            <TabsContent value="certificates">
              <ResponsiveDataTable
                data={data.certificates}
                columns={certColumns}
                emptyMessage="No imported certificates"
                searchKeys={['certificate_number', 'employee_name', 'course_title']}
                mobileTitleKey="course_title"
                mobileSubtitleKey="employee_name"
              />
            </TabsContent>

            <TabsContent value="logs">
              <IntegrationLogViewer logs={data.logs} />
            </TabsContent>
          </Tabs>

          <Card className="border-blue-100 bg-blue-50/30 dark:bg-blue-950/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">GMP Compliance Notes</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground space-y-1">
              <p>All LMS sync operations generate audit trail entries for 21 CFR Part 11 compliance.</p>
              <p>Duplicate records are detected by external ID and employee email/ID matching.</p>
              <p>Failed sync jobs are retried automatically up to 3 times with failure notifications.</p>
            </CardContent>
          </Card>
        </>
      ) : null}

      {canManage && (
        <ConnectionWizard
          open={wizardOpen}
          onOpenChange={setWizardOpen}
          actor={actor}
          onSuccess={refresh}
        />
      )}

      <FieldMappingDialog
        open={mappingOpen}
        onOpenChange={setMappingOpen}
        mappings={data?.connections.find((c) => c.id === selectedConnection)?.field_mappings ?? []}
        onSave={async (mappings) => {
          if (!selectedConnection) throw new Error('Select an LMS connection first');
          try {
            await updateConnectionFieldMappings(selectedConnection, mappings, actor);
            toast.success('Field mappings saved');
            await refresh();
          } catch (cause) {
            toast.error(cause instanceof Error ? cause.message : 'Failed to save field mappings');
            throw cause;
          }
        }}
      />

      <ConflictResolutionDialog
        open={conflictOpen}
        onOpenChange={setConflictOpen}
        conflicts={conflicts}
        actor={actor}
        onResolved={refresh}
      />
    </div>
  );
}
