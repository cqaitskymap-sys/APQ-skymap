import { normalizeRole } from '@/lib/permissions';
import type { RiskAssessmentRecord } from '@/lib/cpv-risk-assessment-records';
import type { RiskLevel } from '@/lib/cpv';
import { calculateRiskAssessment } from '@/lib/cpv-risk-assessment-records';
import { inferRiskDepartment } from '@/lib/risk-reports-records';

export const RISK_MITIGATION_MODULE = 'Risk Mitigation Plan';
export const RISK_MITIGATION_COLLECTION = 'risk_mitigations';

export const MITIGATION_TYPES = [
  'Preventive Control',
  'Corrective Control',
  'Detective Control',
  'Administrative Control',
  'Engineering Control',
  'Process Control',
  'Training Control',
  'Validation Control',
  'CSV Control',
  'Regulatory Control',
] as const;

export const MITIGATION_PRIORITIES = ['Low', 'Medium', 'High', 'Critical'] as const;
export const MITIGATION_STATUSES = [
  'Draft',
  'Assigned',
  'In Progress',
  'Pending Review',
  'Implemented',
  'Effectiveness Review',
  'Approved',
  'Rejected',
  'Closed',
  'Overdue',
] as const;

export type RiskMitigationActor = { id: string; name: string; role?: string; email?: string };

export interface RiskMitigationRecord {
  id: string;
  mitigation_id: string;
  risk_assessment_id: string;
  risk_number: string;
  risk_title: string;
  risk_category: string;
  initial_rpn: number;
  initial_risk_level: string;
  mitigation_title: string;
  mitigation_description: string;
  mitigation_type: string;
  action_owner: string;
  department: string;
  priority: string;
  target_completion_date: string;
  actual_completion_date?: string;
  mitigation_status: string;
  effectiveness_required: boolean;
  effectiveness_review_date?: string;
  residual_severity: number;
  residual_occurrence: number;
  residual_detection: number;
  residual_rpn: number;
  residual_risk_level: string;
  capa_required: boolean;
  capa_number: string;
  change_control_required: boolean;
  change_control_number: string;
  training_required: boolean;
  training_reference: string;
  validation_required: boolean;
  validation_reference: string;
  remarks: string;
  created_at: string;
  updated_at: string;
  created_by: string;
  created_by_name?: string;
  updated_by: string;
  updated_by_name?: string;
  is_deleted: boolean;
}

export interface RiskMitigationFormInput {
  mitigation_title: string;
  mitigation_description: string;
  mitigation_type: string;
  action_owner: string;
  department: string;
  priority: string;
  target_completion_date: string;
  mitigation_status: string;
  effectiveness_required: boolean;
  effectiveness_review_date: string;
  residual_severity: number;
  residual_occurrence: number;
  residual_detection: number;
  capa_required: boolean;
  capa_number: string;
  change_control_required: boolean;
  change_control_number: string;
  training_required: boolean;
  training_reference: string;
  validation_required: boolean;
  validation_reference: string;
  remarks: string;
}

export interface RiskMitigationDashboardMetrics {
  totalMitigations: number;
  openMitigations: number;
  implementedMitigations: number;
  overdueMitigations: number;
  criticalRiskMitigations: number;
  residualHighRisks: number;
  capaLinkedMitigations: number;
  pendingReviews: number;
}

export interface RiskMitigationChartData {
  statusDistribution: { name: string; count: number }[];
  riskReductionTrend: { name: string; reduction: number }[];
  residualRiskTrend: { name: string; count: number }[];
  departmentProgress: { name: string; open: number; closed: number }[];
  overdueTrend: { name: string; count: number }[];
}

export function calculateResidualRisk(
  residualSeverity: number,
  residualOccurrence: number,
  residualDetection: number,
): { residualRpn: number; residualRiskLevel: RiskLevel } {
  const calc = calculateRiskAssessment(residualSeverity, residualOccurrence, residualDetection);
  return { residualRpn: calc.rpnScore, residualRiskLevel: calc.riskLevel };
}

