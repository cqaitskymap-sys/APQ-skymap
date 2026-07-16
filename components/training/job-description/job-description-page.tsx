'use client';

import { useCallback, useState } from 'react';
import { RefreshCw, Plus, FileText, CheckCircle, UserCheck } from 'lucide-react';
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
import { listJobDescriptions, createTniFromJd, approveTni } from '@/lib/company-training-service';
import { JR_ASSIGNMENT_WORKFLOW_STEPS } from '@/lib/enterprise-tms/modules';
import type { TniRecord, JobDescription } from '@/lib/company-training-types';

export function JobDescriptionPage() {
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
      toast.success(`JR training schedule initiated from ${jd.jd_number}`);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  }, [actor, refresh]);

  const handleApprove = useCallback(async (id: string) => {
    try {
      await approveTni(actor, id);
      toast.success('JD approved');
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to approve');
    }
  }, [actor, refresh]);

  const tniColumns: ColumnDef<TniRecord>[] = [
    { key: 'number', header: 'JR #', render: (r) => r.tni_number },
    { key: 'jd', header: 'JD #', render: (r) => r.jd_number },
    { key: 'dept', header: 'Department', render: (r) => r.department },
    { key: 'employee', header: 'Employee', render: (r) => r.employee_name || '—' },
    { key: 'needs', header: 'Functional Roles', render: (r) => <Badge variant="secondary">{r.training_needs.length}</Badge> },
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
    { key: 'role', header: 'Job Role', render: (r) => r.role_title },
    {
      key: 'sops', header: 'Linked Documents',
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
      render: (r) => canManageTni && r.status === 'Active' ? (
        <Button size="sm" variant="outline" onClick={() => handleCreateTni(r)}>
          <Plus className="h-3 w-3 mr-1" /> Assign JR Training
        </Button>
      ) : null,
    },
  ];

  if (loading) return <LoadingSkeleton rows={6} />;
  if (error) return <ErrorCard message={error} onRetry={refresh} />;

  const tnis = data?.tniRecords ?? [];
  const pendingApproval = jds.filter((j) => j.status === 'Draft').length;
  const accepted = jds.filter((j) => j.status === 'Active').length;

  return (
    <div className="space-y-6 animate-in fade-in">
      <TmsPageHeader
        title="Job Description & JR Assignment"
        description="JD template, assignment to trainee, approver review, employee acceptance, auto-assign BU/dept training (RS-LMS-FSR-023 to 029)"
        trail={[{ label: 'Programs' }, { label: 'Job Description & JR' }]}
        actions={
          <Button variant="outline" size="sm" onClick={() => refresh()} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Job Descriptions" value={jdsLoaded ? jds.length : '—'} tone="blue" />
        <KpiCard label="Pending Approval" value={pendingApproval} tone="amber" />
        <KpiCard label="Employee Accepted" value={accepted} tone="green" />
        <KpiCard label="JR Assignments" value={tnis.length} tone="blue" />
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">JR Assignment Workflow</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-1">
            {JR_ASSIGNMENT_WORKFLOW_STEPS.map((step, i) => (
              <Badge key={step} variant={i < 4 ? 'default' : 'outline'} className="text-[10px]">{step}</Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="jd" onValueChange={(v) => { if (v === 'jd' && !jdsLoaded) loadJds(); if (v === 'jr' && !jdsLoaded) loadJds(); }}>
        <TabsList>
          <TabsTrigger value="jd"><FileText className="h-4 w-4 mr-1" /> Job Descriptions</TabsTrigger>
          <TabsTrigger value="jr"><UserCheck className="h-4 w-4 mr-1" /> JR Assignments</TabsTrigger>
        </TabsList>

        <TabsContent value="jd" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">JD Templates & Assignments</CardTitle></CardHeader>
            <CardContent>
              {jdsLoaded && jds.length > 0 ? (
                <ResponsiveDataTable columns={jdColumns} data={jds} />
              ) : (
                <p className="text-sm text-muted-foreground">
                  {jdsLoaded ? 'No job descriptions. Training Coordinator creates JD after induction completion.' : 'Loading...'}
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="jr" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">JR Training Assignments</CardTitle></CardHeader>
            <CardContent>
              {tnis.length > 0 ? (
                <ResponsiveDataTable columns={tniColumns} data={tnis} />
              ) : (
                <p className="text-sm text-muted-foreground">
                  No JR assignments yet. After employee accepts JD, BU/dept training is auto-assigned per matrix.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
