import { normalizeRole } from '@/lib/permissions';
import { isOverdue } from '@/lib/training-types';
import type { TrainingCertificateRecord } from '@/lib/training-certificate-types';
import type { RetrainingRecord } from '@/lib/training-retraining-types';
import type {
  TrainingAssignment, TrainingRecord,
  CompetencyRecord, TrainingMatrixDefinition, EmployeeProfile,
} from '@/lib/training-types';
import {
  type TrainingHistoryEntry, type HistoryFilters, type HistoryDashboardKpis,
  type HistoryDashboardCharts, type EmployeeHistoryData, type EmployeeExtendedProfile,
  type AssessmentHistoryEntry, type CompetencyHistoryEntry, type CertificateHistoryEntry,
  type RetrainingHistoryEntry, type SopRevisionHistoryEntry, type TimelineEvent,
  type MatrixMappingEntry,
  mapAssignmentStatus, isEmployeeHistoryView, isDepartmentHistoryView, canManageTrainingHistory,
} from './training-history-types';

function today() { return new Date().toISOString().slice(0, 10); }

export function buildExtendedProfile(
  emp: EmployeeProfile | null,
  employeeId: string,
): EmployeeExtendedProfile | null {
  if (!emp) return null;
  return {
    id: emp.id,
    employee_id: emp.employee_id || emp.id,
    employee_number: emp.employee_id || emp.id.slice(0, 8).toUpperCase(),
    employee_name: emp.full_name,
    department: emp.department,
    designation: emp.designation,
    role: emp.designation,
    location: '',
    joining_date: '',
    reporting_manager: '',
    employment_status: 'Active',
    email: emp.email,
  };
}

export function assignmentToHistory(
  a: TrainingAssignment,
  certMap: Map<string, TrainingCertificateRecord>,
  retrainMap: Map<string, RetrainingRecord>,
): TrainingHistoryEntry {
  const cert = certMap.get(a.employee_id + a.training_title) || certMap.get(a.id);
  const retrain = retrainMap.get(a.id);
  const status = mapAssignmentStatus(String(a.status || a.training_status || ''), a.due_date);
  const isExpired = cert?.expiry_date ? cert.expiry_date < today() : false;
  const finalStatus = isExpired && status === 'Completed' ? 'Expired' : status;

  return {
    id: `asn-${a.id}`,
    training_number: a.training_number,
    training_topic: a.training_title || a.training_topic || '',
    training_type: a.training_type || 'GMP',
    training_category: a.source === 'retraining' ? 'Retraining' : 'Initial',
    trainer: a.trainer_name || '',
    training_mode: a.training_mode || 'Classroom',
    document_number: a.document_number || '',
    document_version: a.sop_version || '',
    sop_number: a.document_number || '',
    assignment_date: a.assigned_date,
    training_date: a.scheduled_date || a.completion_date || a.assigned_date,
    completion_date: a.completion_date,
    assessment_score: a.assessment_score,
    passing_score: 80,
    training_result: a.pass_fail || '',
    competency_level: '',
    certificate_number: cert?.certificate_number || null,
    certificate_expiry: cert?.expiry_date || null,
    retraining_required: Boolean(retrain) || a.status === 'retraining',
    retraining_due: retrain?.due_date || null,
    training_status: retrain && !retrain.completion_date ? 'Retraining Scheduled' : finalStatus,
    employee_id: a.employee_id,
    employee_name: a.employee_name,
    department: a.department,
    source: 'assignment',
    source_id: a.id,
    is_overdue: status === 'Overdue' || isOverdue(a.due_date, a.status),
    is_expired_cert: isExpired,
    created_at: a.created_at || a.assigned_date,
  };
}

export function recordToHistory(r: TrainingRecord, cert?: TrainingCertificateRecord): TrainingHistoryEntry {
  const isExpired = cert?.expiry_date ? cert.expiry_date < today() : false;
  return {
    id: `rec-${r.id}`,
    training_number: r.training_number,
    training_topic: r.training_topic,
    training_type: r.training_type || 'GMP',
    training_category: 'Initial',
    trainer: r.trainer,
    training_mode: r.training_mode,
    document_number: r.document_number,
    document_version: r.sop_version,
    sop_number: r.document_number,
    assignment_date: r.training_date,
    training_date: r.training_date,
    completion_date: r.completion_status === 'Completed' ? r.training_date : null,
    assessment_score: r.assessment_score,
    passing_score: r.pass_marks,
    training_result: r.training_result,
    competency_level: '',
    certificate_number: cert?.certificate_number || null,
    certificate_expiry: cert?.expiry_date || null,
    retraining_required: false,
    retraining_due: null,
    training_status: r.completion_status === 'Completed'
      ? (isExpired ? 'Expired' : 'Completed')
      : mapAssignmentStatus(r.completion_status),
    employee_id: r.employee_id,
    employee_name: r.employee_name,
    department: r.department,
    source: 'record',
    source_id: r.id,
    is_overdue: false,
    is_expired_cert: isExpired,
    created_at: r.created_at,
  };
}

