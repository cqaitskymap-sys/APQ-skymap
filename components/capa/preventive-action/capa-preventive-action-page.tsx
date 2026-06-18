'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  ArrowLeft, Link2, Loader2, Paperclip, Plus, Save, Send, UserPlus,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/auth-context';
import {
  canApproveCriticalCapaPreventiveAction,
  canCreateCapaPreventiveAction,
  canManageChangeControlLinkage,
  canManageSopLinkage,
  canManageTrainingLinkage,
  canUpdateCapaPreventiveActionImplementation,
  canVerifyCapaPreventiveAction,
  isCapaPreventiveActionReadOnly,
  mapAuditToPreventiveActionTimeline,
} from '@/lib/capa-preventive-action-records';
import { isInvestigationApproved } from '@/lib/capa-investigation-records';
import {
  assignCapaPreventiveAction,
  closeCapaPreventiveAction,
  createCapaPreventiveAction,
  fetchCapaPreventiveActionPageData,
  fetchChangeControlOptions,
  fetchSopRecordOptions,
  fetchTrainingRecordOptions,
  linkCapaPreventiveActionChangeControl,
  linkCapaPreventiveActionSop,
  linkCapaPreventiveActionTraining,
  submitCapaPreventiveActionForVerification,
  updateCapaPreventiveActionImplementation,
  uploadCapaPreventiveActionEvidence,
  verifyCapaPreventiveAction,
} from '@/lib/capa-preventive-action-service';
import {
  capaPreventiveActionImplementationSchema,
  capaPreventiveActionSchema,
  capaPreventiveActionVerificationSchema,
  type CapaPreventiveActionInput,
} from '@/lib/capa-preventive-action-schemas';
import {
  CAPA_CA_IMPLEMENTATION_STATUSES, CAPA_CA_PRIORITIES, CAPA_DEPARTMENTS, CAPA_PA_RISK_LEVELS,
  type CapaPreventiveAction, type CapaRecord,
} from '@/lib/capa-types';
import { CpvPageHeader } from '@/components/cpv/product-master/cpv-page-header';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { CapaStatusBadge, CapaPriorityBadge } from '@/components/capa/capa-sub-nav';
import { CapaPreventiveActionAccessGuard } from './capa-preventive-action-access-guard';
import {
  CapaPreventiveActionStatusBadge, CapaPreventiveImplementationStatusBadge, CapaPreventiveRiskBadge,
} from './capa-preventive-action-badges';
import { CapaPreventiveActionProgress } from './capa-preventive-action-progress';
import { CapaPreventiveActionTimeline } from './capa-preventive-action-timeline';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export function CapaPreventiveActionPage({ capaId }: { capaId: string }) {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [capa, setCapa] = useState<CapaRecord | null>(null);
  const [actions, setActions] = useState<CapaPreventiveAction[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [auditLogs, setAuditLogs] = useState<Record<string, unknown>[]>([]);
  const [rcaApproved, setRcaApproved] = useState(false);
  const [trainingOpts, setTrainingOpts] = useState<{ id: string; reference: string; title: string }[]>([]);
  const [sopOpts, setSopOpts] = useState<{ id: string; reference: string; title: string }[]>([]);
  const [ccOpts, setCcOpts] = useState<{ id: string; reference: string; title: string }[]>([]);
  const [linkRef, setLinkRef] = useState('');
  const [linkId, setLinkId] = useState('');

  const actor = useMemo(() => ({
    id: user?.uid || 'system',
    name: profile?.full_name || profile?.email || 'User',
    role: profile?.role,
    department: profile?.department,
  }), [user?.uid, profile?.full_name, profile?.email, profile?.role, profile?.department]);

  const readOnly = isCapaPreventiveActionReadOnly(actor.role);
  const canCreate = canCreateCapaPreventiveAction(actor.role) && !readOnly;
  const canVerify = canVerifyCapaPreventiveAction(actor.role) && !readOnly;
  const canTrain = canManageTrainingLinkage(actor.role) && !readOnly;
  const canSop = canManageSopLinkage(actor.role) && !readOnly;
  const canCc = canManageChangeControlLinkage(actor.role) && !readOnly;
  const selected = actions.find((a) => a.id === selectedId) || actions[0] || null;

  const createForm = useForm<CapaPreventiveActionInput>({
    resolver: zodResolver(capaPreventiveActionSchema),
    defaultValues: {
      capa_id: capaId,
      risk_reference: '',
      root_cause_reference: '',
      preventive_action_description: '',
      objective: '',
      expected_outcome: '',
      action_owner: user?.uid || '',
      action_owner_name: profile?.full_name || '',
      department: profile?.department || 'QA',
      priority: 'medium',
      risk_level: 'medium',
      target_completion_date: '',
      training_required: false,
      sop_revision_required: false,
      change_control_required: false,
      verification_required: true,
      remarks: '',
    },
  });

  const implForm = useForm<{ implementation_status: string; implementation_evidence: string; actual_completion_date: string }>({
    resolver: zodResolver(capaPreventiveActionImplementationSchema),
    defaultValues: { implementation_status: 'in_progress', implementation_evidence: '', actual_completion_date: '' },
  });

  const verifyForm = useForm<{ decision: 'approved' | 'rejected'; verification_comments: string; qa_review_comments: string }>({
    resolver: zodResolver(capaPreventiveActionVerificationSchema),
    defaultValues: { decision: 'approved', verification_comments: '', qa_review_comments: '' },
  });

  const timeline = useMemo(() => mapAuditToPreventiveActionTimeline(auditLogs), [auditLogs]);
  const actionTimeline = useMemo(() => {
    if (!selected?.action_number) return timeline;
    return timeline.filter((e) =>
      e.action.toLowerCase().includes('preventive')
      || (e.detail && (e.detail.includes(selected.action_number) || e.detail.includes(selected.preventive_action_id))),
    );
  }, [timeline, selected?.action_number, selected?.preventive_action_id]);

  const canEditImpl = selected && capa ? canUpdateCapaPreventiveActionImplementation(actor.role, selected, capa, actor.id) : false;
  const canApproveCritical = canApproveCriticalCapaPreventiveAction(actor.role, selected?.priority);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [data, train, sop, cc] = await Promise.all([
      fetchCapaPreventiveActionPageData(capaId),
      fetchTrainingRecordOptions(),
      fetchSopRecordOptions(),
      fetchChangeControlOptions(),
    ]);
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
    setTrainingOpts(train);
    setSopOpts(sop);
    setCcOpts(cc);
    if (!selectedId && data.actions?.[0]) setSelectedId(data.actions[0].id);
    createForm.setValue('capa_id', capaId);
    createForm.setValue('root_cause_reference', data.investigation?.root_cause_description || data.capa.root_cause || '');
    createForm.setValue('risk_reference', data.capa.source_reference_number || '');
    setLoading(false);
  }, [capaId, createForm, selectedId]);

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
    if (!rcaApproved) return toast.error('Approved RCA is required before creating preventive actions.');
    setBusy(true);
    try {
      const created = await createCapaPreventiveAction(values, actor);
      setSelectedId(created.id);
      toast.success(`Preventive action ${created.action_number} created`);
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
      await assignCapaPreventiveAction(selected.id, {
        action_owner: selected.action_owner,
        action_owner_name: selected.action_owner_name || actor.name,
      }, actor);
      toast.success('Preventive action assigned');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Assign failed');
    } finally {
      setBusy(false);
    }
  };

  const handleLinkTraining = async () => {
    if (!selected || !linkRef.trim()) return toast.message('Enter or select training reference');
    setBusy(true);
    try {
      await linkCapaPreventiveActionTraining(selected.id, { reference: linkRef, record_id: linkId }, actor);
      toast.success('Training record linked');
      setLinkRef('');
      setLinkId('');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Link failed');
    } finally {
      setBusy(false);
    }
  };

  const handleLinkSop = async () => {
    if (!selected || !linkRef.trim()) return toast.message('Enter or select SOP reference');
    setBusy(true);
    try {
      await linkCapaPreventiveActionSop(selected.id, { reference: linkRef, record_id: linkId }, actor);
      toast.success('SOP revision linked');
      setLinkRef('');
      setLinkId('');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Link failed');
    } finally {
      setBusy(false);
    }
  };

  const handleLinkCc = async () => {
    if (!selected || !linkRef.trim()) return toast.message('Enter or select change control reference');
    setBusy(true);
    try {
      await linkCapaPreventiveActionChangeControl(selected.id, { reference: linkRef, record_id: linkId }, actor);
      toast.success('Change control linked');
      setLinkRef('');
      setLinkId('');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Link failed');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <LoadingSkeleton rows={4} />;
  if (error || !capa) return <ErrorCard title="Unable to load" message={error || 'CAPA not found'} />;

  const linkPanel = (label: string, onLink: () => void, opts: typeof trainingOpts, current?: string) => (
    <div className="space-y-3">
      {current && <p className="text-sm"><span className="text-muted-foreground">Linked: </span><strong>{current}</strong></p>}
      {selected && (
        <>
          <Select onValueChange={(v) => {
            const opt = opts.find((o) => o.id === v);
            if (opt) { setLinkRef(opt.reference); setLinkId(opt.id); }
          }}>
            <SelectTrigger><SelectValue placeholder={`Select ${label} record`} /></SelectTrigger>
            <SelectContent>
              {opts.map((o) => <SelectItem key={o.id} value={o.id}>{o.reference} — {o.title || 'Untitled'}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input placeholder="Or enter reference manually" value={linkRef} onChange={(e) => setLinkRef(e.target.value)} />
          <Button disabled={busy} onClick={onLink} className="gap-1"><Link2 className="h-4 w-4" />Link {label}</Button>
        </>
      )}
    </div>
  );

  return (
    <CapaPreventiveActionAccessGuard>
      <div className="space-y-6">
        <CpvPageHeader
          title="Preventive Action Plan"
          description="Monitor and verify preventive actions that eliminate potential causes of future quality events"
          trail={[
            { label: 'Dashboard', href: '/dashboard' },
            { label: 'QMS', href: '/qms/capa' },
            { label: 'CAPA Management', href: '/qms/capa' },
            { label: 'Preventive Actions', href: '/qms/capa/preventive-action' },
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
          {selected && <CapaPreventiveActionStatusBadge status={selected.action_status} />}
        </div>

        {!rcaApproved && (
          <Alert variant="destructive">
            <AlertTitle>RCA approval required</AlertTitle>
            <AlertDescription>
              Complete and approve the investigation before creating preventive actions.{' '}
              <Link href={`/qms/capa/${capaId}/investigation`} className="underline">Go to Investigation & RCA</Link>
            </AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue="actions">
          <TabsList className="flex h-auto flex-wrap">
            {['actions', 'training', 'sop', 'change-control', 'evidence', 'verification', 'timeline', 'audit'].map((t) => (
              <TabsTrigger key={t} value={t} className="capitalize text-xs sm:text-sm">
                {t === 'sop' ? 'SOP Revisions' : t === 'change-control' ? 'Change Controls' : t === 'verification' ? 'QA Verification' : t.replace('-', ' ')}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="actions" className="mt-4 space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Preventive Actions</CardTitle></CardHeader>
              <CardContent className="overflow-x-auto p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Action #</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Risk</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Progress</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {actions.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No preventive actions yet</TableCell></TableRow>
                    ) : actions.map((a) => (
                      <TableRow key={a.id} className={selected?.id === a.id ? 'bg-blue-50/50 cursor-pointer' : 'cursor-pointer'} onClick={() => setSelectedId(a.id)}>
                        <TableCell className="font-mono">{a.action_number}</TableCell>
                        <TableCell className="max-w-xs truncate">{a.preventive_action_description}</TableCell>
                        <TableCell><CapaPreventiveRiskBadge level={a.risk_level} /></TableCell>
                        <TableCell><CapaPreventiveActionStatusBadge status={a.action_status} /></TableCell>
                        <TableCell className="min-w-[120px]"><CapaPreventiveActionProgress action={a} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {canCreate && rcaApproved && (
              <Card>
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><Plus className="h-4 w-4" />Create Preventive Action</CardTitle></CardHeader>
                <CardContent>
                  <Form {...createForm}>
                    <form onSubmit={handleCreate} className="space-y-4">
                      <FormField control={createForm.control} name="preventive_action_description" render={({ field }) => (
                        <FormItem><FormLabel>Preventive Action Description *</FormLabel><FormControl><Textarea rows={3} {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={createForm.control} name="objective" render={({ field }) => (
                        <FormItem><FormLabel>Objective *</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <FormField control={createForm.control} name="expected_outcome" render={({ field }) => (
                          <FormItem className="md:col-span-2"><FormLabel>Expected Outcome</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                        )} />
                        <FormField control={createForm.control} name="action_owner" render={({ field }) => (
                          <FormItem><FormLabel>Action Owner *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
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
                        <FormField control={createForm.control} name="risk_level" render={({ field }) => (
                          <FormItem><FormLabel>Risk Level</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                              <SelectContent>{CAPA_PA_RISK_LEVELS.map((r) => <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>)}</SelectContent>
                            </Select></FormItem>
                        )} />
                        <FormField control={createForm.control} name="target_completion_date" render={({ field }) => (
                          <FormItem><FormLabel>Target Completion Date *</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                      </div>
                      <div className="flex flex-wrap gap-6">
                        <FormField control={createForm.control} name="training_required" render={({ field }) => (
                          <FormItem className="flex items-center gap-2"><FormLabel>Training Required</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>
                        )} />
                        <FormField control={createForm.control} name="sop_revision_required" render={({ field }) => (
                          <FormItem className="flex items-center gap-2"><FormLabel>SOP Revision Required</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>
                        )} />
                        <FormField control={createForm.control} name="change_control_required" render={({ field }) => (
                          <FormItem className="flex items-center gap-2"><FormLabel>Change Control Required</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>
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

          <TabsContent value="training" className="mt-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Training Requirements</CardTitle></CardHeader>
              <CardContent>
                {!selected ? <p className="text-sm text-muted-foreground">Select a preventive action first.</p>
                  : canTrain ? linkPanel('Training', handleLinkTraining, trainingOpts, selected.training_reference)
                    : <p className="text-sm text-muted-foreground">Training Coordinator or QA access required.</p>}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sop" className="mt-4">
            <Card>
              <CardHeader><CardTitle className="text-base">SOP Revisions</CardTitle></CardHeader>
              <CardContent>
                {!selected ? <p className="text-sm text-muted-foreground">Select a preventive action first.</p>
                  : canSop ? linkPanel('SOP', handleLinkSop, sopOpts, selected.sop_reference)
                    : <p className="text-sm text-muted-foreground">Document Controller or QA access required.</p>}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="change-control" className="mt-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Change Controls</CardTitle></CardHeader>
              <CardContent>
                {!selected ? <p className="text-sm text-muted-foreground">Select a preventive action first.</p>
                  : canCc ? linkPanel('Change Control', handleLinkCc, ccOpts, selected.change_control_reference)
                    : <p className="text-sm text-muted-foreground">QA access required to link change controls.</p>}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="evidence" className="mt-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base">Implementation Evidence</CardTitle>
                  <CardDescription>{selected?.action_number || 'Select an action'}</CardDescription>
                </div>
                {selected && canEditImpl && (
                  <label className="cursor-pointer">
                    <Button variant="outline" size="sm" className="gap-1" asChild><span><Paperclip className="h-4 w-4" />Upload</span></Button>
                    <input type="file" className="hidden" onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file || !selected) return;
                      setBusy(true);
                      try {
                        await uploadCapaPreventiveActionEvidence(selected.id, file.name, `Uploaded: ${file.name}`, actor);
                        toast.success('Evidence recorded');
                        await load();
                      } catch (err) {
                        toast.error(err instanceof Error ? err.message : 'Upload failed');
                      } finally { setBusy(false); }
                    }} />
                  </label>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                {!selected ? <p className="text-sm text-muted-foreground">Select a preventive action first.</p> : (
                  <>
                    <div className="flex flex-wrap gap-2">
                      <CapaPreventiveActionStatusBadge status={selected.action_status} />
                      <CapaPreventiveImplementationStatusBadge status={selected.implementation_status} />
                    </div>
                    {canEditImpl && !['closed', 'approved'].includes(selected.action_status) && (
                      <Form {...implForm}>
                        <form onSubmit={implForm.handleSubmit(async (values) => {
                          setBusy(true);
                          try {
                            await updateCapaPreventiveActionImplementation(selected.id, values, actor);
                            toast.success('Implementation updated');
                            await load();
                          } catch (e) {
                            toast.error(e instanceof Error ? e.message : 'Update failed');
                          } finally { setBusy(false); }
                        })} className="space-y-4">
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
                          <Button type="submit" disabled={busy} className="gap-1"><Save className="h-4 w-4" />Save Implementation</Button>
                        </form>
                      </Form>
                    )}
                    <ul className="space-y-2 text-sm border-t pt-4">
                      {(selected.evidence_items || []).length === 0 ? (
                        <li className="text-muted-foreground">No evidence files recorded.</li>
                      ) : selected.evidence_items.map((ev) => (
                        <li key={ev.id} className="rounded border p-2">
                          <strong>{ev.file_name}</strong> — {ev.description}
                        </li>
                      ))}
                    </ul>
                    {canEditImpl && ['assigned', 'under_implementation', 'implemented', 'overdue'].includes(selected.action_status) && (
                      <Button disabled={busy} onClick={async () => {
                        setBusy(true);
                        try {
                          await submitCapaPreventiveActionForVerification(selected.id, actor);
                          toast.success('Submitted for QA verification');
                          await load();
                        } catch (e) {
                          toast.error(e instanceof Error ? e.message : 'Submit failed');
                        } finally { setBusy(false); }
                      }} className="gap-1"><Send className="h-4 w-4" />Submit for QA Verification</Button>
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
                {!selected ? <p className="text-sm text-muted-foreground">Select a preventive action first.</p>
                  : selected.action_status === 'qa_verification' && canVerify && canApproveCritical ? (
                    <Form {...verifyForm}>
                      <form onSubmit={verifyForm.handleSubmit(async (values) => {
                        setBusy(true);
                        try {
                          await verifyCapaPreventiveAction(selected.id, values, actor);
                          toast.success(values.decision === 'approved' ? 'Action approved' : 'Action rejected');
                          await load();
                        } catch (e) {
                          toast.error(e instanceof Error ? e.message : 'Verification failed');
                        } finally { setBusy(false); }
                      })} className="space-y-4">
                        <FormField control={verifyForm.control} name="verification_comments" render={({ field }) => (
                          <FormItem><FormLabel>Verification Comments *</FormLabel><FormControl><Textarea rows={3} {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={verifyForm.control} name="qa_review_comments" render={({ field }) => (
                          <FormItem><FormLabel>QA Review Comments</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl></FormItem>
                        )} />
                        <div className="flex gap-2">
                          <Button type="submit" disabled={busy} onClick={() => verifyForm.setValue('decision', 'approved')}>Approve</Button>
                          <Button type="button" variant="destructive" disabled={busy} onClick={verifyForm.handleSubmit(async (data) => {
                            await verifyCapaPreventiveAction(selected.id, { ...data, decision: 'rejected' }, actor);
                            toast.success('Action rejected');
                            await load();
                          })}>Reject</Button>
                        </div>
                      </form>
                    </Form>
                  ) : selected.action_status === 'qa_verification' && !canApproveCritical ? (
                    <p className="text-sm text-muted-foreground">Head QA approval required for critical preventive actions.</p>
                  ) : selected.action_status === 'approved' && canVerify ? (
                    <Button variant="outline" disabled={busy} onClick={async () => {
                      setBusy(true);
                      try {
                        await closeCapaPreventiveAction(selected.id, actor);
                        toast.success('Preventive action closed');
                        await load();
                      } catch (e) {
                        toast.error(e instanceof Error ? e.message : 'Close failed');
                      } finally { setBusy(false); }
                    }}>Close Preventive Action</Button>
                  ) : (
                    <p className="text-sm text-muted-foreground">QA verification available after implementation evidence is submitted.</p>
                  )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="timeline" className="mt-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Timeline</CardTitle></CardHeader>
              <CardContent><CapaPreventiveActionTimeline entries={actionTimeline} /></CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="audit" className="mt-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Audit Trail</CardTitle></CardHeader>
              <CardContent><CapaPreventiveActionTimeline entries={timeline} /></CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </CapaPreventiveActionAccessGuard>
  );
}
