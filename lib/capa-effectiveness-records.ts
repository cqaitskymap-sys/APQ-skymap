import { normalizeRole } from '@/lib/permissions';
import { requiresHeadQaApproval } from '@/lib/capa-types';
import type {
  CapaEffectiveness,
  CapaEffectivenessChartData,
  CapaEffectivenessDashboardMetrics,
  CapaEffectivenessTimelineEntry,
  CapaRecord,
} from '@/lib/capa-types';

export const CAPA_EFFECTIVENESS_MODULE = 'CAPA Effectiveness Check';

export type CapaEffectivenessActor = {
  id: string;
  name: string;
  role?: string;
  department?: string;
  email?: string;
};

export interface CapaEffectivenessFormInput {
  capa_id: string;
  effectiveness_due_date?: string;
  effectiveness_review_date: string;
  reviewed_by: string;
  reviewed_by_name?: string;
  department: string;
  review_period?: string;
  evaluation_criteria: string[];
  evidence_reviewed: string;
  data_reviewed?: string;
  repeat_issue_observed?: boolean;
  issue_reoccurred?: boolean;
  risk_reduced?: boolean;
  root_cause_eliminated?: boolean;
  corrective_action_effective?: boolean;
  preventive_action_effective?: boolean;
  effectiveness_result?: string;
  effectiveness_score?: number;
  qa_comments?: string;
  final_conclusion: string;
}

export interface CapaEffectivenessQaReviewInput {
  decision: 'approved' | 'rejected';
  qa_comments: string;
  head_qa_comments?: string;
}

const CLOSED_STATUSES = ['closed', 'approved'];
const OPEN_ACTION_STATUSES = ['draft', 'assigned', 'under_implementation', 'implemented', 'qa_verification', 'overdue', 'rejected'];

export function canViewCapaEffectiveness(role?: string | null): boolean {
  const r = normalizeRole(role || '');
  if (['super_admin', 'admin', 'head_qa', 'qa_manager', 'qa', 'qa_executive', 'auditor', 'viewer'].includes(r)) return true;
  if (['qc_manager', 'qc', 'production_manager', 'production'].includes(r)) return true;
  return false;
}

export function isCapaEffectivenessReadOnly(role?: string | null): boolean {
  return ['auditor', 'viewer'].includes(normalizeRole(role || ''));
}

export function canCreateCapaEffectiveness(role?: string | null): boolean {
  const r = normalizeRole(role || '');
  return ['super_admin', 'admin', 'head_qa', 'qa_manager', 'qa', 'qa_executive'].includes(r);
}

export function canProvideEffectivenessEvidence(
  role: string | null | undefined,
  capa: CapaRecord,
  actorId: string,
): boolean {
  if (isCapaEffectivenessReadOnly(role)) return false;
  const r = normalizeRole(role || '');
  if (canCreateCapaEffectiveness(role)) return true;
  return capa.action_owner === actorId || capa.created_by === actorId;
}

export function canReviewCapaEffectivenessByDept(role: string | null | undefined, department: string): boolean {
  const r = normalizeRole(role || '');
  const map: Record<string, string> = {
    production_manager: 'Production', qc_manager: 'QC', engineering_manager: 'Engineering',
  };
  return map[r] === department;
}

export function canApproveCapaEffectiveness(role?: string | null): boolean {
  return canCreateCapaEffectiveness(role);
}

export function canApproveCriticalCapaEffectiveness(role?: string | null, capaPriority?: string): boolean {
  if (!requiresHeadQaApproval(capaPriority || '')) return canApproveCapaEffectiveness(role);
  return ['super_admin', 'head_qa'].includes(normalizeRole(role || ''));
}

export function buildEffectivenessIdFallback(year: number, seq: number): string {
  return `EFF-CAPA/${year}/${String(seq).padStart(4, '0')}`;
}

export function computeEffectivenessScore(input: {
  evaluation_criteria: string[];
  root_cause_eliminated?: boolean;
  repeat_issue_observed?: boolean;
  risk_reduced?: boolean;
  corrective_action_effective?: boolean;
  preventive_action_effective?: boolean;
  evidence_reviewed?: string;
}): number {
  let score = Math.min((input.evaluation_criteria?.length || 0) * 8, 36);
  if (input.root_cause_eliminated) score += 16;
  if (input.risk_reduced) score += 12;
  if (input.corrective_action_effective) score += 12;
  if (input.preventive_action_effective) score += 12;
  if ((input.evidence_reviewed?.trim().length || 0) > 20) score += 12;
  if (input.repeat_issue_observed) score = Math.max(0, score - 35);
  return Math.min(100, Math.max(0, score));
}

export function computeAutoEffectivenessResult(input: {
  evaluation_criteria: string[];
  root_cause_eliminated?: boolean;
  repeat_issue_observed?: boolean;
  issue_reoccurred?: boolean;
  evidence_reviewed?: string;
  corrective_action_effective?: boolean;
  preventive_action_effective?: boolean;
  effectiveness_score?: number;
}): string {
  if (input.repeat_issue_observed || input.issue_reoccurred) return 'Not Effective';
  const score = input.effectiveness_score ?? computeEffectivenessScore(input);
  if (input.root_cause_eliminated && !input.repeat_issue_observed && score >= 75
    && input.corrective_action_effective !== false) {
    return 'Effective';
  }
  if (!input.evidence_reviewed?.trim() || score < 50
    || input.corrective_action_effective === false || input.preventive_action_effective === false) {
    return 'Partially Effective';
  }
  if (score >= 60) return 'Partially Effective';
  return 'Not Effective';
}

