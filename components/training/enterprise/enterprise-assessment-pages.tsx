'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { KpiCard } from '@/components/cpv/cpv-ui';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { TmsPageHeader } from '@/components/training/tms-page-header';
import { TmsStatusBadge } from '@/components/training/tms-sub-nav';
import { ResponsiveDataTable } from '@/components/cpv/product-master/responsive-data-table';
import type { ColumnDef } from '@/components/admin/admin-data-table';
import { listTrainingRecords, listAssignments } from '@/lib/training-service';
import type { TrainingRecord, TrainingAssignment } from '@/lib/training-types';
import { EnterpriseListPage } from '@/components/training/enterprise/enterprise-module-pages';

export function AssessmentPage() {
  const [records, setRecords] = useState<TrainingRecord[]>([]);
  const [assignments, setAssignments] = useState<TrainingAssignment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([listTrainingRecords(), listAssignments()]).then(([r, a]) => {
      setRecords(r.filter((rec) => rec.assessment_score != null));
      setAssignments(a.filter((a) => a.assessment_score != null));
      setLoading(false);
    });
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
      columns={columns} data={records} loading={loading}
    />
  );
}

export function TrainingSessionPage() {
  const [assignments, setAssignments] = useState<TrainingAssignment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listAssignments().then((a) => {
      setAssignments(a.filter((x) => x.scheduled_date || x.training_mode === 'Classroom'));
      setLoading(false);
    });
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
      columns={columns} data={assignments} loading={loading}
    />
  );
}

export function NewEmployeeTrainingPage() {
  const rows = [
    { id: '1', employee_name: 'Suresh Patel', department: 'Production', stage: 'TNI Preparation' },
    { id: '2', employee_name: 'Kavita Nair', department: 'QA', stage: 'SOP Assignment' },
  ];
  const columns: ColumnDef<{ id: string; employee_name: string; department: string; stage: string }>[] = [
    { key: 'emp', header: 'Employee', render: (r) => r.employee_name },
    { key: 'dept', header: 'Department', render: (r) => r.department },
    { key: 'stage', header: 'Stage', render: (r) => <TmsStatusBadge status={r.stage} /> },
  ];

  return (
    <EnterpriseListPage
      title="New Employee Training"
      description="New joiner training program — linked to induction workflow"
      trail={[{ label: 'Programs' }, { label: 'New Employee' }]}
      showWorkflow
      kpis={[
        { label: 'New Joiners', value: rows.length, tone: 'blue' },
        { label: 'In Progress', value: rows.length, tone: 'amber' },
        { label: 'Completed', value: 0, tone: 'green' },
      ]}
      columns={columns}
      data={rows}
      loading={false}
    />
  );
}

export function RefresherTrainingPage() {
  return (
    <div className="space-y-4">
      <TmsPageHeader title="Refresher Training" description="Periodic refresher scheduling & compliance"
        trail={[{ label: 'Programs' }, { label: 'Refresher' }]}
        actions={<Button variant="outline" size="sm" asChild><Link href="/training/retraining">Open Retraining Module</Link></Button>} />
      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard label="Due This Month" value={15} tone="amber" />
        <KpiCard label="Completed" value={42} tone="green" />
        <KpiCard label="Overdue" value={5} tone="red" />
      </div>
    </div>
  );
}

// Trainer sub-modules — delegate to train-the-trainer
export { TrainTheTrainerPage as TrainerAssessmentPage } from '@/components/training/train-the-trainer/train-the-trainer-page';
export { TrainTheTrainerPage as CertifiedTrainerListPage } from '@/components/training/train-the-trainer/train-the-trainer-page';
export { TrainTheTrainerPage as TrainerCertificatePage } from '@/components/training/train-the-trainer/train-the-trainer-page';
