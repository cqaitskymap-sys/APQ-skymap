export const EBMR_COLLECTIONS = {
  records: 'ebmr_records',
  lineClearance: 'ebmr_line_clearance',
  dispensing: 'ebmr_dispensing',
  manufacturingSteps: 'ebmr_manufacturing_steps',
  equipmentUsage: 'ebmr_equipment_usage',
  cppRecords: 'ebmr_cpp_records',
  ipcChecks: 'ebmr_ipc_checks',
  reviews: 'ebmr_reviews',
  release: 'ebmr_release',
  attachments: 'ebmr_attachments',
  auditLogs: 'audit_logs',
  notifications: 'notifications',
} as const;

export const EBMR_STATUSES = [
  'Draft', 'Line Clearance Pending', 'Dispensing Pending', 'Manufacturing In Progress',
  'IPC Pending', 'QA Review', 'Approved', 'Released', 'Rejected', 'Hold', 'Cancelled',
] as const;

export const PROCESS_STAGES = [
  'Dispensing', 'Compounding', 'Mixing', 'pH Adjustment', 'Volume Make Up', 'Filtration',
  'Sterilization', 'Vial Washing', 'Depyrogenation', 'Filling', 'Sealing',
  'Visual Inspection', 'Packing',
] as const;

export const IPC_CHECK_NAMES = [
  'Description', 'pH', 'Fill Volume', 'Weight per ml', 'Colour', 'Clarity',
  'Sealing Quality', 'Visual Inspection', 'Leak Test',
  // Bulk / in-process (Ondansetron BMR spec)
  'Assay (%)', 'Total Viable Count (CFU/100 mL)', 'Colour Index (AU)',
  'Integrity Test BPT (mbar)', 'Filtration Pressure (bar) — Min', 'Filtration Pressure (bar) — Max',
  'Filtration Yield (%)', 'N₂ Pressure Pre-Fill (kg/cm²)', 'Machine Speed (ampoules/min)',
  'NVPC — 0.5 µm (particles/m³)', 'NVPC — 5 µm (particles/m³)', 'Filling Time (hr)',
  'Max Filled Nos. (calc.)', 'Filling Yield (%)',
  // Finished product (QA release)
  'Extractable Volume (mL)', 'Particulate Matter — Visible',
  'Particulate Matter — ≥10 µm (/mL)', 'Particulate Matter — ≥25 µm (/mL)',
  'Bacterial Endotoxin (EU/mg)', 'Ondansetron Imp. D (%)', 'Any Secondary Impurity (%)',
  'Sum of All Impurities (%)', 'Preservative — Methyl Paraben (%)', 'Preservative — Propyl Paraben (%)',
] as const;

export const MATERIAL_TYPES = ['API', 'Excipient', 'Primary Packing', 'Secondary Packing', 'Other'] as const;

export const OOS_IPC_CHECKS = ['pH', 'Fill Volume', 'Weight per ml'] as const;

export const STEP_STATUSES = ['Pending', 'In Progress', 'Completed', 'Failed', 'Skipped'] as const;

export const COMPLIANCE_STATUSES = ['Compliant', 'Non-Compliant', 'Pending'] as const;

export interface EbmrActor {
  id: string;
  name: string;
  role: string;
}

export interface EbmrRecord {
  id: string;
  ebmr_number: string;
  product_name: string;
  generic_name: string;
  strength: string;
  batch_number: string;
  batch_size: string;
  batch_size_litres: number | null;
  std_fill_volume_ml: number | null;
  batch_size_nos: number | null;
  mfg_date: string;
  exp_date: string;
  mfr_number: string;
  bmr_version: string;
  manufacturing_license_no: string;
  manufacturing_area: string;
  market: string;
  customer: string;
  batch_status: string;
  is_locked: boolean;
  line_clearance_verified: boolean;
  dispensing_complete: boolean;
  linked_deviation_ids: string[];
  linked_oos_ids: string[];
  created_by: string;
  created_by_name: string;
  reviewed_by: string;
  reviewed_by_name: string;
  approved_by: string;
  approved_by_name: string;
  remarks: string;
  created_at: string;
  updated_at: string;
}

export interface LineClearanceRecord {
  id: string;
  ebmr_doc_id: string;
  area_name: string;
  room_number: string;
  previous_product: string;
  previous_batch_number: string;
  area_cleaned: boolean;
  equipment_cleaned: boolean;
  documents_removed: boolean;
  material_removed: boolean;
  status_label_verified: boolean;
  line_clearance_done_by: string;
  line_clearance_done_by_name: string;
  checked_by: string;
  checked_by_name: string;
  qa_verified_by: string;
  qa_verified_by_name: string;
  clearance_datetime: string;
  status: string;
  qa_verified: boolean;
  remarks: string;
  created_at: string;
}

