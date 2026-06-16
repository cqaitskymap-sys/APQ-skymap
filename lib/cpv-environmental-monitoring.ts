import { z } from 'zod';
import { RESULT_TYPES } from '@/lib/admin/constants';

export const ENVIRONMENTAL_MONITORING_COLLECTION = 'environmental_monitoring';
export const ENVIRONMENTAL_LEGACY_COLLECTIONS = ['cpv_environment_monitoring'] as const;
export const AREA_MASTER_COLLECTION = 'area_master';
export const ENVIRONMENTAL_MODULE_NAME = 'Environmental Monitoring';

export const CLEANROOM_GRADES = [
  'Grade A', 'Grade B', 'Grade C', 'Grade D', 'Controlled Area', 'Unclassified',
] as const;

export const EM_MONITORING_TYPES = [
  'Temperature',
  'Relative Humidity',
  'Differential Pressure',
  'Non-Viable Particle Count',
  'Viable Particle Count',
  'Settle Plate',
  'Active Air Sampling',
  'Surface Monitoring',
  'Personnel Monitoring',
  'Contact Plate',
] as const;

export const EM_PROCESS_STAGES = [
  'Dispensing', 'Mixing', 'Filtration', 'Sterilization', 'Vial Washing', 'Depyrogenation',
  'Filling', 'Sealing', 'Visual Inspection', 'Packing', 'General Monitoring',
] as const;

export const EM_STATUSES = ['Complies', 'Alert', 'Action', 'Excursion'] as const;
export const EM_REVIEW_STATUSES = ['Draft', 'Under Review', 'Approved'] as const;

export const DEFAULT_EM_PARAMETERS = [
  'Room Temperature', 'Relative Humidity', 'Differential Pressure',
  'Particles >=0.5µm', 'Particles >=5.0µm', 'Viable Count',
  'Settle Plate Count', 'Active Air Count', 'Surface Count', 'Personnel Count',
] as const;

const MICROBIAL_TYPES = [
  'Viable Particle Count', 'Settle Plate', 'Active Air Sampling',
  'Surface Monitoring', 'Personnel Monitoring', 'Contact Plate',
];

const requiredText = z.string().trim().min(1, 'Required');

export const environmentalMonitoringFormSchema = z.object({
  cpvProductId: requiredText,
  productName: requiredText,
  productCode: requiredText,
  batchNumber: requiredText,
  areaName: requiredText,
  areaId: z.string().trim().default(''),
  roomNumber: requiredText,
  cleanroomGrade: z.enum(CLEANROOM_GRADES),
  processStage: z.enum(EM_PROCESS_STAGES).default('General Monitoring'),
  monitoringType: z.enum(EM_MONITORING_TYPES),
  samplingLocation: z.string().trim().default(''),
  parameterId: z.string().trim().default(''),
  parameterCode: requiredText,
  parameterName: requiredText,
  observedValue: z.union([z.coerce.number(), z.string().trim().min(1, 'Required')]),
  targetValue: z.coerce.number().optional(),
  lowerLimit: z.coerce.number(),
  upperLimit: z.coerce.number(),
  alertLimitLow: z.coerce.number().optional(),
  alertLimitHigh: z.coerce.number().optional(),
  actionLimitLow: z.coerce.number().optional(),
  actionLimitHigh: z.coerce.number().optional(),
  unit: requiredText,
  resultType: z.enum(RESULT_TYPES).default('Numeric'),
  monitoringDate: requiredText,
  monitoringTime: requiredText,
  recordedBy: requiredText,
  reviewedBy: z.string().trim().default(''),
  reviewDate: z.string().trim().default(''),
  remarks: z.string().trim().default(''),
  autoDeviationRequired: z.boolean().default(true),
}).refine((d) => d.lowerLimit < d.upperLimit, {
  message: 'Upper limit must be greater than lower limit',
  path: ['upperLimit'],
});

export type EnvironmentalMonitoringFormData = z.infer<typeof environmentalMonitoringFormSchema>;

