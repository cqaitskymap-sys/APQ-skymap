import { z } from 'zod';
import { QC_STATUSES, COA_AVAILABLE_OPTIONS } from '@/lib/material-schemas';

export const PACKING_MATERIAL_MONITORING_COLLECTION = 'packing_material_monitoring';
export const PACKING_MATERIAL_LEGACY_COLLECTION = 'cpv_packing_materials';
export const PACKING_MATERIAL_MASTER_COLLECTION = 'packaging_material_master';
export const PACKING_MODULE_NAME = 'Packing Material Monitoring';
export const PACKING_STORAGE_MODULE = 'cpv/packing-material-monitoring';

export const PM_MATERIAL_TYPES = [
  'Primary Packing Material',
  'Secondary Packing Material',
  'Tertiary Packing Material',
] as const;

export const PM_MATERIAL_CATEGORIES = [
  'Vial', 'Rubber Stopper', 'Flip Off Seal', 'Label', 'Carton',
  'Package Insert / Leaflet', 'Shipper Box', 'PVC Film', 'BOPP Tape', 'Other',
] as const;

export const PM_QC_STATUSES = QC_STATUSES;
export const PM_RECONCILIATION_STATUSES = ['Matched', 'Mismatch', 'Not Applicable'] as const;
export const PM_COMPLIANCE_STATUSES = ['Complies', 'Does Not Comply', 'Alert', 'Action'] as const;

export const DEFAULT_PM_MATERIALS = [
  'Glass Vial 2ml', 'Rubber Stopper 13mm', 'Flip Off Seal 13mm', 'Label', 'Carton',
  'Package Insert / Leaflet', 'Shipper Box', 'PVC Film', 'BOPP Tape',
] as const;

const LABEL_CATEGORIES = ['Label', 'Package Insert / Leaflet'];

const requiredText = z.string().trim().min(1, 'Required');

export const packingMaterialMonitoringFormSchema = z.object({
  cpvProductId: requiredText,
  productName: requiredText,
  productCode: requiredText,
  batchNumber: requiredText,
  materialCode: requiredText,
  materialName: requiredText,
  materialType: z.enum(PM_MATERIAL_TYPES),
  materialCategory: z.enum(PM_MATERIAL_CATEGORIES),
  manufacturerName: requiredText,
  supplierName: requiredText,
  vendorId: z.string().trim().default(''),
  vendorName: requiredText,
  vendorStatus: z.string().trim().default('Active'),
  avlStatus: z.string().trim().default('Approved'),
  grnNumber: z.string().trim().default(''),
  arNumber: requiredText,
  coaNumber: z.string().trim().default(''),
  materialLotNumber: z.string().trim().default(''),
  mfgDate: requiredText,
  expDate: requiredText,
  receivedQuantity: z.coerce.number().min(0).default(0),
  issuedQuantity: z.coerce.number().min(0, 'Required'),
  usedQuantity: z.coerce.number().min(0, 'Required'),
  rejectedQuantity: z.coerce.number().min(0).default(0),
  returnedQuantity: z.coerce.number().min(0).default(0),
  unit: requiredText,
  storageCondition: z.string().trim().default(''),
  qcStatus: z.enum(PM_QC_STATUSES),
  coaAvailable: z.enum(COA_AVAILABLE_OPTIONS),
  specificationNumber: z.string().trim().default(''),
  stpNumber: z.string().trim().default(''),
  testResultSummary: z.string().trim().default(''),
  remarks: z.string().trim().default(''),
}).refine((d) => {
  const mfg = new Date(d.mfgDate);
  const exp = new Date(d.expDate);
  return !Number.isNaN(mfg.getTime()) && !Number.isNaN(exp.getTime()) && exp > mfg;
}, { message: 'EXP date must be after MFG date', path: ['expDate'] }).refine((d) => d.usedQuantity <= d.issuedQuantity, {
  message: 'Used quantity cannot exceed issued quantity',
  path: ['usedQuantity'],
});

export type PackingMaterialMonitoringFormData = z.infer<typeof packingMaterialMonitoringFormSchema>;

export interface PackingMaterialAttachment {
  fileName: string;
  fileUrl: string;
  fileType: string;
  fileSize: number;
  uploadedBy: string;
  uploadedAt: string;
  category?: string;
}

