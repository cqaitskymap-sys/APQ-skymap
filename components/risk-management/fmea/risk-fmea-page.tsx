'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Plus, Save, Send, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/auth-context';
import {
  addFmeaRow,
  approveFmea,
  closeFmea,
  fetchFmeaPageData,
  rejectFmea,
  removeFmeaRow,
  saveFmeaDraft,
  submitFmeaForReview,
  updateFmeaRow,
} from '@/lib/risk-fmea-service';
import { fmeaHeaderSchema } from '@/lib/risk-fmea-schemas';
import { buildSeedFmeaRow, canApproveRiskFmea, canEditRiskFmea, isRiskFmeaReadOnly, type FmeaRow, type RiskFmeaHeaderInput, type RiskFmeaRecord } from '@/lib/risk-fmea-records';
import type { RiskAssessmentRecord } from '@/lib/cpv-risk-assessment-records';
import { CpvPageHeader } from '@/components/cpv/product-master/cpv-page-header';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { RiskFmeaAccessGuard } from './risk-fmea-access-guard';
import { FmeaStatusBadge, RpnBadge } from './risk-fmea-badges';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

function matrixBucket(rows: FmeaRow[]) {
  const matrix = Array.from({ length: 10 }, (_, s) => Array.from({ length: 10 }, (_, o) => ({
    severity: 10 - s,
    occurrence: o + 1,
    count: 0,
    maxRpn: 0,
  })));
  rows.forEach((r) => {
    const sev = Math.max(1, Math.min(10, r.severity));
    const occ = Math.max(1, Math.min(10, r.occurrence));
    const cell = matrix[10 - sev][occ - 1];
    cell.count += 1;
    cell.maxRpn = Math.max(cell.maxRpn, r.rpn);
  });
  return matrix;
}

