/**
 * Central Firestore collection registry for Pharma QMS + PQR + CPV.
 */

export const AUDIT_FIELDS = [
  'createdAt', 'updatedAt', 'createdBy', 'updatedBy', 'status', 'isDeleted',
] as const;

export const COLLECTION_REGISTRY = {
  // Admin & Auth
  profiles: { module: 'Admin', path: 'profiles' },
  users: { module: 'Admin', path: 'users' },
  roles: { module: 'Admin', path: 'roles' },
  permissions: { module: 'Admin', path: 'permissions' },
  departments: { module: 'Admin', path: 'departments' },
  designations: { module: 'Admin', path: 'designations' },
  company_sites: { module: 'Admin', path: 'company_sites' },
  workflows: { module: 'Admin', path: 'workflows' },
  approval_matrix: { module: 'Admin', path: 'approval_matrix' },
  document_numbering: { module: 'Admin', path: 'document_numbering' },
  notification_settings: { module: 'Admin', path: 'notification_settings' },
  esign_settings: { module: 'Admin', path: 'esign_settings' },
  system_settings: { module: 'Admin', path: 'system_settings' },
  backup_history: { module: 'Admin', path: 'backup_history' },

  // Master Data
  products: { module: 'Product', path: 'products' },
  batches: { module: 'Batch', path: 'batches' },
  parameters: { module: 'Product', path: 'parameters' },
  material_master: { module: 'Material', path: 'material_master' },
  vendor_master: { module: 'Vendor', path: 'vendor_master' },
  warehouse_materials: { module: 'Warehouse', path: 'warehouse_materials' },

  // CPV
  cpv_reviews: { module: 'CPV', path: 'cpv_reviews' },
  cpp_parameters: { module: 'CPP', path: 'cpp_parameters' },
  cpp_results: { module: 'CPP', path: 'cpp_results' },
  cqa_parameters: { module: 'CQA', path: 'cqa_parameters' },
  cqa_results: { module: 'CQA', path: 'cqa_results' },
  risk_assessment: { module: 'CPV', path: 'risk_assessment' },
  cpv_cpp: { module: 'CPP', path: 'cpv_cpp', requiredFields: ['productName', 'batchNo', 'parameterName', 'observedValue', 'status'] },
  cpv_cqa: { module: 'CQA', path: 'cpv_cqa', requiredFields: ['productName', 'batchNo', 'testParameter', 'observedValue', 'status'] },
  cpv_yield: { module: 'CPV', path: 'cpv_yield' },
  cpv_utility: { module: 'CPV', path: 'cpv_utility' },
  cpv_batches: { module: 'CPV', path: 'cpv_batches', requiredFields: ['batchNumber', 'productName', 'status'] },
  cpv_raw_materials: { module: 'CPV', path: 'cpv_raw_materials' },
  cpv_packing_materials: { module: 'CPV', path: 'cpv_packing_materials' },
  cpv_environment_monitoring: { module: 'CPV', path: 'cpv_environment_monitoring' },
  cpv_stability_studies: { module: 'CPV', path: 'cpv_stability_studies' },
  cpv_hold_time: { module: 'CPV', path: 'cpv_hold_time' },
  cpv_capability: { module: 'CPV', path: 'cpv_capability' },
  cpv_trends: { module: 'CPV', path: 'cpv_trends' },
  cpv_control_charts: { module: 'CPV', path: 'cpv_control_charts' },
  cpv_risk_assessment: { module: 'CPV', path: 'cpv_risk_assessment' },
  cpv_annual_review: { module: 'CPV', path: 'cpv_annual_review' },
  cpv_alerts: { module: 'CPV', path: 'cpv_alerts' },
  cpv_config_products: { module: 'CPV', path: 'cpv_config_products' },
  cpv_config_cpp_master: { module: 'CPP', path: 'cpv_config_cpp_master' },
  cpv_config_cqa_master: { module: 'CQA', path: 'cpv_config_cqa_master' },
  cpv_config_limit_master: { module: 'CPV', path: 'cpv_config_limit_master' },
  cpv_config_control_limit_master: { module: 'CPV', path: 'cpv_config_control_limit_master' },
  cpv_config_target_master: { module: 'CPV', path: 'cpv_config_target_master' },
  cpv_config_sampling: { module: 'CPV', path: 'cpv_config_sampling' },
  cpv_config_alerts: { module: 'CPV', path: 'cpv_config_alerts' },
  cpv_config_review: { module: 'CPV', path: 'cpv_config_review' },
  cpv_config_workflow: { module: 'CPV', path: 'cpv_config_workflow' },
  cpv_audit_trail: { module: 'CPV', path: 'cpv_audit_trail', auditImmutable: true },

  // QMS
  deviations: { module: 'Deviation', path: 'deviations' },
  oos_records: { module: 'OOS', path: 'oos_records' },
  oos: { module: 'OOS', path: 'oos' },
  capa_records: { module: 'CAPA', path: 'capa_records' },
  capa: { module: 'CAPA', path: 'capa' },
  change_control: { module: 'Change Control', path: 'change_control' },
  change_controls: { module: 'Change Control', path: 'change_controls' },
  complaints: { module: 'Complaint', path: 'complaints' },
  recall_records: { module: 'Recall', path: 'recall_records' },
  recalls: { module: 'Recall', path: 'recalls' },
  stability_studies: { module: 'Stability', path: 'stability_studies' },
  stability: { module: 'Stability', path: 'stability' },
  pqr_documents: { module: 'PQR', path: 'pqr_documents' },
  pqr_records: { module: 'PQR', path: 'pqr_records' },
  pqr_batches: { module: 'PQR', path: 'pqr_batches' },
  documents: { module: 'DMS', path: 'documents' },
  dms_documents: { module: 'DMS', path: 'dms_documents' },
  training_records: { module: 'Training', path: 'training_records' },
  audits: { module: 'Audit', path: 'audits' },
  audit_mgmt_records: { module: 'Audit', path: 'audit_mgmt_records' },
  vendors: { module: 'Vendor', path: 'vendors' },
  vendor_records: { module: 'Vendor', path: 'vendor_records' },
  validation_records: { module: 'Validation', path: 'validation_records' },
  csv_systems: { module: 'CSV', path: 'csv_systems' },
  equipment_master: { module: 'Equipment', path: 'equipment_master' },
  equipment_records: { module: 'Equipment', path: 'equipment_records' },
  calibration_records: { module: 'Equipment', path: 'calibration_records' },
  monitoring_records: { module: 'Monitoring', path: 'monitoring_records' },
  warehouse_records: { module: 'Warehouse', path: 'warehouse_records' },
  ebmr_records: { module: 'eBMR', path: 'ebmr_records' },

  // System
  audit_logs: { module: 'Admin', path: 'audit_logs', auditImmutable: true },
  audit_trail: { module: 'Admin', path: 'audit_trail', auditImmutable: true },
  notifications: { module: 'Admin', path: 'notifications' },
} as const;

