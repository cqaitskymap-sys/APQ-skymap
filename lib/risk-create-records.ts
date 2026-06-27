import { normalizeRole } from '@/lib/permissions';
import type { RiskLevel } from '@/lib/cpv';
import { calculateRiskAssessment } from '@/lib/cpv-risk-assessment-records';

export const RISK_CREATE_MODULE = 'Create Risk Assessment';
export const RISK_REGISTER_COLLECTION = 'risk_register';

export const RISK_CREATE_WIZARD_STEPS = [
  'Source & Identification',
  'Product & Risk Context',
  'Risk Description & Scoring',
  'Mitigation & Residual Risk',
  'Review & Submit',
] as const;

export const RISK_CREATE_SOURCES = [
  'Manual',
  'Deviation',
  'OOS',
  'Complaint',
  'Change Control',
  'CAPA',
  'Audit',
  'CPV',
  'PQR',
  'Vendor',
  'Validation',
  'CSV',
  'Other',
] as const;

export const RISK_CREATE_CATEGORIES = [
  'Product Quality Risk',
  'Patient Safety Risk',
  'Regulatory Risk',
  'Process Risk',
  'Equipment Risk',
  'Utility Risk',
  'Facility Risk',
  'Validation Risk',
  'CSV/Data Integrity Risk',
  'Supplier Risk',
  'Material Risk',
  'Training Risk',
  'Environmental Risk',
  'Business Risk',
  'Cyber Security Risk',
  'Other',
] as const;

export const RISK_CREATE_STATUSES = [
  'Draft',
  'Open',
  'Under Review',
  'Mitigation In Progress',
  'Pending Approval',
  'Approved',
  'Closed',
  'Rejected',
  'Overdue',
] as const;

export const REVIEW_FREQUENCIES = [
  'Monthly',
  'Quarterly',
  'Half Yearly',
  'Annual',
  'Triggered Review',
] as const;

export type RiskCreateActor = {
  id: string;
  name: string;
  role?: string;
  department?: string;
  email?: string;
};

export interface RiskSourceLookupResult {
  found: boolean;
  source_id?: string;
  product_name?: string;
  product_code?: string;
  batch_number?: string;
  department?: string;
  risk_title?: string;
  risk_description?: string;
  potential_impact?: string;
  potential_cause?: string;
  potential_failure_mode?: string;
  process_area?: string;
  risk_category?: string;
  message?: string;
}

export interface RiskProductOption {
  id: string;
  name: string;
  code?: string;
}

export interface RiskBatchOption {
  id: string;
  batch_number: string;
  product_name?: string;
  product_code?: string;
}

export interface RiskDepartmentOption {
  id: string;
  name: string;
  code?: string;
}

export interface RiskOwnerOption {
  id: string;
  name: string;
  department?: string;
}

const SOURCE_LOOKUP: Record<string, { collection: string; field: string }> = {
  Deviation: { collection: 'deviations', field: 'deviation_number' },
  OOS: { collection: 'oos_records', field: 'oos_number' },
  Complaint: { collection: 'complaints', field: 'complaint_number' },
  'Change Control': { collection: 'change_controls', field: 'change_control_number' },
  CAPA: { collection: 'capa_records', field: 'capa_number' },
  Audit: { collection: 'audits', field: 'audit_number' },
  CPV: { collection: 'risk_assessment', field: 'riskNumber' },
  PQR: { collection: 'pqr_records', field: 'pqr_number' },
  Vendor: { collection: 'vendors', field: 'vendor_code' },
  Validation: { collection: 'validation_records', field: 'validation_number' },
  CSV: { collection: 'csv_records', field: 'csv_number' },
};

export function clampScore(n: number): number {
  return Math.max(1, Math.min(10, Math.round(n)));
}

export function calculateResidualRisk(
  residualSeverity: number,
  residualOccurrence: number,
  residualDetection: number,
): { residualRpn: number; residualRiskLevel: RiskLevel } {
  const calc = calculateRiskAssessment(residualSeverity, residualOccurrence, residualDetection);
  return { residualRpn: calc.rpnScore, residualRiskLevel: calc.riskLevel };
}

