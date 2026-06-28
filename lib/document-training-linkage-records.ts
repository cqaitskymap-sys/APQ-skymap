import type {
  DocumentTrainingLinkRecord, TrainingLinkageKpis, TrainingLinkageCharts, TrainingLinkageFilters,
} from './document-training-linkage-types';

function todayStr() { return new Date().toISOString().split('T')[0]; }

export function mapTrainingLinkRaw(raw: Record<string, unknown> & { id: string }): DocumentTrainingLinkRecord {
  return {
    id: raw.id,
    training_link_id: (raw.training_link_id as string) || raw.id,
    document_id: (raw.document_id as string) || '',
    document_number: (raw.document_number as string) || '',
    document_title: (raw.document_title as string) || '',
    document_type: (raw.document_type as string) || '',
    version: (raw.version as string) || '',
    department: (raw.department as string) || '',
    site: (raw.site as string) || '',
    business_unit: (raw.business_unit as string) || '',
    training_required: raw.training_required !== false,
    training_type: (raw.training_type as string) || 'Read & Acknowledge',
    training_program: (raw.training_program as string) || (raw.training_title as string) || '',
    training_program_id: (raw.training_program_id as string) || (raw.training_master_id as string) || null,
    qualification_required: Boolean(raw.qualification_required),
    competency_level: (raw.competency_level as string) || 'Competent',
    employee_groups: Array.isArray(raw.employee_groups) ? raw.employee_groups as string[] : [],
    assigned_employees: Array.isArray(raw.assigned_employees) ? raw.assigned_employees as string[] : [],
    assignment_method: (raw.assignment_method as string) || 'Automatic',
    training_due_date: (raw.training_due_date as string) || (raw.due_date as string) || '',
    grace_period_days: (raw.grace_period_days as number) || 7,
    retraining_required: Boolean(raw.retraining_required),
    retraining_trigger: (raw.retraining_trigger as string) || 'Major Revision',
    completion_requirement: (raw.completion_requirement as string) || 'Complete training and assessment',
    assessment_required: raw.assessment_required !== false,
    passing_score: (raw.passing_score as number) || 80,
    electronic_signature_required: Boolean(raw.electronic_signature_required),
    acknowledgement_required: raw.acknowledgement_required !== false,
    status: (raw.status as string) || 'Draft',
    assignments_count: (raw.assignments_count as number) || 0,
    completed_count: (raw.completed_count as number) || 0,
    overdue_count: (raw.overdue_count as number) || 0,
    created_by: (raw.created_by as string) || '',
    created_by_name: (raw.created_by_name as string) || '',
    updated_by: (raw.updated_by as string) || '',
    updated_by_name: (raw.updated_by_name as string) || '',
    created_at: (raw.created_at as string) || '',
    updated_at: (raw.updated_at as string) || '',
  };
}

export function emptyTrainingLinkageKpis(): TrainingLinkageKpis {
  return {
    linkedDocuments: 0, activeAssignments: 0, completedTraining: 0, overdueTraining: 0,
    retrainingAssignments: 0, awaitingQualification: 0, compliancePct: 0, acknowledgementsPending: 0,
  };
}

export function emptyTrainingLinkageCharts(): TrainingLinkageCharts {
  return {
    completionTrend: [], assignmentTrend: [], departmentCompliance: [],
    roleCompliance: [], trainingTypeDistribution: [], retrainingTrend: [], assessmentPassRate: [],
  };
}

export function computeTrainingLinkageKpis(records: DocumentTrainingLinkRecord[]): TrainingLinkageKpis {
  const totalAssignments = records.reduce((s, r) => s + r.assignments_count, 0);
  const completed = records.reduce((s, r) => s + r.completed_count, 0);
  const overdue = records.reduce((s, r) => s + r.overdue_count, 0);
  const active = records.filter((r) => ['Assigned', 'In Progress', 'Pending Assignment'].includes(r.status)).length;
  return {
    linkedDocuments: records.length,
    activeAssignments: totalAssignments - completed,
    completedTraining: completed,
    overdueTraining: overdue,
    retrainingAssignments: records.filter((r) => r.retraining_required && r.status !== 'Completed').length,
    awaitingQualification: records.filter((r) => r.qualification_required && r.status !== 'Completed').length,
    compliancePct: totalAssignments ? Math.round((completed / totalAssignments) * 100) : 100,
    acknowledgementsPending: records.filter((r) => r.acknowledgement_required && r.status !== 'Completed').length,
  };
}

