'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/auth-context';
import { cpvPermissions } from '@/lib/cpv';
import { canAcknowledgeAlertSource } from '@/lib/cpv-alert-records';
import {
  acknowledgeCpvAlert, assignCpvAlert, closeCpvAlert, escalateCpvAlert,
  fetchAlertAuditTrail, fetchCpvAlertById, linkCpvAlert, rejectCpvAlert,
} from '@/lib/cpv-alert-service';
import { CpvPageHeader } from '@/components/cpv/product-master/cpv-page-header';
import { AlertTimeline } from './alert-timeline';
import { AlertStatusBadge, PriorityBadge, RiskBadge, SeverityBadge } from './alert-badges';
import { KpiCard } from '@/components/cpv/cpv-ui';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export function AlertEngineDetailView({ id }: { id: string }) {
  const router = useRouter();
  const { user, profile } = useAuth();
  const canManage = cpvPermissions.canManageAlerts(profile?.role);
  const [record, setRecord] = useState<Awaited<ReturnType<typeof fetchCpvAlertById>>>(null);
  const [audit, setAudit] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [closureRemarks, setClosureRemarks] = useState('');
  const [capaLink, setCapaLink] = useState('');
  const [deviationLink, setDeviationLink] = useState('');
  const [assignTo, setAssignTo] = useState('');

  const actor = { id: user?.uid || 'system', name: profile?.full_name || 'System', role: profile?.role || '' };

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetchCpvAlertById(id);
    setRecord(r);
    if (r) {
      setCapaLink(r.linkedCapaNumber);
      setDeviationLink(r.linkedDeviationNumber);
      setAudit(await fetchAlertAuditTrail(id));
    }
    setLoading(false);
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  if (loading) return <div className="p-4 sm:p-6"><LoadingSkeleton rows={1} /></div>;
  if (!record) return <div className="p-4 sm:p-6"><ErrorCard message="Alert not found." onRetry={load} /></div>;

  const canAck = canAcknowledgeAlertSource(profile?.role, record.alertSource) || canManage;
  const isClosed = ['Closed', 'Rejected'].includes(record.alertStatus);

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <CpvPageHeader
        title={record.alertNumber}
        description={record.alertTitle}
        trail={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Continued Process Verification', href: '/cpv/dashboard' },
          { label: 'Alert Engine', href: '/cpv/alert-engine' },
          { label: record.alertNumber },
        ]}
        actions={
          <Button variant="outline" size="sm" onClick={() => router.push('/cpv/alert-engine')}>
            <ArrowLeft className="h-4 w-4 mr-1" />Back
          </Button>
        }
      />

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Priority" value={record.alertPriority} tone={record.alertPriority === 'Critical' ? 'red' : 'amber'} />
        <KpiCard label="Status" value={record.alertStatus} tone="blue" />
        <KpiCard label="Source" value={record.alertSource} />
        <KpiCard label="Due Date" value={record.dueDate || '—'} />
      </div>

      <div className="flex flex-wrap gap-2">
        <PriorityBadge priority={String(record.alertPriority)} />
        <SeverityBadge severity={String(record.alertSeverity)} />
        <AlertStatusBadge status={String(record.alertStatus)} />
        <RiskBadge level={String(record.riskLevel)} />
      </div>

      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="actions">Actions</TabsTrigger>
          <TabsTrigger value="audit">Audit</TabsTrigger>
        </TabsList>

        <TabsContent value="details">
          <Card><CardContent className="grid gap-2 pt-6 text-sm sm:grid-cols-2">
            <p><span className="text-muted-foreground">Product:</span> {record.productName}</p>
            <p><span className="text-muted-foreground">Batch:</span> {record.batchNumber || '—'}</p>
            <p><span className="text-muted-foreground">Parameter:</span> {record.parameterName || '—'}</p>
            <p><span className="text-muted-foreground">Observed:</span> {String(record.observedValue || '—')}</p>
            <p><span className="text-muted-foreground">Limit:</span> {String(record.limitValue || '—')}</p>
            <p><span className="text-muted-foreground">Detected:</span> {String(record.detectedDateTime).slice(0, 16)}</p>
            <p className="sm:col-span-2">{record.alertMessage}</p>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="timeline">
          <AlertTimeline entries={record.timeline || []} />
        </TabsContent>

        <TabsContent value="actions" className="space-y-4">
          {!isClosed && canAck && record.alertStatus === 'Open' && (
            <Button onClick={async () => {
              const { error } = await acknowledgeCpvAlert(record.id, actor, record);
              if (error) return toast.error(error);
              toast.success('Acknowledged');
              await load();
            }}>Acknowledge</Button>
          )}
          {canManage && !isClosed && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div><Label>Assign To</Label><Input className="mt-1" value={assignTo} onChange={(e) => setAssignTo(e.target.value)} />
                <Button className="mt-2" size="sm" onClick={async () => {
                  const { error } = await assignCpvAlert(record.id, assignTo, record.assignedRole || 'qa', actor, record);
                  if (error) return toast.error(error);
                  toast.success('Assigned');
                  await load();
                }}>Assign</Button></div>
              <div><Label>Link Deviation</Label><div className="mt-1 flex gap-2">
                <Input value={deviationLink} onChange={(e) => setDeviationLink(e.target.value)} />
                <Button size="sm" onClick={async () => {
                  await linkCpvAlert(record.id, 'linkedDeviationNumber', deviationLink, actor, record);
                  toast.success('Linked');
                  await load();
                }}>Link</Button></div></div>
              <div><Label>Link CAPA</Label><div className="mt-1 flex gap-2">
                <Input value={capaLink} onChange={(e) => setCapaLink(e.target.value)} />
                <Button size="sm" onClick={async () => {
                  await linkCpvAlert(record.id, 'linkedCapaNumber', capaLink, actor, record);
                  toast.success('Linked');
                  await load();
                }}>Link</Button></div></div>
              <div className="sm:col-span-2"><Label>Closure Remarks *</Label>
                <Textarea className="mt-1" value={closureRemarks} onChange={(e) => setClosureRemarks(e.target.value)} rows={2} />
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button onClick={async () => {
                    const { error } = await closeCpvAlert(record.id, closureRemarks, actor, record);
                    if (error) return toast.error(error);
                    toast.success('Closed');
                    await load();
                  }}>Close Alert</Button>
                  <Button variant="outline" onClick={async () => {
                    await escalateCpvAlert(record.id, actor, record);
                    toast.success('Escalated');
                    await load();
                  }}>Escalate</Button>
                  <Button variant="destructive" onClick={async () => {
                    await rejectCpvAlert(record.id, closureRemarks || 'Rejected', actor, record);
                    toast.success('Rejected');
                    await load();
                  }}>Reject</Button>
                </div></div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="audit">
          <Card><CardContent className="pt-6">
            {audit.length ? (
              <Table>
                <TableHeader><TableRow><TableHead>Action</TableHead><TableHead>User</TableHead><TableHead>When</TableHead></TableRow></TableHeader>
                <TableBody>
                  {audit.map((row) => (
                    <TableRow key={String(row.id)}>
                      <TableCell>{String(row.action || row.actionType || '')}</TableCell>
                      <TableCell>{String(row.userName || row.userId || '')}</TableCell>
                      <TableCell>{String(row.createdAt || row.timestamp || '')}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : <p className="text-sm text-muted-foreground">No audit entries.</p>}
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
