'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Plus, RefreshCw, AlertTriangle, ChevronLeft, ChevronRight, CheckCircle, Calendar, Award,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { KpiCard } from '@/components/cpv/cpv-ui';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { ResponsiveDataTable } from '@/components/cpv/product-master/responsive-data-table';
import type { ColumnDef } from '@/components/admin/admin-data-table';
import { TmsPageHeader } from '@/components/training/tms-page-header';
import { useTrainingEffectiveness } from '@/hooks/use-training-effectiveness';
import type { EffectivenessFilters, TrainingEvaluationRecord } from '@/lib/training-effectiveness-types';
import type { CreateEvaluationInput } from '@/lib/training-effectiveness-schemas';
import {
  EVALUATION_TYPES, EVALUATION_METHODS, computeEvaluationResult, computeCompetencyFromScore,
} from '@/lib/training-effectiveness-types';
import {
  createEvaluation, approveEvaluation, closeEvaluation,
  exportEvaluationsCsv, openEvaluationPrint, logEffectivenessExport,
} from '@/lib/training-effectiveness-service';
import { listTrainingRecords } from '@/lib/training-service';
import type { TrainingRecord } from '@/lib/training-types';
import { EffectivenessFilterPanel } from './effectiveness-filter-panel';
import { EffectivenessDashboardCharts } from './effectiveness-dashboard-charts';
import { EffectivenessExportMenu } from './effectiveness-export-menu';
import {
  EvaluationStatusBadge, EvaluationResultBadge, CompetencyLevelBadge,
} from './effectiveness-status-badge';

const KPI_CONFIG = [
  { label: 'Total Evaluations', key: 'totalEvaluations' as const, tone: 'blue' as const },
  { label: 'Passed', key: 'passed' as const, tone: 'green' as const },
  { label: 'Failed', key: 'failed' as const, tone: 'red' as const },
  { label: 'Pending Approval', key: 'pendingApproval' as const, tone: 'amber' as const },
  { label: 'Competent Employees', key: 'competentEmployees' as const, tone: 'green' as const },
  { label: 'Need Retraining', key: 'needingRetraining' as const, tone: 'red' as const },
  { label: 'Upcoming Reassessments', key: 'upcomingReassessments' as const, tone: 'amber' as const },
];

interface TrainingEffectivenessPageProps {
  defaultTab?: 'dashboard' | 'evaluations' | 'competency' | 'pending';
}

