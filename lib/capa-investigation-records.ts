import { normalizeRole } from '@/lib/permissions';
import { requiresHeadQaApproval } from '@/lib/capa-types';
import type {
  CapaFishboneAnalysis,
  CapaFiveWhyAnalysis,
  CapaInvestigation,
  CapaInvestigationDashboardMetrics,
  CapaInvestigationTimelineEntry,
  CapaRecord,
  CapaRcaCategory,
} from '@/lib/capa-types';

export const CAPA_INVESTIGATION_MODULE = 'CAPA Investigation';

export type CapaInvestigationActor = {
  id: string;
  name: string;
  role?: string;
  department?: string;
  email?: string;
};

export interface CapaInvestigationFormInput {
  capa_id: string;
  investigation_date: string;
  investigator: string;
  investigator_name: string;
  department: string;
  problem_statement: string;
  observed_issue?: string;
  issue_description?: string;
  immediate_containment_action?: string;
  root_cause_method: string;
  root_cause_category: string;
  root_cause_description: string;
  contributing_factors?: string;
  evidence_summary?: string;
  risk_assessment_result?: string;
  corrective_action_recommendation?: string;
  preventive_action_recommendation?: string;
  investigation_conclusion: string;
  five_why?: Partial<CapaFiveWhyAnalysis>;
  fishbone?: Partial<CapaFishboneAnalysis>;
}

export interface CapaInvestigationQaReviewInput {
  decision: 'approved' | 'rejected';
  qa_review_comments: string;
}

export function emptyFiveWhy(): CapaFiveWhyAnalysis {
  return { why1: '', why2: '', why3: '', why4: '', why5: '', final_root_cause: '' };
}

export function emptyFishbone(): CapaFishboneAnalysis {
  return { Man: '', Machine: '', Method: '', Material: '', Measurement: '', Environment: '' };
}

export function canViewCapaInvestigation(role?: string | null): boolean {
  const r = normalizeRole(role || '');
  if (['super_admin', 'admin', 'head_qa', 'qa_manager', 'qa', 'qa_executive', 'auditor', 'viewer'].includes(r)) return true;
  if (['qc_manager', 'qc', 'production_manager', 'production', 'engineering_manager', 'engineering'].includes(r)) return true;
  return false;
}

export function isCapaInvestigationReadOnly(role?: string | null): boolean {
  return ['auditor', 'viewer'].includes(normalizeRole(role || ''));
}

export function canEditCapaInvestigation(
  role: string | null | undefined,
  capa: CapaRecord,
  actorId: string,
): boolean {
  if (isCapaInvestigationReadOnly(role)) return false;
  const r = normalizeRole(role || '');
  if (['super_admin', 'admin', 'head_qa', 'qa_manager', 'qa', 'qa_executive'].includes(r)) return true;
  if (capa.action_owner === actorId) return true;
  if (capa.created_by === actorId) return true;
  const deptHeadMap: Record<string, string> = {
    production_manager: 'Production',
    qc_manager: 'QC',
    engineering_manager: 'Engineering',
  };
  const dept = deptHeadMap[r];
  if (dept && capa.department === dept) return true;
  return false;
}

export function canReviewCapaInvestigation(role?: string | null): boolean {
  const r = normalizeRole(role || '');
  return ['super_admin', 'admin', 'head_qa', 'qa_manager', 'qa', 'qa_executive'].includes(r);
}

export function canApproveCriticalCapaInvestigation(role?: string | null, capaPriority?: string): boolean {
  if (!requiresHeadQaApproval(capaPriority || '')) return canReviewCapaInvestigation(role);
  return ['super_admin', 'head_qa'].includes(normalizeRole(role || ''));
}

export function isInvestigationApproved(status?: string | null): boolean {
  return status === 'approved' || status === 'closed';
}

export function canProceedCapaToImplementation(investigationStatus?: string | null): boolean {
  return isInvestigationApproved(investigationStatus);
}

export function canProceedCapaToApproval(investigationStatus?: string | null): boolean {
  return isInvestigationApproved(investigationStatus);
}

export function computeRcaAutoRecommendations(category: string): string[] {
  const recs: string[] = [];
  if (category === 'Training') {
    recs.push('Recommend training CAPA — assign GMP retraining and competency assessment.');
  }
  if (category === 'Equipment') {
    recs.push('Recommend maintenance/calibration review — verify PM schedule and calibration status.');
  }
  if (category === 'Process') {
    recs.push('Recommend SOP/process review — update controlled documents and re-qualification if needed.');
  }
  return recs;
}

