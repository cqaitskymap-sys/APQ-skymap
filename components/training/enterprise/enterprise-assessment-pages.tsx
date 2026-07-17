'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { KpiCard } from '@/components/cpv/cpv-ui';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { TmsPageHeader } from '@/components/training/tms-page-header';
import { TmsStatusBadge } from '@/components/training/tms-sub-nav';
import { ResponsiveDataTable } from '@/components/cpv/product-master/responsive-data-table';
import type { ColumnDef } from '@/components/admin/admin-data-table';
import { listTrainingRecords, listAssignments } from '@/lib/training-service';
import type { TrainingRecord, TrainingAssignment } from '@/lib/training-types';
import { listInductionRecords, type InductionRecord } from '@/lib/company-training-service';
import { listRetrainingRecords } from '@/lib/training-retraining-service';
import type { RetrainingRecord } from '@/lib/training-retraining-types';
import { EnterpriseListPage } from '@/components/training/enterprise/enterprise-module-pages';

export function AssessmentPage() {
  const [records, setRecords] = useState<TrainingRecord[]>([]);
  const [assignments, setAssignments] = useState<TrainingAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([listTrainingRecords(), listAssignments()]).then(([r, a]) => {
      setRecords(r.filter((rec) => rec.assessment_score != null));
      setAssignments(a.filter((a) => a.assessment_score != null));
    }).catch((cause) => setError(cause instanceof Error ? cause.message : 'Failed to load assessments'))
      .finally(() => setLoading(false));
  }, []);

  const columns: ColumnDef<TrainingRecord>[] = [
    { key: 'emp', header: 'Employee', render: (r) => r.employee_name },
    { key: 'topic', header: 'Topic', render: (r) => r.training_topic },
    { key: 'score', header: 'Score', render: (r) => `${r.assessment_score ?? '—'}%` },
    { key: 'result', header: 'Result', render: (r) => <TmsStatusBadge status={String(r.training_result ?? 'Pending')} /> },
    { key: 'date', header: 'Date', render: (r) => r.training_date ?? '—' },
  ];

  return (
    <EnterpriseListPage
      title="Assessment" description="Written, practical, observation & competency assessments with scoring"
      trail={[{ label: 'Evaluation' }, { label: 'Assessment' }]}
      kpis={[
        { label: 'Assessed Records', value: records.length, tone: 'blue' },
        { label: 'Passed', value: records.filter((r) => r.training_result === 'Pass').length, tone: 'green' },
        { label: 'Failed', value: records.filter((r) => r.training_result === 'Fail').length, tone: 'red' },
        { label: 'Assignments Scored', value: assignments.length, tone: 'amber' },
      ]}
      columns={columns} data={records} loading={loading} error={error}
    />
  );
}

export function TrainingSessionPage() {
  const [assignments, setAssignments] = useState<TrainingAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listAssignments().then((a) => {
      setAssignments(a.filter((x) => x.scheduled_date || x.training_mode === 'Classroom'));
    }).catch((cause) => setError(cause instanceof Error ? cause.message : 'Failed to load training sessions'))
      .finally(() => setLoading(false));
  }, []);

  const columns: ColumnDef<TrainingAssignment>[] = [
    { key: 'num', header: 'Training #', render: (r) => r.training_number },
    { key: 'topic', header: 'Topic', render: (r) => r.training_title },
    { key: 'emp', header: 'Employee', render: (r) => r.employee_name },
    { key: 'date', header: 'Scheduled', render: (r) => r.scheduled_date ?? '—' },
    { key: 'time', header: 'Time', render: (r) => r.scheduled_time ?? '—' },
    { key: 'trainer', header: 'Trainer', render: (r) => r.trainer_name },
    { key: 'mode', header: 'Mode', render: (r) => <Badge variant="outline">{r.training_mode ?? 'Classroom'}</Badge> },
    { key: 'status', header: 'Status', render: (r) => <TmsStatusBadge status={r.status} /> },
  ];

  return (
    <EnterpriseListPage
      title="Training Session" description="Live training session management & scheduling"
      trail={[{ label: 'Execution' }, { label: 'Session' }]}
      kpis={[
        { label: 'Sessions', value: assignments.length, tone: 'blue' },
        { label: 'Today', value: assignments.filter((a) => a.scheduled_date === new Date().toISOString().slice(0, 10)).length, tone: 'green' },
      ]}
      columns={columns} data={assignments} loading={loading} error={error}
    />
  );
}

export function NewEmployeeTrainingPage() {
  const [rows, setRows] = useState<InductionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    listInductionRecords()
      .then(setRows)
      .catch((cause) => setError(cause instanceof Error ? cause.message : 'Failed to load new employee training'))
      .finally(() => setLoading(false));
  }, []);
  const columns: ColumnDef<InductionRecord>[] = [
    { key: 'emp', header: 'Employee', render: (r) => r.employee_name },
    { key: 'dept', header: 'Department', render: (r) => r.department },
    { key: 'stage', header: 'Stage', render: (r) => <TmsStatusBadge status={r.current_stage} /> },
  ];

  return (
    <EnterpriseListPage
      title="New Employee Training"
      description="New joiner training program — linked to induction workflow"
      trail={[{ label: 'Programs' }, { label: 'New Employee' }]}
      showWorkflow
      kpis={[
        { label: 'New Joiners', value: rows.length, tone: 'blue' },
        { label: 'In Progress', value: rows.filter((row) => row.status !== 'Completed').length, tone: 'amber' },
        { label: 'Completed', value: rows.filter((row) => row.status === 'Completed').length, tone: 'green' },
      ]}
      columns={columns}
      data={rows}
      loading={loading}
      error={error}
    />
  );
}

export function RefresherTrainingPage() {
  const [records, setRecords] = useState<RetrainingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    listRetrainingRecords()
      .then(setRecords)
      .catch((cause) => setError(cause instanceof Error ? cause.message : 'Failed to load refresher training'))
      .finally(() => setLoading(false));
  }, []);
  if (loading) return <LoadingSkeleton rows={3} />;
  if (error) return <ErrorCard message={error} />;
  const month = new Date().toISOString().slice(0, 7);
  return (
    <div className="space-y-4">
      <TmsPageHeader title="Refresher Training" description="Periodic refresher scheduling & compliance"
        trail={[{ label: 'Programs' }, { label: 'Refresher' }]}
        actions={<Button variant="outline" size="sm" asChild><Link href="/training/retraining">Open Retraining Module</Link></Button>} />
      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard label="Due This Month" value={records.filter((record) => record.due_date?.startsWith(month)).length} tone="amber" />
        <KpiCard label="Completed" value={records.filter((record) => record.retraining_status === 'Completed').length} tone="green" />
        <KpiCard label="Overdue" value={records.filter((record) => record.retraining_status === 'Overdue').length} tone="red" />
      </div>
    </div>
  );
}

// Trainer sub-modules — delegate to train-the-trainer
export { TrainTheTrainerPage as TrainerAssessmentPage } from '@/components/training/train-the-trainer/train-the-trainer-page';
export { TrainTheTrainerPage as CertifiedTrainerListPage } from '@/components/training/train-the-trainer/train-the-trainer-page';
export { TrainTheTrainerPage as TrainerCertificatePage } from '@/components/training/train-the-trainer/train-the-trainer-page';
