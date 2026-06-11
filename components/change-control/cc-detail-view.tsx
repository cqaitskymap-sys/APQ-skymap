'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Printer, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { CcStatusBadge, CcPriorityBadge, CcCategoryBadge } from './cc-sub-nav';
import { CcPdfDocument } from './cc-pdf-document';
import {
  impactAssessmentSchema, riskAssessmentSchema, implementationActionSchema,
  effectivenessReviewSchema, changeApprovalSchema,
  type ImpactAssessmentInput, type RiskAssessmentInput, type ImplementationActionInput,
  type EffectivenessReviewInput, type ChangeApprovalInput,
} from '@/lib/change-control-schemas';
import {
  getImpactAssessment, getRiskAssessment, getImplementationActions, getEffectivenessReview,
  getApprovals, getAttachments, getAuditLogsForChange, submitChange, saveImpactAssessment,
  saveRiskAssessment, addImplementationAction, completeImplementationAction,
  saveEffectivenessReview, submitApproval, closeChange, uploadAttachment,
} from '@/lib/change-control-service';
import type {
  ChangeControlRecord, ChangeImpactAssessment, ChangeRiskAssessment,
  ChangeImplementationAction, ChangeEffectivenessReview, ChangeApproval, ChangeAttachment,
} from '@/lib/change-control-types';
import {
  canApproveChange, isCcReadOnly, requiresHeadQaApproval, requiresRegulatoryReview,
  calculateRpn, rpnToLevel,
} from '@/lib/change-control-types';
import { printPage } from '@/lib/export-utils';
import { useCcActor } from '@/hooks/use-change-control';

interface CcDetailViewProps {
  record: ChangeControlRecord;
  onRefresh: () => void;
  defaultTab?: string;
}