export function computeInvestigationAutoRules(
  input: Partial<CapaInvestigationFormInput>,
  capa?: CapaRecord,
): { recommendations: string[]; warnings: string[]; notifyHeadQa: boolean } {
  const recommendations = computeRcaAutoRecommendations(input.root_cause_category || '');
  const warnings: string[] = [];
  if (!input.root_cause_description?.trim()) {
    warnings.push('Root cause description is mandatory before CAPA implementation.');
  }
  if (!input.investigation_conclusion?.trim()) {
    warnings.push('Investigation conclusion is required before QA review.');
  }
  if (capa && requiresHeadQaApproval(capa.priority)) {
    warnings.push('Critical CAPA — Head QA approval required for RCA.');
  }
  return {
    recommendations,
    warnings,
    notifyHeadQa: requiresHeadQaApproval(capa?.priority || ''),
  };
}

export function buildInvestigationIdFallback(year: number, seq: number): string {
  return `INV-CAPA/${year}/${String(seq).padStart(4, '0')}`;
}

export function investigationStatusLabel(status?: string): string {
  const map: Record<string, string> = {
    draft: 'Draft',
    under_investigation: 'Under Investigation',
    qa_review: 'QA Review',
    approved: 'Approved',
    rejected: 'Rejected',
    closed: 'Closed',
  };
  return map[status || 'draft'] || status || 'Draft';
}

export function investigationStatusColor(status?: string): string {
  const map: Record<string, string> = {
    draft: 'bg-slate-100 text-slate-700',
    under_investigation: 'bg-blue-100 text-blue-800',
    qa_review: 'bg-purple-100 text-purple-800',
    approved: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
    closed: 'bg-emerald-100 text-emerald-800',
  };
  return map[status || 'draft'] || map.draft;
}

export function rcaCategoryColor(category?: string): string {
  const map: Record<string, string> = {
    Training: 'bg-amber-100 text-amber-800',
    Equipment: 'bg-orange-100 text-orange-800',
    Process: 'bg-blue-100 text-blue-800',
    People: 'bg-purple-100 text-purple-800',
    Procedure: 'bg-indigo-100 text-indigo-800',
    Material: 'bg-teal-100 text-teal-800',
  };
  return map[category || ''] || 'bg-slate-100 text-slate-700';
}

export function computeInvestigationDashboardMetrics(
  investigations: CapaInvestigation[],
): CapaInvestigationDashboardMetrics {
  const active = investigations.filter((i) => !i.is_deleted);
  return {
    total: active.length,
    open: active.filter((i) => ['draft', 'under_investigation'].includes(i.status)).length,
    approved: active.filter((i) => i.status === 'approved' || i.status === 'closed').length,
    rejected: active.filter((i) => i.status === 'rejected').length,
    pendingQaReview: active.filter((i) => i.status === 'qa_review').length,
    trainingRelated: active.filter((i) => i.root_cause_category === 'Training').length,
    equipmentRelated: active.filter((i) => i.root_cause_category === 'Equipment').length,
    processRelated: active.filter((i) => i.root_cause_category === 'Process').length,
  };
}

export function mapAuditToCapaInvestigationTimeline(
  logs: Record<string, unknown>[],
): CapaInvestigationTimelineEntry[] {
  return logs
    .filter((log) => {
      const action = String(log.action || log.actionType || '');
      return /investigation|rca|5.?why|fishbone|evidence|review|approve|reject/i.test(action);
    })
    .map((log) => ({
      action: String(log.action || log.actionType || 'Activity'),
      user: String(log.userName || log.user_name || 'System'),
      at: String(log.dateTime || log.timestamp || log.created_at || ''),
      detail: String(log.reason || log.actionDescription || log.newValue || '').slice(0, 240),
    }))
    .sort((a, b) => (b.at || '').localeCompare(a.at || ''));
}

export function mapInvestigationToForm(
  inv: CapaInvestigation | null,
  capa: CapaRecord,
): CapaInvestigationFormInput {
  return {
    capa_id: capa.id,
    investigation_date: inv?.investigation_date || new Date().toISOString().split('T')[0],
    investigator: inv?.investigator || capa.action_owner || '',
    investigator_name: inv?.investigator_name || capa.action_owner_name || '',
    department: inv?.department || capa.department,
    problem_statement: inv?.problem_statement || capa.problem_description || '',
    observed_issue: inv?.observed_issue || '',
    issue_description: inv?.issue_description || capa.problem_description || '',
    immediate_containment_action: inv?.immediate_containment_action || '',
    root_cause_method: inv?.root_cause_method || '5 Why Analysis',
    root_cause_category: (inv?.root_cause_category || 'Process') as CapaRcaCategory,
    root_cause_description: inv?.root_cause_description || capa.root_cause || '',
    contributing_factors: inv?.contributing_factors || '',
    evidence_summary: inv?.evidence_summary || '',
    risk_assessment_result: inv?.risk_assessment_result || '',
    corrective_action_recommendation: inv?.corrective_action_recommendation || capa.corrective_action || '',
    preventive_action_recommendation: inv?.preventive_action_recommendation || capa.preventive_action || '',
    investigation_conclusion: inv?.investigation_conclusion || '',
    five_why: inv?.five_why || emptyFiveWhy(),
    fishbone: inv?.fishbone || emptyFishbone(),
  };
}
