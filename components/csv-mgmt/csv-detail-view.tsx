'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Printer, Upload, Download } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { CsvStatusBadge, GxpBadge, PassFailBadge } from './csv-sub-nav';
import { SystemForm } from './system-form';
import {
  listGxpAssessments, listRiskAssessments, listUrs, listFrs, listDesignSpecs,
  listTestScripts, listTraceability, listPart11Assessments, listValidationReports,
  listPeriodicReviews, getCsvAttachments, uploadCsvAttachment, getAuditLogsForSystem,
  updateSystem, getTraceabilityCoverage,
} from '@/lib/csv-mgmt-service';
import type { CsvSystem } from '@/lib/csv-mgmt-types';
import { canManageCsv, isCsvReadOnly } from '@/lib/csv-mgmt-types';
import type { SystemCreateInput } from '@/lib/csv-mgmt-schemas';
import { useCsvActor } from '@/hooks/use-csv-mgmt';
import { printPage } from '@/lib/export-utils';

export function CsvDetailView({ system, onRefresh }: { system: CsvSystem; onRefresh: () => void }) {
  const actor = useCsvActor();
  const readOnly = isCsvReadOnly(actor.role);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [coverage, setCoverage] = useState(0);
  const [data, setData] = useState<Record<string, unknown[]>>({});
  const [attachments, setAttachments] = useState<Awaited<ReturnType<typeof getCsvAttachments>>>([]);
  const [auditLogs, setAuditLogs] = useState<Record<string, unknown>[]>([]);
  const [attachCategory, setAttachCategory] = useState('Protocol');

  const load = async () => {
    setLoading(true);
    const [gxp, risk, urs, frs, ds, iq, oq, pq, trace, p11, vr, pr, att, logs, cov] = await Promise.all([
      listGxpAssessments(system.id), listRiskAssessments(system.id), listUrs(system.id),
      listFrs(system.id), listDesignSpecs(system.id), listTestScripts(system.id, 'IQ'),
      listTestScripts(system.id, 'OQ'), listTestScripts(system.id, 'PQ'),
      listTraceability(system.id), listPart11Assessments(system.id),
      listValidationReports(system.id), listPeriodicReviews(system.id),
      getCsvAttachments(system.id), getAuditLogsForSystem(system.id), getTraceabilityCoverage(system.id),
    ]);
    setData({ gxp, risk, urs, frs, ds, iq, oq, pq, trace, p11, vr, pr });
    setAttachments(att);
    setAuditLogs(logs);
    setCoverage(cov);
    setLoading(false);
  };

  useEffect(() => { void load(); }, [system.id]);

  const handleUpdate = async (d: SystemCreateInput) => {
    await updateSystem(system.id, d, actor);
    toast.success('System updated');
    setEditing(false);
    onRefresh();
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await uploadCsvAttachment(system.id, file, attachCategory, actor);
      toast.success('Uploaded');
      await load();
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Upload failed'); }
    e.target.value = '';
  };

  const info = [
    ['System ID', system.system_id], ['Owner', system.system_owner], ['Department', system.department],
    ['Type', system.system_type], ['Vendor', system.vendor || '—'], ['Hosting', system.hosting_type],
    ['GxP Impact', system.gxp_impact ? 'Yes' : 'No'], ['Validation Package', system.validation_package_required ? 'Required' : 'N/A'],
    ['Part 11 Required', system.part11_required ? 'Yes' : 'No'], ['Go Live', system.go_live_date || '—'],
    ['Next Review', system.next_review_due || '—'],
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <p className="font-mono text-sm text-muted-foreground">{system.system_id}</p>
          <h1 className="text-2xl font-bold">{system.system_name}</h1>
          <div className="flex flex-wrap gap-2 mt-2">
            <CsvStatusBadge status={system.validation_status} />
            <GxpBadge critical={system.gxp_impact} />
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={printPage}><Printer className="h-4 w-4 mr-1" />Report</Button>
          {canManageCsv(actor.role) && !readOnly && (
            <Button variant="outline" size="sm" onClick={() => setEditing(!editing)}>{editing ? 'Cancel' : 'Edit'}</Button>
          )}
        </div>
      </div>

      {editing && (
        <Card><CardHeader><CardTitle>Edit System</CardTitle></CardHeader>
          <CardContent><SystemForm defaultValues={system} onSubmit={handleUpdate} onCancel={() => setEditing(false)} submitLabel="Update" /></CardContent>
        </Card>
      )}

      {loading ? <LoadingSpinner /> : (
        <Tabs defaultValue="overview">
          <TabsList className="flex flex-wrap h-auto gap-1">
            {['overview', 'gxp', 'risk', 'urs', 'frs', 'ds', 'iq', 'oq', 'pq', 'traceability', 'part11', 'report', 'review', 'attachments', 'trail'].map((t) => (
              <TabsTrigger key={t} value={t} className="text-xs capitalize">{t === 'ds' ? 'Design Spec' : t === 'part11' ? 'Part 11' : t === 'trail' ? 'Audit Trail' : t}</TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="overview" className="mt-4">
            <Card><CardContent className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {info.map(([k, v]) => (<div key={k}><p className="text-xs text-muted-foreground">{k}</p><p className="text-sm font-medium">{v}</p></div>))}
              <div><p className="text-xs text-muted-foreground">Traceability Coverage</p><p className="text-sm font-bold text-blue-600">{coverage}%</p></div>
              <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-3">
                <Link href="/qms/csv/urs"><Button variant="outline" size="sm">URS</Button></Link>
                <Link href="/qms/csv/part11"><Button variant="outline" size="sm">Part 11</Button></Link>
                <Link href="/qms/csv/validation-report"><Button variant="outline" size="sm">Validation Report</Button></Link>
              </div>
            </CardContent></Card>
          </TabsContent>

          {Object.entries({ gxp: ['Classification', 'Conclusion'] as [string, string], risk: ['RPN', 'Risk Level'] as [string, string], urs: ['Requirement No', 'Type'] as [string, string], frs: ['FRS ID', 'Linked URS'] as [string, string], ds: ['DS ID', 'Linked FRS'] as [string, string] }).map(([key, cols]) => (
            <TabsContent key={key} value={key} className="mt-4">
              <SimpleTable rows={(data[key] || []) as Record<string, unknown>[]} cols={cols} />
            </TabsContent>
          ))}

          {(['iq', 'oq', 'pq'] as const).map((phase) => (
            <TabsContent key={phase} value={phase} className="mt-4">
              <Card><CardContent className="p-0 overflow-x-auto">
                <Table><TableHeader><TableRow><TableHead>Script #</TableHead><TableHead>Objective</TableHead><TableHead>Result</TableHead><TableHead>Executed By</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {(data[phase] as { test_script_no: string; test_objective: string; pass_fail: string; executed_by_name: string; id: string }[] || []).map((t) => (
                      <TableRow key={t.id}><TableCell>{t.test_script_no}</TableCell><TableCell>{t.test_objective}</TableCell>
                        <TableCell><PassFailBadge result={t.pass_fail} /></TableCell><TableCell>{t.executed_by_name}</TableCell></TableRow>
                    ))}
                  </TableBody></Table>
              </CardContent></Card>
            </TabsContent>
          ))}

          <TabsContent value="traceability" className="mt-4">
            <Card><CardHeader><CardTitle>Coverage: {coverage}%</CardTitle></CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <Table><TableHeader><TableRow><TableHead>URS</TableHead><TableHead>FRS</TableHead><TableHead>DS</TableHead><TableHead>IQ</TableHead><TableHead>OQ</TableHead><TableHead>PQ</TableHead><TableHead>Gap</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {(data.trace as { urs_no: string; frs_no: string; ds_no: string; iq_test_no: string; oq_test_no: string; pq_test_no: string; gap_identified: boolean; id: string }[] || []).map((r) => (
                      <TableRow key={r.id}><TableCell>{r.urs_no}</TableCell><TableCell>{r.frs_no}</TableCell><TableCell>{r.ds_no}</TableCell>
                        <TableCell>{r.iq_test_no}</TableCell><TableCell>{r.oq_test_no}</TableCell><TableCell>{r.pq_test_no}</TableCell>
                        <TableCell>{r.gap_identified ? 'Yes' : 'No'}</TableCell></TableRow>
                    ))}
                  </TableBody></Table>
              </CardContent></Card>
          </TabsContent>

          <TabsContent value="part11" className="mt-4">
            {(data.p11 as { assessment_result: string; gap_action: string; id: string }[] || []).length > 0 ? (
              <Card><CardContent className="p-6">
                <p className="font-medium">Result: {(data.p11 as { assessment_result: string }[])[0]?.assessment_result}</p>
                <p className="text-sm text-muted-foreground mt-2">{(data.p11 as { gap_action: string }[])[0]?.gap_action}</p>
              </CardContent></Card>
            ) : <p className="text-muted-foreground text-sm">No Part 11 assessment — <Link href="/qms/csv/part11" className="text-blue-600">Create</Link></p>}
          </TabsContent>

          <TabsContent value="report" className="mt-4">
            <SimpleTable rows={(data.vr || []) as Record<string, unknown>[]} cols={['Coverage %', 'Conclusion']} />
          </TabsContent>

          <TabsContent value="review" className="mt-4">
            <SimpleTable rows={(data.pr || []) as Record<string, unknown>[]} cols={['Review Period', 'Recommendation']} />
          </TabsContent>

          <TabsContent value="attachments" className="mt-4">
            <Card><CardHeader className="flex justify-between">
              <CardTitle>Attachments</CardTitle>
              {!readOnly && (
                <label className="cursor-pointer inline-flex items-center rounded-md border px-3 py-1.5 text-sm">
                  <Input type="file" className="hidden" onChange={handleUpload} /><Upload className="h-4 w-4 mr-1" />Upload
                </label>
              )}
            </CardHeader><CardContent className="p-0">
              <Table><TableHeader><TableRow><TableHead>File</TableHead><TableHead>Category</TableHead><TableHead></TableHead></TableRow></TableHeader>
                <TableBody>{attachments.map((a) => (
                  <TableRow key={a.id}><TableCell>{a.file_name}</TableCell><TableCell>{a.category}</TableCell>
                    <TableCell><a href={a.download_url} target="_blank" rel="noreferrer"><Download className="h-4 w-4" /></a></TableCell></TableRow>
                ))}</TableBody></Table>
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="trail" className="mt-4">
            <Card><CardContent className="p-0">
              <Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Action</TableHead><TableHead>User</TableHead></TableRow></TableHeader>
                <TableBody>{auditLogs.map((l) => (
                  <TableRow key={String(l.id)}><TableCell>{String(l.dateTime || '').split('T')[0]}</TableCell>
                    <TableCell>{String(l.action)}</TableCell><TableCell>{String(l.userName)}</TableCell></TableRow>
                ))}</TableBody></Table>
            </CardContent></Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

function SimpleTable({ rows, cols }: { rows: Record<string, unknown>[]; cols: [string, string] }) {
  const [c1, c2] = cols;
  const k1 = c1.toLowerCase().replace(/ /g, '_').replace('%', 'percent');
  const keys = rows[0] ? Object.keys(rows[0]) : [];
  const field1 = keys.find((k) => k.includes(k1.split('_')[0])) || keys[1] || 'id';
  const field2 = keys.find((k, i) => i > 0 && k !== field1) || keys[2] || 'status';
  return (
    <Card><CardContent className="p-0 overflow-x-auto">
      <Table><TableHeader><TableRow><TableHead>{c1}</TableHead><TableHead>{c2}</TableHead></TableRow></TableHeader>
        <TableBody>
          {rows.length === 0 ? <TableRow><TableCell colSpan={2} className="text-center py-8 text-muted-foreground">No records</TableCell></TableRow>
            : rows.map((r) => (<TableRow key={String(r.id)}><TableCell>{String(r[field1] ?? '')}</TableCell><TableCell>{String(r[field2] ?? '')}</TableCell></TableRow>))}
        </TableBody></Table>
    </CardContent></Card>
  );
}