export function computeEffectivenessProgress(review?: CapaEffectiveness | null): number {
  if (!review) return 0;
  const map: Record<string, number> = {
    draft: 10, scheduled: 20, under_review: 45, qa_review: 70,
    approved: 90, closed: 100, rejected: 30, reassessment_required: 25,
  };
  return map[review.status || 'draft'] ?? 0;
}

export function effectivenessStatusLabel(status?: string): string {
  const map: Record<string, string> = {
    draft: 'Draft', scheduled: 'Scheduled', under_review: 'Under Review',
    qa_review: 'QA Review', approved: 'Approved', rejected: 'Rejected',
    closed: 'Closed', reassessment_required: 'Reassessment Required',
  };
  return map[status || 'draft'] || status || 'Draft';
}

export function effectivenessStatusColor(status?: string): string {
  const map: Record<string, string> = {
    draft: 'bg-slate-100 text-slate-700',
    scheduled: 'bg-blue-100 text-blue-800',
    under_review: 'bg-purple-100 text-purple-800',
    qa_review: 'bg-amber-100 text-amber-800',
    approved: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
    closed: 'bg-emerald-100 text-emerald-800',
    reassessment_required: 'bg-orange-100 text-orange-800',
  };
  return map[status || 'draft'] || map.draft;
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

export function isEffectivenessReviewApproved(review?: CapaEffectiveness | null): boolean {
  return review?.status === 'approved' || review?.status === 'closed';
}

export function canCapaCloseFromEffectiveness(review?: CapaEffectiveness | null): boolean {
  return isEffectivenessReviewApproved(review)
    && (review?.effectiveness_result === 'Effective' || review?.result === 'Effective');
}

export function computeEffectivenessDashboardMetrics(
  reviews: CapaEffectiveness[],
  capas: CapaRecord[] = [],
): CapaEffectivenessDashboardMetrics {
  const active = reviews.filter((r) => !r.is_deleted);
  const today = new Date().toISOString().split('T')[0];
  return {
    total: active.length,
    pendingReviews: active.filter((r) => ['draft', 'scheduled', 'under_review', 'qa_review'].includes(r.status || '')).length,
    effective: active.filter((r) => (r.effectiveness_result || r.result) === 'Effective').length,
    partiallyEffective: active.filter((r) => (r.effectiveness_result || r.result) === 'Partially Effective').length,
    notEffective: active.filter((r) => (r.effectiveness_result || r.result) === 'Not Effective').length,
    reassessmentRequired: active.filter((r) => r.status === 'reassessment_required').length,
    overdue: active.filter((r) => r.effectiveness_due_date && r.effectiveness_due_date < today
      && !['closed', 'approved'].includes(r.status || '')).length,
    readyForClosure: active.filter((r) => canCapaCloseFromEffectiveness(r)).length,
  };
}

export function computeEffectivenessChartData(reviews: CapaEffectiveness[]): CapaEffectivenessChartData {
  const active = reviews.filter((r) => !r.is_deleted);
  const resultMap = new Map<string, number>();
  const deptMap = new Map<string, number>();
  const sourceMap = new Map<string, number>();
  const monthMap = new Map<string, { count: number; effective: number; notEffective: number }>();

  for (const r of active) {
    const res = String(r.effectiveness_result || r.result || 'Pending Review');
    resultMap.set(res, (resultMap.get(res) || 0) + 1);
    const dept = r.department || 'Unknown';
    deptMap.set(dept, (deptMap.get(dept) || 0) + 1);
    const src = r.source_type || 'Other';
    sourceMap.set(src, (sourceMap.get(src) || 0) + 1);
    const d = r.effectiveness_review_date || r.check_date || '';
    const month = d ? d.slice(0, 7) : 'Unknown';
    const cur = monthMap.get(month) || { count: 0, effective: 0, notEffective: 0 };
    cur.count++;
    if (res === 'Effective') cur.effective++;
    if (res === 'Not Effective') cur.notEffective++;
    monthMap.set(month, cur);
  }

  return {
    resultDistribution: Array.from(resultMap.entries()).map(([name, count]) => ({ name, count })),
    monthlyTrend: Array.from(monthMap.entries()).sort(([a], [b]) => a.localeCompare(b))
      .map(([name, v]) => ({ name, count: v.count, effective: v.effective, notEffective: v.notEffective })),
    byDepartment: Array.from(deptMap.entries()).map(([name, count]) => ({ name, count })),
    bySource: Array.from(sourceMap.entries()).map(([name, count]) => ({ name, count })),
    effectiveTrend: Array.from(monthMap.entries()).sort(([a], [b]) => a.localeCompare(b))
      .map(([name, v]) => ({ name, effective: v.effective, notEffective: v.notEffective })),
  };
}

export function mapAuditToEffectivenessTimeline(logs: Record<string, unknown>[]): CapaEffectivenessTimelineEntry[] {
  return logs
    .filter((log) => {
      const action = String(log.action || log.actionType || '');
      return /effectiveness|evaluation|reassessment|closure|evidence|approve|reject|schedule/i.test(action);
    })
    .map((log) => ({
      action: String(log.action || log.actionType || 'Activity'),
      user: String(log.userName || log.user_name || 'System'),
      at: String(log.dateTime || log.timestamp || log.created_at || ''),
      detail: String(log.reason || log.actionDescription || log.newValue || '').slice(0, 240),
    }))
    .sort((a, b) => (b.at || '').localeCompare(a.at || ''));
}

export function hasOpenCorrectiveOrPreventiveActions(
  corrective: { action_status: string }[],
  preventive: { action_status: string }[],
): boolean {
  const open = (list: { action_status: string }[]) =>
    list.some((a) => OPEN_ACTION_STATUSES.includes(a.action_status));
  return open(corrective) || open(preventive);
}
