'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Printer, Upload, Lock, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { EbmrStatusBadge, EbmrBatchSubNav } from './ebmr-sub-nav';
import { EbmrForm } from './ebmr-form';
import {
  LineClearanceForm, DispensingForm, ManufacturingStepForm, EquipmentUsageForm,
  CppRecordForm, IpcCheckForm, EbmrReviewForm, EbmrReleaseForm,
} from './ebmr-forms';
import {
  LineClearanceTable, DispensingTable, ManufacturingStepsTable, EquipmentUsageTable,
  CppRecordsTable, IpcChecksTable, ReviewsTable, ReleasesTable,
} from './ebmr-entity-list';
import { EbmrFullPdfDocument } from './ebmr-pdf-document';
import {
  getEbmrFullData, updateEbmr, uploadEbmrAttachment,
} from '@/lib/ebmr-mgmt-service';
import type { EbmrRecord } from '@/lib/ebmr-mgmt-types';
import { isEbmrEditable, isEbmrReadOnly, canCreateEbmr } from '@/lib/ebmr-mgmt-types';
import type { EbmrCreateInput } from '@/lib/ebmr-mgmt-schemas';
import { useEbmrActor } from '@/hooks/use-ebmr-mgmt';
import { printPage } from '@/lib/export-utils';

