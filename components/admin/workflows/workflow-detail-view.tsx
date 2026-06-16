'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Pencil } from 'lucide-react';
import { PageHeader } from '@/components/admin/dashboard/page-header';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { EmptyState } from '@/components/admin/dashboard/empty-state';
import { StatusBadge } from '@/components/admin/dashboard/status-badge';
import { ModuleBadge } from './module-badge';
import { WorkflowTypeBadge } from './workflow-type-badge';
import { WorkflowFlowchart } from './workflow-flowchart';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAdminPermissions } from '@/hooks/use-admin-permissions';
import { canEditWorkflows } from '@/lib/permissions';
import type { Workflow, WorkflowStep } from '@/lib/admin/schemas';
import {
  fetchWorkflowById, fetchWorkflowSteps, fetchWorkflowAuditTrail, isWorkflowActive,
} from '@/lib/admin/workflow-service';

export function WorkflowDetailView({ id }: { id: string }) {
  const router = useRouter();
  const { role } = useAdminPermissions();
  const canEdit = canEditWorkflows(role);

  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [steps, setSteps] = useState<WorkflowStep[]>([]);
  const [auditTrail, setAuditTrail] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const w = await fetchWorkflowById(id);
      if (!w) {
        setError('Workflow not found');
        return;
      }
      setWorkflow(w);
      setSteps(await fetchWorkflowSteps(id));
      setAuditTrail(await fetchWorkflowAuditTrail(id));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <LoadingSkeleton rows={2} />;
  if (error || !workflow) return <ErrorCard title="Not Found" message={error || 'Workflow not found'} />;

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={() => router.push('/admin/workflows')}>
        <ArrowLeft className="h-4 w-4 mr-1" />Back to Workflows
      </Button>

      <PageHeader
        title={workflow.workflowName}
        description={workflow.workflowId || workflow.workflowCode}
        basePath="/admin"
        actions={
          canEdit ? (
            <Button asChild className="bg-blue-600 hover:bg-blue-700">
              <Link href={`/admin/workflows/${id}/edit`}><Pencil className="h-4 w-4 mr-1" />Edit Workflow</Link>
            </Button>
          ) : undefined
        }
      />

      <div className="flex flex-wrap gap-2 items-center">
        <ModuleBadge module={workflow.moduleName} />
        <WorkflowTypeBadge type={workflow.workflowType} />
        <StatusBadge status={workflow.status} />
        {!isWorkflowActive(workflow) && (
          <span className="text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded border border-amber-200">
            Inactive — new records cannot use this workflow
          </span>
        )}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Workflow Profile</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          {[
            { label: 'Workflow Code', value: workflow.workflowCode },
            { label: 'Module', value: workflow.moduleName },
            { label: 'Department', value: workflow.department },
            { label: 'Initiator', value: workflow.initiatorRole?.replace(/_/g, ' ') },
            { label: 'Final Approver', value: workflow.finalApproverRole?.replace(/_/g, ' ') },
            { label: 'Escalation Role', value: workflow.escalationRole?.replace(/_/g, ' ') },
            { label: 'Approval Levels', value: workflow.approvalLevels },
            { label: 'Escalation Days', value: workflow.escalationDays },
            { label: 'Target Days', value: workflow.targetCompletionDays },
            { label: 'E-Signature', value: workflow.requireESignature ? 'Required' : 'No' },
            { label: 'Allow Rejection', value: workflow.allowRejection ? 'Yes' : 'No' },
            { label: 'Allow Resubmission', value: workflow.allowResubmission ? 'Yes' : 'No' },
          ].map((f) => (
            <div key={f.label}>
              <p className="text-xs text-muted-foreground">{f.label}</p>
              <p className="font-medium">{String(f.value ?? '-')}</p>
            </div>
          ))}
          {workflow.description && (
            <div className="sm:col-span-2 md:col-span-3">
              <p className="text-xs text-muted-foreground">Description</p>
              <p className="font-medium">{workflow.description}</p>
            </div>
          )}
          {workflow.workflowChain && (
            <div className="sm:col-span-2 md:col-span-3">
              <p className="text-xs text-muted-foreground">Workflow Chain</p>
              <p className="font-medium text-sm">{workflow.workflowChain}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Workflow Flowchart</CardTitle></CardHeader>
        <CardContent>
          <WorkflowFlowchart steps={steps} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Step Details</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {steps.length === 0 ? (
            <EmptyState title="No steps defined" />
          ) : (
            steps.map((step) => (
              <div key={step.id || step.stepNumber} className="flex flex-wrap gap-4 p-3 border rounded text-sm">
                <span className="font-mono text-xs bg-slate-100 px-2 py-0.5 rounded">#{step.stepNumber}</span>
                <span className="font-medium">{step.stepName}</span>
                <span className="text-muted-foreground">{step.stepType}</span>
                <span>{step.assignedRole.replace(/_/g, ' ')}</span>
                <span className="text-xs text-muted-foreground">{step.dueDays}d · {step.department}</span>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Audit Trail</CardTitle></CardHeader>
        <CardContent>
          {auditTrail.length === 0 ? (
            <EmptyState title="No audit entries" />
          ) : (
            <div className="space-y-2">
              {auditTrail.map((entry, i) => (
                <div key={i} className="flex flex-col sm:flex-row sm:items-center gap-1 p-2 border rounded text-sm">
                  <span className="font-medium">{String(entry.action ?? '-')}</span>
                  <span className="text-xs text-muted-foreground">
                    {String(entry.userName ?? entry.actorName ?? '-')} · {String(entry.timestamp ?? entry.dateTime ?? '-')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
