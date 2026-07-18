'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Printer, Upload, Download, ExternalLink } from 'lucide-react';
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
import { DmsStatusBadge, DmsTypeBadge } from './dms-sub-nav';
import {
  documentApprovalSchema, documentRevisionSchema, distributionSchema,
  type DocumentApprovalInput, type DocumentRevisionInput, type DistributionInput,
} from '@/lib/dms-schemas';
import {
  getAttachments, getRevisions, getApprovals, getDistribution, getTrainingLinks,
  getAuditLogsForDocument, submitForReview, processApproval, uploadAttachment,
  addDistribution, createRevision, trackDownload, trackPrint,
} from '@/lib/dms-service';
import type {
  DocumentRecord, DocumentAttachment, DocumentRevision, DocumentApproval,
  DocumentDistribution, DocumentTrainingLink,
} from '@/lib/dms-types';
import {
  canReviewDocument, canApproveDocument, isDmsReadOnly, isDocumentEditable,
} from '@/lib/dms-types';
import { printPage } from '@/lib/export-utils';
import { useDmsActor } from '@/hooks/use-dms';

interface DmsDetailViewProps {
  record: DocumentRecord;
  onRefresh: () => void;
  defaultTab?: string;
}

export function DmsDetailView({ record, onRefresh, defaultTab = 'overview' }: DmsDetailViewProps) {
  const actor = useDmsActor();
  const readOnly = isDmsReadOnly(actor.role);
  const [attachments, setAttachments] = useState<DocumentAttachment[]>([]);
  const [revisions, setRevisions] = useState<DocumentRevision[]>([]);
  const [approvals, setApprovals] = useState<DocumentApproval[]>([]);
  const [distribution, setDistribution] = useState<DocumentDistribution[]>([]);
  const [trainingLinks, setTrainingLinks] = useState<DocumentTrainingLink[]>([]);
  const [auditLogs, setAuditLogs] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const loadSub = useCallback(async () => {
    setLoading(true);
    const [att, rev, ap, dist, trn, al] = await Promise.all([
      getAttachments(record.id),
      getRevisions(record.id),
      getApprovals(record.id),
      getDistribution(record.id),
      getTrainingLinks(record.id),
      getAuditLogsForDocument(record.id),
    ]);
    setAttachments(att);
    setRevisions(rev);
    setApprovals(ap);
    setDistribution(dist);
    setTrainingLinks(trn);
    setAuditLogs(al);
    setLoading(false);
  }, [record.id]);

  useEffect(() => { void loadSub(); }, [loadSub]);

  const approvalForm = useForm<DocumentApprovalInput>({
    resolver: zodResolver(documentApprovalSchema),
    defaultValues: { stage: 'department_review', decision: 'approved', comments: '' },
  });

  const revisionForm = useForm<DocumentRevisionInput>({
    resolver: zodResolver(documentRevisionSchema),
    defaultValues: {
      version: '', reason_for_revision: '', effective_date: null, next_review_date: null,
      change_control_ref: record.change_control_ref, remarks: '',
    },
  });

  const distForm = useForm<DistributionInput>({
    resolver: zodResolver(distributionSchema),
    defaultValues: { department: record.department, user_name: actor.name },
  });

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await uploadAttachment(record.id, file, actor);
      toast.success('File uploaded');
      await loadSub();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleSubmitReview = async () => {
    setSaving(true);
    try {
      await submitForReview(record.id, actor);
      toast.success('Submitted for review');
      onRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Submit failed');
    } finally {
      setSaving(false);
    }
  };

  const handleApproval = async (data: DocumentApprovalInput) => {
    setSaving(true);
    try {
      await processApproval(record.id, data, actor);
      toast.success(`Document ${data.decision}`);
      onRefresh();
      await loadSub();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Approval failed');
    } finally {
      setSaving(false);
    }
  };

  const handleRevision = async (data: DocumentRevisionInput) => {
    setSaving(true);
    try {
      const newDoc = await createRevision(record.id, data, actor);
      toast.success('Revision created');
      window.location.href = `/qms/dms/${newDoc.id}`;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Revision failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDistribution = async (data: DistributionInput) => {
    setSaving(true);
    try {
      await addDistribution(record.id, data, actor);
      toast.success('Distribution recorded');
      distForm.reset();
      await loadSub();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Distribution failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDownload = async (att: DocumentAttachment) => {
    await trackDownload(record.id, att.file_name, actor);
    window.open(att.download_url, '_blank');
  };

  const handlePrint = async () => {
    await trackPrint(record.id, actor);
    printPage();
  };

  const pdfAttachment = attachments.find((a) =>
    a.file_type === 'application/pdf' || a.file_name.toLowerCase().endsWith('.pdf'),
  );

  if (loading && defaultTab !== 'overview') return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <p className="font-mono text-sm text-muted-foreground">{record.document_number}</p>
          <h1 className="text-xl sm:text-2xl font-bold">{record.document_title}</h1>
          <div className="flex flex-wrap gap-2 mt-2">
            <DmsStatusBadge status={record.status} />
            <DmsTypeBadge type={record.document_type} />
            <span className="text-xs text-muted-foreground">Rev {record.version} · {record.department}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handlePrint}><Printer className="h-4 w-4 mr-1" />Print</Button>
          {!readOnly && isDocumentEditable(record.status) && (
            <Button size="sm" className="bg-blue-600" onClick={handleSubmitReview} disabled={saving}>
              Submit for Review
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue={defaultTab}>
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="preview">File Preview</TabsTrigger>
          <TabsTrigger value="revisions">Revision History</TabsTrigger>
          <TabsTrigger value="approval">Approval Workflow</TabsTrigger>
          <TabsTrigger value="distribution">Distribution</TabsTrigger>
          <TabsTrigger value="training">Training Link</TabsTrigger>
          <TabsTrigger value="change-control">Change Control</TabsTrigger>
          <TabsTrigger value="audit">Audit Trail</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Document Details</CardTitle></CardHeader>
            <CardContent>
              <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                {([
                  ['Product', record.product_name || '—'],
                  ['Version', record.version],
                  ['Revision No', String(record.revision_number)],
                  ['Effective Date', record.effective_date || '—'],
                  ['Next Review', record.next_review_date || '—'],
                  ['Prepared By', record.prepared_by_name],
                  ['Reviewed By', record.reviewed_by_name || '—'],
                  ['Approved By', record.approved_by_name || '—'],
                  ['Supersedes', record.supersedes_document_no || '—'],
                  ['Change Control', record.change_control_ref || '—'],
                ] as const).map(([label, value]) => (
                  <div key={label}><dt className="text-muted-foreground">{label}</dt><dd className="font-medium">{value}</dd></div>
                ))}
              </dl>
              {record.reason_for_revision && (
                <div className="mt-4 pt-4 border-t">
                  <p className="text-sm text-muted-foreground">Reason for Revision</p>
                  <p className="text-sm mt-1">{record.reason_for_revision}</p>
                </div>
              )}
              {record.remarks && (
                <div className="mt-4 pt-4 border-t">
                  <p className="text-sm text-muted-foreground">Remarks</p>
                  <p className="text-sm mt-1">{record.remarks}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preview" className="mt-4 space-y-4">
          {!readOnly && isDocumentEditable(record.status) && (
            <div className="flex items-center gap-2">
              <label className="cursor-pointer">
                <input type="file" className="hidden" accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg" onChange={handleUpload} disabled={uploading} />
                <Button variant="outline" size="sm" asChild><span><Upload className="h-4 w-4 mr-1" />{uploading ? 'Uploading…' : 'Upload File'}</span></Button>
              </label>
            </div>
          )}
          {pdfAttachment ? (
            <Card>
              <CardContent className="p-0">
                <iframe src={pdfAttachment.download_url} className="w-full h-[600px] rounded-lg border-0" title="PDF Preview" />
              </CardContent>
            </Card>
          ) : attachments.length > 0 ? (
            <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground mb-3">Preview not available for this file type. Download to view.</p></CardContent></Card>
          ) : (
            <Card><CardContent className="p-8 text-center text-muted-foreground">No attachments uploaded</CardContent></Card>
          )}
          {attachments.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-sm">Attachments</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {attachments.map((att) => (
                  <div key={att.id} className="flex items-center justify-between rounded border p-3">
                    <div>
                      <p className="text-sm font-medium">{att.file_name}</p>
                      <p className="text-xs text-muted-foreground">{(att.file_size / 1024).toFixed(1)} KB · {att.uploaded_by_name}</p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => handleDownload(att)}>
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="revisions" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Revision History</CardTitle>
              {!readOnly && ['effective', 'approved', 'obsolete'].includes(record.status) && (
                <Button size="sm" variant="outline" onClick={() => document.getElementById('revision-form')?.scrollIntoView()}>New Revision</Button>
              )}
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Version</TableHead><TableHead>Rev #</TableHead><TableHead>Reason</TableHead>
                  <TableHead>Effective</TableHead><TableHead>Status</TableHead><TableHead>By</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell>{record.version}</TableCell>
                    <TableCell>{record.revision_number}</TableCell>
                    <TableCell>{record.reason_for_revision || '—'}</TableCell>
                    <TableCell>{record.effective_date || '—'}</TableCell>
                    <TableCell><DmsStatusBadge status={record.status} /></TableCell>
                    <TableCell>{record.created_by_name}</TableCell>
                  </TableRow>
                  {revisions.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{r.version}</TableCell>
                      <TableCell>{r.revision_number}</TableCell>
                      <TableCell>{r.reason_for_revision}</TableCell>
                      <TableCell>{r.effective_date || '—'}</TableCell>
                      <TableCell><DmsStatusBadge status={r.status} /></TableCell>
                      <TableCell>{r.created_by_name}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {!readOnly && ['effective', 'approved', 'obsolete'].includes(record.status) && (
                <div id="revision-form" className="mt-6 pt-6 border-t">
                  <p className="font-medium mb-4">Create New Revision</p>
                  <Form {...revisionForm}>
                    <form onSubmit={revisionForm.handleSubmit(handleRevision)} className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField control={revisionForm.control} name="version" render={({ field }) => (
                          <FormItem><FormLabel>New Version *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={revisionForm.control} name="effective_date" render={({ field }) => (
                          <FormItem><FormLabel>Effective Date</FormLabel>
                            <FormControl><Input type="date" value={field.value || ''} onChange={(e) => field.onChange(e.target.value || null)} /></FormControl>
                          </FormItem>
                        )} />
                      </div>
                      <FormField control={revisionForm.control} name="reason_for_revision" render={({ field }) => (
                        <FormItem><FormLabel>Reason for Revision *</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <Button type="submit" disabled={saving} className="bg-blue-600">Create Revision</Button>
                    </form>
                  </Form>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="approval" className="mt-4 space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Approval Workflow</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                {approvals.length === 0 ? <p className="text-sm text-muted-foreground">No approval records yet</p>
                  : approvals.map((a) => (
                    <div key={a.id} className="flex items-start gap-3 rounded-lg border p-3">
                      <div className="flex-1">
                        <p className="text-sm font-medium capitalize">{a.stage.replace(/_/g, ' ')}</p>
                        <p className="text-xs text-muted-foreground">{a.reviewer_name || 'Pending'} · {a.decision}</p>
                        {a.comments && <p className="text-sm mt-1">{a.comments}</p>}
                      </div>
                      <span className="text-xs text-muted-foreground">{a.signed_at ? new Date(a.signed_at).toLocaleDateString() : 'Pending'}</span>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
          {!readOnly && record.status === 'under_review' && (canReviewDocument(actor.role) || canApproveDocument(actor.role)) && (
            <Card>
              <CardHeader><CardTitle className="text-base">Process Approval</CardTitle></CardHeader>
              <CardContent>
                <Form {...approvalForm}>
                  <form onSubmit={approvalForm.handleSubmit(handleApproval)} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField control={approvalForm.control} name="stage" render={({ field }) => (
                        <FormItem><FormLabel>Stage</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                            <SelectContent>
                              <SelectItem value="department_review">Department Review</SelectItem>
                              <SelectItem value="qa_review">QA Review</SelectItem>
                              <SelectItem value="head_qa_approval">Head QA Approval</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )} />
                      <FormField control={approvalForm.control} name="decision" render={({ field }) => (
                        <FormItem><FormLabel>Decision</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                            <SelectContent>
                              <SelectItem value="approved">Approved</SelectItem>
                              <SelectItem value="returned">Returned for Correction</SelectItem>
                              <SelectItem value="rejected">Rejected</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )} />
                    </div>
                    <FormField control={approvalForm.control} name="comments" render={({ field }) => (
                      <FormItem><FormLabel>Comments</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl></FormItem>
                    )} />
                    <Button type="submit" disabled={saving} className="bg-blue-600">Submit Decision</Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="distribution" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Distribution List</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Department</TableHead><TableHead>User</TableHead><TableHead>Distributed</TableHead><TableHead>Acknowledged</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {distribution.length === 0 ? <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No distribution records</TableCell></TableRow>
                    : distribution.map((d) => (
                      <TableRow key={d.id}>
                        <TableCell>{d.department}</TableCell>
                        <TableCell>{d.user_name}</TableCell>
                        <TableCell>{new Date(d.distributed_at).toLocaleDateString()}</TableCell>
                        <TableCell>{d.acknowledged ? 'Yes' : 'No'}</TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
              {!readOnly && record.status === 'effective' && (
                <Form {...distForm}>
                  <form onSubmit={distForm.handleSubmit(handleDistribution)} className="mt-4 pt-4 border-t space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField control={distForm.control} name="department" render={({ field }) => (
                        <FormItem><FormLabel>Department</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                      )} />
                      <FormField control={distForm.control} name="user_name" render={({ field }) => (
                        <FormItem><FormLabel>User Name</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                      )} />
                    </div>
                    <Button type="submit" disabled={saving} size="sm">Add Distribution</Button>
                  </form>
                </Form>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="training" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Training Requirements</CardTitle></CardHeader>
            <CardContent>
              {trainingLinks.length === 0 ? <p className="text-sm text-muted-foreground">No training requirements linked</p>
                : trainingLinks.map((t) => (
                  <div key={t.id} className="rounded-lg border p-3 mb-2">
                    <p className="font-medium text-sm">{t.training_title}</p>
                    <p className="text-xs text-muted-foreground">Dept: {t.target_department} · Due: {t.due_date || '—'} · Status: {t.status}</p>
                  </div>
                ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="change-control" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Change Control Link</CardTitle></CardHeader>
            <CardContent>
              {record.change_control_id ? (
                <div className="flex items-center gap-2">
                  <p className="text-sm">{record.change_control_ref}</p>
                  <Link href={`/qms/change-control/${record.change_control_id}`}>
                    <Button variant="outline" size="sm"><ExternalLink className="h-4 w-4 mr-1" />View Change Control</Button>
                  </Link>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No change control linked</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Audit Trail</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Date</TableHead><TableHead>Action</TableHead><TableHead>User</TableHead><TableHead>Details</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {auditLogs.length === 0 ? <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No audit records</TableCell></TableRow>
                    : auditLogs.map((log) => (
                      <TableRow key={log.id as string}>
                        <TableCell className="text-xs">{log.dateTime ? new Date(log.dateTime as string).toLocaleString() : '—'}</TableCell>
                        <TableCell className="text-xs font-medium">{log.action as string}</TableCell>
                        <TableCell className="text-xs">{log.userName as string}</TableCell>
                        <TableCell className="text-xs max-w-[200px] truncate">{log.reason as string || log.newValue as string || '—'}</TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
