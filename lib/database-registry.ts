/**
 * Central Firestore collection registry for Pharma QMS + PQR + CPV.
 * Use for validation, audit tooling, and security rule alignment.
 */

export const AUDIT_FIELDS = [
  'createdAt', 'updatedAt', 'createdBy', 'createdByName', 'updatedBy', 'version',
] as const;

export const COLLECTION_REGISTRY = {
  // Admin & Auth
  profiles: { module: 'Admin', path: 'profiles', auditImmutable: false },
  users: { module: 'Admin', path: 'users', auditImmutable: false },
  roles: { module: 'Admin', path: 'roles', auditImmutable: false },
  permissions: { module: 'Admin', path: 'permissions', auditImmutable: false },
  departments: { module: 'Admin', path: 'departments', auditImmutable: false },
  designations: { module: 'Admin', path: 'designations', auditImmutable: false },
  company_sites: { module: 'Admin', path: 'company_sites', auditImmutable: false },
  workflows: { module: 'Admin', path: 'workflows', auditImmutable: false },
  approval_matrix: { module: 'Admin', path: 'approval_matrix', auditImmutable: false },
  document_numbering: { module: 'Admin', path: 'document_numbering', auditImmutable: false },
  notification_settings: { module: 'Admin', path: 'notification_settings', auditImmutable: false },
  esign_settings: { module: 'Admin', path: 'esign_settings', auditImmutable: false },
  system_settings: { module: 'Admin', path: 'system_settings', auditImmutable: false },
  backup_history: { module: 'Admin', path: 'backup_history', auditImmutable: false },

  // Master Data
  products: { module: 'Product', path: 'products', auditImmutable: false },
  batches: { module: 'Batch', path: 'batches', auditImmutable: false },
  parameters: { module: 'Product', path: 'parameters', auditImmutable: false },
  material_master: { module: 'Material', path: 'material_master', auditImmutable: false },
  vendor_master: { module: 'Vendor', path: 'vendor_master', auditImmutable: false },

  // CPV Operational
  cpv_cpp: { module: 'CPP', path: 'cpv_cpp', requiredFields: ['productName', 'batchNo', 'parameterName', 'observedValue', 'status'] },
  cpv_cqa: { module: 'CQA', path: 'cpv_cqa', requiredFields: ['productName', 'batchNo', 'testParameter', 'observedValue', 'status'] },
  cpv_yield: { module: 'CPV', path: 'cpv_yield' },
  cpv_yield_monitoring: { module: 'CPV', path: 'cpv_yield_monitoring' },
  cpv_utility: { module: 'CPV', path: 'cpv_utility' },
  cpv_utility_monitoring: { module: 'CPV', path: 'cpv_utility_monitoring' },
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
  cpv_audit_trail: { module: 'CPV', path: 'cpv_audit_trail', auditImmutable: true },

  // CPV Config (parameter masters)
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
  stability_studies: { module: 'Stability', path: 'stability_studies' },
  stability: { module: 'Stability', path: 'stability' },
  pqr_documents: { module: 'PQR', path: 'pqr_documents' },
  pqr_records: { module: 'PQR', path: 'pqr_records' },
  pqr_batches: { module: 'PQR', path: 'pqr_batches' },

  // Audit (immutable)
  audit_logs: { module: 'Admin', path: 'audit_logs', auditImmutable: true },
  audit_trail: { module: 'Admin', path: 'audit_trail', auditImmutable: true },
} as const;

export type CollectionName = keyof typeof COLLECTION_REGISTRY;

export function validateRecordMetadata(data: Record<string, unknown>): string[] {
  const errors: string[] = [];
  if (!data.createdAt) errors.push('Missing createdAt');
  if (!data.updatedAt) errors.push('Missing updatedAt');
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

/** Firestore composite index recommendations (deploy via firestore.indexes.json) */
export const RECOMMENDED_INDEXES = [
  { collection: 'cpv_cpp', fields: ['productName', 'createdAt'] },
  { collection: 'cpv_cpp', fields: ['batchNo', 'createdAt'] },
  { collection: 'cpv_cqa', fields: ['productName', 'createdAt'] },
  { collection: 'cpv_cqa', fields: ['batchNo', 'testDate'] },
  { collection: 'cpv_batches', fields: ['status', 'createdAt'] },
  { collection: 'cpv_risk_assessment', fields: ['riskLevel', 'createdAt'] },
  { collection: 'cpv_alerts', fields: ['status', 'createdAt'] },
  { collection: 'deviations', fields: ['status', 'created_at'] },
  { collection: 'capa_records', fields: ['status', 'created_at'] },
  { collection: 'oos_records', fields: ['status', 'created_at'] },
  { collection: 'pqr_documents', fields: ['document_status', 'created_at'] },
  { collection: 'profiles', fields: ['role', 'is_active'] },
] as const;