export function EbmrDetailView({ record, onRefresh }: { record: EbmrRecord; onRefresh: () => void }) {
  const actor = useEbmrActor();
  const readOnly = isEbmrReadOnly(actor.role);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [attachCategory, setAttachCategory] = useState('BMR Attachment');
  const [data, setData] = useState<Awaited<ReturnType<typeof getEbmrFullData>> | null>(null);

  const load = async () => {
    setLoading(true);
    setData(await getEbmrFullData(record.id));
    setLoading(false);
  };

  useEffect(() => { void load(); }, [record.id]);

  const handleUpdate = async (d: EbmrCreateInput) => {
    await updateEbmr(record.id, d, actor);
    toast.success('eBMR updated');
    setEditing(false);
    onRefresh();
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || record.is_locked) return;
    try {
      await uploadEbmrAttachment(record.id, file, attachCategory, actor);
      toast.success('Attachment uploaded');
      await load();
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Upload failed'); }
    e.target.value = '';
  };

  const info = [
    ['Product', record.product_name], ['Generic', record.generic_name || '—'], ['Strength', record.strength || '—'],
    ['Batch No', record.batch_number], ['Batch Size', record.batch_size || '—'],
    ['MFG Date', record.mfg_date], ['EXP Date', record.exp_date], ['MFR No', record.mfr_number || '—'],
    ['BMR Version', record.bmr_version], ['License No', record.manufacturing_license_no || '—'],
    ['Mfg Area', record.manufacturing_area || '—'], ['Market', record.market || '—'], ['Customer', record.customer || '—'],
    ['Created By', record.created_by_name], ['Reviewed By', record.reviewed_by_name || '—'],
    ['Approved By', record.approved_by_name || '—'],
  ];

  if (loading || !data) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <EbmrBatchSubNav batchId={record.id} />
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground font-mono">{record.ebmr_number}</p>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{record.product_name}</h1>
          <p className="text-muted-foreground text-sm">Batch {record.batch_number}</p>
          <div className="flex flex-wrap gap-2 mt-2">
            <EbmrStatusBadge status={record.batch_status} />
            {record.is_locked && <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs"><Lock className="h-3 w-3" />Locked</span>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={printPage}><Printer className="h-4 w-4 mr-1" />Print</Button>
          {canCreateEbmr(actor.role) && !readOnly && isEbmrEditable(record) && (
            <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => setEditing(!editing)}>{editing ? 'Cancel' : 'Edit Header'}</Button>
          )}
        </div>
      </div>

      {record.is_locked && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
          This batch record has been released and is locked from editing. Data flows to PQR and CPV modules.
        </div>
      )}

      <div className="hidden print:block">
        <EbmrFullPdfDocument record={record}
          lineClearance={data.lineClearance} dispensing={data.dispensing} steps={data.steps}
          equipment={data.equipment} cpp={data.cpp} ipc={data.ipc}
          reviews={data.reviews} releases={data.releases} reportTitle="Complete eBMR Report" />
      </div>

      {editing ? (
        <Card><CardHeader><CardTitle>Edit Batch Header</CardTitle></CardHeader>
          <CardContent><EbmrForm defaultValues={record} onSubmit={handleUpdate} onCancel={() => setEditing(false)} submitLabel="Update" /></CardContent></Card>
      ) : (
        <Tabs defaultValue="overview">
          <TabsList className="flex flex-wrap h-auto gap-1">
            {['overview', 'line-clearance', 'dispensing', 'manufacturing', 'equipment', 'cpp', 'ipc', 'deviations', 'review', 'release', 'attachments', 'audit'].map((t) => (
              <TabsTrigger key={t} value={t} className="text-xs capitalize">{t.replace('-', ' ')}</TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <Card><CardContent className="pt-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2 text-sm">
                {info.map(([k, v]) => (
                  <div key={k} className="flex justify-between border-b py-1.5"><span className="text-muted-foreground">{k}</span><span className="font-medium text-right">{v}</span></div>
                ))}
              </div>
              {record.remarks && <p className="mt-4 text-sm text-muted-foreground">{record.remarks}</p>}
            </CardContent></Card>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <Card><CardContent className="p-4"><p className="text-muted-foreground">Line Clearance</p><p className="font-bold">{data.lineClearance.length}</p></CardContent></Card>
              <Card><CardContent className="p-4"><p className="text-muted-foreground">Dispensing</p><p className="font-bold">{data.dispensing.length}</p></CardContent></Card>
              <Card><CardContent className="p-4"><p className="text-muted-foreground">Mfg Steps</p><p className="font-bold">{data.steps.length}</p></CardContent></Card>
              <Card><CardContent className="p-4"><p className="text-muted-foreground">IPC Checks</p><p className="font-bold">{data.ipc.length}</p></CardContent></Card>
            </div>
          </TabsContent>

          <TabsContent value="line-clearance" className="space-y-4">
            {!readOnly && <LineClearanceForm ebmr={record} onSuccess={() => { load(); onRefresh(); }} />}
            <Card><CardHeader><CardTitle className="text-base">Line Clearance Records</CardTitle></CardHeader>
              <CardContent className="overflow-x-auto p-0"><LineClearanceTable records={data.lineClearance} /></CardContent></Card>
          </TabsContent>

          <TabsContent value="dispensing" className="space-y-4">
            {!readOnly && <DispensingForm ebmr={record} onSuccess={() => { load(); onRefresh(); }} />}
            <Card><CardHeader><CardTitle className="text-base">Dispensing Records</CardTitle></CardHeader>
              <CardContent className="overflow-x-auto p-0"><DispensingTable records={data.dispensing} /></CardContent></Card>
          </TabsContent>

          <TabsContent value="manufacturing" className="space-y-4">
            {!readOnly && <ManufacturingStepForm ebmr={record} onSuccess={() => { load(); onRefresh(); }} />}
            <Card><CardHeader><CardTitle className="text-base">Manufacturing Steps</CardTitle></CardHeader>
              <CardContent className="overflow-x-auto p-0"><ManufacturingStepsTable records={data.steps} /></CardContent></Card>
          </TabsContent>

          <TabsContent value="equipment" className="space-y-4">
            {!readOnly && <EquipmentUsageForm ebmr={record} onSuccess={() => { load(); onRefresh(); }} />}
            <Card><CardHeader><CardTitle className="text-base">Equipment Usage</CardTitle></CardHeader>
              <CardContent className="overflow-x-auto p-0"><EquipmentUsageTable records={data.equipment} /></CardContent></Card>
          </TabsContent>

          <TabsContent value="cpp" className="space-y-4">
            {!readOnly && <CppRecordForm ebmr={record} onSuccess={() => { load(); onRefresh(); }} />}
            <Card><CardHeader><CardTitle className="text-base">CPP Records</CardTitle></CardHeader>
              <CardContent className="overflow-x-auto p-0"><CppRecordsTable records={data.cpp} /></CardContent></Card>
          </TabsContent>

          <TabsContent value="ipc" className="space-y-4">
            {!readOnly && <IpcCheckForm ebmr={record} onSuccess={() => { load(); onRefresh(); }} />}
            <Card><CardHeader><CardTitle className="text-base">IPC Checks</CardTitle></CardHeader>
              <CardContent className="overflow-x-auto p-0"><IpcChecksTable records={data.ipc} /></CardContent></Card>
          </TabsContent>

          <TabsContent value="deviations" className="space-y-4">
            <Card><CardHeader><CardTitle className="text-base">Linked Deviations & OOS</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {(record.linked_deviation_ids.length === 0 && record.linked_oos_ids.length === 0) ? (
                  <p className="text-muted-foreground text-sm">No linked deviations or OOS records.</p>
                ) : (
                  <div className="space-y-2">
                    {record.linked_deviation_ids.map((id) => (
                      <Link key={id} href={`/qms/deviation/${id}`} className="flex items-center gap-2 text-sm text-blue-600 hover:underline">
                        <ExternalLink className="h-4 w-4" />Deviation {id}
                      </Link>
                    ))}
                    {record.linked_oos_ids.map((id) => (
                      <Link key={id} href={`/qms/oos/${id}`} className="flex items-center gap-2 text-sm text-blue-600 hover:underline">
                        <ExternalLink className="h-4 w-4" />OOS {id}
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent></Card>
          </TabsContent>

          <TabsContent value="review" className="space-y-4">
            {!readOnly && <EbmrReviewForm ebmr={record} onSuccess={() => { load(); onRefresh(); }} />}
            <Card><CardHeader><CardTitle className="text-base">Review History</CardTitle></CardHeader>
              <CardContent className="overflow-x-auto p-0"><ReviewsTable records={data.reviews} /></CardContent></Card>
          </TabsContent>

          <TabsContent value="release" className="space-y-4">
            {!readOnly && <EbmrReleaseForm ebmr={record} onSuccess={() => { load(); onRefresh(); }} />}
            <Card><CardHeader><CardTitle className="text-base">Release History</CardTitle></CardHeader>
              <CardContent className="overflow-x-auto p-0"><ReleasesTable records={data.releases} /></CardContent></Card>
          </TabsContent>

          <TabsContent value="attachments" className="space-y-4">
            {!record.is_locked && !readOnly && (
              <Card><CardContent className="pt-6 flex flex-wrap gap-3 items-center">
                <Input type="text" value={attachCategory} onChange={(e) => setAttachCategory(e.target.value)} className="max-w-xs" placeholder="Category" />
                <label className="cursor-pointer"><Button variant="outline" asChild><span><Upload className="h-4 w-4 mr-1" />Upload</span></Button>
                  <input type="file" className="hidden" onChange={handleUpload} /></label>
              </CardContent></Card>
            )}
            <Card><CardHeader><CardTitle className="text-base">Attachments</CardTitle></CardHeader>
              <CardContent>
                {data.attachments.length === 0 ? <p className="text-muted-foreground text-sm">No attachments</p>
                  : data.attachments.map((a) => (
                    <a key={a.id} href={a.download_url} target="_blank" rel="noreferrer" className="block text-sm text-blue-600 hover:underline py-1">
                      {a.file_name} ({a.category})
                    </a>
                  ))}
              </CardContent></Card>
          </TabsContent>

          <TabsContent value="audit">
            <Card><CardHeader><CardTitle className="text-base">Audit Trail</CardTitle></CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full text-xs"><thead><tr className="border-b">
                  <th className="text-left p-2">Action</th><th className="text-left p-2">User</th><th className="text-left p-2">Time</th>
                </tr></thead><tbody>
                  {data.auditLogs.map((log, i) => (
                    <tr key={i} className="border-b">
                      <td className="p-2">{String(log.action || '—')}</td>
                      <td className="p-2">{String(log.userName || log.userId || '—')}</td>
                      <td className="p-2">{String(log.timestamp || '—')}</td>
                    </tr>
                  ))}
                </tbody></table>
              </CardContent></Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

export function EbmrBatchSectionPage({
  record, title, description, form, table,
}: {
  record: EbmrRecord;
  title: string;
  description: string;
  onRefresh?: () => void;
  form?: React.ReactNode;
  table: React.ReactNode;
}) {
  return (
    <div className="space-y-6">
      <EbmrBatchSubNav batchId={record.id} />
      <div>
        <p className="text-sm text-muted-foreground font-mono">{record.ebmr_number} · Batch {record.batch_number}</p>
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="text-muted-foreground text-sm">{description}</p>
        <EbmrStatusBadge status={record.batch_status} />
      </div>
      {form}
      <Card><CardHeader><CardTitle className="text-base">Records</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto p-0">{table}</CardContent></Card>
    </div>
  );
}
