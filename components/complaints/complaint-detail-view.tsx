'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Printer, Upload, Search, Scale, Link2, CheckSquare, Lock, ScrollText } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { ComplaintStatusBadge, CriticalityBadge, RiskBadge } from './complaint-sub-nav';
import { ComplaintInvestigationStatusBadge } from './investigation/investigation-status-badge';
import { ComplaintImpactStatusBadge } from './impact-assessment/complaint-impact-status-badge';
import { ComplaintPdfDocument } from './complaint-pdf-document';
import {
  getInvestigation, getAttachments, getAuditLogsForComplaint, submitComplaint,
  uploadAttachment,
} from '@/lib/complaint-service';
import type { ComplaintRecord, ComplaintInvestigation, ComplaintAttachment, ComplaintImpactAssessment, ComplaintCapaLink } from '@/lib/complaint-types';
import { isComplaintReadOnly } from '@/lib/complaint-types';
import { printPage } from '@/lib/export-utils';
import { useComplaintActor } from '@/hooks/use-complaint';

export function ComplaintDetailView({ record, onRefresh, defaultTab = 'overview' }: {
  record: ComplaintRecord; onRefresh: () => void; defaultTab?: string;
}) {
  const actor = useComplaintActor();
  const readOnly = isComplaintReadOnly(actor.role);
  const [investigation, setInvestigation] = useState<ComplaintInvestigation | null>(null);
  const [impact, setImpact] = useState<ComplaintImpactAssessment | null>(null);
  const [capaLink, setCapaLink] = useState<ComplaintCapaLink | null>(null);
  const [attachments, setAttachments] = useState<ComplaintAttachment[]>([]);
  const [auditLogs, setAuditLogs] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadSub = async () => {
    setLoading(true);
    const { getComplaintImpactAssessment } = await import('@/lib/complaint-impact-service');
    const { getActiveComplaintCapaLink } = await import('@/lib/complaint-capa-service');
    const [inv, imp, cl, att, al] = await Promise.all([
      getInvestigation(record.id),
      getComplaintImpactAssessment(record.id),
      getActiveComplaintCapaLink(record.id),
      getAttachments(record.id),
      getAuditLogsForComplaint(record.id),
    ]);
    setInvestigation(inv);
    setImpact(imp);
    setCapaLink(cl);
    setAttachments(att);
    setAuditLogs(al);
    setLoading(false);
  };
  useEffect(() => { void loadSub(); }, [record.id]);

  if (loading) return <LoadingSpinner label="Loading complaint..." />;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h1 className="text-xl font-bold font-mono">{record.complaint_number}</h1>
            <ComplaintStatusBadge status={record.status} />
            <CriticalityBadge value={record.complaint_criticality} />
            {investigation?.investigation_status && <ComplaintInvestigationStatusBadge status={investigation.investigation_status} />}
            {impact?.status && <ComplaintImpactStatusBadge status={impact.status} />}
            {record.risk_level && <RiskBadge level={record.risk_level} />}
          </div>
          <p className="text-muted-foreground">{record.product_name} — {record.customer_name}</p>
        </div>
        <div className="no-print flex flex-wrap gap-2">
          <Link href={`/qms/complaints/${record.id}/investigation`}>
            <Button variant="outline" className="gap-1"><Search className="h-4 w-4" />Investigation</Button>
          </Link>
          <Link href={`/qms/complaints/${record.id}/impact-assessment`}>
            <Button variant="outline" className="gap-1"><Scale className="h-4 w-4" />Impact Assessment</Button>
          </Link>
          <Link href={`/qms/complaints/${record.id}/capa`}>
            <Button variant="outline" className="gap-1"><Link2 className="h-4 w-4" />CAPA Link</Button>
          </Link>
          <Link href={`/qms/complaints/${record.id}/approval`}>
            <Button variant="outline" className="gap-1"><CheckSquare className="h-4 w-4" />Approval</Button>
          </Link>
          <Link href={`/qms/complaints/${record.id}/closure`}>
            <Button variant="outline" className="gap-1"><Lock className="h-4 w-4" />Closure</Button>
          </Link>
          <Link href={`/qms/complaints/${record.id}/audit-trail`}>
            <Button variant="outline" className="gap-1"><ScrollText className="h-4 w-4" />Audit Trail</Button>
          </Link>
          {record.status === 'draft' && !readOnly && (
            <Button disabled={saving} className="bg-blue-600" onClick={async () => {
              try { setSaving(true); await submitComplaint(record.id, actor); toast.success('Complaint submitted'); onRefresh(); await loadSub(); }
              catch (e) { toast.error(e instanceof Error ? e.message : 'Failed'); } finally { setSaving(false); }
            }}>Submit Complaint</Button>
          )}
          <Button variant="outline" onClick={() => printPage()} className="gap-1"><Printer className="h-4 w-4" />Print PDF</Button>
        </div>
      </div>

      <Tabs defaultValue={defaultTab}>
        <TabsList className="flex h-auto flex-wrap">
          {['overview', 'investigation', 'impact', 'capa', 'attachments', 'audit'].map((t) => (
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
            <div className="md:col-span-3"><span className="text-muted-foreground">Impact Assessment: </span>{record.impact_assessment || '—'}</div>
            {record.linked_recall_number && <div><Link href={`/qms/recall/${record.linked_recall_id}`} className="text-blue-600 underline">Recall: {record.linked_recall_number}</Link></div>}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="investigation" className="mt-4">
          <Card><CardHeader className="flex flex-row items-center justify-between"><CardTitle className="text-base">Investigation</CardTitle>
            <Link href={`/qms/complaints/${record.id}/investigation`}>
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700">Open Full Investigation</Button>
            </Link>
          </CardHeader><CardContent className="text-sm space-y-2">
            {investigation ? (
              <>
                <p><strong>Status:</strong> {investigation.investigation_status || 'In Progress'}</p>
                <p><strong>Summary:</strong> {investigation.investigation_summary || '—'}</p>
                <p><strong>Root Cause:</strong> {investigation.root_cause || '—'}</p>
                <p><strong>Conclusion:</strong> {investigation.conclusion || '—'}</p>
              </>
            ) : (
              <p className="text-muted-foreground">No investigation started. Use the full investigation module to begin GMP investigation workflow.</p>
            )}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="impact" className="mt-4">
          <Card><CardHeader className="flex flex-row items-center justify-between"><CardTitle className="text-base">Impact Assessment</CardTitle>
            <Link href={`/qms/complaints/${record.id}/impact-assessment`}>
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700">Open Full Assessment</Button>
            </Link>
          </CardHeader><CardContent className="text-sm space-y-2">
            {impact ? (
              <>
                <p><strong>Status:</strong> {impact.status}</p>
                <p><strong>Risk Level:</strong> {impact.risk_level} (Score: {impact.risk_score})</p>
                <p><strong>Product Quality:</strong> {impact.product_quality_impact}</p>
                <p><strong>Patient Safety:</strong> {impact.patient_safety_impact}</p>
                <p><strong>Conclusion:</strong> {impact.conclusion || '—'}</p>
              </>
            ) : (
              <p className="text-muted-foreground">No impact assessment recorded. Use the impact assessment module to evaluate product, patient, regulatory, and market impact.</p>
            )}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="capa" className="mt-4">
          <Card><CardHeader className="flex flex-row items-center justify-between"><CardTitle className="text-base">CAPA Link</CardTitle>
            <Link href={`/qms/complaints/${record.id}/capa`}>
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700">Open CAPA Link Module</Button>
            </Link>
          </CardHeader><CardContent className="text-sm space-y-2">
            {record.linked_capa_id ? (
              <>
                <p><strong>CAPA Number:</strong> {record.linked_capa_number}</p>
                <p><strong>Status:</strong> {capaLink?.capa_status || 'Linked'}</p>
                <Link href={`/qms/capa/${record.linked_capa_id}`} className="text-blue-600 underline">View CAPA Record</Link>
              </>
            ) : record.capa_required || investigation?.capa_required ? (
              <p className="text-muted-foreground">CAPA required — use the CAPA Link module to create or link a CAPA.</p>
            ) : (
              <p className="text-muted-foreground">No CAPA linkage required.</p>
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
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Audit Trail</CardTitle>
              <Link href={`/qms/complaints/${record.id}/audit-trail`}>
                <Button size="sm" className="bg-blue-600 hover:bg-blue-700 gap-1"><ScrollText className="h-4 w-4" />Full Audit Trail</Button>
              </Link>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Action</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auditLogs.length === 0 ? (
                    <TableRow><TableCell colSpan={3} className="text-center py-6 text-muted-foreground">No audit entries</TableCell></TableRow>
                  ) : auditLogs.slice(0, 10).map((log, i) => (
                    <TableRow key={String(log.id || i)}>
                      <TableCell>{String(log.actionType || log.action || '')}</TableCell>
                      <TableCell>{String(log.userName || '')}</TableCell>
                      <TableCell>{String(log.dateTime || '')}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div id="complaint-pdf-document" className="sr-only">
        <ComplaintPdfDocument record={record} investigation={investigation} auditLogs={auditLogs} />
      </div>
    </div>
  );
}
