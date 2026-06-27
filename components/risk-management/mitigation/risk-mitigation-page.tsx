'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Loader2, Save, Send } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/auth-context';
import {
  canApproveRiskMitigation,
  canEditRiskMitigation,
  calculateResidualRisk,
  isRiskMitigationReadOnly,
  MITIGATION_TYPES,
  MITIGATION_STATUSES,
  type RiskMitigationFormInput,
  type RiskMitigationRecord,
} from '@/lib/risk-mitigation-records';
import {
  approveMitigation,
  fetchRiskMitigationPageData,
  rejectMitigation,
  saveRiskMitigationDraft,
  submitMitigationForReview,
  closeMitigation,
} from '@/lib/risk-mitigation-service';
import { riskMitigationDraftSchema } from '@/lib/risk-mitigation-schemas';
import type { RiskAssessmentRecord } from '@/lib/cpv-risk-assessment-records';
import { CpvPageHeader } from '@/components/cpv/product-master/cpv-page-header';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { RiskMitigationAccessGuard } from './risk-mitigation-access-guard';
import { MitigationStatusBadge, RiskLevelBadge } from './risk-mitigation-badges';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export function RiskMitigationPage({ riskAssessmentId }: { riskAssessmentId: string }) {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [risk, setRisk] = useState<RiskAssessmentRecord | null>(null);
  const [mitigations, setMitigations] = useState<RiskMitigationRecord[]>([]);
  const [activeMitigation, setActiveMitigation] = useState<RiskMitigationRecord | null>(null);
  const [auditLogs, setAuditLogs] = useState<Record<string, unknown>[]>([]);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const actor = useMemo(() => ({
    id: user?.uid || 'system',
    name: profile?.full_name || profile?.email || 'User',
    role: profile?.role,
    email: profile?.email,
  }), [user?.uid, profile?.full_name, profile?.email, profile?.role]);

  const form = useForm<RiskMitigationFormInput>({
    resolver: zodResolver(riskMitigationDraftSchema),
    defaultValues: {
      mitigation_title: '',
      mitigation_description: '',
      mitigation_type: 'Process Control',
      action_owner: '',
      department: '',
      priority: 'Medium',
      target_completion_date: new Date().toISOString().slice(0, 10),
      mitigation_status: 'Draft',
      effectiveness_required: true,
      effectiveness_review_date: '',
      residual_severity: 3,
      residual_occurrence: 3,
      residual_detection: 3,
      capa_required: false,
      capa_number: '',
      change_control_required: false,
      change_control_number: '',
      training_required: false,
      training_reference: '',
      validation_required: false,
      validation_reference: '',
      remarks: '',
    },
  });

  const watchedResidual = form.watch(['residual_severity', 'residual_occurrence', 'residual_detection']);
  const residual = calculateResidualRisk(watchedResidual[0] || 1, watchedResidual[1] || 1, watchedResidual[2] || 1);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const data = await fetchRiskMitigationPageData(riskAssessmentId);
    if (data.error || !('risk' in data) || !data.risk) {
      setError(data.error || 'Not found');
      setLoading(false);
      return;
    }
    setRisk(data.risk);
    setMitigations(data.mitigations || []);
    setActiveMitigation(data.latest || null);
    setAuditLogs(data.auditLogs || []);
    if (data.formDefaults) form.reset(data.formDefaults);
    setLoading(false);
  }, [riskAssessmentId, form]);

  useEffect(() => { void load(); }, [load]);

  const readOnly = isRiskMitigationReadOnly(profile?.role);
  const canEdit = canEditRiskMitigation(profile?.role) && !readOnly;
  const canApprove = canApproveRiskMitigation(profile?.role) && !readOnly;

  const handleSave = form.handleSubmit(async (values) => {
    setBusy(true);
    try {
      await saveRiskMitigationDraft(riskAssessmentId, values, actor);
      toast.success('Mitigation draft saved');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally { setBusy(false); }
  });

  const handleSubmitReview = form.handleSubmit(async (values) => {
    if (!activeMitigation?.id) return toast.error('No mitigation record found');
    setBusy(true);
    try {
      await submitMitigationForReview(riskAssessmentId, activeMitigation.id, values, actor);
      toast.success('Submitted for review');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Submit failed');
    } finally { setBusy(false); }
  });

  const handleApprove = form.handleSubmit(async (values) => {
    if (!activeMitigation?.id) return toast.error('No mitigation record found');
    setBusy(true);
    try {
      await approveMitigation(riskAssessmentId, activeMitigation.id, values, actor);
      toast.success('Mitigation approved');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Approve failed');
    } finally { setBusy(false); }
  });

  const handleReject = async () => {
    if (!activeMitigation?.id || !rejectReason.trim()) return toast.error('Reject reason required');
    setBusy(true);
    try {
      await rejectMitigation(riskAssessmentId, activeMitigation.id, rejectReason, actor);
      toast.success('Mitigation rejected');
      setRejectOpen(false);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Reject failed');
    } finally { setBusy(false); }
  };

  const handleClose = async () => {
    if (!activeMitigation?.id) return toast.error('No mitigation record found');
    setBusy(true);
    try {
      await closeMitigation(riskAssessmentId, activeMitigation.id, actor);
      toast.success('Mitigation closed');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Close failed');
    } finally { setBusy(false); }
  };

  if (loading) return <LoadingSkeleton rows={4} />;
  if (error || !risk) return <ErrorCard title="Unable to load mitigation plan" message={error || 'Not found'} onRetry={load} />;

  const title = risk.parameterName || risk.riskDescription.slice(0, 80);

  return (
    <RiskMitigationAccessGuard>
      <div className="space-y-6">
        <div className="flex items-start gap-3">
          <Link href="/qms/risk-management/mitigation">
            <Button variant="ghost" size="sm" className="gap-1 mt-1"><ArrowLeft className="h-4 w-4" />Back</Button>
          </Link>
          <div className="flex-1">
            <CpvPageHeader
              title="Risk Mitigation Plan"
              description={`${risk.riskNumber} — ${title}`}
              trail={[
                { label: 'Dashboard', href: '/dashboard' },
                { label: 'QMS', href: '/qms/risk-management/audit-trail' },
                { label: 'Mitigation Plan', href: '/qms/risk-management/mitigation' },
                { label: risk.riskNumber },
              ]}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <RiskLevelBadge level={risk.riskLevel} />
          <RiskLevelBadge level={residual.residualRiskLevel} />
          {activeMitigation && <MitigationStatusBadge status={activeMitigation.mitigation_status} />}
        </div>

        <Tabs defaultValue="overview">
          <TabsList className="flex flex-wrap h-auto gap-1">
            <TabsTrigger value="overview">Mitigation Overview</TabsTrigger>
            <TabsTrigger value="actions">Action Management</TabsTrigger>
            <TabsTrigger value="capa">CAPA Linkage</TabsTrigger>
            <TabsTrigger value="change-control">Change Control Linkage</TabsTrigger>
            <TabsTrigger value="training-validation">Training & Validation</TabsTrigger>
            <TabsTrigger value="residual">Residual Risk</TabsTrigger>
            <TabsTrigger value="approval">Approval</TabsTrigger>
            <TabsTrigger value="audit">Audit Trail</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4 space-y-4">
            <Form {...form}>
              <form className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-3">
                  <FormField control={form.control} name="mitigation_title" render={({ field }) => (
                    <FormItem><FormLabel>Mitigation Title *</FormLabel><FormControl><Input {...field} disabled={readOnly} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="mitigation_type" render={({ field }) => (
                    <FormItem><FormLabel>Mitigation Type</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange} disabled={readOnly}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>{MITIGATION_TYPES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                      </Select>
                    </FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="mitigation_description" render={({ field }) => (
                  <FormItem><FormLabel>Mitigation Description *</FormLabel><FormControl><Textarea rows={3} {...field} disabled={readOnly} /></FormControl><FormMessage /></FormItem>
                )} />
                {canEdit && (
                  <Button type="button" variant="outline" onClick={handleSave} disabled={busy}>
                    {busy ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}Save Draft
                  </Button>
                )}
              </form>
            </Form>
          </TabsContent>

          <TabsContent value="actions" className="mt-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Task Tracking</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-3">
                  <FormField control={form.control} name="action_owner" render={({ field }) => (
                    <FormItem><FormLabel>Action Owner *</FormLabel><FormControl><Input {...field} disabled={readOnly} /></FormControl></FormItem>
                  )} />
                  <FormField control={form.control} name="target_completion_date" render={({ field }) => (
                    <FormItem><FormLabel>Target Completion Date *</FormLabel><FormControl><Input type="date" {...field} disabled={readOnly} /></FormControl></FormItem>
                  )} />
                  <FormField control={form.control} name="priority" render={({ field }) => (
                    <FormItem><FormLabel>Priority</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange} disabled={readOnly}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>{['Low', 'Medium', 'High', 'Critical'].map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                      </Select>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="mitigation_status" render={({ field }) => (
                    <FormItem><FormLabel>Status</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange} disabled={readOnly}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>{MITIGATION_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                      </Select>
                    </FormItem>
                  )} />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="capa" className="mt-4">
            <Card><CardHeader><CardTitle className="text-base">CAPA Linkage</CardTitle></CardHeader><CardContent className="space-y-3">
              <FormField control={form.control} name="capa_required" render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded border p-3">
                  <FormLabel className="font-normal">CAPA Required</FormLabel>
                  <FormControl><Switch checked={!!field.value} onCheckedChange={field.onChange} disabled={readOnly} /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="capa_number" render={({ field }) => (
                <FormItem><FormLabel>CAPA Number</FormLabel><FormControl><Input {...field} disabled={readOnly} /></FormControl><FormMessage /></FormItem>
              )} />
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="change-control" className="mt-4">
            <Card><CardHeader><CardTitle className="text-base">Change Control Linkage</CardTitle></CardHeader><CardContent className="space-y-3">
              <FormField control={form.control} name="change_control_required" render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded border p-3">
                  <FormLabel className="font-normal">Change Control Required</FormLabel>
                  <FormControl><Switch checked={!!field.value} onCheckedChange={field.onChange} disabled={readOnly} /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="change_control_number" render={({ field }) => (
                <FormItem><FormLabel>Change Control Number</FormLabel><FormControl><Input {...field} disabled={readOnly} /></FormControl><FormMessage /></FormItem>
              )} />
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="training-validation" className="mt-4">
            <Card><CardHeader><CardTitle className="text-base">Training & Validation</CardTitle></CardHeader><CardContent className="grid sm:grid-cols-2 gap-3">
              <FormField control={form.control} name="training_required" render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded border p-3">
                  <FormLabel className="font-normal">Training Required</FormLabel>
                  <FormControl><Switch checked={!!field.value} onCheckedChange={field.onChange} disabled={readOnly} /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="training_reference" render={({ field }) => (
                <FormItem><FormLabel>Training Reference</FormLabel><FormControl><Input {...field} disabled={readOnly} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="validation_required" render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded border p-3">
                  <FormLabel className="font-normal">Validation Required</FormLabel>
                  <FormControl><Switch checked={!!field.value} onCheckedChange={field.onChange} disabled={readOnly} /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="validation_reference" render={({ field }) => (
                <FormItem><FormLabel>Validation Reference</FormLabel><FormControl><Input {...field} disabled={readOnly} /></FormControl><FormMessage /></FormItem>
              )} />
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="residual" className="mt-4">
            <Card><CardHeader><CardTitle className="text-base">Residual Risk</CardTitle></CardHeader><CardContent className="space-y-4">
              <div className="grid sm:grid-cols-3 gap-3">
                <FormField control={form.control} name="residual_severity" render={({ field }) => (
                  <FormItem><FormLabel>Residual Severity *</FormLabel><FormControl><Input type="number" min={1} max={10} {...field} disabled={readOnly} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="residual_occurrence" render={({ field }) => (
                  <FormItem><FormLabel>Residual Occurrence *</FormLabel><FormControl><Input type="number" min={1} max={10} {...field} disabled={readOnly} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="residual_detection" render={({ field }) => (
                  <FormItem><FormLabel>Residual Detection *</FormLabel><FormControl><Input type="number" min={1} max={10} {...field} disabled={readOnly} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="rounded border p-3"><p className="text-xs text-muted-foreground">Residual RPN</p><p className="text-xl font-semibold">{residual.residualRpn}</p></div>
                <div className="rounded border p-3"><p className="text-xs text-muted-foreground">Residual Risk Level</p><p className="text-xl font-semibold">{residual.residualRiskLevel}</p></div>
              </div>
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="approval" className="mt-4">
            <Card><CardHeader><CardTitle className="text-base">Review & Approval</CardTitle></CardHeader><CardContent className="space-y-3">
              {canEdit && activeMitigation && (
                <Button variant="outline" onClick={handleSubmitReview} disabled={busy}><Send className="h-4 w-4 mr-1" />Submit for Review</Button>
              )}
              {canApprove && activeMitigation && (
                <div className="flex gap-2">
                  <Button onClick={handleApprove} disabled={busy}>Approve</Button>
                  <Button variant="destructive" onClick={() => setRejectOpen(true)} disabled={busy}>Reject</Button>
                  <Button variant="secondary" onClick={handleClose} disabled={busy}>Close</Button>
                </div>
              )}
              {!activeMitigation ? <p className="text-sm text-muted-foreground">Save a mitigation draft first.</p> : null}
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="audit" className="mt-4">
            <Card><CardHeader><CardTitle className="text-base">Audit Trail</CardTitle></CardHeader><CardContent>
              {auditLogs.length ? (
                <Table>
                  <TableHeader><TableRow><TableHead>Action</TableHead><TableHead>User</TableHead><TableHead>Date</TableHead><TableHead>Detail</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {auditLogs.filter((l) => /mitigation|action|capa|change|training|validation|residual|review|approv|reject|close/i.test(String(l.actionType || l.action || ''))).map((l) => (
                      <TableRow key={String(l.id)}>
                        <TableCell>{String(l.actionType || l.action)}</TableCell>
                        <TableCell>{String(l.userName || l.user_name || '—')}</TableCell>
                        <TableCell>{l.dateTime || l.timestamp ? new Date(String(l.dateTime || l.timestamp)).toLocaleString() : '—'}</TableCell>
                        <TableCell className="max-w-xs truncate">{String(l.actionDescription || l.reason || '')}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : <p className="text-sm text-muted-foreground">No audit entries.</p>}
            </CardContent></Card>
          </TabsContent>
        </Tabs>

        <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Reject Mitigation</DialogTitle></DialogHeader>
            <Textarea rows={3} placeholder="Reject reason (required)" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
            <DialogFooter>
              <Button variant="outline" onClick={() => setRejectOpen(false)}>Cancel</Button>
              <Button variant="destructive" onClick={handleReject} disabled={!rejectReason.trim()}>Reject</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </RiskMitigationAccessGuard>
  );
}
