'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  AlertTriangle, ArrowLeft, ExternalLink, Link2, Loader2, Unlink,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/auth-context';
import {
  canApproveCriticalCapaLink,
  canManageCapaLink,
  canUnlinkCapaLink,
  canUpdateCapaActionStatus,
  computeCapaLinkAutoRules,
  isCapaLinkOverdue,
  mapAuditToCapaTimeline,
} from '@/lib/deviation-capa-records';
import {
  createCapaLinkFromDeviation,
  fetchCapaLinkPageData,
  linkExistingCapaToDeviation,
  mapCapaLinkFormDefaults,
  refreshCapaLinkStatus,
  saveCapaRequirement,
  unlinkCapaFromDeviation,
  updateLinkedCapaStatus,
} from '@/lib/deviation-capa-service';
import {
  capaCreateFromDeviationSchema,
  capaLinkExistingSchema,
  capaRequirementSchema,
  capaUnlinkSchema,
  type CapaCreateFromDeviationInput,
  type CapaLinkExistingInput,
  type CapaRequirementInput,
} from '@/lib/deviation-schemas';
import type { CapaEffectiveness, CapaRecord } from '@/lib/capa-types';
import type { DeviationCapaLink, DeviationRecord } from '@/lib/deviation-types';
import { getAuditLogsForDeviation } from '@/lib/deviation-service';
import { CpvPageHeader } from '@/components/cpv/product-master/cpv-page-header';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { DeviationCriticalityBadge, DeviationStatusBadge } from '@/components/deviations/deviation-sub-nav';
import { DeviationCapaAccessGuard } from './deviation-capa-access-guard';
import { CapaLinkStatusBadge } from './capa-link-status-badge';
import { CapaLinkTimeline } from './capa-link-timeline';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CAPA_LINK_DISPLAY_STATUSES } from '@/lib/deviation-types';

