import { normalizeRole } from '@/lib/permissions';
import {
  calculateRpn,
  rpnToLevel,
  type CcRiskChartData,
  type CcRiskDashboardMetrics,
  type CcRiskMatrixCell,
  type ChangeControlRecord,
  type ChangeRiskAssessment,
} from '@/lib/change-control-types';

export const CC_RISK_MODULE = 'Change Risk Assessment';

export type CcRiskActor = {
  id: string;
  name: string;
  role?: string;
  department?: string;
  email?: string;
};

export interface CcRiskRowInput {
  change_id: string;
  assessment_id?: string;
  risk_description: string;
  risk_category: string;
  potential_failure_mode?: string;
  potential_impact?: string;
  potential_cause?: string;
  existing_controls?: string;
  severity: number;
  occurrence: number;
  detection: number;
  mitigation_plan?: string;
  residual_severity?: number | null;
  residual_occurrence?: number | null;
  residual_detection?: number | null;
  capa_required?: boolean;
  validation_required?: boolean;
  linked_capa_id?: string | null;
  linked_capa_number?: string | null;
}

export interface CcRiskHeaderInput {
  change_id: string;
  assessment_date: string;
  assessed_by: string;
  assessed_by_name?: string;
  department: string;
}

export interface CcRiskQaReviewInput {
  decision: 'approved' | 'rejected';
  qa_comments: string;
  head_qa_comments?: string;
}

const HIGH_LEVELS = ['High', 'Critical'];

export function ccRiskLevelColor(level?: string): string {
  const map: Record<string, string> = {
    Low: 'bg-green-100 text-green-800',
    Medium: 'bg-amber-100 text-amber-800',
    High: 'bg-orange-100 text-orange-800',
    Critical: 'bg-red-100 text-red-800',
  };
  return map[level || ''] || 'bg-slate-100 text-slate-700';
}

export function ccRiskStatusColor(status?: string): string {
  const map: Record<string, string> = {
    Draft: 'bg-slate-100 text-slate-700',
    'Under Review': 'bg-blue-100 text-blue-800',
    'QA Review': 'bg-purple-100 text-purple-800',
    Approved: 'bg-green-100 text-green-800',
    Rejected: 'bg-red-100 text-red-800',
  };
  return map[status || ''] || map.Draft;
}

export function computeCcRiskScores(severity: number, occurrence: number, detection: number) {
  const rpn = calculateRpn(severity, occurrence, detection);
  return { rpn, risk_level: rpnToLevel(rpn) };
}

export function computeResidualRisk(
  severity?: number | null,
  occurrence?: number | null,
  detection?: number | null,
) {
  if (!severity || !occurrence || !detection) return { residual_rpn: null, residual_risk_level: null };
  const residual_rpn = calculateRpn(severity, occurrence, detection);
  return { residual_rpn, residual_risk_level: rpnToLevel(residual_rpn) };
}

export function isMitigationRequired(riskLevel: string): boolean {
  return HIGH_LEVELS.includes(riskLevel);
}

export function requiresHeadQaForResidual(residualLevel?: string | null): boolean {
  return Boolean(residualLevel && HIGH_LEVELS.includes(residualLevel));
}

export function requiresCsvReview(rows: ChangeRiskAssessment[]): boolean {
  return rows.some((r) => r.risk_category === 'CSV / Data Integrity');
}

export function requiresRegulatoryReview(rows: ChangeRiskAssessment[]): boolean {
  return rows.some((r) => r.risk_category === 'Regulatory Compliance');
}

export function requiresPatientSafetyNotification(rows: ChangeRiskAssessment[]): boolean {
  return rows.some((r) => r.risk_category === 'Patient Safety');
}

export function computeOverallRiskLevel(rows: ChangeRiskAssessment[]): string {
  const levels = rows.filter((r) => !r.is_deleted && r.record_type !== 'header').map((r) => r.risk_level);
  if (levels.includes('Critical')) return 'Critical';
  if (levels.includes('High')) return 'High';
  if (levels.includes('Medium')) return 'Medium';
  return levels.length ? 'Low' : 'Low';
}

