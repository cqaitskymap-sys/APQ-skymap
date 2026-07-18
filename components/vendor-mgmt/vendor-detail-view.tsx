'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Printer, Upload, Download, ShieldBan, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { ApprovalBadge, RiskBadge, PerformanceBadge } from './vendor-sub-nav';
import { VendorPdfDocument } from './vendor-pdf-document';
import {
  listAvl, listQualifications, listSupplierAudits, listAgreements, listPerformance,
  getVendorAttachments, getAuditLogsForVendor, uploadVendorAttachment,
  blockVendor, approveVendor, updateVendor,
} from '@/lib/vendor-mgmt-service';
import type {
  VendorRecord, AvlRecord, VendorQualification, SupplierAuditRecord,
  TechnicalAgreement, VendorPerformance, VendorAttachment,
} from '@/lib/vendor-mgmt-types';
import { canApproveVendor, canManageVendors, isVendorReadOnly } from '@/lib/vendor-mgmt-types';
import { printPage } from '@/lib/export-utils';
import { useVendorActor } from '@/hooks/use-vendor-mgmt';
import { VendorForm } from './vendor-form';
import type { VendorCreateInput } from '@/lib/vendor-mgmt-schemas';

const ATTACHMENT_CATEGORIES = [
  'Vendor Questionnaire', 'Licenses', 'GMP Certificate', 'ISO Certificate', 'COA Template',
  'Audit Report', 'Technical Agreement', 'Quality Agreement', 'Sample Evaluation Report', 'Regulatory Documents',
];

interface VendorDetailViewProps {
  record: VendorRecord;
  onRefresh: () => void;
  defaultTab?: string;
}

