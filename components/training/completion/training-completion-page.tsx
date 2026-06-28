'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  RefreshCw, AlertTriangle, ChevronLeft, ChevronRight, UserCheck, ClipboardCheck, Upload,
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
import { useTrainingCompletion } from '@/hooks/use-training-completion';
import type { CompletionFilters, TrainingRecord, TrainingAttendance } from '@/lib/training-completion-types';
import {
  ATTENDANCE_STATUSES, TRAINING_MODES, computeTrainingResult,
} from '@/lib/training-completion-types';
import type { MarkAttendanceInput, CompleteTrainingInput } from '@/lib/training-completion-schemas';
import {
  markTrainingAttendance, completeTrainingRecord, qaReviewCompletion,
  exportCompletionAttendanceCsv, exportCompletionRecordsCsv, openCompletionPrint, logCompletionExport,
  listTrainingMaster,
} from '@/lib/training-completion-service';
import type { TrainingMaster } from '@/lib/training-types';
import { CompletionFilterPanel } from './completion-filter-panel';
import { CompletionDashboardCharts } from './completion-dashboard-charts';
import { CompletionExportMenu } from './completion-export-menu';
import {
  AttendanceStatusBadge, CompletionStatusBadge, TrainingResultBadge,
} from './completion-status-badge';

const KPI_CONFIG = [
  { label: 'Total Records', key: 'totalRecords' as const, tone: 'blue' as const },
  { label: 'Completed', key: 'completed' as const, tone: 'green' as const },
  { label: 'Failed', key: 'failed' as const, tone: 'red' as const },
  { label: 'In Progress', key: 'inProgress' as const, tone: 'amber' as const },
  { label: 'Pending Completion', key: 'pendingCompletion' as const, tone: 'amber' as const },
  { label: 'Attendance Logged', key: 'attendanceLogged' as const, tone: 'blue' as const },
  { label: 'Absent', key: 'absentCount' as const, tone: 'red' as const },
  { label: 'Pass Rate', key: 'passRate' as const, tone: 'green' as const, suffix: '%' },
];

interface TrainingCompletionPageProps {
  defaultTab?: 'dashboard' | 'attendance' | 'completion' | 'records';
}