export function computeRiskCreateAutoRules(input: {
  severity: number;
  occurrence: number;
  detection: number;
  risk_category: string;
  residual_severity?: number;
  residual_occurrence?: number;
  residual_detection?: number;
}) {
  const calc = calculateRiskAssessment(input.severity, input.occurrence, input.detection);
  const residual = calculateResidualRisk(
    input.residual_severity ?? Math.max(1, input.severity - 1),
    input.residual_occurrence ?? Math.max(1, input.occurrence - 1),
    input.residual_detection ?? Math.max(1, input.detection - 1),
  );
  return {
    rpn: calc.rpnScore,
    risk_level: calc.riskLevel,
    mitigation_required: calc.rpnScore >= 101,
    notify_head_qa: calc.riskLevel === 'Critical' || input.risk_category === 'Patient Safety Risk',
    notify_csv: input.risk_category === 'CSV/Data Integrity Risk',
    notify_regulatory: input.risk_category === 'Regulatory Risk',
    residual_rpn: residual.residualRpn,
    residual_risk_level: residual.residualRiskLevel,
  };
}

export function sourceNeedsReference(source: string): boolean {
  return !['Manual', 'Other'].includes(source);
}

export function getRiskSourceLookupConfig(source: string) {
  return SOURCE_LOOKUP[source];
}

export function buildRiskNumberFallback(year: number, seq: number): string {
  return `RISK/${year}/${String(seq).padStart(4, '0')}`;
}

export function mapRiskSourceToPrefill(
  source: string,
  data: Record<string, unknown>,
  sourceId: string,
): RiskSourceLookupResult {
  const base: RiskSourceLookupResult = { found: true, source_id: sourceId };
  switch (source) {
    case 'Deviation':
      return {
        ...base,
        product_name: String(data.product_name || ''),
        batch_number: String(data.batch_number || ''),
        department: String(data.department || 'QA'),
        risk_title: `Risk from ${data.deviation_number || 'Deviation'}`,
        risk_description: String(data.description || data.title || ''),
        potential_impact: String(data.impact_assessment || data.title || ''),
        potential_cause: String(data.root_cause || ''),
        process_area: String(data.area || ''),
      };
    case 'OOS':
      return {
        ...base,
        product_name: String(data.product_name || ''),
        batch_number: String(data.batch_number || ''),
        department: String(data.department || 'QC'),
        risk_title: `Risk from ${data.oos_number || 'OOS'}`,
        risk_description: `OOS — ${data.test_name || data.parameter_name || ''}: ${data.observed_result || ''}`,
        potential_impact: 'Product quality / specification failure',
        potential_cause: String(data.initial_assessment || ''),
        process_area: String(data.test_name || data.parameter_name || ''),
      };
    case 'Complaint':
      return {
        ...base,
        product_name: String(data.product_name || ''),
        batch_number: String(data.batch_number || ''),
        department: String(data.department || 'QA'),
        risk_title: `Risk from ${data.complaint_number || 'Complaint'}`,
        risk_description: String(data.complaint_description || data.description || ''),
        potential_impact: String(data.issue_reported || data.complaint_description || ''),
        potential_cause: 'Market complaint investigation',
      };
    case 'Change Control':
      return {
        ...base,
        department: String(data.department || 'QA'),
        risk_title: `Risk from ${data.change_control_number || 'Change Control'}`,
        risk_description: String(data.change_description || data.title || ''),
        potential_impact: 'Change-related quality/regulatory impact',
        process_area: String(data.area || ''),
      };
    case 'CAPA':
      return {
        ...base,
        product_name: String(data.product_name || ''),
        batch_number: String(data.batch_number || ''),
        department: String(data.department || 'QA'),
        risk_title: `Risk from ${data.capa_number || 'CAPA'}`,
        risk_description: String(data.problem_description || data.capa_title || ''),
        potential_impact: String(data.problem_description || ''),
        potential_cause: String(data.root_cause || ''),
      };
    case 'Audit':
      return {
        ...base,
        department: String(data.department || 'QA'),
        risk_title: `Risk from ${data.audit_number || 'Audit'}`,
        risk_description: String(data.scope || data.audit_title || ''),
        potential_impact: 'Audit finding / GMP compliance gap',
      };
    case 'CPV':
      return {
        ...base,
        product_name: String(data.productName || data.product_name || ''),
        batch_number: String(data.batchNumber || data.batch_number || ''),
        department: 'QA',
        risk_title: `Risk from ${data.riskNumber || data.risk_number || 'CPV Risk'}`,
        risk_description: String(data.riskDescription || data.risk_description || ''),
        potential_impact: String(data.potentialImpact || data.potential_impact || ''),
        potential_cause: String(data.potentialCause || data.potential_cause || ''),
        process_area: String(data.processStage || data.process_stage || ''),
      };
    case 'PQR':
      return {
        ...base,
        product_name: String(data.product_name || ''),
        department: String(data.department || 'QA'),
        risk_title: `Risk from ${data.pqr_number || 'PQR'}`,
        risk_description: String(data.summary || data.title || ''),
        potential_impact: 'Product quality review finding',
        process_area: String(data.review_period || ''),
      };
    case 'Vendor':
      return {
        ...base,
        department: 'QA',
        risk_title: `Risk from ${data.vendor_name || data.vendor_code || 'Vendor'}`,
        risk_description: String(data.qualification_status || data.scope || ''),
        potential_impact: 'Supplier / vendor quality risk',
        process_area: 'Supplier Management',
      };
    case 'Validation':
      return {
        ...base,
        department: String(data.department || 'Validation'),
        risk_title: `Risk from ${data.validation_number || 'Validation'}`,
        risk_description: String(data.scope || data.title || ''),
        potential_impact: 'Validation lifecycle risk',
        process_area: String(data.system_name || data.equipment_name || ''),
      };
    case 'CSV':
      return {
        ...base,
        department: 'CSV',
        risk_title: `Risk from ${data.csv_number || 'CSV Record'}`,
        risk_description: String(data.system_description || data.title || ''),
        potential_impact: 'CSV / data integrity risk',
        process_area: String(data.system_name || ''),
        risk_category: 'CSV/Data Integrity Risk',
      };
    default:
      return {
        ...base,
        risk_title: `Risk from ${source}`,
        risk_description: String(data.title || data.description || data.name || ''),
      };
  }
}

