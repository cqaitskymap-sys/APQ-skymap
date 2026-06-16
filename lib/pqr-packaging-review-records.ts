import { z } from 'zod';

export const PQR_PACKAGING_REVIEW_MODULE = 'PQR Packaging Review';

export const PQR_PACKAGING_REVIEW_COLLECTIONS = {
  packagingReview: 'pqr_packaging_review',
  batchReview: 'pqr_batch_review',
  sections: 'pqr_sections',
  records: 'pqr_records',
  recordsLegacy: 'pqr_documents',
  batches: 'batches',
  cpvBatches: 'cpv_batches',
  packingMaterialMonitoring: 'packing_material_monitoring',
  packingMaterialMaster: 'packing_material_master',
  warehouseMaterials: 'warehouse_materials',
  vendors: 'vendors',
  approvedVendorList: 'approved_vendor_list',
  deviations: 'deviations',
  capaRecords: 'capa_records',
} as const;

export const PQR_PACKAGING_TYPES = [
  'Primary Packaging Material',
  'Secondary Packaging Material',
  'Tertiary Packaging Material',
] as const;

export const PQR_PACKAGING_CATEGORIES = [
  'Glass Vial', 'Rubber Stopper', 'Flip Off Seal', 'Label', 'Carton',
  'Package Insert / Leaflet', 'Shipper Box', 'PVC Film', 'BOPP Tape', 'Other',
] as const;

export const PQR_QC_STATUSES = [
  'Approved', 'Rejected', 'Under Test', 'Quarantine', 'Retest Required',
] as const;

export const PQR_RECONCILIATION_STATUSES = ['Matched', 'Mismatch', 'Not Applicable'] as const;

export const PQR_COMPLIANCE_STATUSES = ['Complies', 'Does Not Comply', 'Not Applicable'] as const;

export const PQR_AVL_STATUSES = ['Approved', 'Not Approved', 'Conditional Approved', 'Blocked'] as const;

export const PQR_RISK_LEVELS = ['Low', 'Medium', 'High', 'Critical'] as const;

export const PQR_DEFAULT_PACKAGING_MATERIALS = [
  'Glass Vial 2ml', 'Rubber Stopper 13mm', 'Flip Off Seal 13mm', 'Label', 'Carton',
  'Package Insert / Leaflet', 'Shipper Box', 'PVC Film', 'BOPP Tape',
] as const;

export const LABEL_CATEGORIES = ['Label', 'Package Insert / Leaflet'];

export type PqrPackagingType = (typeof PQR_PACKAGING_TYPES)[number];
export type PqrPackagingCategory = (typeof PQR_PACKAGING_CATEGORIES)[number];
export type PqrQcStatus = (typeof PQR_QC_STATUSES)[number];
export type PqrReconciliationStatus = (typeof PQR_RECONCILIATION_STATUSES)[number];
export type PqrComplianceStatus = (typeof PQR_COMPLIANCE_STATUSES)[number];

export interface PqrPackagingReviewRecord {
  id?: string;
  packagingReviewId: string;
  pqrId: string;
  pqrNumber: string;
  product: string;
  productCode: string;
  batchNumber: string;
  packagingMaterialType: string;
  packagingMaterialCategory: string;
  materialCode: string;
  materialName: string;
  manufacturerName: string;
  supplierName: string;
  vendorAvlStatus: string;
  grnNumber: string;
  arNumber: string;
  coaNumber: string;
  materialLotNumber: string;
  mfgDate: string;
  expDate: string;
  receivedQuantity: number;
  issuedQuantity: number;
  usedQuantity: number;
  rejectedQuantity: number;
  returnedQuantity: number;
  balanceQuantity: number;
  unit: string;
  qcStatus: string;
  coaAvailable: 'Yes' | 'No';
  specificationNumber: string;
  stpNumber: string;
  reconciliationStatus: PqrReconciliationStatus | string;
  complianceStatus: PqrComplianceStatus | string;
  complianceReasons: string[];
  riskLevel: string;
  remarks: string;
  sourceType?: 'manual' | 'packing_material_monitoring' | 'warehouse';
  sourceId?: string;
  attachmentUrls?: string[];
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
  createdByName?: string;
  updatedByName?: string;
  isDeleted: boolean;
}

export interface PackagingVendorAvlRow {
  id: string;
  supplierName: string;
  manufacturerName: string;
  materialCount: number;
  avlStatus: string;
  compliantLots: number;
  nonCompliantLots: number;
}

