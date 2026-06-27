import { normalizeRole } from '@/lib/permissions';
import { requiresHeadQaApproval } from '@/lib/change-control-types';
import type {
  CcEffectivenessChartData,
  CcEffectivenessDashboardMetrics,
  ChangeControlRecord,
  ChangeEffectivenessReview,
} from '@/lib/change-control-types';

export const CC_EFFECTIVENESS_MODULE = 'Change Control Effectiveness Review';

export type CcEffectivenessActor = {
  id: string;
  name: string;
  role?: string;
  department?: string;
  email?: string;
};

export interface CcEffectivenessFormInput {
  change_id: string;
  review_date: string;
  review_owner: string;
  review_owner_name?: string;
  department: string;
  review_period_start: string;
  review_period_end: string;
  change_objective_achieved: boolean;
  implementation_successful: boolean;
  validation_successful: boolean;
  csv_requirements_met: boolean;
  training_completed: boolean;
  no_adverse_quality_impact: boolean;
  no_regulatory_impact: boolean;
  no_data_integrity_impact: boolean;
  no_patient_safety_impact: boolean;
  performance_improved: boolean;
  process_improved: boolean;
  risk_reduced: boolean;
  deviation_generated: boolean;
  oos_generated: boolean;
  complaint_generated: boolean;
  capa_generated: boolean;
  review_findings: string;
  recommendations?: string;
  additional_actions_required: boolean;
  qa_comments?: string;
  head_qa_comments?: string;
  effectiveness_result?: string;
  effectiveness_score?: number;
  effectiveness_criteria?: string;
  conclusion?: string;
}

export interface CcEffectivenessQaReviewInput {
  decision: 'approved' | 'rejected';
  qa_comments: string;
  head_qa_comments?: string;
}

const SCORE_FIELDS: (keyof CcEffectivenessFormInput)[] = [
  'change_objective_achieved',
  'implementation_successful',
  'validation_successful',
  'training_completed',
  'risk_reduced',
  'process_improved',
  'performance_improved',
];

export function computeCcEffectivenessScore(input: Pick<
  CcEffectivenessFormInput,
  | 'change_objective_achieved'
  | 'implementation_successful'
  | 'validation_successful'
  | 'training_completed'
  | 'risk_reduced'
  | 'process_improved'
  | 'performance_improved'
  | 'deviation_generated'
  | 'oos_generated'
  | 'complaint_generated'
>): number {
  let score = 0;
  if (input.change_objective_achieved) score += 10;
  if (input.implementation_successful) score += 10;
  if (input.validation_successful) score += 10;
  if (input.training_completed) score += 10;
  if (input.risk_reduced) score += 10;
  if (input.process_improved) score += 10;
  if (input.performance_improved) score += 10;
  if (!input.deviation_generated) score += 10;
  if (!input.oos_generated) score += 10;
  if (!input.complaint_generated) score += 10;
  return Math.min(100, Math.max(0, score));
}

export function computeAutoCcEffectivenessResult(score: number): string {
  if (score >= 85) return 'Effective';
  if (score >= 60) return 'Partially Effective';
  return 'Not Effective';
}

export function isCapaRecommendationRequired(result: string): boolean {
  return result === 'Not Effective';
}

export function buildEffectivenessReviewId(changeNumber: string): string {
  return `CC-EFF-${changeNumber.replace(/\s+/g, '-')}-${Date.now().toString(36).toUpperCase()}`;
}

export function canViewCcEffectiveness(role?: string | null): boolean {
  const r = normalizeRole(role || '');
  const raw = (role || '').toLowerCase();
  if (['super_admin', 'admin', 'head_qa', 'qa_manager', 'qa', 'qa_executive', 'auditor', 'viewer'].includes(r)) return true;
  if (raw.includes('validation') || raw.includes('csv') || raw === 'regulatory_affairs' || raw === 'regulatory') return true;
  return raw.includes('production') || raw.includes('engineering') || raw.includes('qc') || raw.includes('warehouse');
}

export function isDepartmentCcEffectivenessViewer(role?: string | null): boolean {
  if (isCcEffectivenessReadOnly(role) || canCreateCcEffectiveness(role)) return false;
  const raw = (role || '').toLowerCase();
  return raw.includes('production') || raw.includes('engineering') || raw.includes('qc') || raw.includes('warehouse');
}

