import { z } from 'zod';

export const PQR_EQUIPMENT_REVIEW_MODULE = 'PQR Equipment Review';

export const PQR_EQUIPMENT_REVIEW_COLLECTIONS = {
  equipmentReview: 'pqr_equipment_review',
  sections: 'pqr_sections',
  records: 'pqr_records',
  recordsLegacy: 'pqr_documents',
  equipmentMaster: 'equipment_master',
  equipmentQualification: 'equipment_qualification',
  equipmentCalibration: 'equipment_calibration',
  calibrationRecords: 'calibration_records',
  preventiveMaintenance: 'preventive_maintenance',
  pmRecords: 'pm_records',
  breakdownRecords: 'breakdown_records',
  equipmentUsageLogs: 'equipment_usage_logs',
  utilityEquipment: 'utility_equipment',
  validationRecords: 'validation_records',
  deviations: 'deviations',
  capaRecords: 'capa_records',
  changeControls: 'change_controls',
} as const;

export const PQR_EQUIPMENT_CATEGORIES = [
  'Manufacturing Equipment', 'Packing Equipment', 'Utility Equipment',
  'QC Laboratory Equipment', 'Microbiology Equipment', 'Warehouse Equipment',
  'HVAC Equipment', 'Water System Equipment',
] as const;

export const PQR_EQUIPMENT_TYPES = [
  'Mixing Vessel', 'Storage Vessel', 'Holding Tank', 'Filtration Unit', 'Autoclave',
  'Vial Washing Machine', 'Depyrogenation Tunnel', 'Filling Machine', 'Sealing Machine',
  'Visual Inspection Machine', 'Packing Line', 'HVAC Unit', 'WFI System',
  'Purified Water System', 'Compressed Air System', 'HPLC', 'GC', 'UV Spectrophotometer',
  'Balance', 'pH Meter', 'Other',
] as const;

export const PQR_QUALIFICATION_STATUSES = [
  'Qualified', 'Partially Qualified', 'Qualification Due', 'Not Qualified',
] as const;

export const PQR_CALIBRATION_STATUSES = [
  'Calibrated', 'Calibration Due', 'Calibration Overdue', 'Not Calibrated',
] as const;

export const PQR_PM_STATUSES = ['Completed', 'Due', 'Overdue', 'Not Applicable'] as const;

export const PQR_EQUIPMENT_COMPLIANCE_STATUSES = [
  'Complies', 'Observation', 'Major Observation', 'Critical Observation',
] as const;

export const PQR_RISK_LEVELS = ['Low', 'Medium', 'High', 'Critical'] as const;

export type PqrEquipmentCategory = (typeof PQR_EQUIPMENT_CATEGORIES)[number];
export type PqrQualificationStatus = (typeof PQR_QUALIFICATION_STATUSES)[number];
export type PqrCalibrationStatus = (typeof PQR_CALIBRATION_STATUSES)[number];
export type PqrPmStatus = (typeof PQR_PM_STATUSES)[number];
export type PqrEquipmentComplianceStatus = (typeof PQR_EQUIPMENT_COMPLIANCE_STATUSES)[number];

export interface PqrEquipmentReviewRecord {
  id?: string;
  equipmentReviewId: string;
  pqrId: string;
  pqrNumber: string;
  product: string;
  productCode: string;
  equipmentId: string;
  equipmentCode: string;
  equipmentName: string;
  equipmentCategory: string;
  equipmentType: string;
  department: string;
  area: string;
  modelNumber: string;
  serialNumber: string;
  manufacturer: string;
  installationDate: string;
  qualificationStatus: string;
  iqStatus: string;
  oqStatus: string;
  pqStatus: string;
  calibrationStatus: string;
  lastCalibrationDate: string;
  nextCalibrationDate: string;
  pmStatus: string;
  lastPmDate: string;
  nextPmDate: string;
  breakdownCount: number;
  downtimeHours: number;
  linkedDeviations: number;
  linkedCapa: number;
  linkedChangeControls: number;
  impactOnProduct: string;
  riskLevel: string;
  complianceStatus: PqrEquipmentComplianceStatus | string;
  complianceReasons: string[];
  remarks: string;
  sourceType?: 'manual' | 'equipment_master' | 'pull';
  sourceId?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
  createdByName?: string;
  updatedByName?: string;
  isDeleted: boolean;
}

export interface PqrEquipmentReviewSummary {
  totalEquipmentReviewed: number;
  qualifiedEquipment: number;
  qualificationDue: number;
  calibrationDue: number;
  calibrationOverdue: number;
  pmDue: number;
  pmOverdue: number;
  breakdownCount: number;
  equipmentDeviations: number;
  equipmentCapa: number;
  equipmentChangeControls: number;
  criticalEquipmentRisks: number;
}

