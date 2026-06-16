import { normalizeRole } from '@/lib/permissions';
import { requiresHeadQaApproval } from '@/lib/capa-types';

export const CAPA_CREATE_MODULE = 'CAPA Create';

export const CAPA_WIZARD_STEPS = [
  'Source & Basic Info',
  'Product & Batch',
  'Problem & Root Cause',
  'Corrective & Preventive Actions',
  'Effectiveness & Submit',
] as const;

export type CapaCreateActor = { id: string; name: string; role?: string; department?: string };

export interface CapaSourceLookupResult {
  found: boolean;
  source_id?: string;
  product_name?: string;
  batch_number?: string;
  department?: string;
  problem_description?: string;
  root_cause?: string;
  capa_title?: string;
  priority?: string;
  batch_id?: string;
  message?: string;
}

export interface CapaProductOption {
  id: string;
  name: string;
  code?: string;
}

export interface CapaBatchOption {
  id: string;
  batch_number: string;
  product_name?: string;
}

export interface CapaOwnerOption {
  id: string;
  name: string;
  department?: string;
}

const SOURCE_NUMBER_FIELDS: Record<string, { collection: string; field: string }> = {
  Deviation: { collection: 'deviations', field: 'deviation_number' },
  OOS: { collection: 'oos_records', field: 'oos_number' },
  Audit: { collection: 'audits', field: 'audit_number' },
  'Market Complaint': { collection: 'complaints', field: 'complaint_number' },
  'Change Control': { collection: 'change_controls', field: 'change_control_number' },
  'CPV Risk': { collection: 'cpv_risk_assessment', field: 'riskId' },
};

export function canCreateCapaWizard(role?: string | null): boolean {
  const r = normalizeRole(role || '');
  if (isCapaCreateReadOnly(r)) return false;
  return ['super_admin', 'admin', 'head_qa', 'qa_manager', 'qa', 'qa_executive', 'qc_manager', 'qc', 'production_manager', 'production'].includes(r);
}

export function isCapaCreateReadOnly(role?: string | null): boolean {
  return ['auditor', 'viewer'].includes(normalizeRole(role || ''));
}

export function computeCapaAutoRules(priority: string) {
  return {
    head_qa_approval_required: requiresHeadQaApproval(priority),
    criticality: priority === 'critical' ? 'Critical' : priority === 'high' ? 'High' : priority === 'medium' ? 'Medium' : 'Low',
  };
}

export function sourceNeedsReference(source: string): boolean {
  return !['Other', 'Self Inspection', 'Vendor Audit'].includes(source);
}

export function getSourceLookupConfig(source: string) {
  return SOURCE_NUMBER_FIELDS[source];
}

export function buildCapaNumberFallback(year: number, seq: number): string {
  return `CAPA/QA/${year}/${String(seq).padStart(4, '0')}`;
}

export function mapSourceRecordToPrefill(source: string, data: Record<string, unknown>, sourceId: string): CapaSourceLookupResult {
  const base: CapaSourceLookupResult = { found: true, source_id: sourceId };
  switch (source) {
    case 'Deviation':
      return {
        ...base,
        product_name: String(data.product_name || ''),
        batch_number: String(data.batch_number || ''),
        department: String(data.department || 'QA'),
        problem_description: String(data.description || data.title || ''),
        root_cause: String(data.root_cause || ''),
        capa_title: `CAPA for ${data.deviation_number || 'Deviation'}`,
        priority: data.criticality === 'Critical' ? 'critical' : data.criticality === 'Major' ? 'high' : 'medium',
      };
    case 'OOS':
      return {
        ...base,
        product_name: String(data.product_name || ''),
        batch_number: String(data.batch_number || ''),
        department: String(data.department || 'QC'),
        problem_description: `OOS — ${data.test_name || data.parameter_name}: ${data.observed_result || ''}`,
        capa_title: `CAPA for ${data.oos_number || 'OOS'}`,
        priority: data.is_critical_test ? 'critical' : 'high',
      };
    case 'Audit':
      return {
        ...base,
        department: String(data.department || 'QA'),
        problem_description: String(data.scope || data.audit_title || ''),
        capa_title: `CAPA for ${data.audit_number || 'Audit'}`,
        priority: 'high',
      };
    case 'Market Complaint':
      return {
        ...base,
        product_name: String(data.product_name || ''),
        batch_number: String(data.batch_number || ''),
        department: String(data.department || 'QA'),
        problem_description: String(data.complaint_description || data.description || ''),
        capa_title: `CAPA for ${data.complaint_number || 'Complaint'}`,
        priority: 'critical',
      };
    case 'Change Control':
      return {
        ...base,
        department: String(data.department || 'QA'),
        problem_description: String(data.change_description || data.title || ''),
        capa_title: `CAPA for ${data.change_control_number || 'Change Control'}`,
        priority: 'medium',
      };
    case 'CPV Risk':
      return {
        ...base,
        product_name: String(data.productName || data.product_name || ''),
        department: 'QA',
        problem_description: String(data.riskDescription || data.risk_description || ''),
        capa_title: `CAPA for ${data.riskId || data.risk_id || 'CPV Risk'}`,
        priority: data.riskLevel === 'Critical' || data.risk_level === 'Critical' ? 'critical' : 'high',
      };
    default:
      return base;
  }
}