export type CollectionName = keyof typeof COLLECTION_REGISTRY;

export function validateRecordMetadata(data: Record<string, unknown>): string[] {
  const errors: string[] = [];
  if (!data.createdAt && !data.created_at) errors.push('Missing createdAt');
  if (!data.updatedAt && !data.updated_at) errors.push('Missing updatedAt');
  return errors;
}

export function validateRequiredFields(
  collection: CollectionName,
  data: Record<string, unknown>,
): string[] {
  const spec = COLLECTION_REGISTRY[collection];
  const required = 'requiredFields' in spec ? spec.requiredFields : undefined;
  if (!required) return [];
  return required.filter((f) => data[f] === undefined || data[f] === null || data[f] === '');
}

export const RECOMMENDED_INDEXES = [
  { collection: 'notifications', fields: ['userId', 'createdAt'] },
  { collection: 'notifications', fields: ['userId', 'isRead'] },
  { collection: 'audit_trail', fields: ['moduleName', 'timestamp'] },
  { collection: 'audit_trail', fields: ['collectionName', 'documentId'] },
  { collection: 'cpv_cpp', fields: ['productName', 'createdAt'] },
  { collection: 'cpv_cqa', fields: ['batchNo', 'createdAt'] },
  { collection: 'cpv_batches', fields: ['status', 'createdAt'] },
  { collection: 'deviations', fields: ['status', 'createdAt'] },
  { collection: 'capa_records', fields: ['status', 'createdAt'] },
  { collection: 'oos_records', fields: ['status', 'createdAt'] },
  { collection: 'pqr_records', fields: ['status', 'createdAt'] },
  { collection: 'profiles', fields: ['role', 'is_active'] },
] as const;