export interface EbmrDispensingRecord {
  id: string;
  ebmr_doc_id: string;
  material_type: string;
  material_name: string;
  material_code: string;
  ar_number: string;
  material_mfg_date: string;
  material_exp_date: string;
  vendor_name: string;
  required_quantity: number;
  dispensed_quantity: number;
  unit: string;
  balance_quantity: number;
  dispensed_by: string;
  dispensed_by_name: string;
  checked_by: string;
  checked_by_name: string;
  qa_verified_by: string;
  qa_verified_by_name: string;
  status: string;
  verified: boolean;
  remarks: string;
  created_at: string;
}

export interface ManufacturingStepRecord {
  id: string;
  ebmr_doc_id: string;
  step_number: number;
  process_stage: string;
  instruction: string;
  start_datetime: string;
  end_datetime: string;
  performed_by: string;
  performed_by_name: string;
  checked_by: string;
  checked_by_name: string;
  observed_value: string;
  acceptance_criteria: string;
  status: string;
  remarks: string;
  created_at: string;
}

export interface EquipmentUsageRecord {
  id: string;
  ebmr_doc_id: string;
  equipment_id: string;
  equipment_doc_id: string;
  equipment_name: string;
  process_stage: string;
  cleaning_status: string;
  sterilization_status: string;
  qualification_status: string;
  calibration_status: string;
  usage_start_time: string;
  usage_end_time: string;
  compliance_status: string;
  remarks: string;
  created_at: string;
}

export interface CppRecord {
  id: string;
  ebmr_doc_id: string;
  process_stage: string;
  parameter_name: string;
  target: number;
  lsl: number;
  usl: number;
  observed_value: number;
  unit: string;
  recorded_time: string;
  recorded_by: string;
  recorded_by_name: string;
  status: string;
  linked_deviation_id: string | null;
  linked_deviation_number: string | null;
  remarks: string;
  created_at: string;
}

export interface IpcCheckRecord {
  id: string;
  ebmr_doc_id: string;
  check_name: string;
  frequency: string;
  specification: string;
  observed_result: string;
  unit: string;
  checked_by: string;
  checked_by_name: string;
  check_datetime: string;
  status: string;
  linked_deviation_id: string | null;
  linked_oos_id: string | null;
  linked_reference_number: string | null;
  remarks: string;
  created_at: string;
}

export interface EbmrReviewRecord {
  id: string;
  ebmr_doc_id: string;
  review_type: string;
  reviewer: string;
  reviewer_name: string;
  review_date: string;
  decision: string;
  comments: string;
  created_at: string;
}

export interface EbmrReleaseRecord {
  id: string;
  ebmr_doc_id: string;
  release_number: string;
  released_by: string;
  released_by_name: string;
  release_date: string;
  decision: string;
  remarks: string;
  created_at: string;
}

export interface EbmrAttachment {
  id: string;
  ebmr_doc_id: string;
  file_name: string;
  file_type: string;
  category: string;
  download_url: string;
  uploaded_by: string;
  uploaded_by_name: string;
  uploaded_at: string;
}

export interface EbmrFilters {
  batch_status?: string;
  search?: string;
}

export interface EbmrDashboardMetrics {
  total: number;
  draft: number;
  inProgress: number;
  qaReviewPending: number;
  released: number;
  hold: number;
  rejected: number;
  deviationLinked: number;
}

export function classifyCppValue(observed: number, lsl: number, usl: number): 'Compliant' | 'OOT' {
  if (observed < lsl || observed > usl) return 'OOT';
  return 'Compliant';
}

export function isEbmrEditable(record: Pick<EbmrRecord, 'is_locked' | 'batch_status'>): boolean {
  return !record.is_locked && !['Released', 'Cancelled'].includes(record.batch_status);
}

export function isEbmrReadOnly(role: string): boolean {
  return ['auditor', 'viewer'].includes(role);
}

export function canCreateEbmr(role: string): boolean {
  return ['super_admin', 'admin', 'production_manager', 'head_qa', 'qa_manager'].includes(role);
}

export function canExecuteManufacturing(role: string): boolean {
  return canCreateEbmr(role) || ['warehouse_manager'].includes(role);
}

export function canVerifyLineClearance(role: string): boolean {
  return ['super_admin', 'admin', 'head_qa', 'qa_manager'].includes(role);
}

export function canEnterIpc(role: string): boolean {
  return canVerifyLineClearance(role) || ['qc_manager'].includes(role);
}

export function canReleaseBatch(role: string): boolean {
  return ['super_admin', 'admin', 'head_qa'].includes(role);
}
