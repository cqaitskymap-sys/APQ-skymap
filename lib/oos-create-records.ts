import { normalizeRole } from '@/lib/permissions';
import {
  computeResultStatus,
  isCriticalOosTest,
  isCriticalTest,
  type OosRecord,
} from '@/lib/oos-types';

export const OOS_WIZARD_STEPS = [
  'Basic Information',
  'Product & Batch',
  'Test & Specification',
  'Result & Observation',
  'Investigation Assignment',
  'Attachments & Submit',
] as const;

export const OOS_SAMPLE_TYPES = [
  'In-Process',
  'Finished Product',
  'Stability',
  'Raw Material',
  'Packing Material',
  'Microbiology',
] as const;

export const OOS_CREATE_RESULT_STATUSES = [
  'OOS',
  'Under Review',
  'Confirmed OOS',
  'Invalid OOS',
] as const;

export const BATCH_RELATED_SAMPLE_TYPES = ['In-Process', 'Finished Product', 'Stability'] as const;

export const OOS_DEPARTMENT_CODES: Record<string, string> = {
  QC: 'QC',
  QA: 'QA',
  Production: 'PRD',
  Microbiology: 'MIC',
  Engineering: 'ENG',
  Warehouse: 'WH',
};

export type OosCreateActor = { id: string; name: string; role?: string; email?: string };

export interface OosProductOption {
  id: string;
  productName: string;
  productCode: string;
}

export interface OosBatchOption {
  id: string;
  batchNumber: string;
  productId?: string;
  productName?: string;
  productCode?: string;
  pqrId?: string;
}

export interface OosInvestigatorOption {
  id: string;
  name: string;
  department?: string;
  role?: string;
}

export interface OosSourcePrefill {
  source?: OosRecord['source'];
  sourceReference?: string;
  cpvRecordId?: string;
  stabilityRecordId?: string;
  cqaResultId?: string;
  productName?: string;
  batchNumber?: string;
  department?: string;
  testName?: string;
  parameterName?: string;
  stpNumber?: string;
  specificationNumber?: string;
  specLowerLimit?: number;
  specUpperLimit?: number;
  observedResult?: number;
  unit?: string;
  analystName?: string;
  sampleType?: string;
  oosDate?: string;
}

export interface OosAutoRules {
  resultStatus: string;
  isOos: boolean;
  batchBlocked: boolean;
  capaSuggested: boolean;
  notifyHeadQa: boolean;
  notifyQaQc: boolean;
  warnings: string[];
}

export function departmentCode(department: string): string {
  return OOS_DEPARTMENT_CODES[department] || department.slice(0, 3).toUpperCase() || 'QC';
}

export function canCreateOos(role?: string | null): boolean {
  const r = normalizeRole(role);
  return ['super_admin', 'admin', 'qa_manager', 'qa', 'qc_manager', 'qc'].includes(r);
}

export function isOosCreateReadOnly(role?: string | null): boolean {
  const r = normalizeRole(role);
  return ['auditor', 'viewer', 'production_manager', 'production'].includes(r);
}

export function requiresBatchNumber(sampleType?: string): boolean {
  if (!sampleType) return true;
  return (BATCH_RELATED_SAMPLE_TYPES as readonly string[]).includes(sampleType);
}

export function computeOosCreateResultStatus(
  observed: number,
  lower: number,
  upper: number,
): string {
  return computeResultStatus(observed, lower, upper) === 'OOS' ? 'OOS' : 'Under Review';
}

export function computeOosAutoRules(input: {
  observed_result: number;
  spec_lower_limit: number;
  spec_upper_limit: number;
  test_name: string;
  batch_number?: string;
  batch_release_blocked?: boolean;
  capa_required?: boolean;
  is_critical_test?: boolean;
}): OosAutoRules {
  const resultStatus = computeOosCreateResultStatus(
    input.observed_result,
    input.spec_lower_limit,
    input.spec_upper_limit,
  );
  const isOos = resultStatus === 'OOS';
  const critical = input.is_critical_test ?? (isCriticalTest(input.test_name) || isCriticalOosTest(input.test_name));
  const batchBlocked = Boolean(input.batch_release_blocked) || (Boolean(input.batch_number) && isOos);
  const capaSuggested = isOos && critical;
  const notifyHeadQa = isOos && critical;
  const notifyQaQc = isOos;

  const warnings: string[] = [];
  if (isOos) warnings.push('Observed result is outside specification — OOS investigation will be initiated.');
  if (batchBlocked && input.batch_number) warnings.push('Batch release will be blocked pending investigation.');
  if (notifyHeadQa) warnings.push('Critical test failure — Head QA will be notified.');
  if (capaSuggested && !input.capa_required) warnings.push('CAPA may be required based on criticality.');
  if (notifyQaQc) warnings.push('QA and QC Manager will be notified on submission.');

  return {
    resultStatus,
    isOos,
    batchBlocked,
    capaSuggested,
    notifyHeadQa,
    notifyQaQc,
    warnings,
  };
}