export interface EnvironmentalMonitoringRecord extends EnvironmentalMonitoringFormData, Record<string, unknown> {
  id: string;
  environmentalMonitoringId: string;
  status: typeof EM_STATUSES[number] | string;
  riskLevel: string;
  deviationRequired: boolean;
  linkedDeviationNumber: string;
  capaRequired: boolean;
  linkedCapaNumber: string;
  reviewStatus: typeof EM_REVIEW_STATUSES[number];
  isLocked: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
  createdByName?: string;
  updatedByName?: string;
  isDeleted: boolean;
}

export interface EnvironmentalSummary {
  total: number;
  compliant: number;
  alert: number;
  action: number;
  excursion: number;
  gradeAExcursions: number;
  gradeBExcursions: number;
  microbialExcursions: number;
  deviationTriggered: number;
  capaSuggested: number;
}

export function buildEnvironmentalMonitoringId(
  batchNumber: string,
  parameterCode: string,
  areaName: string,
): string {
  return `EM-${batchNumber}-${parameterCode}-${areaName}`.replace(/\s+/g, '-').toUpperCase();
}

export function evaluateEnvironmentalStatus(
  observed: number | string,
  lsl: number,
  usl: number,
  resultType: string,
  alertLow?: number,
  alertHigh?: number,
  actionLow?: number,
  actionHigh?: number,
): string {
  if (resultType === 'Pass/Fail') {
    const v = String(observed).toLowerCase();
    return v === 'pass' ? 'Complies' : 'Excursion';
  }
  if (resultType === 'Complies/Does Not Comply') {
    const v = String(observed).toLowerCase();
    return v.includes('comply') && !v.includes('not') ? 'Complies' : 'Excursion';
  }
  const num = Number(observed);
  if (!Number.isFinite(num)) return 'Excursion';
  if (num < lsl || num > usl) return 'Excursion';
  if (actionLow != null && !Number.isNaN(actionLow) && num < actionLow) return 'Action';
  if (actionHigh != null && !Number.isNaN(actionHigh) && num > actionHigh) return 'Action';
  if (alertLow != null && !Number.isNaN(alertLow) && num < alertLow) return 'Alert';
  if (alertHigh != null && !Number.isNaN(alertHigh) && num > alertHigh) return 'Alert';
  return 'Complies';
}

export function isMicrobialMonitoring(
  monitoringType: string,
  parameterName: string,
): boolean {
  if (MICROBIAL_TYPES.includes(monitoringType)) return true;
  const p = parameterName.toLowerCase();
  return p.includes('viable') || p.includes('microbial') || p.includes('settle')
    || p.includes('surface') || p.includes('personnel') || p.includes('contact');
}

export function evaluateEnvironmentalRisk(
  record: Pick<EnvironmentalMonitoringRecord, 'cleanroomGrade' | 'processStage' | 'monitoringType' | 'parameterName' | 'status'>,
  failureCount: number,
): string {
  if (failureCount >= 3) return 'High';
  const excursion = ['Excursion', 'Action', 'Alert'].includes(record.status);
  if (!excursion) return 'Low';

  if (isMicrobialMonitoring(record.monitoringType, record.parameterName) && record.status === 'Excursion') {
    return 'Critical';
  }
  if (record.cleanroomGrade === 'Grade A' && record.status === 'Excursion') return 'Critical';
  if (record.cleanroomGrade === 'Grade B' && record.status === 'Excursion') return 'High';
  if (record.processStage === 'Filling' && ['Grade A', 'Grade B'].includes(record.cleanroomGrade) && record.status === 'Excursion') {
    return 'Critical';
  }
  if (record.status === 'Excursion') return 'High';
  if (record.status === 'Action') return 'Medium';
  return 'Low';
}

export function summarizeEnvironmentalRecords(records: EnvironmentalMonitoringRecord[]): EnvironmentalSummary {
  const isExcursion = (s: string) => s === 'Excursion';
  return {
    total: records.length,
    compliant: records.filter((r) => r.status === 'Complies').length,
    alert: records.filter((r) => r.status === 'Alert').length,
    action: records.filter((r) => r.status === 'Action').length,
    excursion: records.filter((r) => isExcursion(r.status)).length,
    gradeAExcursions: records.filter((r) => r.cleanroomGrade === 'Grade A' && isExcursion(r.status)).length,
    gradeBExcursions: records.filter((r) => r.cleanroomGrade === 'Grade B' && isExcursion(r.status)).length,
    microbialExcursions: records.filter((r) => isMicrobialMonitoring(r.monitoringType, r.parameterName) && isExcursion(r.status)).length,
    deviationTriggered: records.filter((r) => r.deviationRequired || r.linkedDeviationNumber).length,
    capaSuggested: records.filter((r) => r.capaRequired).length,
  };
}

