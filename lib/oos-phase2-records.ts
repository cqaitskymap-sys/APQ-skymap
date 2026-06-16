import { normalizeRole } from '@/lib/permissions';
import { isCriticalOosTest, type OosPhase1, type OosPhase2, type OosRecord } from '@/lib/oos-types';

export type Phase2Actor = { id: string; name: string; role?: string; email?: string };

export interface Phase2FormInput {
  assigned_investigator?: string;
  assigned_investigator_id?: string;
  manufacturing_review?: string;
  batch_record_review: string;
  raw_material_review: string;
  packing_material_review?: string;
  equipment_review: string;
  cleaning_review?: string;
  utility_review?: string;
  environmental_review: string;
  operator_review: string;
  process_parameter_review?: string;
  process_review?: string;
  deviation_review?: string;
  change_control_review?: string;
  previous_batch_trend_review?: string;
  other_batch_impact_review?: string;
  other_batches_impacted_list?: string;
  root_cause?: string;
  contributing_factors?: string;
  impact_assessment: string;
  product_quality_impact?: string;
  corrective_action?: string;
  preventive_action?: string;
  capa_required?: boolean;
  linked_capa_number?: string;
  final_investigation_conclusion?: string;
  conclusion?: string;
  phase2_outcome?: string;
  qa_justification?: string;
}

export interface Phase2QaReviewInput {
  decision: 'approved' | 'rejected';
  qa_review_comments: string;
}

export interface Phase2AutoRules {
  capaRecommended: boolean;
  capaMandatory: boolean;
  requireBatchList: boolean;
  requireQaJustification: boolean;
  warnings: string[];
}

export interface Phase2TimelineEntry {
  action: string;
  user: string;
  at: string;
  detail?: string;
}

export function canStartPhase2(phase1: OosPhase1 | null): boolean {
  if (!phase1) return false;
  const outcome = phase1.phase1_outcome;
  const eligible = outcome === 'No Laboratory Error' || outcome === 'Inconclusive';
  return eligible && (phase1.status === 'Completed' || phase1.qa_decision === 'approved');
}

export function canViewPhase2(role?: string | null, record?: OosRecord | null): boolean {
  const r = normalizeRole(role);
  if (['super_admin', 'admin', 'qa_manager', 'qa', 'qc_manager', 'qc', 'production_manager', 'production',
    'engineering_manager', 'engineering', 'warehouse_manager', 'warehouse', 'auditor', 'viewer'].includes(r)) return true;
  if (r === 'head_qa') return Boolean(record && (record.is_critical_test || isCriticalOosTest(record.test_name)));
  return false;
}

export function canEditPhase2(role?: string | null): boolean {
  const r = normalizeRole(role);
  return ['super_admin', 'admin', 'production_manager', 'production', 'qc_manager', 'qc',
    'engineering_manager', 'engineering', 'warehouse_manager', 'warehouse'].includes(r);
}

export function canApprovePhase2(role?: string | null, record?: OosRecord | null): boolean {
  const r = normalizeRole(role);
  if (['super_admin', 'admin', 'qa_manager', 'qa'].includes(r)) return true;
  if (r === 'head_qa' && record && (record.is_critical_test || isCriticalOosTest(record.test_name))) return true;
  return false;
}

export function isPhase2ReadOnly(role?: string | null): boolean {
  return ['auditor', 'viewer'].includes(normalizeRole(role));
}

export function computePhase2AutoRules(input: Partial<Phase2FormInput>): Phase2AutoRules {
  const warnings: string[] = [];
  const outcome = input.phase2_outcome || '';
  const rootIdentified = /Manufacturing|Material|Equipment|Process Root Cause Identified/.test(outcome);
  const noCause = outcome === 'No Assignable Cause';
  const productQualityYes = input.product_quality_impact === 'Yes';
  const otherBatchesYes = /yes/i.test(input.other_batch_impact_review || '') || Boolean(input.other_batches_impacted_list?.trim());

  if (rootIdentified) warnings.push('Root cause identified — CAPA is recommended.');
  if (productQualityYes) warnings.push('Product quality impact is Yes — CAPA is mandatory.');
  if (otherBatchesYes && !input.other_batches_impacted_list?.trim()) {
    warnings.push('Other batches impacted — list of impacted batches is required.');
  }
  if (noCause && !input.qa_justification?.trim()) {
    warnings.push('No assignable cause — QA justification is required.');
  }
  if (!input.root_cause?.trim() && !noCause && !input.qa_justification?.trim()) {
    warnings.push('Root cause or QA justification is required.');
  }

  return {
    capaRecommended: rootIdentified,
    capaMandatory: productQualityYes,
    requireBatchList: otherBatchesYes,
    requireQaJustification: noCause,
    warnings,
  };
}

export function phase2StatusColor(status?: string): string {
  const map: Record<string, string> = {
    'Not Started': 'bg-slate-100 text-slate-700 border-slate-200',
    'In Progress': 'bg-orange-100 text-orange-800 border-orange-200',
    'QA Review': 'bg-purple-100 text-purple-800 border-purple-200',
    'CAPA Required': 'bg-red-100 text-red-800 border-red-200',
    Completed: 'bg-green-100 text-green-800 border-green-200',
    Rejected: 'bg-red-100 text-red-800 border-red-200',
  };
  return map[status || 'Not Started'] || map['Not Started'];
}

export function mapPhase2AuditTimeline(logs: Record<string, unknown>[]): Phase2TimelineEntry[] {
  return logs
    .filter((log) => /phase.?2|phase-ii|manufacturing|capa|impact|qa review|approve|reject/i.test(String(log.actionType || log.action || '')))
    .map((log) => ({
      action: String(log.actionType || log.action || 'Activity'),
      user: String(log.userName || log.user_name || 'System'),
      at: String(log.dateTime || log.timestamp || log.created_at || ''),
      detail: String(log.actionDescription || log.reason || '').slice(0, 200),
    }))
    .sort((a, b) => (b.at || '').localeCompare(a.at || ''));
}

export function resolveOosStatusAfterPhase2Approval(phase2: OosPhase2): string {
  if (phase2.capa_required || phase2.linked_capa_number) return 'capa_required';
  return 'final_qa_review';
}
