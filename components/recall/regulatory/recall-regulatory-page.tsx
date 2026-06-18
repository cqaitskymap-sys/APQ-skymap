'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  ArrowLeft, CheckCircle, Loader2, RefreshCw, Upload, XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/auth-context';
import {
  fetchRecallRegulatoryPageData,
  logRegulatoryEsignResult,
  recordRegulatoryAuthorityResponse,
  submitHeadQaRegulatoryApproval,
  submitRegulatoryNotification,
  submitRegulatoryQaReview,
  updateRegulatoryFollowUp,
  updateRegulatoryNotificationDetails,
} from '@/services/recallRegulatoryService';
import {
  recallRegulatoryApprovalSchema,
  recallRegulatoryDetailsSchema,
  recallRegulatoryFollowUpSchema,
  recallRegulatoryResponseSchema,
  recallRegulatorySubmissionSchema,
  type RecallRegulatoryApprovalInput,
  type RecallRegulatoryDetailsInput,
  type RecallRegulatoryFollowUpInput,
  type RecallRegulatoryResponseInput,
  type RecallRegulatorySubmissionInput,
} from '@/lib/recall-regulatory-schemas';
import {
  canApproveRecallRegulatoryHeadQa,
  canCreateReviewRecallRegulatory,
  canUpdateRegulatorySubmission,
  isRecallCritical,
} from '@/lib/recall-types';
import {
  canEditRegulatoryDetails,
  canEditRegulatorySubmission,
  canPerformHeadQaRegulatoryApproval,
  enforceMandatoryRegulatoryRules,
  mapRegulatoryAuditAction,
  RECALL_REGULATORY_MODULE,
} from '@/lib/recall-regulatory-records';
import { CpvPageHeader } from '@/components/cpv/product-master/cpv-page-header';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { ESignatureModal } from '@/components/shared/esignature-modal';
import { RecallRegulatoryAccessGuard } from './recall-regulatory-access-guard';
import { RegulatoryApprovalStatusBadge, RegulatoryNotificationStatusBadge } from './recall-regulatory-badges';
import { RecallRegulatoryTimeline } from './recall-regulatory-timeline';
import { ClassificationBadge, RecallStatusBadge } from '@/components/recall/recall-sub-nav';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';

