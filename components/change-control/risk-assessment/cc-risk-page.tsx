'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Calculator, CheckCircle2, Loader2, Plus, Save, Send, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/auth-context';
import {
  canApproveCcRisk,
  canManageCcRisk,
  computeCcRiskScores,
  computeOverallRiskLevel,
  computeResidualRisk,
  isCcRiskReadOnly,
  isMitigationRequired,
  requiresHeadQaForResidual,
} from '@/lib/cc-risk-records';
import {
  ccRiskHeaderSchema,
  ccRiskQaReviewSchema,
  ccRiskRowSchema,
  type CcRiskHeaderInput,
  type CcRiskRowFormInput,
} from '@/lib/cc-risk-schemas';
import {
  createCcRiskRow,
  fetchCcRiskPageData,
  linkCcRiskCapa,
  saveCcRiskHeader,
  softDeleteCcRiskRow,
  submitCcRiskForReview,
  submitCcRiskQaReview,
  updateCcRiskRow,
} from '@/lib/cc-risk-service';
import {
  CC_DEPARTMENTS,
  CC_RISK_CATEGORIES,
  type ChangeControlRecord,
  type ChangeRiskAssessment,
} from '@/lib/change-control-types';
import { CpvPageHeader } from '@/components/cpv/product-master/cpv-page-header';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { CcStatusBadge } from '@/components/change-control/cc-sub-nav';
import { CcRiskAccessGuard } from './cc-risk-access-guard';
import { CcRiskCategoryBadge, CcRiskLevelBadge, CcRiskStatusBadge, CcRpnBadge } from './cc-risk-badges';
import { CcRiskMatrix } from './cc-risk-matrix';
import { CcRiskTimeline } from './cc-risk-timeline';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export function CcRiskPage({ changeId }: { changeId: string }) {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [change, setChange] = useState<ChangeControlRecord | null>(null);
  const [header, setHeader] = useState<ChangeRiskAssessment | null>(null);
  const [rows, setRows] = useState<ChangeRiskAssessment[]>([]);
  const [auditLogs, setAuditLogs] = useState<Record<string, unknown>[]>([]);
  const [rowOpen, setRowOpen] = useState(false);
  const [editRow, setEditRow] = useState<ChangeRiskAssessment | null>(null);
  const [capaRowId, setCapaRowId] = useState<string | null>(null);
  const [capaId, setCapaId] = useState('');
  const [capaNumber, setCapaNumber] = useState('');

  const actor = useMemo(() => ({
    id: user?.uid || 'system',
    name: profile?.full_name || profile?.email || 'User',
    role: profile?.role,
    department: profile?.department,
  }), [user?.uid, profile?.full_name, profile?.email, profile?.role, profile?.department]);

  const readOnly = isCcRiskReadOnly(actor.role);
  const canManage = canManageCcRisk(actor.role, header?.assessed_by, actor.id) && !readOnly;
  const canApprove = canApproveCcRisk(actor.role) && !readOnly;

  const headerForm = useForm<CcRiskHeaderInput>({
    resolver: zodResolver(ccRiskHeaderSchema),
    defaultValues: {
      change_id: changeId,
      assessment_date: new Date().toISOString().split('T')[0],
      assessed_by: user?.uid || '',
      assessed_by_name: profile?.full_name || '',
      department: (profile?.department as CcRiskHeaderInput['department']) || 'QA',
    },
  });

  const rowForm = useForm<CcRiskRowFormInput>({
    resolver: zodResolver(ccRiskRowSchema),
    defaultValues: {
      change_id: changeId,
      risk_description: '',
      risk_category: 'Other',
      severity: 1,
      occurrence: 1,
      detection: 1,
      mitigation_plan: '',
      capa_required: false,
      validation_required: false,
    },
  });

  const qaForm = useForm<{ decision: 'approved' | 'rejected'; qa_comments: string; head_qa_comments?: string }>({
    resolver: zodResolver(ccRiskQaReviewSchema),
    defaultValues: { decision: 'approved', qa_comments: '' },
  });

  const sev = rowForm.watch('severity') || 1;
  const occ = rowForm.watch('occurrence') || 1;
  const det = rowForm.watch('detection') || 1;
  const liveScores = computeCcRiskScores(sev, occ, det);
  const rSev = rowForm.watch('residual_severity');
  const rOcc = rowForm.watch('residual_occurrence');
  const rDet = rowForm.watch('residual_detection');
  const liveResidual = computeResidualRisk(rSev, rOcc, rDet);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const data = await fetchCcRiskPageData(changeId);
    if ('error' in data && data.error) {
      setError(data.error);
      setLoading(false);
      return;
    }
    if (!('change' in data) || !data.change) {
      setError('Change control not found');
      setLoading(false);
      return;
    }
    setChange(data.change);
    setHeader(data.header || null);
    setRows(data.rows || []);
    setAuditLogs(data.auditLogs || []);
    headerForm.reset({
      change_id: changeId,
      assessment_date: data.header?.assessment_date || new Date().toISOString().split('T')[0],
      assessed_by: data.header?.assessed_by || user?.uid || '',
      assessed_by_name: data.header?.assessed_by_name || profile?.full_name || '',
      department: (data.header?.department || data.change.department || profile?.department || 'QA') as CcRiskHeaderInput['department'],
    });
    setLoading(false);
  }, [changeId, headerForm, user?.uid, profile?.full_name, profile?.department]);

  useEffect(() => { void load(); }, [load]);

  const overallLevel = computeOverallRiskLevel(rows);
  const residualOverall = rows.some((r) => r.residual_risk_level)
    ? rows.filter((r) => r.residual_risk_level).sort((a, b) => (b.residual_rpn || 0) - (a.residual_rpn || 0))[0]?.residual_risk_level
    : null;

  const openAddRow = () => {
    setEditRow(null);
    rowForm.reset({
      change_id: changeId,
      risk_description: '',
      risk_category: 'Other',
      severity: 1,
      occurrence: 1,
      detection: 1,
      mitigation_plan: '',
      capa_required: false,
      validation_required: false,
    });
    setRowOpen(true);
  };

  const openEditRow = (row: ChangeRiskAssessment) => {
    setEditRow(row);
    rowForm.reset({
      change_id: changeId,
      risk_description: row.risk_description || '',
      risk_category: (row.risk_category || 'Other') as CcRiskRowFormInput['risk_category'],
      potential_failure_mode: row.potential_failure_mode || '',
      potential_impact: row.potential_impact || '',
      potential_cause: row.potential_cause || '',
      existing_controls: row.existing_controls || '',
      severity: row.severity,
      occurrence: row.occurrence,
      detection: row.detection ?? row.detectability,
      mitigation_plan: row.mitigation_plan || '',
      residual_severity: row.residual_severity,
      residual_occurrence: row.residual_occurrence,
      residual_detection: row.residual_detection,
      capa_required: row.capa_required,
      validation_required: row.validation_required,
      linked_capa_id: row.linked_capa_id,
      linked_capa_number: row.linked_capa_number || '',
    });
    setRowOpen(true);
  };

  const handleSaveHeader = async () => {
    const valid = await headerForm.trigger();
    if (!valid) return;
    setBusy(true);
    const res = await saveCcRiskHeader(headerForm.getValues(), actor);
    setBusy(false);
    if (res.error) { toast.error(res.error); return; }
    toast.success('Assessment saved');
    void load();
  };

  const handleSaveRow = async () => {
    const valid = await rowForm.trigger();
    if (!valid) return;
    setBusy(true);
    const values = rowForm.getValues();
    const res = editRow
      ? await updateCcRiskRow(editRow.id, values, actor)
      : await createCcRiskRow(values, actor);
    setBusy(false);
    if (res.error) { toast.error(res.error); return; }
    toast.success(editRow ? 'Risk updated' : 'Risk added');
    setRowOpen(false);
    void load();
  };

  const handleSubmitReview = async () => {
    setBusy(true);
    const res = await submitCcRiskForReview(changeId, actor);
    setBusy(false);
    if ('error' in res && res.error) { toast.error(res.error); return; }
    toast.success('Submitted for review');
    void load();
  };

  const handleQaReview = async () => {
    const valid = await qaForm.trigger();
    if (!valid) return;
    setBusy(true);
    const res = await submitCcRiskQaReview(changeId, qaForm.getValues(), actor);
    setBusy(false);
    if (res.error) { toast.error(res.error); return; }
    toast.success('QA review recorded');
    void load();
  };

  const handleLinkCapa = async () => {
    if (!capaRowId || !capaId.trim()) return;
    setBusy(true);
    const res = await linkCcRiskCapa(capaRowId, capaId, capaNumber, actor);
    setBusy(false);
    if (!res.ok) { toast.error(res.error); return; }
    toast.success('CAPA linked');
    setCapaRowId(null);
    void load();
  };

  if (loading) return <LoadingSkeleton rows={8} />;
  if (error || !change) return <ErrorCard message={error || 'Not found'} onRetry={() => void load()} />;

  return (
    <CcRiskAccessGuard>
      <div className="space-y-6">
        <CpvPageHeader
          title="Change Risk Assessment"
          description="Evaluate and control risks associated with proposed GMP changes"
          trail={[
            { label: 'Dashboard', href: '/dashboard' },
            { label: 'QMS', href: '/qms/change-control' },
            { label: 'Change Control', href: '/qms/change-control' },
            { label: 'Risk Assessment', href: '/qms/change-control/risk-assessment' },
            { label: change.change_control_number },
          ]}
          actions={(
            <Link href="/qms/change-control/risk-assessment">
              <Button variant="outline" size="sm"><ArrowLeft className="mr-2 h-4 w-4" />Back</Button>
            </Link>
          )}
        />

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Change Control</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-1">
              <p className="font-mono font-medium">{change.change_control_number}</p>
              <CcStatusBadge status={change.status} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Assessment Status</CardTitle></CardHeader>
            <CardContent><CcRiskStatusBadge status={header?.status} /></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Overall Risk</CardTitle></CardHeader>
            <CardContent><CcRiskLevelBadge level={overallLevel} /></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Risk Rows</CardTitle></CardHeader>
            <CardContent className="text-sm tabular-nums">{rows.length} identified</CardContent>
          </Card>
        </div>

        {requiresHeadQaForResidual(residualOverall) && (
          <Alert>
            <AlertTitle>Head QA Approval Required</AlertTitle>
            <AlertDescription>Residual risk level is High or Critical. Head QA must approve before closure.</AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue="worksheet">
          <TabsList className="flex h-auto flex-wrap">
            {['worksheet', 'matrix', 'mitigation', 'residual', 'capa', 'qa', 'audit'].map((t) => {
              const labels: Record<string, string> = {
                worksheet: 'Risk Worksheet', matrix: 'Risk Matrix', mitigation: 'Mitigation Plan',
                residual: 'Residual Risk', capa: 'CAPA Link', qa: 'QA Review', audit: 'Audit Trail',
              };
              return <TabsTrigger key={t} value={t}>{labels[t]}</TabsTrigger>;
            })}
          </TabsList>

          <TabsContent value="worksheet" className="mt-4 space-y-4">
            <Form {...headerForm}>
              <Card>
                <CardHeader><CardTitle>Assessment Header</CardTitle></CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-3">
                  <FormField control={headerForm.control} name="assessment_date" render={({ field }) => (
                    <FormItem><FormLabel>Assessment Date *</FormLabel><FormControl><Input type="date" {...field} disabled={!canManage} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={headerForm.control} name="assessed_by" render={({ field }) => (
                    <FormItem><FormLabel>Assessed By *</FormLabel><FormControl><Input {...field} disabled={!canManage} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={headerForm.control} name="department" render={({ field }) => (
                    <FormItem><FormLabel>Department</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value} disabled={!canManage}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>{CC_DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                      </Select></FormItem>
                  )} />
                </CardContent>
              </Card>
            </Form>

            {canManage && (
              <Button onClick={openAddRow}><Plus className="mr-2 h-4 w-4" />Add Risk Row</Button>
            )}

            <RiskTable rows={rows} canManage={canManage} busy={busy} onEdit={openEditRow} onDelete={async (id) => {
              setBusy(true);
              await softDeleteCcRiskRow(id, actor);
              setBusy(false);
              void load();
            }} />
          </TabsContent>

          <TabsContent value="matrix" className="mt-4">
            <Card>
              <CardHeader><CardTitle>Risk Matrix (Severity × Occurrence)</CardTitle></CardHeader>
              <CardContent><CcRiskMatrix rows={rows} /></CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="mitigation" className="mt-4">
            <RiskTable rows={rows.filter((r) => r.mitigation_required || isMitigationRequired(r.risk_level))} canManage={canManage} busy={busy} onEdit={openEditRow} showMitigation />
          </TabsContent>

          <TabsContent value="residual" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Residual Risk Summary</CardTitle>
                <CardDescription>Overall residual: <CcRiskLevelBadge level={residualOverall || '—'} /></CardDescription>
              </CardHeader>
              <CardContent>
                <RiskTable rows={rows.filter((r) => r.residual_rpn)} canManage={canManage} busy={busy} onEdit={openEditRow} showResidual />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="capa" className="mt-4 space-y-4">
            <RiskTable rows={rows.filter((r) => r.capa_required || r.linked_capa_id)} canManage={canManage} busy={busy} onEdit={openEditRow} showCapa onLinkCapa={setCapaRowId} />
            {capaRowId && canManage && (
              <Card>
                <CardHeader><CardTitle>Link CAPA</CardTitle></CardHeader>
                <CardContent className="grid gap-3 md:grid-cols-2">
                  <Input placeholder="CAPA Record ID" value={capaId} onChange={(e) => setCapaId(e.target.value)} />
                  <Input placeholder="CAPA Number" value={capaNumber} onChange={(e) => setCapaNumber(e.target.value)} />
                  <div className="md:col-span-2 flex gap-2">
                    <Button onClick={() => void handleLinkCapa()} disabled={busy}>Link CAPA</Button>
                    <Button variant="outline" onClick={() => setCapaRowId(null)}>Cancel</Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="qa" className="mt-4">
            {canApprove && header && (
              <Form {...qaForm}>
                <Card>
                  <CardHeader><CardTitle>QA Review</CardTitle><CardDescription>Approve or reject the risk assessment.</CardDescription></CardHeader>
                  <CardContent className="space-y-4">
                    <FormField control={qaForm.control} name="decision" render={({ field }) => (
                      <FormItem><FormLabel>Decision</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="approved">Approve</SelectItem>
                            <SelectItem value="rejected">Reject</SelectItem>
                          </SelectContent>
                        </Select></FormItem>
                    )} />
                    <FormField control={qaForm.control} name="qa_comments" render={({ field }) => (
                      <FormItem><FormLabel>QA Comments *</FormLabel><FormControl><Textarea rows={3} {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <Button onClick={() => void handleQaReview()} disabled={busy}>
                      {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                      Submit QA Review
                    </Button>
                  </CardContent>
                </Card>
              </Form>
            )}
          </TabsContent>

          <TabsContent value="audit" className="mt-4"><CcRiskTimeline auditLogs={auditLogs} /></TabsContent>
        </Tabs>

        {canManage && (
          <div className="flex flex-wrap gap-2 border-t pt-4">
            <Button variant="outline" onClick={() => void handleSaveHeader()} disabled={busy}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Save Header
            </Button>
            <Button variant="outline" onClick={() => void handleSubmitReview()} disabled={busy}>
              <Send className="mr-2 h-4 w-4" />Submit for Review
            </Button>
          </div>
        )}

        <Dialog open={rowOpen} onOpenChange={setRowOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editRow ? 'Edit Risk Row' : 'Add Risk Row'}</DialogTitle></DialogHeader>
            <Form {...rowForm}>
              <div className="space-y-3">
                <FormField control={rowForm.control} name="risk_description" render={({ field }) => (
                  <FormItem><FormLabel>Risk Description *</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={rowForm.control} name="risk_category" render={({ field }) => (
                  <FormItem><FormLabel>Category *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>{CC_RISK_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select><FormMessage /></FormItem>
                )} />
                <div className="grid grid-cols-3 gap-3">
                  {(['severity', 'occurrence', 'detection'] as const).map((name) => (
                    <FormField key={name} control={rowForm.control} name={name} render={({ field }) => (
                      <FormItem><FormLabel className="capitalize">{name} (1-10)</FormLabel>
                        <FormControl><Input type="number" min={1} max={10} {...field} onChange={(e) => field.onChange(Number(e.target.value))} /></FormControl>
                        <FormMessage /></FormItem>
                    )} />
                  ))}
                </div>
                <div className="flex items-center gap-2 rounded-lg border p-3 bg-slate-50">
                  <Calculator className="h-4 w-4 text-muted-foreground" />
                  <CcRpnBadge rpn={liveScores.rpn} level={liveScores.risk_level} />
                  {isMitigationRequired(liveScores.risk_level) && (
                    <span className="text-xs text-red-600 font-medium">Mitigation required</span>
                  )}
                </div>
                <FormField control={rowForm.control} name="mitigation_plan" render={({ field }) => (
                  <FormItem><FormLabel>Mitigation Plan</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <div className="grid grid-cols-3 gap-3">
                  {(['residual_severity', 'residual_occurrence', 'residual_detection'] as const).map((name) => (
                    <FormField key={name} control={rowForm.control} name={name} render={({ field }) => (
                      <FormItem><FormLabel className="text-xs capitalize">{name.replace(/_/g, ' ')}</FormLabel>
                        <FormControl><Input type="number" min={1} max={10} value={field.value ?? ''} onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)} /></FormControl>
                        <FormMessage /></FormItem>
                    )} />
                  ))}
                </div>
                {liveResidual.residual_rpn && (
                  <CcRpnBadge rpn={liveResidual.residual_rpn} level={liveResidual.residual_risk_level || undefined} />
                )}
                <FormField control={rowForm.control} name="existing_controls" render={({ field }) => (
                  <FormItem><FormLabel>Existing Controls</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl></FormItem>
                )} />
              </div>
            </Form>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRowOpen(false)}>Cancel</Button>
              <Button onClick={() => void handleSaveRow()} disabled={busy}>{editRow ? 'Update' : 'Add'} Risk</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </CcRiskAccessGuard>
  );
}

function RiskTable({
  rows, canManage, busy, onEdit, onDelete, showMitigation, showResidual, showCapa, onLinkCapa,
}: {
  rows: ChangeRiskAssessment[];
  canManage: boolean;
  busy: boolean;
  onEdit: (row: ChangeRiskAssessment) => void;
  onDelete?: (id: string) => void;
  showMitigation?: boolean;
  showResidual?: boolean;
  showCapa?: boolean;
  onLinkCapa?: (id: string) => void;
}) {
  if (!rows.length) return <p className="text-sm text-muted-foreground py-8 text-center">No risks in this view.</p>;
  return (
    <Card>
      <CardContent className="overflow-x-auto pt-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Description</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>S/O/D</TableHead>
              <TableHead>RPN</TableHead>
              <TableHead>Level</TableHead>
              {showMitigation && <TableHead>Mitigation</TableHead>}
              {showResidual && <TableHead>Residual</TableHead>}
              {showCapa && <TableHead>CAPA</TableHead>}
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="max-w-[160px] truncate font-medium">{r.risk_description || '—'}</TableCell>
                <TableCell><CcRiskCategoryBadge category={r.risk_category} /></TableCell>
                <TableCell className="text-xs tabular-nums">{r.severity}/{r.occurrence}/{r.detection ?? r.detectability}</TableCell>
                <TableCell><CcRpnBadge rpn={r.rpn} level={r.risk_level} /></TableCell>
                <TableCell><CcRiskLevelBadge level={r.risk_level} /></TableCell>
                {showMitigation && <TableCell className="max-w-[140px] truncate text-xs">{r.mitigation_plan || '—'}</TableCell>}
                {showResidual && <TableCell><CcRpnBadge rpn={r.residual_rpn ?? undefined} level={r.residual_risk_level || undefined} /></TableCell>}
                {showCapa && <TableCell className="text-xs">{r.linked_capa_number || (r.capa_required ? 'Required' : '—')}</TableCell>}
                <TableCell className="flex gap-1">
                  {canManage && <Button size="sm" variant="outline" onClick={() => onEdit(r)}>Edit</Button>}
                  {showCapa && canManage && onLinkCapa && <Button size="sm" variant="ghost" onClick={() => onLinkCapa(r.id)}>Link</Button>}
                  {canManage && onDelete && <Button size="sm" variant="ghost" disabled={busy} onClick={() => onDelete(r.id)}><Trash2 className="h-4 w-4" /></Button>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
