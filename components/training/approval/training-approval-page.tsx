'use client';

import { useCallback, useState } from 'react';
import { Plus, RefreshCw, CheckCircle, XCircle, AlertTriangle, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { KpiCard } from '@/components/cpv/cpv-ui';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { ResponsiveDataTable } from '@/components/cpv/product-master/responsive-data-table';
import type { ColumnDef } from '@/components/admin/admin-data-table';
import { TmsPageHeader } from '@/components/training/tms-page-header';
import { ApprovalInbox } from './approval-inbox';
import { FilterPanel } from './filter-panel';
import { AuditTimeline } from './audit-timeline';
import { useTrainingApproval } from '@/hooks/use-training-approval';
import {
  WORKFLOW_TYPES, WORKFLOW_STATUSES, PRIORITIES, type ApprovalRequest, type ApprovalFilters,
} from '@/lib/training-approval-types';
import { exportApprovalRequestsCsv } from '@/lib/training-approval-service';
import { ApprovalStatusBadge } from './approval-status-badge';
import { WorkflowTimeline } from './workflow-timeline';
import { ElectronicSignatureDialog } from './electronic-signature-dialog';
import { ApprovalDashboardCharts } from './approval-dashboard-charts';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { TMS_DEPARTMENTS } from '@/lib/training-types';
import type { EsignRecord } from '@/lib/admin/schemas';

const KPI_CONFIG = [
  { label: 'Pending Approvals', key: 'pendingApprovals' as const, tone: 'amber' as const },
  { label: 'Approved Today', key: 'approvedToday' as const, tone: 'green' as const },
  { label: 'Rejected Today', key: 'rejectedToday' as const, tone: 'red' as const },
  { label: 'Overdue Approvals', key: 'overdueApprovals' as const, tone: 'red' as const },
  { label: 'Avg Approval Time (hrs)', key: 'averageApprovalTimeHours' as const, tone: 'blue' as const },
  { label: 'SLA Compliance', key: 'slaCompliancePercent' as const, tone: 'green' as const, suffix: '%' },
  { label: 'E-Signatures', key: 'electronicSignaturesCompleted' as const, tone: 'blue' as const },
  { label: 'Escalated', key: 'escalatedRequests' as const, tone: 'amber' as const },
];

interface TrainingApprovalPageProps {
  defaultTab?: 'inbox' | 'workflows' | 'history';
}

export function TrainingApprovalPage({ defaultTab = 'inbox' }: TrainingApprovalPageProps) {
  const [filters, setFilters] = useState<ApprovalFilters>({});
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [createOpen, setCreateOpen] = useState(false);
  const [esignOpen, setEsignOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<ApprovalRequest | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [newRequest, setNewRequest] = useState({
    workflow_type: 'Training Completion Review',
    reference_id: '', reference_number: '', department: 'QA', priority: 'Normal', approval_comments: '',
  });

  const {
    data, loading, refreshing, error, refresh, submitRequest, actOnRequest,
    canView, canApprove, canInitiate, isReadOnly,
    selectedIds, setSelectedIds, bulkApproveSelected, bulkRejectSelected,
  } = useTrainingApproval(filters);

  const handleApprove = useCallback((req: ApprovalRequest) => {
    setSelectedRequest(req);
    if (req.electronic_signature_required) setEsignOpen(true);
    else actOnRequest(req.id, 'Approve', 'Approved').then(() => toast.success('Approved'));
  }, [actOnRequest]);

  const handleEsignComplete = useCallback(async (esignRecord: EsignRecord, comments: string) => {
    if (!selectedRequest) return;
    const sigId = esignRecord.id ?? esignRecord.esignRecordId;
    await actOnRequest(selectedRequest.id, 'Approve', comments, sigId);
    toast.success('Approved with electronic signature');
    setSelectedRequest(null);
  }, [selectedRequest, actOnRequest]);

  const requestColumns: ColumnDef<ApprovalRequest>[] = [
    {
      key: 'select',
      header: '',
      render: (r) => canApprove && !isReadOnly ? (
        <Checkbox
          checked={selectedIds.includes(r.id)}
          onCheckedChange={(c) => setSelectedIds(c ? [...selectedIds, r.id] : selectedIds.filter((id) => id !== r.id))}
        />
      ) : null,
    },
    { key: 'workflow_number', header: 'Workflow #', render: (r) => <span className="font-mono text-xs">{r.workflow_number}</span> },
    { key: 'workflow_type', header: 'Type', render: (r) => <span className="text-xs">{r.workflow_type}</span> },
    { key: 'reference_number', header: 'Reference', render: (r) => r.reference_number },
    { key: 'status', header: 'Status', render: (r) => <ApprovalStatusBadge status={r.current_status} /> },
    { key: 'priority', header: 'Priority', render: (r) => r.priority },
    { key: 'department', header: 'Dept', render: (r) => r.department },
    { key: 'due_date', header: 'Due', render: (r) => <span className={r.due_date < new Date().toISOString().slice(0, 10) ? 'text-red-600 font-medium' : ''}>{r.due_date}</span> },
    { key: 'step', header: 'Step', render: (r) => `${r.current_step}/${r.total_steps}` },
  ];

  if (!canView) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Access Denied</AlertTitle>
        <AlertDescription>You do not have permission to view Training Approval Workflow.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <TmsPageHeader
        title="Training Approval Workflow"
        description="Manage electronic approval workflows for GMP training activities."
        trail={[{ label: 'Approval Workflow' }]}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={refresh} disabled={refreshing}>
              <RefreshCw className={`h-4 w-4 mr-1 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
            </Button>
            {data && <Button variant="outline" onClick={() => exportApprovalRequestsCsv(data.requests)}>Export CSV</Button>}
            {canInitiate && !isReadOnly && (
              <Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4 mr-1" /> New Request</Button>
            )}
          </div>
        }
      />

      <div className="flex flex-wrap gap-1.5">
        <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700 text-xs">21 CFR Part 11</Badge>
        <Badge variant="outline" className="text-xs">EU GMP Annex 11</Badge>
        <Badge variant="outline" className="text-xs">ALCOA+</Badge>
        <Badge variant="outline" className="text-xs">GAMP 5</Badge>
      </div>

      {isReadOnly && <Alert><AlertTitle>Read-Only</AlertTitle><AlertDescription>Auditor access — view only.</AlertDescription></Alert>}
      {error && <ErrorCard message={error} onRetry={refresh} />}

      <FilterPanel filters={filters} onChange={setFilters} />

      {loading ? <LoadingSkeleton rows={6} /> : data ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {KPI_CONFIG.map(({ label, key, tone, suffix }) => (
              <KpiCard key={key} label={label} value={`${data.kpis[key]}${suffix ?? ''}`} tone={tone} />
            ))}
          </div>

          <ApprovalDashboardCharts charts={data.charts} />

          {canApprove && selectedIds.length > 0 && !isReadOnly && (
            <div className="flex gap-2">
              <Button size="sm" onClick={() => bulkApproveSelected().then((c) => toast.success(`${c} approved`))}>
                <CheckCircle className="h-4 w-4 mr-1" /> Bulk Approve ({selectedIds.length})
              </Button>
              <Button size="sm" variant="destructive" onClick={() => bulkRejectSelected('Bulk rejected').then((c) => toast.success(`${c} rejected`))}>
                <XCircle className="h-4 w-4 mr-1" /> Bulk Reject
              </Button>
            </div>
          )}

          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
            <TabsList className="flex flex-wrap h-auto gap-1">
              <TabsTrigger value="inbox"><ShieldCheck className="h-3.5 w-3.5 mr-1" />Approval Inbox</TabsTrigger>
              <TabsTrigger value="workflows">Workflow Designer</TabsTrigger>
              <TabsTrigger value="history">Approval History</TabsTrigger>
            </TabsList>

            <TabsContent value="inbox" className="mt-4 space-y-4">
              <ApprovalInbox
                requests={data.pendingApprovals}
                selectedIds={selectedIds}
                onSelectChange={setSelectedIds}
                canAct={canApprove && !isReadOnly}
                onView={(r) => { setSelectedRequest(r); setDetailOpen(true); }}
                onApprove={handleApprove}
                onReject={(r) => actOnRequest(r.id, 'Reject', '', undefined, 'Rejected').then(() => toast.success('Rejected'))}
              />
              <ResponsiveDataTable
                data={data.overdueApprovals}
                columns={requestColumns.filter((c) => c.key !== 'select')}
                emptyMessage="No overdue approvals"
                mobileTitleKey="workflow_type"
                mobileSubtitleKey="workflow_number"
              />
            </TabsContent>

            <TabsContent value="workflows" className="mt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {data.workflows.map((w) => (
                  <Card key={w.id}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">{w.workflow_name}</CardTitle>
                    </CardHeader>
                    <CardContent className="text-xs space-y-1">
                      <p>{w.total_steps} steps · {w.status}</p>
                      <p className="text-muted-foreground">E-Sign: {w.electronic_signature_required ? 'Required' : 'Optional'}</p>
                      <WorkflowTimeline steps={w.steps_config.map((s, i) => ({
                        id: String(i), request_id: w.id, step_number: s.step_number,
                        step_name: s.step_name, approver_role: s.approver_role,
                        approver_id: '', approver_name: '', status: 'Waiting' as const,
                        due_date: '', completed_date: null, e_signature_required: s.e_signature_required,
                        e_signature_id: null, comments: '', rejection_reason: '', delegated_to: null,
                        created_at: '', updated_at: '',
                      }))} />
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="history" className="mt-4 space-y-4">
              <ResponsiveDataTable
                data={data.recentDecisions}
                columns={requestColumns.filter((c) => c.key !== 'select')}
                emptyMessage="No recent decisions"
                mobileTitleKey="workflow_type"
                mobileSubtitleKey="workflow_number"
              />
              <AuditTimeline history={data.history} />
            </TabsContent>
          </Tabs>
        </>
      ) : null}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Submit Approval Request</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Workflow Type</Label>
              <Select value={newRequest.workflow_type} onValueChange={(v) => setNewRequest((r) => ({ ...r, workflow_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{WORKFLOW_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Reference ID</Label><Input value={newRequest.reference_id} onChange={(e) => setNewRequest((r) => ({ ...r, reference_id: e.target.value }))} /></div>
            <div><Label>Reference Number</Label><Input value={newRequest.reference_number} onChange={(e) => setNewRequest((r) => ({ ...r, reference_number: e.target.value }))} /></div>
            <div>
              <Label>Department</Label>
              <Select value={newRequest.department} onValueChange={(v) => setNewRequest((r) => ({ ...r, department: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TMS_DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Comments</Label><Textarea value={newRequest.approval_comments} onChange={(e) => setNewRequest((r) => ({ ...r, approval_comments: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={async () => {
              try {
                await submitRequest({ ...newRequest, priority: newRequest.priority as typeof PRIORITIES[number] });
                toast.success('Request submitted');
                setCreateOpen(false);
              } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed'); }
            }}>Submit</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {selectedRequest && (
        <>
          <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>{selectedRequest.workflow_type}</DialogTitle></DialogHeader>
              <div className="text-sm space-y-2">
                <p><strong>Reference:</strong> {selectedRequest.reference_number}</p>
                <p><strong>Status:</strong> <ApprovalStatusBadge status={selectedRequest.current_status} /></p>
                <p><strong>Step:</strong> {selectedRequest.current_step} of {selectedRequest.total_steps}</p>
              </div>
              <WorkflowTimeline
                steps={data?.steps.filter((s) => s.request_id === selectedRequest.id) ?? []}
                currentStep={selectedRequest.current_step}
              />
            </DialogContent>
          </Dialog>
          <ElectronicSignatureDialog
            open={esignOpen}
            onOpenChange={setEsignOpen}
            requestId={selectedRequest.id}
            referenceNumber={selectedRequest.reference_number}
            onSigned={handleEsignComplete}
          />
        </>
      )}
    </div>
  );
}
