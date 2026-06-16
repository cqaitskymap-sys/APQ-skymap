'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { WorkflowAccessGuard } from '@/components/admin/workflows/workflow-access-guard';
import { WorkflowForm } from '@/components/admin/workflows/workflow-form';
import { PageHeader } from '@/components/admin/dashboard/page-header';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { useAuth } from '@/contexts/auth-context';
import { useAdminPermissions } from '@/hooks/use-admin-permissions';
import { canEditWorkflows } from '@/lib/permissions';
import { createWorkflow } from '@/lib/admin/workflow-service';
import { fetchRoles } from '@/lib/admin/role-service';
import type { WorkflowFormData } from '@/lib/admin/schemas';

function CreateWorkflowContent() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const { role } = useAdminPermissions();
  const [roles, setRoles] = useState<{ id: string; name: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchRoles().then((r) => setRoles(r.map((x) => ({ id: x.roleId || x.id || '', name: x.roleName || x.roleId || '' }))));
  }, []);

  if (!canEditWorkflows(role)) {
    return <ErrorCard accessDenied message="You do not have permission to create workflows." />;
  }

  const onSubmit = async (data: WorkflowFormData) => {
    setSubmitting(true);
    const result = await createWorkflow(data, {
      userId: user?.uid || 'system',
      userName: profile?.full_name || profile?.email || 'Admin',
    });
    setSubmitting(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success('Workflow created');
    router.push(`/admin/workflows/${result.workflow?.id}`);
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Create Workflow" description="Configure approval chain for a QMS module" basePath="/admin" />
      <WorkflowForm roles={roles} onSubmit={onSubmit} onCancel={() => router.push('/admin/workflows')} submitting={submitting} />
    </div>
  );
}

export default function CreateWorkflowPage() {
  return (
    <WorkflowAccessGuard>
      <CreateWorkflowContent />
    </WorkflowAccessGuard>
  );
}