export function canProvideValidationEffectivenessInput(role?: string | null): boolean {
  const raw = (role || '').toLowerCase();
  return canCreateCcEffectiveness(role) || raw.includes('validation');
}

export function canProvideCsvEffectivenessInput(role?: string | null): boolean {
  const raw = (role || '').toLowerCase();
  return canCreateCcEffectiveness(role) || raw.includes('csv');
}

export function canProvideRegulatoryEffectivenessInput(role?: string | null): boolean {
  const raw = (role || '').toLowerCase();
  return canCreateCcEffectiveness(role) || raw === 'regulatory_affairs' || raw === 'regulatory';
}

export function isCcEffectivenessReadOnly(role?: string | null): boolean {
  return ['auditor', 'viewer'].includes(normalizeRole(role || ''));
}

export function canCreateCcEffectiveness(role?: string | null): boolean {
  const r = normalizeRole(role || '');
  return ['super_admin', 'admin', 'head_qa', 'qa_manager', 'qa', 'qa_executive'].includes(r);
}

export function canProvideCcEffectivenessInput(
  role: string | null | undefined,
  change: ChangeControlRecord,
  actorId: string,
): boolean {
  if (isCcEffectivenessReadOnly(role)) return false;
  if (canCreateCcEffectiveness(role)) return true;
  return change.initiated_by === actorId || change.created_by === actorId;
}

export function canApproveCcEffectiveness(role?: string | null): boolean {
  return canCreateCcEffectiveness(role);
}

export function canApproveCriticalCcEffectiveness(role?: string | null, category?: string): boolean {
  if (!requiresHeadQaApproval(category || '')) return canApproveCcEffectiveness(role);
  return ['super_admin', 'head_qa'].includes(normalizeRole(role || ''));
}

export function effectivenessStatusColor(status?: string): string {
  const map: Record<string, string> = {
    Draft: 'bg-slate-100 text-slate-700',
    'Under Review': 'bg-purple-100 text-purple-800',
    'QA Review': 'bg-amber-100 text-amber-800',
    'Head QA Review': 'bg-indigo-100 text-indigo-800',
    Approved: 'bg-green-100 text-green-800',
    Rejected: 'bg-red-100 text-red-800',
    Closed: 'bg-emerald-100 text-emerald-800',
  };
  return map[status || 'Draft'] || map.Draft;
}

export function effectivenessResultColor(result?: string): string {
  const map: Record<string, string> = {
    Effective: 'bg-green-100 text-green-800',
    'Partially Effective': 'bg-amber-100 text-amber-800',
    'Not Effective': 'bg-red-100 text-red-800',
    'Pending Review': 'bg-blue-100 text-blue-800',
  };
  return map[result || ''] || 'bg-slate-100 text-slate-700';
}

export function computeEffectivenessProgress(review?: ChangeEffectivenessReview | null): number {
  if (!review) return 0;
  const map: Record<string, number> = {
    Draft: 10, 'Under Review': 40, 'QA Review': 65, 'Head QA Review': 80,
    Approved: 95, Closed: 100, Rejected: 25,
  };
  return map[review.status || 'Draft'] ?? 0;
}

export function computeCcEffectivenessDashboardMetrics(
  reviews: ChangeEffectivenessReview[],
  changes: ChangeControlRecord[] = [],
): CcEffectivenessDashboardMetrics {
  const active = reviews.filter((r) => !r.is_deleted);
  const scores = active.map((r) => r.effectiveness_score ?? 0).filter((s) => s > 0);
  const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  const changeById = new Map(changes.map((c) => [c.id, c]));
  return {
    total: active.length,
    pendingReviews: active.filter((r) => ['Draft', 'Under Review', 'QA Review', 'Head QA Review'].includes(r.status || '')).length,
    effective: active.filter((r) => (r.effectiveness_result || r.result) === 'Effective').length,
    partiallyEffective: active.filter((r) => (r.effectiveness_result || r.result) === 'Partially Effective').length,
    notEffective: active.filter((r) => (r.effectiveness_result || r.result) === 'Not Effective').length,
    capaRecommended: active.filter((r) => r.capa_recommended || (r.effectiveness_result || r.result) === 'Not Effective').length,
    criticalUnderReview: active.filter((r) => {
      const ch = changeById.get(r.change_id);
      return ch?.change_category === 'Critical' && !['Approved', 'Closed'].includes(r.status || '');
    }).length,
    averageScore: avg,
  };
}

