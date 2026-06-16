'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import Link from 'next/link';
import {
  ArrowLeft, Send, UserPlus, CheckCircle, XCircle, Upload, Trash2, Printer, Lock,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { DeviationStatusBadge, DeviationCriticalityBadge } from './deviation-sub-nav';
import { DeviationTimeline, DeviationPdfDocument } from './deviation-pdf-document';
import { DeviationAuditTimeline } from './audit-trail/deviation-audit-timeline';
import { DeviationForm, mapRecordToFormInput, mapFormInputToRecord } from './deviation-form';
import {
  investigationSchema, assignInvestigatorSchema,
  type InvestigationInput,
} from '@/lib/deviation-schemas';
import { RCA_METHODS } from '@/lib/deviation-types';
import {
  getDeviationById, getInvestigation, getImpactAssessment, getApprovals, getAttachments,
  getAuditLogsForDeviation, saveInvestigation,
  assignInvestigator, updateDeviation,
  submitDeviation, uploadAttachment, deleteAttachment, canUserAccessDeviation,
} from '@/lib/deviation-service';
import type {
  DeviationRecord, DeviationInvestigation, DeviationImpactAssessment,
  DeviationApproval, DeviationAttachment,
} from '@/lib/deviation-types';
import { useDeviationActor } from '@/hooks/use-deviations';
import { printPage } from '@/lib/export-utils';
import { requiresHeadQaApproval } from '@/lib/deviation-types';

interface DeviationDetailProps {
  id: string;
  defaultTab?: string;
}

export function DeviationDetailView({ id, defaultTab = 'overview' }: DeviationDetailProps) {
  const router = useRouter();
  const actor = useDeviationActor();
  const [record, setRecord] = useState<DeviationRecord | null>(null);
  const [investigation, setInvestigation] = useState<DeviationInvestigation | null>(null);
  const [impact, setImpact] = useState<DeviationImpactAssessment | null>(null);
  const [approvals, setApprovals] = useState<DeviationApproval[]>([]);
  const [attachments, setAttachments] = useState<DeviationAttachment[]>([]);
  const [auditLogs, setAuditLogs] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [dev, inv, imp, appr, att, logs] = await Promise.all([
        getDeviationById(id),
        getInvestigation(id),
        getImpactAssessment(id),
        getApprovals(id),
        getAttachments(id),
        getAuditLogsForDeviation(id),
      ]);
      setRecord(dev);
      setInvestigation(inv);
      setImpact(imp);
      setApprovals(appr);
      setAttachments(att);
      setAuditLogs(logs);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { refresh(); }, [refresh]);

  if (loading) return <LoadingSpinner />;
  if (!record) return <Card><CardContent className="p-12 text-center">Deviation not found</CardContent></Card>;

  const canEdit = record.status === 'draft' && canUserAccessDeviation('create', actor.role, record);
  const canInvestigate = canUserAccessDeviation('investigate', actor.role, record);
  const canApprove = canUserAccessDeviation('approve', actor.role, record);
  const canClose = canUserAccessDeviation('close', actor.role, record);
  const needsHeadQa = requiresHeadQaApproval(record.criticality);

  const timeline = auditLogs.map((log) => ({
    date: String(log.dateTime || ''),
    title: String(log.action || ''),
    description: String(log.reason || log.newValue || '').slice(0, 120),
    user: String(log.userName || ''),
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <Button variant="ghost" size="sm" className="mb-2 -ml-2 gap-1" onClick={() => router.push('/qms/deviation')}>
            <ArrowLeft className="h-4 w-4" />Back to Dashboard
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold font-mono">{record.deviation_number}</h1>
            <DeviationStatusBadge status={record.status} />
            <DeviationCriticalityBadge criticality={record.criticality} />
            {record.capa_required && <span className="text-xs bg-orange-100 text-orange-800 px-2 py-0.5 rounded-full">CAPA Required</span>}
            {needsHeadQa && <span className="text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded-full">Head QA Approval Required</span>}
          </div>
          <p className="text-muted-foreground mt-1">{record.title}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {record.status === 'draft' && canEdit && (
            <Button className="bg-blue-600 hover:bg-blue-700 gap-1" onClick={async () => {
              try { await submitDeviation(id, actor); toast.success('Submitted for investigation'); refresh(); }
              catch (e) { toast.error(e instanceof Error ? e.message : 'Submit failed'); }
            }}><Send className="h-4 w-4" />Submit</Button>
          )}
          {(record.status === 'approved' || record.status === 'qa_review') && canClose && (
            <Link href={`/qms/deviation/${id}/closure`}>
              <Button variant="outline" className="gap-1"><Lock className="h-4 w-4" />Closure Module</Button>
            </Link>
          )}
          <Button variant="outline" className="gap-1" onClick={() => printPage()}><Printer className="h-4 w-4" />Print PDF</Button>
        </div>
      </div>

      <Tabs defaultValue={defaultTab} className="space-y-4">
        <TabsList className="flex flex-wrap h-auto gap-1">
          {['overview', 'investigation', 'impact', 'capa', 'attachments', 'approval', 'closure', 'audit'].map((t) => (
            <TabsTrigger key={t} value={t} className="capitalize">{t === 'impact' ? 'Impact Assessment' : t === 'audit' ? 'Audit Trail' : t === 'capa' ? 'CAPA' : t === 'approval' ? 'Approval History' : t === 'closure' ? 'Closure' : t}</TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview">
          {canEdit ? (
            <Card><CardHeader><CardTitle>Edit Draft</CardTitle></CardHeader>
              <CardContent>
                <DeviationForm
                  defaultValues={mapRecordToFormInput(record as unknown as Record<string, unknown>)}
                  submitLabel="Update Draft"
                  onSubmit={async (data) => {
                    try {
                      await updateDeviation(id, mapFormInputToRecord(data), actor);
                      toast.success('Draft updated'); refresh();
                    } catch (e) { toast.error(e instanceof Error ? e.message : 'Update failed'); }
                  }}
                />
              </CardContent>
            </Card>
          ) : (
            <OverviewPanel record={record} />
          )}
        </TabsContent>

        <TabsContent value="investigation">
          <Card className="mb-4 border-blue-200 bg-blue-50/40">
            <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm">Use the full investigation workspace for RCA, impact assessment, CAPA linkage, and QA review.</p>
              <Link href={`/qms/deviation/${id}/investigation`}>
                <Button className="bg-blue-600 hover:bg-blue-700">Open Investigation Module</Button>
              </Link>
            </CardContent>
          </Card>
          <InvestigationPanel
            deviationId={id} record={record} investigation={investigation}
            actor={actor} canInvestigate={canInvestigate} onSaved={refresh}
          />
        </TabsContent>

        <TabsContent value="impact">
          <Card className="mb-4 border-blue-200 bg-blue-50/40">
            <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm">Use the full impact assessment workspace for GMP impact checklist, risk scoring, CAPA recommendation, and QA review.</p>
              <Link href={`/qms/deviation/${id}/impact-assessment`}>
                <Button className="bg-blue-600 hover:bg-blue-700">Open Impact Assessment Module</Button>
              </Link>
            </CardContent>
          </Card>
          <ImpactSummaryPanel impact={impact} record={record} />
        </TabsContent>

        <TabsContent value="capa">
          <Card className="mb-4 border-blue-200 bg-blue-50/40">
            <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm">Use the full CAPA link workspace to create, link, track effectiveness, and review CAPA actions.</p>
              <Link href={`/qms/deviation/${id}/capa`}>
                <Button className="bg-blue-600 hover:bg-blue-700">Open CAPA Link Module</Button>
              </Link>
            </CardContent>
          </Card>
          <CapaSummaryPanel record={record} />
        </TabsContent>

        <TabsContent value="attachments">
          <AttachmentsPanel
            deviationId={id} attachments={attachments} actor={actor}
            canUpload={canInvestigate || canEdit} onChanged={refresh}
          />
        </TabsContent>

        <TabsContent value="approval">
          <Card className="mb-4 border-blue-200 bg-blue-50/40">
            <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm">Use the full approval workflow for GMP review, e-signature, escalation, and final approval.</p>
              <Link href={`/qms/deviation/${id}/approval`}>
                <Button className="bg-blue-600 hover:bg-blue-700">Open Approval Workflow</Button>
              </Link>
            </CardContent>
          </Card>
          <ApprovalSummaryPanel record={record} approvals={approvals} />
        </TabsContent>

        <TabsContent value="closure">
          <Card className="mb-4 border-blue-200 bg-blue-50/40">
            <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm">Use the closure workspace for pre-closure checklist, QA review, e-signature, and GMP-compliant deviation closure.</p>
              <Link href={`/qms/deviation/${id}/closure`}>
                <Button className="bg-blue-600 hover:bg-blue-700">Open Closure Module</Button>
              </Link>
            </CardContent>
          </Card>
          <Card><CardContent className="p-4 text-sm">
            <p className="text-xs text-muted-foreground">Status</p>
            <p className="font-medium capitalize">{record.status === 'closed' ? 'Closed — read only' : record.status.replace(/_/g, ' ')}</p>
            {record.actual_closure_date && <p className="text-xs text-muted-foreground mt-2">Closed on {record.actual_closure_date}</p>}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="audit">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div>
                <CardTitle>Audit Trail</CardTitle>
                <CardDescription>21 CFR Part 11 compliant read-only activity log</CardDescription>
              </div>
              <Link href={`/qms/deviation/${id}/audit-trail`}>
                <Button variant="outline" size="sm">Full Audit Trail</Button>
              </Link>
            </CardHeader>
            <CardContent>
              {auditLogs.length ? (
                <DeviationAuditTimeline
                  entries={auditLogs.map((log) => ({
                    id: String(log.id || ''),
                    audit_id: String(log.auditId || log.id || ''),
                    deviation_id: id,
                    deviation_number: record.deviation_number,
                    module_name: String(log.moduleName || log.module || 'Deviation'),
                    action_type: String(log.actionType || log.action || 'Updated'),
                    action_description: String(log.actionDescription || log.action || ''),
                    field_name: String(log.fieldName || ''),
                    old_value: String(log.oldValue || ''),
                    new_value: String(log.newValue || ''),
                    changed_by: String(log.userId || ''),
                    changed_by_name: String(log.userName || ''),
                    changed_by_role: String(log.changedByRole || ''),
                    department: String(log.department || ''),
                    reason: String(log.reason || ''),
                    ip_address: String(log.ipAddress || ''),
                    device_info: String(log.device || log.deviceInfo || ''),
                    date_time: String(log.dateTime || ''),
                    status: String(log.status || 'Success'),
                  }))}
                />
              ) : (
                <DeviationTimeline events={timeline} />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="hidden print:block">
        <DeviationPdfDocument record={record} investigation={investigation} impact={impact} approvals={approvals} auditLogs={auditLogs} />
      </div>
    </div>
  );
}

function OverviewPanel({ record }: { record: DeviationRecord }) {
  const fields = [
    ['Deviation Date', record.deviation_date], ['Department', record.department],
    ['Product', record.product_name], ['Batch', record.batch_number || '—'],
    ['Area', record.area], ['Reported By', record.reported_by_name],
    ['Detected By', record.detected_by_name], ['Category', record.category],
    ['Type', record.planned_type], ['Investigator', record.assigned_investigator_name || '—'],
    ['Target Closure', record.target_closure_date || '—'], ['Source', record.source],
  ];
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card><CardHeader><CardTitle className="text-base">Deviation Details</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 text-sm">
          {fields.map(([l, v]) => (
            <div key={String(l)}><p className="text-muted-foreground text-xs">{l}</p><p className="font-medium">{v}</p></div>
          ))}
        </CardContent>
      </Card>
      <Card><CardHeader><CardTitle className="text-base">Description</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>{record.description}</p>
          <div><p className="text-xs text-muted-foreground">Immediate Action</p><p>{record.immediate_action}</p></div>
          {record.qa_remarks && <div><p className="text-xs text-muted-foreground">QA Remarks</p><p>{record.qa_remarks}</p></div>}
        </CardContent>
      </Card>
    </div>
  );
}

function InvestigationPanel({
  deviationId, record, investigation, actor, canInvestigate, onSaved,
}: {
  deviationId: string; record: DeviationRecord; investigation: DeviationInvestigation | null;
  actor: ReturnType<typeof useDeviationActor>; canInvestigate: boolean; onSaved: () => void;
}) {
  const assignForm = useForm({ resolver: zodResolver(assignInvestigatorSchema), defaultValues: { assigned_investigator_name: record.assigned_investigator_name || '' } });
  const form = useForm<InvestigationInput>({
    resolver: zodResolver(investigationSchema),
    defaultValues: {
      investigation_summary: investigation?.investigation_summary || '',
      root_cause_details: investigation?.root_cause_details || '',
      rca_method: (investigation?.rca_method as InvestigationInput['rca_method']) || '5 Why',
    },
  });

  return (
    <div className="space-y-4">
      {canInvestigate && !record.assigned_investigator_name && (
        <Card><CardHeader><CardTitle className="text-base">Assign Investigator</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={assignForm.handleSubmit(async (data) => {
              try { await assignInvestigator(deviationId, data.assigned_investigator_name, actor); toast.success('Investigator assigned'); onSaved(); }
              catch (e) { toast.error(e instanceof Error ? e.message : 'Failed'); }
            })} className="flex gap-3">
              <Input {...assignForm.register('assigned_investigator_name')} placeholder="Investigator name" className="max-w-xs" />
              <Button type="submit" className="gap-1"><UserPlus className="h-4 w-4" />Assign</Button>
            </form>
          </CardContent>
        </Card>
      )}
      <Card><CardHeader><CardTitle className="text-base">Root Cause Analysis</CardTitle></CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(async (data) => {
              if (!canInvestigate) { toast.error('No permission'); return; }
              try {
                await saveInvestigation(deviationId, {
                  rca_method: data.rca_method, root_cause_details: data.root_cause_details,
                  investigation_summary: data.investigation_summary,
                  investigator_id: actor.id, investigator_name: actor.name,
                  started_at: investigation?.started_at || new Date().toISOString(),
                  completed_at: new Date().toISOString(),
                }, actor);
                toast.success('Investigation saved'); onSaved();
              } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed'); }
            })} className="space-y-4">
              <FormField control={form.control} name="rca_method" render={({ field }) => (
                <FormItem><FormLabel>RCA Method</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} disabled={!canInvestigate}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>{RCA_METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                  </Select><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="root_cause_details" render={({ field }) => (
                <FormItem><FormLabel>Root Cause Details</FormLabel><FormControl><Textarea rows={4} {...field} disabled={!canInvestigate} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="investigation_summary" render={({ field }) => (
                <FormItem><FormLabel>Investigation Summary</FormLabel><FormControl><Textarea rows={4} {...field} disabled={!canInvestigate} /></FormControl><FormMessage /></FormItem>
              )} />
              {canInvestigate && <Button type="submit" className="bg-blue-600 hover:bg-blue-700">Save Investigation</Button>}
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}

function ImpactSummaryPanel({
  impact, record,
}: {
  impact: DeviationImpactAssessment | null; record: DeviationRecord;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Impact Assessment Summary</CardTitle>
        <CardDescription>
          {impact ? `Status: ${impact.status || 'Draft'} — Risk: ${impact.risk_score ?? '—'} (${impact.risk_level || '—'})` : 'No impact assessment recorded yet'}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2 text-sm">
        {[['Batch Impact', impact?.batch_impact || (record.batch_impacted ? 'Yes' : 'No')],
          ['Product Quality', impact?.product_quality_impact || (record.product_quality_impacted ? 'Yes' : 'No')],
          ['Patient Safety', impact?.patient_safety_impact || (record.patient_safety_impacted ? 'Yes' : 'No')],
          ['CAPA Required', (impact?.capa_required ?? record.capa_required) ? 'Yes' : 'No'],
          ['Recall Evaluation', impact?.recall_evaluation_required ? 'Yes' : 'No'],
          ['Assessed By', impact?.assessed_by_name || '—'],
        ].map(([l, v]) => (
          <div key={String(l)}><p className="text-xs text-muted-foreground">{l}</p><p className="font-medium">{v}</p></div>
        ))}
        {impact?.impact_summary && (
          <div className="sm:col-span-2"><p className="text-xs text-muted-foreground">Summary</p><p>{impact.impact_summary}</p></div>
        )}
      </CardContent>
    </Card>
  );
}

function CapaSummaryPanel({ record }: { record: DeviationRecord }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">CAPA Link Summary</CardTitle>
        <CardDescription>
          {record.linked_capa_number ? `Linked: ${record.linked_capa_number}` : record.capa_required ? 'CAPA required — not yet linked' : 'No CAPA required'}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2 text-sm">
        {[['CAPA Required', record.capa_required ? 'Yes' : 'No'],
          ['Linked CAPA', record.linked_capa_number || '—'],
          ['Deviation Status', record.status.replace(/_/g, ' ')],
        ].map(([l, v]) => (
          <div key={String(l)}><p className="text-xs text-muted-foreground">{l}</p><p className="font-medium capitalize">{v}</p></div>
        ))}
        {record.capa_required && !record.linked_capa_number && (
          <p className="sm:col-span-2 text-sm text-orange-600">Mandatory CAPA must be linked and closed before deviation closure.</p>
        )}
      </CardContent>
    </Card>
  );
}

function AttachmentsPanel({
  deviationId, attachments, actor, canUpload, onChanged,
}: {
  deviationId: string; attachments: DeviationAttachment[];
  actor: ReturnType<typeof useDeviationActor>; canUpload: boolean; onChanged: () => void;
}) {
  return (
    <Card><CardHeader><CardTitle className="text-base">Attachments</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {canUpload && (
          <div>
            <Input type="file" onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              try { await uploadAttachment(deviationId, file, actor); toast.success('File uploaded'); onChanged(); }
              catch (err) { toast.error(err instanceof Error ? err.message : 'Upload failed'); }
            }} />
          </div>
        )}
        <div className="space-y-2">
          {attachments.map((a) => (
            <div key={a.id} className="flex items-center justify-between rounded-lg border p-3">
              <a href={a.file_url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline">{a.file_name}</a>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{a.uploaded_by_name}</span>
                {canUpload && (
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={async () => {
                    await deleteAttachment(a.id, actor); toast.success('Deleted'); onChanged();
                  }}><Trash2 className="h-3.5 w-3.5" /></Button>
                )}
              </div>
            </div>
          ))}
          {!attachments.length && <p className="text-sm text-muted-foreground text-center py-6">No attachments</p>}
        </div>
      </CardContent>
    </Card>
  );
}

function ApprovalSummaryPanel({
  record, approvals,
}: {
  record: DeviationRecord; approvals: DeviationApproval[];
}) {
  const pending = approvals.find((a) => ['Pending', 'Escalated'].includes(a.approval_status || ''));
  return (
    <div className="space-y-4">
      {approvals.slice(-3).reverse().map((a) => (
        <Card key={a.id}><CardContent className="p-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="font-medium">{a.approver_name || a.current_workflow_step} <span className="text-muted-foreground text-sm">({a.approver_role || a.current_role})</span></p>
            <p className="text-sm">{a.comments || a.rejection_reason || '—'}</p>
          </div>
          <DeviationStatusBadge status={a.approval_status || a.decision} />
        </CardContent></Card>
      ))}
      <Card><CardContent className="p-4 text-sm">
        <p className="text-xs text-muted-foreground">Current Step</p>
        <p className="font-medium">{pending?.current_workflow_step || (record.status === 'approved' ? 'Final Approval Complete' : '—')}</p>
        {pending && <p className="text-xs text-muted-foreground mt-1">Pending with: {pending.current_role?.replace(/_/g, ' ')}</p>}
      </CardContent></Card>
    </div>
  );
}
