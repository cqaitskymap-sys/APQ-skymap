'use client';

import { useCallback, useState } from 'react';
import { RefreshCw, Plus, FileCheck, PenLine } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { KpiCard } from '@/components/cpv/cpv-ui';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { ResponsiveDataTable } from '@/components/cpv/product-master/responsive-data-table';
import type { ColumnDef } from '@/components/admin/admin-data-table';
import { TmsPageHeader } from '@/components/training/tms-page-header';
import { TmsStatusBadge } from '@/components/training/tms-sub-nav';
import { useCompanyTraining } from '@/hooks/use-company-training';
import { createSrdDeclaration, signSrdDeclaration, approveSrdDeclaration } from '@/lib/company-training-service';
import { SRD_MIN_DESIGNATIONS } from '@/lib/company-training-types';
import type { SrdDeclaration } from '@/lib/company-training-types';

export function SrdPage() {
  const { data, loading, error, refresh, refreshing, actor, canManage } = useCompanyTraining();
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    employee_name: '', department: '', designation: 'Assistant Manager',
    document_number: '', document_title: '', document_version: '1.0',
  });

  const handleCreate = useCallback(async () => {
    if (!form.document_number) return toast.error('Document number required');
    try {
      await createSrdDeclaration(actor, {
        ...form,
        employee_id: actor.id,
        employee_name: actor.name,
        department: actor.department ?? form.department,
      });
      toast.success('SRD created — pending employee declaration');
      setCreateOpen(false);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to create SRD');
    }
  }, [actor, form, refresh]);

  const handleSign = useCallback(async (id: string) => {
    try {
      await signSrdDeclaration(actor, id);
      toast.success('Declaration signed');
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to sign');
    }
  }, [actor, refresh]);

  const handleApprove = useCallback(async (id: string) => {
    try {
      await approveSrdDeclaration(actor, id);
      toast.success('SRD approved by QA');
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to approve');
    }
  }, [actor, refresh]);

  const columns: ColumnDef<SrdDeclaration>[] = [
    { key: 'number', header: 'SRD #', render: (r) => r.declaration_number },
    { key: 'employee', header: 'Employee', render: (r) => r.employee_name },
    { key: 'desig', header: 'Designation', render: (r) => r.designation },
    { key: 'dept', header: 'Department', render: (r) => r.department },
    { key: 'doc', header: 'Document', render: (r) => r.document_number },
    { key: 'version', header: 'Version', render: (r) => r.document_version },
    { key: 'signed', header: 'Signed', render: (r) => r.employee_signed_date || '—' },
    { key: 'status', header: 'Status', render: (r) => <TmsStatusBadge status={r.status} /> },
    {
      key: 'actions', header: 'Actions',
      render: (r) => {
        if (r.status === 'Pending Declaration' && r.employee_id === actor.id) {
          return (
            <Button size="sm" variant="outline" onClick={() => handleSign(r.id)}>
              <PenLine className="h-3 w-3 mr-1" /> Sign
            </Button>
          );
        }
        if (r.status === 'Declared' && canManage) {
          return (
            <Button size="sm" variant="outline" onClick={() => handleApprove(r.id)}>
              <FileCheck className="h-3 w-3 mr-1" /> QA Approve
            </Button>
          );
        }
        return null;
      },
    },
  ];

  if (loading) return <LoadingSkeleton rows={6} />;
  if (error) return <ErrorCard message={error} onRetry={refresh} />;

  const srds = data?.srdDeclarations ?? [];

  return (
    <div>
      <TmsPageHeader
        title="Self Reading Declaration (SRD)"
        description="SRD for Assistant Manager & above — employee declares document read & understood"
        trail={[{ label: 'Company Program', href: '/training/company-program' }, { label: 'SRD' }]}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => refresh()} disabled={refreshing}>
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
            </Button>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-2" /> New SRD
            </Button>
          </div>
        }
      />

      <Alert className="mb-6">
        <FileCheck className="h-4 w-4" />
        <AlertTitle>SRD Applicability</AlertTitle>
        <AlertDescription>
          Self Reading Declaration is mandatory for: {SRD_MIN_DESIGNATIONS.join(', ')}.
          Employee must read the SOP/document and sign the declaration. QA reviews and approves.
        </AlertDescription>
      </Alert>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <KpiCard label="Pending Declaration" value={data?.pendingSrdDeclarations ?? 0} tone="amber" />
        <KpiCard label="Approved" value={data?.srdApproved ?? 0} tone="green" />
        <KpiCard label="Total SRD" value={srds.length} tone="blue" />
        <KpiCard label="Min Level" value="Asst Mgr+" tone="blue" />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Self Reading Declarations</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveDataTable columns={columns} data={srds} />
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Self Reading Declaration</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Employee Name</Label>
              <Input value={actor.name} disabled />
            </div>
            <div>
              <Label>Designation</Label>
              <Input value={form.designation}
                onChange={(e) => setForm({ ...form, designation: e.target.value })} />
            </div>
            <div>
              <Label>Department</Label>
              <Input value={form.department}
                onChange={(e) => setForm({ ...form, department: e.target.value })} />
            </div>
            <div>
              <Label>Document / SOP Number</Label>
              <Input value={form.document_number}
                onChange={(e) => setForm({ ...form, document_number: e.target.value })} />
            </div>
            <div>
              <Label>Document Title</Label>
              <Input value={form.document_title}
                onChange={(e) => setForm({ ...form, document_title: e.target.value })} />
            </div>
            <div>
              <Label>Version</Label>
              <Input value={form.document_version}
                onChange={(e) => setForm({ ...form, document_version: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate}>Create SRD</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
