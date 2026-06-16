'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  AlertTriangle, ArrowLeft, CheckCircle, ExternalLink, Link2, Loader2, Plus, Save,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/auth-context';
import {
  canApproveCriticalOosCapa,
  canCloseOosCapa,
  canManageOosCapa,
  canUpdateOosCapaActions,
  computeOosCapaProgress,
  isOosCapaLinkOverdue,
  mapAuditToOosCapaTimeline,
  mapOosCapaFormDefaults,
} from '@/lib/oos-capa-records';
import {
  closeOosCapaLink,
  createOosCapaFromRecord,
  fetchOosCapaPageData,
  linkExistingCapaToOos,
  logOosCapaPageViewed,
  recordOosCapaEffectiveness,
  refreshOosCapaLinkStatus,
  saveOosCapaRequirement,
  updateOosCapaImplementation,
} from '@/lib/oos-capa-service';
import {
  oosCapaCloseSchema,
  oosCapaCreateSchema,
  oosCapaEffectivenessSchema,
  oosCapaImplementationSchema,
  oosCapaLinkExistingSchema,
  oosCapaRequirementSchema,
  type OosCapaCloseInput,
  type OosCapaCreateInput,
  type OosCapaEffectivenessInput,
  type OosCapaImplementationInput,
  type OosCapaLinkExistingInput,
  type OosCapaRequirementInput,
} from '@/lib/oos-schemas';
import { OOS_CAPA_DISPLAY_STATUSES, OOS_EFFECTIVENESS_RESULTS, type OosCapaLink, type OosRecord } from '@/lib/oos-types';
import type { CapaRecord } from '@/lib/capa-types';
import { CpvPageHeader } from '@/components/cpv/product-master/cpv-page-header';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { EmptyState } from '@/components/admin/dashboard/empty-state';
import { OosStatusBadge } from '@/components/oos/oos-sub-nav';
import { OosCapaAccessGuard } from './oos-capa-access-guard';
import { OosCapaStatusBadge } from './oos-capa-status-badge';
import { OosCapaTimeline } from './oos-capa-timeline';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export function OosCapaPage({ oosId }: { oosId: string }) {
  const { user, profile } = useAuth();
  const viewed = useRef(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [record, setRecord] = useState<OosRecord | null>(null);
  const [link, setLink] = useState<OosCapaLink | null>(null);
  const [capa, setCapa] = useState<CapaRecord | null>(null);
  const [auditLogs, setAuditLogs] = useState<Record<string, unknown>[]>([]);
  const [autoRules, setAutoRules] = useState<{ capaMandatory: boolean; isRepeatOos: boolean; warnings: string[] }>({ capaMandatory: false, isRepeatOos: false, warnings: [] });
  const [closureCheck, setClosureCheck] = useState<{ canClose: boolean; reason?: string }>({ canClose: true });

  const actor = useMemo(() => ({
    id: user?.uid || 'system',
    name: profile?.full_name || profile?.email || 'User',
    role: profile?.role,
  }), [user?.uid, profile?.full_name, profile?.email, profile?.role]);

  const reqForm = useForm<OosCapaRequirementInput>({ resolver: zodResolver(oosCapaRequirementSchema), defaultValues: { capa_required: false, remarks: '' } });
  const linkForm = useForm<OosCapaLinkExistingInput>({ resolver: zodResolver(oosCapaLinkExistingSchema), defaultValues: { capa_number: '', remarks: '' } });
  const createForm = useForm<OosCapaCreateInput>({ resolver: zodResolver(oosCapaCreateSchema), defaultValues: { capa_required: true, capa_title: '', capa_source: 'OOS', root_cause: '', corrective_action: '', preventive_action: '', action_owner_name: '', target_completion_date: '', effectiveness_check_required: true, remarks: '' } });
  const implForm = useForm<OosCapaImplementationInput>({ resolver: zodResolver(oosCapaImplementationSchema), defaultValues: { capa_status: 'Open', remarks: '' } });
  const effForm = useForm<OosCapaEffectivenessInput>({ resolver: zodResolver(oosCapaEffectivenessSchema), defaultValues: { effectiveness_result: 'Under Review', effectiveness_check_date: new Date().toISOString().split('T')[0], remarks: '' } });
  const closeForm = useForm<OosCapaCloseInput>({ resolver: zodResolver(oosCapaCloseSchema), defaultValues: { capa_closure_date: new Date().toISOString().split('T')[0], remarks: '' } });

  const canManage = record ? canManageOosCapa(actor.role, capa?.action_owner, actor.id) : false;
  const canUpdate = canUpdateOosCapaActions(actor.role, capa?.action_owner, actor.id);
  const canClose = canCloseOosCapa(actor.role) && canApproveCriticalOosCapa(actor.role, record);
  const overdue = isOosCapaLinkOverdue(link);
  const progress = computeOosCapaProgress(link?.capa_status);
  const timeline = useMemo(() => mapAuditToOosCapaTimeline(auditLogs), [auditLogs]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    await refreshOosCapaLinkStatus(oosId, actor);
    const data = await fetchOosCapaPageData(oosId);
    if (data.error || !data.record) {
      setError(data.error || 'OOS not found');
      setLoading(false);
      return;
    }
    setRecord(data.record);
    setLink(data.link || null);
    setCapa(data.capa || null);
    setAuditLogs(data.auditLogs || []);
    setAutoRules(data.autoRules || { capaMandatory: false, isRepeatOos: false, warnings: [] });
    setClosureCheck(data.closureCheck || { canClose: true });
    reqForm.reset({ capa_required: data.record.capa_required || data.autoRules?.capaMandatory, remarks: data.link?.remarks || '' });
    createForm.reset(mapOosCapaFormDefaults(data.record, data.link || null, data.capa || null, data.phase2 || null) as OosCapaCreateInput);
    implForm.reset({
      capa_status: data.link?.capa_status || 'Open',
      implementation_date: data.link?.implementation_date || '',
      corrective_action: data.link?.corrective_action || '',
      preventive_action: data.link?.preventive_action || '',
      remarks: data.link?.remarks || '',
    });
    if (data.link?.effectiveness_result) effForm.setValue('effectiveness_result', data.link.effectiveness_result as OosCapaEffectivenessInput['effectiveness_result']);
    setLoading(false);
    if (!viewed.current) {
      viewed.current = true;
      void logOosCapaPageViewed(oosId, actor, data.record.oos_number);
    }
  }, [oosId, actor, reqForm, createForm, implForm, effForm]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (autoRules.capaMandatory) reqForm.setValue('capa_required', true); }, [autoRules.capaMandatory, reqForm]);

  const handleSaveRequirement = async () => {
    setBusy(true);
    const v = reqForm.getValues();
    const { error: err } = await saveOosCapaRequirement(oosId, v.capa_required, v.remarks || '', actor);
    setBusy(false);
    if (err) toast.error(err);
    else { toast.success('CAPA requirement saved'); void load(); }
  };

  const handleLink = async (data: OosCapaLinkExistingInput) => {
    setBusy(true);
    const { error: err } = await linkExistingCapaToOos(oosId, data.capa_number, data.remarks || '', actor);
    setBusy(false);
    if (err) toast.error(err);
    else { toast.success('CAPA linked'); void load(); }
  };

  const handleCreate = async (data: OosCapaCreateInput) => {
    setBusy(true);
    const { error: err } = await createOosCapaFromRecord(oosId, data, actor);
    setBusy(false);
    if (err) toast.error(err);
    else { toast.success('CAPA created and linked'); void load(); }
  };

  const handleImplementation = async (data: OosCapaImplementationInput) => {
    setBusy(true);
    const { error: err } = await updateOosCapaImplementation(oosId, data, actor);
    setBusy(false);
    if (err) toast.error(err);
    else { toast.success('Implementation updated'); void load(); }
  };

  const handleEffectiveness = async (data: OosCapaEffectivenessInput) => {
    setBusy(true);
    const { error: err } = await recordOosCapaEffectiveness(oosId, data, actor);
    setBusy(false);
    if (err) toast.error(err);
    else { toast.success('Effectiveness recorded'); void load(); }
  };

  const handleClose = async (data: OosCapaCloseInput) => {
    if (link?.effectiveness_check_required && !data.effectiveness_result && !link.effectiveness_result) {
      return toast.error('Effectiveness result is required before closure');
    }
    setBusy(true);
    const { error: err } = await closeOosCapaLink(oosId, data, actor);
    setBusy(false);
    if (err) toast.error(err);
    else { toast.success('CAPA closed'); void load(); }
  };

  return (
    <OosCapaAccessGuard>
      <div className="space-y-6">
        <CpvPageHeader
          title="OOS CAPA Management"
          description={record ? `${record.oos_number} — ${record.test_name}` : 'Loading...'}
          trail={[
            { label: 'Dashboard', href: '/dashboard' },
            { label: 'QMS', href: '/qms/oos' },
            { label: 'CAPA Management', href: '/qms/oos/capa-management' },
            { label: record?.oos_number || 'CAPA' },
          ]}
          actions={(
            <div className="flex flex-wrap gap-2">
              <Link href="/qms/oos/capa-management"><Button variant="outline" size="sm"><ArrowLeft className="mr-1 h-4 w-4" /> Queue</Button></Link>
              {record && <Link href={`/qms/oos/${oosId}`}><Button variant="outline" size="sm">OOS Record</Button></Link>}
              {capa && <Link href="/qms/capa"><Button variant="outline" size="sm"><ExternalLink className="mr-1 h-4 w-4" /> CAPA Module</Button></Link>}
            </div>
          )}
        />

        {loading ? <LoadingSkeleton rows={4} /> : error || !record ? (
          <ErrorCard title="Load error" message={error || 'Not found'} onRetry={() => void load()} />
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <OosStatusBadge status={record.status} />
              <OosCapaStatusBadge status={link?.capa_status} overdue={overdue} />
              {autoRules.capaMandatory && <span className="rounded-md bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-800">CAPA Mandatory</span>}
              {autoRules.isRepeatOos && <span className="rounded-md bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">Repeat OOS</span>}
            </div>

            {autoRules.warnings.length > 0 && (
              <Alert variant={autoRules.capaMandatory ? 'destructive' : 'default'}>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>GMP Auto Rules</AlertTitle>
                <AlertDescription><ul className="mt-1 list-disc pl-4 text-sm">{autoRules.warnings.map((w) => <li key={w}>{w}</li>)}</ul></AlertDescription>
              </Alert>
            )}

            {!closureCheck.canClose && (
              <Alert variant="destructive">
                <AlertTitle>OOS Closure Blocked</AlertTitle>
                <AlertDescription>{closureCheck.reason}</AlertDescription>
              </Alert>
            )}

            <Card><CardContent className="pt-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">CAPA Progress</span>
                <span className="font-medium">{progress}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${progress}%` }} />
              </div>
            </CardContent></Card>

            <Tabs defaultValue="overview" className="space-y-4">
              <TabsList className="flex h-auto flex-wrap gap-1">
                {['overview', 'corrective', 'preventive', 'implementation', 'effectiveness', 'timeline', 'audit'].map((t) => (
                  <TabsTrigger key={t} value={t} className="capitalize">
                    {t === 'corrective' ? 'Corrective Actions' : t === 'preventive' ? 'Preventive Actions' : t === 'effectiveness' ? 'Effectiveness Check' : t === 'audit' ? 'Audit Trail' : t === 'overview' ? 'CAPA Overview' : t.charAt(0).toUpperCase() + t.slice(1)}
                  </TabsTrigger>
                ))}
              </TabsList>

              <TabsContent value="overview" className="space-y-4">
                <Card>
                  <CardHeader><CardTitle className="text-base">CAPA Overview</CardTitle></CardHeader>
                  <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 text-sm">
                    <div><span className="text-muted-foreground">OOS Number:</span> <span className="font-mono">{record.oos_number}</span></div>
                    <div><span className="text-muted-foreground">CAPA Number:</span> <span className="font-mono">{link?.capa_number || record.linked_capa_number || '—'}</span></div>
                    <div><span className="text-muted-foreground">CAPA Title:</span> {link?.capa_title || capa?.capa_title || '—'}</div>
                    <div><span className="text-muted-foreground">CAPA Source:</span> {link?.capa_source || 'OOS'}</div>
                    <div><span className="text-muted-foreground">Action Owner:</span> {link?.action_owner_name || capa?.action_owner_name || '—'}</div>
                    <div><span className="text-muted-foreground">Department:</span> {link?.department || record.department}</div>
                    <div><span className="text-muted-foreground">Target Date:</span> {link?.target_completion_date || link?.target_date || '—'}</div>
                    <div><span className="text-muted-foreground">Implementation:</span> {link?.implementation_date || '—'}</div>
                    <div><span className="text-muted-foreground">Effectiveness:</span> {link?.effectiveness_result || '—'}</div>
                  </CardContent>
                </Card>

                {canManage && !link && (
                  <>
                    <Form {...reqForm}><Card><CardHeader><CardTitle className="text-base">CAPA Decision</CardTitle></CardHeader>
                      <CardContent className="space-y-4">
                        <FormField control={reqForm.control} name="capa_required" render={({ field }) => (
                          <FormItem className="flex items-center justify-between rounded-md border p-4">
                            <FormLabel>CAPA Required</FormLabel>
                            <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} disabled={autoRules.capaMandatory} /></FormControl>
                          </FormItem>
                        )} />
                        <FormField control={reqForm.control} name="remarks" render={({ field }) => (
                          <FormItem><FormLabel>Remarks</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl></FormItem>
                        )} />
                        <Button onClick={() => void handleSaveRequirement()} disabled={busy}><Save className="mr-1 h-4 w-4" /> Save Decision</Button>
                      </CardContent>
                    </Card></Form>

                    <div className="grid gap-4 lg:grid-cols-2">
                      <Form {...linkForm}><Card><CardHeader><CardTitle className="text-base">Link Existing CAPA</CardTitle></CardHeader>
                        <CardContent><form onSubmit={linkForm.handleSubmit((d) => void handleLink(d))} className="space-y-3">
                          <FormField control={linkForm.control} name="capa_number" render={({ field }) => (
                            <FormItem><FormLabel>CAPA Number *</FormLabel><FormControl><Input {...field} className="font-mono" /></FormControl><FormMessage /></FormItem>
                          )} />
                          <Button type="submit" disabled={busy} variant="outline"><Link2 className="mr-1 h-4 w-4" /> Link CAPA</Button>
                        </form></CardContent>
                      </Card></Form>

                      <Form {...createForm}><Card><CardHeader><CardTitle className="text-base">Create New CAPA</CardTitle></CardHeader>
                        <CardContent><form onSubmit={createForm.handleSubmit((d) => void handleCreate(d))} className="space-y-3">
                          <FormField control={createForm.control} name="capa_title" render={({ field }) => (
                            <FormItem><FormLabel>CAPA Title *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                          )} />
                          <FormField control={createForm.control} name="action_owner_name" render={({ field }) => (
                            <FormItem><FormLabel>Action Owner *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                          )} />
                          <FormField control={createForm.control} name="target_completion_date" render={({ field }) => (
                            <FormItem><FormLabel>Target Completion Date *</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                          )} />
                          <Button type="submit" disabled={busy} className="bg-blue-600 hover:bg-blue-700"><Plus className="mr-1 h-4 w-4" /> Create CAPA</Button>
                        </form></CardContent>
                      </Card></Form>
                    </div>
                  </>
                )}
              </TabsContent>

              <TabsContent value="corrective">
                <Form {...createForm}>
                  <Card><CardHeader><CardTitle className="text-base">Corrective Actions</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                      <FormField control={createForm.control} name="root_cause" render={({ field }) => (
                        <FormItem><FormLabel>Root Cause</FormLabel><FormControl><Textarea rows={3} {...field} disabled={!canUpdate || link?.capa_status === 'Closed'} /></FormControl></FormItem>
                      )} />
                      <FormField control={createForm.control} name="corrective_action" render={({ field }) => (
                        <FormItem><FormLabel>Corrective Action *</FormLabel><FormControl><Textarea rows={4} {...field} disabled={!canUpdate || link?.capa_status === 'Closed'} /></FormControl><FormMessage /></FormItem>
                      )} />
                      {canUpdate && link && link.capa_status !== 'Closed' && (
                        <Button onClick={() => void handleImplementation({
                          capa_status: link.capa_status || 'Open',
                          corrective_action: createForm.getValues('corrective_action'),
                          preventive_action: createForm.getValues('preventive_action'),
                          remarks: link.remarks || '',
                        })} disabled={busy}><Save className="mr-1 h-4 w-4" /> Save Actions</Button>
                      )}
                    </CardContent>
                  </Card>
                </Form>
              </TabsContent>

              <TabsContent value="preventive">
                <Form {...createForm}>
                  <Card><CardHeader><CardTitle className="text-base">Preventive Actions</CardTitle></CardHeader>
                    <CardContent>
                      <FormField control={createForm.control} name="preventive_action" render={({ field }) => (
                        <FormItem><FormLabel>Preventive Action *</FormLabel><FormControl><Textarea rows={4} {...field} disabled={!canUpdate || link?.capa_status === 'Closed'} /></FormControl><FormMessage /></FormItem>
                      )} />
                    </CardContent>
                  </Card>
                </Form>
              </TabsContent>

              <TabsContent value="implementation">
                <Form {...implForm}>
                  <Card><CardHeader><CardTitle className="text-base">Implementation Tracking</CardTitle></CardHeader>
                    <CardContent><form onSubmit={implForm.handleSubmit((d) => void handleImplementation(d))} className="space-y-4">
                      <FormField control={implForm.control} name="capa_status" render={({ field }) => (
                        <FormItem><FormLabel>CAPA Status</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value} disabled={!canUpdate}>
                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                            <SelectContent>{OOS_CAPA_DISPLAY_STATUSES.filter((s) => s !== 'Closed').map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                          </Select></FormItem>
                      )} />
                      <FormField control={implForm.control} name="implementation_date" render={({ field }) => (
                        <FormItem><FormLabel>Implementation Date</FormLabel><FormControl><Input type="date" {...field} value={field.value || ''} disabled={!canUpdate} /></FormControl></FormItem>
                      )} />
                      {canUpdate && link && <Button type="submit" disabled={busy || link.capa_status === 'Closed'}>Update Implementation</Button>}
                    </form></CardContent>
                  </Card>
                </Form>
              </TabsContent>

              <TabsContent value="effectiveness">
                <Form {...effForm}>
                  <Card><CardHeader><CardTitle className="text-base">Effectiveness Check</CardTitle>
                    <CardDescription>{link?.effectiveness_check_required ? 'Effectiveness verification required before closure' : 'Optional effectiveness check'}</CardDescription>
                  </CardHeader>
                    <CardContent><form onSubmit={effForm.handleSubmit((d) => void handleEffectiveness(d))} className="space-y-4">
                      <FormField control={effForm.control} name="effectiveness_result" render={({ field }) => (
                        <FormItem><FormLabel>Effectiveness Result *</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value} disabled={!canManage}>
                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                            <SelectContent>{OOS_EFFECTIVENESS_RESULTS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                          </Select><FormMessage /></FormItem>
                      )} />
                      <FormField control={effForm.control} name="effectiveness_check_date" render={({ field }) => (
                        <FormItem><FormLabel>Effectiveness Check Date *</FormLabel><FormControl><Input type="date" {...field} disabled={!canManage} /></FormControl><FormMessage /></FormItem>
                      )} />
                      {canManage && link && link.capa_status !== 'Closed' && (
                        <div className="flex flex-wrap gap-2">
                          <Button type="submit" disabled={busy}>Record Effectiveness</Button>
                          {canClose && (
                            <Button type="button" variant="outline" disabled={busy} onClick={() => void handleClose({ ...closeForm.getValues(), effectiveness_result: effForm.getValues('effectiveness_result') })}>
                              <CheckCircle className="mr-1 h-4 w-4" /> Close CAPA
                            </Button>
                          )}
                        </div>
                      )}
                    </form></CardContent>
                  </Card>
                </Form>
              </TabsContent>

              <TabsContent value="timeline"><OosCapaTimeline entries={timeline} /></TabsContent>

              <TabsContent value="audit">
                <Card><CardHeader><CardTitle className="text-base">Audit Trail</CardTitle></CardHeader>
                  <CardContent>
                    {timeline.length ? (
                      <ul className="space-y-3">{timeline.map((e, i) => (
                        <li key={i} className="border-l-2 border-blue-200 pl-3 text-sm">
                          <p className="font-medium">{e.title}</p>
                          <p className="text-muted-foreground">{e.description}</p>
                          <p className="text-xs text-muted-foreground">{e.user} · {e.date?.slice(0, 19).replace('T', ' ')}</p>
                        </li>
                      ))}</ul>
                    ) : <EmptyState title="No audit entries" message="CAPA activities will appear here." />}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </OosCapaAccessGuard>
  );
}
