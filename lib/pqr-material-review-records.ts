import { z } from 'zod';

export const PQR_MATERIAL_REVIEW_MODULE = 'PQR Material Review';

export const PQR_MATERIAL_REVIEW_COLLECTIONS = {
  materialReview: 'pqr_material_review',
  batchReview: 'pqr_batch_review',
  sections: 'pqr_sections',
  records: 'pqr_records',
  recordsLegacy: 'pqr_documents',
  batches: 'batches',
  cpvBatches: 'cpv_batches',
  rawMaterialMonitoring: 'raw_material_monitoring',
  materialMaster: 'material_master',
  warehouseMaterials: 'warehouse_materials',
  vendors: 'vendors',
  approvedVendorList: 'approved_vendor_list',
  deviations: 'deviations',
  oosRecords: 'oos_records',
  capaRecords: 'capa_records',
} as const;

export const PQR_MATERIAL_TYPES = [
  'API', 'Raw Material', 'Excipient', 'Preservative', 'Solvent',
  'Buffer', 'pH Adjuster', 'Vehicle', 'Other',
] as const;

export const PQR_QC_STATUSES = [
  'Approved', 'Rejected', 'Under Test', 'Quarantine', 'Retest Required',
] as const;

export const PQR_COMPLIANCE_STATUSES = ['Complies', 'Does Not Comply', 'Not Applicable'] as const;

export const PQR_AVL_STATUSES = ['Approved', 'Not Approved', 'Conditional Approved', 'Blocked'] as const;

export const PQR_RISK_LEVELS = ['Low', 'Medium', 'High', 'Critical'] as const;

export const PQR_DEFAULT_MATERIALS = [
  'Amikacin Sulphate IP', 'Methyl Paraben IP', 'Propyl Paraben IP',
  'Sodium Metabisulphite IP', 'Trisodium Citrate IP', 'Sulphuric Acid IP', 'Water for Injection IP',
] as const;

export type PqrMaterialType = (typeof PQR_MATERIAL_TYPES)[number];
export type PqrQcStatus = (typeof PQR_QC_STATUSES)[number];
export type PqrComplianceStatus = (typeof PQR_COMPLIANCE_STATUSES)[number];

