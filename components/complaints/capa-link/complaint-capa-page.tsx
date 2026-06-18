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
  canApproveCriticalComplaintCapaLink,
  canManageComplaintCapaLink,
  canReviewComplaintCapaLink,
  canUnlinkComplaintCapaLink,
  canUpdateComplaintCapaActionStatus,
  computeComplaintCapaLinkAutoRules,
  isComplaintCapaLinkOverdue,
  mapAuditToComplaintCapaTimeline,
} from '@/lib/complaint-capa-records';
import {
  createComplaintCapaLink,
  fetchComplaintCapaPageData,
  getAuditLogsForComplaint,
  linkExistingCapaToComplaint,
  mapComplaintCapaLinkFormDefaults,
  refreshComplaintCapaLinkStatus,
  saveComplaintCapaImplementation,
  saveComplaintCapaRequirement,
  unlinkCapaFromComplaint,
  updateLinkedComplaintCapaStatus,
} from '@/lib/complaint-capa-service';
import {
  complaintCapaCreateSchema,
  complaintCapaImplementationSchema,
  complaintCapaLinkExistingSchema,
  complaintCapaRequirementSchema,
  complaintCapaUnlinkSchema,
  type ComplaintCapaCreateInput,
  type ComplaintCapaImplementationInput,
  type ComplaintCapaLinkExistingInput,
  type ComplaintCapaRequirementInput,
} from '@/lib/complaint-capa-schemas';
import type { CapaEffectiveness, CapaRecord } from '@/lib/capa-types';
import type { ComplaintCapaLink, ComplaintImpactAssessment, ComplaintRecord } from '@/lib/complaint-types';
import { COMPLAINT_CAPA_LINK_STATUSES } from '@/lib/complaint-types';
import { CpvPageHeader } from '@/components/cpv/product-master/cpv-page-header';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { ComplaintStatusBadge, CriticalityBadge } from '@/components/complaints/complaint-sub-nav';
import { CapaLinkTimeline } from '@/components/deviations/capa-link/capa-link-timeline';
import { ComplaintCapaAccessGuard } from './complaint-capa-access-guard';
import { ComplaintCapaStatusBadge } from './complaint-capa-status-badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export function ComplaintCapaPage({ complaintId }: { complaintId: string }) {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [record, setRecord] = useState<ComplaintRecord | null>(null);
  const [impact, setImpact] = useState<ComplaintImpactAssessment | null>(null);
  const [link, setLink] = useState<ComplaintCapaLink | null>(null);
  const [capa, setCapa] = useState<CapaRecord | null>(null);
  const [history, setHistory] = useState<ComplaintCapaLink[]>([]);
  const [effectiveness, setEffectiveness] = useState<CapaEffectiveness[]>([]);
  const [auditLogs, setAuditLogs] = useState<Record<string, unknown>[]>([]);
  const [unlinkReason, setUnlinkReason] = useState('');

  const actor = useMemo(() => ({
    id: user?.uid || 'system',
    name: profile?.full_name || profile?.email || 'User',
    role: profile?.role,
    email: profile?.email,
  }), [user?.uid, profile?.full_name, profile?.email, profile?.role]);

  const reqForm = useForm<ComplaintCapaRequirementInput>({
    resolver: zodResolver(complaintCapaRequirementSchema),
    defaultValues: { capa_required: false, remarks: '' },
  });

  const linkForm = useForm<ComplaintCapaLinkExistingInput>({
    resolver: zodResolver(complaintCapaLinkExistingSchema),
    defaultValues: { capa_number: '', remarks: '' },
  });

  const createForm = useForm<ComplaintCapaCreateInput>({
    resolver: zodResolver(complaintCapaCreateSchema),
    defaultValues: {
      capa_required: true,
      capa_title: '',
      capa_source: 'Market Complaint',
      root_cause: '',
      corrective_action: '',
      preventive_action: '',
      action_owner_name: '',
      department: 'QA',
      target_completion_date: '',
      effectiveness_check_required: true,
      remarks: '',
    },
  });

  const implForm = useForm<ComplaintCapaImplementationInput>({
    resolver: zodResolver(complaintCapaImplementationSchema),
    defaultValues: {
      capa_status: 'Under Implementation',
      implementation_date: '',
      corrective_action: '',
      preventive_action: '',
      remarks: '',
    },
  });

  const autoRules = useMemo(() => (record ? computeComplaintCapaLinkAutoRules(record, impact) : { capaMandatory: false, warnings: [] }), [record, impact]);
  const canManage = record ? canManageComplaintCapaLink(profile?.role, record, actor.id) : false;
  const canUnlink = canUnlinkComplaintCapaLink(profile?.role) && canApproveCriticalComplaintCapaLink(profile?.role, record?.complaint_criticality);
  const canUpdateStatus = canUpdateComplaintCapaActionStatus(profile?.role, capa?.action_owner, actor.id);
  const canReview = canReviewComplaintCapaLink(profile?.role);
  const overdue = isComplaintCapaLinkOverdue(link);
  const timeline = useMemo(() => mapAuditToComplaintCapaTimeline(auditLogs), [auditLogs]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const data = await fetchComplaintCapaPageData(complaintId);
    if (data.error || !data.record) {
      setError(data.error || 'Complaint not found');
      setLoading(false);
      return;
    }
    await refreshComplaintCapaLinkStatus(complaintId, actor);
    const refreshed = await fetchComplaintCapaPageData(complaintId);
    const page = refreshed.record ? refreshed : data;
    setRecord(page.record!);
    setImpact(page.impact || null);
    setLink(page.link || null);
    setCapa(page.capa || null);
    setHistory(page.history || []);
    setEffectiveness(page.effectiveness || []);
    setAuditLogs(await getAuditLogsForComplaint(complaintId));
    reqForm.reset({ capa_required: page.record!.capa_required, remarks: page.link?.remarks || '' });
    createForm.reset(mapComplaintCapaLinkFormDefaults(page.record!, page.link || null, page.capa || null, page.impact || null) as ComplaintCapaCreateInput);
    implForm.reset({
      capa_status: page.link?.capa_status || 'Under Implementation',
      implementation_date: page.link?.implementation_date || '',
      corrective_action: page.link?.corrective_action || page.capa?.corrective_action || '',
      preventive_action: page.link?.preventive_action || page.capa?.preventive_action || '',
      remarks: page.link?.remarks || '',
    });
    setLoading(false);
  }, [complaintId, actor, reqForm, createForm, implForm]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (autoRules.capaMandatory) reqForm.setValue('capa_required', true);
  }, [autoRules.capaMandatory, reqForm]);

  const handleSaveRequirement = async () => {
    setBusy(true);
    const v = reqForm.getValues();
    const { error: err } = await saveComplaintCapaRequirement(complaintId, v.capa_required, v.remarks || '', actor);
    setBusy(false);
    if (err) toast.error(err);
    else { toast.success('CAPA requirement saved'); void load(); }
  };

  const handleLinkCapa = async () => {
    const parsed = complaintCapaLinkExistingSchema.safeParse(linkForm.getValues());
    if (!parsed.success) { toast.error(parsed.error.errors[0]?.message || 'Validation failed'); return; }
    setBusy(true);
    const { error: err } = await linkExistingCapaToComplaint(complaintId, parsed.data.capa_number, parsed.data.remarks || '', actor);
    setBusy(false);
    if (err) toast.error(err);
    else { toast.success('CAPA linked'); void load(); }
  };

  const handleCreateCapa = async () => {
    const parsed = complaintCapaCreateSchema.safeParse(createForm.getValues());
    if (!parsed.success) { toast.error(parsed.error.errors[0]?.message || 'Validation failed'); return; }
    setBusy(true);
    const { error: err } = await createComplaintCapaLink(complaintId, parsed.data, actor);
    setBusy(false);
    if (err) toast.error(err);
    else { toast.success('CAPA created and linked'); void load(); }
  };

  const handleUnlink = async () => {
    const parsed = complaintCapaUnlinkSchema.safeParse({ reason: unlinkReason });
    if (!parsed.success) { toast.error(parsed.error.errors[0]?.message || 'Reason required'); return; }
    setBusy(true);
    const { error: err } = await unlinkCapaFromComplaint(complaintId, parsed.data.reason, actor);
    setBusy(false);
    if (err) toast.error(err);
    else { toast.success('CAPA unlinked'); setUnlinkReason(''); void load(); }
  };

  const handleSaveImplementation = async (data: ComplaintCapaImplementationInput) => {
    setBusy(true);
    const { error: err } = await saveComplaintCapaImplementation(complaintId, data, actor);
    setBusy(false);
    if (err) toast.error(err);
    else { toast.success('Implementation updated'); void load(); }
  };

  if (loading) return <LoadingSkeleton rows={3} />;
  if (error || !record) return <ErrorCard title="Unable to load CAPA link" message={error || 'Not found'} onRetry={() => void load()} />;

  return (
    <ComplaintCapaAccessGuard>
      <div className="space-y-6">
        <CpvPageHeader
          title="Complaint CAPA Link"
          description={`${record.complaint_number} — create, link, track and verify CAPA actions`}
          trail={[
            { label: 'Dashboard', href: '/dashboard' },
            { label: 'QMS', href: '/qms/complaints' },
            { label: 'Complaint Management', href: '/qms/complaints' },
            { label: 'CAPA Link', href: '/qms/complaints/capa-link' },
            { label: record.complaint_number },
          ]}
          actions={(
            <>
              <Link href={`/qms/complaints/${complaintId}`}>
                <Button variant="outline" size="sm"><ArrowLeft className="mr-1 h-4 w-4" />Complaint Detail</Button>
              </Link>
              <Link href="/qms/complaints/capa-link">
                <Button variant="outline" size="sm">All CAPA Links</Button>
              </Link>
            </>
          )}
        />

        <div className="flex flex-wrap items-center gap-2">
          <ComplaintStatusBadge status={record.status} />
          <CriticalityBadge value={record.complaint_criticality} />
          {link && <ComplaintCapaStatusBadge status={link.capa_status} />}
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
            {[
              ['requirement', 'CAPA Requirement'],
              ['linked', 'Linked CAPA'],
              ['create', 'Create CAPA'],
              ['implementation', 'Implementation'],
              ['effectiveness', 'Effectiveness'],
              ['timeline', 'Timeline'],
              ['audit', 'Audit Trail'],
            ].map(([value, label]) => (
              <TabsTrigger key={value} value={value}>{label}</TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="requirement">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">CAPA Requirement</CardTitle>
                <CardDescription>Determine whether CAPA is required for this complaint</CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...reqForm}>
                  <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void handleSaveRequirement(); }}>
                    <FormField control={reqForm.control} name="capa_required" render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-4">
                        <div>
                          <FormLabel>CAPA Required {autoRules.capaMandatory ? '(Mandatory)' : ''}</FormLabel>
                          <p className="text-xs text-muted-foreground">Product quality/patient safety impact, criticality, or repeat complaint mandates CAPA</p>
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
                      ['Action Owner', link?.action_owner_name || capa?.action_owner_name],
                      ['Department', link?.department || capa?.department || '—'],
                      ['Target Date', link?.target_completion_date || capa?.target_completion_date || '—'],
                      ['Implementation', link?.implementation_date || capa?.actual_completion_date || '—'],
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
                      <Select onValueChange={(v) => void updateLinkedComplaintCapaStatus(complaintId, v, actor).then(() => load())}>
                        <SelectTrigger className="w-[220px] h-9"><SelectValue placeholder="Update status" /></SelectTrigger>
                        <SelectContent>
                          {COMPLAINT_CAPA_LINK_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
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
                <CardTitle className="text-base">Create CAPA from Complaint</CardTitle>
                <CardDescription>Creates a new CAPA record and links it to this complaint</CardDescription>
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
                    <FormField control={createForm.control} name="action_owner_name" render={({ field }) => (
                      <FormItem><FormLabel>Action Owner *</FormLabel><FormControl><Input {...field} disabled={!canManage} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={createForm.control} name="department" render={({ field }) => (
                      <FormItem><FormLabel>Department</FormLabel><FormControl><Input {...field} disabled={!canManage} /></FormControl></FormItem>
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

          <TabsContent value="implementation">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">CAPA Implementation Tracking</CardTitle>
                <CardDescription>Update implementation progress and action status</CardDescription>
              </CardHeader>
              <CardContent>
                {!link ? (
                  <p className="text-sm text-muted-foreground">Link a CAPA to track implementation.</p>
                ) : (
                  <Form {...implForm}>
                    <form className="grid gap-4 sm:grid-cols-2" onSubmit={implForm.handleSubmit((d) => void handleSaveImplementation(d))}>
                      <FormField control={implForm.control} name="capa_status" render={({ field }) => (
                        <FormItem>
                          <FormLabel>CAPA Status</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value} disabled={!canUpdateStatus && !canReview}>
                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                            <SelectContent>
                              {COMPLAINT_CAPA_LINK_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )} />
                      <FormField control={implForm.control} name="implementation_date" render={({ field }) => (
                        <FormItem><FormLabel>Implementation Date</FormLabel><FormControl><Input type="date" {...field} disabled={!canUpdateStatus} /></FormControl></FormItem>
                      )} />
                      <FormField control={implForm.control} name="corrective_action" render={({ field }) => (
                        <FormItem><FormLabel>Corrective Action</FormLabel><FormControl><Textarea rows={3} {...field} disabled={!canUpdateStatus} /></FormControl></FormItem>
                      )} />
                      <FormField control={implForm.control} name="preventive_action" render={({ field }) => (
                        <FormItem><FormLabel>Preventive Action</FormLabel><FormControl><Textarea rows={3} {...field} disabled={!canUpdateStatus} /></FormControl></FormItem>
                      )} />
                      <FormField control={implForm.control} name="remarks" render={({ field }) => (
                        <FormItem className="sm:col-span-2"><FormLabel>Remarks</FormLabel><FormControl><Textarea rows={2} {...field} disabled={!canUpdateStatus && !canReview} /></FormControl></FormItem>
                      )} />
                      {(canUpdateStatus || canReview) && (
                        <div className="sm:col-span-2">
                          <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={busy}>
                            {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}Save Implementation
                          </Button>
                        </div>
                      )}
                    </form>
                  </Form>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="effectiveness">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Effectiveness Summary</CardTitle>
                <CardDescription>CAPA effectiveness check status and results — required before complaint closure when configured</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2 text-sm">
                  <div><p className="text-xs text-muted-foreground">Check Required</p><p className="font-medium">{capa?.effectiveness_check_required ? 'Yes' : 'No'}</p></div>
                  <div><p className="text-xs text-muted-foreground">Check Date</p><p className="font-medium">{capa?.effectiveness_check_date || link?.effectiveness_check_date || '—'}</p></div>
                  <div><p className="text-xs text-muted-foreground">Result</p><p className="font-medium">{capa?.effectiveness_result || link?.effectiveness_result || 'Pending'}</p></div>
                  <div><p className="text-xs text-muted-foreground">Closure Date</p><p className="font-medium">{link?.capa_closure_date || '—'}</p></div>
                  <div className="sm:col-span-2"><p className="text-xs text-muted-foreground">Criteria</p><p className="font-medium">{capa?.effectiveness_criteria || '—'}</p></div>
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
                {auditLogs.filter((l) => /capa/i.test(String(l.action || l.actionType || ''))).slice(0, 25).map((log, i) => (
                  <div key={i} className="border-b pb-2 text-sm last:border-0">
                    <div className="flex justify-between gap-2">
                      <span className="font-medium">{String(log.action || log.actionType)}</span>
                      <span className="text-xs text-muted-foreground">{String(log.dateTime || log.created_at || '')}</span>
                    </div>
                    <p className="text-muted-foreground">{String(log.reason || log.actionDescription || '')}</p>
                  </div>
                ))}
                {!auditLogs.some((l) => /capa/i.test(String(l.action || l.actionType || ''))) && (
                  <p className="text-sm text-muted-foreground">No CAPA audit entries yet.</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </ComplaintCapaAccessGuard>
  );
}
