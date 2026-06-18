'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  ArrowLeft, Bell, Download, FileSpreadsheet, Loader2, RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/auth-context';
import {
  addRecallDistributionRecord,
  closeRecoveryRecord,
  exportRecoveryReport,
  fetchRecallRecoveryPageData,
  markCustomerNotified,
  upsertRecallRecoveryRecord,
} from '@/services/recallRecoveryService';
import {
  distributionSchema,
  recoveryTrackingSchema,
  RECALL_RECOVERY_STATUSES,
  type DistributionInput,
  type RecoveryTrackingInput,
} from '@/lib/recall-schemas';
import {
  canAddRecallDistribution,
  canAllowClosureReview,
  canReviewRecallRecovery,
  canUpdateRecallRecovery,
  canViewRegulatoryRecovery,
  isRecallRecoveryReadOnly,
  type RecallDistribution,
  type RecallRecovery,
} from '@/lib/recall-types';
import { mapRecoveryAuditAction } from '@/lib/recall-recovery-records';
import { CpvPageHeader } from '@/components/cpv/product-master/cpv-page-header';
import { KpiCard } from '@/components/admin/dashboard/kpi-card';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { RecallRecoveryAccessGuard } from './recall-recovery-access-guard';
import {
  FollowUpBadge, NotificationBadge, RecoveryProgressBar, RecoveryStatusBadge,
} from './recall-recovery-badges';
import { MarketRecoveryChart, RecallRecoveryTrendChart } from './recall-recovery-charts';
import { RecallStatusBadge, ClassificationBadge } from '@/components/recall/recall-sub-nav';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';

