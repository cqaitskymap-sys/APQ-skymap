'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import Link from 'next/link';
import { ArrowLeft, Send, Link2, CheckCircle, Printer, Lock, Trash2, AlertTriangle } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { OosStatusBadge, ResultStatusBadge } from './oos-sub-nav';
import { OosTimeline, OosPdfDocument } from './oos-pdf-document';
import { OosAuditTimeline } from './audit-trail/oos-audit-timeline';
import { OosForm } from './oos-form';
import { z } from 'zod';
import {
  phase1SchemaLegacy, phase2SchemaLegacy, impactAssessmentSchemaLegacy,
  type Phase1Input, type OosImpactLegacyInput,
} from '@/lib/oos-schemas';
import { PHASE1_OUTCOMES } from '@/lib/oos-types';
import {
  getOosById, getPhase1, getPhase2, getImpactAssessment, getCapaLink, getApprovals,
  getAttachments, getAuditLogsForOos, savePhase1, savePhase2, saveImpactAssessment,
  linkCapa, createCapaFromOos, closeOos, submitOos, updateOosRecord,
  uploadAttachment, deleteAttachment, canUserAccessOos,
} from '@/lib/oos-service';
import type { OosRecord, OosPhase1, OosPhase2, OosImpactAssessment, OosCapaLink, OosApproval, OosAttachment } from '@/lib/oos-types';
import { useOosActor } from '@/hooks/use-oos';
import { printPage } from '@/lib/export-utils';

