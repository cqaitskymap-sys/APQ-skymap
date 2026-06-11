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
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { RecallStatusBadge, ClassificationBadge } from './recall-sub-nav';
import { RecallPdfDocument } from './recall-pdf-document';
import { distributionSchema, recoverySchema, recallApprovalSchema, type DistributionInput, type RecoveryInput, type RecallApprovalInput } from '@/lib/recall-schemas';
import {
  getDistributions, getRecoveries, getAttachments, getAuditLogsForRecall,
  initiateRecall, addDistribution, addRecovery, submitRecallApproval, closeRecall, uploadAttachment,
} from '@/lib/recall-service';
import type { RecallRecord, RecallDistribution, RecallRecovery, RecallAttachment } from '@/lib/recall-types';
import { canApproveRecall, isRecallReadOnly, requiresClassIApproval } from '@/lib/recall-types';
import { printPage } from '@/lib/export-utils';
import { useRecallActor } from '@/hooks/use-recall';

export function RecallDetailView({ record, onRefresh }: { record: RecallRecord; onRefresh: () => void }) {
  const actor = useRecallActor();
  const readOnly = isRecallReadOnly(actor.role);
  const [distributions, setDistributions] = useState<RecallDistribution[]>([]);
  const [recoveries, setRecoveries] = useState<RecallRecovery[]>([]);
  const [attachments, setAttachments] = useState<RecallAttachment[]>([]);
  const [auditLogs, setAuditLogs] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadSub = async () => {
    setLoading(true);
    const [d, r, a, al] = await Promise.all([getDistributions(record.id), getRecoveries(record.id), getAttachments(record.id), getAuditLogsForRecall(record.id)]);
    setDistributions(d); setRecoveries(r); setAttachments(a); setAuditLogs(al); setLoading(false);
  };
  useEffect(() => { void loadSub(); }, [record.id]);

  const distForm = useForm<DistributionInput>({ resolver: zodResolver(distributionSchema), defaultValues: { customer_name: '', market_region: record.market_region, quantity_distributed: 0, distribution_date: new Date().toISOString().split('T')[0], contact_details: '' } });
  const recForm = useForm<RecoveryInput>({ resolver: zodResolver(recoverySchema), defaultValues: { recovery_date: new Date().toISOString().split('T')[0], quantity_recovered: 0, recovered_from: '', recovery_status: 'Recovered', remarks: '' } });
  const approvalForm = useForm<RecallApprovalInput>({ resolver: zodResolver(recallApprovalSchema), defaultValues: { approval_type: 'head_qa', decision: 'approved', comments: '', e_signature: actor.name } });

  if (loading) return <LoadingSpinner label="Loading recall..." />;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h1 className="text-xl font-bold font-mono">{record.recall_number}</h1>
            <RecallStatusBadge status={record.recall_status} />
            <ClassificationBadge value={record.recall_classification} />
          </div>
          <p className="text-muted-foreground">{record.product_name} — Batch {record.batch_number}</p>
          <p className="text-lg font-bold text-green-700 mt-1">Recovery: {record.recovery_percent}%</p>
        </div>
        <div className="no-print flex flex-wrap gap-2">
          {record.recall_status === 'draft' && !readOnly && (
            <Button disabled={saving} className="bg-blue-600" onClick={async () => {
              try { setSaving(true); await initiateRecall(record.id, actor); toast.success('Recall initiated'); onRefresh(); await loadSub(); }
              catch (e) { toast.error(e instanceof Error ? e.message : 'Failed'); } finally { setSaving(false); }
            }}>Initiate Recall</Button>
          )}
          {canApproveRecall(actor.role) && !['closed', 'draft'].includes(record.recall_status) && (
            <Button variant="outline" disabled={saving} onClick={async () => {
              try { setSaving(true); await closeRecall(record.id, actor); toast.success('Recall closed'); onRefresh(); }
              catch (e) { toast.error(e instanceof Error ? e.message : 'Failed'); } finally { setSaving(false); }
            }}>Close Recall</Button>
          )}
          <Button variant="outline" onClick={() => printPage()} className="gap-1"><Printer className="h-4 w-4" />Print PDF</Button>
        </div>
      </div>

      {requiresClassIApproval(record.recall_classification) && (
        <p className="text-sm text-red-600">Class I recall — Head QA and Regulatory approval required before closure.</p>
      )}

      <Tabs defaultValue="overview">
        <TabsList className="flex h-auto flex-wrap">
          {['overview', 'distribution', 'recovery', 'approval', 'attachments', 'audit'].map((t) => (
            <TabsTrigger key={t} value={t} className="capitalize">{t}</TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <Card><CardContent className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
            {[
              ['Date', record.recall_date], ['Type', record.recall_type], ['Classification', record.recall_classification],
              ['Product', record.product_name], ['Batch', record.batch_number], ['Market', record.market_region],
              ['Stock Qty', record.stock_quantity], ['Distributed', record.distributed_quantity], ['Recovered', record.recovered_quantity],
              ['Recovery %', `${record.recovery_percent}%`], ['Regulatory Notified', record.regulatory_notified ? 'Yes' : 'No'],
            ].map(([k, v]) => (<div key={String(k)}><span className="text-muted-foreground">{k}: </span><strong>{v}</strong></div>))}
            <div className="md:col-span-3"><span className="text-muted-foreground">Reason: </span>{record.reason_for_recall}</div>
            {record.linked_complaint_number && <div><Link href={`/qms/complaints/${record.linked_complaint_id}`} className="text-blue-600 underline">Complaint: {record.linked_complaint_number}</Link></div>}
            {record.linked_capa_number && <div><Link href={`/qms/capa/${record.linked_capa_id}`} className="text-blue-600 underline">CAPA: {record.linked_capa_number}</Link></div>}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="distribution" className="mt-4 space-y-4">
          {!readOnly && (
            <Card><CardHeader><CardTitle className="text-base">Add Distribution Record</CardTitle></CardHeader><CardContent>
              <Form {...distForm}><form onSubmit={distForm.handleSubmit(async (data) => {
                try { setSaving(true); await addDistribution(record.id, data, actor); toast.success('Distribution added'); distForm.reset({ customer_name: '', market_region: record.market_region, quantity_distributed: 0, distribution_date: new Date().toISOString().split('T')[0], contact_details: '' }); onRefresh(); await loadSub(); }
                catch (e) { toast.error(e instanceof Error ? e.message : 'Failed'); } finally { setSaving(false); }
              })} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={distForm.control} name="customer_name" render={({ field }) => (<FormItem><FormLabel>Customer *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={distForm.control} name="quantity_distributed" render={({ field }) => (<FormItem><FormLabel>Quantity *</FormLabel><FormControl><Input type="number" min={1} {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={distForm.control} name="distribution_date" render={({ field }) => (<FormItem><FormLabel>Date *</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <div className="md:col-span-2"><Button type="submit" disabled={saving}>Add Distribution</Button></div>
              </form></Form>
            </CardContent></Card>
          )}
          <Card><CardContent className="p-0 overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Customer</TableHead><TableHead>Market</TableHead><TableHead>Qty</TableHead><TableHead>Date</TableHead></TableRow></TableHeader><TableBody>
            {distributions.length === 0 ? <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground">No distribution records</TableCell></TableRow>
              : distributions.map((d) => <TableRow key={d.id}><TableCell>{d.customer_name}</TableCell><TableCell>{d.market_region}</TableCell><TableCell>{d.quantity_distributed}</TableCell><TableCell>{d.distribution_date}</TableCell></TableRow>)}
          </TableBody></Table></CardContent></Card>
        </TabsContent>

        <TabsContent value="recovery" className="mt-4 space-y-4">
          {!readOnly && (
            <Card><CardHeader><CardTitle className="text-base">Record Recovery</CardTitle></CardHeader><CardContent>
              <Form {...recForm}><form onSubmit={recForm.handleSubmit(async (data) => {
                try { setSaving(true); await addRecovery(record.id, data, actor); toast.success('Recovery recorded'); recForm.reset({ recovery_date: new Date().toISOString().split('T')[0], quantity_recovered: 0, recovered_from: '', recovery_status: 'Recovered', remarks: '' }); onRefresh(); await loadSub(); }
                catch (e) { toast.error(e instanceof Error ? e.message : 'Failed'); } finally { setSaving(false); }
              })} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={recForm.control} name="recovered_from" render={({ field }) => (<FormItem><FormLabel>Recovered From *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={recForm.control} name="quantity_recovered" render={({ field }) => (<FormItem><FormLabel>Quantity *</FormLabel><FormControl><Input type="number" min={0} {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={recForm.control} name="recovery_date" render={({ field }) => (<FormItem><FormLabel>Date *</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <div className="md:col-span-2"><Button type="submit" disabled={saving}>Record Recovery</Button></div>
              </form></Form>
            </CardContent></Card>
          )}
          <Card><CardContent className="p-0 overflow-x-auto"><Table><TableHeader><TableRow><TableHead>From</TableHead><TableHead>Qty</TableHead><TableHead>Date</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody>
            {recoveries.length === 0 ? <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground">No recovery records</TableCell></TableRow>
              : recoveries.map((r) => <TableRow key={r.id}><TableCell>{r.recovered_from}</TableCell><TableCell>{r.quantity_recovered}</TableCell><TableCell>{r.recovery_date}</TableCell><TableCell>{r.recovery_status}</TableCell></TableRow>)}
          </TableBody></Table></CardContent></Card>
        </TabsContent>

        <TabsContent value="approval" className="mt-4">
          <Card><CardContent className="p-4 space-y-4">
            <div className="flex gap-4 text-sm">
              <span>Head QA: {record.head_qa_approved ? '✓ Approved' : 'Pending'}</span>
              <span>Regulatory: {record.regulatory_approved ? '✓ Approved' : 'Pending'}</span>
            </div>
            {canApproveRecall(actor.role) && !readOnly && (
              <Form {...approvalForm}><form className="space-y-4">
                <FormField control={approvalForm.control} name="approval_type" render={({ field }) => (
                  <FormItem><FormLabel>Approval Type</FormLabel>
                    <select value={field.value} onChange={(e) => field.onChange(e.target.value)} className="flex h-10 w-full rounded-md border px-3 py-2 text-sm">
                      <option value="head_qa">Head QA</option><option value="regulatory">Regulatory Affairs</option><option value="final">Final Closure</option>
                    </select></FormItem>
                )} />
                <FormField control={approvalForm.control} name="comments" render={({ field }) => (<FormItem><FormLabel>Comments *</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={approvalForm.control} name="e_signature" render={({ field }) => (<FormItem><FormLabel>E-Signature *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                <Button type="button" disabled={saving} onClick={approvalForm.handleSubmit(async (data) => {
                  try { setSaving(true); await submitRecallApproval(record.id, data, actor); toast.success('Approval submitted'); onRefresh(); await loadSub(); }
                  catch (e) { toast.error(e instanceof Error ? e.message : 'Failed'); } finally { setSaving(false); }
                })}>Submit Approval</Button>
              </form></Form>
            )}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="attachments" className="mt-4">
          <Card><CardHeader className="flex flex-row items-center justify-between"><CardTitle className="text-base">Attachments</CardTitle>
            {!readOnly && <label className="cursor-pointer"><Button variant="outline" size="sm" className="gap-1" asChild><span><Upload className="h-4 w-4" />Upload</span></Button><input type="file" className="hidden" onChange={async (e) => {
              const file = e.target.files?.[0]; if (!file) return;
              try { await uploadAttachment(record.id, file, actor); toast.success('Uploaded'); await loadSub(); } catch { toast.error('Upload failed'); }
            }} /></label>}
          </CardHeader><CardContent>
            {attachments.length === 0 ? <p className="text-sm text-muted-foreground">No attachments</p> : (
              <ul className="space-y-2 text-sm">{attachments.map((a) => <li key={a.id}><a href={a.file_url} target="_blank" rel="noreferrer" className="text-blue-600 underline">{a.file_name}</a></li>)}</ul>
            )}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="audit" className="mt-4">
          <Card><CardContent className="p-0 overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Action</TableHead><TableHead>User</TableHead><TableHead>Date</TableHead></TableRow></TableHeader><TableBody>
            {auditLogs.length === 0 ? <TableRow><TableCell colSpan={3} className="text-center py-6 text-muted-foreground">No audit entries</TableCell></TableRow>
              : auditLogs.map((log, i) => <TableRow key={i}><TableCell>{String(log.action || '')}</TableCell><TableCell>{String(log.userName || '')}</TableCell><TableCell>{String(log.dateTime || '')}</TableCell></TableRow>)}
          </TableBody></Table></CardContent></Card>
        </TabsContent>
      </Tabs>

      <div id="recall-pdf-document" className="sr-only">
        <RecallPdfDocument record={record} distributions={distributions} recoveries={recoveries} auditLogs={auditLogs} />
      </div>
    </div>
  );
}