export function dedupeHistory(entries: TrainingHistoryEntry[]): TrainingHistoryEntry[] {
  const seen = new Set<string>();
  const out: TrainingHistoryEntry[] = [];
  const sorted = [...entries].sort((a, b) => b.created_at.localeCompare(a.created_at));
  for (const e of sorted) {
    const key = `${e.employee_id}:${e.training_number}:${e.training_topic}:${e.completion_date || e.assignment_date}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(e);
  }
  return out;
}

export function applyHistoryFilters(entries: TrainingHistoryEntry[], filters: HistoryFilters): TrainingHistoryEntry[] {
  const q = filters.search?.toLowerCase() || '';
  return entries.filter((e) => {
    const matchSearch = !q
      || e.training_number.toLowerCase().includes(q)
      || e.training_topic.toLowerCase().includes(q)
      || e.employee_name.toLowerCase().includes(q)
      || e.document_number.toLowerCase().includes(q);
    const matchDept = !filters.department || e.department === filters.department;
    const matchEmp = !filters.employee_id || e.employee_id === filters.employee_id;
    const matchType = !filters.training_type || filters.training_type === 'all'
      || e.training_type.toLowerCase().includes(filters.training_type.toLowerCase());
    const matchStatus = !filters.status || filters.status === 'all' || e.training_status === filters.status;
    const matchFrom = !filters.date_from || (e.completion_date || e.assignment_date) >= filters.date_from;
    const matchTo = !filters.date_to || (e.completion_date || e.assignment_date) <= filters.date_to;
    return matchSearch && matchDept && matchEmp && matchType && matchStatus && matchFrom && matchTo;
  });
}

export function filterHistoryByRole(
  entries: TrainingHistoryEntry[],
  role?: string | null,
  userId?: string,
  userDepartment?: string,
): TrainingHistoryEntry[] {
  const r = normalizeRole(role || '');
  if (canManageTrainingHistory(r) || ['auditor', 'viewer'].includes(r)) return entries;
  if (isEmployeeHistoryView(r) && userId) {
    return entries.filter((e) => e.employee_id === userId);
  }
  if (isDepartmentHistoryView(r) && userDepartment) {
    return entries.filter((e) => e.department.toLowerCase() === userDepartment.toLowerCase());
  }
  if (userId) return entries.filter((e) => e.employee_id === userId);
  return entries;
}

export function buildTimeline(
  history: TrainingHistoryEntry[],
  assessments: AssessmentHistoryEntry[],
  competency: CompetencyHistoryEntry[],
  certificates: CertificateHistoryEntry[],
  retraining: RetrainingHistoryEntry[],
  sopRevisions: SopRevisionHistoryEntry[],
): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  history.forEach((h) => {
    events.push({
      id: `tl-${h.id}`,
      date: h.completion_date || h.training_date || h.assignment_date,
      title: h.training_topic,
      description: `${h.training_status} — ${h.trainer || 'N/A'}`,
      type: 'training',
      status: String(h.training_status),
    });
  });
  assessments.forEach((a) => {
    events.push({
      id: `tl-asn-${a.id}`,
      date: a.assessed_at.slice(0, 10),
      title: `Assessment: ${a.training_topic}`,
      description: `Score: ${a.assessment_score ?? '—'} — ${a.result}`,
      type: 'assessment',
      status: a.result,
    });
  });
  competency.forEach((c) => {
    events.push({
      id: `tl-comp-${c.id}`,
      date: c.updated_at.slice(0, 10),
      title: `Competency: ${c.skill}`,
      description: `${c.current_level} / Required: ${c.required_level}`,
      type: 'competency',
      status: c.gap ? 'Gap' : 'Competent',
    });
  });
  certificates.forEach((c) => {
    events.push({
      id: `tl-cert-${c.id}`,
      date: c.issue_date,
      title: `Certificate: ${c.training_topic}`,
      description: `Expires ${c.expiry_date} — ${c.status}`,
      type: 'certificate',
      status: c.status,
    });
  });
  retraining.forEach((r) => {
    events.push({
      id: `tl-rtr-${r.id}`,
      date: r.completion_date || r.due_date,
      title: `Retraining: ${r.training_topic}`,
      description: `${r.trigger_type} — ${r.status}`,
      type: 'retraining',
      status: r.status,
    });
  });
  sopRevisions.forEach((s) => {
    events.push({
      id: `tl-sop-${s.id}`,
      date: s.effective_date,
      title: `SOP Revision: ${s.sop_number}`,
      description: `v${s.document_version} — ${s.training_topic}`,
      type: 'sop',
      status: s.status,
    });
  });

  return events.sort((a, b) => b.date.localeCompare(a.date));
}

export function computeHistoryDashboard(
  profile: EmployeeExtendedProfile | null,
  history: TrainingHistoryEntry[],
  assessments: AssessmentHistoryEntry[],
  competency: CompetencyHistoryEntry[],
  certificates: CertificateHistoryEntry[],
  retraining: RetrainingHistoryEntry[],
  sopRevisions: SopRevisionHistoryEntry[],
  matrixMapping: MatrixMappingEntry[],
  auditEvents: TimelineEvent[],
): EmployeeHistoryData {
  const completed = history.filter((h) => h.training_status === 'Completed');
  const pending = history.filter((h) => ['Assigned', 'In Progress', 'Retraining Scheduled'].includes(String(h.training_status)));
  const failed = history.filter((h) => h.training_status === 'Failed');
  const overdue = history.filter((h) => h.is_overdue || h.training_status === 'Overdue');
  const expiredCerts = certificates.filter((c) => c.expiry_date < today() || c.status === 'Expired');
  const upcomingRetrain = retraining.filter((r) => !['Completed', 'Closed', 'Cancelled'].includes(r.status));

  const scores = assessments.filter((a) => a.assessment_score != null).map((a) => a.assessment_score!);
  const avgScore = scores.length ? Math.round(scores.reduce((s, v) => s + v, 0) / scores.length) : 0;

  const compGaps = competency.filter((c) => c.gap && c.gap !== 'None' && c.gap !== '');
  const compScore = competency.length
    ? Math.round(((competency.length - compGaps.length) / competency.length) * 100) : 100;

  const completionTrend: Record<string, number> = {};
  const scoreTrend: Record<string, { sum: number; count: number }> = {};
  const compTrend: Record<string, { competent: number; total: number }> = {};
  const certExpiryTrend: Record<string, number> = {};
  const typeDist: Record<string, number> = {};

  completed.forEach((h) => {
    const m = (h.completion_date || h.training_date || '').slice(0, 7);
    if (m) completionTrend[m] = (completionTrend[m] || 0) + 1;
  });
  assessments.forEach((a) => {
    const m = a.assessed_at.slice(0, 7);
    if (!scoreTrend[m]) scoreTrend[m] = { sum: 0, count: 0 };
    if (a.assessment_score != null) {
      scoreTrend[m].sum += a.assessment_score;
      scoreTrend[m].count++;
    }
  });
  competency.forEach((c) => {
    const m = c.updated_at.slice(0, 7);
    if (!compTrend[m]) compTrend[m] = { competent: 0, total: 0 };
    compTrend[m].total++;
    if (!c.gap || c.gap === 'None') compTrend[m].competent++;
  });
  certificates.forEach((c) => {
    if (c.expiry_date) certExpiryTrend[c.expiry_date.slice(0, 7)] = (certExpiryTrend[c.expiry_date.slice(0, 7)] || 0) + 1;
  });
  history.forEach((h) => {
    typeDist[h.training_type] = (typeDist[h.training_type] || 0) + 1;
  });

  const last6: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    last6.push(d.toISOString().slice(0, 7));
  }

  const kpis: HistoryDashboardKpis = {
    totalTrainings: history.length,
    completed: completed.length,
    pending: pending.length,
    failed: failed.length,
    overdue: overdue.length,
    certificates: certificates.length,
    expiredCertificates: expiredCerts.length,
    upcomingRetraining: upcomingRetrain.length,
    averageAssessmentScore: avgScore,
    competencyScore: compScore,
  };

  const charts: HistoryDashboardCharts = {
    completionTrend: Object.entries(completionTrend).sort().map(([month, count]) => ({ month, count })),
    assessmentScoreTrend: last6.map((month) => {
      const s = scoreTrend[month];
      return { month: month.slice(5), avgScore: s && s.count > 0 ? Math.round(s.sum / s.count) : 0 };
    }),
    competencyTrend: last6.map((month) => {
      const c = compTrend[month];
      return { month: month.slice(5), percent: c && c.total > 0 ? Math.round((c.competent / c.total) * 100) : compScore };
    }),
    certificateExpiryTrend: Object.entries(certExpiryTrend).sort().map(([month, count]) => ({ month, count })),
    trainingTypeDistribution: Object.entries(typeDist).map(([name, value]) => ({ name, value })),
  };

  const timeline = buildTimeline(history, assessments, competency, certificates, retraining, sopRevisions);

  return {
    profile,
    kpis,
    charts,
    history,
    assessments,
    competency,
    certificates,
    retraining,
    sopRevisions,
    matrixMapping,
    timeline,
    auditEvents,
  };
}

export function buildAssessments(records: TrainingRecord[], assignments: TrainingAssignment[]): AssessmentHistoryEntry[] {
  const fromRecords = records.filter((r) => r.assessment_required || r.assessment_score != null).map((r) => ({
    id: r.id,
    training_number: r.training_number,
    training_topic: r.training_topic,
    assessment_score: r.assessment_score,
    passing_score: r.pass_marks,
    result: r.training_result,
    assessed_at: r.training_date || r.created_at,
    trainer: r.trainer,
  }));
  const fromAssign = assignments.filter((a) => a.assessment_score != null).map((a) => ({
    id: a.id,
    training_number: a.training_number,
    training_topic: a.training_title,
    assessment_score: a.assessment_score,
    passing_score: 80,
    result: a.pass_fail || '',
    assessed_at: a.completion_date || a.updated_at,
    trainer: a.trainer_name,
  }));
  const seen = new Set<string>();
  return [...fromRecords, ...fromAssign].filter((a) => {
    const key = `${a.training_number}:${a.assessed_at}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort((a, b) => b.assessed_at.localeCompare(a.assessed_at));
}

export function buildCompetency(comp: CompetencyRecord[]): CompetencyHistoryEntry[] {
  return comp.map((c) => ({
    id: c.id,
    skill: c.skill,
    required_level: c.required_level,
    current_level: c.current_level || c.competency_level,
    competency_level: c.competency_level,
    gap: c.gap,
    updated_at: c.updated_at || c.created_at,
  }));
}

export function buildCertificates(certs: TrainingCertificateRecord[]): CertificateHistoryEntry[] {
  const todayStr = today();
  return certs.map((c) => ({
    id: c.id,
    certificate_number: c.certificate_number,
    training_topic: c.training_topic,
    issue_date: c.issue_date,
    expiry_date: c.expiry_date,
    status: c.expiry_date < todayStr ? 'Expired' : String(c.certificate_status),
    verification_code: c.verification_code,
  }));
}

export function buildRetrainingHistory(records: RetrainingRecord[]): RetrainingHistoryEntry[] {
  return records.map((r) => ({
    id: r.id,
    retraining_number: r.retraining_number,
    training_topic: r.training_topic,
    trigger_type: r.trigger_type,
    due_date: r.due_date,
    status: String(r.retraining_status),
    completion_date: r.completion_date,
  }));
}

export function buildSopRevisions(assignments: TrainingAssignment[]): SopRevisionHistoryEntry[] {
  return assignments
    .filter((a) => a.source?.includes('sop') || a.source?.includes('revision') || a.document_number)
    .map((a) => ({
      id: a.id,
      sop_number: a.document_number || '',
      document_version: a.sop_version || '',
      training_topic: a.training_title,
      effective_date: a.assigned_date,
      status: String(a.training_status || a.status),
    }));
}

export function buildMatrixMapping(
  matrix: TrainingMatrixDefinition[],
  history: TrainingHistoryEntry[],
  employeeDept: string,
  employeeDesignation: string,
): MatrixMappingEntry[] {
  const completedTopics = new Set(history.filter((h) => h.training_status === 'Completed').map((h) => h.training_topic));
  return matrix
    .filter((m) => m.department === employeeDept || m.designation === employeeDesignation)
    .map((m) => ({
      id: m.id,
      training_topic: m.training_topic,
      training_type: m.training_type,
      document_number: m.document_number,
      sop_number: m.sop_number,
      training_frequency: m.training_frequency,
      status: m.status,
      mapped: completedTopics.has(m.training_topic),
    }));
}
