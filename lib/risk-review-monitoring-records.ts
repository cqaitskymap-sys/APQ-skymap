import { normalizeRole } from '@/lib/permissions';
import type { RiskAssessmentRecord } from '@/lib/cpv-risk-assessment-records';
import type { RiskLevel } from '@/lib/cpv';
import {
  estimateResidualRpn,
  getMitigationStatus,
  inferRiskDepartment,
} from '@/lib/risk-reports-records';
import { residualRiskLevel } from '@/lib/risk-closure-records';

export const RISK_REVIEW_MODULE = 'Risk Review & Monitoring';
export const RISK_REVIEWS_COLLECTION = 'risk_reviews';
export const RISK_MONITORING_COLLECTION = 'risk_monitoring';

export const REVIEW_TYPES = [
  'Monthly',
  'Quarterly',
  'Half Yearly',
  'Annual',
  'Triggered Review',
  'Management Review',
] as const;

export const RISK_TRENDS = [
  'Improving',
  'Stable',
  'Increasing',
  'Critical',
] as const;

export const EFFECTIVENESS_EVALUATIONS = [
  'Effective',
  'Partially Effective',
  'Not Effective',
] as const;

export const REVIEW_STATUSES = [
  'Draft',
  'Under Review',
  'QA Review',
  'Approved',
  'Rejected',
  'Closed',
] as const;

export type RiskReviewActor = { id: string; name: string; role?: string; email?: string };

export interface RiskReviewRecord {
  id: string;
  review_id: string;
  risk_assessment_id: string;
  risk_number: string;
  review_date: string;
  review_type: string;
  reviewer: string;
  department: string;
  review_frequency: string;
  initial_rpn: number;
  current_rpn: number;
  residual_rpn: number;
  risk_level: string;
  residual_risk_level: string;
  mitigation_status: string;
  risk_trend: string;
  new_risks_identified: boolean;
  repeat_events_observed: boolean;
  deviation_count: number;
  oos_count: number;
  complaint_count: number;
  capa_count: number;
  effectiveness_evaluation: string;
  risk_reduction_achieved: boolean;
  further_mitigation_required: boolean;
  review_conclusion: string;
  recommendation: string;
  next_review_date: string;
  qa_comments: string;
  status: string;
  capa_recommended: boolean;
  head_qa_escalated: boolean;
  created_at: string;
  updated_at: string;
  created_by: string;
  created_by_name?: string;
  updated_by: string;
  updated_by_name?: string;
  is_deleted: boolean;
}

export interface RiskMonitoringSnapshot {
  id?: string;
  risk_assessment_id: string;
  risk_number: string;
  snapshot_date: string;
  current_rpn: number;
  residual_rpn: number;
  risk_trend: string;
  deviation_count: number;
  oos_count: number;
  complaint_count: number;
  capa_count: number;
  created_at: string;
  is_deleted?: boolean;
}

export interface RiskReviewFormInput {
  review_date: string;
  review_type: string;
  reviewer: string;
  review_frequency: string;
  effectiveness_evaluation: string;
  new_risks_identified: boolean;
  repeat_events_observed: boolean;
  risk_reduction_achieved: boolean;
  further_mitigation_required: boolean;
  review_conclusion: string;
  recommendation: string;
  next_review_date: string;
  qa_comments: string;
}

export interface RiskReviewMonitoringContext {
  deviationCount: number;
  oosCount: number;
  complaintCount: number;
  capaCount: number;
  initialRpn: number;
  currentRpn: number;
  residualRpn: number;
  riskLevel: string;
  residualRiskLevel: string;
  mitigationStatus: string;
  riskTrend: string;
  recommendations: string[];
}

export interface RiskReviewDashboardMetrics {
  totalReviews: number;
  pendingReviews: number;
  approvedReviews: number;
  overdueReviews: number;
  effectiveRisks: number;
  partiallyEffective: number;
  notEffective: number;
  criticalUnderReview: number;
}

export interface RiskReviewChartData {
  riskTrendAnalysis: { name: string; count: number }[];
  residualRiskTrend: { name: string; rpn: number }[];
  reviewStatusTrend: { name: string; count: number }[];
  deviationOosCorrelation: { name: string; deviations: number; oos: number }[];
  capaCorrelation: { name: string; count: number }[];
  complaintCorrelation: { name: string; count: number }[];
}

