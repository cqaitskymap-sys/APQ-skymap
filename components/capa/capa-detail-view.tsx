'use client';

import { useCallback, useEffect, useState } from 'react';
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
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { CapaStatusBadge, CapaPriorityBadge } from './capa-sub-nav';
import { CapaPdfDocument } from './capa-pdf-document';
import {
  capaRootCauseSchema, capaImplementationSchema, capaEffectivenessSchema, capaApprovalSchema,
  type CapaRootCauseInput, type CapaImplementationInput, type CapaEffectivenessInput, type CapaApprovalInput,
} from '@/lib/capa-schemas';
import {
  getCapaActions, getCapaEffectiveness, getCapaApprovals, getCapaAttachments,
  getCapaSourceLinks, getAuditLogsForCapa, submitCapa, updateRootCause,
  updateImplementation, submitEffectiveness, submitApproval, closeCapa, uploadCapaAttachment,
} from '@/lib/capa-service';
import type { CapaRecord, CapaAction, CapaEffectiveness, CapaApproval, CapaAttachment, CapaSourceLink } from '@/lib/capa-types';
import { canApproveCapa, isCapaReadOnly } from '@/lib/capa-types';
import { printPage } from '@/lib/export-utils';
import { useCapaActor } from '@/hooks/use-capa';

interface CapaDetailViewProps {
  record: CapaRecord;
  onRefresh: () => void;
}