export function DeviationCapaPage({ deviationId }: { deviationId: string }) {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [record, setRecord] = useState<DeviationRecord | null>(null);
  const [link, setLink] = useState<DeviationCapaLink | null>(null);
  const [capa, setCapa] = useState<CapaRecord | null>(null);
  const [history, setHistory] = useState<DeviationCapaLink[]>([]);
  const [effectiveness, setEffectiveness] = useState<CapaEffectiveness[]>([]);
  const [auditLogs, setAuditLogs] = useState<Record<string, unknown>[]>([]);
  const [unlinkReason, setUnlinkReason] = useState('');

  const actor = useMemo(() => ({
    id: user?.uid || 'system',
    name: profile?.full_name || profile?.email || 'User',
    role: profile?.role,
    email: profile?.email,
  }), [user?.uid, profile?.full_name, profile?.email, profile?.role]);

  const reqForm = useForm<CapaRequirementInput>({
    resolver: zodResolver(capaRequirementSchema),
    defaultValues: { capa_required: false, remarks: '' },
  });

  const linkForm = useForm<CapaLinkExistingInput>({
    resolver: zodResolver(capaLinkExistingSchema),
    defaultValues: { capa_number: '', remarks: '' },
  });

  const createForm = useForm<CapaCreateFromDeviationInput>({
    resolver: zodResolver(capaCreateFromDeviationSchema),
    defaultValues: {
      capa_required: true,
      capa_title: '',
      capa_source: 'Deviation',
      root_cause: '',
      corrective_action: '',
      preventive_action: '',
      responsible_person_name: '',
      target_completion_date: '',
      effectiveness_check_required: true,
      remarks: '',
    },
  });

  const autoRules = useMemo(() => (record ? computeCapaLinkAutoRules(record) : { capaMandatory: false, warnings: [] }), [record]);
  const canManage = record ? canManageCapaLink(profile?.role, record, actor.id) : false;
  const canUnlink = canUnlinkCapaLink(profile?.role) && canApproveCriticalCapaLink(profile?.role, record?.criticality);
  const canUpdateStatus = canUpdateCapaActionStatus(profile?.role, capa?.action_owner, actor.id);
  const overdue = isCapaLinkOverdue(link);
  const timeline = useMemo(() => mapAuditToCapaTimeline(auditLogs), [auditLogs]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const data = await fetchCapaLinkPageData(deviationId);
    if (data.error || !data.record) {
      setError(data.error || 'Deviation not found');
      setLoading(false);
      return;
    }
    await refreshCapaLinkStatus(deviationId, actor);
    const refreshed = await fetchCapaLinkPageData(deviationId);
    const page = refreshed.record ? refreshed : data;
    setRecord(page.record!);
    setLink(page.link || null);
    setCapa(page.capa || null);
    setHistory(page.history || []);
    setEffectiveness(page.effectiveness || []);
    setAuditLogs(await getAuditLogsForDeviation(deviationId));
    reqForm.reset({ capa_required: page.record!.capa_required, remarks: page.link?.remarks || '' });
    createForm.reset(mapCapaLinkFormDefaults(page.record!, page.link || null, page.capa || null) as CapaCreateFromDeviationInput);
    setLoading(false);
  }, [deviationId, actor, reqForm, createForm]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (autoRules.capaMandatory) reqForm.setValue('capa_required', true);
  }, [autoRules.capaMandatory, reqForm]);

  const handleSaveRequirement = async () => {
    setBusy(true);
    const v = reqForm.getValues();
    const { error: err } = await saveCapaRequirement(deviationId, v.capa_required, v.remarks || '', actor);
    setBusy(false);
    if (err) toast.error(err);
    else { toast.success('CAPA requirement saved'); void load(); }
  };

  const handleLinkCapa = async () => {
    const parsed = capaLinkExistingSchema.safeParse(linkForm.getValues());
    if (!parsed.success) { toast.error(parsed.error.errors[0]?.message || 'Validation failed'); return; }
    setBusy(true);
    const { error: err } = await linkExistingCapaToDeviation(deviationId, parsed.data.capa_number, parsed.data.remarks || '', actor);
    setBusy(false);
    if (err) toast.error(err);
    else { toast.success('CAPA linked'); void load(); }
  };

  const handleCreateCapa = async () => {
    const parsed = capaCreateFromDeviationSchema.safeParse(createForm.getValues());
    if (!parsed.success) { toast.error(parsed.error.errors[0]?.message || 'Validation failed'); return; }
    setBusy(true);
    const { error: err } = await createCapaLinkFromDeviation(deviationId, parsed.data, actor);
    setBusy(false);
    if (err) toast.error(err);
    else { toast.success('CAPA created and linked'); void load(); }
  };

  const handleUnlink = async () => {
    const parsed = capaUnlinkSchema.safeParse({ reason: unlinkReason });
    if (!parsed.success) { toast.error(parsed.error.errors[0]?.message || 'Reason required'); return; }
    setBusy(true);
    const { error: err } = await unlinkCapaFromDeviation(deviationId, parsed.data.reason, actor);
    setBusy(false);
    if (err) toast.error(err);
    else { toast.success('CAPA unlinked'); setUnlinkReason(''); void load(); }
  };

  if (loading) return <LoadingSkeleton rows={3} />;
  if (error || !record) return <ErrorCard title="Unable to load CAPA link" message={error || 'Not found'} onRetry={load} />;

  return (
    <DeviationCapaAccessGuard>
      <div className="space-y-6">
        <CpvPageHeader
          title="Deviation CAPA Link"
          description={`${record.deviation_number} — create, link, track and review CAPA actions`}
          trail={[
            { label: 'QMS', href: '/qms/deviation' },
            { label: 'Deviation Management', href: '/qms/deviation' },
            { label: record.deviation_number, href: `/qms/deviation/${deviationId}` },
            { label: 'CAPA Link' },
          ]}
          actions={(
            <>
              <Link href={`/qms/deviation/${deviationId}`}>
                <Button variant="outline" size="sm"><ArrowLeft className="mr-1 h-4 w-4" />Deviation Detail</Button>
              </Link>
              <Link href="/qms/deviation/capa-link">
                <Button variant="outline" size="sm">All CAPA Links</Button>
              </Link>
            </>
          )}
        />

        <div className="flex flex-wrap items-center gap-2">
          <DeviationStatusBadge status={record.status} />
          <DeviationCriticalityBadge criticality={record.criticality} />
          {link && <CapaLinkStatusBadge status={link.capa_status} />}
          {overdue && <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">Overdue</span>}
          {autoRules.capaMandatory && <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs text-orange-800">CAPA Mandatory</span>}
        </div>

        {autoRules.warnings.map((w) => (
          <div key={w} className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{w}
          </div>
        ))}

        <Tabs defaultValue="requirement" className="space-y-4">
          <TabsList className="flex h-auto flex-wrap gap-1">
            {['requirement', 'linked', 'create', 'effectiveness', 'timeline', 'audit'].map((t) => (
              <TabsTrigger key={t} value={t} className="capitalize">
                {t === 'linked' ? 'Linked CAPA' : t === 'create' ? 'Create CAPA' : t === 'audit' ? 'Audit Trail' : t.replace('_', ' ')}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="requirement">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">CAPA Requirement</CardTitle>
                <CardDescription>Determine whether CAPA is required for this deviation</CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...reqForm}>
                  <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void handleSaveRequirement(); }}>
                    <FormField control={reqForm.control} name="capa_required" render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-4">
                        <div>
                          <FormLabel>CAPA Required {autoRules.capaMandatory ? '(Mandatory)' : ''}</FormLabel>
                          <p className="text-xs text-muted-foreground">Product quality impact, repeat deviation, or critical deviation mandates CAPA</p>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} disabled={!canManage || autoRules.capaMandatory} />
                        </FormControl>
                      </FormItem>
                    )} />
                    <FormField control={reqForm.control} name="remarks" render={({ field }) => (
                      <FormItem><FormLabel>Remarks</FormLabel><FormControl><Textarea rows={2} {...field} disabled={!canManage} /></FormControl></FormItem>
                    )} />
                    {canManage && (
                      <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={busy}>
                        {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}Save Requirement
                      </Button>
                    )}
                  </form>
                </Form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="linked" className="space-y-4">
            {link || record.linked_capa_number ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base font-mono">{link?.capa_number || record.linked_capa_number}</CardTitle>
                  <CardDescription>{link?.capa_title || capa?.capa_title}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 text-sm">
                    {[['CAPA Status', link?.capa_status], ['Source', link?.capa_source || capa?.capa_source],
                      ['Responsible', link?.responsible_person_name || capa?.action_owner_name],
                      ['Target Date', link?.target_completion_date || capa?.target_completion_date || '—'],
                      ['Linked By', link?.linked_by_name || '—'], ['Linked Date', link?.linked_date || '—'],
                      ['Corrective Action', link?.corrective_action || capa?.corrective_action],
                      ['Preventive Action', link?.preventive_action || capa?.preventive_action]].map(([l, v]) => (
                      <div key={String(l)}><p className="text-xs text-muted-foreground">{l}</p><p className="font-medium">{v || '—'}</p></div>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link href={capa ? `/qms/capa/${capa.id}` : '/qms/capa'}>
                      <Button variant="outline" size="sm"><ExternalLink className="mr-1 h-4 w-4" />Open CAPA Module</Button>
                    </Link>
                    {canUpdateStatus && (
                      <Select onValueChange={(v) => void updateLinkedCapaStatus(deviationId, v, actor).then(() => load())}>
                        <SelectTrigger className="w-[200px] h-9"><SelectValue placeholder="Update status" /></SelectTrigger>
                        <SelectContent>
                          {CAPA_LINK_DISPLAY_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                  {canUnlink && (
                    <div className="rounded-lg border border-red-200 bg-red-50/50 p-4 space-y-2">
                      <p className="text-sm font-medium text-red-900">Unlink CAPA</p>
                      <Textarea placeholder="Reason for unlinking (required)" value={unlinkReason} onChange={(e) => setUnlinkReason(e.target.value)} rows={2} />
                      <Button variant="destructive" size="sm" disabled={busy} onClick={handleUnlink}>
                        <Unlink className="mr-1 h-4 w-4" />Unlink CAPA
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">No CAPA linked yet. Link an existing CAPA or create a new one.</CardContent></Card>
            )}

            {!link && canManage && (
              <Card>
                <CardHeader><CardTitle className="text-base">Link Existing CAPA</CardTitle></CardHeader>
                <CardContent>
                  <Form {...linkForm}>
                    <form className="flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={(e) => { e.preventDefault(); void handleLinkCapa(); }}>
                      <FormField control={linkForm.control} name="capa_number" render={({ field }) => (
                        <FormItem className="flex-1"><FormLabel>CAPA Number *</FormLabel><FormControl><Input {...field} placeholder="CAPA-2026-001" /></FormControl><FormMessage /></FormItem>
                      )} />
                      <Button type="submit" variant="outline" disabled={busy}><Link2 className="mr-1 h-4 w-4" />Link CAPA</Button>
                    </form>
                  </Form>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="create">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Create CAPA from Deviation</CardTitle>
                <CardDescription>Creates a new CAPA record and links it to this deviation</CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...createForm}>
                  <form className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); void handleCreateCapa(); }}>
                    <FormField control={createForm.control} name="capa_title" render={({ field }) => (
                      <FormItem className="sm:col-span-2"><FormLabel>CAPA Title *</FormLabel><FormControl><Input {...field} disabled={!canManage} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={createForm.control} name="root_cause" render={({ field }) => (
                      <FormItem className="sm:col-span-2"><FormLabel>Root Cause *</FormLabel><FormControl><Textarea rows={2} {...field} disabled={!canManage} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={createForm.control} name="corrective_action" render={({ field }) => (
                      <FormItem><FormLabel>Corrective Action *</FormLabel><FormControl><Textarea rows={3} {...field} disabled={!canManage} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={createForm.control} name="preventive_action" render={({ field }) => (
                      <FormItem><FormLabel>Preventive Action *</FormLabel><FormControl><Textarea rows={3} {...field} disabled={!canManage} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={createForm.control} name="responsible_person_name" render={({ field }) => (
                      <FormItem><FormLabel>Responsible Person *</FormLabel><FormControl><Input {...field} disabled={!canManage} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={createForm.control} name="target_completion_date" render={({ field }) => (
                      <FormItem><FormLabel>Target Completion Date *</FormLabel><FormControl><Input type="date" {...field} disabled={!canManage} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={createForm.control} name="effectiveness_check_required" render={({ field }) => (
                      <FormItem className="flex items-center gap-3 sm:col-span-2">
                        <FormLabel>Effectiveness Check Required</FormLabel>
                        <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} disabled={!canManage} /></FormControl>
                      </FormItem>
                    )} />
                    <FormField control={createForm.control} name="remarks" render={({ field }) => (
                      <FormItem className="sm:col-span-2"><FormLabel>Remarks</FormLabel><FormControl><Textarea rows={2} {...field} disabled={!canManage} /></FormControl></FormItem>
                    )} />
                    {canManage && !link && (
                      <div className="sm:col-span-2">
                        <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={busy}>
                          {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}Create & Link CAPA
                        </Button>
                      </div>
                    )}
                  </form>
                </Form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="effectiveness">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Effectiveness Summary</CardTitle>
                <CardDescription>CAPA effectiveness check status and results</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2 text-sm">
                  <div><p className="text-xs text-muted-foreground">Check Required</p><p className="font-medium">{capa?.effectiveness_check_required ? 'Yes' : 'No'}</p></div>
                  <div><p className="text-xs text-muted-foreground">Check Date</p><p className="font-medium">{capa?.effectiveness_check_date || link?.effectiveness_check_date || '—'}</p></div>
                  <div><p className="text-xs text-muted-foreground">Result</p><p className="font-medium">{capa?.effectiveness_result || link?.effectiveness_result || 'Pending'}</p></div>
                  <div><p className="text-xs text-muted-foreground">Criteria</p><p className="font-medium">{capa?.effectiveness_criteria || '—'}</p></div>
                </div>
                {effectiveness.map((e) => (
                  <div key={e.id} className="rounded-lg border p-3 text-sm">
                    <p className="font-medium">{e.result} — {e.check_date}</p>
                    <p className="text-muted-foreground">{e.criteria}</p>
                    <p className="text-xs mt-1">Checked by {e.checked_by_name}</p>
                  </div>
                ))}
                {!capa && <p className="text-sm text-muted-foreground">Link a CAPA to view effectiveness data.</p>}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="timeline">
            <Card><CardHeader><CardTitle className="text-base">CAPA Timeline</CardTitle></CardHeader>
              <CardContent><CapaLinkTimeline entries={timeline} /></CardContent>
            </Card>
            {history.length > 1 && (
              <Card><CardHeader><CardTitle className="text-base">Link History</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {history.map((h) => (
                    <div key={h.id} className="flex justify-between border-b pb-2 text-sm last:border-0">
                      <span className="font-mono">{h.capa_number}</span>
                      <span>{h.is_active ? 'Active' : `Unlinked: ${h.unlink_reason || '—'}`}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="audit">
            <Card><CardHeader><CardTitle className="text-base">Audit Trail</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {auditLogs.filter((l) => String(l.action || l.actionType || '').toLowerCase().includes('capa')).slice(0, 25).map((log, i) => (
                  <div key={i} className="border-b pb-2 text-sm last:border-0">
                    <div className="flex justify-between gap-2">
                      <span className="font-medium">{String(log.action || log.actionType)}</span>
                      <span className="text-xs text-muted-foreground">{String(log.dateTime || log.created_at || '')}</span>
                    </div>
                    <p className="text-muted-foreground">{String(log.reason || log.actionDescription || '')}</p>
                  </div>
                )) || <p className="text-sm text-muted-foreground">No CAPA audit entries yet.</p>}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DeviationCapaAccessGuard>
  );
}

export function DeviationCapaPageShell({ deviationId }: { deviationId: string }) {
  return <DeviationCapaPage deviationId={deviationId} />;
}