export interface PqrEquipmentReviewCharts {
  qualificationStatus: Array<{ name: string; value: number }>;
  calibrationComplianceTrend: Array<{ month: string; compliant: number; nonCompliant: number }>;
  pmComplianceTrend: Array<{ month: string; completed: number; overdue: number }>;
  breakdownTrend: Array<{ month: string; count: number }>;
  riskDistribution: Array<{ name: string; value: number }>;
  categoryReview: Array<{ name: string; value: number }>;
  downtimeTrend: Array<{ month: string; hours: number }>;
}

export const equipmentReviewFormSchema = z.object({
  pqrId: z.string().min(1, 'PQR selection is required'),
  product: z.string().min(1, 'Product is required'),
  productCode: z.string().min(1, 'Product code is required'),
  equipmentId: z.string().min(1, 'Equipment ID is required'),
  equipmentCode: z.string().default(''),
  equipmentName: z.string().min(1, 'Equipment name is required'),
  equipmentCategory: z.enum(PQR_EQUIPMENT_CATEGORIES),
  equipmentType: z.enum(PQR_EQUIPMENT_TYPES).default('Other'),
  department: z.string().default(''),
  area: z.string().default(''),
  modelNumber: z.string().default(''),
  serialNumber: z.string().default(''),
  manufacturer: z.string().default(''),
  installationDate: z.string().default(''),
  qualificationStatus: z.enum(PQR_QUALIFICATION_STATUSES),
  iqStatus: z.string().default(''),
  oqStatus: z.string().default(''),
  pqStatus: z.string().default(''),
  calibrationStatus: z.enum(PQR_CALIBRATION_STATUSES),
  lastCalibrationDate: z.string().default(''),
  nextCalibrationDate: z.string().default(''),
  pmStatus: z.enum(PQR_PM_STATUSES),
  lastPmDate: z.string().default(''),
  nextPmDate: z.string().default(''),
  breakdownCount: z.coerce.number().nonnegative().default(0),
  downtimeHours: z.coerce.number().nonnegative().default(0),
  linkedDeviations: z.coerce.number().nonnegative().default(0),
  linkedCapa: z.coerce.number().nonnegative().default(0),
  linkedChangeControls: z.coerce.number().nonnegative().default(0),
  impactOnProduct: z.string().default('None'),
  riskLevel: z.enum(PQR_RISK_LEVELS).default('Low'),
  remarks: z.string().default(''),
}).refine((d) => !d.lastCalibrationDate || !d.nextCalibrationDate || d.nextCalibrationDate > d.lastCalibrationDate, {
  message: 'Next Calibration Date must be after Last Calibration Date', path: ['nextCalibrationDate'],
}).refine((d) => !d.lastPmDate || !d.nextPmDate || d.nextPmDate > d.lastPmDate, {
  message: 'Next PM Date must be after Last PM Date', path: ['nextPmDate'],
});

export type EquipmentReviewFormData = z.infer<typeof equipmentReviewFormSchema>;

export function mapEquipmentCategory(rawType: string): PqrEquipmentCategory {
  const t = rawType.toLowerCase();
  if (t.includes('pack')) return 'Packing Equipment';
  if (t.includes('utility')) return 'Utility Equipment';
  if (t.includes('qc') || t.includes('laboratory') || t.includes('instrument')) return 'QC Laboratory Equipment';
  if (t.includes('micro')) return 'Microbiology Equipment';
  if (t.includes('warehouse')) return 'Warehouse Equipment';
  if (t.includes('hvac')) return 'HVAC Equipment';
  if (t.includes('water') || t.includes('wfi') || t.includes('purified')) return 'Water System Equipment';
  if (t.includes('manufactur') || t.includes('production')) return 'Manufacturing Equipment';
  const match = PQR_EQUIPMENT_CATEGORIES.find((c) => c.toLowerCase() === t);
  return match || 'Manufacturing Equipment';
}

export function mapCalibrationStatus(raw: string): PqrCalibrationStatus {
  const s = raw.toLowerCase();
  if (s === 'calibrated') return 'Calibrated';
  if (s === 'overdue' || s === 'failed') return 'Calibration Overdue';
  if (s === 'due') return 'Calibration Due';
  return 'Not Calibrated';
}

export function mapPmStatus(raw: string): PqrPmStatus {
  const s = raw.toLowerCase();
  if (s === 'completed') return 'Completed';
  if (s === 'overdue' || s === 'failed') return 'Overdue';
  if (s === 'due') return 'Due';
  return 'Not Applicable';
}