export function VendorDetailView({ record, onRefresh, defaultTab = 'overview' }: VendorDetailViewProps) {
  const actor = useVendorActor();
  const readOnly = isVendorReadOnly(actor.role);
  const [avl, setAvl] = useState<AvlRecord[]>([]);
  const [qualifications, setQualifications] = useState<VendorQualification[]>([]);
  const [audits, setAudits] = useState<SupplierAuditRecord[]>([]);
  const [agreements, setAgreements] = useState<TechnicalAgreement[]>([]);
  const [performance, setPerformance] = useState<VendorPerformance[]>([]);
  const [attachments, setAttachments] = useState<VendorAttachment[]>([]);
  const [auditLogs, setAuditLogs] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showPrint, setShowPrint] = useState(false);
  const [attachCategory, setAttachCategory] = useState(ATTACHMENT_CATEGORIES[0]);

  const loadSub = useCallback(async () => {
    setLoading(true);
    const [a, q, au, ag, perf, att, logs] = await Promise.all([
      listAvl(record.id), listQualifications(record.id), listSupplierAudits(record.id),
      listAgreements(record.id), listPerformance(record.id), getVendorAttachments(record.id),
      getAuditLogsForVendor(record.id),
    ]);
    setAvl(a); setQualifications(q); setAudits(au); setAgreements(ag);
    setPerformance(perf); setAttachments(att); setAuditLogs(logs);
    setLoading(false);
  }, [record.id]);

  useEffect(() => { void loadSub(); }, [loadSub]);

  const handleUpdate = async (data: VendorCreateInput) => {
    try {
      await updateVendor(record.id, data, actor);
      toast.success('Vendor updated');
      setEditing(false);
      onRefresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Update failed');
    }
  };

  const handleBlock = async () => {
    const reason = prompt('Reason for blocking vendor:');
    if (!reason) return;
    try {
      await blockVendor(record.id, actor, reason);
      toast.success('Vendor blocked');
      onRefresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Block failed');
    }
  };

  const handleApprove = async () => {
    try {
      await approveVendor(record.id, actor);
      toast.success('Vendor approved');
      onRefresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Approval failed');
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await uploadVendorAttachment(record.id, file, attachCategory, actor);
      toast.success('Attachment uploaded');
      await loadSub();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const info = [
    ['Vendor Code', record.vendor_code], ['Vendor Type', record.vendor_type],
    ['Material / Service', record.material_service_supplied], ['Manufacturer', record.manufacturer_name || '—'],
    ['Supplier', record.supplier_name || '—'], ['Contact', record.contact_person || '—'],
    ['Email', record.email || '—'], ['Phone', record.phone || '—'],
    ['City', record.city || '—'], ['Country', record.country || '—'],
    ['GST / Tax', record.gst_tax_no || '—'], ['License', record.license_no || '—'],
    ['Next Audit Due', record.next_audit_due || '—'],
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <p className="font-mono text-sm text-muted-foreground">{record.vendor_code}</p>
          <h1 className="text-2xl font-bold">{record.vendor_name}</h1>
          <div className="flex flex-wrap gap-2 mt-2">
            <ApprovalBadge status={record.approval_status} />
            <RiskBadge level={record.risk_category} />
            <span className="text-xs text-muted-foreground">{record.vendor_status}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowPrint(true)}><Printer className="h-4 w-4 mr-1" />Report</Button>
          {canManageVendors(actor.role) && !readOnly && (
            <Button variant="outline" size="sm" onClick={() => setEditing(!editing)}>{editing ? 'Cancel Edit' : 'Edit'}</Button>
          )}
          {canApproveVendor(actor.role) && record.approval_status !== 'Approved' && (
            <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={handleApprove}><CheckCircle className="h-4 w-4 mr-1" />Approve</Button>
          )}
          {canApproveVendor(actor.role) && record.approval_status !== 'Blocked' && (
            <Button variant="destructive" size="sm" onClick={handleBlock}><ShieldBan className="h-4 w-4 mr-1" />Block</Button>
          )}
        </div>
      </div>

      {editing && (
        <Card><CardHeader><CardTitle>Edit Vendor</CardTitle></CardHeader>
          <CardContent><VendorForm defaultValues={record} onSubmit={handleUpdate} onCancel={() => setEditing(false)} submitLabel="Update Vendor" /></CardContent>
        </Card>
      )}

      <Tabs defaultValue={defaultTab}>
        <TabsList className="flex flex-wrap h-auto gap-1">
          {['overview', 'materials', 'qualification', 'avl', 'audits', 'agreements', 'performance', 'complaints', 'attachments', 'history', 'trail'].map((t) => (
            <TabsTrigger key={t} value={t} className="text-xs capitalize">{t === 'avl' ? 'AVL' : t === 'trail' ? 'Audit Trail' : t === 'history' ? 'Approval History' : t}</TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <Card><CardContent className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {info.map(([k, v]) => (
              <div key={k}><p className="text-xs text-muted-foreground">{k}</p><p className="text-sm font-medium">{v}</p></div>
            ))}
            {record.address && <div className="sm:col-span-2 lg:col-span-3"><p className="text-xs text-muted-foreground">Address</p><p className="text-sm">{record.address}</p></div>}
            {record.remarks && <div className="sm:col-span-2 lg:col-span-3"><p className="text-xs text-muted-foreground">Remarks</p><p className="text-sm">{record.remarks}</p></div>}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="materials" className="mt-4">
          <Card><CardHeader><CardTitle>Materials / Services</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm mb-4">Primary: <strong>{record.material_service_supplied}</strong></p>
              <Table><TableHeader><TableRow><TableHead>AVL #</TableHead><TableHead>Material</TableHead><TableHead>Status</TableHead><TableHead>Expiry</TableHead></TableRow></TableHeader>
                <TableBody>
                  {avl.length === 0 ? <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">No AVL entries</TableCell></TableRow>
                    : avl.map((a) => (
                      <TableRow key={a.id}><TableCell className="font-mono text-sm">{a.avl_number}</TableCell>
                        <TableCell>{a.material_service}</TableCell><TableCell>{a.status}</TableCell><TableCell>{a.approval_expiry_date}</TableCell></TableRow>
                    ))}
                </TableBody></Table>
            </CardContent></Card>
        </TabsContent>

        <TabsContent value="qualification" className="mt-4">
          {loading ? <LoadingSpinner /> : (
            <Card><CardContent className="p-0 overflow-x-auto">
              <Table><TableHeader><TableRow>
                <TableHead>Number</TableHead><TableHead>Type</TableHead><TableHead>Decision</TableHead><TableHead>Next Review</TableHead>
              </TableRow></TableHeader><TableBody>
                {qualifications.length === 0 ? <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No qualifications</TableCell></TableRow>
                  : qualifications.map((q) => (
                    <TableRow key={q.id}><TableCell className="font-mono text-sm">{q.qualification_number}</TableCell>
                      <TableCell>{q.qualification_type}</TableCell><TableCell><ApprovalBadge status={q.qualification_decision} /></TableCell>
                      <TableCell>{q.next_review_date || '—'}</TableCell></TableRow>
                  ))}
              </TableBody></Table>
            </CardContent></Card>
          )}
        </TabsContent>

        <TabsContent value="avl" className="mt-4">
          <Card><CardContent className="p-0 overflow-x-auto">
            <Table><TableHeader><TableRow>
              <TableHead>AVL #</TableHead><TableHead>Material</TableHead><TableHead>Approved</TableHead><TableHead>Expiry</TableHead><TableHead>Status</TableHead>
            </TableRow></TableHeader><TableBody>
              {avl.map((a) => (
                <TableRow key={a.id}><TableCell className="font-mono">{a.avl_number}</TableCell><TableCell>{a.material_service}</TableCell>
                  <TableCell>{a.approval_date}</TableCell><TableCell>{a.approval_expiry_date}</TableCell><TableCell>{a.status}</TableCell></TableRow>
              ))}
            </TableBody></Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="audits" className="mt-4">
          <Card><CardContent className="p-0 overflow-x-auto">
            <Table><TableHeader><TableRow>
              <TableHead>Audit #</TableHead><TableHead>Type</TableHead><TableHead>Date</TableHead><TableHead>Findings</TableHead><TableHead>Rating</TableHead>
            </TableRow></TableHeader><TableBody>
              {audits.map((a) => (
                <TableRow key={a.id}><TableCell className="font-mono">{a.audit_number}</TableCell><TableCell>{a.audit_type}</TableCell>
                  <TableCell>{a.audit_date}</TableCell><TableCell>{a.findings_count}</TableCell><TableCell>{a.final_audit_rating}</TableCell></TableRow>
              ))}
            </TableBody></Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="agreements" className="mt-4">
          <Card><CardContent className="p-0 overflow-x-auto">
            <Table><TableHeader><TableRow>
              <TableHead>Agreement #</TableHead><TableHead>Type</TableHead><TableHead>Effective</TableHead><TableHead>Expiry</TableHead><TableHead>Status</TableHead>
            </TableRow></TableHeader><TableBody>
              {agreements.map((ag) => (
                <TableRow key={ag.id}><TableCell className="font-mono">{ag.agreement_number}</TableCell><TableCell>{ag.agreement_type}</TableCell>
                  <TableCell>{ag.effective_date}</TableCell><TableCell>{ag.expiry_date}</TableCell><TableCell>{ag.agreement_status}</TableCell></TableRow>
              ))}
            </TableBody></Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="performance" className="mt-4">
          <Card><CardContent className="p-0 overflow-x-auto">
            <Table><TableHeader><TableRow>
              <TableHead>Period</TableHead><TableHead>Score</TableHead><TableHead>Rating</TableHead><TableHead>Rejection %</TableHead><TableHead>On-Time %</TableHead>
            </TableRow></TableHeader><TableBody>
              {performance.map((p) => (
                <TableRow key={p.id}><TableCell>{p.review_period}</TableCell><TableCell className="font-bold">{p.performance_score}%</TableCell>
                  <TableCell><PerformanceBadge rating={p.performance_rating} /></TableCell>
                  <TableCell>{p.rejection_percent}%</TableCell><TableCell>{p.on_time_percent}%</TableCell></TableRow>
              ))}
            </TableBody></Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="complaints" className="mt-4">
          <Card><CardContent className="p-6 text-sm text-muted-foreground space-y-2">
            <p>Linked records from Complaint, Deviation, OOS, and CAPA modules appear here when integrated.</p>
            <div className="flex flex-wrap gap-2">
              <Link href="/dashboard/complaints"><Button variant="outline" size="sm">Complaints</Button></Link>
              <Link href="/dashboard/deviations"><Button variant="outline" size="sm">Deviations</Button></Link>
              <Link href="/dashboard/capa"><Button variant="outline" size="sm">CAPA</Button></Link>
            </div>
            {performance.length > 0 && (
              <Table className="mt-4"><TableHeader><TableRow><TableHead>Period</TableHead><TableHead>Complaints</TableHead><TableHead>Deviations</TableHead><TableHead>OOS</TableHead><TableHead>CAPA</TableHead></TableRow></TableHeader>
                <TableBody>{performance.map((p) => (
                  <TableRow key={p.id}><TableCell>{p.review_period}</TableCell><TableCell>{p.complaints}</TableCell>
                    <TableCell>{p.deviations}</TableCell><TableCell>{p.oos_linked}</TableCell><TableCell>{p.capa_linked}</TableCell></TableRow>
                ))}</TableBody></Table>
            )}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="attachments" className="mt-4">
          <Card><CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Attachments</CardTitle>
            {!readOnly && (
              <div className="flex gap-2 items-center">
                <select className="text-sm border rounded px-2 py-1" value={attachCategory} onChange={(e) => setAttachCategory(e.target.value)}>
                  {ATTACHMENT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <label className="cursor-pointer inline-flex">
                  <Input type="file" className="hidden" onChange={handleUpload} disabled={uploading} />
                  <span className="inline-flex items-center justify-center rounded-md border px-3 py-1.5 text-sm hover:bg-muted">
                    <Upload className="h-4 w-4 mr-1" />{uploading ? 'Uploading…' : 'Upload'}
                  </span>
                </label>
              </div>
            )}
          </CardHeader><CardContent className="p-0">
            <Table><TableHeader><TableRow><TableHead>File</TableHead><TableHead>Category</TableHead><TableHead>Uploaded</TableHead><TableHead></TableHead></TableRow></TableHeader>
              <TableBody>
                {attachments.length === 0 ? <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No attachments</TableCell></TableRow>
                  : attachments.map((a) => (
                    <TableRow key={a.id}><TableCell>{a.file_name}</TableCell><TableCell>{a.category}</TableCell>
                      <TableCell>{a.uploaded_at.split('T')[0]}</TableCell>
                      <TableCell><a href={a.download_url} target="_blank" rel="noreferrer"><Button variant="ghost" size="sm"><Download className="h-4 w-4" /></Button></a></TableCell></TableRow>
                  ))}
              </TableBody></Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <Card><CardContent className="p-0">
            <Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Action</TableHead><TableHead>User</TableHead><TableHead>Details</TableHead></TableRow></TableHeader>
              <TableBody>
                {auditLogs.filter((l) => ['APPROVAL', 'REJECTION', 'BLOCKING', 'QUALIFICATION_UPDATE', 'AVL_UPDATE'].includes(String(l.action))).map((l) => (
                  <TableRow key={String(l.id)}><TableCell>{String(l.dateTime || '').split('T')[0]}</TableCell>
                    <TableCell>{String(l.action)}</TableCell><TableCell>{String(l.userName || '')}</TableCell>
                    <TableCell className="max-w-xs truncate text-xs">{String(l.reason || l.newValue || '')}</TableCell></TableRow>
                ))}
              </TableBody></Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="trail" className="mt-4">
          <Card><CardContent className="p-0">
            <Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Action</TableHead><TableHead>User</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>
                {auditLogs.map((l) => (
                  <TableRow key={String(l.id)}><TableCell>{String(l.dateTime || '').split('T')[0]}</TableCell>
                    <TableCell>{String(l.action)}</TableCell><TableCell>{String(l.userName || '')}</TableCell>
                    <TableCell>{String(l.status || '')}</TableCell></TableRow>
                ))}
              </TableBody></Table>
          </CardContent></Card>
        </TabsContent>
      </Tabs>

      {showPrint && (
        <div className="fixed inset-0 z-50 bg-background overflow-auto p-6">
          <div className="flex justify-end gap-2 mb-4 print:hidden">
            <Button onClick={printPage}>Print</Button>
            <Button variant="outline" onClick={() => setShowPrint(false)}>Close</Button>
          </div>
          <VendorPdfDocument vendor={record} avl={avl} qualifications={qualifications} audits={audits} performance={performance} />
        </div>
      )}
    </div>
  );
}