export function CcDetailView({ record, onRefresh, defaultTab = 'overview' }: CcDetailViewProps) {
  const actor = useCcActor();
  const readOnly = isCcReadOnly(actor.role);
  const [impact, setImpact] = useState<ChangeImpactAssessment | null>(null);
  const [risk, setRisk] = useState<ChangeRiskAssessment | null>(null);
  const [actions, setActions] = useState<ChangeImplementationAction[]>([]);
  const [effectiveness, setEffectiveness] = useState<ChangeEffectivenessReview | null>(null);
  const [approvals, setApprovals] = useState<ChangeApproval[]>([]);
  const [attachments, setAttachments] = useState<ChangeAttachment[]>([]);
  const [auditLogs, setAuditLogs] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadSub = async () => {
    setLoading(true);
    const [imp, rsk, act, eff, ap, att, al] = await Promise.all([
      getImpactAssessment(record.id),
      getRiskAssessment(record.id),
      getImplementationActions(record.id),
      getEffectivenessReview(record.id),
      getApprovals(record.id),
      getAttachments(record.id),
      getAuditLogsForChange(record.id),
    ]);
    setImpact(imp);
    setRisk(rsk);
    setActions(act);
    setEffectiveness(eff);
    setApprovals(ap);
    setAttachments(att);
    setAuditLogs(al);
    setLoading(false);
  };

  useEffect(() => { void loadSub(); }, [record.id]);

  const impactForm = useForm<ImpactAssessmentInput>({
    resolver: zodResolver(impactAssessmentSchema),
    defaultValues: impact || {
      quality_impact: '', safety_impact: '', efficacy_impact: '', process_impact: '',
      equipment_impact: '', utility_impact: '', cleaning_impact: '', validation_impact: '',
      stability_impact: '', regulatory_impact: '', documentation_impact: '', training_impact: '',
      computerized_system_impact: '', remarks: '',
    },
  });

  useEffect(() => {
    if (impact) impactForm.reset(impact);
  }, [impact]);

  const riskForm = useForm<RiskAssessmentInput>({
    resolver: zodResolver(riskAssessmentSchema),
    defaultValues: risk ? {
      severity: risk.severity, occurrence: risk.occurrence,
      detectability: risk.detectability, mitigation_plan: risk.mitigation_plan,
    } : { severity: 1, occurrence: 1, detectability: 1, mitigation_plan: '' },
  });

  const implForm = useForm<ImplementationActionInput>({
    resolver: zodResolver(implementationActionSchema),
    defaultValues: {
      action_item: '', responsible_person_name: actor.name, target_date: record.planned_implementation_date,
      evidence: '', remarks: '', action_type: 'general',
    },
  });

  const effForm = useForm<EffectivenessReviewInput>({
    resolver: zodResolver(effectivenessReviewSchema),
    defaultValues: {
      effectiveness_criteria: '', review_date: new Date().toISOString().split('T')[0],
      result: 'Effective', conclusion: '', further_action_required: false,
    },
  });

  const approvalForm = useForm<ChangeApprovalInput>({
    resolver: zodResolver(changeApprovalSchema),
    defaultValues: { decision: 'approved', comments: '', e_signature: actor.name },
  });

  const sev = riskForm.watch('severity') || 1;
  const occ = riskForm.watch('occurrence') || 1;
  const det = riskForm.watch('detectability') || 1;
  const liveRpn = calculateRpn(sev, occ, det);
  const liveLevel = rpnToLevel(liveRpn);

  const handleSubmit = async () => {
    try {
      setSaving(true);
      await submitChange(record.id, actor);
      toast.success('Change control submitted');
      onRefresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Submit failed');
    } finally { setSaving(false); }
  };

  const handleClose = async () => {
    try {
      setSaving(true);
      await closeChange(record.id, actor);
      toast.success('Change control closed');
      onRefresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Close failed');
    } finally { setSaving(false); }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await uploadAttachment(record.id, file, actor);
      toast.success('Attachment uploaded');
      await loadSub();
    } catch {
      toast.error('Upload failed');
    }
  };

  if (loading) return <LoadingSpinner label="Loading change control..." />;

  const canClose = ['approved', 'implemented', 'effectiveness_completed', 'approved_for_implementation'].includes(record.status);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h1 className="text-xl font-bold font-mono">{record.change_control_number}</h1>
            <CcStatusBadge status={record.status} />
            <CcPriorityBadge priority={record.change_priority} />
            <CcCategoryBadge category={record.change_category} />
          </div>
          <p className="text-muted-foreground">{record.change_title}</p>
          <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
            {record.regulatory_impact && <span className="text-amber-600">Regulatory review required</span>}
            {requiresHeadQaApproval(record.change_category) && <span className="text-red-600">Head QA approval required</span>}
            {record.pqr_id && <Link href={`/dashboard/pqr/${record.pqr_id}`} className="text-blue-600 underline">Linked PQR</Link>}
          </div>
        </div>
        <div className="no-print flex flex-wrap gap-2">
          {record.status === 'draft' && !readOnly && (
            <Button onClick={handleSubmit} disabled={saving} className="bg-blue-600">Submit Change</Button>
          )}
          {canClose && canApproveChange(actor.role) && !readOnly && (
            <Button variant="outline" onClick={handleClose} disabled={saving}>Close Change</Button>
          )}
          <Button variant="outline" onClick={() => printPage()} className="gap-1"><Printer className="h-4 w-4" />Print PDF</Button>
        </div>
      </div>

      <Tabs defaultValue={defaultTab}>
        <TabsList className="flex h-auto flex-wrap">
          {['overview', 'impact', 'risk', 'implementation', 'effectiveness', 'capa', 'attachments', 'approval', 'audit'].map((t) => (
            <TabsTrigger key={t} value={t} className="capitalize">{t === 'capa' ? 'Linked CAPA' : t.replace('-', ' ')}</TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <Card>
            <CardContent className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
              {[
                ['Change Date', record.change_date],
                ['Department', record.department],
                ['Initiated By', record.initiated_by_name],
                ['Product', record.product_name || '—'],
                ['Batch', record.batch_number || '—'],
                ['Change Type', record.change_type],
                ['Category', record.change_category],
                ['Priority', record.change_priority],
                ['Temporary/Permanent', record.temporary_permanent],
                ['Planned Implementation', record.planned_implementation_date || '—'],
                ['Actual Implementation', record.actual_implementation_date || '—'],
              ].map(([k, v]) => (
                <div key={String(k)}><span className="text-muted-foreground">{k}: </span><strong>{v}</strong></div>
              ))}
              <div className="md:col-span-3"><span className="text-muted-foreground">Description: </span>{record.change_description}</div>
              <div className="md:col-span-3"><span className="text-muted-foreground">Current: </span>{record.current_system}</div>
              <div className="md:col-span-3"><span className="text-muted-foreground">Proposed: </span>{record.proposed_change}</div>
              <div className="md:col-span-3"><span className="text-muted-foreground">Reason: </span>{record.reason_for_change}</div>
              {record.qa_remarks && <div className="md:col-span-3"><span className="text-muted-foreground">QA Remarks: </span>{record.qa_remarks}</div>}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="impact" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Impact Assessment</CardTitle></CardHeader>
            <CardContent>
              {!readOnly ? (
                <Form {...impactForm}>
                  <form onSubmit={impactForm.handleSubmit(async (data) => {
                    try {
                      setSaving(true);
                      await saveImpactAssessment(record.id, data, actor);
                      toast.success('Impact assessment saved');
                      onRefresh();
                      await loadSub();
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : 'Save failed');
                    } finally { setSaving(false); }
                  })} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {([
                        ['quality_impact', 'Quality Impact *'],
                        ['safety_impact', 'Safety Impact *'],
                        ['efficacy_impact', 'Efficacy Impact *'],
                        ['process_impact', 'Process Impact *'],
                        ['equipment_impact', 'Equipment Impact'],
                        ['utility_impact', 'Utility Impact'],
                        ['cleaning_impact', 'Cleaning Impact'],
                        ['validation_impact', 'Validation Impact'],
                        ['stability_impact', 'Stability Impact'],
                        ['regulatory_impact', 'Regulatory Impact'],
                        ['documentation_impact', 'Documentation Impact'],
                        ['training_impact', 'Training Impact'],
                        ['computerized_system_impact', 'Computerized System Impact'],
                      ] as const).map(([name, label]) => (
                        <FormField key={name} control={impactForm.control} name={name} render={({ field }) => (
                          <FormItem><FormLabel>{label}</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                      ))}
                    </div>
                    <FormField control={impactForm.control} name="remarks" render={({ field }) => (
                      <FormItem><FormLabel>Remarks</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <Button type="submit" disabled={saving}>Save Impact Assessment</Button>
                  </form>
                </Form>
              ) : impact ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  {Object.entries(impact).filter(([k]) => !['id', 'change_id', 'assessed_by', 'assessed_by_name', 'assessed_at', 'created_at', 'updated_at'].includes(k)).map(([k, v]) => (
                    <div key={k}><span className="text-muted-foreground capitalize">{k.replace(/_/g, ' ')}: </span>{String(v)}</div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">No impact assessment recorded.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="risk" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Risk Assessment (FMEA)</CardTitle></CardHeader>
            <CardContent>
              {!readOnly && record.risk_assessment_required ? (
                <Form {...riskForm}>
                  <form onSubmit={riskForm.handleSubmit(async (data) => {
                    try {
                      setSaving(true);
                      await saveRiskAssessment(record.id, data, actor);
                      toast.success('Risk assessment saved');
                      onRefresh();
                      await loadSub();
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : 'Save failed');
                    } finally { setSaving(false); }
                  })} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {(['severity', 'occurrence', 'detectability'] as const).map((name) => (
                        <FormField key={name} control={riskForm.control} name={name} render={({ field }) => (
                          <FormItem><FormLabel className="capitalize">{name} (1–5) *</FormLabel>
                            <FormControl><Input type="number" min={1} max={5} {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                      ))}
                    </div>
                    <div className="rounded-lg border p-4 bg-muted/50 flex flex-wrap gap-6 text-sm">
                      <div><span className="text-muted-foreground">RPN: </span><strong className="text-lg">{liveRpn}</strong></div>
                      <div><span className="text-muted-foreground">Risk Level: </span><strong className="text-lg">{liveLevel}</strong></div>
                    </div>
                    <FormField control={riskForm.control} name="mitigation_plan" render={({ field }) => (
                      <FormItem><FormLabel>Mitigation Plan *</FormLabel><FormControl><Textarea rows={4} {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <Button type="submit" disabled={saving}>Save Risk Assessment</Button>
                  </form>
                </Form>
              ) : risk ? (
                <div className="text-sm space-y-2">
                  <p><strong>Severity:</strong> {risk.severity} | <strong>Occurrence:</strong> {risk.occurrence} | <strong>Detectability:</strong> {risk.detectability}</p>
                  <p><strong>RPN:</strong> {risk.rpn} | <strong>Risk Level:</strong> {risk.risk_level}</p>
                  <p><strong>Mitigation:</strong> {risk.mitigation_plan}</p>
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">Risk assessment not required or not completed.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="implementation" className="mt-4 space-y-4">
          {!readOnly && (
            <Card>
              <CardHeader><CardTitle className="text-base">Add Action Item</CardTitle></CardHeader>
              <CardContent>
                <Form {...implForm}>
                  <form onSubmit={implForm.handleSubmit(async (data) => {
                    try {
                      setSaving(true);
                      await addImplementationAction(record.id, {
                        action_item: data.action_item,
                        responsible_person: actor.id,
                        responsible_person_name: data.responsible_person_name,
                        target_date: data.target_date || null,
                        completion_date: null,
                        status: 'pending',
                        evidence: data.evidence,
                        remarks: data.remarks,
                        action_type: data.action_type,
                      }, actor);
                      toast.success('Action added');
                      implForm.reset({ action_item: '', responsible_person_name: actor.name, target_date: record.planned_implementation_date, evidence: '', remarks: '', action_type: 'general' });
                      await loadSub();
                      onRefresh();
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : 'Failed');
                    } finally { setSaving(false); }
                  })} className="space-y-4">
                    <FormField control={implForm.control} name="action_item" render={({ field }) => (
                      <FormItem><FormLabel>Action Item *</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <FormField control={implForm.control} name="responsible_person_name" render={({ field }) => (
                        <FormItem><FormLabel>Responsible Person *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={implForm.control} name="target_date" render={({ field }) => (
                        <FormItem><FormLabel>Target Date</FormLabel><FormControl><Input type="date" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={implForm.control} name="action_type" render={({ field }) => (
                        <FormItem><FormLabel>Type</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                            <SelectContent>
                              {['general', 'validation', 'training', 'csv'].map((t) => (
                                <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select><FormMessage /></FormItem>
                      )} />
                    </div>
                    <Button type="submit" disabled={saving}>Add Action</Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          )}
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Action</TableHead><TableHead>Owner</TableHead><TableHead>Target</TableHead><TableHead>Status</TableHead><TableHead>Type</TableHead><TableHead></TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {actions.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">No implementation actions</TableCell></TableRow>
                  ) : actions.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="max-w-[200px]">{a.action_item}</TableCell>
                      <TableCell>{a.responsible_person_name}</TableCell>
                      <TableCell>{a.target_date || '—'}</TableCell>
                      <TableCell className="capitalize">{a.status}</TableCell>
                      <TableCell className="capitalize">{a.action_type}</TableCell>
                      <TableCell>
                        {!readOnly && a.status !== 'completed' && (
                          <Button size="sm" variant="outline" disabled={saving} onClick={async () => {
                            try {
                              setSaving(true);
                              await completeImplementationAction(a.id, record.id, {
                                completion_date: new Date().toISOString().split('T')[0],
                                evidence: a.evidence || 'Completed',
                                status: 'completed',
                              }, actor);
                              toast.success('Action completed');
                              await loadSub();
                              onRefresh();
                            } catch (e) {
                              toast.error(e instanceof Error ? e.message : 'Failed');
                            } finally { setSaving(false); }
                          }}>Complete</Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="effectiveness" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Effectiveness Review</CardTitle></CardHeader>
            <CardContent>
              {effectiveness ? (
                <div className="text-sm space-y-2">
                  <p><strong>Result:</strong> {effectiveness.result}</p>
                  <p><strong>Criteria:</strong> {effectiveness.effectiveness_criteria}</p>
                  <p><strong>Conclusion:</strong> {effectiveness.conclusion}</p>
                  {effectiveness.result === 'Not Effective' && (
                    <p className="text-red-600 font-medium">Further action required — closure blocked until resolved.</p>
                  )}
                </div>
              ) : record.effectiveness_check_required && !readOnly ? (
                <Form {...effForm}>
                  <form onSubmit={effForm.handleSubmit(async (data) => {
                    try {
                      setSaving(true);
                      await saveEffectivenessReview(record.id, data, actor);
                      toast.success('Effectiveness review saved');
                      onRefresh();
                      await loadSub();
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : 'Failed');
                    } finally { setSaving(false); }
                  })} className="space-y-4">
                    <FormField control={effForm.control} name="effectiveness_criteria" render={({ field }) => (
                      <FormItem><FormLabel>Effectiveness Criteria *</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={effForm.control} name="review_date" render={({ field }) => (
                      <FormItem><FormLabel>Review Date *</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={effForm.control} name="result" render={({ field }) => (
                      <FormItem><FormLabel>Result *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                          <SelectContent>
                            {['Effective', 'Not Effective', 'Partially Effective'].map((r) => (
                              <SelectItem key={r} value={r}>{r}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select><FormMessage /></FormItem>
                    )} />
                    <FormField control={effForm.control} name="conclusion" render={({ field }) => (
                      <FormItem><FormLabel>Conclusion *</FormLabel><FormControl><Textarea rows={3} {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <Button type="submit" disabled={saving}>Submit Effectiveness Review</Button>
                  </form>
                </Form>
              ) : (
                <p className="text-muted-foreground text-sm">Effectiveness check not required or not yet due.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="capa" className="mt-4">
          <Card>
            <CardContent className="p-4 text-sm space-y-2">
              {record.linked_capa_id ? (
                <Link href={`/qms/capa/${record.linked_capa_id}`} className="text-blue-600 underline">
                  View linked CAPA {record.linked_capa_number}
                </Link>
              ) : record.capa_required ? (
                <p className="text-amber-600">CAPA required — create from CAPA module and link reference: {record.change_control_number}</p>
              ) : (
                <p className="text-muted-foreground">No CAPA linkage required.</p>
              )}
              <div className="pt-2 border-t space-y-1 text-muted-foreground">
                <p>Integrations: PQR, CPV Risk, Deviation, OOS, Validation, Training, DMS, Equipment</p>
                {record.batch_id && <Link href={`/pqr/batches`} className="text-blue-600 underline block">Batch module</Link>}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="attachments" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Attachments</CardTitle>
              {!readOnly && (
                <label className="cursor-pointer">
                  <Button variant="outline" size="sm" className="gap-1" asChild><span><Upload className="h-4 w-4" />Upload</span></Button>
                  <input type="file" className="hidden" onChange={handleFileUpload} />
                </label>
              )}
            </CardHeader>
            <CardContent>
              {attachments.length === 0 ? (
                <p className="text-sm text-muted-foreground">No attachments</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {attachments.map((a) => (
                    <li key={a.id}><a href={a.file_url} target="_blank" rel="noreferrer" className="text-blue-600 underline">{a.file_name}</a> — {a.uploaded_by_name}</li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="approval" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Approval Workflow</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {requiresRegulatoryReview(record) && (
                <p className="text-sm text-amber-600">Regulatory Affairs review is mandatory for this change.</p>
              )}
              {requiresHeadQaApproval(record.change_category) && (
                <p className="text-sm text-red-600">Head QA final approval required (Critical category).</p>
              )}
              {approvals.length > 0 && (
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Approver</TableHead><TableHead>Level</TableHead><TableHead>Decision</TableHead><TableHead>Date</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {approvals.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell>{a.approver_name}</TableCell>
                        <TableCell>{a.approval_level.replace(/_/g, ' ')}</TableCell>
                        <TableCell className="capitalize">{a.decision}</TableCell>
                        <TableCell>{new Date(a.signed_at).toLocaleDateString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              {canApproveChange(actor.role) && !readOnly && !['closed', 'rejected', 'cancelled', 'draft'].includes(record.status) && (
                <Form {...approvalForm}>
                  <form className="space-y-4 border-t pt-4">
                    <FormField control={approvalForm.control} name="comments" render={({ field }) => (
                      <FormItem><FormLabel>Comments *</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={approvalForm.control} name="e_signature" render={({ field }) => (
                      <FormItem><FormLabel>E-Signature *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <div className="flex gap-2">
                      <Button type="button" disabled={saving} onClick={approvalForm.handleSubmit(async (data) => {
                        try {
                          setSaving(true);
                          await submitApproval(record.id, { ...data, decision: 'approved' }, actor);
                          toast.success('Change approved');
                          onRefresh();
                          await loadSub();
                        } catch (e) {
                          toast.error(e instanceof Error ? e.message : 'Approval failed');
                        } finally { setSaving(false); }
                      })}>Approve</Button>
                      <Button type="button" variant="destructive" disabled={saving} onClick={approvalForm.handleSubmit(async (data) => {
                        try {
                          setSaving(true);
                          await submitApproval(record.id, { ...data, decision: 'rejected' }, actor);
                          toast.success('Change rejected');
                          onRefresh();
                          await loadSub();
                        } catch (e) {
                          toast.error(e instanceof Error ? e.message : 'Rejection failed');
                        } finally { setSaving(false); }
                      })}>Reject</Button>
                    </div>
                  </form>
                </Form>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="mt-4">
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Action</TableHead><TableHead>User</TableHead><TableHead>Date</TableHead></TableRow></TableHeader>
                <TableBody>
                  {auditLogs.length === 0 ? (
                    <TableRow><TableCell colSpan={3} className="text-center py-6 text-muted-foreground">No audit entries</TableCell></TableRow>
                  ) : auditLogs.map((log, i) => (
                    <TableRow key={i}>
                      <TableCell>{String(log.action || '')}</TableCell>
                      <TableCell>{String(log.userName || log.user_name || '')}</TableCell>
                      <TableCell>{String(log.dateTime || log.timestamp || '')}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div id="cc-pdf-document" className="sr-only">
        <CcPdfDocument
          record={record}
          impact={impact}
          risk={risk}
          actions={actions}
          effectiveness={effectiveness}
          approvals={approvals}
          auditLogs={auditLogs}
        />
      </div>
    </div>
  );
}
