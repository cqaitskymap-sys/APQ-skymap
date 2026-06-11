'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import Link from 'next/link';
import {
  ArrowLeft, Send, UserPlus, Link2, CheckCircle, XCircle, Upload, Trash2, Printer, Lock,
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
import { DeviationForm } from './deviation-form';
import {
  investigationSchema, impactAssessmentSchema, approvalSchema, assignInvestigatorSchema,
  type InvestigationInput, type ImpactAssessmentInput, type ApprovalInput,
} from '@/lib/deviation-schemas';
import { RCA_METHODS } from '@/lib/deviation-types';
import {
  getDeviationById, getInvestigation, getImpactAssessment, getApprovals, getAttachments,
  getAuditLogsForDeviation, saveInvestigation, saveImpactAssessment, submitApproval,
  assignInvestigator, linkCapa, createCapaFromDeviation, closeDeviation, updateDeviation,
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
  const [capaNumber, setCapaNumber] = useState('');

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
          {(record.status === 'approved') && canClose && (
            <Button variant="outline" className="gap-1" onClick={async () => {
              try { await closeDeviation(id, actor); toast.success('Deviation closed'); refresh(); }
              catch (e) { toast.error(e instanceof Error ? e.message : 'Close failed'); }
            }}><Lock className="h-4 w-4" />Close</Button>
          )}
          <Button variant="outline" className="gap-1" onClick={() => printPage()}><Printer className="h-4 w-4" />Print PDF</Button>
        </div>
      </div>

      <Tabs defaultValue={defaultTab} className="space-y-4">
        <TabsList className="flex flex-wrap h-auto gap-1">
          {['overview', 'investigation', 'impact', 'capa', 'attachments', 'approval', 'audit'].map((t) => (
            <TabsTrigger key={t} value={t} className="capitalize">{t === 'impact' ? 'Impact Assessment' : t === 'audit' ? 'Audit Trail' : t === 'capa' ? 'CAPA' : t === 'approval' ? 'Approval History' : t}</TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview">
          {canEdit ? (
            <Card><CardHeader><CardTitle>Edit Draft</CardTitle></CardHeader>
              <CardContent>
                <DeviationForm
                  defaultValues={record as unknown as Parameters<typeof DeviationForm>[0]['defaultValues']}
                  submitLabel="Update Draft"
                  onSubmit={async (data) => {
                    try {
                      await updateDeviation(id, data as Partial<DeviationRecord>, actor);
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
          <InvestigationPanel
            deviationId={id} record={record} investigation={investigation}
            actor={actor} canInvestigate={canInvestigate} onSaved={refresh}
          />
        </TabsContent>

        <TabsContent value="impact">
          <ImpactPanel deviationId={id} impact={impact} actor={actor} canInvestigate={canInvestigate} onSaved={refresh} />
        </TabsContent>

        <TabsContent value="capa">
          <CapaPanel
            record={record} capaNumber={capaNumber} setCapaNumber={setCapaNumber}
            actor={actor} onSaved={refresh}
          />
        </TabsContent>

        <TabsContent value="attachments">
          <AttachmentsPanel
            deviationId={id} attachments={attachments} actor={actor}
            canUpload={canInvestigate || canEdit} onChanged={refresh}
          />
        </TabsContent>

        <TabsContent value="approval">
          <ApprovalPanel
            deviationId={id} record={record} approvals={approvals}
            actor={actor} canApprove={canApprove} onSaved={refresh}
          />
        </TabsContent>

        <TabsContent value="audit">
          <Card><CardHeader><CardTitle>Audit Trail</CardTitle><CardDescription>21 CFR Part 11 compliant activity log</CardDescription></CardHeader>
            <CardContent><DeviationTimeline events={timeline} /></CardContent>
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
      rca_method: (investigation?.rca_method as InvestigationInput['rca_method']) || '5 Why',
      root_cause_details: investigation?.root_cause_details || '',
      investigation_summary: investigation?.investigation_summary || '',
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

function ImpactPanel({
  deviationId, impact, actor, canInvestigate, onSaved,
}: {
  deviationId: string; impact: DeviationImpactAssessment | null;
  actor: ReturnType<typeof useDeviationActor>; canInvestigate: boolean; onSaved: () => void;
}) {
  const form = useForm<ImpactAssessmentInput>({
    resolver: zodResolver(impactAssessmentSchema),
    defaultValues: {
      impact_summary: impact?.impact_summary || '',
      batch_impact_details: impact?.batch_impact_details || '',
      product_quality_impact_details: impact?.product_quality_impact_details || '',
      patient_safety_impact_details: impact?.patient_safety_impact_details || '',
      regulatory_impact_details: impact?.regulatory_impact_details || '',
      capa_required: impact?.capa_required ?? false,
      capa_justification: impact?.capa_justification || '',
    },
  });

  return (
    <Card><CardHeader><CardTitle className="text-base">Impact Assessment</CardTitle>
      <CardDescription>Product quality impact = Yes mandates CAPA</CardDescription></CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(async (data) => {
            if (!canInvestigate) { toast.error('No permission'); return; }
            try {
              await saveImpactAssessment(deviationId, {
                ...data,
                assessed_by: actor.id, assessed_by_name: actor.name,
                assessed_at: new Date().toISOString(),
              }, actor);
              toast.success('Impact assessment saved'); onSaved();
            } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed'); }
          })} className="space-y-4">
            <FormField control={form.control} name="impact_summary" render={({ field }) => (
              <FormItem><FormLabel>Impact Summary *</FormLabel><FormControl><Textarea rows={3} {...field} disabled={!canInvestigate} /></FormControl><FormMessage /></FormItem>
            )} />
            {(['batch_impact_details', 'product_quality_impact_details', 'patient_safety_impact_details', 'regulatory_impact_details'] as const).map((name) => (
              <FormField key={name} control={form.control} name={name} render={({ field }) => (
                <FormItem><FormLabel>{name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</FormLabel>
                  <FormControl><Textarea rows={2} {...field} disabled={!canInvestigate} /></FormControl></FormItem>
              )} />
            ))}
            <FormField control={form.control} name="capa_required" render={({ field }) => (
              <FormItem className="flex items-center gap-3"><FormLabel>CAPA Required?</FormLabel>
                <FormControl><input type="checkbox" checked={field.value} onChange={field.onChange} disabled={!canInvestigate} className="h-4 w-4" /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="capa_justification" render={({ field }) => (
              <FormItem><FormLabel>CAPA Justification</FormLabel><FormControl><Textarea rows={2} {...field} disabled={!canInvestigate} /></FormControl></FormItem>
            )} />
            {canInvestigate && <Button type="submit" className="bg-blue-600 hover:bg-blue-700">Save Impact Assessment</Button>}
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

function CapaPanel({
  record, capaNumber, setCapaNumber, actor, onSaved,
}: {
  record: DeviationRecord; capaNumber: string; setCapaNumber: (v: string) => void;
  actor: ReturnType<typeof useDeviationActor>; onSaved: () => void;
}) {
  return (
    <Card><CardHeader><CardTitle className="text-base">CAPA Link</CardTitle>
      <CardDescription>Link existing CAPA or create new from deviation</CardDescription></CardHeader>
      <CardContent className="space-y-4">
        {record.linked_capa_number ? (
          <div className="rounded-lg border p-4 bg-green-50 dark:bg-green-950/20">
            <p className="font-mono font-semibold">{record.linked_capa_number}</p>
            <Link href="/dashboard/capa" className="text-sm text-blue-600 hover:underline">View in CAPA Module →</Link>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row gap-3">
            <Input placeholder="CAPA Number" value={capaNumber} onChange={(e) => setCapaNumber(e.target.value)} className="max-w-xs" />
            <Button variant="outline" className="gap-1" onClick={async () => {
              if (!capaNumber) { toast.error('Enter CAPA number'); return; }
              try { await linkCapa(record.id, capaNumber, null, actor); toast.success('CAPA linked'); onSaved(); }
              catch (e) { toast.error(e instanceof Error ? e.message : 'Failed'); }
            }}><Link2 className="h-4 w-4" />Link CAPA</Button>
            <Button className="bg-blue-600 hover:bg-blue-700 gap-1" onClick={async () => {
              try { const r = await createCapaFromDeviation(record.id, actor); toast.success(`CAPA ${r.capaNumber} created`); onSaved(); }
              catch (e) { toast.error(e instanceof Error ? e.message : 'Failed'); }
            }}>Create CAPA</Button>
          </div>
        )}
        {record.capa_required && !record.linked_capa_number && (
          <p className="text-sm text-orange-600">CAPA is mandatory for this deviation.</p>
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

function ApprovalPanel({
  deviationId, record, approvals, actor, canApprove, onSaved,
}: {
  deviationId: string; record: DeviationRecord; approvals: DeviationApproval[];
  actor: ReturnType<typeof useDeviationActor>; canApprove: boolean; onSaved: () => void;
}) {
  const form = useForm<ApprovalInput>({ resolver: zodResolver(approvalSchema), defaultValues: { decision: 'approved', comments: '', e_signature: '' } });
  const pendingApproval = ['submitted', 'under_investigation', 'qa_review', 'capa_required'].includes(record.status);

  return (
    <div className="space-y-4">
      {approvals.map((a) => (
        <Card key={a.id}><CardContent className="p-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="font-medium">{a.approver_name} <span className="text-muted-foreground text-sm">({a.approver_role})</span></p>
            <p className="text-sm">{a.comments}</p>
            <p className="text-xs text-muted-foreground italic">E-Sig: {a.e_signature}</p>
          </div>
          <DeviationStatusBadge status={a.decision} />
        </CardContent></Card>
      ))}

      {canApprove && pendingApproval && (
        <Card><CardHeader><CardTitle className="text-base">Approve / Reject</CardTitle>
          {requiresHeadQaApproval(record.criticality) && actor.role !== 'head_qa' && (
            <CardDescription className="text-red-600">Critical deviation — requires Head QA final approval</CardDescription>
          )}</CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(async (data) => {
                try { await submitApproval(deviationId, data, actor); toast.success(data.decision === 'approved' ? 'Approved' : 'Rejected'); onSaved(); form.reset(); }
                catch (e) { toast.error(e instanceof Error ? e.message : 'Failed'); }
              })} className="space-y-4">
                <FormField control={form.control} name="decision" render={({ field }) => (
                  <FormItem><FormLabel>Decision</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="approved">Approve</SelectItem>
                        <SelectItem value="rejected">Reject</SelectItem>
                      </SelectContent>
                    </Select></FormItem>
                )} />
                <FormField control={form.control} name="comments" render={({ field }) => (
                  <FormItem><FormLabel>Comments *</FormLabel><FormControl><Textarea rows={3} {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="e_signature" render={({ field }) => (
                  <FormItem><FormLabel>E-Signature (Type Full Name) *</FormLabel><FormControl><Input {...field} placeholder="Typed signature per 21 CFR Part 11" /></FormControl><FormMessage /></FormItem>
                )} />
                <div className="flex gap-2">
                  <Button type="submit" className="bg-green-600 hover:bg-green-700 gap-1"><CheckCircle className="h-4 w-4" />Submit Decision</Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