export function inferEquipmentType(name: string, category: string): string {
  const n = name.toLowerCase();
  const rules: Array<[string[], string]> = [
    [['hplc'], 'HPLC'], [['gc ', ' gc'], 'GC'], [['uv', 'spectro'], 'UV Spectrophotometer'],
    [['balance', 'weigh'], 'Balance'], [['ph meter', 'ph-meter'], 'pH Meter'],
    [['filling', 'fill machine'], 'Filling Machine'], [['sealing', 'seal machine'], 'Sealing Machine'],
    [['vial wash'], 'Vial Washing Machine'], [['depyro', 'tunnel'], 'Depyrogenation Tunnel'],
    [['autoclave'], 'Autoclave'], [['hvac', 'air handling'], 'HVAC Unit'],
    [['wfi', 'water for injection'], 'WFI System'], [['purified water', 'pw system'], 'Purified Water System'],
    [['compressed air', 'air system'], 'Compressed Air System'], [['packing line', 'pack line'], 'Packing Line'],
    [['mixing', 'mixer'], 'Mixing Vessel'], [['storage', 'tank'], 'Storage Vessel'],
    [['holding'], 'Holding Tank'], [['filter', 'filtration'], 'Filtration Unit'],
    [['visual inspect'], 'Visual Inspection Machine'],
  ];
  for (const [keys, type] of rules) {
    if (keys.some((k) => n.includes(k))) return type;
  }
  if (category.includes('Water')) return 'WFI System';
  if (category.includes('HVAC')) return 'HVAC Unit';
  return 'Other';
}