export function OosDetailView({ id, defaultTab = 'overview' }: { id: string; defaultTab?: string }) {
  const router = useRouter();
  const actor = useOosActor();
  const [record, setRecord] = useState<OosRecord | null>(null);
  const [phase1, setPhase1] = useState<OosPhase1 | null>(null);
  const [phase2, setPhase2] = useState<OosPhase2 | null>(null);
  const [impact, setImpact] = useState<OosImpactAssessment | null>(null);
  const [capa, setCapa] = useState<OosCapaLink | null>(null);
  const [approvals, setApprovals] = useState<OosApproval[]>([]);
  const [attachments, setAttachments] = useState<OosAttachment[]>([]);
  const [auditLogs, setAuditLogs] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [capaNumber, setCapaNumber] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [r, p1, p2, imp, c, appr, att, logs] = await Promise.all([
        getOosById(id), getPhase1(id), getPhase2(id), getImpactAssessment(id),
        getCapaLink(id), getApprovals(id), getAttachments(id), getAuditLogsForOos(id),
      ]);
      setRecord(r); setPhase1(p1); setPhase2(p2); setImpact(imp); setCapa(c);
      setApprovals(appr); setAttachments(att); setAuditLogs(logs);
    } finally { setLoading(false); }
  }, [id]);

  useEffect(() => { refresh(); }, [refresh]);

  if (loading) return <LoadingSpinner />;
  if (!record) return <Card><CardContent className="p-12 text-center">OOS record not found</CardContent></Card>;

  const canEdit = record.status === 'draft' && canUserAccessOos('create', actor.role);
  const canPhase1 = canUserAccessOos('phase1', actor.role);
  const canPhase2 = canUserAccessOos('phase2', actor.role);
  const canApprove = canUserAccessOos('approve', actor.role);
  const canClose = canUserAccessOos('close', actor.role);

  const timeline = auditLogs.map((log) => ({
    id: String(log.id || ''),
    audit_id: String(log.auditId || log.id || ''),
    oos_id: id,
    oos_number: record?.oos_number || '',
    module_name: String(log.moduleName || log.module || 'OOS'),
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
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <Button variant="ghost" size="sm" className="mb-2 -ml-2 gap-1" onClick={() => router.push('/qms/oos')}><ArrowLeft className="h-4 w-4" />Back</Button>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold font-mono">{record.oos_number}</h1>
            <OosStatusBadge status={record.status} /><ResultStatusBadge status={record.result_status} />
            {record.is_critical_test && <span className="text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded-full">Critical Test</span>}
            {record.batch_release_blocked && <span className="text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded-full flex items-center gap-1"><AlertTriangle className="h-3 w-3" />Batch Release Blocked</span>}
          </div>
          <p className="text-muted-foreground mt-1">{record.test_name} — {record.product_name} / {record.batch_number}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {record.status === 'draft' && record.result_status === 'OOS' && canEdit && (
            <Button className="bg-blue-600 hover:bg-blue-700 gap-1" onClick={async () => {
              try { await submitOos(id, actor); toast.success('Submitted for Phase-I'); refresh(); }
              catch (e) { toast.error(e instanceof Error ? e.message : 'Failed'); }
            }}><Send className="h-4 w-4" />Submit</Button>
          )}
          {record.status === 'approved' && canClose && (
            <Button variant="outline" className="gap-1" onClick={async () => {
              try { await closeOos(id, actor); toast.success('OOS closed'); refresh(); }
              catch (e) { toast.error(e instanceof Error ? e.message : 'Failed'); }
            }}><Lock className="h-4 w-4" />Close</Button>
          )}
          <Button variant="outline" className="gap-1" onClick={() => printPage()}><Printer className="h-4 w-4" />Print PDF</Button>
        </div>
      </div>

      <Tabs defaultValue={defaultTab} className="space-y-4">
        <TabsList className="flex flex-wrap h-auto gap-1">
          {['overview', 'phase1', 'phase2', 'impact', 'capa', 'attachments', 'approval', 'audit'].map((t) => (
            <TabsTrigger key={t} value={t} className="capitalize">{t === 'phase1' ? 'Phase-I' : t === 'phase2' ? 'Phase-II' : t === 'impact' ? 'Impact' : t === 'audit' ? 'Audit Trail' : t}</TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview">
          {canEdit ? (
            <Card><CardHeader><CardTitle>Edit Draft</CardTitle></CardHeader><CardContent>
              <OosForm defaultValues={record as unknown as Parameters<typeof OosForm>[0]['defaultValues']} submitLabel="Update" onSubmit={async (data) => {
                try { await updateOosRecord(id, data as Partial<OosRecord>, actor); toast.success('Updated'); refresh(); }
                catch (e) { toast.error(e instanceof Error ? e.message : 'Failed'); }
              }} />
            </CardContent></Card>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              <Card><CardHeader><CardTitle className="text-base">OOS Header</CardTitle></CardHeader><CardContent className="grid grid-cols-2 gap-3 text-sm">
                {[['Date', record.oos_date], ['Department', record.department], ['Product', record.product_name], ['Batch', record.batch_number], ['Test', record.test_name], ['Method', record.test_method], ['STP', record.stp_number], ['Spec No.', record.specification_number]].map(([l, v]) => (
                  <div key={String(l)}><p className="text-xs text-muted-foreground">{l}</p><p className="font-medium">{v}</p></div>
                ))}
              </CardContent></Card>
              <Card><CardHeader><CardTitle className="text-base">Result Details</CardTitle></CardHeader><CardContent className="grid grid-cols-2 gap-3 text-sm">
                {[['Parameter', record.parameter_name], ['Lower', `${record.spec_lower_limit} ${record.unit}`], ['Upper', `${record.spec_upper_limit} ${record.unit}`], ['Observed', `${record.observed_result} ${record.unit}`], ['Status', record.result_status]].map(([l, v]) => (
                  <div key={String(l)}><p className="text-xs text-muted-foreground">{l}</p><p className="font-medium">{v}</p></div>
                ))}
              </CardContent></Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="phase1"><Phase1Panel oosId={id} phase1={phase1} actor={actor} canEdit={canPhase1} onSaved={refresh} /></TabsContent>
        <TabsContent value="phase2"><Phase2Panel oosId={id} phase2={phase2} actor={actor} canEdit={canPhase2} onSaved={refresh} /></TabsContent>
        <TabsContent value="impact"><ImpactPanel oosId={id} impact={impact} actor={actor} canEdit={canPhase1 || canApprove} onSaved={refresh} /></TabsContent>
        <TabsContent value="capa"><CapaPanel record={record} capa={capa} capaNumber={capaNumber} setCapaNumber={setCapaNumber} actor={actor} onSaved={refresh} /></TabsContent>
        <TabsContent value="attachments"><AttachmentsPanel oosId={id} attachments={attachments} actor={actor} canUpload={canPhase1 || canPhase2} onChanged={refresh} /></TabsContent>
        <TabsContent value="approval"><ApprovalPanel oosId={id} record={record} approvals={approvals} /></TabsContent>
        <TabsContent value="audit">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div>
                <CardTitle>Audit Trail</CardTitle>
                <CardDescription>21 CFR Part 11 compliant read-only activity log</CardDescription>
              </div>
              <Link href={`/qms/oos/${id}/audit-trail`}>
                <Button variant="outline" size="sm">Full Audit Trail</Button>
              </Link>
            </CardHeader>
            <CardContent>
              {timeline.length ? (
                <OosAuditTimeline entries={timeline} />
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">No audit trail entries recorded yet.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="hidden print:block">
        <OosPdfDocument record={record} phase1={phase1} phase2={phase2} impact={impact} capa={capa} approvals={approvals} auditLogs={auditLogs} />
      </div>
    </div>
  );
}

function Phase1Panel({ oosId, phase1, actor, canEdit, onSaved }: { oosId: string; phase1: OosPhase1 | null; actor: ReturnType<typeof useOosActor>; canEdit: boolean; onSaved: () => void }) {
  const form = useForm<Phase1Input>({
    resolver: zodResolver(phase1SchemaLegacy),
    defaultValues: {
      analyst_name: phase1?.analyst_name || '', instrument_used: phase1?.instrument_used || '',
      instrument_calibration_status: phase1?.instrument_calibration_status || 'Valid',
      standard_used: phase1?.standard_used || '', reagent_used: phase1?.reagent_used || '',
      calculation_verified: phase1?.calculation_verified ?? false, data_review_completed: phase1?.data_review_completed ?? false,
      chromatogram_attached: phase1?.chromatogram_attached ?? false, raw_data_attached: phase1?.raw_data_attached ?? false,
      investigation_findings: phase1?.investigation_findings || '', root_cause_identified: phase1?.root_cause_identified || '',
      phase1_conclusion: phase1?.phase1_conclusion || '', phase1_outcome: (phase1?.phase1_outcome as Phase1Input['phase1_outcome']) || 'Inconclusive',
    },
  });
  const boolFields = [['calculation_verified', 'Calculation Verified'], ['data_review_completed', 'Data Review Completed'], ['chromatogram_attached', 'Chromatogram Attached'], ['raw_data_attached', 'Raw Data Attached']] as const;

  return (
    <Card><CardHeader className="flex flex-row items-center justify-between">
      <CardTitle className="text-base">Phase-I Laboratory Investigation</CardTitle>
      <Link href={`/qms/oos/${oosId}/phase1`}><Button variant="outline" size="sm">Open Full Phase-I Module</Button></Link>
    </CardHeader><CardContent>
      <Form {...form}><form onSubmit={form.handleSubmit(async (data) => {
        if (!canEdit) { toast.error('No permission'); return; }
        try {
          await savePhase1(oosId, {
            ...data,
            phase1_outcome: data.phase1_outcome || 'Inconclusive',
            investigator_id: actor.id,
            investigator_name: actor.name,
            started_at: phase1?.started_at || new Date().toISOString(),
            completed_at: null,
          }, actor);
          toast.success('Phase-I saved'); onSaved();
        } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed'); }
      })} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(['analyst_name', 'instrument_used', 'instrument_calibration_status', 'standard_used', 'reagent_used'] as const).map((name) => (
            <FormField key={name} control={form.control} name={name} render={({ field }) => (
              <FormItem><FormLabel>{name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</FormLabel><FormControl><Input {...field} disabled={!canEdit} /></FormControl><FormMessage /></FormItem>
            )} />
          ))}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {boolFields.map(([name, label]) => (
            <FormField key={name} control={form.control} name={name} render={({ field }) => (
              <FormItem className="flex items-center gap-2 rounded border p-3"><FormControl><input type="checkbox" checked={field.value} onChange={field.onChange} disabled={!canEdit} /></FormControl><FormLabel className="text-sm font-normal">{label}</FormLabel></FormItem>
            )} />
          ))}
        </div>
        {(['investigation_findings', 'root_cause_identified', 'phase1_conclusion'] as const).map((name) => (
          <FormField key={name} control={form.control} name={name} render={({ field }) => (
            <FormItem><FormLabel>{name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</FormLabel><FormControl><Textarea rows={3} {...field} disabled={!canEdit} /></FormControl><FormMessage /></FormItem>
          )} />
        ))}
        <FormField control={form.control} name="phase1_outcome" render={({ field }) => (
          <FormItem><FormLabel>Phase-I Outcome</FormLabel>
            <Select onValueChange={field.onChange} value={field.value} disabled={!canEdit}>
              <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
              <SelectContent>{PHASE1_OUTCOMES.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
            </Select><FormMessage /></FormItem>
        )} />
        {canEdit && <Button type="submit" className="bg-blue-600 hover:bg-blue-700">Save Phase-I</Button>}
      </form></Form>
    </CardContent></Card>
  );
}

function Phase2Panel({ oosId, phase2, actor, canEdit, onSaved }: { oosId: string; phase2: OosPhase2 | null; actor: ReturnType<typeof useOosActor>; canEdit: boolean; onSaved: () => void }) {
  const form = useForm<z.infer<typeof phase2SchemaLegacy>>({
    resolver: zodResolver(phase2SchemaLegacy),
    defaultValues: {
      raw_material_review: phase2?.raw_material_review || '', equipment_review: phase2?.equipment_review || '',
      environmental_review: phase2?.environmental_review || '', process_review: phase2?.process_review || '',
      operator_review: phase2?.operator_review || '', deviation_review: phase2?.deviation_review || '',
      change_control_review: phase2?.change_control_review || '', batch_record_review: phase2?.batch_record_review || '',
      root_cause: phase2?.root_cause || '', impact_assessment: phase2?.impact_assessment || '',
      corrective_action: phase2?.corrective_action || '', preventive_action: phase2?.preventive_action || '',
      conclusion: phase2?.conclusion || '',
    },
  });
  const fields = ['raw_material_review', 'equipment_review', 'environmental_review', 'process_review', 'operator_review', 'deviation_review', 'change_control_review', 'batch_record_review', 'root_cause', 'impact_assessment', 'corrective_action', 'preventive_action', 'conclusion'] as const;

  return (
    <Card><CardHeader className="flex flex-row items-center justify-between">
      <CardTitle className="text-base">Phase-II Manufacturing Investigation</CardTitle>
      <Link href={`/qms/oos/${oosId}/phase2`}><Button variant="outline" size="sm">Open Full Phase-II Module</Button></Link>
    </CardHeader><CardContent>
      <Form {...form}><form onSubmit={form.handleSubmit(async (data) => {
        if (!canEdit) { toast.error('No permission'); return; }
        try {
          await savePhase2(oosId, { ...data, investigator_id: actor.id, investigator_name: actor.name, started_at: phase2?.started_at || new Date().toISOString(), completed_at: new Date().toISOString() }, actor);
          toast.success('Phase-II saved'); onSaved();
        } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed'); }
      })} className="space-y-4">
        {fields.map((name) => (
          <FormField key={name} control={form.control} name={name} render={({ field }) => (
            <FormItem><FormLabel>{name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</FormLabel><FormControl><Textarea rows={2} {...field} disabled={!canEdit} /></FormControl><FormMessage /></FormItem>
          )} />
        ))}
        {canEdit && <Button type="submit" className="bg-blue-600 hover:bg-blue-700">Save Phase-II</Button>}
      </form></Form>
    </CardContent></Card>
  );
}

function ImpactPanel({ oosId, impact, actor, canEdit, onSaved }: { oosId: string; impact: OosImpactAssessment | null; actor: ReturnType<typeof useOosActor>; canEdit: boolean; onSaved: () => void }) {
  const form = useForm<OosImpactLegacyInput>({
    resolver: zodResolver(impactAssessmentSchemaLegacy),
    defaultValues: {
      product_impact: impact?.product_impact || '', batch_impact: impact?.batch_impact || '',
      market_impact: impact?.market_impact || '', patient_safety_impact: impact?.patient_safety_impact || '',
      regulatory_impact: impact?.regulatory_impact || '', other_batches_impacted: impact?.other_batches_impacted || '',
      recall_required: impact?.recall_required ?? false,
    },
  });
  return (
    <Card><CardHeader className="flex flex-row items-center justify-between gap-2">
      <CardTitle className="text-base">Impact Assessment</CardTitle>
      <Link href={`/qms/oos/${oosId}/impact-assessment`}><Button variant="outline" size="sm">Open Full Impact Module</Button></Link>
    </CardHeader><CardContent>
      <Form {...form}><form onSubmit={form.handleSubmit(async (data) => {
        try {
          await saveImpactAssessment(oosId, { ...data, assessed_by: actor.id, assessed_by_name: actor.name, assessed_at: new Date().toISOString() }, actor);
          toast.success('Impact saved'); onSaved();
        } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed'); }
      })} className="space-y-4">
        {(['product_impact', 'batch_impact', 'market_impact', 'patient_safety_impact', 'regulatory_impact', 'other_batches_impacted'] as const).map((name) => (
          <FormField key={name} control={form.control} name={name} render={({ field }) => (
            <FormItem><FormLabel>{name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</FormLabel><FormControl><Textarea rows={2} {...field} disabled={!canEdit} /></FormControl></FormItem>
          )} />
        ))}
        <FormField control={form.control} name="recall_required" render={({ field }) => (
          <FormItem className="flex items-center gap-2"><FormControl><input type="checkbox" checked={field.value} onChange={field.onChange} disabled={!canEdit} /></FormControl><FormLabel>Recall Required</FormLabel></FormItem>
        )} />
        {canEdit && <Button type="submit" className="bg-blue-600 hover:bg-blue-700">Save Impact Assessment</Button>}
      </form></Form>
    </CardContent></Card>
  );
}

function CapaPanel({ record, capa, capaNumber, setCapaNumber, actor, onSaved }: { record: OosRecord; capa: OosCapaLink | null; capaNumber: string; setCapaNumber: (v: string) => void; actor: ReturnType<typeof useOosActor>; onSaved: () => void }) {
  return (
    <Card><CardHeader className="flex flex-row items-center justify-between gap-2">
      <CardTitle className="text-base">CAPA Link</CardTitle>
      <Link href={`/qms/oos/${record.id}/capa`}><Button variant="outline" size="sm">Open CAPA Management</Button></Link>
    </CardHeader><CardContent className="space-y-4">
      {capa || record.linked_capa_number ? (
        <div className="rounded-lg border p-4 bg-green-50 dark:bg-green-950/20">
          <p className="font-mono font-semibold">{capa?.capa_number || record.linked_capa_number}</p>
          <p className="text-sm text-muted-foreground">Status: {capa?.capa_status || 'Linked'}</p>
          <Link href="/dashboard/capa" className="text-sm text-blue-600 hover:underline">View in CAPA Module →</Link>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row gap-3">
          <Input placeholder="CAPA Number" value={capaNumber} onChange={(e) => setCapaNumber(e.target.value)} className="max-w-xs" />
          <Button variant="outline" className="gap-1" onClick={async () => {
            if (!capaNumber) return;
            try { await linkCapa(record.id, capaNumber, null, 'open', record.target_closure_date, '', actor); toast.success('CAPA linked'); onSaved(); }
            catch (e) { toast.error(e instanceof Error ? e.message : 'Failed'); }
          }}><Link2 className="h-4 w-4" />Link CAPA</Button>
          <Button className="bg-blue-600 hover:bg-blue-700" onClick={async () => {
            try { const r = await createCapaFromOos(record.id, actor); toast.success(`CAPA ${r.capaNumber} created`); onSaved(); }
            catch (e) { toast.error(e instanceof Error ? e.message : 'Failed'); }
          }}>Create CAPA</Button>
        </div>
      )}
    </CardContent></Card>
  );
}

function AttachmentsPanel({ oosId, attachments, actor, canUpload, onChanged }: { oosId: string; attachments: OosAttachment[]; actor: ReturnType<typeof useOosActor>; canUpload: boolean; onChanged: () => void }) {
  const categories: OosAttachment['category'][] = ['pdf', 'excel', 'chromatogram', 'image', 'report', 'other'];
  const [category, setCategory] = useState<OosAttachment['category']>('pdf');
  return (
    <Card><CardHeader><CardTitle className="text-base">Attachments</CardTitle></CardHeader><CardContent className="space-y-4">
      {canUpload && (
        <div className="flex flex-col sm:flex-row gap-3 items-start">
          <Select value={category} onValueChange={(v) => setCategory(v as OosAttachment['category'])}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>{categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
          <Input type="file" accept=".pdf,.xls,.xlsx,.png,.jpg,.jpeg,.csv" onChange={async (e) => {
            const file = e.target.files?.[0]; if (!file) return;
            try { await uploadAttachment(oosId, file, category, actor); toast.success('Uploaded'); onChanged(); }
            catch (err) { toast.error(err instanceof Error ? err.message : 'Failed'); }
          }} />
        </div>
      )}
      <div className="space-y-2">{attachments.map((a) => (
        <div key={a.id} className="flex items-center justify-between rounded-lg border p-3">
          <div><a href={a.file_url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline">{a.file_name}</a><p className="text-xs text-muted-foreground">{a.category} — {a.uploaded_by_name}</p></div>
          {canUpload && <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={async () => { await deleteAttachment(a.id, actor); onChanged(); }}><Trash2 className="h-3.5 w-3.5" /></Button>}
        </div>
      ))}{!attachments.length && <p className="text-sm text-muted-foreground text-center py-6">No attachments</p>}</div>
    </CardContent></Card>
  );
}

function ApprovalPanel({ oosId, record, approvals }: { oosId: string; record: OosRecord; approvals: OosApproval[] }) {
  const pending = approvals.find((a) => ['Pending', 'Escalated'].includes(a.approval_status || ''));
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Approval Workflow</CardTitle>
          <CardDescription>Full GMP-compliant review, e-signature, and escalation</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {pending && (
            <p className="text-sm">
              Current step: <strong>{pending.current_workflow_step}</strong> — {pending.approval_status}
              {pending.due_date && <span className="text-muted-foreground"> · Due {pending.due_date}</span>}
            </p>
          )}
          <Link href={`/qms/oos/${oosId}/approval`}>
            <Button className="bg-blue-600 hover:bg-blue-700 gap-1"><CheckCircle className="h-4 w-4" />Open Approval Workflow</Button>
          </Link>
          <Link href="/qms/oos/approval" className="block">
            <Button variant="outline" size="sm">Approval Dashboard</Button>
          </Link>
        </CardContent>
      </Card>
      {approvals.filter((a) => a.approval_status === 'Approved' || a.approver_name).map((a) => (
        <Card key={a.id}><CardContent className="p-4">
          <p className="font-medium">{a.current_workflow_step} — {a.approver_name} ({a.approver_role})</p>
          <p className="text-sm text-muted-foreground">{a.comments}</p>
          <OosStatusBadge status={a.approval_status || a.decision} />
        </CardContent></Card>
      ))}
      {!approvals.length && record.status !== 'draft' && (
        <p className="text-sm text-muted-foreground">Approval workflow will initialize when OOS is submitted.</p>
      )}
    </div>
  );
}
