'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { KpiCard } from '@/components/cpv/cpv-ui';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { TmsPageHeader } from '@/components/training/tms-page-header';
import { TmsStatusBadge } from '@/components/training/tms-sub-nav';
import { ResponsiveDataTable } from '@/components/cpv/product-master/responsive-data-table';
import type { ColumnDef } from '@/components/admin/admin-data-table';
import { listTrainingRecords, listAssignments } from '@/lib/training-service';
import type { TrainingRecord, TrainingAssignment } from '@/lib/training-types';
import { WorkflowDiagram } from '@/components/training/workflow/workflow-diagram';
import { JR_TRAINING_EXECUTION_WORKFLOW, TRAINING_SESSION_WORKFLOW } from '@/lib/enterprise-tms/workflows';
import { EnterpriseListPage } from '@/components/training/enterprise/enterprise-module-pages';

const ASSESSMENT_TYPES = ['Written', 'Oral', 'Practical', 'Offline'] as const;

export function AssessmentPage() {
  const [records, setRecords] = useState<TrainingRecord[]>([]);
  const [assignments, setAssignments] = useState<TrainingAssignment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([listTrainingRecords(), listAssignments()]).then(([r, a]) => {
      setRecords(r.filter((rec) => rec.assessment_score != null));
      setAssignments(a.filter((x) => x.assessment_score != null));
      setLoading(false);
    });
  }, []);

  const columns: ColumnDef<TrainingRecord>[] = [
    { key: 'emp', header: 'Employee', render: (r) => r.employee_name },
    { key: 'topic', header: 'Topic', render: (r) => r.training_topic },
    { key: 'type', header: 'Type', render: () => <Badge variant="outline">Written</Badge> },
    { key: 'score', header: 'Score', render: (r) => `${r.assessment_score ?? '—'}%` },
    { key: 'result', header: 'Result', render: (r) => <TmsStatusBadge status={String(r.training_result ?? 'Pending')} /> },
    { key: 'date', header: 'Date', render: (r) => r.training_date ?? '—' },
  ];

  const trainerEvalColumns: ColumnDef<TrainingRecord>[] = [
    { key: 'emp', header: 'Trainee', render: (r) => r.employee_name },
    { key: 'topic', header: 'Topic', render: (r) => r.training_topic },
    { key: 'type', header: 'Assessment Type', render: () => <Badge variant="secondary">Oral/Practical</Badge> },
    { key: 'result', header: 'Trainer Evaluation', render: (r) => <TmsStatusBadge status={String(r.training_result ?? 'Pending')} /> },
    { key: 'date', header: 'Date', render: (r) => r.training_date ?? '—' },
  ];

  if (loading) return <LoadingSkeleton rows={6} />;

  const passed = records.filter((r) => r.training_result === 'Pass').length;
  const failed = records.filter((r) => r.training_result === 'Fail').length;
  const locked = records.filter((r) => r.training_result === 'Fail').length;

  return (
    <div className="space-y-6 animate-in fade-in">
      <TmsPageHeader
        title="Assessment"
        description="Assessment type: Oral / Practical / Written — pass, fail (locked), trainer unlock"
        trail={[{ label: 'Session & Assessment' }, { label: 'Assessment' }]}
      />

      <WorkflowDiagram workflow={JR_TRAINING_EXECUTION_WORKFLOW} activeStepId="5" compact />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Total Assessed" value={records.length} tone="blue" />
        <KpiCard label="Passed" value={passed} tone="green" />
        <KpiCard label="Failed / Locked" value={failed} tone="red" />
        <KpiCard label="Pending Evaluation" value={assignments.length} tone="amber" />
      </div>

      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-1">
            {ASSESSMENT_TYPES.map((t) => (
              <Badge key={t} variant="outline" className="text-xs">{t}</Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="written">
        <TabsList>
          <TabsTrigger value="written">Written / Online</TabsTrigger>
          <TabsTrigger value="oral">Oral</TabsTrigger>
          <TabsTrigger value="practical">Practical</TabsTrigger>
          <TabsTrigger value="trainer">Trainer Evaluation</TabsTrigger>
        </TabsList>
        <TabsContent value="written" className="mt-4">
          <Card><CardContent className="pt-6"><ResponsiveDataTable columns={columns} data={records} /></CardContent></Card>
        </TabsContent>
        <TabsContent value="oral" className="mt-4">
          <Card><CardContent className="pt-6">
            <p className="text-sm text-muted-foreground mb-4">Oral assessments evaluated by trainer after classroom session.</p>
            <ResponsiveDataTable columns={trainerEvalColumns} data={records.slice(0, Math.ceil(records.length / 3))} />
          </CardContent></Card>
        </TabsContent>
        <TabsContent value="practical" className="mt-4">
          <Card><CardContent className="pt-6">
            <p className="text-sm text-muted-foreground mb-4">Practical skill evaluation by assigned trainer.</p>
            <ResponsiveDataTable columns={trainerEvalColumns} data={records.slice(Math.ceil(records.length / 3))} />
          </CardContent></Card>
        </TabsContent>
        <TabsContent value="trainer" className="mt-4">
          <Card><CardContent className="pt-6">
            <p className="text-sm text-muted-foreground mb-4">
              Trainer can unlock locked exams with justification (RS-LMS-GEN-005). {locked} locked assessment(s).
            </p>
            <ResponsiveDataTable columns={trainerEvalColumns} data={records.filter((r) => r.training_result === 'Fail')} />
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
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
    <div className="space-y-6">
      <TmsPageHeader
        title="Training Session"
        description="Coordinator creates → HOD approves → conduct session → attendance → exam → trainer evaluation"
        trail={[{ label: 'Session & Assessment' }, { label: 'Training Session' }]}
      />
      <WorkflowDiagram workflow={TRAINING_SESSION_WORKFLOW} activeStepId="3" />
      <div className="grid gap-4 sm:grid-cols-2">
        <KpiCard label="Sessions" value={assignments.length} tone="blue" />
        <KpiCard label="Today" value={assignments.filter((a) => a.scheduled_date === new Date().toISOString().slice(0, 10)).length} tone="green" />
      </div>
      {loading ? <LoadingSkeleton rows={4} /> : (
        <Card><CardContent className="pt-6"><ResponsiveDataTable columns={columns} data={assignments} /></CardContent></Card>
      )}
    </div>
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
