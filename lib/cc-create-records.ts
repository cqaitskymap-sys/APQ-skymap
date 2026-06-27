import { normalizeRole } from '@/lib/permissions';
import { requiresHeadQaApproval, type ChangeControlRecord } from '@/lib/change-control-types';

export const CC_CREATE_MODULE = 'Create Change Control';

export const CC_CREATE_WIZARD_STEPS = [
  'General Information',
  'Change Description',
  'Product & Affected Areas',
  'Impact Checklist',
  'Assignment & Workflow',
  'Review & Submit',
] as const;

export type CcCreateActor = {
  id: string;
  name: string;
  role?: string;
  department?: string;
  email?: string;
};

export interface CcCreateAutoRules {
  headQaRequired: boolean;
  notifyRegulatory: boolean;
  notifyCsv: boolean;
  validationTaskRecommended: boolean;
  trainingTaskRecommended: boolean;
  capaLinkAllowed: boolean;
}

export function computeCcCreateAutoRules(input: {
  change_category: string;
  regulatory_impact: boolean;
  csv_impact: boolean;
  validation_impact: boolean;
  training_impact: boolean;
  capa_required: boolean;
}): CcCreateAutoRules {
  return {
    headQaRequired: requiresHeadQaApproval(input.change_category),
    notifyRegulatory: input.regulatory_impact,
    notifyCsv: input.csv_impact,
    validationTaskRecommended: input.validation_impact,
    trainingTaskRecommended: input.training_impact,
    capaLinkAllowed: input.capa_required,
  };
}

export function canViewCcCreate(role?: string | null): boolean {
  return canCreateCcChange(role) || ['auditor', 'viewer'].includes(normalizeRole(role || ''));
}

export function canCreateCcChange(role?: string | null): boolean {
  const raw = (role || '').toLowerCase();
  if (['auditor', 'viewer'].includes(normalizeRole(role || ''))) return false;
  return ['super_admin', 'admin', 'head_qa', 'qa_manager', 'qa', 'qa_executive'].includes(normalizeRole(role || ''))
    || raw.includes('production') || raw.includes('engineering') || raw.includes('qc')
    || raw.includes('warehouse') || raw.includes('regulatory') || raw.includes('csv');
}

export function suggestRiskAssessment(input: {
  change_category: string;
  regulatory_impact: boolean;
  patient_safety_impact: boolean;
  validation_impact: boolean;
}): boolean {
  return input.change_category === 'Critical'
    || input.regulatory_impact
    || input.patient_safety_impact
    || input.validation_impact;
}

export interface CcProductOption {
  id: string;
  product_name: string;
  product_code?: string;
}

export interface CcBatchOption {
  id: string;
  batch_number: string;
  product_name?: string;
  pqr_id?: string | null;
}

export function buildCreateSummary(record: Partial<ChangeControlRecord>) {
  return [
    { label: 'CC Number', value: record.change_control_number || 'Auto-generated on save' },
    { label: 'Title', value: record.change_title },
    { label: 'Type', value: record.change_type },
    { label: 'Category', value: record.change_category },
    { label: 'Priority', value: record.change_priority },
    { label: 'Department', value: record.department },
    { label: 'Owner', value: record.assigned_owner_name || record.assigned_owner },
    { label: 'QA Reviewer', value: record.qa_reviewer_name || record.qa_reviewer },
    { label: 'Planned Implementation', value: record.planned_implementation_date },
    { label: 'Target Closure', value: record.target_closure_date },
  ];
}
