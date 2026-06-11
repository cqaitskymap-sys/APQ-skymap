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
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { ComplaintStatusBadge, CriticalityBadge } from './complaint-sub-nav';
import { ComplaintPdfDocument } from './complaint-pdf-document';
import { investigationSchema, type InvestigationInput } from '@/lib/complaint-schemas';
import {
  getInvestigation, getAttachments, getAuditLogsForComplaint, submitComplaint,
  saveInvestigation, createCapaFromComplaint, closeComplaint, uploadAttachment,
} from '@/lib/complaint-service';
import type { ComplaintRecord, ComplaintInvestigation, ComplaintAttachment } from '@/lib/complaint-types';
import { canApproveComplaint, isComplaintReadOnly } from '@/lib/complaint-types';
import { printPage } from '@/lib/export-utils';
import { useComplaintActor } from '@/hooks/use-complaint';

export function ComplaintDetailView({ record, onRefresh, defaultTab = 'overview' }: {
  record: ComplaintRecord; onRefresh: () => void; defaultTab?: string;
}) {
  const actor = useComplaintActor();
  const readOnly = isComplaintReadOnly(actor.role);
  const [investigation, setInvestigation] = useState<ComplaintInvestigation | null>(null);
  const [attachments, setAttachments] = useState<ComplaintAttachment[]>([]);
  const [auditLogs, setAuditLogs] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadSub = async () => {
    setLoading(true);
    const [inv, att, al] = await Promise.all([getInvestigation(record.id), getAttachments(record.id), getAuditLogsForComplaint(record.id)]);
    setInvestigation(inv); setAttachments(att); setAuditLogs(al); setLoading(false);
  };
  useEffect(() => { void loadSub(); }, [record.id]);

  const invForm = useForm<InvestigationInput>({
    resolver: zodResolver(investigationSchema),
    defaultValues: investigation || { investigation_summary: '', findings: '', root_cause: record.root_cause || '', impact_assessment: record.impact_assessment || '', sample_analysis: '', batch_review: '', conclusion: '', capa_required: record.capa_required },
  });
  useEffect(() => { if (investigation) invForm.reset(investigation); }, [investigation]);

  if (loading) return <LoadingSpinner label="Loading complaint..." />;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h1 className="text-xl font-bold font-mono">{record.complaint_number}</h1>
            <ComplaintStatusBadge status={record.status} />
            <CriticalityBadge value={record.complaint_criticality} />
          </div>
          <p className="text-muted-foreground">{record.product_name} — {record.customer_name}</p>
        </div>
        <div className="no-print flex flex-wrap gap-2">
          {record.status === 'draft' && !readOnly && (
            <Button disabled={saving} className="bg-blue-600" onClick={async () => {
              try { setSaving(true); await submitComplaint(record.id, actor); toast.success('Complaint submitted'); onRefresh(); await loadSub(); }
              catch (e) { toast.error(e instanceof Error ? e.message : 'Failed'); } finally { setSaving(false); }
            }}>Submit Complaint</Button>
          )}
          {canApproveComplaint(actor.role) && !['closed', 'rejected', 'draft'].includes(record.status) && (
            <Button variant="outline" disabled={saving} onClick={async () => {
              try { setSaving(true); await closeComplaint(record.id, actor); toast.success('Complaint closed'); onRefresh(); }
              catch (e) { toast.error(e instanceof Error ? e.message : 'Failed'); } finally { setSaving(false); }
            }}>Close Complaint</Button>
          )}
          <Button variant="outline" onClick={() => printPage()} className="gap-1"><Printer className="h-4 w-4" />Print PDF</Button>
        </div>
      </div>

      <Tabs defaultValue={defaultTab}>
        <TabsList className="flex h-auto flex-wrap">
          {['overview', 'investigation', 'capa', 'attachments', 'audit'].map((t) => (
            <TabsTrigger key={t} value={t} className="capitalize">{t}</TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <Card><CardContent className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
            {[
              ['Date', record.complaint_date], ['Received From', record.received_from], ['Customer', record.customer_name],
              ['Contact', record.customer_contact || '—'], ['Market', record.market_region], ['Product', record.product_name],
              ['Batch', record.batch_number], ['MFG', record.mfg_date || '—'], ['EXP', record.exp_date || '—'],
              ['Category', record.complaint_category], ['Criticality', record.complaint_criticality],
            ].map(([k, v]) => (<div key={String(k)}><span className="text-muted-foreground">{k}: </span><strong>{v}</strong></div>))}
            <div className="md:col-span-3"><span className="text-muted-foreground">Description: </span>{record.complaint_description}</div>
            {record.linked_recall_number && <div><Link href={`/qms/recall/${record.linked_recall_id}`} className="text-blue-600 underline">Recall: {record.linked_recall_number}</Link></div>}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="investigation" className="mt-4">
          <Card><CardHeader><CardTitle className="text-base">Investigation</CardTitle></CardHeader><CardContent>
            {!readOnly ? (
              <Form {...invForm}><form onSubmit={invForm.handleSubmit(async (data) => {
                try { setSaving(true); await saveInvestigation(record.id, data, actor); toast.success('Investigation saved'); onRefresh(); await loadSub(); }
                catch (e) { toast.error(e instanceof Error ? e.message : 'Failed'); } finally { setSaving(false); }
              })} className="space-y-4">
                {(['investigation_summary', 'findings', 'root_cause', 'impact_assessment', 'sample_analysis', 'batch_review', 'conclusion'] as const).map((name) => (
                  <FormField key={name} control={invForm.control} name={name} render={({ field }) => (
                    <FormItem><FormLabel className="capitalize">{name.replace(/_/g, ' ')}</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                ))}
                <FormField control={invForm.control} name="capa_required" render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-3"><FormLabel>CAPA Required</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>
                )} />
                <Button type="submit" disabled={saving}>Save Investigation</Button>
              </form></Form>
            ) : investigation ? (
              <div className="text-sm space-y-2">{Object.entries(investigation).filter(([k]) => !['id', 'complaint_id', 'investigated_by', 'investigated_by_name', 'investigated_at', 'created_at', 'updated_at'].includes(k)).map(([k, v]) => (
                <p key={k}><strong className="capitalize">{k.replace(/_/g, ' ')}:</strong> {String(v)}</p>
              ))}</div>
            ) : <p className="text-muted-foreground text-sm">No investigation recorded.</p>}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="capa" className="mt-4">
          <Card><CardContent className="p-4 text-sm space-y-2">
            {record.linked_capa_id ? (
              <Link href={`/qms/capa/${record.linked_capa_id}`} className="text-blue-600 underline">View CAPA {record.linked_capa_number}</Link>
            ) : record.capa_required || investigation?.capa_required ? (
              !readOnly && <Button disabled={saving} onClick={async () => {
                try { setSaving(true); const capa = await createCapaFromComplaint(record.id, actor); toast.success(`CAPA ${capa.capa_number} created`); onRefresh(); await loadSub(); }
                catch (e) { toast.error(e instanceof Error ? e.message : 'Failed'); } finally { setSaving(false); }
              }}>Create CAPA</Button>
            ) : <p className="text-muted-foreground">No CAPA linkage required.</p>}
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

      <div id="complaint-pdf-document" className="sr-only">
        <ComplaintPdfDocument record={record} investigation={investigation} auditLogs={auditLogs} />
      </div>
    </div>
  );
}