export function computeResidualOverallRiskLevel(rows: ChangeRiskAssessment[]): string {
  const levels = rows
    .filter((r) => !r.is_deleted && r.record_type !== 'header' && r.residual_risk_level)
    .map((r) => r.residual_risk_level as string);
  if (levels.includes('Critical')) return 'Critical';
  if (levels.includes('High')) return 'High';
  if (levels.includes('Medium')) return 'Medium';
  return levels.length ? 'Low' : 'Low';
}

export function buildRiskAssessmentId(changeNumber: string): string {
  return `CC-RA-${changeNumber.replace(/\s+/g, '-')}-${Date.now().toString(36).toUpperCase()}`;
}

export function buildRiskRowId(changeNumber: string, seq: number): string {
  return `CC-RISK-${changeNumber.replace(/\s+/g, '-')}-${String(seq).padStart(3, '0')}`;
}

export function buildRiskMatrix(rows: ChangeRiskAssessment[]): CcRiskMatrixCell[] {
  const cells = new Map<string, CcRiskMatrixCell>();
  for (const row of rows.filter((r) => !r.is_deleted && r.record_type !== 'header')) {
    const key = `${row.severity}-${row.occurrence}`;
    const det = row.detection ?? row.detectability ?? 1;
    const rpn = row.rpn || calculateRpn(row.severity, row.occurrence, det);
    const existing = cells.get(key);
    if (existing) {
      existing.count += 1;
      existing.maxRpn = Math.max(existing.maxRpn, rpn);
      existing.level = rpnToLevel(existing.maxRpn);
    } else {
      cells.set(key, {
        severity: row.severity,
        occurrence: row.occurrence,
        count: 1,
        maxRpn: rpn,
        level: rpnToLevel(rpn),
      });
    }
  }
  return Array.from(cells.values());
}

export function computeCcRiskDashboardMetrics(rows: ChangeRiskAssessment[]): CcRiskDashboardMetrics {
  const active = rows.filter((r) => !r.is_deleted && r.record_type !== 'header');
  return {
    totalRisks: active.length,
    lowRisks: active.filter((r) => r.risk_level === 'Low').length,
    mediumRisks: active.filter((r) => r.risk_level === 'Medium').length,
    highRisks: active.filter((r) => r.risk_level === 'High').length,
    criticalRisks: active.filter((r) => r.risk_level === 'Critical').length,
    mitigationRequired: active.filter((r) => r.mitigation_required || isMitigationRequired(r.risk_level)).length,
    residualHighRisks: active.filter((r) => requiresHeadQaForResidual(r.residual_risk_level)).length,
    capaLinkedRisks: active.filter((r) => Boolean(r.linked_capa_id) || r.capa_required).length,
  };
}

export function computeCcRiskChartData(
  rows: ChangeRiskAssessment[],
  changes: ChangeControlRecord[] = [],
): CcRiskChartData {
  const active = rows.filter((r) => !r.is_deleted && r.record_type !== 'header');
  const levelMap = new Map<string, number>();
  const residualMap = new Map<string, number>();
  const categoryMap = new Map<string, number>();
  const mitigationMap = new Map<string, number>();
  const highChangeMap = new Map<string, number>();

  for (const r of active) {
    levelMap.set(r.risk_level, (levelMap.get(r.risk_level) || 0) + 1);
    if (r.residual_risk_level) {
      residualMap.set(r.residual_risk_level, (residualMap.get(r.residual_risk_level) || 0) + 1);
    }
    categoryMap.set(r.risk_category || 'Other', (categoryMap.get(r.risk_category || 'Other') || 0) + 1);
    const mStatus = r.mitigation_plan?.trim() ? (r.residual_risk_level ? 'Mitigated' : 'Planned') : 'Pending';
    mitigationMap.set(mStatus, (mitigationMap.get(mStatus) || 0) + 1);
    if (HIGH_LEVELS.includes(r.risk_level)) {
      const cc = changes.find((c) => c.id === r.change_id);
      const label = cc?.change_control_number || r.change_id;
      highChangeMap.set(label, (highChangeMap.get(label) || 0) + 1);
    }
  }

  return {
    riskLevelDistribution: Array.from(levelMap.entries()).map(([name, count]) => ({ name, count })),
    residualRiskDistribution: Array.from(residualMap.entries()).map(([name, count]) => ({ name, count })),
    categoryTrend: Array.from(categoryMap.entries()).map(([name, count]) => ({ name, count })),
    highRiskChanges: Array.from(highChangeMap.entries()).map(([name, count]) => ({ name, count })),
    mitigationStatus: Array.from(mitigationMap.entries()).map(([name, count]) => ({ name, count })),
  };
}

