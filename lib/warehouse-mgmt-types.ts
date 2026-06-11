export const WAREHOUSE_COLLECTIONS = {
  receipts: 'material_receipts',
  sampling: 'qc_sampling',
  release: 'material_release',
  dispensing: 'material_dispensing',
  inventory: 'inventory_stock',
  finishedGoods: 'finished_goods',
  traceability: 'material_traceability',
  attachments: 'warehouse_attachments',
  auditLogs: 'audit_logs',
  notifications: 'notifications',
} as const;

export const WAREHOUSE_MATERIAL_TYPES = [
  'API', 'Raw Material', 'Excipient', 'Primary Packing Material',
  'Secondary Packing Material', 'Tertiary Packing Material', 'Finished Goods',
] as const;

export const RECEIPT_STATUSES = [
  'Received', 'Quarantine', 'Under Sampling', 'Under Test',
  'Approved', 'Rejected', 'Blocked', 'Expired',
] as const;

export const QC_STATUSES = ['Pending', 'Approved', 'Rejected', 'Under Test', 'Retest Required'] as const;

export const RELEASE_STATUSES = ['Pending', 'Released', 'Partially Released', 'Rejected'] as const;

export const DISPENSING_STATUSES = ['Draft', 'Dispensed', 'Verified', 'Rejected'] as const;

export const FG_STATUSES = ['Quarantine', 'Released', 'Partially Dispatched', 'Dispatched', 'Blocked'] as const;

export const EXPIRY_STATUSES = ['Valid', 'Near Expiry', 'Expired', 'Retest Due'] as const;

export const STORAGE_CONDITIONS = [
  'Room Temperature (15-25°C)', 'Cold (2-8°C)', 'Frozen (-20°C)',
  'Controlled Room Temperature', 'Protect from Light', 'Dry Place',
] as const;

export interface WarehouseActor {
  id: string;
  name: string;
  role: string;
}

export interface MaterialReceipt {
  id: string;
  grn_number: string;
  receipt_date: string;
  material_type: string;
  material_code: string;
  material_name: string;
  vendor_doc_id: string | null;
  vendor_name: string;
  manufacturer_name: string;
  supplier_name: string;
  invoice_number: string;
  po_number: string;
  ar_number: string;
  batch_lot_number: string;
  mfg_date: string | null;
  exp_date: string | null;
  retest_date: string | null;
  received_quantity: number;
  unit: string;
  container_count: number;
  storage_condition: string;
  coa_available: boolean;
  status: string;
  qc_status: string;
  remarks: string;
  created_by: string;
  created_by_name: string;
  updated_at: string;
  created_at: string;
}

export interface QcSampling {
  id: string;
  sampling_number: string;
  grn_number: string;
  receipt_doc_id: string;
  material_name: string;
  ar_number: string;
  sample_quantity: number;
  sampled_by: string;
  sampled_by_name: string;
  sampling_date: string;
  qc_status: string;
  remarks: string;
  created_at: string;
}

export interface MaterialRelease {
  id: string;
  release_number: string;
  grn_number: string;
  receipt_doc_id: string;
  ar_number: string;
  qc_result: string;
  released_quantity: number;
  rejected_quantity: number;
  approved_by: string;
  approved_by_name: string;
  release_date: string;
  status: string;
  remarks: string;
  created_at: string;
}

export interface MaterialDispensing {
  id: string;
  dispensing_number: string;
  product_name: string;
  batch_number: string;
  material_name: string;
  material_code: string;
  ar_number: string;
  receipt_doc_id: string;
  required_quantity: number;
  dispensed_quantity: number;
  balance_quantity: number;
  dispensed_by: string;
  dispensed_by_name: string;
  checked_by: string;
  checked_by_name: string;
  qa_verified_by: string;
  qa_verified_by_name: string;
  dispensing_date: string;
  status: string;
  fifo_suggested_ar: string | null;
  remarks: string;
  created_at: string;
}

export interface InventoryStock {
  id: string;
  material_name: string;
  material_code: string;
  material_type: string;
  ar_number: string;
  lot_number: string;
  grn_number: string;
  receipt_doc_id: string;
  available_quantity: number;
  reserved_quantity: number;
  consumed_quantity: number;
  rejected_quantity: number;
  storage_location: string;
  exp_date: string | null;
  retest_date: string | null;
  expiry_status: string;
  retest_status: string;
  qc_status: string;
  receipt_status: string;
  unit: string;
  updated_at: string;
}

export interface FinishedGoods {
  id: string;
  fg_batch_number: string;
  product_name: string;
  mfg_date: string;
  exp_date: string;
  packed_quantity: number;
  released_quantity: number;
  dispatch_quantity: number;
  balance_quantity: number;
  customer: string;
  market: string;
  status: string;
  source_batch_number: string;
  remarks: string;
  created_at: string;
  updated_at: string;
}

export interface TraceabilityRecord {
  id: string;
  ar_number: string;
  lot_number: string;
  material_name: string;
  material_type: string;
  grn_number: string;
  vendor_name: string;
  production_batch: string | null;
  fg_batch_number: string | null;
  dispatch_ref: string | null;
  chain: { step: string; ref_id: string; ref_no: string; date: string; quantity: number }[];
  updated_at: string;
}

export interface WarehouseFilters {
  material_type?: string;
  status?: string;
  search?: string;
}

export interface WarehouseDashboardMetrics {
  totalMaterials: number;
  quarantineStock: number;
  approvedStock: number;
  rejectedStock: number;
  expiredStock: number;
  retestDue: number;
  dispensedToday: number;
  finishedGoodsStock: number;
}

export function calcExpiryStatus(expDate: string | null): string {
  if (!expDate) return 'Valid';
  const today = new Date();
  const exp = new Date(expDate);
  if (exp < today) return 'Expired';
  const days = (exp.getTime() - today.getTime()) / 86400000;
  if (days <= 90) return 'Near Expiry';
  return 'Valid';
}

export function calcRetestStatus(retestDate: string | null): string {
  if (!retestDate) return 'Valid';
  const today = new Date();
  const retest = new Date(retestDate);
  if (retest < today) return 'Retest Due';
  const days = (retest.getTime() - today.getTime()) / 86400000;
  if (days <= 30) return 'Retest Due';
  return 'Valid';
}

export function isMaterialUsable(stock: Pick<InventoryStock, 'expiry_status' | 'retest_status' | 'qc_status' | 'receipt_status'>): boolean {
  return stock.receipt_status === 'Approved'
    && stock.qc_status === 'Approved'
    && stock.expiry_status !== 'Expired';
}

export function isWarehouseReadOnly(role: string): boolean {
  return ['auditor', 'viewer'].includes(role);
}

export function canManageWarehouse(role: string): boolean {
  return ['super_admin', 'admin', 'warehouse_manager', 'head_qa'].includes(role);
}

export function canSampleMaterial(role: string): boolean {
  return canManageWarehouse(role) || ['qc_manager'].includes(role);
}

export function canReleaseMaterial(role: string): boolean {
  return ['super_admin', 'admin', 'head_qa', 'qa_manager'].includes(role);
}

export function canDispenseMaterial(role: string): boolean {
  return canManageWarehouse(role) || ['production_manager'].includes(role);
}