export function TrainingEffectivenessPage({ defaultTab = 'dashboard' }: TrainingEffectivenessPageProps) {
  const [filters, setFilters] = useState<EffectivenessFilters>({});
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [approveOpen, setApproveOpen] = useState(false);
  const [selected, setSelected] = useState<TrainingEvaluationRecord | null>(null);
  const [approveAction, setApproveAction] = useState<'approve' | 'reject'>('approve');
  const [approveRemarks, setApproveRemarks] = useState('');
  const [trainingRecords, setTrainingRecords] = useState<TrainingRecord[]>([]);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    training_record_id: '',
    employee_id: '',
    employee_name: '',
    department: '',
    designation: '',
    training_topic: '',
    document_number: '',
    sop_version: '',
    assignment_id: '',
    evaluation_type: 'Written Test',
    evaluator: '',
    evaluation_date: new Date().toISOString().slice(0, 10),
    method: 'Assessment',
    passing_score: 80,
    obtained_score: 0,
    observation: '',
    practical_observation: '',
    supervisor_feedback: '',
    corrective_action: '',
    reassessment_required: false,
    reassessment_date: '',
    remarks: '',
  });

  const {
    data, loading, refreshing, error, refresh, actor,
    canView, canManage, canApprove, canEvaluate, isReadOnly, isEmployeeView,
  } = useTrainingEffectiveness(filters);

  useEffect(() => {
    if (createOpen) {
      listTrainingRecords().then(setTrainingRecords).catch(() => {});
    }
  }, [createOpen]);

  const employees = useMemo(() => {
    const map = new Map<string, string>();
    data?.evaluations.forEach((r) => map.set(r.employee_id, r.employee_name));
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [data?.evaluations]);

  const evaluators = useMemo(() => {
    const set = new Set<string>();
    data?.evaluations.forEach((r) => { if (r.evaluator) set.add(r.evaluator); });
    return Array.from(set);
  }, [data?.evaluations]);

  const tableRows = useMemo(() => {
    if (!data) return [];
    if (activeTab === 'competency') return data.competencyGaps;
    if (activeTab === 'pending') return data.pendingApproval;
    return data.evaluations;
  }, [data, activeTab]);

  const paginated = useMemo(() => {
    const size = 15;
    const start = (page - 1) * size;
    return tableRows.slice(start, start + size);
  }, [tableRows, page]);

  const totalPages = Math.max(1, Math.ceil(tableRows.length / 15));

  const previewResult = useMemo(
    () => computeEvaluationResult(form.obtained_score, form.passing_score),
    [form.obtained_score, form.passing_score],
  );
  const previewCompetency = useMemo(
    () => computeCompetencyFromScore(form.obtained_score, form.passing_score),
    [form.obtained_score, form.passing_score],
  );

  const onTrainingRecordChange = useCallback((id: string) => {
    const rec = trainingRecords.find((r) => r.id === id);
    if (!rec) return;
    setForm((f) => ({
      ...f,
      training_record_id: id,
      employee_id: rec.employee_id,
      employee_name: rec.employee_name,
      department: rec.department,
      designation: rec.designation,
      training_topic: rec.training_topic,
      document_number: rec.document_number,
      sop_version: rec.sop_version,
      assignment_id: rec.assignment_id,
      passing_score: rec.pass_marks || 80,
    }));
  }, [trainingRecords]);

  const handleCreate = async () => {
    if (!form.employee_id || !form.training_record_id || !form.evaluator || !form.evaluation_date) {
      toast.error('Employee, training record, evaluator, and evaluation date are required');
      return;
    }
    if (form.obtained_score == null || form.passing_score == null) {
      toast.error('Passing score and obtained score are required');
      return;
    }
    setSaving(true);
    try {
      await createEvaluation({
        ...form,
        evaluation_type: form.evaluation_type as CreateEvaluationInput['evaluation_type'],
        method: form.method as CreateEvaluationInput['method'],
        reassessment_date: form.reassessment_date || null,
      }, actor);
      toast.success('Evaluation submitted');
      setCreateOpen(false);
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to create evaluation');
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await approveEvaluation({
        evaluation_id: selected.id,
        action: approveAction,
        remarks: approveRemarks,
      }, actor);
      toast.success(approveAction === 'approve' ? 'Evaluation approved' : 'Evaluation rejected');
      setApproveOpen(false);
      setSelected(null);
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = async (rec: TrainingEvaluationRecord) => {
    try {
      await closeEvaluation(rec.id, actor);
      toast.success('Evaluation closed');
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Close failed');
    }
  };

  const handleExport = () => {
    if (!data) return;
    exportEvaluationsCsv(data.evaluations);
    logEffectivenessExport(actor, data.evaluations.length);
    toast.success('CSV exported');
  };

  const columns: ColumnDef<TrainingEvaluationRecord>[] = [
    { key: 'num', header: 'Evaluation #', render: (r) => <span className="font-mono text-xs">{r.evaluation_number}</span> },
    { key: 'emp', header: 'Employee', render: (r) => r.employee_name },
    { key: 'dept', header: 'Department', render: (r) => r.department },
    { key: 'topic', header: 'Training Topic', render: (r) => <span className="text-xs">{r.training_topic}</span> },
    { key: 'type', header: 'Type', render: (r) => r.evaluation_type },
    { key: 'evaluator', header: 'Evaluator', render: (r) => r.evaluator },
    { key: 'date', header: 'Date', render: (r) => r.evaluation_date || '—' },
    { key: 'score', header: 'Score', render: (r) => `${r.obtained_score ?? '—'} / ${r.passing_score}` },
    { key: 'result', header: 'Result', render: (r) => <EvaluationResultBadge result={String(r.result)} /> },
    { key: 'competency', header: 'Competency', render: (r) => <CompetencyLevelBadge level={String(r.competency_level)} /> },
    { key: 'status', header: 'Status', render: (r) => <EvaluationStatusBadge status={String(r.status)} /> },
    {
      key: 'actions', header: 'Actions',
      render: (r) => (
        <div className="flex flex-wrap gap-1">
          {canApprove && r.status === 'Submitted' && (
            <>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => {
                setSelected(r); setApproveAction('approve'); setApproveRemarks(''); setApproveOpen(true);
              }}>Approve</Button>
              <Button size="sm" variant="outline" className="h-7 text-xs text-red-600" onClick={() => {
                setSelected(r); setApproveAction('reject'); setApproveRemarks(''); setApproveOpen(true);
              }}>Reject</Button>
            </>
          )}
          {canManage && r.status === 'Approved' && (
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => handleClose(r)}>Close</Button>
          )}
        </div>
      ),
    },
  ];

  if (!canView) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Access Denied</AlertTitle>
        <AlertDescription>You do not have permission to view training effectiveness evaluations.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <TmsPageHeader
        title="Training Effectiveness & Competency Evaluation"
        description="Evaluate employee competency after GMP training"
        trail={[{ label: 'Training Effectiveness' }]}
        actions={
          <div className="flex flex-wrap gap-2">
            {(canManage || canEvaluate) && !isReadOnly && (
              <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4 mr-1" /> Create Evaluation
              </Button>
            )}
            <Button variant="outline" onClick={refresh} disabled={refreshing}>
              <RefreshCw className={`h-4 w-4 mr-1 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
            </Button>
            <EffectivenessExportMenu
              canExport={!isReadOnly}
              onCsv={handleExport}
              onPrint={() => { if (data) { openEvaluationPrint(data.evaluations); toast.success('Report opened'); } }}
            />
          </div>
        }
      />

      <div className="flex flex-wrap gap-1.5">
        <Badge variant="outline" className="text-xs">EU GMP Annex 11</Badge>
        <Badge variant="outline" className="text-xs">21 CFR Part 11</Badge>
        <Badge variant="outline" className="text-xs">GAMP 5</Badge>
        <Badge variant="outline" className="text-xs">Electronic Signature Ready</Badge>
      </div>

      {isReadOnly && <Alert><AlertTitle>Read-Only</AlertTitle><AlertDescription>Auditor view — evaluations cannot be modified.</AlertDescription></Alert>}
      {isEmployeeView && <Alert><AlertDescription>Viewing your own competency evaluations.</AlertDescription></Alert>}
      {error && <ErrorCard message={error} onRetry={refresh} />}

      {loading ? <LoadingSkeleton rows={6} /> : data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            {KPI_CONFIG.map((k) => (
              <KpiCard key={k.key} label={k.label} value={data.kpis[k.key]} tone={k.tone} />
            ))}
          </div>

          <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v as typeof activeTab); setPage(1); }}>
            <TabsList className="flex flex-wrap h-auto gap-1">
              <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
              <TabsTrigger value="evaluations">Evaluations ({data.evaluations.length})</TabsTrigger>
              <TabsTrigger value="competency">Competency Gaps ({data.competencyGaps.length})</TabsTrigger>
              <TabsTrigger value="pending">Pending Approval ({data.pendingApproval.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="dashboard" className="space-y-4 mt-4">
              <EffectivenessDashboardCharts charts={data.charts} />
              {data.upcomingReassessments.length > 0 && (
                <Alert>
                  <Calendar className="h-4 w-4" />
                  <AlertTitle>Upcoming Reassessments</AlertTitle>
                  <AlertDescription>
                    {data.upcomingReassessments.length} reassessment(s) scheduled — next: {data.upcomingReassessments[0]?.reassessment_date}
                  </AlertDescription>
                </Alert>
              )}
            </TabsContent>

            <TabsContent value="evaluations" className="space-y-4 mt-4">
              <EffectivenessFilterPanel filters={filters} onChange={(f) => { setFilters(f); setPage(1); }} employees={employees} evaluators={evaluators} />
              <ResponsiveDataTable columns={columns} data={paginated} emptyMessage="No evaluations found" />
            </TabsContent>

            <TabsContent value="competency" className="space-y-4 mt-4">
              <Alert>
                <Award className="h-4 w-4" />
                <AlertTitle>Competency Assessment</AlertTitle>
                <AlertDescription>Employees with Needs Improvement or Not Competent ratings requiring follow-up.</AlertDescription>
              </Alert>
              <ResponsiveDataTable columns={columns.filter((c) => c.key !== 'actions')} data={paginated} emptyMessage="No competency gaps" />
            </TabsContent>

            <TabsContent value="pending" className="space-y-4 mt-4">
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertTitle>Pending QA Approval</AlertTitle>
                <AlertDescription>Evaluations awaiting QA review and electronic signature.</AlertDescription>
              </Alert>
              <ResponsiveDataTable columns={columns} data={paginated} emptyMessage="No pending approvals" />
            </TabsContent>
          </Tabs>

          {activeTab !== 'dashboard' && tableRows.length > 15 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Page {page} of {totalPages} ({tableRows.length} records)</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Create Competency Evaluation</DialogTitle></DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label>Training Record *</Label>
              <Select value={form.training_record_id} onValueChange={onTrainingRecordChange}>
                <SelectTrigger><SelectValue placeholder="Select completed training record" /></SelectTrigger>
                <SelectContent>
                  {trainingRecords.filter((r) => r.completion_status === 'Completed' || r.training_result === 'Pass').map((r) => (
                    <SelectItem key={r.id} value={r.id}>{r.training_number} — {r.employee_name} — {r.training_topic}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Employee</Label><Input value={form.employee_name} readOnly /></div>
            <div><Label>Department</Label><Input value={form.department} readOnly /></div>
            <div><Label>Designation</Label><Input value={form.designation} readOnly /></div>
            <div><Label>Training Topic</Label><Input value={form.training_topic} readOnly /></div>
            <div><Label>Document Number</Label><Input value={form.document_number} readOnly /></div>
            <div><Label>SOP Version</Label><Input value={form.sop_version} readOnly /></div>
            <div>
              <Label>Evaluation Type</Label>
              <Select value={form.evaluation_type} onValueChange={(v) => setForm((f) => ({ ...f, evaluation_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{EVALUATION_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Method</Label>
              <Select value={form.method} onValueChange={(v) => setForm((f) => ({ ...f, method: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{EVALUATION_METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Evaluator *</Label><Input value={form.evaluator} onChange={(e) => setForm((f) => ({ ...f, evaluator: e.target.value }))} placeholder="Evaluator name" /></div>
            <div><Label>Evaluation Date *</Label><Input type="date" value={form.evaluation_date} onChange={(e) => setForm((f) => ({ ...f, evaluation_date: e.target.value }))} /></div>
            <div><Label>Passing Score *</Label><Input type="number" value={form.passing_score} onChange={(e) => setForm((f) => ({ ...f, passing_score: Number(e.target.value) }))} /></div>
            <div><Label>Obtained Score *</Label><Input type="number" value={form.obtained_score} onChange={(e) => setForm((f) => ({ ...f, obtained_score: Number(e.target.value) }))} /></div>
            <div className="sm:col-span-2 flex gap-4">
              <Badge variant={previewResult === 'Pass' ? 'default' : 'destructive'}>Result: {previewResult}</Badge>
              <Badge variant="outline">Competency: {previewCompetency}</Badge>
            </div>
            <div className="sm:col-span-2"><Label>Observation</Label><Textarea value={form.observation} onChange={(e) => setForm((f) => ({ ...f, observation: e.target.value }))} rows={2} /></div>
            <div className="sm:col-span-2"><Label>Practical Observation</Label><Textarea value={form.practical_observation} onChange={(e) => setForm((f) => ({ ...f, practical_observation: e.target.value }))} rows={2} /></div>
            <div className="sm:col-span-2"><Label>Supervisor Comments</Label><Textarea value={form.supervisor_feedback} onChange={(e) => setForm((f) => ({ ...f, supervisor_feedback: e.target.value }))} rows={2} /></div>
            {previewResult === 'Fail' && (
              <div className="sm:col-span-2"><Label>Corrective Action</Label><Textarea value={form.corrective_action} onChange={(e) => setForm((f) => ({ ...f, corrective_action: e.target.value }))} rows={2} placeholder="CAPA / retraining recommendation" /></div>
            )}
            <div className="flex items-center gap-2">
              <Checkbox id="reassess" checked={form.reassessment_required || previewResult === 'Fail'} disabled={previewResult === 'Fail'}
                onCheckedChange={(c) => setForm((f) => ({ ...f, reassessment_required: Boolean(c) }))} />
              <Label htmlFor="reassess">Reassessment Required</Label>
            </div>
            {(form.reassessment_required || previewResult === 'Fail') && (
              <div><Label>Reassessment Date</Label><Input type="date" value={form.reassessment_date} onChange={(e) => setForm((f) => ({ ...f, reassessment_date: e.target.value }))} /></div>
            )}
            <div className="sm:col-span-2"><Label>Attachment</Label><Input type="file" disabled className="opacity-60" /><p className="text-xs text-muted-foreground mt-1">Attachment upload placeholder — link to document management</p></div>
            <div className="sm:col-span-2"><Label>Remarks</Label><Textarea value={form.remarks} onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button className="bg-blue-600" onClick={handleCreate} disabled={saving}>{saving ? 'Submitting…' : 'Submit Evaluation'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={approveOpen} onOpenChange={setApproveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{approveAction === 'approve' ? 'Approve Evaluation' : 'Reject Evaluation'}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-3 text-sm">
              <p><strong>{selected.evaluation_number}</strong> — {selected.employee_name}</p>
              <p>Result: {selected.result} | Competency: {selected.competency_level}</p>
              {approveAction === 'approve' && (
                <Alert><AlertDescription>Electronic signature placeholder will be applied upon approval (21 CFR Part 11).</AlertDescription></Alert>
              )}
              <div><Label>Remarks</Label><Textarea value={approveRemarks} onChange={(e) => setApproveRemarks(e.target.value)} rows={3} /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveOpen(false)}>Cancel</Button>
            <Button className={approveAction === 'approve' ? 'bg-green-600' : 'bg-red-600'} onClick={handleApprove} disabled={saving}>
              {saving ? 'Processing…' : approveAction === 'approve' ? 'Approve & Sign' : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