export interface RiskReviewTimelineEntry {
  action: string;
  user: string;
  at: string;
  detail?: string;
}

const FREQUENCY_MONTHS: Record<string, number> = {
  Monthly: 1,
  Quarterly: 3,
  'Half Yearly': 6,
  Annual: 12,
  'Triggered Review': 1,
  'Management Review': 12,
};

export function defaultReviewFrequency(risk: RiskAssessmentRecord): string {
  if (risk.riskLevel === 'Critical') return 'Monthly';
  if (risk.riskLevel === 'High') return 'Quarterly';
  if (risk.riskLevel === 'Medium') return 'Half Yearly';
  return 'Annual';
}

export function calculateNextReviewDate(fromDate: string, frequency: string): string {
  const months = FREQUENCY_MONTHS[frequency] ?? 12;
  const d = new Date(fromDate);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

export function computeRiskTrend(
  initialRpn: number,
  currentRpn: number,
  residualRpn: number,
  residualLevel: string,
): string {
  if (residualLevel === 'Critical' || currentRpn >= 201) return 'Critical';
  if (residualRpn < initialRpn * 0.7) return 'Improving';
  if (residualRpn > initialRpn * 1.1 || currentRpn > initialRpn) return 'Increasing';
  return 'Stable';
}

export function generateReviewRecommendations(params: {
  effectiveness: string;
  deviationCount: number;
  oosCount: number;
  complaintCount: number;
  residualRiskLevel: string;
  riskTrend: string;
  furtherMitigationRequired: boolean;
  repeatEventsObserved: boolean;
}): string[] {
  const recs: string[] = [];
  if (params.effectiveness === 'Not Effective') {
    recs.push('Initiate additional mitigation actions — effectiveness evaluation is Not Effective.');
  }
  if (params.repeatEventsObserved) {
    recs.push('Repeat deviation/OOS/complaint events observed — CAPA recommended.');
  }
  if (params.deviationCount + params.oosCount + params.complaintCount >= 2) {
    recs.push('Multiple quality events linked — recommend formal CAPA investigation.');
  }
  if (params.residualRiskLevel === 'High' || params.residualRiskLevel === 'Critical') {
    recs.push('Residual risk remains High/Critical — escalate to Head QA for review.');
  }
  if (params.riskTrend === 'Increasing') {
    recs.push('Risk trend is Increasing — notify QA and Risk Manager for immediate assessment.');
  }
  if (params.furtherMitigationRequired) {
    recs.push('Further mitigation required per ICH Q9 continuous improvement.');
  }
  return recs;
}

export function buildReviewMonitoringContext(
  risk: RiskAssessmentRecord,
  linkedCounts: { deviations: number; oos: number; complaints: number; capas: number },
  priorReviews: RiskReviewRecord[] = [],
): RiskReviewMonitoringContext {
  const initialRpn = priorReviews[0]?.initial_rpn ?? risk.rpnScore;
  const currentRpn = risk.rpnScore;
  const residualRpn = estimateResidualRpn(risk);
  const residualLevel = residualRiskLevel(residualRpn);
  const trend = computeRiskTrend(initialRpn, currentRpn, residualRpn, residualLevel);
  const repeatEvents = linkedCounts.deviations + linkedCounts.oos + linkedCounts.complaints >= 2;
  const furtherMitigation = residualRpn > 100 || effectivenessPending(risk);

  const recommendations = generateReviewRecommendations({
    effectiveness: risk.effectivenessStatus || 'Partially Effective',
    deviationCount: linkedCounts.deviations,
    oosCount: linkedCounts.oos,
    complaintCount: linkedCounts.complaints,
    residualRiskLevel: residualLevel,
    riskTrend: trend,
    furtherMitigationRequired: furtherMitigation,
    repeatEventsObserved: repeatEvents,
  });

  return {
    deviationCount: linkedCounts.deviations,
    oosCount: linkedCounts.oos,
    complaintCount: linkedCounts.complaints,
    capaCount: linkedCounts.capas,
    initialRpn,
    currentRpn,
    residualRpn,
    riskLevel: risk.riskLevel,
    residualRiskLevel: residualLevel,
    mitigationStatus: getMitigationStatus(risk),
    riskTrend: trend,
    recommendations,
  };
}

function effectivenessPending(risk: RiskAssessmentRecord): boolean {
  return risk.effectivenessCheckRequired && risk.effectivenessStatus === 'Pending';
}

export function buildDefaultReviewForm(
  risk: RiskAssessmentRecord,
  ctx: RiskReviewMonitoringContext,
  actorName: string,
  existing?: RiskReviewRecord | null,
): RiskReviewFormInput {
  const freq = existing?.review_frequency || defaultReviewFrequency(risk);
  const reviewDate = existing?.review_date || new Date().toISOString().split('T')[0];
  return {
    review_date: reviewDate,
    review_type: existing?.review_type || (freq === 'Monthly' ? 'Monthly' : freq === 'Quarterly' ? 'Quarterly' : 'Annual'),
    reviewer: existing?.reviewer || actorName,
    review_frequency: freq,
    effectiveness_evaluation: existing?.effectiveness_evaluation || risk.effectivenessStatus || 'Partially Effective',
    new_risks_identified: existing?.new_risks_identified ?? false,
    repeat_events_observed: existing?.repeat_events_observed ?? (ctx.deviationCount + ctx.oosCount + ctx.complaintCount >= 2),
    risk_reduction_achieved: existing?.risk_reduction_achieved ?? ctx.residualRpn < ctx.initialRpn,
    further_mitigation_required: existing?.further_mitigation_required ?? (ctx.residualRpn > 100 || ctx.riskTrend === 'Increasing'),
    review_conclusion: existing?.review_conclusion || '',
    recommendation: existing?.recommendation || ctx.recommendations.join(' '),
    next_review_date: existing?.next_review_date || calculateNextReviewDate(reviewDate, freq),
    qa_comments: existing?.qa_comments || '',
  };
}

export function computeReviewDashboardMetrics(
  reviews: RiskReviewRecord[],
  risks: RiskAssessmentRecord[],
): RiskReviewDashboardMetrics {
  const today = new Date().toISOString().split('T')[0];
  const active = reviews.filter((r) => !r.is_deleted);
  const riskMap = new Map(risks.map((r) => [r.id, r]));

  return {
    totalReviews: active.length,
    pendingReviews: active.filter((r) => ['Draft', 'Under Review', 'QA Review'].includes(r.status)).length,
    approvedReviews: active.filter((r) => r.status === 'Approved').length,
    overdueReviews: active.filter((r) => r.next_review_date && r.next_review_date < today && r.status !== 'Closed').length,
    effectiveRisks: active.filter((r) => r.effectiveness_evaluation === 'Effective').length,
    partiallyEffective: active.filter((r) => r.effectiveness_evaluation === 'Partially Effective').length,
    notEffective: active.filter((r) => r.effectiveness_evaluation === 'Not Effective').length,
    criticalUnderReview: active.filter((r) => {
      const risk = riskMap.get(r.risk_assessment_id);
      return ['Under Review', 'QA Review'].includes(r.status)
        && (risk?.riskLevel === 'Critical' || r.residual_risk_level === 'Critical');
    }).length,
  };
}

export function buildReviewChartData(reviews: RiskReviewRecord[]): RiskReviewChartData {
  const trendMap = new Map<string, number>();
  const statusMap = new Map<string, number>();
  const effMap = new Map<string, number>();

  for (const r of reviews.filter((x) => !x.is_deleted)) {
    trendMap.set(r.risk_trend, (trendMap.get(r.risk_trend) || 0) + 1);
    statusMap.set(r.status, (statusMap.get(r.status) || 0) + 1);
  }

  const byMonth = new Map<string, { rpn: number; n: number }>();
  for (const r of reviews.filter((x) => !x.is_deleted).slice(-24)) {
    const key = (r.review_date || r.created_at || '').slice(0, 7);
    if (!key) continue;
    const cur = byMonth.get(key) || { rpn: 0, n: 0 };
    cur.rpn += r.residual_rpn;
    cur.n += 1;
    byMonth.set(key, cur);
  }

  const sortedMonths = Array.from(byMonth.entries()).sort((a, b) => a[0].localeCompare(b[0]));

  return {
    riskTrendAnalysis: RISK_TRENDS.map((t) => ({ name: t, count: trendMap.get(t) || 0 })),
    residualRiskTrend: sortedMonths.map(([name, v]) => ({ name, rpn: Math.round(v.rpn / Math.max(1, v.n)) })),
    reviewStatusTrend: REVIEW_STATUSES.map((s) => ({ name: s, count: statusMap.get(s) || 0 })),
    deviationOosCorrelation: reviews.filter((r) => !r.is_deleted).slice(0, 12).map((r) => ({
      name: r.risk_number?.slice(-8) || r.review_id?.slice(-6) || '—',
      deviations: r.deviation_count,
      oos: r.oos_count,
    })),
    capaCorrelation: reviews.filter((r) => !r.is_deleted).slice(0, 12).map((r) => ({
      name: r.risk_number?.slice(-8) || '—',
      count: r.capa_count,
    })),
    complaintCorrelation: reviews.filter((r) => !r.is_deleted).slice(0, 12).map((r) => ({
      name: r.risk_number?.slice(-8) || '—',
      count: r.complaint_count,
    })),
  };
}

export function reviewStatusColor(status?: string): string {
  const map: Record<string, string> = {
    Draft: 'bg-slate-100 text-slate-700',
    'Under Review': 'bg-blue-100 text-blue-800',
    'QA Review': 'bg-amber-100 text-amber-800',
    Approved: 'bg-green-100 text-green-800',
    Rejected: 'bg-red-100 text-red-800',
    Closed: 'bg-emerald-100 text-emerald-800',
  };
  return map[status || ''] || map.Draft;
}

export function trendColor(trend?: string): string {
  const map: Record<string, string> = {
    Improving: 'bg-green-100 text-green-800',
    Stable: 'bg-blue-100 text-blue-800',
    Increasing: 'bg-orange-100 text-orange-800',
    Critical: 'bg-red-100 text-red-800',
  };
  return map[trend || ''] || 'bg-slate-100 text-slate-700';
}

export function effectivenessColor(eff?: string): string {
  const map: Record<string, string> = {
    Effective: 'bg-green-100 text-green-800',
    'Partially Effective': 'bg-amber-100 text-amber-800',
    'Not Effective': 'bg-red-100 text-red-800',
  };
  return map[eff || ''] || 'bg-slate-100 text-slate-700';
}

export function riskLevelBadgeColor(level?: string | RiskLevel): string {
  const map: Record<string, string> = {
    Critical: 'bg-red-100 text-red-800',
    High: 'bg-orange-100 text-orange-800',
    Medium: 'bg-amber-100 text-amber-800',
    Low: 'bg-green-100 text-green-800',
  };
  return map[level || ''] || 'bg-slate-100 text-slate-700';
}

export function canViewRiskReview(role?: string | null): boolean {
  const r = normalizeRole(role || '');
  return [
    'super_admin', 'admin', 'head_qa', 'qa_manager', 'qa', 'qa_executive',
    'risk_manager', 'department_head', 'regulatory_affairs', 'csv_manager',
    'auditor', 'viewer', 'production_manager', 'qc_manager',
  ].includes(r);
}

export function isRiskReviewReadOnly(role?: string | null): boolean {
  return ['auditor', 'viewer'].includes(normalizeRole(role || ''));
}

export function canCreateRiskReview(role?: string | null): boolean {
  return ['super_admin', 'admin', 'head_qa', 'qa_manager', 'qa', 'qa_executive', 'risk_manager'].includes(normalizeRole(role || ''));
}

export function canApproveRiskReview(role?: string | null): boolean {
  return ['super_admin', 'admin', 'head_qa', 'qa_manager', 'qa'].includes(normalizeRole(role || ''));
}

export function canReviewOwnDepartmentRisk(role?: string | null): boolean {
  return ['department_head', 'production_manager', 'qc_manager'].includes(normalizeRole(role || ''));
}

export function requiresHeadQaReview(risk: RiskAssessmentRecord, residualLevel: string): boolean {
  return risk.riskLevel === 'Critical' || residualLevel === 'Critical' || residualLevel === 'High';
}

export { inferRiskDepartment, estimateResidualRpn, getMitigationStatus, residualRiskLevel };
