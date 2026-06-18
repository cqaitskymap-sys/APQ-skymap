import { normalizeRole } from '@/lib/permissions';

export const COMPLAINT_CREATE_MODULE = 'Complaint Create';

export const COMPLAINT_WIZARD_STEPS = [
  'Source & Customer',
  'Product & Batch',
  'Complaint & Impact',
  'Investigation Assignment',
  'Attachments & Submit',
] as const;

export type ComplaintCreateActor = { id: string; name: string; role?: string; department?: string };

export interface ComplaintCustomerOption {
  id: string;
  name: string;
  customer_type?: string;
  country?: string;
  market?: string;
  contact_person?: string;
  contact_details?: string;
}

export interface ComplaintProductOption {
  id: string;
  name: string;
  code?: string;
}

export interface ComplaintBatchOption {
  id: string;
  batch_number: string;
  product_name?: string;
  mfg_date?: string;
  exp_date?: string;
  pqr_id?: string | null;
  cpv_product_id?: string | null;
}

export interface ComplaintInvestigatorOption {
  id: string;
  name: string;
  department?: string;
}

export interface ComplaintAutoRules {
  notify_head_qa: boolean;
  notify_regulatory: boolean;
  recall_evaluation_enabled: boolean;
  head_qa_approval_required: boolean;
  capa_recommendation_required: boolean;
}

export function canCreateComplaintWizard(role?: string | null): boolean {
  const r = normalizeRole(role || '');
  if (isComplaintCreateReadOnly(r)) return false;
  return ['super_admin', 'admin', 'head_qa', 'qa_manager', 'qa', 'qa_executive'].includes(r);
}

export function isComplaintCreateReadOnly(role?: string | null): boolean {
  return ['auditor', 'viewer'].includes(normalizeRole(role || ''));
}

export function buildComplaintNumberFallback(year: number, seq: number): string {
  return `CMP/${year}/${String(seq).padStart(4, '0')}`;
}

export function computeComplaintAutoRules(input: {
  product_safety_impact?: boolean;
  regulatory_impact?: boolean;
  market_impact?: boolean;
  product_quality_impact?: boolean;
  complaint_criticality?: string;
}): ComplaintAutoRules {
  const marketImpact = input.market_impact === true;
  return {
    notify_head_qa: input.product_safety_impact === true || input.complaint_criticality === 'Critical',
    notify_regulatory: input.regulatory_impact === true,
    recall_evaluation_enabled: marketImpact,
    head_qa_approval_required: input.complaint_criticality === 'Critical',
    capa_recommendation_required: input.product_quality_impact === true,
  };
}

export function deriveRiskLevel(criticality: string, patientSafety: boolean, regulatory: boolean): string {
  if (criticality === 'Critical' || patientSafety) return 'Critical';
  if (criticality === 'Major' || regulatory) return 'High';
  if (criticality === 'Minor') return 'Medium';
  return 'Low';
}

export function mapCustomerToForm(customer: ComplaintCustomerOption) {
  return {
    customer_name: customer.name,
    customer_type: customer.customer_type || 'Retail',
    country: customer.country || '',
    market_region: customer.market || '',
    contact_person: customer.contact_person || '',
    customer_contact: customer.contact_details || '',
  };
}

export function mapBatchToForm(batch: ComplaintBatchOption) {
  return {
    batch_number: batch.batch_number,
    product_name: batch.product_name || '',
    mfg_date: batch.mfg_date || '',
    exp_date: batch.exp_date || '',
    batch_id: batch.id,
  };
}
