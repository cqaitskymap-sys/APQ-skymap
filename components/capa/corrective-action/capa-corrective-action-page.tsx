'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  ArrowLeft, Loader2, Paperclip, Plus, Save, Send, UserPlus,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/auth-context';
import {
  canApproveCriticalCapaCorrectiveAction,
  canCreateCapaCorrectiveAction,
  canUpdateCapaCorrectiveActionImplementation,
  canVerifyCapaCorrectiveAction,
  isCapaCorrectiveActionReadOnly,
  mapAuditToCorrectiveActionTimeline,
} from '@/lib/capa-corrective-action-records';
import { isInvestigationApproved } from '@/lib/capa-investigation-records';
import {
  assignCapaCorrectiveAction,
  closeCapaCorrectiveAction,
  createCapaCorrectiveAction,
  fetchCapaCorrectiveActionPageData,
  submitCapaCorrectiveActionForVerification,
  updateCapaCorrectiveActionImplementation,
  uploadCapaCorrectiveActionEvidence,
  verifyCapaCorrectiveAction,
} from '@/lib/capa-corrective-action-service';
import {
  capaCorrectiveActionImplementationSchema,
  capaCorrectiveActionSchema,
  capaCorrectiveActionVerificationSchema,
  type CapaCorrectiveActionInput,
} from '@/lib/capa-corrective-action-schemas';
import { CAPA_CA_IMPLEMENTATION_STATUSES, CAPA_CA_PRIORITIES, CAPA_DEPARTMENTS, type CapaCorrectiveAction, type CapaRecord } from '@/lib/capa-types';
import { CpvPageHeader } from '@/components/cpv/product-master/cpv-page-header';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { CapaStatusBadge, CapaPriorityBadge } from '@/components/capa/capa-sub-nav';
import { CapaCorrectiveActionAccessGuard } from './capa-corrective-action-access-guard';
import { CapaCorrectiveActionStatusBadge, CapaImplementationStatusBadge } from './capa-corrective-action-badges';
import { CapaCorrectiveActionProgress } from './capa-corrective-action-progress';
import { CapaCorrectiveActionTimeline } from './capa-corrective-action-timeline';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export function CapaCorrectiveActionPage({ capaId }: { capaId: string }) {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [capa, setCapa] = useState<CapaRecord | null>(null);
  const [actions, setActions] = useState<CapaCorrectiveAction[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [auditLogs, setAuditLogs] = useState<Record<string, unknown>[]>([]);
  const [rcaApproved, setRcaApproved] = useState(false);

  const actor = useMemo(() => ({
    id: user?.uid || 'system',
    name: profile?.full_name || profile?.email || 'User',
    role: profile?.role,
    department: profile?.department,
  }), [user?.uid, profile?.full_name, profile?.email, profile?.role, profile?.department]);

  const readOnly = isCapaCorrectiveActionReadOnly(actor.role);
  const canCreate = canCreateCapaCorrectiveAction(actor.role) && !readOnly;
  const canVerify = canVerifyCapaCorrectiveAction(actor.role) && !readOnly;
  const selected = actions.find((a) => a.id === selectedId) || actions[0] || null;

  const createForm = useForm<CapaCorrectiveActionInput>({
    resolver: zodResolver(capaCorrectiveActionSchema),
    defaultValues: {
      capa_id: capaId,
      root_cause_reference: '',
      corrective_action_description: '',
      action_owner: user?.uid || '',
      action_owner_name: profile?.full_name || '',
      department: profile?.department || 'QA',
      priority: 'medium',
      target_completion_date: '',
      verification_required: true,
      remarks: '',
    },
  });

  const implForm = useForm<{ implementation_status: string; implementation_evidence: string; actual_completion_date: string }>({
    resolver: zodResolver(capaCorrectiveActionImplementationSchema),
    defaultValues: { implementation_status: 'in_progress', implementation_evidence: '', actual_completion_date: '' },
  });

  const verifyForm = useForm<{ decision: 'approved' | 'rejected'; verification_comments: string; qa_review_comments: string }>({
    resolver: zodResolver(capaCorrectiveActionVerificationSchema),
    defaultValues: { decision: 'approved', verification_comments: '', qa_review_comments: '' },
  });

  const timeline = useMemo(() => mapAuditToCorrectiveActionTimeline(auditLogs), [auditLogs]);
  const canEditImpl = selected && capa ? canUpdateCapaCorrectiveActionImplementation(actor.role, selected, capa, actor.id) : false;
  const canApproveCritical = canApproveCriticalCapaCorrectiveAction(actor.role, selected?.priority);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const data = await fetchCapaCorrectiveActionPageData(capaId);
    if ('error' in data && data.error) {
      setError(data.error);
      setLoading(false);
      return;
    }
    if (!data.capa) {
      setError('CAPA not found');
      setLoading(false);
      return;
    }
    setCapa(data.capa);
    setActions(data.actions || []);
    setAuditLogs(data.auditLogs || []);
    setRcaApproved(isInvestigationApproved(data.investigation?.status));
    if (!selectedId && data.actions?.[0]) setSelectedId(data.actions[0].id);
    createForm.setValue('capa_id', capaId);
    createForm.setValue('root_cause_reference', data.investigation?.root_cause_description || data.capa.root_cause || '');
    if (selected || data.actions?.[0]) {
      const act = data.actions?.find((a) => a.id === selectedId) || data.actions?.[0];
      if (act) {
        implForm.reset({
          implementation_status: act.implementation_status || 'in_progress',
          implementation_evidence: act.implementation_evidence || '',
          actual_completion_date: act.actual_completion_date || '',
        });
      }
    }
    setLoading(false);
  }, [capaId, createForm, implForm, selectedId]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (selected) {
      implForm.reset({
        implementation_status: selected.implementation_status || 'in_progress',
        implementation_evidence: selected.implementation_evidence || '',
        actual_completion_date: selected.actual_completion_date || '',
      });
    }
  }, [selected?.id, implForm, selected]);

  const handleCreate = createForm.handleSubmit(async (values) => {
    if (!rcaApproved) return toast.error('Approved RCA is required before creating corrective actions.');
    setBusy(true);
    try {
      const created = await createCapaCorrectiveAction(values, actor);
      setSelectedId(created.id);
      toast.success(`Corrective action ${created.action_number} created`);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Create failed');
    } finally {
      setBusy(false);
    }
  });

  const handleAssign = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      await assignCapaCorrectiveAction(selected.id, {
        action_owner: selected.action_owner,
        action_owner_name: selected.action_owner_name || actor.name,
      }, actor);
      toast.success('Corrective action assigned');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Assign failed');
    } finally {
      setBusy(false);
    }
  };

  const handleImplUpdate = implForm.handleSubmit(async (values) => {
    if (!selected) return;
    setBusy(true);
    try {
      await updateCapaCorrectiveActionImplementation(selected.id, values, actor);
      toast.success('Implementation updated');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setBusy(false);
    }
  });

  const handleEvidenceUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selected) return;
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      await uploadCapaCorrectiveActionEvidence(selected.id, file.name, `Uploaded: ${file.name}`, actor);
      toast.success('Evidence recorded');
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setBusy(false);
    }
  };

  const handleSubmitVerification = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      await submitCapaCorrectiveActionForVerification(selected.id, actor);
      toast.success('Submitted for QA verification');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Submit failed');
    } finally {
      setBusy(false);
    }
  };

  const handleVerify = verifyForm.handleSubmit(async (values) => {
    if (!selected) return;
    setBusy(true);
    try {
      await verifyCapaCorrectiveAction(selected.id, values, actor);
      toast.success(values.decision === 'approved' ? 'Action approved' : 'Action rejected');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Verification failed');
    } finally {
      setBusy(false);
    }
  });

  const handleClose = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      await closeCapaCorrectiveAction(selected.id, actor);
      toast.success('Corrective action closed');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Close failed');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <LoadingSkeleton rows={4} />;
  if (error || !capa) return <ErrorCard title="Unable to load" message={error || 'CAPA not found'} />;

  return (
    <CapaCorrectiveActionAccessGuard>
      <div className="space-y-6">
        <CpvPageHeader
          title="Corrective Action Plan"
          description="Track corrective actions that remove the identified root cause or correct the existing problem"
          trail={[
            { label: 'Dashboard', href: '/dashboard' },
            { label: 'QMS', href: '/qms/capa' },
            { label: 'CAPA Management', href: '/qms/capa' },
            { label: 'Corrective Actions', href: '/qms/capa/corrective-action' },
            { label: capa.capa_number },
          ]}
          actions={(
            <Link href={`/qms/capa/${capaId}`}>
              <Button variant="outline" size="sm" className="gap-1"><ArrowLeft className="h-4 w-4" />Back to CAPA</Button>
            </Link>
          )}
        />

        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono font-semibold">{capa.capa_number}</span>
          <CapaStatusBadge status={capa.capa_status} />
          <CapaPriorityBadge priority={capa.priority} />
        </div>

        {!rcaApproved && (
          <Alert variant="destructive">
            <AlertTitle>RCA approval required</AlertTitle>
            <AlertDescription>
              Complete and approve the investigation before creating corrective actions.{' '}
              <Link href={`/qms/capa/${capaId}/investigation`} className="underline">Go to Investigation & RCA</Link>
            </AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue="actions">
          <TabsList className="flex h-auto flex-wrap">
            {['actions', 'evidence', 'verification', 'timeline', 'audit'].map((t) => (
              <TabsTrigger key={t} value={t} className="capitalize">{t === 'verification' ? 'QA Verification' : t.replace('-', ' ')}</TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="actions" className="mt-4 space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Corrective Actions</CardTitle></CardHeader>
              <CardContent className="overflow-x-auto p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Action #</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Owner</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Progress</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {actions.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No corrective actions yet</TableCell></TableRow>
                    ) : actions.map((a) => (
                      <TableRow key={a.id} className={selected?.id === a.id ? 'bg-blue-50/50' : ''} onClick={() => setSelectedId(a.id)}>
                        <TableCell className="font-mono cursor-pointer">{a.action_number}</TableCell>
                        <TableCell className="max-w-xs truncate">{a.corrective_action_description}</TableCell>
                        <TableCell>{a.action_owner_name || a.action_owner}</TableCell>
                        <TableCell><CapaCorrectiveActionStatusBadge status={a.action_status} /></TableCell>
                        <TableCell className="min-w-[120px]"><CapaCorrectiveActionProgress action={a} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {canCreate && rcaApproved && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2"><Plus className="h-4 w-4" />Create Corrective Action</CardTitle>
                </CardHeader>
                <CardContent>
                  <Form {...createForm}>
                    <form onSubmit={handleCreate} className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <FormField control={createForm.control} name="corrective_action_description" render={({ field }) => (
                          <FormItem className="md:col-span-2 lg:col-span-3"><FormLabel>Corrective Action Description *</FormLabel><FormControl><Textarea rows={3} {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={createForm.control} name="root_cause_reference" render={({ field }) => (
                          <FormItem className="md:col-span-2 lg:col-span-3"><FormLabel>Root Cause Reference</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                        )} />
                        <FormField control={createForm.control} name="action_owner" render={({ field }) => (
                          <FormItem><FormLabel>Action Owner *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={createForm.control} name="action_owner_name" render={({ field }) => (
                          <FormItem><FormLabel>Owner Name</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                        )} />
                        <FormField control={createForm.control} name="department" render={({ field }) => (
                          <FormItem><FormLabel>Department *</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                              <SelectContent>{CAPA_DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                            </Select><FormMessage /></FormItem>
                        )} />
                        <FormField control={createForm.control} name="priority" render={({ field }) => (
                          <FormItem><FormLabel>Priority *</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                              <SelectContent>{CAPA_CA_PRIORITIES.map((p) => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}</SelectContent>
                            </Select><FormMessage /></FormItem>
                        )} />
                        <FormField control={createForm.control} name="target_completion_date" render={({ field }) => (
                          <FormItem><FormLabel>Target Completion Date *</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={createForm.control} name="remarks" render={({ field }) => (
                          <FormItem className="md:col-span-2"><FormLabel>Remarks</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                        )} />
                      </div>
                      <Button type="submit" disabled={busy} className="gap-1 bg-blue-600 hover:bg-blue-700">
                        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}Create Action
                      </Button>
                    </form>
                  </Form>
                </CardContent>
              </Card>
            )}

            {selected && canCreate && selected.action_status === 'draft' && (
              <Button variant="outline" disabled={busy} onClick={handleAssign} className="gap-1">
                <UserPlus className="h-4 w-4" />Assign Owner & Notify
              </Button>
            )}
          </TabsContent>

          <TabsContent value="evidence" className="mt-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base">Implementation Evidence</CardTitle>
                  <CardDescription>{selected ? selected.action_number : 'Select an action'}</CardDescription>
                </div>
                {selected && canEditImpl && (
                  <label className="cursor-pointer">
                    <Button variant="outline" size="sm" className="gap-1" asChild><span><Paperclip className="h-4 w-4" />Upload</span></Button>
                    <input type="file" className="hidden" onChange={handleEvidenceUpload} />
                  </label>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                {!selected ? (
                  <p className="text-sm text-muted-foreground">Select a corrective action first.</p>
                ) : (
                  <>
                    <div className="flex flex-wrap gap-2 text-sm">
                      <CapaCorrectiveActionStatusBadge status={selected.action_status} />
                      <CapaImplementationStatusBadge status={selected.implementation_status} />
                    </div>
                    {canEditImpl && !['closed', 'approved'].includes(selected.action_status) && (
                      <Form {...implForm}>
                        <form onSubmit={handleImplUpdate} className="space-y-4">
                          <FormField control={implForm.control} name="implementation_status" render={({ field }) => (
                            <FormItem><FormLabel>Implementation Status</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                <SelectContent>{CAPA_CA_IMPLEMENTATION_STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, ' ')}</SelectItem>)}</SelectContent>
                              </Select></FormItem>
                          )} />
                          <FormField control={implForm.control} name="implementation_evidence" render={({ field }) => (
                            <FormItem><FormLabel>Implementation Evidence *</FormLabel><FormControl><Textarea rows={4} {...field} /></FormControl><FormMessage /></FormItem>
                          )} />
                          <FormField control={implForm.control} name="actual_completion_date" render={({ field }) => (
                            <FormItem><FormLabel>Actual Completion Date</FormLabel><FormControl><Input type="date" {...field} value={field.value ?? ''} /></FormControl></FormItem>
                          )} />
                          <Button type="submit" disabled={busy} className="gap-1">
                            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Save Implementation
                          </Button>
                        </form>
                      </Form>
                    )}
                    <ul className="space-y-2 text-sm border-t pt-4">
                      {(selected.evidence_items || []).length === 0 ? (
                        <li className="text-muted-foreground">No evidence files recorded.</li>
                      ) : selected.evidence_items.map((ev) => (
                        <li key={ev.id} className="rounded border p-2">
                          <strong>{ev.file_name}</strong> — {ev.description}
                          <span className="block text-xs text-muted-foreground">{ev.uploaded_by_name} · {new Date(ev.uploaded_at).toLocaleString()}</span>
                        </li>
                      ))}
                    </ul>
                    {canEditImpl && ['assigned', 'under_implementation', 'implemented', 'overdue'].includes(selected.action_status) && (
                      <Button disabled={busy} onClick={handleSubmitVerification} className="gap-1">
                        <Send className="h-4 w-4" />Submit for QA Verification
                      </Button>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="verification" className="mt-4">
            <Card>
              <CardHeader><CardTitle className="text-base">QA Verification</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {!selected ? (
                  <p className="text-sm text-muted-foreground">Select a corrective action first.</p>
                ) : selected.action_status === 'qa_verification' && canVerify && canApproveCritical ? (
                  <Form {...verifyForm}>
                    <form onSubmit={handleVerify} className="space-y-4">
                      <FormField control={verifyForm.control} name="verification_comments" render={({ field }) => (
                        <FormItem><FormLabel>Verification Comments *</FormLabel><FormControl><Textarea rows={3} {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={verifyForm.control} name="qa_review_comments" render={({ field }) => (
                        <FormItem><FormLabel>QA Review Comments</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl></FormItem>
                      )} />
                      <div className="flex gap-2">
                        <Button type="submit" disabled={busy} onClick={() => verifyForm.setValue('decision', 'approved')}>Approve</Button>
                        <Button type="button" variant="destructive" disabled={busy} onClick={verifyForm.handleSubmit(async (data) => {
                          await verifyCapaCorrectiveAction(selected.id, { ...data, decision: 'rejected' }, actor);
                          toast.success('Action rejected');
                          await load();
                        })}>Reject</Button>
                      </div>
                    </form>
                  </Form>
                ) : selected.action_status === 'qa_verification' && !canApproveCritical ? (
                  <p className="text-sm text-muted-foreground">Head QA approval required for critical corrective actions.</p>
                ) : selected.action_status === 'approved' && canVerify ? (
                  <Button variant="outline" disabled={busy} onClick={handleClose}>Close Corrective Action</Button>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {selected.verification_comments ? `Previous: ${selected.verification_comments}` : 'QA verification available after implementation evidence is submitted.'}
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="timeline" className="mt-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Action Timeline</CardTitle></CardHeader>
              <CardContent><CapaCorrectiveActionTimeline entries={timeline} /></CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="audit" className="mt-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Audit Trail</CardTitle></CardHeader>
              <CardContent><CapaCorrectiveActionTimeline entries={timeline} /></CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </CapaCorrectiveActionAccessGuard>
  );
}