export interface PqrMaterialReviewRecord {
  id?: string;
  materialReviewId: string;
  pqrId: string;
  pqrNumber: string;
  product: string;
  productCode: string;
  batchNumber: string;
  materialType: string;
  materialCode: string;
  materialName: string;
  materialGrade: string;
  manufacturerName: string;
  supplierName: string;
  vendorAvlStatus: string;
  grnNumber: string;
  arNumber: string;
  coaNumber: string;
  materialLotNumber: string;
  mfgDate: string;
  expDate: string;
  retestDate: string;
  receivedQuantity: number;
  issuedQuantity: number;
  usedQuantity: number;
  unit: string;
  qcStatus: string;
  coaAvailable: 'Yes' | 'No';
  specificationNumber: string;
  stpNumber: string;
  complianceStatus: PqrComplianceStatus | string;
  complianceReasons: string[];
  riskLevel: string;
  remarks: string;
  sourceType?: 'manual' | 'raw_material_monitoring' | 'warehouse';
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

export interface VendorAvlRow {
  id: string;
  supplierName: string;
  manufacturerName: string;
  materialCount: number;
  avlStatus: string;
  compliantLots: number;
  nonCompliantLots: number;
}

export interface PqrMaterialReviewSummary {
  totalMaterialLots: number;
  totalApiLots: number;
  totalRawMaterialLots: number;
  approvedLots: number;
  rejectedLots: number;
  avlApprovedLots: number;
  nonCompliantLots: number;
  expiredMaterials: number;
  retestDueMaterials: number;
  materialOosCount: number;
  materialDeviationCount: number;
}

export interface PqrMaterialReviewCharts {
  materialTypeDistribution: Array<{ name: string; value: number }>;
  approvedVsRejected: Array<{ name: string; value: number }>;
  vendorUsage: Array<{ vendor: string; count: number }>;
  avlComplianceTrend: Array<{ month: string; compliant: number; nonCompliant: number }>;
  riskDistribution: Array<{ name: string; value: number }>;
  retestDueTrend: Array<{ month: string; count: number }>;
}

export const materialReviewFormSchema = z.object({
  pqrId: z.string().min(1, 'PQR selection is required'),
  product: z.string().min(1, 'Product is required'),
  productCode: z.string().min(1, 'Product code is required'),
  batchNumber: z.string().default(''),
  materialType: z.enum(PQR_MATERIAL_TYPES),
  materialName: z.string().min(1, 'Material name is required'),
  materialCode: z.string().default(''),
  materialGrade: z.string().default(''),
  manufacturerName: z.string().min(1, 'Manufacturer is required'),
  supplierName: z.string().min(1, 'Supplier is required'),
  vendorAvlStatus: z.enum(PQR_AVL_STATUSES).default('Not Approved'),
  grnNumber: z.string().default(''),
  arNumber: z.string().min(1, 'AR Number is required'),
  coaNumber: z.string().default(''),
  materialLotNumber: z.string().default(''),
  mfgDate: z.string().default(''),
  expDate: z.string().default(''),
  retestDate: z.string().default(''),
  receivedQuantity: z.coerce.number().nonnegative().default(0),
  issuedQuantity: z.coerce.number().nonnegative().default(0),
  usedQuantity: z.coerce.number().positive('Used quantity is required'),
  unit: z.string().min(1, 'Unit is required'),
  qcStatus: z.enum(PQR_QC_STATUSES),
  coaAvailable: z.enum(['Yes', 'No']),
  specificationNumber: z.string().default(''),
  stpNumber: z.string().default(''),
  riskLevel: z.enum(PQR_RISK_LEVELS).default('Low'),
  remarks: z.string().default(''),
}).refine((d) => !d.mfgDate || !d.expDate || d.expDate > d.mfgDate, {
  message: 'EXP Date must be after MFG Date', path: ['expDate'],
}).refine((d) => d.usedQuantity <= d.issuedQuantity || d.issuedQuantity === 0, {
  message: 'Used Quantity cannot exceed Issued Quantity', path: ['usedQuantity'],
});

export type MaterialReviewFormData = z.infer<typeof materialReviewFormSchema>;

export function computeMaterialCompliance(record: Partial<PqrMaterialReviewRecord>): {
  complianceStatus: PqrComplianceStatus;
  complianceReasons: string[];
  riskLevel: string;
} {
  const reasons: string[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (record.vendorAvlStatus !== 'Approved') reasons.push('Vendor not approved');
  if (record.qcStatus !== 'Approved') reasons.push('QC not approved');
  if (record.coaAvailable !== 'Yes') reasons.push('COA missing');

  if (record.expDate) {
    const exp = new Date(record.expDate);
    if (!Number.isNaN(exp.getTime()) && exp < today) reasons.push('Material expired');
  }
  if (record.retestDate) {
    const retest = new Date(record.retestDate);
    if (!Number.isNaN(retest.getTime()) && retest < today) reasons.push('Retest overdue');
  }
  if (
    record.usedQuantity !== undefined && record.issuedQuantity !== undefined
    && record.issuedQuantity > 0 && record.usedQuantity > record.issuedQuantity
  ) {
    reasons.push('Quantity mismatch');
  }

  let riskLevel = record.riskLevel || 'Low';
  if (reasons.length >= 3) riskLevel = 'Critical';
  else if (reasons.length >= 2) riskLevel = 'High';
  else if (reasons.length === 1) riskLevel = 'Medium';

  return {
    complianceStatus: reasons.length === 0 ? 'Complies' : 'Does Not Comply',
    complianceReasons: reasons,
    riskLevel,
  };
}

export function computeMaterialSummary(
  records: PqrMaterialReviewRecord[],
  qualityMetrics?: { materialOosCount?: number; materialDeviationCount?: number },
): PqrMaterialReviewSummary {
  const active = records.filter((r) => !r.isDeleted);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const isApi = (t: string) => t === 'API';
  const isRaw = (t: string) => ['Raw Material', 'Excipient', 'Preservative', 'Buffer', 'pH Adjuster', 'Vehicle', 'Solvent'].includes(t);

  return {
    totalMaterialLots: active.length,
    totalApiLots: active.filter((r) => isApi(r.materialType)).length,
    totalRawMaterialLots: active.filter((r) => isRaw(r.materialType)).length,
    approvedLots: active.filter((r) => r.qcStatus === 'Approved').length,
    rejectedLots: active.filter((r) => r.qcStatus === 'Rejected').length,
    avlApprovedLots: active.filter((r) => r.vendorAvlStatus === 'Approved').length,
    nonCompliantLots: active.filter((r) => r.complianceStatus === 'Does Not Comply').length,
    expiredMaterials: active.filter((r) => r.expDate && new Date(r.expDate) < today).length,
    retestDueMaterials: active.filter((r) => r.retestDate && new Date(r.retestDate) < today).length,
    materialOosCount: qualityMetrics?.materialOosCount ?? 0,
    materialDeviationCount: qualityMetrics?.materialDeviationCount ?? 0,
  };
}

export function generateMaterialNarrative(summary: PqrMaterialReviewSummary, records: PqrMaterialReviewRecord[]): string {
  const parts: string[] = [];
  if (summary.totalMaterialLots === 0) {
    return 'No material lots were recorded for the selected PQR review period.';
  }
  if (summary.nonCompliantLots === 0 && summary.rejectedLots === 0) {
    parts.push('All API and raw materials used during the review period were procured from approved vendors and complied with approved specifications.');
  }
  if (summary.rejectedLots === 0) {
    parts.push('No raw material rejection was observed during the review period.');
  } else {
    parts.push(`${summary.rejectedLots} material lot(s) were rejected during the review period.`);
  }
  if (summary.nonCompliantLots > 0) {
    parts.push('Non-compliant material lots were observed during the review period and reviewed for quality impact.');
  }
  const allVendorsApproved = records.every((r) => r.vendorAvlStatus === 'Approved');
  if (allVendorsApproved) {
    parts.push('All material suppliers/manufacturers were available in the approved vendor list.');
  }
  parts.push(`Total ${summary.totalMaterialLots} material lots reviewed (${summary.totalApiLots} API, ${summary.totalRawMaterialLots} raw/excipient).`);
  return parts.join(' ');
}

export function buildMaterialCharts(records: PqrMaterialReviewRecord[]): PqrMaterialReviewCharts {
  const active = records.filter((r) => !r.isDeleted);
  const typeMap = new Map<string, number>();
  const vendorMap = new Map<string, number>();
  const riskMap = new Map<string, number>();
  const avlMonth = new Map<string, { compliant: number; nonCompliant: number }>();
  const retestMonth = new Map<string, number>();

  active.forEach((r) => {
    typeMap.set(r.materialType, (typeMap.get(r.materialType) || 0) + 1);
    vendorMap.set(r.supplierName || r.manufacturerName || 'Unknown', (vendorMap.get(r.supplierName || r.manufacturerName || 'Unknown') || 0) + 1);
    riskMap.set(r.riskLevel || 'Low', (riskMap.get(r.riskLevel || 'Low') || 0) + 1);
    const month = r.mfgDate?.slice(0, 7) || 'Unknown';
    const cur = avlMonth.get(month) || { compliant: 0, nonCompliant: 0 };
    if (r.complianceStatus === 'Complies') cur.compliant += 1;
    else cur.nonCompliant += 1;
    avlMonth.set(month, cur);
    if (r.retestDate) {
      const rm = r.retestDate.slice(0, 7);
      retestMonth.set(rm, (retestMonth.get(rm) || 0) + 1);
    }
  });

  return {
    materialTypeDistribution: Array.from(typeMap.entries()).map(([name, value]) => ({ name, value })),
    approvedVsRejected: [
      { name: 'Approved', value: active.filter((r) => r.qcStatus === 'Approved').length },
      { name: 'Rejected', value: active.filter((r) => r.qcStatus === 'Rejected').length },
    ],
    vendorUsage: Array.from(vendorMap.entries()).slice(0, 8).map(([vendor, count]) => ({ vendor, count })),
    avlComplianceTrend: Array.from(avlMonth.entries()).sort(([a], [b]) => a.localeCompare(b)).slice(-6)
      .map(([month, v]) => ({ month, ...v })),
    riskDistribution: Array.from(riskMap.entries()).map(([name, value]) => ({ name, value })),
    retestDueTrend: Array.from(retestMonth.entries()).sort(([a], [b]) => a.localeCompare(b)).slice(-6)
      .map(([month, count]) => ({ month, count })),
  };
}

export function buildVendorAvlRows(records: PqrMaterialReviewRecord[]): VendorAvlRow[] {
  const map = new Map<string, VendorAvlRow>();
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

export function canViewMaterialReview(role?: string): boolean {
  return [
    'super_admin', 'admin', 'qa', 'head_qa', 'qa_manager', 'qa_executive',
    'qc', 'qc_manager', 'qc_executive', 'production', 'production_manager', 'production_executive',
    'warehouse', 'warehouse_manager', 'warehouse_executive', 'auditor', 'viewer',
  ].includes(role || '');
}

export function canManageMaterialReview(role?: string): boolean {
  return ['super_admin', 'admin', 'qa', 'head_qa', 'qa_manager', 'qa_executive'].includes(role || '');
}

export function canUpdateMaterialQc(role?: string): boolean {
  return ['super_admin', 'admin', 'qa', 'head_qa', 'qa_manager', 'qc', 'qc_manager', 'qc_executive'].includes(role || '');
}

export function canAddMaterialReview(role?: string): boolean {
  return canManageMaterialReview(role) || ['warehouse', 'warehouse_manager', 'warehouse_executive'].includes(role || '');
}

export function canExportMaterialReview(role?: string): boolean {
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

export function riskLevelColor(level: string): string {
  if (level === 'Critical') return 'bg-red-900/10 text-red-900 border-red-300';
  if (level === 'High') return 'bg-red-50 text-red-700 border-red-200';
  if (level === 'Medium') return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-green-50 text-green-700 border-green-200';
}