export function requiresMitigationPlan(risk: RiskAssessmentRecord): boolean {
  return risk.riskLevel === 'High' || risk.riskLevel === 'Critical';
}

export function requiresHeadQaApproval(risk: RiskAssessmentRecord): boolean {
  return risk.riskLevel === 'Critical';
}

export function requiresCsvReview(risk: RiskAssessmentRecord): boolean {
  const text = `${risk.riskCategory} ${risk.riskDescription}`.toLowerCase();
  return text.includes('csv') || text.includes('data integrity');
}

export function requiresRegulatoryReview(risk: RiskAssessmentRecord): boolean {
  const text = `${risk.riskCategory} ${risk.riskDescription}`.toLowerCase();
  return text.includes('regulatory');
}

export function requiresValidationReview(risk: RiskAssessmentRecord): boolean {
  const text = `${risk.riskCategory} ${risk.riskDescription}`.toLowerCase();
  return text.includes('validation') || text.includes('equipment') || text.includes('csv');
}

export function isMitigationOverdue(m: RiskMitigationRecord): boolean {
  if (!m.target_completion_date) return false;
  if (['Closed', 'Approved'].includes(m.mitigation_status)) return false;
  return new Date(`${m.target_completion_date}T23:59:59`) < new Date();
}

export function mitigationStatusColor(status?: string): string {
  const map: Record<string, string> = {
    Draft: 'bg-slate-100 text-slate-700',
    Assigned: 'bg-blue-100 text-blue-800',
    'In Progress': 'bg-amber-100 text-amber-800',
    'Pending Review': 'bg-purple-100 text-purple-800',
    Implemented: 'bg-indigo-100 text-indigo-800',
    'Effectiveness Review': 'bg-cyan-100 text-cyan-800',
    Approved: 'bg-green-100 text-green-800',
    Rejected: 'bg-red-100 text-red-800',
    Closed: 'bg-emerald-100 text-emerald-800',
    Overdue: 'bg-rose-100 text-rose-800',
  };
  return map[status || ''] || map.Draft;
}

export function riskLevelColor(level?: string): string {
  const map: Record<string, string> = {
    Critical: 'bg-red-100 text-red-800',
    High: 'bg-orange-100 text-orange-800',
    Medium: 'bg-amber-100 text-amber-800',
    Low: 'bg-green-100 text-green-800',
  };
  return map[level || ''] || 'bg-slate-100 text-slate-700';
}

export function computeMitigationDashboardMetrics(
  mitigations: RiskMitigationRecord[],
): RiskMitigationDashboardMetrics {
  const active = mitigations.filter((m) => !m.is_deleted);
  return {
    totalMitigations: active.length,
    openMitigations: active.filter((m) => !['Closed', 'Approved'].includes(m.mitigation_status)).length,
    implementedMitigations: active.filter((m) => ['Implemented', 'Approved', 'Closed'].includes(m.mitigation_status)).length,
    overdueMitigations: active.filter(isMitigationOverdue).length,
    criticalRiskMitigations: active.filter((m) => m.initial_risk_level === 'Critical').length,
    residualHighRisks: active.filter((m) => ['High', 'Critical'].includes(m.residual_risk_level)).length,
    capaLinkedMitigations: active.filter((m) => m.capa_required && Boolean(m.capa_number)).length,
    pendingReviews: active.filter((m) => ['Pending Review', 'Effectiveness Review'].includes(m.mitigation_status)).length,
  };
}

