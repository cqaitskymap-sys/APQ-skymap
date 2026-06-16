import { normalizeRole } from '@/lib/permissions';
import {
  BATCH_IMPACT_OPTIONS,
  DEVIATION_CATEGORIES,
  DEVIATION_CRITICALITIES,
  DEVIATION_PLANNED_TYPES,
  DEPARTMENTS,
  TRI_STATE_IMPACT_OPTIONS,
  YES_NO_OPTIONS,
  computeCapaRequired,
  requiresHeadQaApproval,
  type DeviationRecord,
} from '@/lib/deviation-types';

export const DEVIATION_WIZARD_STEPS = [
  'Basic Information',
  'Product & Batch',
  'Deviation Details',
  'Impact Assessment',
  'Assignment & Closure',
  'Attachments & Submit',
] as const;

export const DEPARTMENT_CODES: Record<string, string> = {
  Production: 'PRD',
  QC: 'QC',
  QA: 'QA',
  Engineering: 'ENG',
  Warehouse: 'WH',
  Regulatory: 'RA',
  Microbiology: 'MIC',
  Packaging: 'PKG',
  Maintenance: 'MNT',
};

export type DeviationCreateActor = { id: string; name: string; role?: string; email?: string };

export interface DeviationProductOption {
  id: string;
  productName: string;
  productCode: string;
  genericName?: string;
  market?: string;
  dosageForm?: string;
}

export interface DeviationBatchOption {
  id: string;
  batchNumber: string;
  productId?: string;
  productName?: string;
  productCode?: string;
  manufacturingDate?: string;
  expiryDate?: string;
  pqrId?: string;
  cpvBatchId?: string;
}

export interface DeviationAutoRules {
  capaRequired: boolean;
  headQaApprovalRequired: boolean;
  capaRecommendation: boolean;
  notifyHeadQa: boolean;
  notifyRegulatory: boolean;
  warnings: string[];
}

export interface DeviationSourcePrefill {
  source?: DeviationRecord['source'];
  sourceReference?: string;
  productName?: string;
  batchNumber?: string;
  department?: string;
  category?: string;
  title?: string;
  description?: string;
  cpvRecordId?: string;
}

export function departmentCode(department: string): string {
  return DEPARTMENT_CODES[department] || department.slice(0, 3).toUpperCase() || 'QA';
}

export function canCreateDeviation(role?: string | null): boolean {
  const r = normalizeRole(role);
  if (['super_admin', 'admin', 'head_qa', 'qa_manager', 'qa'].includes(r)) return true;
  if (['production_manager', 'production', 'qc_manager', 'qc', 'engineering_manager', 'engineering',
    'warehouse_manager', 'warehouse'].includes(r)) return true;
  return false;
}

export function canCreateForDepartment(role: string | null | undefined, department: string): boolean {
  const r = normalizeRole(role);
  if (['super_admin', 'admin', 'head_qa', 'qa_manager', 'qa'].includes(r)) return true;
  const deptByRole: Record<string, string> = {
    production_manager: 'Production',
    production: 'Production',
    qc_manager: 'QC',
    qc: 'QC',
    engineering_manager: 'Engineering',
    engineering: 'Engineering',
    warehouse_manager: 'Warehouse',
    warehouse: 'Warehouse',
  };
  const allowed = deptByRole[r];
  if (!allowed) return false;
  return department === allowed || department.toLowerCase().includes(allowed.toLowerCase());
}

export function impactToBoolean(value: string | undefined, yesValue = 'Yes'): boolean {
  return value === yesValue;
}

export function computeDeviationAutoRules(input: {
  criticality?: string;
  batch_impact?: string;
  product_quality_impact?: string;
  patient_safety_impact?: string;
  regulatory_impact_status?: string;
  repeat_deviation?: string | boolean;
  capa_required?: boolean;
}): DeviationAutoRules {
  const repeat = input.repeat_deviation === true || input.repeat_deviation === 'Yes';
  const record: Partial<DeviationRecord> = {
    criticality: input.criticality as DeviationRecord['criticality'],
    batch_impacted: impactToBoolean(input.batch_impact),
    product_quality_impacted: impactToBoolean(input.product_quality_impact),
    patient_safety_impacted: impactToBoolean(input.patient_safety_impact),
    regulatory_impact: impactToBoolean(input.regulatory_impact_status),
    repeat_deviation: repeat,
    capa_required: input.capa_required,
  };

  const warnings: string[] = [];
  const capaRequired = computeCapaRequired(record);
  const headQaApprovalRequired = requiresHeadQaApproval(input.criticality || '');
  const notifyHeadQa = headQaApprovalRequired || impactToBoolean(input.patient_safety_impact);
  const notifyRegulatory = impactToBoolean(input.regulatory_impact_status);

  if (headQaApprovalRequired) warnings.push('Critical deviation — Head QA approval is required.');
  if (impactToBoolean(input.product_quality_impact)) warnings.push('Product quality impact — CAPA is mandatory.');
  if (impactToBoolean(input.patient_safety_impact)) warnings.push('Patient safety impact — CAPA required and Head QA will be notified.');
  if (impactToBoolean(input.regulatory_impact_status)) warnings.push('Regulatory impact — Regulatory Affairs will be notified.');
  if (repeat) warnings.push('Repeat deviation — CAPA recommendation is required.');

  return {
    capaRequired,
    headQaApprovalRequired,
    capaRecommendation: repeat,
    notifyHeadQa,
    notifyRegulatory,
    warnings,
  };
}

export {
  BATCH_IMPACT_OPTIONS,
  DEVIATION_CATEGORIES,
  DEVIATION_CRITICALITIES,
  DEVIATION_PLANNED_TYPES,
  DEPARTMENTS,
  TRI_STATE_IMPACT_OPTIONS,
  YES_NO_OPTIONS,
};