export interface PackingMaterialMonitoringRecord extends PackingMaterialMonitoringFormData, Record<string, unknown> {
  id: string;
  packingMaterialMonitoringId: string;
  balanceQuantity: number;
  reconciliationStatus: typeof PM_RECONCILIATION_STATUSES[number];
  complianceStatus: string;
  riskLevel: string;
  deviationRequired: boolean;
  linkedDeviationNumber: string;
  capaRequired: boolean;
  linkedCapaNumber: string;
  reviewStatus: 'Draft' | 'Under Review' | 'Approved';
  isLocked: boolean;
  attachments: PackingMaterialAttachment[];
  warehouseReceiptId: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
  createdByName?: string;
  updatedByName?: string;
  isDeleted: boolean;
}

export interface PackingMaterialSummary {
  total: number;
  primaryLots: number;
  secondaryLots: number;
  tertiaryLots: number;
  approvedLots: number;
  rejectedLots: number;
  avlCompliant: number;
  nonCompliant: number;
  reconciliationMismatch: number;
  expiredMaterials: number;
  highRisk: number;
  deviationTriggered: number;
}

export function calculateBalanceQuantity(
  issued: number,
  used: number,
  rejected: number,
  returned: number,
): number {
  return issued - used - rejected - returned;
}

export function evaluateReconciliationStatus(
  issued: number,
  used: number,
  rejected: number,
  returned: number,
): typeof PM_RECONCILIATION_STATUSES[number] {
  if (issued === 0 && used === 0 && rejected === 0 && returned === 0) return 'Not Applicable';
  const balance = calculateBalanceQuantity(issued, used, rejected, returned);
  return balance === 0 ? 'Matched' : 'Mismatch';
}