export function computeTrainingLinkageCharts(records: DocumentTrainingLinkRecord[]): TrainingLinkageCharts {
  const byMonthComplete = new Map<string, number>();
  const byMonthAssign = new Map<string, number>();
  const byDept = new Map<string, { total: number; done: number }>();
  const byType = new Map<string, number>();
  const retrainByMonth = new Map<string, number>();

  for (const r of records) {
    byType.set(r.training_type || 'Unknown', (byType.get(r.training_type || 'Unknown') || 0) + 1);
    const dept = r.department || 'Unknown';
    const d = byDept.get(dept) || { total: 0, done: 0 };
    d.total += r.assignments_count;
    d.done += r.completed_count;
    byDept.set(dept, d);
    if (r.created_at) {
      const m = r.created_at.slice(0, 7);
      byMonthAssign.set(m, (byMonthAssign.get(m) || 0) + r.assignments_count);
    }
    if (r.completed_count && r.updated_at) {
      const m = r.updated_at.slice(0, 7);
      byMonthComplete.set(m, (byMonthComplete.get(m) || 0) + r.completed_count);
    }
    if (r.retraining_required && r.created_at) {
      const m = r.created_at.slice(0, 7);
      retrainByMonth.set(m, (retrainByMonth.get(m) || 0) + 1);
    }
  }

  const sortMonths = (entries: [string, number][]) =>
    entries.sort(([a], [b]) => a.localeCompare(b)).slice(-12);

  return {
    completionTrend: sortMonths(Array.from(byMonthComplete.entries())).map(([month, count]) => ({ month, count })),
    assignmentTrend: sortMonths(Array.from(byMonthAssign.entries())).map(([month, count]) => ({ month, count })),
    departmentCompliance: Array.from(byDept.entries()).map(([name, v]) => ({
      name, value: v.total ? Math.round((v.done / v.total) * 100) : 100,
    })),
    roleCompliance: [],
    trainingTypeDistribution: Array.from(byType.entries()).map(([name, value]) => ({ name, value })),
    retrainingTrend: sortMonths(Array.from(retrainByMonth.entries())).map(([month, count]) => ({ month, count })),
    assessmentPassRate: sortMonths(Array.from(byMonthComplete.entries())).map(([month, count]) => {
      const assign = byMonthAssign.get(month) || count;
      return { month, pct: assign ? Math.round((count / assign) * 100) : 100 };
    }),
  };
}

export function filterTrainingLinkRecords(records: DocumentTrainingLinkRecord[], filters: TrainingLinkageFilters): DocumentTrainingLinkRecord[] {
  let result = [...records];
  if (filters.status) result = result.filter((r) => r.status === filters.status);
  if (filters.department) result = result.filter((r) => r.department === filters.department);
  if (filters.document_type) result = result.filter((r) => r.document_type === filters.document_type);
  if (filters.training_type) result = result.filter((r) => r.training_type === filters.training_type);
  if (filters.assignment_method) result = result.filter((r) => r.assignment_method === filters.assignment_method);
  if (filters.overdue) result = result.filter((r) => r.status === 'Overdue' || r.overdue_count > 0);
  if (filters.active) result = result.filter((r) => ['Assigned', 'In Progress', 'Pending Assignment'].includes(r.status));
  if (filters.completed) result = result.filter((r) => r.status === 'Completed');
  if (filters.retraining) result = result.filter((r) => r.retraining_required);
  if (filters.search) {
    const q = filters.search.toLowerCase();
    result = result.filter((r) =>
      r.document_number.toLowerCase().includes(q) ||
      r.document_title.toLowerCase().includes(q) ||
      r.training_link_id.toLowerCase().includes(q),
    );
  }
  return result;
}

export function getRecentAssignments(records: DocumentTrainingLinkRecord[]) {
  return records.filter((r) => r.assignments_count > 0)
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, 20);
}

export function getOverdueTraining(records: DocumentTrainingLinkRecord[]) {
  return records.filter((r) => r.status === 'Overdue' || r.overdue_count > 0)
    .sort((a, b) => a.training_due_date.localeCompare(b.training_due_date));
}

export function getUpcomingDue(records: DocumentTrainingLinkRecord[]) {
  const today = todayStr();
  const in30 = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];
  return records.filter((r) =>
    r.training_due_date >= today && r.training_due_date <= in30 && !['Completed', 'Cancelled'].includes(r.status),
  ).sort((a, b) => a.training_due_date.localeCompare(b.training_due_date));
}

export function getRetrainingQueue(records: DocumentTrainingLinkRecord[]) {
  return records.filter((r) => r.retraining_required && r.status !== 'Completed');
}

export function getPendingQualification(records: DocumentTrainingLinkRecord[]) {
  return records.filter((r) => r.qualification_required && r.status !== 'Completed');
}

export function getRecentCompletions(records: DocumentTrainingLinkRecord[]) {
  return records.filter((r) => r.status === 'Completed')
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, 20);
}

export const DTL_KPI_FILTER_MAP: Record<string, Partial<TrainingLinkageFilters>> = {
  linked: { active: true },
  active: { active: true },
  overdue: { overdue: true },
  completed: { completed: true },
  retraining: { retraining: true },
};