export interface PqrPackagingReviewSummary {
  totalPackagingLots: number;
  primaryPackagingLots: number;
  secondaryPackagingLots: number;
  tertiaryPackagingLots: number;
  approvedLots: number;
  rejectedLots: number;
  avlApprovedLots: number;
  nonCompliantLots: number;
  reconciliationMismatchCount: number;
  expiredMaterials: number;
  packagingDeviationCount: number;
  packagingCapaCount: number;
}

export interface PqrPackagingReviewCharts {
  packagingTypeDistribution: Array<{ name: string; value: number }>;
  approvedVsRejected: Array<{ name: string; value: number }>;
  vendorUsage: Array<{ vendor: string; count: number }>;
  avlComplianceTrend: Array<{ month: string; compliant: number; nonCompliant: number }>;
  reconciliationMismatchTrend: Array<{ month: string; count: number }>;
  riskDistribution: Array<{ name: string; value: number }>;
  labelReconciliationTrend: Array<{ month: string; matched: number; mismatch: number }>;
}

export const packagingReviewFormSchema = z.object({
  pqrId: z.string().min(1, 'PQR selection is required'),
  product: z.string().min(1, 'Product is required'),
  productCode: z.string().min(1, 'Product code is required'),
  batchNumber: z.string().default(''),
  packagingMaterialType: z.enum(PQR_PACKAGING_TYPES),
  packagingMaterialCategory: z.enum(PQR_PACKAGING_CATEGORIES),
  materialName: z.string().min(1, 'Material name is required'),
  materialCode: z.string().default(''),
  manufacturerName: z.string().min(1, 'Manufacturer is required'),
  supplierName: z.string().min(1, 'Supplier is required'),
  vendorAvlStatus: z.enum(PQR_AVL_STATUSES).default('Not Approved'),
  grnNumber: z.string().default(''),
  arNumber: z.string().min(1, 'AR Number is required'),
  coaNumber: z.string().default(''),
  materialLotNumber: z.string().default(''),
  mfgDate: z.string().default(''),
  expDate: z.string().default(''),
  receivedQuantity: z.coerce.number().nonnegative().default(0),
  issuedQuantity: z.coerce.number().positive('Issued quantity is required'),
  usedQuantity: z.coerce.number().nonnegative('Used quantity is required'),
  rejectedQuantity: z.coerce.number().nonnegative('Rejected quantity cannot be negative').default(0),
  returnedQuantity: z.coerce.number().nonnegative('Returned quantity cannot be negative').default(0),
  unit: z.string().min(1, 'Unit is required'),
  qcStatus: z.enum(PQR_QC_STATUSES),
  coaAvailable: z.enum(['Yes', 'No']),
  specificationNumber: z.string().default(''),
  stpNumber: z.string().default(''),
  riskLevel: z.enum(PQR_RISK_LEVELS).default('Low'),
  remarks: z.string().default(''),
}).refine((d) => !d.mfgDate || !d.expDate || d.expDate > d.mfgDate, {
  message: 'EXP Date must be after MFG Date', path: ['expDate'],
}).refine((d) => d.usedQuantity <= d.issuedQuantity, {
  message: 'Used Quantity cannot exceed Issued Quantity', path: ['usedQuantity'],
});

export type PackagingReviewFormData = z.infer<typeof packagingReviewFormSchema>;

export function computePackagingReconciliation(record: {
  issuedQuantity: number;
  usedQuantity: number;
  rejectedQuantity: number;
  returnedQuantity: number;
}): { balanceQuantity: number; reconciliationStatus: PqrReconciliationStatus } {
  const balanceQuantity = record.issuedQuantity - record.usedQuantity - record.rejectedQuantity - record.returnedQuantity;
  const reconciliationStatus: PqrReconciliationStatus = balanceQuantity === 0 ? 'Matched' : 'Mismatch';
  return { balanceQuantity, reconciliationStatus };
}

export function inferPackagingType(category: string, materialName: string): PqrPackagingType {
  const cat = category.toLowerCase();
  const name = materialName.toLowerCase();
  const primary = ['glass vial', 'vial', 'rubber stopper', 'flip off seal', 'stopper', 'seal'];
  const secondary = ['label', 'carton', 'package insert', 'leaflet'];
  const tertiary = ['shipper', 'pvc film', 'bopp tape', 'tape', 'film'];
  if (primary.some((k) => cat.includes(k) || name.includes(k))) return 'Primary Packaging Material';
  if (secondary.some((k) => cat.includes(k) || name.includes(k))) return 'Secondary Packaging Material';
  if (tertiary.some((k) => cat.includes(k) || name.includes(k))) return 'Tertiary Packaging Material';
  return 'Secondary Packaging Material';
}