export function CapaDetailView({ record, onRefresh }: CapaDetailViewProps) {
  const actor = useCapaActor();
  const readOnly = isCapaReadOnly(actor.role);
  const [actions, setActions] = useState<CapaAction[]>([]);
  const [effectiveness, setEffectiveness] = useState<CapaEffectiveness | null>(null);
  const [approvals, setApprovals] = useState<CapaApproval[]>([]);
  const [attachments, setAttachments] = useState<CapaAttachment[]>([]);
  const [sourceLinks, setSourceLinks] = useState<CapaSourceLink[]>([]);
  const [auditLogs, setAuditLogs] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadSub = useCallback(async () => {
    setLoading(true);
    const [a, e, ap, att, sl, al] = await Promise.all([
      getCapaActions(record.id),
      getCapaEffectiveness(record.id),
      getCapaApprovals(record.id),
      getCapaAttachments(record.id),
      getCapaSourceLinks(record.id),
      getAuditLogsForCapa(record.id),
    ]);
    setActions(a);
    setEffectiveness(e);
    setApprovals(ap);
    setAttachments(att);
    setSourceLinks(sl);
    setAuditLogs(al);
    setLoading(false);
  }, [record.id]);

  useEffect(() => { void loadSub(); }, [loadSub]);

  const rootForm = useForm<CapaRootCauseInput>({
    resolver: zodResolver(capaRootCauseSchema),
    defaultValues: {
      root_cause: record.root_cause,
      corrective_action: record.corrective_action,
      preventive_action: record.preventive_action,
    },
  });

  const implForm = useForm<CapaImplementationInput>({
    resolver: zodResolver(capaImplementationSchema),
    defaultValues: {
      actual_completion_date: record.actual_completion_date || new Date().toISOString().split('T')[0],
      implementation_evidence: '',
    },
  });

  const effForm = useForm<CapaEffectivenessInput>({
    resolver: zodResolver(capaEffectivenessSchema),
    defaultValues: {
      check_date: new Date().toISOString().split('T')[0],
      criteria: record.effectiveness_criteria,
      result: 'Pending',
      evidence: '',
      remarks: '',
    },
  });

  const approvalForm = useForm<CapaApprovalInput>({
    resolver: zodResolver(capaApprovalSchema),
    defaultValues: { decision: 'approved', comments: '', e_signature: actor.name },
  });

  const handleSubmit = async () => {
    try {
      setSaving(true);
      await submitCapa(record.id, actor);
      toast.success('CAPA submitted');
      onRefresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Submit failed');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = async () => {
    try {
      setSaving(true);
      await closeCapa(record.id, actor);
      toast.success('CAPA closed');
      onRefresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Close failed');
    } finally {
      setSaving(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await uploadCapaAttachment(record.id, file, actor);
      toast.success('Attachment uploaded');
      await loadSub();
    } catch {
      toast.error('Upload failed');
    }
  };

  if (loading) return <LoadingSpinner label="Loading CAPA details..." />;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h1 className="text-xl font-bold font-mono">{record.capa_number}</h1>
            <CapaStatusBadge status={record.capa_status} />
            <CapaPriorityBadge priority={record.priority} />
          </div>
          <p className="text-muted-foreground">{record.capa_title}</p>
        </div>
        <div className="no-print flex flex-wrap gap-2">
          <Link href={`/qms/capa/${record.id}/investigation`}>
            <Button variant="outline" className="gap-1">Investigation & RCA</Button>
          </Link>
          <Link href={`/qms/capa/${record.id}/corrective-action`}>
            <Button variant="outline" className="gap-1">Corrective Actions</Button>
          </Link>
          <Link href={`/qms/capa/${record.id}/preventive-action`}>
            <Button variant="outline" className="gap-1">Preventive Actions</Button>
          </Link>
          {record.capa_status === 'draft' && !readOnly && (
            <Button onClick={handleSubmit} disabled={saving} className="bg-blue-600">Submit CAPA</Button>
          )}
          {['approved', 'effectiveness_completed', 'implemented'].includes(record.capa_status) && canApproveCapa(actor.role) && (
            <Button variant="outline" onClick={handleClose} disabled={saving}>Close CAPA</Button>
          )}
          <Button variant="outline" onClick={() => printPage()} className="gap-1"><Printer className="h-4 w-4" />Print PDF</Button>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="flex h-auto flex-wrap">
          {['overview', 'source', 'root-cause', 'actions', 'implementation', 'effectiveness', 'attachments', 'approval', 'audit'].map((t) => (
            <TabsTrigger key={t} value={t} className="capitalize">{t.replace('-', ' ')}</TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <Card>
            <CardContent className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              {[
                ['CAPA Date', record.capa_date],
                ['Source', `${record.capa_source} (${record.source_reference_number})`],
                ['Department', record.department],
                ['Product', record.product_name],
                ['Batch', record.batch_number || '—'],
                ['Owner', record.action_owner_name],
                ['Target Date', record.target_completion_date || '—'],
                ['Actual Date', record.actual_completion_date || '—'],
                ['Effectiveness', record.effectiveness_result],
              ].map(([k, v]) => (
                <div key={String(k)}><span className="text-muted-foreground">{k}: </span><strong>{v}</strong></div>
              ))}
              <div className="md:col-span-2"><span className="text-muted-foreground">Problem: </span>{record.problem_description}</div>
              {record.qa_remarks && <div className="md:col-span-2"><span className="text-muted-foreground">QA Remarks: </span>{record.qa_remarks}</div>}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="source" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Source Link</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p><strong>Source:</strong> {record.capa_source}</p>
              <p><strong>Reference:</strong> {record.source_reference_number}</p>
              {record.deviation_id && <Link href={`/qms/deviation/${record.deviation_id}`} className="text-blue-600 underline">View linked Deviation</Link>}
              {record.oos_id && <Link href={`/qms/oos/${record.oos_id}`} className="text-blue-600 underline block">View linked OOS</Link>}
              {sourceLinks.map((l) => (
                <p key={l.id} className="text-muted-foreground">{l.source_type}: {l.source_number} — linked {new Date(l.linked_at).toLocaleDateString()}</p>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="root-cause" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Root Cause & Actions</CardTitle></CardHeader>
            <CardContent>
              {!readOnly ? (
                <Form {...rootForm}>
                  <form onSubmit={rootForm.handleSubmit(async (data) => {
                    try {
                      setSaving(true);
                      await updateRootCause(record.id, data, actor);
                      toast.success('Root cause updated');
                      onRefresh();
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : 'Update failed');
                    } finally { setSaving(false); }
                  })} className="space-y-4">
                    <FormField control={rootForm.control} name="root_cause" render={({ field }) => (
                      <FormItem><FormLabel>Root Cause *</FormLabel><FormControl><Textarea rows={4} {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={rootForm.control} name="corrective_action" render={({ field }) => (
                      <FormItem><FormLabel>Corrective Action *</FormLabel><FormControl><Textarea rows={3} {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={rootForm.control} name="preventive_action" render={({ field }) => (
                      <FormItem><FormLabel>Preventive Action *</FormLabel><FormControl><Textarea rows={3} {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <Button type="submit" disabled={saving}>Save</Button>
                  </form>
                </Form>
              ) : (
                <div className="space-y-2 text-sm">
                  <p><strong>Root Cause:</strong> {record.root_cause || '—'}</p>
                  <p><strong>Corrective:</strong> {record.corrective_action || '—'}</p>
                  <p><strong>Preventive:</strong> {record.preventive_action || '—'}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="actions" className="mt-4">
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Type</TableHead><TableHead>Description</TableHead><TableHead>Owner</TableHead><TableHead>Status</TableHead><TableHead>Completed</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {actions.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">No action records yet</TableCell></TableRow>
                  ) : actions.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="capitalize">{a.action_type}</TableCell>
                      <TableCell>{a.description}</TableCell>
                      <TableCell>{a.owner_name}</TableCell>
                      <TableCell>{a.status}</TableCell>
                      <TableCell>{a.completed_date || '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="implementation" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Implementation</CardTitle></CardHeader>
            <CardContent>
              {!readOnly ? (
                <Form {...implForm}>
                  <form onSubmit={implForm.handleSubmit(async (data) => {
                    try {
                      setSaving(true);
                      await updateImplementation(record.id, {
                        actual_completion_date: data.actual_completion_date,
                        implementation_evidence: data.implementation_evidence,
                      }, actor);
                      toast.success('Implementation recorded');
                      onRefresh();
                      await loadSub();
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : 'Failed');
                    } finally { setSaving(false); }
                  })} className="space-y-4">
                    <FormField control={implForm.control} name="actual_completion_date" render={({ field }) => (
                      <FormItem><FormLabel>Actual Completion Date *</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={implForm.control} name="implementation_evidence" render={({ field }) => (
                      <FormItem><FormLabel>Implementation Evidence *</FormLabel><FormControl><Textarea rows={4} {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <Button type="submit" disabled={saving}>Save Implementation</Button>
                  </form>
                </Form>
              ) : (
                <p className="text-sm text-muted-foreground">Read-only access</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="effectiveness" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Effectiveness Check</CardTitle>
              <Link href={`/qms/capa/${record.id}/effectiveness`}>
                <Button variant="outline" size="sm">Open Full Review</Button>
              </Link>
            </CardHeader>
            <CardContent>
              {effectiveness ? (
                <div className="text-sm space-y-2">
                  <p><strong>Result:</strong> {effectiveness.result}</p>
                  <p><strong>Criteria:</strong> {effectiveness.criteria}</p>
                  <p><strong>Evidence:</strong> {effectiveness.evidence}</p>
                  {effectiveness.result === 'Not Effective' && (
                    <p className="text-red-600 font-medium">Follow-up CAPA or extension required per GMP procedure.</p>
                  )}
                </div>
              ) : record.effectiveness_check_required && !readOnly ? (
                <Form {...effForm}>
                  <form onSubmit={effForm.handleSubmit(async (data) => {
                    try {
                      setSaving(true);
                      await submitEffectiveness(record.id, data, actor);
                      toast.success('Effectiveness check saved');
                      onRefresh();
                      await loadSub();
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : 'Failed');
                    } finally { setSaving(false); }
                  })} className="space-y-4">
                    <FormField control={effForm.control} name="check_date" render={({ field }) => (
                      <FormItem><FormLabel>Check Date *</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={effForm.control} name="criteria" render={({ field }) => (
                      <FormItem><FormLabel>Criteria *</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={effForm.control} name="result" render={({ field }) => (
                      <FormItem><FormLabel>Result *</FormLabel>
                        <SelectField value={field.value} onChange={field.onChange} options={['Effective', 'Not Effective', 'Pending']} />
                        <FormMessage /></FormItem>
                    )} />
                    <FormField control={effForm.control} name="evidence" render={({ field }) => (
                      <FormItem><FormLabel>Evidence *</FormLabel><FormControl><Textarea rows={3} {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <Button type="submit" disabled={saving}>Submit Effectiveness</Button>
                  </form>
                </Form>
              ) : (
                <p className="text-muted-foreground text-sm">Effectiveness check not required or already completed.</p>
              )}
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
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Approval History</CardTitle>
              <Link href={`/qms/capa/${record.id}/approval`}>
                <Button variant="outline" size="sm">Open Approval Workflow</Button>
              </Link>
            </CardHeader>
            <CardContent className="space-y-4">
              {approvals.length > 0 && (
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Approver</TableHead><TableHead>Level</TableHead><TableHead>Decision</TableHead><TableHead>Date</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {approvals.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell>{a.approver_name}</TableCell>
                        <TableCell>{a.approval_level}</TableCell>
                        <TableCell className="capitalize">{a.decision}</TableCell>
                        <TableCell>{a.signed_at ? new Date(a.signed_at).toLocaleDateString() : '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              {canApproveCapa(actor.role) && !readOnly && ['effectiveness_completed', 'qa_review', 'implemented'].includes(record.capa_status) && (
                <Form {...approvalForm}>
                  <form onSubmit={approvalForm.handleSubmit(async (data) => {
                    try {
                      setSaving(true);
                      await submitApproval(record.id, data, actor);
                      toast.success(data.decision === 'approved' ? 'CAPA approved' : 'CAPA rejected');
                      onRefresh();
                      await loadSub();
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : 'Approval failed');
                    } finally { setSaving(false); }
                  })} className="space-y-4 border-t pt-4">
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
                          toast.success('CAPA approved');
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
                          toast.success('CAPA rejected');
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
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base">Audit Trail</CardTitle>
              <Link href={`/qms/capa/${record.id}/audit-trail`}>
                <Button variant="outline" size="sm">View Full Audit Trail</Button>
              </Link>
            </CardHeader>
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

      <div className="hidden print:block">
        <CapaPdfDocument
          record={record}
          actions={actions}
          effectiveness={effectiveness}
          approvals={approvals}
          sourceLinks={sourceLinks}
          auditLogs={auditLogs}
        />
      </div>
      <div id="capa-pdf-document" className="sr-only">
        <CapaPdfDocument
          record={record}
          actions={actions}
          effectiveness={effectiveness}
          approvals={approvals}
          sourceLinks={sourceLinks}
          auditLogs={auditLogs}
        />
      </div>
    </div>
  );
}

function SelectField({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}