export function canViewCcRisk(role?: string | null): boolean {
  const r = normalizeRole(role || '');
  const raw = (role || '').toLowerCase();
  if (['super_admin', 'admin', 'head_qa', 'qa_manager', 'qa', 'qa_executive', 'auditor', 'viewer'].includes(r)) return true;
  return raw.includes('csv') || raw.includes('regulatory')
    || ['production_manager', 'production', 'qc_manager', 'qc', 'engineering_manager', 'engineering'].includes(r);
}

export function isCcRiskReadOnly(role?: string | null): boolean {
  return ['auditor', 'viewer'].includes(normalizeRole(role || ''));
}

export function canManageCcRisk(role?: string | null, ownerId?: string, userId?: string): boolean {
  if (isCcRiskReadOnly(role)) return false;
  const r = normalizeRole(role || '');
  if (['super_admin', 'admin', 'head_qa', 'qa_manager', 'qa', 'qa_executive'].includes(r)) return true;
  return userId === ownerId;
}

export function canEditRiskCategory(role?: string | null, category?: string): boolean {
  const raw = (role || '').toLowerCase();
  const r = normalizeRole(role || '');
  if (canManageCcRisk(role)) return true;
  if (['Equipment', 'Utility', 'Facility'].includes(category || '') && (raw.includes('engineering') || r === 'engineering_manager')) return true;
  if (['Product Quality'].includes(category || '') && ['qc', 'qc_manager'].includes(r)) return true;
  if (category === 'Process' && ['production', 'production_manager'].includes(r)) return true;
  if (category === 'Regulatory Compliance' && raw.includes('regulatory')) return true;
  if (category === 'CSV / Data Integrity' && raw.includes('csv')) return true;
  return false;
}

export function canApproveCcRisk(role?: string | null): boolean {
  return ['super_admin', 'admin', 'head_qa', 'qa_manager', 'qa', 'qa_executive'].includes(normalizeRole(role || ''));
}

export function canApproveCriticalResidual(role?: string | null): boolean {
  return ['super_admin', 'admin', 'head_qa'].includes(normalizeRole(role || ''));
}

export function validateRiskRowInput(input: CcRiskRowInput): string | null {
  const { rpn, risk_level } = computeCcRiskScores(input.severity, input.occurrence, input.detection);
  if (isMitigationRequired(risk_level) && !input.mitigation_plan?.trim()) {
    return 'Mitigation plan is required for High or Critical risks.';
  }
  if (input.mitigation_plan?.trim()) {
    const residual = computeResidualRisk(input.residual_severity, input.residual_occurrence, input.residual_detection);
    if (!residual.residual_rpn) return 'Residual scores are required after mitigation.';
  }
  void rpn;
  return null;
}

export function mapCcRiskAuditToTimeline(logs: Record<string, unknown>[]) {
  return logs
    .filter((log) => /risk|mitigation|residual|capa|rpn/i.test(String(log.actionType || log.action || '')))
    .map((log) => ({
      action: String(log.actionType || log.action || 'Activity'),
      user: String(log.changedByUserName || log.userName || 'System'),
      at: String(log.dateTime || log.timestamp || log.created_at || ''),
      detail: String(log.reason || log.actionDescription || '').slice(0, 240),
    }))
    .sort((a, b) => (b.at || '').localeCompare(a.at || ''));
}