export function TrainingCompletionPage({ defaultTab = 'dashboard' }: TrainingCompletionPageProps) {
  const [filters, setFilters] = useState<CompletionFilters>({});
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [page, setPage] = useState(1);
  const [saving, setSaving] = useState(false);
  const [masters, setMasters] = useState<TrainingMaster[]>([]);
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [qaOpen, setQaOpen] = useState(false);
  const [qaRecord, setQaRecord] = useState<TrainingRecord | null>(null);
  const [qaAction, setQaAction] = useState<'approve' | 'reject'>('approve');
  const [qaRemarks, setQaRemarks] = useState('');

  const [attForm, setAttForm] = useState<MarkAttendanceInput>({
    assignment_id: '', employee_id: '', training_date: new Date().toISOString().slice(0, 10),
    attendance_status: 'Present', trainer: '', start_time: '09:00', end_time: '17:00', trainer_verified: false,
  });

  const [compForm, setCompForm] = useState<CompleteTrainingInput>({
    assignment_id: '', employee_id: '', training_date: new Date().toISOString().slice(0, 10),
    attendance_status: 'Present', trainer: '', training_mode: 'Classroom',
    start_time: '09:00', end_time: '17:00', assessment_score: null,
    trainer_comments: '', employee_comments: '', completion_evidence: '',
    trainer_verified: false, assessment_required: false, pass_marks: 80,
  });

  const {
    data, loading, refreshing, error, refresh, actor,
    canView, canManage, canApprove, canMark, isReadOnly, isEmployeeView, isDepartmentView,
  } = useTrainingCompletion(filters);

  useEffect(() => {
    listTrainingMaster({ status: 'Active' }).then(setMasters).catch(() => {});
  }, []);

  const employees = useMemo(() => {
    const map = new Map<string, string>();
    data?.records.forEach((r) => map.set(r.employee_id, r.employee_name));
    data?.attendance.forEach((a) => map.set(a.employee_id, a.employee_name));
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [data]);

  const trainers = useMemo(() => {
    const set = new Set<string>();
    data?.records.forEach((r) => { if (r.trainer) set.add(r.trainer); });
    data?.attendance.forEach((a) => { if (a.trainer) set.add(a.trainer); });
    return Array.from(set);
  }, [data]);

  const selectedMaster = useMemo(() => {
    const asn = data?.openAssignments.find((a) => a.id === compForm.assignment_id);
    return asn ? masters.find((m) => m.id === asn.training_master_id) : undefined;
  }, [compForm.assignment_id, data?.openAssignments, masters]);

  const previewResult = useMemo(() => {
    const required = selectedMaster?.assessment_required ?? false;
    const passMarks = selectedMaster?.passing_percentage ?? 80;
    return computeTrainingResult(compForm.assessment_score ?? null, passMarks, required);
  }, [compForm.assessment_score, selectedMaster]);

  const paginatedAttendance = useMemo(() => {
    const size = 15;
    return data?.attendance.slice((page - 1) * size, page * size) ?? [];
  }, [data?.attendance, page]);

  const paginatedRecords = useMemo(() => {
    const size = 15;
    return data?.records.slice((page - 1) * size, page * size) ?? [];
  }, [data?.records, page]);

  const tableRowCount = activeTab === 'attendance' ? (data?.attendance.length ?? 0) : (data?.records.length ?? 0);
  const totalPages = Math.max(1, Math.ceil(tableRowCount / 15));

  const onAssignmentSelect = (id: string, mode: 'attendance' | 'completion') => {
    const a = data?.openAssignments.find((x) => x.id === id);
    if (!a) return;
    if (mode === 'attendance') {
      setAttForm((f) => ({ ...f, assignment_id: id, employee_id: a.employee_id, trainer: a.trainer_name || '' }));
    } else {
      const master = masters.find((m) => m.id === a.training_master_id);
      setCompForm((f) => ({
        ...f, assignment_id: id, employee_id: a.employee_id, trainer: a.trainer_name || '',
        assessment_required: master?.assessment_required ?? false,
        pass_marks: master?.passing_percentage ?? 80,
      }));
    }
  };

  const handleAttendance = async () => {
    setSaving(true);
    try {
      await markTrainingAttendance(attForm, actor);
      toast.success('Attendance recorded');
      setAttForm({
        assignment_id: '', employee_id: '', training_date: new Date().toISOString().slice(0, 10),
        attendance_status: 'Present', trainer: '', start_time: '09:00', end_time: '17:00', trainer_verified: false,
      });
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to record attendance');
    } finally {
      setSaving(false);
    }
  };

  const handleCompletion = async () => {
    setSaving(true);
    try {
      const record = await completeTrainingRecord({
        ...compForm,
        assessment_required: selectedMaster?.assessment_required ?? compForm.assessment_required,
        pass_marks: selectedMaster?.passing_percentage ?? compForm.pass_marks,
      }, actor, evidenceFile);
      toast.success(`Training completed — Result: ${record.training_result}`);
      setCompForm({
        assignment_id: '', employee_id: '', training_date: new Date().toISOString().slice(0, 10),
        attendance_status: 'Present', trainer: '', training_mode: 'Classroom',
        start_time: '09:00', end_time: '17:00', assessment_score: null,
        trainer_comments: '', employee_comments: '', completion_evidence: '',
        trainer_verified: false, assessment_required: false, pass_marks: 80,
      });
      setEvidenceFile(null);
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Completion failed');
    } finally {
      setSaving(false);
    }
  };

  const handleQaReview = async () => {
    if (!qaRecord) return;
    setSaving(true);
    try {
      await qaReviewCompletion({ record_id: qaRecord.id, action: qaAction, remarks: qaRemarks }, actor);
      toast.success(qaAction === 'approve' ? 'Completion approved by QA' : 'Completion rejected');
      setQaOpen(false);
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Review failed');
    } finally {
      setSaving(false);
    }
  };

  const attendanceColumns: ColumnDef<TrainingAttendance>[] = [
    { key: 'num', header: 'Training #', render: (r) => <span className="font-mono text-xs">{r.training_number}</span> },
    { key: 'emp', header: 'Employee', render: (r) => r.employee_name },
    { key: 'dept', header: 'Department', render: (r) => r.department },
    { key: 'topic', header: 'Topic', render: (r) => <span className="text-xs">{r.training_topic}</span> },
    { key: 'date', header: 'Date', render: (r) => r.training_date },
    { key: 'status', header: 'Attendance', render: (r) => <AttendanceStatusBadge status={String(r.attendance_status)} /> },
    { key: 'trainer', header: 'Trainer', render: (r) => r.trainer },
    { key: 'verified', header: 'Verified', render: (r) => r.trainer_verified ? 'Yes' : '—' },
  ];

  const recordColumns: ColumnDef<TrainingRecord>[] = [
    { key: 'id', header: 'Record ID', render: (r) => <span className="font-mono text-xs">{r.training_record_id}</span> },
    { key: 'emp', header: 'Employee', render: (r) => r.employee_name },
    { key: 'topic', header: 'Topic', render: (r) => <span className="text-xs">{r.training_topic}</span> },
    { key: 'date', header: 'Date', render: (r) => r.training_date },
    { key: 'att', header: 'Attendance', render: (r) => <AttendanceStatusBadge status={String(r.attendance_status)} /> },
    { key: 'comp', header: 'Completion', render: (r) => <CompletionStatusBadge status={String(r.completion_status)} /> },
    { key: 'result', header: 'Result', render: (r) => <TrainingResultBadge result={String(r.training_result)} /> },
    { key: 'score', header: 'Score', render: (r) => r.assessment_score != null ? `${r.assessment_score}/${r.pass_marks}` : '—' },
    { key: 'trainer', header: 'Trainer', render: (r) => r.trainer },
    {
      key: 'actions', header: 'QA',
      render: (r) => canApprove && r.completion_status === 'Completed' ? (
        <div className="flex gap-1">
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => {
            setQaRecord(r); setQaAction('approve'); setQaRemarks(''); setQaOpen(true);
          }}>Approve</Button>
          <Button size="sm" variant="outline" className="h-7 text-xs text-red-600" onClick={() => {
            setQaRecord(r); setQaAction('reject'); setQaRemarks(''); setQaOpen(true);
          }}>Reject</Button>
        </div>
      ) : '—',
    },
  ];

  if (!canView) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Access Denied</AlertTitle>
        <AlertDescription>You do not have permission to view training completion records.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <TmsPageHeader
        title="Training Completion & Attendance"
        description="Record attendance, completion evidence and training results"
        trail={[{ label: 'Completion & Attendance' }]}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={refresh} disabled={refreshing}>
              <RefreshCw className={`h-4 w-4 mr-1 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
            </Button>
            <CompletionExportMenu
              canExport={!isReadOnly}
              onAttendanceCsv={() => { if (data) { exportCompletionAttendanceCsv(data.attendance); logCompletionExport(actor, data.attendance.length, 'attendance'); toast.success('Attendance CSV exported'); } }}
              onRecordsCsv={() => { if (data) { exportCompletionRecordsCsv(data.records); logCompletionExport(actor, data.records.length, 'records'); toast.success('Records CSV exported'); } }}
              onPrint={() => { if (data) { openCompletionPrint(data.records, data.attendance); toast.success('Report opened'); } }}
            />
          </div>
        }
      />

      <div className="flex flex-wrap gap-1.5">
        <Badge variant="outline" className="text-xs">GMP Compliant</Badge>
        <Badge variant="outline" className="text-xs">21 CFR Part 11</Badge>
        <Badge variant="outline" className="text-xs">ALCOA+</Badge>
      </div>

      {isReadOnly && <Alert><AlertTitle>Read-Only</AlertTitle><AlertDescription>Auditor view — records cannot be modified.</AlertDescription></Alert>}
      {isEmployeeView && <Alert><AlertDescription>Viewing your own training completion records.</AlertDescription></Alert>}
      {isDepartmentView && <Alert><AlertDescription>Viewing department training completion records.</AlertDescription></Alert>}
      {error && <ErrorCard message={error} onRetry={refresh} />}

      {loading ? <LoadingSkeleton rows={6} /> : data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
            {KPI_CONFIG.map((k) => (
              <KpiCard key={k.key} label={k.label} value={`${data.kpis[k.key]}${k.suffix ?? ''}`} tone={k.tone} />
            ))}
          </div>

          <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v as typeof activeTab); setPage(1); }}>
            <TabsList className="flex flex-wrap h-auto gap-1">
              <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
              <TabsTrigger value="attendance"><UserCheck className="h-3.5 w-3.5 mr-1 inline" />Attendance ({data.attendance.length})</TabsTrigger>
              <TabsTrigger value="completion"><ClipboardCheck className="h-3.5 w-3.5 mr-1 inline" />Complete Training</TabsTrigger>
              <TabsTrigger value="records">Records ({data.records.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="dashboard" className="space-y-4 mt-4">
              <CompletionDashboardCharts charts={data.charts} />
              {data.openAssignments.length > 0 && (
                <Alert>
                  <AlertTitle>{data.openAssignments.length} assignment(s) pending completion</AlertTitle>
                  <AlertDescription>Open assignments awaiting attendance or completion recording.</AlertDescription>
                </Alert>
              )}
            </TabsContent>

            <TabsContent value="attendance" className="space-y-4 mt-4">
              <CompletionFilterPanel filters={filters} onChange={(f) => { setFilters(f); setPage(1); }} employees={employees} trainers={trainers} />
              {canMark && !isReadOnly && (
                <div className="rounded-lg border border-blue-100 bg-card p-4 space-y-4">
                  <h3 className="font-semibold text-blue-900">Record Attendance</h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <Label>Training Assignment *</Label>
                      <Select value={attForm.assignment_id} onValueChange={(v) => onAssignmentSelect(v, 'attendance')}>
                        <SelectTrigger><SelectValue placeholder="Select assignment" /></SelectTrigger>
                        <SelectContent>
                          {data.openAssignments.map((a) => (
                            <SelectItem key={a.id} value={a.id}>{a.training_number} — {a.employee_name} — {a.training_title}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div><Label>Training Date *</Label><Input type="date" value={attForm.training_date} onChange={(e) => setAttForm((f) => ({ ...f, training_date: e.target.value }))} /></div>
                    <div><Label>Attendance Status *</Label>
                      <Select value={attForm.attendance_status} onValueChange={(v) => setAttForm((f) => ({ ...f, attendance_status: v as MarkAttendanceInput['attendance_status'] }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{ATTENDANCE_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div><Label>Trainer *</Label><Input value={attForm.trainer} onChange={(e) => setAttForm((f) => ({ ...f, trainer: e.target.value }))} /></div>
                    <div><Label>Start Time</Label><Input type="time" value={attForm.start_time} onChange={(e) => setAttForm((f) => ({ ...f, start_time: e.target.value }))} /></div>
                    <div><Label>End Time</Label><Input type="time" value={attForm.end_time} onChange={(e) => setAttForm((f) => ({ ...f, end_time: e.target.value }))} /></div>
                    <div className="flex items-center gap-2 sm:col-span-2">
                      <Checkbox id="att-verified" checked={attForm.trainer_verified} onCheckedChange={(c) => setAttForm((f) => ({ ...f, trainer_verified: Boolean(c) }))} />
                      <Label htmlFor="att-verified">Trainer verification (sign-off)</Label>
                    </div>
                  </div>
                  <Button className="bg-blue-600" onClick={handleAttendance} disabled={saving}>{saving ? 'Saving…' : 'Mark Attendance'}</Button>
                </div>
              )}
              <ResponsiveDataTable columns={attendanceColumns} data={paginatedAttendance} emptyMessage="No attendance records" />
            </TabsContent>

            <TabsContent value="completion" className="space-y-4 mt-4">
              {canMark && !isReadOnly && (
                <div className="rounded-lg border border-blue-100 bg-card p-4 space-y-4">
                  <h3 className="font-semibold text-blue-900">Complete Training & Record Results</h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <Label>Training Assignment *</Label>
                      <Select value={compForm.assignment_id} onValueChange={(v) => onAssignmentSelect(v, 'completion')}>
                        <SelectTrigger><SelectValue placeholder="Select assignment" /></SelectTrigger>
                        <SelectContent>
                          {data.openAssignments.map((a) => (
                            <SelectItem key={a.id} value={a.id}>{a.training_number} — {a.employee_name} — {a.training_title}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div><Label>Training Date *</Label><Input type="date" value={compForm.training_date} onChange={(e) => setCompForm((f) => ({ ...f, training_date: e.target.value }))} /></div>
                    <div><Label>Attendance Status *</Label>
                      <Select value={compForm.attendance_status} onValueChange={(v) => setCompForm((f) => ({ ...f, attendance_status: v as CompleteTrainingInput['attendance_status'] }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{ATTENDANCE_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div><Label>Trainer *</Label><Input value={compForm.trainer} onChange={(e) => setCompForm((f) => ({ ...f, trainer: e.target.value }))} /></div>
                    <div><Label>Training Mode</Label>
                      <Select value={compForm.training_mode} onValueChange={(v) => setCompForm((f) => ({ ...f, training_mode: v as CompleteTrainingInput['training_mode'] }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{TRAINING_MODES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div><Label>Start Time</Label><Input type="time" value={compForm.start_time} onChange={(e) => setCompForm((f) => ({ ...f, start_time: e.target.value }))} /></div>
                    <div><Label>End Time</Label><Input type="time" value={compForm.end_time} onChange={(e) => setCompForm((f) => ({ ...f, end_time: e.target.value }))} /></div>
                    {selectedMaster?.assessment_required && (
                      <div>
                        <Label>Assessment Score * (Pass: {selectedMaster.passing_percentage}%)</Label>
                        <Input type="number" min={0} max={100} value={compForm.assessment_score ?? ''}
                          onChange={(e) => setCompForm((f) => ({ ...f, assessment_score: e.target.value ? Number(e.target.value) : null }))} />
                      </div>
                    )}
                    {selectedMaster?.assessment_required && (
                      <div className="sm:col-span-2 flex items-center gap-2">
                        <TrainingResultBadge result={previewResult} />
                        {previewResult === 'Fail' && <span className="text-sm text-red-600">Retraining will be scheduled automatically</span>}
                        {previewResult === 'Pass' && selectedMaster.effectiveness_required && (
                          <span className="text-sm text-amber-600">Effectiveness evaluation will be created after completion</span>
                        )}
                      </div>
                    )}
                    <div><Label>Trainer Comments</Label><Textarea value={compForm.trainer_comments} onChange={(e) => setCompForm((f) => ({ ...f, trainer_comments: e.target.value }))} rows={2} /></div>
                    <div><Label>Employee Comments</Label><Textarea value={compForm.employee_comments} onChange={(e) => setCompForm((f) => ({ ...f, employee_comments: e.target.value }))} rows={2} /></div>
                    <div className="sm:col-span-2">
                      <Label>Completion Evidence</Label>
                      <div className="flex items-center gap-3 mt-1">
                        <Input type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" onChange={(e) => setEvidenceFile(e.target.files?.[0] ?? null)} />
                        <Upload className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">Upload sign-in sheet, certificate, or assessment evidence (placeholder)</p>
                    </div>
                    <div className="flex items-center gap-2 sm:col-span-2">
                      <Checkbox id="comp-verified" checked={compForm.trainer_verified} onCheckedChange={(c) => setCompForm((f) => ({ ...f, trainer_verified: Boolean(c) }))} />
                      <Label htmlFor="comp-verified">Trainer verification (sign-off)</Label>
                    </div>
                  </div>
                  <Button className="bg-blue-600" onClick={handleCompletion} disabled={saving}>{saving ? 'Completing…' : 'Complete Training'}</Button>
                </div>
              )}
            </TabsContent>

            <TabsContent value="records" className="space-y-4 mt-4">
              <CompletionFilterPanel filters={filters} onChange={(f) => { setFilters(f); setPage(1); }} employees={employees} trainers={trainers} />
              <ResponsiveDataTable columns={recordColumns} data={paginatedRecords} emptyMessage="No completion records" />
            </TabsContent>
          </Tabs>

          {activeTab !== 'dashboard' && activeTab !== 'completion' && tableRowCount > 15 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Page {page} of {totalPages} ({tableRowCount} records)</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}><ChevronLeft className="h-4 w-4" /></Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
              </div>
            </div>
          )}
        </>
      )}

      <Dialog open={qaOpen} onOpenChange={setQaOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{qaAction === 'approve' ? 'QA Approve Completion' : 'QA Reject Completion'}</DialogTitle></DialogHeader>
          {qaRecord && (
            <div className="space-y-3 text-sm">
              <p><strong>{qaRecord.training_record_id}</strong> — {qaRecord.employee_name} — {qaRecord.training_topic}</p>
              <p>Result: {qaRecord.training_result} | Score: {qaRecord.assessment_score ?? 'N/A'}</p>
              <div><Label>Remarks</Label><Textarea value={qaRemarks} onChange={(e) => setQaRemarks(e.target.value)} rows={3} /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setQaOpen(false)}>Cancel</Button>
            <Button className={qaAction === 'approve' ? 'bg-green-600' : 'bg-red-600'} onClick={handleQaReview} disabled={saving}>
              {saving ? 'Processing…' : qaAction === 'approve' ? 'Approve' : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