export function parametersForMonitoringType(monitoringType: string): readonly string[] {
  const map: Record<string, string[]> = {
    Temperature: ['Room Temperature'],
    'Relative Humidity': ['Relative Humidity'],
    'Differential Pressure': ['Differential Pressure'],
    'Non-Viable Particle Count': ['Particles >=0.5µm', 'Particles >=5.0µm'],
    'Viable Particle Count': ['Viable Count'],
    'Settle Plate': ['Settle Plate Count'],
    'Active Air Sampling': ['Active Air Count'],
    'Surface Monitoring': ['Surface Count'],
    'Personnel Monitoring': ['Personnel Count'],
    'Contact Plate': ['Surface Count'],
  };
  return map[monitoringType] || DEFAULT_EM_PARAMETERS.slice();
}

export function buildEnvironmentalChartSeries(records: EnvironmentalMonitoringRecord[]) {
  const byMonth = new Map<string, { ok: number; total: number }>();
  records.forEach((r) => {
    const key = (r.monitoringDate || r.createdAt || '').slice(0, 7) || 'unknown';
    const e = byMonth.get(key) || { ok: 0, total: 0 };
    e.total += 1;
    if (r.status === 'Complies') e.ok += 1;
    byMonth.set(key, e);
  });
  const complianceTrend = Array.from(byMonth.entries())
    .map(([month, v]) => ({ month, rate: v.total ? Math.round((v.ok / v.total) * 100) : 0 }))
    .sort((a, b) => a.month.localeCompare(b.month));

  const areaMap = new Map<string, number>();
  records.filter((r) => r.status === 'Excursion').forEach((r) => {
    areaMap.set(r.areaName, (areaMap.get(r.areaName) || 0) + 1);
  });
  const areaExcursionTrend = Array.from(areaMap.entries())
    .map(([area, count]) => ({ area, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const gradeMap = new Map<string, number>();
  records.filter((r) => r.status === 'Excursion').forEach((r) => {
    gradeMap.set(r.cleanroomGrade, (gradeMap.get(r.cleanroomGrade) || 0) + 1);
  });
  const gradeRiskTrend = Array.from(gradeMap.entries()).map(([grade, count]) => ({ grade, count }));

  const riskMap = new Map<string, number>();
  records.forEach((r) => riskMap.set(r.riskLevel || 'Low', (riskMap.get(r.riskLevel || 'Low') || 0) + 1));
  const riskDistribution = Array.from(riskMap.entries()).map(([level, count]) => ({ level, count }));

  function paramSeries(match: string) {
    return records
      .filter((r) => r.parameterName.toLowerCase().includes(match.toLowerCase()))
      .sort((a, b) => `${a.monitoringDate}${a.monitoringTime}`.localeCompare(`${b.monitoringDate}${b.monitoringTime}`))
      .map((r) => ({
        label: r.batchNumber,
        observed: Number(r.observedValue),
        target: r.targetValue,
        lsl: r.lowerLimit,
        usl: r.upperLimit,
        date: r.monitoringDate,
      }));
  }

  const microbialSeries = records
    .filter((r) => isMicrobialMonitoring(r.monitoringType, r.parameterName))
    .sort((a, b) => `${a.monitoringDate}`.localeCompare(`${b.monitoringDate}`))
    .map((r) => ({
      label: r.monitoringDate,
      observed: Number(r.observedValue),
      parameter: r.parameterName,
    }));

  return {
    complianceTrend,
    areaExcursionTrend,
    gradeRiskTrend,
    riskDistribution,
    temperatureTrend: paramSeries('temperature'),
    rhTrend: paramSeries('humidity'),
    differentialPressureTrend: paramSeries('differential pressure'),
    particleTrend: paramSeries('particle'),
    microbialTrend: microbialSeries,
  };
}