export function RecallRecoveryPage({ recallId }: { recallId: string }) {
  const searchParams = useSearchParams();
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState(searchParams.get('tab') || 'distribution');
  const [data, setData] = useState<Awaited<ReturnType<typeof fetchRecallRecoveryPageData>>>(null);
  const [marketFilter, setMarketFilter] = useState('all');
  const [customerFilter, setCustomerFilter] = useState('');
  const [editingRecoveryId, setEditingRecoveryId] = useState<string | null>(null);

  const actor = useMemo(() => ({
    id: user?.uid || 'system',
    name: profile?.full_name || profile?.email || 'User',
    role: profile?.role || 'viewer',
  }), [user?.uid, profile?.full_name, profile?.email, profile?.role]);

  const readOnly = isRecallRecoveryReadOnly(actor.role);
  const canAddDist = canAddRecallDistribution(actor.role) && !readOnly;
  const canUpdateRec = canUpdateRecallRecovery(actor.role) && !readOnly;
  const canReview = canReviewRecallRecovery(actor.role);
  const canViewRegulatory = canViewRegulatoryRecovery(actor.role);

  const distForm = useForm<DistributionInput>({
    resolver: zodResolver(distributionSchema),
    defaultValues: {
      customer_name: '',
      market_region: '',
      invoice_number: '',
      dispatch_date: new Date().toISOString().split('T')[0],
      quantity_distributed: 1,
      unit: 'Units',
      contact_person: '',
      contact_email: '',
      contact_phone: '',
      notification_sent: false,
      notification_date: null,
      recovery_required: true,
      remarks: '',
    },
  });

  const recForm = useForm<RecoveryTrackingInput>({
    resolver: zodResolver(recoveryTrackingSchema),
    defaultValues: {
      distribution_id: null,
      customer_name: '',
      market_region: '',
      distributed_quantity: 1,
      quantity_recovered: 0,
      recovery_date: '',
      recovered_by_name: profile?.full_name || '',
      recovery_status: 'Pending',
      reason_for_pending: '',
      follow_up_required: false,
      follow_up_date: null,
      remarks: '',
    },
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchRecallRecoveryPageData(recallId);
      if (!result) throw new Error('Recall not found');
      setData(result);
      distForm.setValue('market_region', result.recall.market_region);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load recovery data');
    } finally {
      setLoading(false);
    }
  }, [recallId, distForm]);

  useEffect(() => { void load(); }, [load]);

  const filteredRecoveries = useMemo(() => {
    if (!data) return [];
    return data.recoveries.filter((r) => {
      if (marketFilter !== 'all' && r.market_region !== marketFilter) return false;
      if (customerFilter && !r.customer_name.toLowerCase().includes(customerFilter.toLowerCase())) return false;
      return true;
    });
  }, [data, marketFilter, customerFilter]);

  const markets = useMemo(() => {
    if (!data) return [];
    return Array.from(new Set([
      ...data.distributions.map((d) => d.market_region),
      ...data.recoveries.map((r) => r.market_region),
    ].filter(Boolean)));
  }, [data]);

  const closureReady = data ? canAllowClosureReview(data.recall, data.recoveries) : false;

  const fillRecoveryFromDistribution = (d: RecallDistribution) => {
    setEditingRecoveryId(null);
    recForm.reset({
      distribution_id: d.id,
      customer_name: d.customer_name,
      market_region: d.market_region,
      distributed_quantity: d.quantity_distributed,
      quantity_recovered: 0,
      recovery_date: '',
      recovered_by_name: actor.name,
      recovery_status: 'Pending',
      reason_for_pending: '',
      follow_up_required: false,
      follow_up_date: null,
      remarks: '',
    });
    setTab('recovery');
  };

  const fillRecoveryForEdit = (r: RecallRecovery) => {
    setEditingRecoveryId(r.id);
    recForm.reset({
      distribution_id: r.distribution_id || null,
      customer_name: r.customer_name || r.recovered_from || '',
      market_region: r.market_region,
      distributed_quantity: r.distributed_quantity,
      quantity_recovered: r.quantity_recovered,
      recovery_date: r.recovery_date,
      recovered_by_name: r.recovered_by_name || actor.name,
      recovery_status: r.recovery_status,
      reason_for_pending: r.reason_for_pending || '',
      follow_up_required: r.follow_up_required ?? false,
      follow_up_date: r.follow_up_date || null,
      remarks: r.remarks || '',
    });
    setTab('recovery');
  };

  const handleDistSubmit = async (input: DistributionInput) => {
    try {
      setBusy(true);
      await addRecallDistributionRecord(recallId, input, actor);
      toast.success('Distribution record added');
      distForm.reset({
        customer_name: '',
        market_region: data?.recall.market_region || '',
        invoice_number: '',
        dispatch_date: new Date().toISOString().split('T')[0],
        quantity_distributed: 1,
        unit: 'Units',
        contact_person: '',
        contact_email: '',
        contact_phone: '',
        notification_sent: false,
        notification_date: null,
        recovery_required: true,
        remarks: '',
      });
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to add distribution');
    } finally {
      setBusy(false);
    }
  };

  const handleRecSubmit = async (input: RecoveryTrackingInput) => {
    try {
      setBusy(true);
      await upsertRecallRecoveryRecord(recallId, input, actor, editingRecoveryId || undefined);
      toast.success(editingRecoveryId ? 'Recovery updated' : 'Recovery record saved');
      setEditingRecoveryId(null);
      recForm.reset({
        distribution_id: null,
        customer_name: '',
        market_region: data?.recall.market_region || '',
        distributed_quantity: 1,
        quantity_recovered: 0,
        recovery_date: '',
        recovered_by_name: actor.name,
        recovery_status: 'Pending',
        reason_for_pending: '',
        follow_up_required: false,
        follow_up_date: null,
        remarks: '',
      });
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save recovery');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <RecallRecoveryAccessGuard>
        <LoadingSkeleton rows={8} />
      </RecallRecoveryAccessGuard>
    );
  }

  if (error || !data) {
    return (
      <RecallRecoveryAccessGuard>
        <ErrorCard title="Error" message={error || 'Recall not found'} onRetry={load} />
      </RecallRecoveryAccessGuard>
    );
  }

  const { recall, distributions, recoveries, auditLogs, metrics, customerRows, marketRows, trend } = data;

  return (
    <RecallRecoveryAccessGuard>
      <CpvPageHeader
        title="Recall Recovery & Distribution"
        description="Track product distribution, customer-wise recovery, and recall effectiveness"
        trail={[
          { label: 'QMS', href: '/dashboard' },
          { label: 'Product Recall', href: '/qms/recall' },
          { label: recall.recall_number, href: `/qms/recall/${recallId}` },
          { label: 'Recovery & Distribution' },
        ]}
        actions={(
          <>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/qms/recall/${recallId}`}><ArrowLeft className="h-4 w-4 mr-1" />Recall Detail</Link>
            </Button>
            <Button variant="outline" size="sm" onClick={() => void load()} disabled={busy}>
              <RefreshCw className="h-4 w-4 mr-1" />Refresh
            </Button>
            <Button variant="outline" size="sm" disabled={busy || readOnly} onClick={async () => {
              try { setBusy(true); await exportRecoveryReport(recallId, actor); toast.success('Report exported'); await load(); }
              catch (e) { toast.error(e instanceof Error ? e.message : 'Export failed'); }
              finally { setBusy(false); }
            }}>
              <Download className="h-4 w-4 mr-1" />Export Report
            </Button>
          </>
        )}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <RecallStatusBadge status={recall.recall_status} />
        <ClassificationBadge value={recall.recall_classification} />
        <span className="text-sm text-muted-foreground">{recall.product_name} · Batch {recall.batch_number}</span>
      </div>

      <RecoveryProgressBar percent={metrics.averageRecoveryPercent} className="mb-6" />

      {closureReady && canReview && (
        <Alert className="mb-4 border-green-200 bg-green-50">
          <AlertTitle>Closure review eligible</AlertTitle>
          <AlertDescription>
            Recovery target met or all customers accounted for. Recall may proceed to closure review.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3 mb-6">
        <KpiCard label="Total Distributed" value={metrics.totalDistributed} accent="border-l-blue-600" />
        <KpiCard label="Total Recovered" value={metrics.totalRecovered} accent="border-l-green-600" />
        <KpiCard label="Total Pending" value={metrics.totalPending} accent="border-l-amber-600" />
        <KpiCard label="Avg Recovery %" value={`${metrics.averageRecoveryPercent}%`} accent="border-l-purple-600" />
        <KpiCard label="Customers Notified" value={metrics.customersNotified} accent="border-l-indigo-600" />
        <KpiCard label="Pending Response" value={metrics.customersPendingResponse} accent="border-l-orange-600" />
        <KpiCard label="Follow Ups Due" value={metrics.followUpsDue} accent="border-l-cyan-600" />
        <KpiCard label="Overdue Follow Ups" value={metrics.overdueFollowUps} accent="border-l-red-600" />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex h-auto flex-wrap w-full justify-start">
          {['distribution', 'recovery', 'followup', 'summary', 'audit'].map((t) => (
            <TabsTrigger key={t} value={t} className="capitalize">
              {t === 'followup' ? 'Follow Up' : t === 'audit' ? 'Audit Trail' : t === 'summary' ? 'Recovery Summary' : t === 'recovery' ? 'Recovery Tracking' : 'Distribution'}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="distribution" className="mt-4 space-y-4">
          {canAddDist && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Add Distribution Record</CardTitle>
                <CardDescription>Capture market, customer and dispatch details for recalled product</CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...distForm}>
                  <form onSubmit={distForm.handleSubmit(handleDistSubmit)} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <FormField control={distForm.control} name="customer_name" render={({ field }) => (
                      <FormItem><FormLabel>Customer / Distributor *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={distForm.control} name="market_region" render={({ field }) => (
                      <FormItem><FormLabel>Market / Region *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={distForm.control} name="invoice_number" render={({ field }) => (
                      <FormItem><FormLabel>Invoice Number</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                    )} />
                    <FormField control={distForm.control} name="dispatch_date" render={({ field }) => (
                      <FormItem><FormLabel>Dispatch Date *</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={distForm.control} name="quantity_distributed" render={({ field }) => (
                      <FormItem><FormLabel>Distributed Quantity *</FormLabel><FormControl><Input type="number" min={1} {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={distForm.control} name="unit" render={({ field }) => (
                      <FormItem><FormLabel>Unit</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                    )} />
                    <FormField control={distForm.control} name="contact_person" render={({ field }) => (
                      <FormItem><FormLabel>Contact Person</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                    )} />
                    <FormField control={distForm.control} name="contact_email" render={({ field }) => (
                      <FormItem><FormLabel>Contact Email</FormLabel><FormControl><Input type="email" {...field} /></FormControl></FormItem>
                    )} />
                    <FormField control={distForm.control} name="contact_phone" render={({ field }) => (
                      <FormItem><FormLabel>Contact Phone</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                    )} />
                    <FormField control={distForm.control} name="notification_sent" render={({ field }) => (
                      <FormItem className="flex items-center gap-2 pt-8">
                        <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                        <FormLabel className="!mt-0">Notification Sent</FormLabel>
                      </FormItem>
                    )} />
                    <FormField control={distForm.control} name="remarks" render={({ field }) => (
                      <FormItem className="md:col-span-2 lg:col-span-3"><FormLabel>Remarks</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl></FormItem>
                    )} />
                    <div className="md:col-span-2 lg:col-span-3 flex gap-2">
                      <Button type="submit" disabled={busy}>{busy && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Add Distribution</Button>
                      <Button type="button" variant="outline" disabled className="gap-1"><FileSpreadsheet className="h-4 w-4" />Import from Excel (placeholder)</Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader><CardTitle className="text-base">Distribution List</CardTitle></CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Market</TableHead>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Dispatch</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>Notified</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {distributions.length === 0 ? (
                    <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No distribution records</TableCell></TableRow>
                  ) : distributions.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="font-mono text-xs">{d.distribution_id || d.id.slice(0, 8)}</TableCell>
                      <TableCell>{d.customer_name}</TableCell>
                      <TableCell>{d.market_region}</TableCell>
                      <TableCell>{d.invoice_number || '—'}</TableCell>
                      <TableCell>{d.dispatch_date || d.distribution_date}</TableCell>
                      <TableCell>{d.quantity_distributed} {d.unit || 'Units'}</TableCell>
                      <TableCell><NotificationBadge sent={d.notification_sent} /></TableCell>
                      <TableCell className="text-right space-x-2">
                        {!d.notification_sent && canAddDist && (
                          <Button size="sm" variant="outline" disabled={busy} onClick={async () => {
                            try { setBusy(true); await markCustomerNotified(recallId, d.id, actor); toast.success('Customer marked notified'); await load(); }
                            catch (e) { toast.error(e instanceof Error ? e.message : 'Failed'); }
                            finally { setBusy(false); }
                          }}>
                            <Bell className="h-3.5 w-3.5 mr-1" />Notify
                          </Button>
                        )}
                        {canUpdateRec && (
                          <Button size="sm" variant="ghost" onClick={() => fillRecoveryFromDistribution(d)}>Track Recovery</Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recovery" className="mt-4 space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <Select value={marketFilter} onValueChange={setMarketFilter}>
              <SelectTrigger className="w-full sm:w-[200px]"><SelectValue placeholder="Market filter" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All markets</SelectItem>
                {markets.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input placeholder="Filter by customer..." value={customerFilter} onChange={(e) => setCustomerFilter(e.target.value)} className="max-w-xs" />
          </div>

          {canUpdateRec && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{editingRecoveryId ? 'Update Recovery' : 'Add Recovery Record'}</CardTitle>
              </CardHeader>
              <CardContent>
                <Form {...recForm}>
                  <form onSubmit={recForm.handleSubmit(handleRecSubmit, (errs) => {
                    Object.values(errs).forEach((e) => toast.error(String(e?.message || 'Validation error')));
                  })} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <FormField control={recForm.control} name="customer_name" render={({ field }) => (
                      <FormItem><FormLabel>Customer / Distributor *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={recForm.control} name="market_region" render={({ field }) => (
                      <FormItem><FormLabel>Market / Region *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={recForm.control} name="distributed_quantity" render={({ field }) => (
                      <FormItem><FormLabel>Distributed Qty *</FormLabel><FormControl><Input type="number" min={1} {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={recForm.control} name="quantity_recovered" render={({ field }) => (
                      <FormItem><FormLabel>Recovered Qty</FormLabel><FormControl><Input type="number" min={0} {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={recForm.control} name="recovery_date" render={({ field }) => (
                      <FormItem><FormLabel>Recovery Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={recForm.control} name="recovery_status" render={({ field }) => (
                      <FormItem><FormLabel>Status</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {RECALL_RECOVERY_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )} />
                    <FormField control={recForm.control} name="reason_for_pending" render={({ field }) => (
                      <FormItem><FormLabel>Reason For Pending</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                    )} />
                    <FormField control={recForm.control} name="follow_up_required" render={({ field }) => (
                      <FormItem className="flex items-center gap-2 pt-8">
                        <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                        <FormLabel className="!mt-0">Follow Up Required</FormLabel>
                      </FormItem>
                    )} />
                    <FormField control={recForm.control} name="follow_up_date" render={({ field }) => (
                      <FormItem><FormLabel>Follow Up Date</FormLabel><FormControl><Input type="date" value={field.value || ''} onChange={field.onChange} /></FormControl></FormItem>
                    )} />
                    <FormField control={recForm.control} name="remarks" render={({ field }) => (
                      <FormItem className="md:col-span-2"><FormLabel>Remarks</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl></FormItem>
                    )} />
                    <div className="md:col-span-2 lg:col-span-3">
                      <Button type="submit" disabled={busy}>{busy && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}{editingRecoveryId ? 'Update Recovery' : 'Save Recovery'}</Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader><CardTitle className="text-base">Customer-wise Recovery</CardTitle></CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Market</TableHead>
                    <TableHead>Distributed</TableHead>
                    <TableHead>Recovered</TableHead>
                    <TableHead>Pending</TableHead>
                    <TableHead>Recovery %</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRecoveries.length === 0 ? (
                    <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No recovery records</TableCell></TableRow>
                  ) : filteredRecoveries.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{r.customer_name || r.recovered_from}</TableCell>
                      <TableCell>{r.market_region}</TableCell>
                      <TableCell>{r.distributed_quantity}</TableCell>
                      <TableCell>{r.quantity_recovered}</TableCell>
                      <TableCell>{r.pending_quantity ?? (r.distributed_quantity - r.quantity_recovered)}</TableCell>
                      <TableCell>{r.recovery_percent ?? 0}%</TableCell>
                      <TableCell><RecoveryStatusBadge status={r.recovery_status} /></TableCell>
                      <TableCell className="text-right">
                        {canUpdateRec && (
                          <Button size="sm" variant="ghost" onClick={() => fillRecoveryForEdit(r)}>Edit</Button>
                        )}
                        {canReview && r.recovery_status !== 'Closed' && (
                          <Button size="sm" variant="outline" disabled={busy} onClick={async () => {
                            try { setBusy(true); await closeRecoveryRecord(recallId, r.id, actor); toast.success('Recovery closed'); await load(); }
                            catch (e) { toast.error(e instanceof Error ? e.message : 'Failed'); }
                            finally { setBusy(false); }
                          }}>Close</Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="followup" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Follow Up Tracking</CardTitle></CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Market</TableHead>
                    <TableHead>Pending Qty</TableHead>
                    <TableHead>Follow Up</TableHead>
                    <TableHead>Follow Up Date</TableHead>
                    <TableHead>Reason</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recoveries.filter((r) => r.follow_up_required || (r.pending_quantity ?? 0) > 0).length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No follow-ups required</TableCell></TableRow>
                  ) : recoveries.filter((r) => r.follow_up_required || (r.pending_quantity ?? 0) > 0).map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{r.customer_name}</TableCell>
                      <TableCell>{r.market_region}</TableCell>
                      <TableCell>{r.pending_quantity}</TableCell>
                      <TableCell><FollowUpBadge required={r.follow_up_required} date={r.follow_up_date} /></TableCell>
                      <TableCell>{r.follow_up_date || '—'}</TableCell>
                      <TableCell>{r.reason_for_pending || '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="summary" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <RecallRecoveryTrendChart data={trend} />
            {canViewRegulatory && <MarketRecoveryChart data={marketRows} />}
          </div>
          <Card>
            <CardHeader><CardTitle className="text-base">Recovery Summary by Customer</CardTitle></CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Market</TableHead>
                    <TableHead>Distributed</TableHead>
                    <TableHead>Recovered</TableHead>
                    <TableHead>Pending</TableHead>
                    <TableHead>Recovery %</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customerRows.map((row, i) => (
                    <TableRow key={`${row.customer_name}-${i}`}>
                      <TableCell>{row.customer_name}</TableCell>
                      <TableCell>{row.market_region}</TableCell>
                      <TableCell>{row.distributed_quantity}</TableCell>
                      <TableCell>{row.quantity_recovered}</TableCell>
                      <TableCell>{row.pending_quantity}</TableCell>
                      <TableCell>{row.recovery_percent}%</TableCell>
                      <TableCell><RecoveryStatusBadge status={row.recovery_status} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
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
                      <TableCell>{mapRecoveryAuditAction(String(log.actionType || log.action || ''))}</TableCell>
                      <TableCell className="max-w-md truncate">{String(log.actionDescription || log.reason || '')}</TableCell>
                      <TableCell>{String(log.userName || (log.user as { name?: string } | undefined)?.name || '')}</TableCell>
                      <TableCell>{String(log.timestamp || log.dateTime || log.created_at || '')}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </RecallRecoveryAccessGuard>
  );
}