export function isMaterialExpired(expDate: string): boolean {
  if (!expDate) return false;
  const exp = new Date(expDate);
  if (Number.isNaN(exp.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return exp < today;
}

export function evaluatePackingCompliance(input: {
  vendorStatus: string;
  avlStatus: string;
  qcStatus: string;
  coaAvailable: string;
  expDate: string;
  usedQuantity: number;
  issuedQuantity: number;
  reconciliationStatus: string;
}): string {
  const vendorOk = input.vendorStatus === 'Active';
  const avlOk = ['Approved', 'Conditional Approved', 'Conditionally Approved'].includes(input.avlStatus);
  const qcOk = input.qcStatus === 'Approved';
  const coaOk = input.coaAvailable === 'Yes';
  const notExpired = !isMaterialExpired(input.expDate);
  const qtyOk = input.usedQuantity <= input.issuedQuantity;
  const reconOk = input.reconciliationStatus === 'Matched' || input.reconciliationStatus === 'Not Applicable';
  if (!vendorOk || !avlOk || !qcOk || !coaOk || !notExpired || !qtyOk || !reconOk) return 'Does Not Comply';
  return 'Complies';
}

export function evaluatePackingRisk(
  record: Pick<PackingMaterialMonitoringRecord, 'expDate' | 'avlStatus' | 'qcStatus' | 'coaAvailable' | 'reconciliationStatus' | 'materialCategory' | 'complianceStatus'>,
  issueCount: number,
): string {
  const labelMismatch = LABEL_CATEGORIES.includes(record.materialCategory)
    && record.reconciliationStatus === 'Mismatch';
  if (isMaterialExpired(record.expDate) || record.qcStatus === 'Rejected' || labelMismatch) return 'Critical';
  if (issueCount >= 3) return 'High';
  if (!['Approved', 'Conditional Approved', 'Conditionally Approved'].includes(record.avlStatus)) return 'High';
  if (record.reconciliationStatus === 'Mismatch') return 'High';
  if (record.coaAvailable !== 'Yes') return 'Medium';
  if (record.complianceStatus === 'Alert' || record.complianceStatus === 'Action') return 'Medium';
  return 'Low';
}

export function buildPackingMaterialMonitoringId(batchNumber: string, materialCode: string, arNumber: string): string {
  return `PM-${batchNumber}-${materialCode}-${arNumber}`.replace(/\s+/g, '-').toUpperCase();
}

export function summarizePackingRecords(records: PackingMaterialMonitoringRecord[]): PackingMaterialSummary {
  return {
    total: records.length,
    primaryLots: records.filter((r) => r.materialType === 'Primary Packing Material').length,
    secondaryLots: records.filter((r) => r.materialType === 'Secondary Packing Material').length,
    tertiaryLots: records.filter((r) => r.materialType === 'Tertiary Packing Material').length,
    approvedLots: records.filter((r) => r.qcStatus === 'Approved').length,
    rejectedLots: records.filter((r) => r.qcStatus === 'Rejected').length,
    avlCompliant: records.filter((r) => ['Approved', 'Conditional Approved', 'Conditionally Approved'].includes(r.avlStatus)).length,
    nonCompliant: records.filter((r) => r.complianceStatus !== 'Complies').length,
    reconciliationMismatch: records.filter((r) => r.reconciliationStatus === 'Mismatch').length,
    expiredMaterials: records.filter((r) => isMaterialExpired(r.expDate)).length,
    highRisk: records.filter((r) => r.riskLevel === 'High' || r.riskLevel === 'Critical').length,
    deviationTriggered: records.filter((r) => r.deviationRequired || r.linkedDeviationNumber).length,
  };
}

export function buildPackingChartSeries(records: PackingMaterialMonitoringRecord[]) {
  const byMonth = new Map<string, number>();
  records.forEach((r) => {
    const key = (r.createdAt || '').slice(0, 7) || 'unknown';
    byMonth.set(key, (byMonth.get(key) || 0) + Number(r.usedQuantity || 0));
  });
  const usageTrend = Array.from(byMonth.entries())
    .map(([month, qty]) => ({ month, quantity: qty }))
    .sort((a, b) => a.month.localeCompare(b.month));

  const vendorMap = new Map<string, number>();
  records.forEach((r) => vendorMap.set(r.vendorName, (vendorMap.get(r.vendorName) || 0) + 1));
  const vendorTrend = Array.from(vendorMap.entries())
    .map(([vendor, count]) => ({ vendor, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const approved = records.filter((r) => r.qcStatus === 'Approved').length;
  const rejected = records.filter((r) => r.qcStatus === 'Rejected').length;
  const approvedVsRejected = [
    { status: 'Approved', count: approved },
    { status: 'Rejected', count: rejected },
    { status: 'Other', count: records.length - approved - rejected },
  ];

  const avlByMonth = new Map<string, { ok: number; total: number }>();
  records.forEach((r) => {
    const key = (r.createdAt || '').slice(0, 7) || 'unknown';
    const e = avlByMonth.get(key) || { ok: 0, total: 0 };
    e.total += 1;
    if (['Approved', 'Conditional Approved', 'Conditionally Approved'].includes(r.avlStatus)) e.ok += 1;
    avlByMonth.set(key, e);
  });
  const avlComplianceTrend = Array.from(avlByMonth.entries())
    .map(([month, v]) => ({ month, rate: v.total ? Math.round((v.ok / v.total) * 100) : 0 }))
    .sort((a, b) => a.month.localeCompare(b.month));

  const reconByMonth = new Map<string, number>();
  records.filter((r) => r.reconciliationStatus === 'Mismatch').forEach((r) => {
    const key = (r.createdAt || '').slice(0, 7) || 'unknown';
    reconByMonth.set(key, (reconByMonth.get(key) || 0) + 1);
  });
  const reconciliationMismatchTrend = Array.from(reconByMonth.entries())
    .map(([month, count]) => ({ month, count }))
    .sort((a, b) => a.month.localeCompare(b.month));

  const labelByMonth = new Map<string, number>();
  records.filter((r) => LABEL_CATEGORIES.includes(r.materialCategory) && r.reconciliationStatus === 'Mismatch').forEach((r) => {
    const key = (r.createdAt || '').slice(0, 7) || 'unknown';
    labelByMonth.set(key, (labelByMonth.get(key) || 0) + 1);
  });
  const labelReconciliationTrend = Array.from(labelByMonth.entries())
    .map(([month, count]) => ({ month, count }))
    .sort((a, b) => a.month.localeCompare(b.month));

  const riskMap = new Map<string, number>();
  records.forEach((r) => riskMap.set(r.riskLevel || 'Low', (riskMap.get(r.riskLevel || 'Low') || 0) + 1));
  const riskDistribution = Array.from(riskMap.entries()).map(([level, count]) => ({ level, count }));

  const materialUsage = new Map<string, number>();
  records.forEach((r) => materialUsage.set(r.materialName, (materialUsage.get(r.materialName) || 0) + Number(r.usedQuantity || 0)));
  const materialUsageTrend = Array.from(materialUsage.entries())
    .map(([material, quantity]) => ({ material, quantity }))
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 10);

  return {
    usageTrend, vendorTrend, approvedVsRejected, avlComplianceTrend,
    reconciliationMismatchTrend, labelReconciliationTrend, riskDistribution, materialUsageTrend,
  };
}

export function isLabelCategory(category: string): boolean {
  return LABEL_CATEGORIES.includes(category);
}