export function computeEquipmentCompliance(
  record: Partial<PqrEquipmentReviewRecord>,
): { complianceStatus: PqrEquipmentComplianceStatus; complianceReasons: string[]; riskLevel: string } {
  const reasons: string[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const qual = record.qualificationStatus;
  const cal = record.calibrationStatus;
  const pm = record.pmStatus;
  const breakdowns = record.breakdownCount ?? 0;
  const criticalBreakdown = breakdowns > 0 && (record.impactOnProduct || '').toLowerCase().includes('critical');
  const linkedCriticalDev = (record.linkedDeviations ?? 0) > 0 && (record.impactOnProduct || '').toLowerCase().includes('critical');

  if (qual === 'Not Qualified') reasons.push('Equipment not qualified');
  if (cal === 'Calibration Overdue') reasons.push('Calibration overdue');
  if (pm === 'Overdue') reasons.push('PM overdue');
  if (breakdowns > 3) reasons.push('Multiple breakdowns');
  if (criticalBreakdown) reasons.push('Critical breakdown');
  if (linkedCriticalDev) reasons.push('Critical deviation linked');

  let complianceStatus: PqrEquipmentComplianceStatus = 'Complies';
  if (qual === 'Not Qualified' || criticalBreakdown || linkedCriticalDev) {
    complianceStatus = 'Critical Observation';
  } else if (cal === 'Calibration Overdue' || pm === 'Overdue' || breakdowns > 1) {
    complianceStatus = 'Major Observation';
  } else if (cal === 'Calibration Due' || pm === 'Due' || qual === 'Qualification Due' || qual === 'Partially Qualified') {
    complianceStatus = 'Observation';
  } else if (
    qual === 'Qualified' && cal === 'Calibrated' && pm === 'Completed'
    && breakdowns <= 1 && !criticalBreakdown
  ) {
    complianceStatus = 'Complies';
  } else if (reasons.length > 0) {
    complianceStatus = 'Major Observation';
  }

  const riskLevel = computeEquipmentRisk(record, complianceStatus);
  return { complianceStatus, complianceReasons: reasons, riskLevel };
}

function computeEquipmentRisk(
  record: Partial<PqrEquipmentReviewRecord>,
  compliance: PqrEquipmentComplianceStatus,
): string {
  if ((record.impactOnProduct || '').toLowerCase().includes('critical')) return 'Critical';
  if (record.qualificationStatus === 'Not Qualified' || record.qualificationStatus === 'Qualification Due') return 'Critical';
  if ((record.breakdownCount ?? 0) > 3) return 'High';
  if (record.pmStatus === 'Overdue') return 'High';
  if (record.calibrationStatus === 'Calibration Overdue') return 'High';
  if (record.calibrationStatus === 'Calibration Due' || record.pmStatus === 'Due') return 'Medium';
  if (
    record.qualificationStatus === 'Qualified'
    && record.calibrationStatus === 'Calibrated'
    && record.pmStatus === 'Completed'
  ) return 'Low';
  if (compliance === 'Critical Observation') return 'Critical';
  if (compliance === 'Major Observation') return 'High';
  return 'Medium';
}

export function computeEquipmentSummary(
  records: PqrEquipmentReviewRecord[],
  linkedMetrics?: { equipmentDeviations?: number; equipmentCapa?: number; equipmentChangeControls?: number },
): PqrEquipmentReviewSummary {
  const active = records.filter((r) => !r.isDeleted);
  return {
    totalEquipmentReviewed: active.length,
    qualifiedEquipment: active.filter((r) => r.qualificationStatus === 'Qualified').length,
    qualificationDue: active.filter((r) => ['Qualification Due', 'Partially Qualified'].includes(r.qualificationStatus)).length,
    calibrationDue: active.filter((r) => r.calibrationStatus === 'Calibration Due').length,
    calibrationOverdue: active.filter((r) => r.calibrationStatus === 'Calibration Overdue').length,
    pmDue: active.filter((r) => r.pmStatus === 'Due').length,
    pmOverdue: active.filter((r) => r.pmStatus === 'Overdue').length,
    breakdownCount: active.reduce((s, r) => s + (r.breakdownCount || 0), 0),
    equipmentDeviations: linkedMetrics?.equipmentDeviations ?? active.reduce((s, r) => s + (r.linkedDeviations || 0), 0),
    equipmentCapa: linkedMetrics?.equipmentCapa ?? active.reduce((s, r) => s + (r.linkedCapa || 0), 0),
    equipmentChangeControls: linkedMetrics?.equipmentChangeControls ?? active.reduce((s, r) => s + (r.linkedChangeControls || 0), 0),
    criticalEquipmentRisks: active.filter((r) => r.riskLevel === 'Critical').length,
  };
}

export function generateEquipmentNarrative(
  summary: PqrEquipmentReviewSummary,
  records: PqrEquipmentReviewRecord[],
): string {
  const parts: string[] = [];
  if (summary.totalEquipmentReviewed === 0) {
    return 'No equipment records were reviewed for the selected PQR review period.';
  }
  const allCompliant = records.every((r) => r.complianceStatus === 'Complies');
  if (allCompliant) {
    parts.push('All equipment used during the review period remained qualified, calibrated and maintained as per approved procedures.');
  }
  if (summary.breakdownCount === 0 || summary.breakdownCount <= 1) {
    parts.push('No significant equipment breakdown affecting product quality was reported during the review period.');
  } else {
    parts.push(`${summary.breakdownCount} equipment breakdown(s) were recorded and reviewed during the review period.`);
  }
  if (summary.calibrationOverdue > 0) {
    parts.push('Certain equipment calibration activities exceeded the planned schedule and were reviewed for quality impact.');
  }
  const pmCompleted = records.filter((r) => r.pmStatus === 'Completed').length;
  if (pmCompleted > 0) {
    parts.push('Preventive maintenance activities were completed as per approved maintenance schedule.');
  }
  parts.push(`Total ${summary.totalEquipmentReviewed} equipment items reviewed (${summary.qualifiedEquipment} qualified, ${summary.criticalEquipmentRisks} critical risk).`);
  return parts.join(' ');
}

export function buildEquipmentCharts(records: PqrEquipmentReviewRecord[]): PqrEquipmentReviewCharts {
  const active = records.filter((r) => !r.isDeleted);
  const qualMap = new Map<string, number>();
  const riskMap = new Map<string, number>();
  const catMap = new Map<string, number>();
  const calMonth = new Map<string, { compliant: number; nonCompliant: number }>();
  const pmMonth = new Map<string, { completed: number; overdue: number }>();
  const bdMonth = new Map<string, number>();
  const dtMonth = new Map<string, number>();

  active.forEach((r) => {
    qualMap.set(r.qualificationStatus, (qualMap.get(r.qualificationStatus) || 0) + 1);
    riskMap.set(r.riskLevel || 'Low', (riskMap.get(r.riskLevel || 'Low') || 0) + 1);
    catMap.set(r.equipmentCategory, (catMap.get(r.equipmentCategory) || 0) + 1);
    const month = r.lastCalibrationDate?.slice(0, 7) || r.lastPmDate?.slice(0, 7) || 'Unknown';
    const cal = calMonth.get(month) || { compliant: 0, nonCompliant: 0 };
    if (r.calibrationStatus === 'Calibrated') cal.compliant += 1;
    else cal.nonCompliant += 1;
    calMonth.set(month, cal);
    const pm = pmMonth.get(month) || { completed: 0, overdue: 0 };
    if (r.pmStatus === 'Completed') pm.completed += 1;
    if (r.pmStatus === 'Overdue') pm.overdue += 1;
    pmMonth.set(month, pm);
    if (r.breakdownCount > 0) {
      bdMonth.set(month, (bdMonth.get(month) || 0) + r.breakdownCount);
      dtMonth.set(month, (dtMonth.get(month) || 0) + (r.downtimeHours || 0));
    }
  });

  return {
    qualificationStatus: Array.from(qualMap.entries()).map(([name, value]) => ({ name, value })),
    calibrationComplianceTrend: Array.from(calMonth.entries()).sort(([a], [b]) => a.localeCompare(b)).slice(-6)
      .map(([month, v]) => ({ month, ...v })),
    pmComplianceTrend: Array.from(pmMonth.entries()).sort(([a], [b]) => a.localeCompare(b)).slice(-6)
      .map(([month, v]) => ({ month, ...v })),
    breakdownTrend: Array.from(bdMonth.entries()).sort(([a], [b]) => a.localeCompare(b)).slice(-6)
      .map(([month, count]) => ({ month, count })),
    riskDistribution: Array.from(riskMap.entries()).map(([name, value]) => ({ name, value })),
    categoryReview: Array.from(catMap.entries()).map(([name, value]) => ({ name, value })),
    downtimeTrend: Array.from(dtMonth.entries()).sort(([a], [b]) => a.localeCompare(b)).slice(-6)
      .map(([month, hours]) => ({ month, hours })),
  };
}

export function canViewEquipmentReview(role?: string): boolean {
  return [
    'super_admin', 'admin', 'qa', 'head_qa', 'qa_manager', 'qa_executive',
    'engineering', 'maintenance', 'production', 'production_manager', 'production_executive',
    'qc', 'qc_manager', 'qc_executive', 'auditor', 'viewer',
  ].includes(role || '');
}

export function canManageEquipmentReview(role?: string): boolean {
  return ['super_admin', 'admin', 'engineering', 'maintenance', 'qa', 'head_qa', 'qa_manager', 'qa_executive'].includes(role || '');
}

export function canExportEquipmentReview(role?: string): boolean {
  return ['super_admin', 'admin', 'qa', 'head_qa', 'qa_manager', 'auditor'].includes(role || '');
}

export function qualificationStatusColor(status: string): string {
  if (status === 'Qualified') return 'bg-green-50 text-green-700 border-green-200';
  if (status === 'Partially Qualified') return 'bg-amber-50 text-amber-800 border-amber-200';
  if (status === 'Qualification Due') return 'bg-orange-50 text-orange-800 border-orange-200';
  return 'bg-red-50 text-red-700 border-red-200';
}

export function calibrationStatusColor(status: string): string {
  if (status === 'Calibrated') return 'bg-green-50 text-green-700 border-green-200';
  if (status === 'Calibration Due') return 'bg-amber-50 text-amber-800 border-amber-200';
  if (status === 'Calibration Overdue') return 'bg-red-50 text-red-700 border-red-200';
  return 'bg-slate-50 text-slate-600 border-slate-200';
}

export function pmStatusColor(status: string): string {
  if (status === 'Completed') return 'bg-green-50 text-green-700 border-green-200';
  if (status === 'Due') return 'bg-amber-50 text-amber-800 border-amber-200';
  if (status === 'Overdue') return 'bg-red-50 text-red-700 border-red-200';
  return 'bg-slate-50 text-slate-600 border-slate-200';
}

export function equipmentComplianceColor(status: string): string {
  if (status === 'Complies') return 'bg-green-50 text-green-700 border-green-200';
  if (status === 'Observation') return 'bg-blue-50 text-blue-700 border-blue-200';
  if (status === 'Major Observation') return 'bg-amber-50 text-amber-800 border-amber-200';
  return 'bg-red-50 text-red-700 border-red-200';
}

export function riskLevelColor(level: string): string {
  if (level === 'Critical') return 'bg-red-900/10 text-red-900 border-red-300';
  if (level === 'High') return 'bg-red-50 text-red-700 border-red-200';
  if (level === 'Medium') return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-green-50 text-green-700 border-green-200';
}

export const MANUFACTURING_CATEGORIES = ['Manufacturing Equipment'];
export const PACKING_CATEGORIES = ['Packing Equipment'];
export const UTILITY_CATEGORIES = ['Utility Equipment', 'HVAC Equipment', 'Water System Equipment'];
export const QC_CATEGORIES = ['QC Laboratory Equipment', 'Microbiology Equipment'];