export function normalizePackagingCategory(raw: string): PqrPackagingCategory {
  const v = raw.trim().toLowerCase();
  if (v.includes('vial')) return 'Glass Vial';
  if (v.includes('stopper')) return 'Rubber Stopper';
  if (v.includes('flip') || v.includes('seal')) return 'Flip Off Seal';
  if (v.includes('insert') || v.includes('leaflet')) return 'Package Insert / Leaflet';
  if (v.includes('shipper')) return 'Shipper Box';
  if (v.includes('pvc')) return 'PVC Film';
  if (v.includes('bopp') || v.includes('tape')) return 'BOPP Tape';
  if (v.includes('label')) return 'Label';
  if (v.includes('carton')) return 'Carton';
  const match = PQR_PACKAGING_CATEGORIES.find((c) => c.toLowerCase() === v);
  return match || 'Other';
}

export function computePackagingCompliance(
  record: Partial<PqrPackagingReviewRecord>,
  allRecords: PqrPackagingReviewRecord[] = [],
): {
  complianceStatus: PqrComplianceStatus;
  complianceReasons: string[];
  riskLevel: string;
  balanceQuantity: number;
  reconciliationStatus: PqrReconciliationStatus;
} {
  const reasons: string[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const recon = computePackagingReconciliation({
    issuedQuantity: record.issuedQuantity ?? 0,
    usedQuantity: record.usedQuantity ?? 0,
    rejectedQuantity: record.rejectedQuantity ?? 0,
    returnedQuantity: record.returnedQuantity ?? 0,
  });

  if (record.vendorAvlStatus !== 'Approved') reasons.push('Vendor not approved');
  if (record.qcStatus !== 'Approved') reasons.push('QC not approved');
  if (record.coaAvailable !== 'Yes') reasons.push('COA missing');

  if (record.expDate) {
    const exp = new Date(record.expDate);
    if (!Number.isNaN(exp.getTime()) && exp < today) reasons.push('Material expired');
  }
  if (
    record.usedQuantity !== undefined && record.issuedQuantity !== undefined
    && record.usedQuantity > record.issuedQuantity
  ) {
    reasons.push('Quantity mismatch');
  }
  if (recon.reconciliationStatus === 'Mismatch') reasons.push('Reconciliation mismatch');

  const riskLevel = computePackagingRisk(record, reasons, recon, allRecords);

  return {
    complianceStatus: reasons.length === 0 ? 'Complies' : 'Does Not Comply',
    complianceReasons: reasons,
    riskLevel,
    balanceQuantity: recon.balanceQuantity,
    reconciliationStatus: recon.reconciliationStatus,
  };
}

function computePackagingRisk(
  record: Partial<PqrPackagingReviewRecord>,
  reasons: string[],
  recon: { reconciliationStatus: PqrReconciliationStatus },
  allRecords: PqrPackagingReviewRecord[],
): string {
  const risks: string[] = [];
  if (reasons.includes('Material expired')) risks.push('Critical');
  if (record.qcStatus === 'Rejected') risks.push('Critical');
  if (
    recon.reconciliationStatus === 'Mismatch'
    && LABEL_CATEGORIES.some((c) => record.packagingMaterialCategory === c || (record.materialName || '').toLowerCase().includes('label'))
  ) {
    risks.push('Critical');
  }
  if (reasons.includes('Vendor not approved')) risks.push('High');
  if (reasons.includes('Reconciliation mismatch')) risks.push('High');
  if (reasons.includes('COA missing')) risks.push('Medium');

  const issueCount = allRecords.filter((r) =>
    r.materialName === record.materialName && r.complianceStatus === 'Does Not Comply',
  ).length;
  if (issueCount >= 3) risks.push('High');

  if (risks.includes('Critical')) return 'Critical';
  if (risks.includes('High')) return 'High';
  if (risks.includes('Medium')) return 'Medium';
  return reasons.length === 0 ? 'Low' : 'Medium';
}

export function computePackagingSummary(
  records: PqrPackagingReviewRecord[],
  qualityMetrics?: { packagingDeviationCount?: number; packagingCapaCount?: number },
): PqrPackagingReviewSummary {
  const active = records.filter((r) => !r.isDeleted);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const isPrimary = (t: string) => t === 'Primary Packaging Material';
  const isSecondary = (t: string) => t === 'Secondary Packaging Material';
  const isTertiary = (t: string) => t === 'Tertiary Packaging Material';

  return {
    totalPackagingLots: active.length,
    primaryPackagingLots: active.filter((r) => isPrimary(r.packagingMaterialType)).length,
    secondaryPackagingLots: active.filter((r) => isSecondary(r.packagingMaterialType)).length,
    tertiaryPackagingLots: active.filter((r) => isTertiary(r.packagingMaterialType)).length,
    approvedLots: active.filter((r) => r.qcStatus === 'Approved').length,
    rejectedLots: active.filter((r) => r.qcStatus === 'Rejected').length,
    avlApprovedLots: active.filter((r) => r.vendorAvlStatus === 'Approved').length,
    nonCompliantLots: active.filter((r) => r.complianceStatus === 'Does Not Comply').length,
    reconciliationMismatchCount: active.filter((r) => r.reconciliationStatus === 'Mismatch').length,
    expiredMaterials: active.filter((r) => r.expDate && new Date(r.expDate) < today).length,
    packagingDeviationCount: qualityMetrics?.packagingDeviationCount ?? 0,
    packagingCapaCount: qualityMetrics?.packagingCapaCount ?? 0,
  };
}

export function generatePackagingNarrative(
  summary: PqrPackagingReviewSummary,
  records: PqrPackagingReviewRecord[],
): string {
  const parts: string[] = [];
  if (summary.totalPackagingLots === 0) {
    return 'No packaging material lots were recorded for the selected PQR review period.';
  }
  if (summary.nonCompliantLots === 0 && summary.rejectedLots === 0) {
    parts.push('All packaging materials used during the review period were procured from approved vendors and complied with approved specifications.');
  }
  if (summary.rejectedLots === 0) {
    parts.push('No packaging material rejection was observed during the review period.');
  } else {
    parts.push(`${summary.rejectedLots} packaging material lot(s) were rejected during the review period.`);
  }
  if (summary.reconciliationMismatchCount === 0) {
    parts.push('Packaging material reconciliation was found satisfactory during the review period.');
  } else {
    parts.push('Packaging material reconciliation mismatch was observed and reviewed for quality impact.');
  }
  const allVendorsApproved = records.every((r) => r.vendorAvlStatus === 'Approved');
  if (allVendorsApproved) {
    parts.push('All packaging material suppliers/manufacturers were available in the approved vendor list.');
  }
  parts.push(`Total ${summary.totalPackagingLots} packaging lots reviewed (${summary.primaryPackagingLots} primary, ${summary.secondaryPackagingLots} secondary, ${summary.tertiaryPackagingLots} tertiary).`);
  return parts.join(' ');
}

export function buildPackagingCharts(records: PqrPackagingReviewRecord[]): PqrPackagingReviewCharts {
  const active = records.filter((r) => !r.isDeleted);
  const typeMap = new Map<string, number>();
  const vendorMap = new Map<string, number>();
  const riskMap = new Map<string, number>();
  const avlMonth = new Map<string, { compliant: number; nonCompliant: number }>();
  const mismatchMonth = new Map<string, number>();
  const labelMonth = new Map<string, { matched: number; mismatch: number }>();

  active.forEach((r) => {
    typeMap.set(r.packagingMaterialType, (typeMap.get(r.packagingMaterialType) || 0) + 1);
    vendorMap.set(r.supplierName || r.manufacturerName || 'Unknown', (vendorMap.get(r.supplierName || r.manufacturerName || 'Unknown') || 0) + 1);
    riskMap.set(r.riskLevel || 'Low', (riskMap.get(r.riskLevel || 'Low') || 0) + 1);
    const month = r.mfgDate?.slice(0, 7) || 'Unknown';
    const cur = avlMonth.get(month) || { compliant: 0, nonCompliant: 0 };
    if (r.complianceStatus === 'Complies') cur.compliant += 1;
    else cur.nonCompliant += 1;
    avlMonth.set(month, cur);
    if (r.reconciliationStatus === 'Mismatch') {
      mismatchMonth.set(month, (mismatchMonth.get(month) || 0) + 1);
    }
    const isLabel = LABEL_CATEGORIES.includes(r.packagingMaterialCategory) || r.materialName.toLowerCase().includes('label');
    if (isLabel) {
      const lm = labelMonth.get(month) || { matched: 0, mismatch: 0 };
      if (r.reconciliationStatus === 'Matched') lm.matched += 1;
      else lm.mismatch += 1;
      labelMonth.set(month, lm);
    }
  });

  return {
    packagingTypeDistribution: Array.from(typeMap.entries()).map(([name, value]) => ({ name, value })),
    approvedVsRejected: [
      { name: 'Approved', value: active.filter((r) => r.qcStatus === 'Approved').length },
      { name: 'Rejected', value: active.filter((r) => r.qcStatus === 'Rejected').length },
    ],
    vendorUsage: Array.from(vendorMap.entries()).slice(0, 8).map(([vendor, count]) => ({ vendor, count })),
    avlComplianceTrend: Array.from(avlMonth.entries()).sort(([a], [b]) => a.localeCompare(b)).slice(-6)
      .map(([month, v]) => ({ month, ...v })),
    reconciliationMismatchTrend: Array.from(mismatchMonth.entries()).sort(([a], [b]) => a.localeCompare(b)).slice(-6)
      .map(([month, count]) => ({ month, count })),
    riskDistribution: Array.from(riskMap.entries()).map(([name, value]) => ({ name, value })),
    labelReconciliationTrend: Array.from(labelMonth.entries()).sort(([a], [b]) => a.localeCompare(b)).slice(-6)
      .map(([month, v]) => ({ month, ...v })),
  };
}

export function buildPackagingVendorAvlRows(records: PqrPackagingReviewRecord[]): PackagingVendorAvlRow[] {
  const map = new Map<string, PackagingVendorAvlRow>();
  records.filter((r) => !r.isDeleted).forEach((r) => {
    const key = `${r.supplierName}|${r.manufacturerName}`;
    const cur = map.get(key) || {
      id: key,
      supplierName: r.supplierName,
      manufacturerName: r.manufacturerName,
      materialCount: 0,
      avlStatus: r.vendorAvlStatus,
      compliantLots: 0,
      nonCompliantLots: 0,
    };
    cur.materialCount += 1;
    if (r.complianceStatus === 'Complies') cur.compliantLots += 1;
    else cur.nonCompliantLots += 1;
    map.set(key, cur);
  });
  return Array.from(map.values());
}

export function canViewPackagingReview(role?: string): boolean {
  return [
    'super_admin', 'admin', 'qa', 'head_qa', 'qa_manager', 'qa_executive',
    'qc', 'qc_manager', 'qc_executive', 'production', 'production_manager', 'production_executive',
    'warehouse', 'warehouse_manager', 'warehouse_executive', 'auditor', 'viewer',
  ].includes(role || '');
}

export function canManagePackagingReview(role?: string): boolean {
  return ['super_admin', 'admin', 'qa', 'head_qa', 'qa_manager', 'qa_executive'].includes(role || '');
}

export function canUpdatePackagingQc(role?: string): boolean {
  return ['super_admin', 'admin', 'qa', 'head_qa', 'qa_manager', 'qc', 'qc_manager', 'qc_executive'].includes(role || '');
}

export function canAddPackagingReview(role?: string): boolean {
  return canManagePackagingReview(role) || ['warehouse', 'warehouse_manager', 'warehouse_executive'].includes(role || '');
}

export function canExportPackagingReview(role?: string): boolean {
  return ['super_admin', 'admin', 'qa', 'head_qa', 'qa_manager', 'auditor'].includes(role || '');
}

export function qcStatusColor(status: string): string {
  if (status === 'Approved') return 'bg-green-50 text-green-700 border-green-200';
  if (status === 'Rejected') return 'bg-red-50 text-red-700 border-red-200';
  if (status === 'Quarantine' || status === 'Retest Required') return 'bg-amber-50 text-amber-800 border-amber-200';
  return 'bg-blue-50 text-blue-700 border-blue-200';
}

export function avlStatusColor(status: string): string {
  if (status === 'Approved') return 'bg-green-50 text-green-700 border-green-200';
  if (status === 'Conditional Approved') return 'bg-amber-50 text-amber-800 border-amber-200';
  if (status === 'Blocked' || status === 'Not Approved') return 'bg-red-50 text-red-700 border-red-200';
  return 'bg-slate-50 text-slate-600 border-slate-200';
}

export function complianceStatusColor(status: string): string {
  if (status === 'Complies') return 'bg-green-50 text-green-700 border-green-200';
  if (status === 'Does Not Comply') return 'bg-red-50 text-red-700 border-red-200';
  return 'bg-slate-50 text-slate-600 border-slate-200';
}

export function reconciliationStatusColor(status: string): string {
  if (status === 'Matched') return 'bg-green-50 text-green-700 border-green-200';
  if (status === 'Mismatch') return 'bg-red-50 text-red-700 border-red-200';
  return 'bg-slate-50 text-slate-600 border-slate-200';
}

export function riskLevelColor(level: string): string {
  if (level === 'Critical') return 'bg-red-900/10 text-red-900 border-red-300';
  if (level === 'High') return 'bg-red-50 text-red-700 border-red-200';
  if (level === 'Medium') return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-green-50 text-green-700 border-green-200';
}