export function computeCcEffectivenessChartData(
  reviews: ChangeEffectivenessReview[],
  changes: ChangeControlRecord[] = [],
): CcEffectivenessChartData {
  const active = reviews.filter((r) => !r.is_deleted);
  const changeById = new Map(changes.map((c) => [c.id, c]));
  const resultMap = new Map<string, number>();
  const monthMap = new Map<string, number>();
  const deptMap = new Map<string, { count: number; scoreSum: number; scoreCount: number }>();
  const typeMap = new Map<string, { count: number; scoreSum: number; scoreCount: number }>();

  for (const r of active) {
    const res = r.effectiveness_result || r.result || 'Pending Review';
    resultMap.set(res, (resultMap.get(res) || 0) + 1);
    const month = r.review_date?.slice(0, 7) || 'Unknown';
    monthMap.set(month, (monthMap.get(month) || 0) + 1);
    const ch = changeById.get(r.change_id);
    const dept = r.department || ch?.department || 'Unknown';
    const deptEntry = deptMap.get(dept) || { count: 0, scoreSum: 0, scoreCount: 0 };
    deptEntry.count += 1;
    if ((r.effectiveness_score ?? 0) > 0) {
      deptEntry.scoreSum += r.effectiveness_score ?? 0;
      deptEntry.scoreCount += 1;
    }
    deptMap.set(dept, deptEntry);
    if (ch?.change_type) {
      const typeEntry = typeMap.get(ch.change_type) || { count: 0, scoreSum: 0, scoreCount: 0 };
      typeEntry.count += 1;
      if ((r.effectiveness_score ?? 0) > 0) {
        typeEntry.scoreSum += r.effectiveness_score ?? 0;
        typeEntry.scoreCount += 1;
      }
      typeMap.set(ch.change_type, typeEntry);
    }
  }

  return {
    resultDistribution: Array.from(resultMap.entries()).map(([name, count]) => ({ name, count })),
    monthlyTrend: Array.from(monthMap.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([name, count]) => ({ name, count })),
    byDepartment: Array.from(deptMap.entries()).map(([name, v]) => ({
      name,
      count: v.count,
      avgScore: v.scoreCount ? Math.round(v.scoreSum / v.scoreCount) : 0,
    })),
    byChangeType: Array.from(typeMap.entries()).map(([name, v]) => ({
      name,
      count: v.count,
      avgScore: v.scoreCount ? Math.round(v.scoreSum / v.scoreCount) : 0,
    })),
  };
}

export function mapCcEffectivenessAuditToTimeline(logs: Record<string, unknown>[]) {
  return logs
    .filter((log) => /effectiveness|review|score|capa recommend|qa review|approved|rejected/i.test(String(log.actionType || log.action || '')))
    .map((log) => ({
      action: String(log.actionType || log.action || 'Activity'),
      user: String(log.changedByUserName || log.userName || log.user_name || 'System'),
      at: String(log.dateTime || log.timestamp || log.created_at || ''),
      detail: String(log.reason || log.actionDescription || '').slice(0, 240),
    }))
    .sort((a, b) => (b.at || '').localeCompare(a.at || ''));
}

export function generateCapaRecommendation(input: CcEffectivenessFormInput, score: number, result: string): string {
  if (result !== 'Not Effective' && result !== 'Partially Effective') return '';
  const items: string[] = [];
  if (result === 'Not Effective') items.push('Initiate CAPA for ineffective change control implementation.');
  if (input.deviation_generated) items.push('Review linked deviation(s) and root cause.');
  if (input.oos_generated) items.push('Investigate OOS events post-implementation.');
  if (input.complaint_generated) items.push('Assess customer complaint linkage.');
  if (!input.no_data_integrity_impact) items.push('CSV/data integrity reassessment required.');
  if (score < 60) items.push('Consider reverting or re-validating the change.');
  return items.map((t, i) => `${i + 1}. ${t}`).join('\n');
}

export { SCORE_FIELDS };