export function canCreateRiskAssessmentWizard(role?: string | null): boolean {
  const r = normalizeRole(role || '');
  if (isRiskCreateReadOnly(r)) return false;
  return [
    'super_admin', 'admin', 'head_qa', 'qa_manager', 'qa', 'qa_executive',
    'risk_manager', 'department_head', 'regulatory_affairs', 'csv_manager',
    'validation_manager', 'qc_manager', 'production_manager',
  ].includes(r);
}

export function isRiskCreateReadOnly(role?: string | null): boolean {
  return ['auditor', 'viewer'].includes(normalizeRole(role || ''));
}

export function canSubmitRiskAssessment(role?: string | null): boolean {
  return canCreateRiskAssessmentWizard(role);
}

export function validateCategoryForRole(role: string | undefined, category: string): string | null {
  const raw = (role || '').toLowerCase().replace(/\s+/g, '_');
  if ((raw === 'regulatory_affairs' || raw === 'regulatory') && category !== 'Regulatory Risk') {
    return 'Regulatory users may only create Regulatory Risk assessments.';
  }
  if ((raw === 'csv_manager' || raw.includes('csv')) && category !== 'CSV/Data Integrity Risk') {
    return 'CSV Team may only create CSV/Data Integrity Risk assessments.';
  }
  return null;
}

export function validateDepartmentForRole(
  role: string | undefined,
  actorDepartment: string | undefined,
  riskDepartment: string,
): string | null {
  const raw = (role || '').toLowerCase().replace(/\s+/g, '_');
  if (raw !== 'department_head') return null;
  if (!actorDepartment?.trim()) return 'Department Head profile department is required.';
  if (actorDepartment.trim().toLowerCase() !== riskDepartment.trim().toLowerCase()) {
    return 'Department Head may only create risks for their own department.';
  }
  return null;
}

export function buildPreviewMatrixCell(severity: number, occurrence: number) {
  const s = clampScore(severity);
  const o = clampScore(occurrence);
  const rpn = s * o * 5;
  let level: RiskLevel = 'Low';
  if (rpn >= 201) level = 'Critical';
  else if (rpn >= 101) level = 'High';
  else if (rpn >= 51) level = 'Medium';
  return { severity: s, occurrence: o, rpn: s * o * clampScore(5), level };
}