export function RiskFmeaPage({ riskAssessmentId }: { riskAssessmentId: string }) {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [risk, setRisk] = useState<RiskAssessmentRecord | null>(null);
  const [fmea, setFmea] = useState<RiskFmeaRecord | null>(null);
  const [rows, setRows] = useState<FmeaRow[]>([]);
  const [selectedRow, setSelectedRow] = useState<FmeaRow | null>(null);
  const [auditLogs, setAuditLogs] = useState<Record<string, unknown>[]>([]);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const actor = useMemo(() => ({
    id: user?.uid || 'system',
    name: profile?.full_name || profile?.email || 'User',
    role: profile?.role,
    email: profile?.email,
  }), [user?.uid, profile?.full_name, profile?.email, profile?.role]);

  const form = useForm<RiskFmeaHeaderInput>({
    resolver: zodResolver(fmeaHeaderSchema),
    defaultValues: {
      fmea_title: '',
      department: '',
      product: '',
      process_area: '',
      assessment_date: new Date().toISOString().slice(0, 10),
      facilitator: actor.name,
      team_members: [actor.name],
      review_date: new Date().toISOString().slice(0, 10),
      status: 'Draft',
    },
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const data = await fetchFmeaPageData(riskAssessmentId, actor.name);
    if (data.error || !('risk' in data) || !data.risk) {
      setError(data.error || 'Not found');
      setLoading(false);
      return;
    }
    setRisk(data.risk);
    setFmea(data.fmea || null);
    setRows(data.defaultRows || []);
    setAuditLogs(data.auditLogs || []);
    form.reset(data.defaultHeader);
    setLoading(false);
  }, [riskAssessmentId, actor.name, form]);

  useEffect(() => { void load(); }, [load]);

  const readOnly = isRiskFmeaReadOnly(profile?.role);
  const canEdit = canEditRiskFmea(profile?.role) && !readOnly;
  const canApprove = canApproveRiskFmea(profile?.role) && !readOnly;

  const highestRpn = rows.length ? Math.max(...rows.map((r) => r.rpn || 0)) : 0;

  const handleSaveDraft = form.handleSubmit(async (header) => {
    setSaving(true);
    try {
      const saved = await saveFmeaDraft(riskAssessmentId, header, rows, actor);
      setFmea(saved);
      toast.success('FMEA draft saved');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  });

  const handleSubmit = form.handleSubmit(async (header) => {
    setSaving(true);
    try {
      const saved = await submitFmeaForReview(riskAssessmentId, header, rows, actor);
      setFmea(saved);
      toast.success('FMEA submitted for review');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Submit failed');
    } finally {
      setSaving(false);
    }
  });

  const handleApprove = async () => {
    setSaving(true);
    try {
      await approveFmea(riskAssessmentId, actor);
      toast.success('FMEA approved');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Approval failed');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = async () => {
    setSaving(true);
    try {
      await closeFmea(riskAssessmentId, actor);
      toast.success('FMEA closed');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Close failed');
    } finally {
      setSaving(false);
    }
  };

  const handleReject = async () => {
    setSaving(true);
    try {
      await rejectFmea(riskAssessmentId, rejectReason, actor);
      toast.success('FMEA rejected');
      setRejectOpen(false);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Reject failed');
    } finally {
      setSaving(false);
    }
  };

  const upsertRowLocally = (row: FmeaRow) => {
    setRows((prev) => {
      const idx = prev.findIndex((r) => r.failure_mode_id === row.failure_mode_id);
      if (idx === -1) return [...prev, row];
      const copy = [...prev];
      copy[idx] = row;
      return copy;
    });
  };

  const handleAddRow = async () => {
    if (!risk) return;
    const row = buildSeedFmeaRow(risk);
    if (fmea?.id) {
      try {
        const updated = await addFmeaRow(riskAssessmentId, row, actor);
        setRows(updated.rows || []);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Failed to add row');
      }
      return;
    }
    upsertRowLocally(row);
  };

  const handleSaveRow = async () => {
    if (!selectedRow) return;
    if (fmea?.id) {
      try {
        const updated = await updateFmeaRow(riskAssessmentId, selectedRow, actor);
        setRows(updated.rows || []);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Failed to update row');
      }
      return;
    }
    upsertRowLocally(selectedRow);
  };

  const handleRemoveRow = async (failureModeId: string) => {
    if (fmea?.id) {
      try {
        const updated = await removeFmeaRow(riskAssessmentId, failureModeId, actor);
        setRows(updated.rows || []);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Failed to remove row');
      }
      return;
    }
    setRows((prev) => prev.filter((r) => r.failure_mode_id !== failureModeId));
  };

  if (loading) return <LoadingSkeleton rows={4} />;
  if (error || !risk) return <ErrorCard title="Unable to load FMEA" message={error || 'Not found'} onRetry={load} />;

  return (
    <RiskFmeaAccessGuard>
      <div className="space-y-6">
        <div className="flex items-start gap-3">
          <Link href="/qms/risk-management/fmea">
            <Button variant="ghost" size="sm" className="gap-1 mt-1"><ArrowLeft className="h-4 w-4" />Back</Button>
          </Link>
          <div className="flex-1">
            <CpvPageHeader
              title="FMEA Risk Assessment"
              description={`${risk.riskNumber} — ${risk.parameterName || risk.riskDescription.slice(0, 80)}`}
              trail={[
                { label: 'Dashboard', href: '/dashboard' },
                { label: 'QMS', href: '/qms/risk-management/audit-trail' },
                { label: 'FMEA Assessment', href: '/qms/risk-management/fmea' },
                { label: risk.riskNumber },
              ]}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <RpnBadge rpn={highestRpn} />
          <FmeaStatusBadge status={fmea?.status || form.getValues('status')} />
        </div>

        <Tabs defaultValue="worksheet">
          <TabsList className="flex flex-wrap h-auto gap-1">
            <TabsTrigger value="worksheet">FMEA Worksheet</TabsTrigger>
            <TabsTrigger value="ranking">Risk Ranking</TabsTrigger>
            <TabsTrigger value="matrix">Risk Matrix</TabsTrigger>
            <TabsTrigger value="heatmap">Heat Map</TabsTrigger>
            <TabsTrigger value="mitigation">Mitigation Plan</TabsTrigger>
            <TabsTrigger value="residual">Residual Risk</TabsTrigger>
            <TabsTrigger value="approval">Approval</TabsTrigger>
            <TabsTrigger value="audit">Audit Trail</TabsTrigger>
          </TabsList>

          <TabsContent value="worksheet" className="mt-4 space-y-4">
            <Form {...form}>
              <form className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-3">
                  <FormField control={form.control} name="fmea_title" render={({ field }) => (
                    <FormItem><FormLabel>FMEA Title</FormLabel><FormControl><Input {...field} disabled={readOnly} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="department" render={({ field }) => (
                    <FormItem><FormLabel>Department</FormLabel><FormControl><Input {...field} disabled={readOnly} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="product" render={({ field }) => (
                    <FormItem><FormLabel>Product</FormLabel><FormControl><Input {...field} disabled={readOnly} /></FormControl></FormItem>
                  )} />
                  <FormField control={form.control} name="process_area" render={({ field }) => (
                    <FormItem><FormLabel>Process Area</FormLabel><FormControl><Input {...field} disabled={readOnly} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
              </form>
            </Form>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Failure Modes</CardTitle>
                {canEdit ? (
                  <Button size="sm" variant="outline" onClick={handleAddRow}><Plus className="h-4 w-4 mr-1" />Add Row</Button>
                ) : null}
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Failure Mode</TableHead>
                      <TableHead>S</TableHead>
                      <TableHead>O</TableHead>
                      <TableHead>D</TableHead>
                      <TableHead>RPN</TableHead>
                      <TableHead>Residual</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r) => (
                      <TableRow key={r.failure_mode_id} onClick={() => setSelectedRow(r)} className="cursor-pointer">
                        <TableCell className="max-w-xs truncate">{r.failure_mode}</TableCell>
                        <TableCell>{r.severity}</TableCell>
                        <TableCell>{r.occurrence}</TableCell>
                        <TableCell>{r.detection}</TableCell>
                        <TableCell><RpnBadge rpn={r.rpn} /></TableCell>
                        <TableCell><RpnBadge rpn={r.residual_rpn} /></TableCell>
                        <TableCell>{r.status}</TableCell>
                        <TableCell>
                          {canEdit ? (
                            <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); void handleRemoveRow(r.failure_mode_id); }}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          ) : null}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="ranking" className="mt-4">
            <Card><CardHeader><CardTitle className="text-base">Risk Ranking</CardTitle></CardHeader><CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Failure Mode</TableHead><TableHead>RPN</TableHead><TableHead>Residual RPN</TableHead><TableHead>Priority</TableHead><TableHead>Mitigation</TableHead></TableRow></TableHeader>
                <TableBody>
                  {[...rows].sort((a, b) => b.rpn - a.rpn).map((r) => (
                    <TableRow key={r.failure_mode_id}>
                      <TableCell>{r.failure_mode}</TableCell>
                      <TableCell>{r.rpn}</TableCell>
                      <TableCell>{r.residual_rpn}</TableCell>
                      <TableCell>{r.risk_priority}</TableCell>
                      <TableCell>{r.mitigation_required ? 'Required' : 'Not Required'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="matrix" className="mt-4"><Card><CardHeader><CardTitle className="text-base">Risk Matrix</CardTitle></CardHeader><CardContent>
            <div className="overflow-auto">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr>
                    <th className="border p-1 bg-muted text-left">S \\ O</th>
                    {Array.from({ length: 10 }, (_, i) => (
                      <th key={i} className="border p-1 bg-muted">{i + 1}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {matrixBucket(rows).map((row) => (
                    <tr key={row[0].severity}>
                      <td className="border p-1 bg-muted font-medium">{row[0].severity}</td>
                      {row.map((cell) => (
                        <td key={`${cell.severity}-${cell.occurrence}`} className="border p-1 text-center">
                          {cell.count ? `${cell.count} (${cell.maxRpn})` : '—'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent></Card></TabsContent>

          <TabsContent value="heatmap" className="mt-4"><Card><CardHeader><CardTitle className="text-base">Heat Map</CardTitle></CardHeader><CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-2">
              {[...rows]
                .sort((a, b) => b.rpn - a.rpn)
                .slice(0, 20)
                .map((r) => {
                  const tone = r.rpn >= 201 ? 'bg-red-100 border-red-300'
                    : r.rpn >= 101 ? 'bg-orange-100 border-orange-300'
                      : r.rpn >= 51 ? 'bg-amber-100 border-amber-300'
                        : 'bg-green-100 border-green-300';
                  return (
                    <div key={r.failure_mode_id} className={`rounded border p-2 ${tone}`}>
                      <p className="font-medium text-xs line-clamp-1">{r.failure_mode}</p>
                      <p className="text-xs mt-1">RPN: {r.rpn}</p>
                      <p className="text-xs">Residual: {r.residual_rpn}</p>
                    </div>
                  );
                })}
            </div>
          </CardContent></Card></TabsContent>

          <TabsContent value="mitigation" className="mt-4"><Card><CardHeader><CardTitle className="text-base">Mitigation Plan</CardTitle></CardHeader><CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Failure Mode</TableHead><TableHead>Mitigation Required</TableHead><TableHead>Action</TableHead><TableHead>Owner</TableHead><TableHead>Target</TableHead></TableRow></TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.failure_mode_id}>
                    <TableCell>{r.failure_mode}</TableCell>
                    <TableCell>{r.mitigation_required ? 'Yes' : 'No'}</TableCell>
                    <TableCell className="max-w-xs truncate">{r.mitigation_action || '—'}</TableCell>
                    <TableCell>{r.action_owner || '—'}</TableCell>
                    <TableCell>{r.target_date || '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card></TabsContent>

          <TabsContent value="residual" className="mt-4"><Card><CardHeader><CardTitle className="text-base">Residual Risk</CardTitle></CardHeader><CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Failure Mode</TableHead><TableHead>Residual RPN</TableHead><TableHead>Residual Priority</TableHead></TableRow></TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.failure_mode_id}><TableCell>{r.failure_mode}</TableCell><TableCell>{r.residual_rpn}</TableCell><TableCell>{r.residual_risk_priority}</TableCell></TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card></TabsContent>

          <TabsContent value="approval" className="mt-4">
            <Card><CardHeader><CardTitle className="text-base">Approval</CardTitle></CardHeader><CardContent className="flex flex-wrap gap-2">
              {canEdit ? (
                <>
                  <Button variant="outline" onClick={handleSaveDraft}><Save className="h-4 w-4 mr-1" />Save Draft</Button>
                  <Button variant="outline" onClick={handleSubmit}><Send className="h-4 w-4 mr-1" />Submit for Review</Button>
                </>
              ) : null}
              {canApprove ? (
                <>
                  <Button onClick={() => void handleApprove()}>Approve</Button>
                  <Button variant="destructive" onClick={() => setRejectOpen(true)}>Reject</Button>
                  <Button variant="secondary" onClick={() => void handleClose()}>Close</Button>
                </>
              ) : null}
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="audit" className="mt-4"><Card><CardHeader><CardTitle className="text-base">Audit Trail</CardTitle></CardHeader><CardContent>
            {auditLogs.length ? (
              <Table>
                <TableHeader><TableRow><TableHead>Action</TableHead><TableHead>User</TableHead><TableHead>Date</TableHead><TableHead>Detail</TableHead></TableRow></TableHeader>
                <TableBody>
                  {auditLogs.filter((l) => /fmea|failure mode|rpn|mitigation|residual|review|approved|rejected|closed/i.test(String(l.actionType || l.action || ''))).map((l) => (
                    <TableRow key={String(l.id)}>
                      <TableCell>{String(l.actionType || l.action)}</TableCell>
                      <TableCell>{String(l.userName || l.user_name || '—')}</TableCell>
                      <TableCell>{l.dateTime || l.timestamp ? new Date(String(l.dateTime || l.timestamp)).toLocaleString() : '—'}</TableCell>
                      <TableCell className="max-w-xs truncate">{String(l.actionDescription || l.reason || '')}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : <p className="text-sm text-muted-foreground">No audit entries.</p>}
          </CardContent></Card></TabsContent>
        </Tabs>

        <Dialog open={Boolean(selectedRow)} onOpenChange={(o) => { if (!o) setSelectedRow(null); }}>
          <DialogContent className="max-w-4xl">
            <DialogHeader><DialogTitle>Edit Failure Mode</DialogTitle></DialogHeader>
            {selectedRow ? (
              <div className="grid sm:grid-cols-2 gap-3">
                <Input disabled={readOnly} value={selectedRow.process_step} onChange={(e) => setSelectedRow({ ...selectedRow, process_step: e.target.value })} placeholder="Process step" />
                <Input disabled={readOnly} value={selectedRow.failure_mode} onChange={(e) => setSelectedRow({ ...selectedRow, failure_mode: e.target.value })} placeholder="Failure mode" />
                <Input disabled={readOnly} value={selectedRow.potential_effect} onChange={(e) => setSelectedRow({ ...selectedRow, potential_effect: e.target.value })} placeholder="Potential effect" />
                <Input disabled={readOnly} value={selectedRow.potential_cause} onChange={(e) => setSelectedRow({ ...selectedRow, potential_cause: e.target.value })} placeholder="Potential cause" />
                <Input disabled={readOnly} type="number" min={1} max={10} value={selectedRow.severity} onChange={(e) => setSelectedRow({ ...selectedRow, severity: Number(e.target.value || 1) })} placeholder="Severity" />
                <Input disabled={readOnly} type="number" min={1} max={10} value={selectedRow.occurrence} onChange={(e) => setSelectedRow({ ...selectedRow, occurrence: Number(e.target.value || 1) })} placeholder="Occurrence" />
                <Input disabled={readOnly} type="number" min={1} max={10} value={selectedRow.detection} onChange={(e) => setSelectedRow({ ...selectedRow, detection: Number(e.target.value || 1) })} placeholder="Detection" />
                <Input disabled={readOnly} value={selectedRow.mitigation_action} onChange={(e) => setSelectedRow({ ...selectedRow, mitigation_action: e.target.value })} placeholder="Mitigation action" />
                <Input disabled={readOnly} value={selectedRow.action_owner} onChange={(e) => setSelectedRow({ ...selectedRow, action_owner: e.target.value })} placeholder="Action owner" />
                <Input disabled={readOnly} type="date" value={selectedRow.target_date} onChange={(e) => setSelectedRow({ ...selectedRow, target_date: e.target.value })} />
                <Input disabled={readOnly} type="number" min={1} max={10} value={selectedRow.residual_severity} onChange={(e) => setSelectedRow({ ...selectedRow, residual_severity: Number(e.target.value || 1) })} placeholder="Residual severity" />
                <Input disabled={readOnly} type="number" min={1} max={10} value={selectedRow.residual_occurrence} onChange={(e) => setSelectedRow({ ...selectedRow, residual_occurrence: Number(e.target.value || 1) })} placeholder="Residual occurrence" />
                <Input disabled={readOnly} type="number" min={1} max={10} value={selectedRow.residual_detection} onChange={(e) => setSelectedRow({ ...selectedRow, residual_detection: Number(e.target.value || 1) })} placeholder="Residual detection" />
              </div>
            ) : null}
            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedRow(null)}>Cancel</Button>
              {canEdit ? <Button onClick={() => void handleSaveRow()}>Save Row</Button> : null}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Reject FMEA</DialogTitle></DialogHeader>
            <Textarea rows={3} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Reason" />
            <DialogFooter>
              <Button variant="outline" onClick={() => setRejectOpen(false)}>Cancel</Button>
              <Button variant="destructive" onClick={() => void handleReject()}>Reject</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </RiskFmeaAccessGuard>
  );
}
