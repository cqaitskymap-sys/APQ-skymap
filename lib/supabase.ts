import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'public-anon-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type UserRole = 'super_admin' | 'qa' | 'qc' | 'production' | 'engineering' | 'warehouse' | 'regulatory' | 'viewer' | 'auditor';

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  department: string;
  employee_id: string;
  phone: string;
  avatar_url: string;
  is_active: boolean;
  last_login: string | null;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  product_code: string;
  product_name: string;
  generic_name: string;
  formulation: string;
  strength: string;
  pack_size: string;
  shelf_life_months: number;
  storage_conditions: string;
  market_authorization: string;
  therapeutic_category: string;
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export type BatchStatus = 'in_process' | 'released' | 'rejected' | 'quarantine' | 'recalled';

export interface Batch {
  id: string;
  batch_number: string;
  product_id: string;
  product_name: string;
  product_code: string;
  manufacturing_date: string;
  expiry_date: string;
  batch_size: number;
  unit: string;
  yield_percentage: number | null;
  status: BatchStatus;
  batch_formula_no: string;
  line_number: string;
  shift: string;
  batch_record_ref: string;
  remarks: string;
  approved_by: string | null;
  approved_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export type DeviationStatus = 'open' | 'under_investigation' | 'capa_raised' | 'closed' | 'rejected';
export type DeviationType = 'minor' | 'major' | 'critical';

export interface Deviation {
  id: string;
  deviation_number: string;
  title: string;
  description: string;
  deviation_type: DeviationType;
  category: string;
  product_id: string | null;
  batch_id: string | null;
  batch_number: string;
  product_name: string;
  area: string;
  detected_by: string | null;
  detected_date: string;
  root_cause: string;
  immediate_action: string;
  status: DeviationStatus;
  risk_assessment: 'low' | 'medium' | 'high' | 'critical';
  assigned_to: string | null;
  due_date: string | null;
  closed_date: string | null;
  closed_by: string | null;
  remarks: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export type OosStatus = 'open' | 'under_investigation' | 'invalidated' | 'confirmed' | 'closed';

export interface OosRecord {
  id: string;
  oos_number: string;
  product_id: string | null;
  batch_id: string | null;
  product_name: string;
  batch_number: string;
  test_parameter: string;
  specification: string;
  obtained_result: string;
  unit: string;
  phase: 'phase1' | 'phase2a' | 'phase2b' | 'phase3';
  status: OosStatus;
  investigation_type: 'laboratory' | 'manufacturing' | 'both';
  root_cause: string;
  corrective_action: string;
  assigned_to: string | null;
  due_date: string | null;
  closed_date: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export type CapaStatus = 'open' | 'in_progress' | 'verification' | 'effective' | 'ineffective' | 'closed';

export interface CapaRecord {
  id: string;
  capa_number: string;
  title: string;
  source: string;
  source_reference: string;
  capa_type: 'corrective' | 'preventive' | 'both';
  priority: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  root_cause_analysis: string;
  proposed_action: string;
  effectiveness_criteria: string;
  status: CapaStatus;
  assigned_to: string | null;
  target_date: string | null;
  actual_close_date: string | null;
  effectiveness_check_date: string | null;
  verified_by: string | null;
  verified_date: string | null;
  remarks: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Complaint {
  id: string;
  complaint_number: string;
  product_id: string | null;
  batch_number: string;
  product_name: string;
  complaint_category: string;
  complaint_source: 'customer' | 'distributor' | 'regulatory' | 'internal';
  description: string;
  customer_name: string;
  country: string;
  severity: 'minor' | 'major' | 'critical' | 'reportable';
  status: 'open' | 'under_investigation' | 'closed' | 'regulatory_reported';
  investigation_summary: string;
  corrective_action: string;
  regulatory_reporting_required: boolean;
  assigned_to: string | null;
  due_date: string | null;
  closed_date: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface PqrRecord {
  id: string;
  pqr_number: string;
  product_id: string;
  product_name: string;
  product_code: string;
  review_year: number;
  review_period_start: string;
  review_period_end: string;
  total_batches: number;
  released_batches: number;
  rejected_batches: number;
  recall_batches: number;
  avg_yield: number | null;
  oos_count: number;
  deviation_count: number;
  capa_count: number;
  complaint_count: number;
  stability_status: string;
  observations: string;
  conclusions: string;
  recommendations: string;
  overall_compliance: 'satisfactory' | 'needs_improvement' | 'unsatisfactory';
  status: 'draft' | 'under_review' | 'approved' | 'rejected';
  prepared_by: string | null;
  reviewed_by: string | null;
  approved_by: string | null;
  review_date: string | null;
  approval_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface Vendor {
  id: string;
  vendor_code: string;
  vendor_name: string;
  vendor_type: 'raw_material' | 'packaging' | 'api' | 'service' | 'equipment';
  country: string;
  contact_person: string;
  email: string;
  phone: string;
  approval_status: 'approved' | 'conditional' | 'suspended' | 'rejected';
  last_audit_date: string | null;
  next_audit_date: string | null;
  quality_rating: number;
  gmp_certificate_expiry: string | null;
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface AuditLog {
  id: string;
  user_id: string;
  user_name: string;
  user_role: string;
  action: string;
  module: string;
  record_id: string;
  record_number: string;
  field_name: string;
  old_value: string;
  new_value: string;
  ip_address: string;
  user_agent: string;
  timestamp: string;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success' | 'due_date';
  module: string;
  record_id: string;
  is_read: boolean;
  created_at: string;
}