export function RecallRegulatoryPage({ recallId }: { recallId: string }) {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState('details');
  const [data, setData] = useState<Awaited<ReturnType<typeof fetchRecallRegulatoryPageData>>>(null);
  const [esignOpen, setEsignOpen] = useState(false);
  const [pendingApproval, setPendingApproval] = useState<RecallRegulatoryApprovalInput | null>(null);

  const actor = useMemo(() => ({
    id: user?.uid || 'system',
    name: profile?.full_name || profile?.email || 'User',
    role: profile?.role || 'viewer',
    email: profile?.email,
  }), [user?.uid, profile?.full_name, profile?.email, profile?.role]);

  const readOnly = data?.readOnly ?? false;
  const canEditDetails = canEditRegulatoryDetails(actor.role, readOnly);
  const canEditSubmission = canEditRegulatorySubmission(actor.role, readOnly);
  const canHeadQaApprove = canPerformHeadQaRegulatoryApproval(actor.role, readOnly);

  const detailsForm = useForm<RecallRegulatoryDetailsInput>({
    resolver: zodResolver(recallRegulatoryDetailsSchema),
    defaultValues: {
      regulatory_authority: '',
      notification_required: false,
      notification_due_date: null,
      market_region: '',
      qa_comments: '',
    },
  });

  const submissionForm = useForm<RecallRegulatorySubmissionInput>({
    resolver: zodResolver(recallRegulatorySubmissionSchema),
    defaultValues: {
      notification_date: new Date().toISOString().split('T')[0],
      submission_reference_number: '',
      submission_document: '',
      regulatory_comments: '',
    },
  });

  const responseForm = useForm<RecallRegulatoryResponseInput>({
    resolver: zodResolver(recallRegulatoryResponseSchema),
    defaultValues: {
      authority_response: '',
      response_date: new Date().toISOString().split('T')[0],
    },
  });

  const followUpForm = useForm<RecallRegulatoryFollowUpInput>({
    resolver: zodResolver(recallRegulatoryFollowUpSchema),
    defaultValues: {
      follow_up_required: false,
      follow_up_due_date: null,
      regulatory_comments: '',
    },
  });

  const approvalForm = useForm<RecallRegulatoryApprovalInput>({
    resolver: zodResolver(recallRegulatoryApprovalSchema),
    defaultValues: {
      qa_comments: '',
      head_qa_comments: '',
      decision: 'approved',
      e_signature: '',
    },
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchRecallRegulatoryPageData(recallId, actor);
      if (!result) throw new Error('Recall not found');
      setData(result);
      const { notification } = result;
      detailsForm.reset({
        regulatory_authority: notification.regulatory_authority,
        notification_required: notification.notification_required,
        notification_due_date: notification.notification_due_date,
        market_region: notification.market_region,
        qa_comments: notification.qa_comments,
      });
      submissionForm.reset({
        notification_date: notification.notification_date || new Date().toISOString().split('T')[0],
        submission_reference_number: notification.submission_reference_number,
        submission_document: notification.submission_document,
        regulatory_comments: notification.regulatory_comments,
      });
      responseForm.reset({
        authority_response: notification.authority_response,
        response_date: notification.response_date || new Date().toISOString().split('T')[0],
      });
      followUpForm.reset({
        follow_up_required: notification.follow_up_required,
        follow_up_due_date: notification.follow_up_due_date,
        regulatory_comments: notification.regulatory_comments,
      });
      approvalForm.reset({
        qa_comments: notification.qa_comments,
        head_qa_comments: notification.head_qa_comments,
        decision: 'approved',
        e_signature: notification.signed_by_name || '',
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load regulatory data');
    } finally {
      setLoading(false);
    }
  }, [recallId, actor.id, actor.name, actor.role]);

  useEffect(() => { void load(); }, [load]);

  const handleDetailsSave = async (input: RecallRegulatoryDetailsInput) => {
    if (!data) return;
    const enforced = enforceMandatoryRegulatoryRules(data.recall, input.notification_required);
    try {
      setBusy(true);
      await updateRegulatoryNotificationDetails(recallId, {
        ...input,
        notification_required: enforced.notificationRequired,
      }, actor);
      toast.success('Notification details saved');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const handleSubmission = async (input: RecallRegulatorySubmissionInput) => {
    try {
      setBusy(true);
      await submitRegulatoryNotification(recallId, input, actor);
      toast.success('Regulatory submission recorded');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Submission failed');
    } finally {
      setBusy(false);
    }
  };

  const handleResponse = async (input: RecallRegulatoryResponseInput) => {
    try {
      setBusy(true);
      await recordRegulatoryAuthorityResponse(recallId, input, actor);
      toast.success('Authority response recorded');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  };

  const handleFollowUp = async (input: RecallRegulatoryFollowUpInput) => {
    try {
      setBusy(true);
      await updateRegulatoryFollowUp(recallId, input, actor);
      toast.success('Follow-up updated');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  };

  const handleApprovalSubmit = async (input: RecallRegulatoryApprovalInput) => {
    if (data?.notification.e_signature_required && input.decision === 'approved') {
      setPendingApproval(input);
      setEsignOpen(true);
      return;
    }
    try {
      setBusy(true);
      if (canCreateReviewRecallRegulatory(actor.role) && !canHeadQaApprove) {
        await submitRegulatoryQaReview(recallId, input.qa_comments, actor);
      } else {
        await submitHeadQaRegulatoryApproval(recallId, input, actor);
      }
      toast.success('Approval recorded');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Approval failed');
    } finally {
      setBusy(false);
    }
  };

  const handleEsignSuccess = async () => {
    if (!pendingApproval) return;
    const eSignature = actor.name;
    try {
      setBusy(true);
      await logRegulatoryEsignResult(recallId, actor, eSignature);
      await submitHeadQaRegulatoryApproval(recallId, { ...pendingApproval, e_signature: eSignature }, actor);
      toast.success('Regulatory approval completed with e-signature');
      setPendingApproval(null);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Approval failed');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <RecallRegulatoryAccessGuard>
        <LoadingSkeleton rows={8} />
      </RecallRegulatoryAccessGuard>
    );
  }

  if (error || !data) {
    return (
      <RecallRegulatoryAccessGuard>
        <ErrorCard title="Error" message={error || 'Recall not found'} onRetry={load} />
      </RecallRegulatoryAccessGuard>
    );
  }

  const { recall, notification, approvals, auditLogs, timeline } = data;

  return (
    <RecallRegulatoryAccessGuard>
      <CpvPageHeader
        title="Recall Regulatory Notification"
        description="Track regulatory communication and approval for product recalls"
        trail={[
          { label: 'QMS', href: '/dashboard' },
          { label: 'Product Recall', href: '/qms/recall' },
          { label: recall.recall_number, href: `/qms/recall/${recallId}` },
          { label: 'Regulatory Notification' },
        ]}
        actions={(
          <>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/qms/recall/${recallId}`}><ArrowLeft className="h-4 w-4 mr-1" />Recall Detail</Link>
            </Button>
            <Button variant="outline" size="sm" onClick={() => void load()} disabled={busy}>
              <RefreshCw className="h-4 w-4 mr-1" />Refresh
            </Button>
          </>
        )}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <RecallStatusBadge status={recall.recall_status} />
        <ClassificationBadge value={recall.recall_classification} />
        <RegulatoryNotificationStatusBadge status={notification.notification_status} />
        <RegulatoryApprovalStatusBadge status={notification.approval_status} />
        <span className="text-sm font-mono text-muted-foreground">{notification.regulatory_notification_id}</span>
      </div>

      {isRecallCritical(recall) && (
        <Alert className="mb-4 border-red-200 bg-red-50">
          <AlertTitle>Class I — Mandatory Regulatory Notification</AlertTitle>
          <AlertDescription>Regulatory authority and due date are required. Head QA approval is mandatory before closure.</AlertDescription>
        </Alert>
      )}

      {readOnly && (
        <Alert className="mb-4">
          <AlertTitle>Read-only</AlertTitle>
          <AlertDescription>This regulatory notification is closed and cannot be edited.</AlertDescription>
        </Alert>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex h-auto flex-wrap w-full justify-start">
          {[
            ['details', 'Notification Details'],
            ['submission', 'Authority Submission'],
            ['response', 'Authority Response'],
            ['followup', 'Follow Up'],
            ['approval', 'Approval'],
            ['timeline', 'Timeline'],
            ['audit', 'Audit Trail'],
          ].map(([value, label]) => (
            <TabsTrigger key={value} value={value}>{label}</TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="details" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Notification Details</CardTitle>
              <CardDescription>Regulatory authority, due dates and QA review comments</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mb-6">
              {[['Product', recall.product_name], ['Batch', recall.batch_number], ['Market', notification.market_region], ['Classification', recall.recall_classification]].map(([k, v]) => (
                <div key={String(k)}><span className="text-muted-foreground">{k}: </span><strong>{v}</strong></div>
              ))}
            </CardContent>
            <CardContent>
              <Form {...detailsForm}>
                <form onSubmit={detailsForm.handleSubmit(handleDetailsSave)} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField control={detailsForm.control} name="regulatory_authority" render={({ field }) => (
                    <FormItem><FormLabel>Regulatory Authority *</FormLabel><FormControl><Input {...field} disabled={!canEditDetails} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={detailsForm.control} name="notification_due_date" render={({ field }) => (
                    <FormItem><FormLabel>Notification Due Date *</FormLabel><FormControl><Input type="date" value={field.value || ''} onChange={field.onChange} disabled={!canEditDetails} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={detailsForm.control} name="market_region" render={({ field }) => (
                    <FormItem><FormLabel>Market / Region</FormLabel><FormControl><Input {...field} disabled={!canEditDetails} /></FormControl></FormItem>
                  )} />
                  <FormField control={detailsForm.control} name="notification_required" render={({ field }) => (
                    <FormItem className="flex items-center gap-2 pt-8">
                      <FormControl><Checkbox checked={field.value || isRecallCritical(recall)} onCheckedChange={field.onChange} disabled={!canEditDetails || isRecallCritical(recall)} /></FormControl>
                      <FormLabel className="!mt-0">Notification Required</FormLabel>
                    </FormItem>
                  )} />
                  <FormField control={detailsForm.control} name="qa_comments" render={({ field }) => (
                    <FormItem className="md:col-span-2"><FormLabel>QA Comments</FormLabel><FormControl><Textarea rows={3} {...field} disabled={!canEditDetails} /></FormControl></FormItem>
                  )} />
                  {canEditDetails && (
                    <div className="md:col-span-2">
                      <Button type="submit" disabled={busy}>{busy && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Save Details</Button>
                    </div>
                  )}
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="submission" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Authority Submission</CardTitle>
              <CardDescription>Record submission to regulatory authority</CardDescription>
            </CardHeader>
            <CardContent>
              {canEditSubmission ? (
                <Form {...submissionForm}>
                  <form onSubmit={submissionForm.handleSubmit(handleSubmission)} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField control={submissionForm.control} name="notification_date" render={({ field }) => (
                      <FormItem><FormLabel>Notification Date *</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={submissionForm.control} name="submission_reference_number" render={({ field }) => (
                      <FormItem><FormLabel>Submission Reference Number *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={submissionForm.control} name="submission_document" render={({ field }) => (
                      <FormItem className="md:col-span-2">
                        <FormLabel>Submission Document</FormLabel>
                        <div className="flex gap-2">
                          <FormControl><Input {...field} placeholder="Document URL or reference (placeholder)" /></FormControl>
                          <Button type="button" variant="outline" disabled className="gap-1 shrink-0"><Upload className="h-4 w-4" />Upload</Button>
                        </div>
                      </FormItem>
                    )} />
                    <FormField control={submissionForm.control} name="regulatory_comments" render={({ field }) => (
                      <FormItem className="md:col-span-2"><FormLabel>Regulatory Comments</FormLabel><FormControl><Textarea rows={3} {...field} /></FormControl></FormItem>
                    )} />
                    <div className="md:col-span-2">
                      <Button type="submit" disabled={busy}>{busy && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Record Submission</Button>
                    </div>
                  </form>
                </Form>
              ) : (
                <div className="text-sm space-y-2">
                  <p><span className="text-muted-foreground">Submitted by:</span> {notification.submitted_by_name || '—'}</p>
                  <p><span className="text-muted-foreground">Reference:</span> {notification.submission_reference_number || '—'}</p>
                  <p><span className="text-muted-foreground">Date:</span> {notification.notification_date || '—'}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="response" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Authority Response</CardTitle></CardHeader>
            <CardContent>
              {canEditSubmission ? (
                <Form {...responseForm}>
                  <form onSubmit={responseForm.handleSubmit(handleResponse)} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField control={responseForm.control} name="response_date" render={({ field }) => (
                      <FormItem><FormLabel>Response Date *</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={responseForm.control} name="authority_response" render={({ field }) => (
                      <FormItem className="md:col-span-2"><FormLabel>Authority Response *</FormLabel><FormControl><Textarea rows={4} {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <div className="md:col-span-2">
                      <Button type="submit" disabled={busy}>Save Response</Button>
                    </div>
                  </form>
                </Form>
              ) : (
                <p className="text-sm">{notification.authority_response || 'No response recorded'}</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="followup" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Follow Up Tracking</CardTitle></CardHeader>
            <CardContent>
              <Form {...followUpForm}>
                <form onSubmit={followUpForm.handleSubmit(handleFollowUp)} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField control={followUpForm.control} name="follow_up_required" render={({ field }) => (
                    <FormItem className="flex items-center gap-2 pt-2">
                      <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} disabled={readOnly || !canEditSubmission} /></FormControl>
                      <FormLabel className="!mt-0">Follow Up Required</FormLabel>
                    </FormItem>
                  )} />
                  <FormField control={followUpForm.control} name="follow_up_due_date" render={({ field }) => (
                    <FormItem><FormLabel>Follow Up Due Date</FormLabel><FormControl><Input type="date" value={field.value || ''} onChange={field.onChange} disabled={readOnly || !canEditSubmission} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={followUpForm.control} name="regulatory_comments" render={({ field }) => (
                    <FormItem className="md:col-span-2"><FormLabel>Regulatory Comments</FormLabel><FormControl><Textarea rows={3} {...field} disabled={readOnly || !canEditSubmission} /></FormControl></FormItem>
                  )} />
                  {canEditSubmission && !readOnly && (
                    <div><Button type="submit" disabled={busy}>Update Follow Up</Button></div>
                  )}
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="approval" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Approval Workflow</CardTitle>
              <CardDescription>
                {canHeadQaApprove ? 'Head QA final approval' : 'QA review and regulatory approval tracking'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-4 flex flex-wrap gap-4 text-sm">
                <span>E-Signature Required: {notification.e_signature_required ? 'Yes' : 'No'}</span>
                {notification.signed_by_name && <span>Signed by: {notification.signed_by_name} on {notification.signed_date}</span>}
              </div>
              {!readOnly && (canCreateReviewRecallRegulatory(actor.role) || canApproveRecallRegulatoryHeadQa(actor.role)) && (
                <Form {...approvalForm}>
                  <form onSubmit={approvalForm.handleSubmit(handleApprovalSubmit)} className="space-y-4 max-w-2xl">
                    <FormField control={approvalForm.control} name="qa_comments" render={({ field }) => (
                      <FormItem><FormLabel>QA Comments *</FormLabel><FormControl><Textarea rows={3} {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    {canHeadQaApprove && (
                      <FormField control={approvalForm.control} name="head_qa_comments" render={({ field }) => (
                        <FormItem><FormLabel>Head QA Comments</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl></FormItem>
                      )} />
                    )}
                    {canHeadQaApprove && (
                      <div className="flex gap-2">
                        <Button type="submit" disabled={busy} className="gap-1 bg-green-600 hover:bg-green-700">
                          <CheckCircle className="h-4 w-4" />Approve
                        </Button>
                        <Button type="button" variant="destructive" disabled={busy} className="gap-1" onClick={approvalForm.handleSubmit((d) => handleApprovalSubmit({ ...d, decision: 'rejected' }))}>
                          <XCircle className="h-4 w-4" />Reject
                        </Button>
                      </div>
                    )}
                    {!canHeadQaApprove && (
                      <Button type="submit" disabled={busy}>Submit QA Review</Button>
                    )}
                  </form>
                </Form>
              )}
            </CardContent>
          </Card>

          {approvals.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">Approval History</CardTitle></CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Decision</TableHead>
                      <TableHead>Comments</TableHead>
                      <TableHead>By</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {approvals.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell className="capitalize">{a.approval_type.replace(/_/g, ' ')}</TableCell>
                        <TableCell>{a.decision}</TableCell>
                        <TableCell className="max-w-xs truncate">{a.comments}</TableCell>
                        <TableCell>{a.approved_by_name}</TableCell>
                        <TableCell>{a.approved_at?.slice(0, 10)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="timeline" className="mt-4">
          <Card><CardContent className="pt-6"><RecallRegulatoryTimeline entries={timeline} /></CardContent></Card>
        </TabsContent>

        <TabsContent value="audit" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Audit Trail</CardTitle></CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Action</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auditLogs.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No audit entries</TableCell></TableRow>
                  ) : auditLogs.map((log, i) => (
                    <TableRow key={String(log.id || i)}>
                      <TableCell>{mapRegulatoryAuditAction(String(log.actionType || log.action || ''))}</TableCell>
                      <TableCell className="max-w-md truncate">{String(log.actionDescription || log.reason || '')}</TableCell>
                      <TableCell>{String(log.userName || (log.user as { name?: string } | undefined)?.name || '')}</TableCell>
                      <TableCell>{String(log.timestamp || log.dateTime || '')}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <ESignatureModal
        open={esignOpen}
        onOpenChange={setEsignOpen}
        moduleName={RECALL_REGULATORY_MODULE}
        recordId={recallId}
        documentNumber={notification.regulatory_notification_id}
        actionType="Head QA Regulatory Approval"
        signatureMeaning="I approve the regulatory notification and communication for this product recall"
        onSuccess={() => void handleEsignSuccess()}
      />
    </RecallRegulatoryAccessGuard>
  );
}