export function computeMitigationCharts(mitigations: RiskMitigationRecord[]): RiskMitigationChartData {
  const active = mitigations.filter((m) => !m.is_deleted);
  const statusMap = new Map<string, number>();
  const residualMap = new Map<string, number>();
  const deptMap = new Map<string, { open: number; closed: number }>();
  const overdueByMonth = new Map<string, number>();

  for (const m of active) {
    statusMap.set(m.mitigation_status, (statusMap.get(m.mitigation_status) || 0) + 1);
    residualMap.set(m.residual_risk_level, (residualMap.get(m.residual_risk_level) || 0) + 1);
    const dept = m.department || 'Unknown';
    const cur = deptMap.get(dept) || { open: 0, closed: 0 };
    if (['Approved', 'Closed'].includes(m.mitigation_status)) cur.closed += 1;
    else cur.open += 1;
    deptMap.set(dept, cur);
    if (isMitigationOverdue(m)) {
      const key = (m.target_completion_date || '').slice(0, 7);
      if (key) overdueByMonth.set(key, (overdueByMonth.get(key) || 0) + 1);
    }
  }

  return {
    statusDistribution: Array.from(statusMap.entries()).map(([name, count]) => ({ name, count })),
    riskReductionTrend: active
      .slice(0, 20)
      .map((m) => ({ name: m.risk_number.slice(-8), reduction: Math.max(0, m.initial_rpn - m.residual_rpn) })),
    residualRiskTrend: Array.from(residualMap.entries()).map(([name, count]) => ({ name, count })),
    departmentProgress: Array.from(deptMap.entries()).map(([name, vals]) => ({ name, open: vals.open, closed: vals.closed })),
    overdueTrend: Array.from(overdueByMonth.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([name, count]) => ({ name, count })),
  };
}

export function buildDefaultMitigationForm(risk: RiskAssessmentRecord): RiskMitigationFormInput {
  const target = risk.targetCompletionDate || new Date().toISOString().slice(0, 10);
  const csvReq = requiresCsvReview(risk);
  const valReq = requiresValidationReview(risk);
  const regReq = requiresRegulatoryReview(risk);
  return {
    mitigation_title: risk.mitigationAction?.trim() || `Mitigation for ${risk.riskNumber}`,
    mitigation_description: risk.mitigationAction?.trim() || risk.riskDescription,
    mitigation_type: csvReq ? 'CSV Control' : valReq ? 'Validation Control' : regReq ? 'Regulatory Control' : 'Process Control',
    action_owner: risk.riskOwner,
    department: inferRiskDepartment(risk),
    priority: risk.riskLevel,
    target_completion_date: target,
    mitigation_status: 'Draft',
    effectiveness_required: risk.effectivenessCheckRequired,
    effectiveness_review_date: target,
    residual_severity: Math.max(1, risk.severityScore - 1),
    residual_occurrence: Math.max(1, risk.occurrenceScore - 1),
    residual_detection: Math.max(1, risk.detectionScore - 1),
    capa_required: risk.capaSuggested,
    capa_number: risk.linkedCapaNumber || '',
    change_control_required: Boolean(risk.linkedChangeControlNumber) || regReq,
    change_control_number: risk.linkedChangeControlNumber || '',
    training_required: false,
    training_reference: '',
    validation_required: valReq,
    validation_reference: '',
    remarks: '',
  };
}

export function canViewRiskMitigation(role?: string | null): boolean {
  const r = normalizeRole(role || '');
  return [
    'super_admin', 'admin', 'head_qa', 'qa_manager', 'qa', 'qa_executive',
    'risk_manager', 'department_head', 'validation_manager', 'csv_manager',
    'regulatory_affairs', 'auditor', 'viewer', 'production_manager', 'qc_manager',
  ].includes(r);
}

export function canEditRiskMitigation(role?: string | null): boolean {
  return ['super_admin', 'admin', 'head_qa', 'qa_manager', 'qa', 'qa_executive', 'risk_manager'].includes(normalizeRole(role || ''));
}

export function canApproveRiskMitigation(role?: string | null): boolean {
  return ['super_admin', 'admin', 'head_qa', 'qa_manager', 'qa'].includes(normalizeRole(role || ''));
}

export function isRiskMitigationReadOnly(role?: string | null): boolean {
  return ['auditor', 'viewer'].includes(normalizeRole(role || ''));
}
