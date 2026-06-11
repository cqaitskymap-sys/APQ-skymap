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
import { MonitoringStatusBadge, GradeBadge } from './monitoring-sub-nav';
import { AreaForm } from './area-form';
import { MonitoringDashboardCharts } from './monitoring-dashboard-charts';
import {
  listEnvironmental, listExcursions, getMonitoringAttachments,
  uploadMonitoringAttachment, getAuditLogsForArea, updateArea,
} from '@/lib/monitoring-mgmt-service';
import type { AreaRecord, EnvironmentalRecord, ExcursionRecord, MonitoringAttachment } from '@/lib/monitoring-mgmt-types';
import { canManageMonitoring, isMonitoringReadOnly } from '@/lib/monitoring-mgmt-types';
import type { AreaCreateInput } from '@/lib/monitoring-mgmt-schemas';
import { useMonitoringActor } from '@/hooks/use-monitoring-mgmt';
import { printPage } from '@/lib/export-utils';

export function MonitoringDetailView({ area, onRefresh }: { area: AreaRecord; onRefresh: () => void }) {
  const actor = useMonitoringActor();
  const readOnly = isMonitoringReadOnly(actor.role);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [environmental, setEnvironmental] = useState<EnvironmentalRecord[]>([]);
  const [excursions, setExcursions] = useState<ExcursionRecord[]>([]);
  const [attachments, setAttachments] = useState<MonitoringAttachment[]>([]);
  const [auditLogs, setAuditLogs] = useState<Record<string, unknown>[]>([]);
  const [attachCategory, setAttachCategory] = useState('Report');

  const load = async () => {
    setLoading(true);
    const [env, allExc, att, logs] = await Promise.all([
      listEnvironmental(undefined, area.id),
      listExcursions(),
      getMonitoringAttachments(area.id),
      getAuditLogsForArea(area.id),
    ]);
    setEnvironmental(env);
    setExcursions(allExc.filter((e) => e.area_name === area.area_name));
    setAttachments(att);
    setAuditLogs(logs);
    setLoading(false);
  };

  useEffect(() => { void load(); }, [area.id]);

  const handleUpdate = async (d: AreaCreateInput) => {
    await updateArea(area.id, d, actor);
    toast.success('Area updated');
    setEditing(false);
    onRefresh();
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await uploadMonitoringAttachment(area.id, file, attachCategory, actor);
      toast.success('Uploaded');
      await load();
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Upload failed'); }
    e.target.value = '';
  };

  const info = [
    ['Area Code', area.area_code], ['Department', area.department], ['Room', area.room_number || '—'],
    ['Grade', area.cleanroom_grade], ['Process Area', area.process_area || '—'],
    ['Temp Limits', area.temperature_limit_lower != null ? `${area.temperature_limit_lower}–${area.temperature_limit_upper} °C` : '—'],
    ['RH Limits', area.rh_limit_lower != null ? `${area.rh_limit_lower}–${area.rh_limit_upper} %` : '—'],
    ['DP Limits', area.dp_limit_lower != null ? `${area.dp_limit_lower}–${area.dp_limit_upper} Pa` : '—'],
    ['Monitoring', area.monitoring_required ? 'Required' : 'Not Required'],
  ];

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground font-mono">{area.area_code}</p>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{area.area_name}</h1>
          <div className="flex flex-wrap gap-2 mt-2">
            <GradeBadge grade={area.cleanroom_grade} />
            <MonitoringStatusBadge status={area.area_status} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={printPage}><Printer className="h-4 w-4 mr-1" />Print</Button>
          {canManageMonitoring(actor.role) && !readOnly && (
            <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => setEditing(!editing)}>{editing ? 'Cancel Edit' : 'Edit'}</Button>
          )}
        </div>
      </div>

      {editing ? (
        <Card><CardHeader><CardTitle>Edit Area</CardTitle></CardHeader>
          <CardContent><AreaForm defaultValues={area} onSubmit={handleUpdate} onCancel={() => setEditing(false)} submitLabel="Update" /></CardContent></Card>
      ) : (
        <Tabs defaultValue="overview">
          <TabsList className="flex flex-wrap h-auto gap-1">
            {['overview', 'results', 'trend', 'excursions', 'deviation', 'attachments', 'audit'].map((t) => (
              <TabsTrigger key={t} value={t} className="capitalize">{t === 'deviation' ? 'Deviation/CAPA' : t === 'audit' ? 'Audit Trail' : t}</TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="overview" className="mt-4">
            <Card><CardContent className="pt-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {info.map(([k, v]) => (
                  <div key={k}><p className="text-xs text-muted-foreground">{k}</p><p className="font-medium">{v}</p></div>
                ))}
              </div>
              {area.remarks && <p className="mt-4 text-sm text-muted-foreground border-t pt-4">{area.remarks}</p>}
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="results" className="mt-4">
            <Card><CardHeader><CardTitle>Environmental Results ({environmental.length})</CardTitle></CardHeader>
              <CardContent className="overflow-x-auto p-0">
                <Table><TableHeader><TableRow>
                  <TableHead>No</TableHead><TableHead>Date</TableHead><TableHead>Type</TableHead>
                  <TableHead>Value</TableHead><TableHead>Limits</TableHead><TableHead>Status</TableHead>
                </TableRow></TableHeader><TableBody>
                  {environmental.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">No results</TableCell></TableRow>
                    : environmental.map((e) => (
                      <TableRow key={e.id}>
                        <TableCell className="font-mono text-sm">{e.monitoring_number}</TableCell>
                        <TableCell>{e.monitoring_date}</TableCell><TableCell>{e.monitoring_type}</TableCell>
                        <TableCell>{e.observed_value} {e.unit}</TableCell>
                        <TableCell>{e.lower_limit}–{e.upper_limit}</TableCell>
                        <TableCell><MonitoringStatusBadge status={e.status} /></TableCell>
                      </TableRow>
                    ))}
                </TableBody></Table>
              </CardContent></Card>
          </TabsContent>

          <TabsContent value="trend" className="mt-4">
            <MonitoringDashboardCharts environmental={environmental} utility={[]} excursions={excursions} areas={[area]} />
          </TabsContent>

          <TabsContent value="excursions" className="mt-4">
            <Card><CardHeader><CardTitle>Excursions ({excursions.length})</CardTitle></CardHeader>
              <CardContent className="overflow-x-auto p-0">
                <Table><TableHeader><TableRow>
                  <TableHead>No</TableHead><TableHead>Date</TableHead><TableHead>Parameter</TableHead>
                  <TableHead>Value</TableHead><TableHead>Status</TableHead><TableHead>CAPA</TableHead>
                </TableRow></TableHeader><TableBody>
                  {excursions.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">No excursions</TableCell></TableRow>
                    : excursions.map((x) => (
                      <TableRow key={x.id}>
                        <TableCell className="font-mono text-sm">{x.excursion_number}</TableCell>
                        <TableCell>{x.excursion_date}</TableCell><TableCell>{x.parameter_name}</TableCell>
                        <TableCell>{x.observed_value} {x.unit}</TableCell>
                        <TableCell><MonitoringStatusBadge status={x.status} /></TableCell>
                        <TableCell>{x.capa_recommended ? 'Recommended' : '—'}</TableCell>
                      </TableRow>
                    ))}
                </TableBody></Table>
              </CardContent></Card>
          </TabsContent>

          <TabsContent value="deviation" className="mt-4">
            <Card><CardContent className="pt-6 space-y-3">
              {excursions.filter((x) => x.linked_deviation_number).length === 0 ? (
                <p className="text-muted-foreground">No linked deviations or CAPA recommendations.</p>
              ) : excursions.filter((x) => x.linked_deviation_number).map((x) => (
                <div key={x.id} className="flex items-center justify-between border-b pb-2">
                  <div>
                    <p className="font-medium">{x.excursion_number} — {x.parameter_name}</p>
                    <p className="text-sm text-muted-foreground">{x.linked_deviation_number}</p>
                  </div>
                  <Link href="/qms/deviation" className="text-blue-600 text-sm">View Deviation →</Link>
                </div>
              ))}
              {excursions.some((x) => x.capa_recommended) && (
                <Link href="/qms/capa" className="text-blue-600 text-sm">CAPA module →</Link>
              )}
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="attachments" className="mt-4">
            <Card><CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Attachments</CardTitle>
              {canManageMonitoring(actor.role) && !readOnly && (
                <div className="flex gap-2 items-center">
                  <Input placeholder="Category" className="w-32 h-8" value={attachCategory} onChange={(e) => setAttachCategory(e.target.value)} />
                  <label><Input type="file" className="hidden" onChange={handleUpload} /><Button variant="outline" size="sm" asChild><span><Upload className="h-4 w-4 mr-1" />Upload</span></Button></label>
                </div>
              )}
            </CardHeader>
              <CardContent className="overflow-x-auto p-0">
                <Table><TableHeader><TableRow>
                  <TableHead>File</TableHead><TableHead>Category</TableHead><TableHead>By</TableHead><TableHead></TableHead>
                </TableRow></TableHeader><TableBody>
                  {attachments.length === 0 ? <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground">No attachments</TableCell></TableRow>
                    : attachments.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell>{a.file_name}</TableCell><TableCell>{a.category}</TableCell>
                        <TableCell>{a.uploaded_by_name}</TableCell>
                        <TableCell><a href={a.download_url} target="_blank" rel="noreferrer"><Download className="h-4 w-4" /></a></TableCell>
                      </TableRow>
                    ))}
                </TableBody></Table>
              </CardContent></Card>
          </TabsContent>

          <TabsContent value="audit" className="mt-4">
            <Card><CardHeader><CardTitle>Audit Trail</CardTitle></CardHeader>
              <CardContent className="overflow-x-auto p-0">
                <Table><TableHeader><TableRow>
                  <TableHead>Action</TableHead><TableHead>User</TableHead><TableHead>Timestamp</TableHead>
                </TableRow></TableHeader><TableBody>
                  {auditLogs.length === 0 ? <TableRow><TableCell colSpan={3} className="text-center py-6 text-muted-foreground">No audit entries</TableCell></TableRow>
                    : auditLogs.map((l, i) => (
                      <TableRow key={i}>
                        <TableCell>{String(l.action || '—')}</TableCell>
                        <TableCell>{String(l.userName || '—')}</TableCell>
                        <TableCell>{String(l.timestamp || '—').slice(0, 19)}</TableCell>
                      </TableRow>
                    ))}
                </TableBody></Table>
              </CardContent></Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
