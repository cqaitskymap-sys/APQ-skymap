'use client';

import { useCallback, useState } from 'react';
import { RefreshCw, Plus, FileText, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { KpiCard } from '@/components/cpv/cpv-ui';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { ResponsiveDataTable } from '@/components/cpv/product-master/responsive-data-table';
import type { ColumnDef } from '@/components/admin/admin-data-table';
import { TmsPageHeader } from '@/components/training/tms-page-header';
import { TmsStatusBadge } from '@/components/training/tms-sub-nav';
import { useCompanyTraining } from '@/hooks/use-company-training';
import {
  listJobDescriptions, createTniFromJd, approveTni,
} from '@/lib/company-training-service';
import type { TniRecord, JobDescription } from '@/lib/company-training-types';

export function TniPage() {
  const { data, loading, error, refresh, refreshing, actor, canManageTni } = useCompanyTraining();
  const [jds, setJds] = useState<JobDescription[]>([]);
  const [jdsLoaded, setJdsLoaded] = useState(false);

  const loadJds = useCallback(async () => {
    const list = await listJobDescriptions();
    setJds(list);
    setJdsLoaded(true);
  }, []);

  const handleCreateTni = useCallback(async (jd: JobDescription) => {
    try {
      await createTniFromJd(actor, jd);
      toast.success(`TNI created from ${jd.jd_number}`);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to create TNI');
    }
  }, [actor, refresh]);

  const handleApprove = useCallback(async (id: string) => {
    try {
      await approveTni(actor, id);
      toast.success('TNI approved');
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to approve');
    }
  }, [actor, refresh]);

  const tniColumns: ColumnDef<TniRecord>[] = [
    { key: 'number', header: 'TNI #', render: (r) => r.tni_number },
    { key: 'jd', header: 'JD #', render: (r) => r.jd_number },
    { key: 'dept', header: 'Department', render: (r) => r.department },
    { key: 'desig', header: 'Designation', render: (r) => r.designation },
    { key: 'employee', header: 'Employee', render: (r) => r.employee_name || '—' },
    { key: 'needs', header: 'Training Needs', render: (r) => <Badge variant="secondary">{r.training_needs.length} SOPs</Badge> },
    { key: 'mapped', header: 'SOP Mapped', render: (r) => r.sop_mapped ? <CheckCircle className="h-4 w-4 text-green-600" /> : '—' },
    { key: 'status', header: 'Status', render: (r) => <TmsStatusBadge status={r.status} /> },
    {
      key: 'actions', header: 'Actions',
      render: (r) => r.status === 'Pending Review' && canManageTni ? (
        <Button size="sm" variant="outline" onClick={() => handleApprove(r.id)}>Approve</Button>
      ) : null,
    },
  ];

  const jdColumns: ColumnDef<JobDescription>[] = [
    { key: 'number', header: 'JD #', render: (r) => r.jd_number },
    { key: 'dept', header: 'Department', render: (r) => r.department },
    { key: 'desig', header: 'Designation', render: (r) => r.designation },
    { key: 'role', header: 'Role', render: (r) => r.role_title },
    {
      key: 'sops', header: 'Linked SOPs',
      render: (r) => (
        <div className="flex flex-wrap gap-1">
          {r.linked_sops.map((s) => (
            <Badge key={s.sop_number} variant="outline" className="text-xs">{s.sop_number}</Badge>
          ))}
        </div>
      ),
    },
    { key: 'status', header: 'Status', render: (r) => <TmsStatusBadge status={r.status} /> },
    {
      key: 'actions', header: 'Actions',
      render: (r) => canManageTni ? (
        <Button size="sm" variant="outline" onClick={() => handleCreateTni(r)}>
          <Plus className="h-3 w-3 mr-1" /> Create TNI
        </Button>
      ) : null,
    },
  ];

  if (loading) return <LoadingSkeleton rows={6} />;
  if (error) return <ErrorCard message={error} onRetry={refresh} />;

  const tnis = data?.tniRecords ?? [];

  return (
    <div>
      <TmsPageHeader
        title="Training Needs Identification (TNI)"
        description="Department TC prepares JD → based on JD, TNI is prepared → SOP mapping → training assignment"
        trail={[{ label: 'Company Program', href: '/training/company-program' }, { label: 'TNI' }]}
        actions={
          <Button variant="outline" size="sm" onClick={() => refresh()} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <KpiCard label="Active TNI" value={data?.activeTniRecords ?? 0} tone="blue" />
        <KpiCard label="SOP Mapped" value={data?.sopMappedTni ?? 0} tone="green" />
        <KpiCard label="Job Descriptions" value={jds.length || '—'} tone="blue" />
        <KpiCard label="Total TNI Records" value={tnis.length} tone="amber" />
      </div>

      <Tabs defaultValue="tni" onValueChange={(v) => { if (v === 'jd' && !jdsLoaded) loadJds(); }}>
        <TabsList>
          <TabsTrigger value="tni"><FileText className="h-4 w-4 mr-1" /> TNI Records</TabsTrigger>
          <TabsTrigger value="jd"><FileText className="h-4 w-4 mr-1" /> Job Descriptions</TabsTrigger>
        </TabsList>

        <TabsContent value="tni" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">TNI Records</CardTitle></CardHeader>
            <CardContent>
              {tnis.length > 0 ? (
                <ResponsiveDataTable columns={tniColumns} data={tnis} />
              ) : (
                <p className="text-sm text-muted-foreground">No TNI records yet. Create from a Job Description.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="jd" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Job Descriptions (JD)</CardTitle></CardHeader>
            <CardContent>
              {jds.length > 0 ? (
                <ResponsiveDataTable columns={jdColumns} data={jds} />
              ) : (
                <p className="text-sm text-muted-foreground">Loading job descriptions...</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
