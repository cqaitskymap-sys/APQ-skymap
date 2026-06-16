import { z } from 'zod';

export const HOLD_TIME_MONITORING_COLLECTION = 'hold_time_monitoring';
export const HOLD_TIME_MASTER_COLLECTION = 'hold_time_master';
export const HOLD_TIME_LEGACY_COLLECTIONS = ['cpv_hold_time'] as const;
export const HOLD_TIME_MODULE_NAME = 'Hold Time Monitoring';

export const HOLD_STAGES = [
  'Dispensing to Mixing',
  'Mixing to Filtration',
  'Filtration to Sterilization',
  'Sterilization to Filling',
  'Filling to Inspection',
  'Inspection to Packing',
  'Bulk Hold Time',
  'Sterile Bulk Hold Time',
  'Intermediate Hold Time',
  'Finished Product Hold Time',
  'Warehouse Hold Time',
] as const;

export const BULK_HOLD_STAGES = [
  'Dispensing',
  'Mixing',
  'Filtration',
  'Sterilization',
  'Filling',
  'Inspection',
  'Packing',
] as const;

export const HOLD_TIME_UNITS = ['Minutes', 'Hours', 'Days'] as const;
export const HOLD_TIME_STATUSES = ['Complies', 'Alert', 'Action', 'Exceeded'] as const;
export const HOLD_REVIEW_STATUSES = ['Draft', 'Under Review', 'Approved'] as const;

export const DEFAULT_ALLOWED_HOLD_TIMES: Record<string, { allowed: number; unit: typeof HOLD_TIME_UNITS[number] }> = {
  'Dispensing to Mixing': { allowed: 4, unit: 'Hours' },
  'Mixing to Filtration': { allowed: 2, unit: 'Hours' },
  'Filtration to Sterilization': { allowed: 8, unit: 'Hours' },
  'Sterilization to Filling': { allowed: 12, unit: 'Hours' },
  'Filling to Inspection': { allowed: 6, unit: 'Hours' },
  'Inspection to Packing': { allowed: 4, unit: 'Hours' },
  'Bulk Hold Time': { allowed: 24, unit: 'Hours' },
  'Sterile Bulk Hold Time': { allowed: 24, unit: 'Hours' },
  'Intermediate Hold Time': { allowed: 48, unit: 'Hours' },
  'Finished Product Hold Time': { allowed: 72, unit: 'Hours' },
  'Warehouse Hold Time': { allowed: 30, unit: 'Days' },
  Dispensing: { allowed: 4, unit: 'Hours' },
  Mixing: { allowed: 2, unit: 'Hours' },
  Filtration: { allowed: 8, unit: 'Hours' },
  Sterilization: { allowed: 12, unit: 'Hours' },
  Filling: { allowed: 6, unit: 'Hours' },
  Inspection: { allowed: 4, unit: 'Hours' },
  Packing: { allowed: 4, unit: 'Hours' },
};

const requiredText = z.string().trim().min(1, 'Required');

export const holdTimeMonitoringFormSchema = z.object({
  cpvProductId: requiredText,
  productName: requiredText,
  productCode: requiredText,
  batchNumber: requiredText,
  manufacturingDate: requiredText,
  processStage: requiredText,
  holdStage: requiredText,
  startDateTime: requiredText,
  endDateTime: requiredText,
  allowedHoldTime: z.coerce.number().positive('Allowed hold time must be greater than 0'),
  holdTimeUnit: z.enum(HOLD_TIME_UNITS),
  reasonForHold: z.string().trim().default(''),
  extensionApproved: z.boolean().default(false),
  extensionReason: z.string().trim().default(''),
  approvedBy: z.string().trim().default(''),
  reviewDate: z.string().trim().default(''),
  remarks: z.string().trim().default(''),
  autoDeviationRequired: z.boolean().default(true),
}).refine((d) => {
  const start = new Date(d.startDateTime);
  const end = new Date(d.endDateTime);
  return !Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end > start;
}, { message: 'End date time must be after start date time', path: ['endDateTime'] });

export type HoldTimeMonitoringFormData = z.infer<typeof holdTimeMonitoringFormSchema>;

export interface HoldTimeMonitoringRecord extends HoldTimeMonitoringFormData, Record<string, unknown> {
  id: string;
  holdTimeId: string;
  actualHoldTime: number;
  difference: number;
  complianceStatus: typeof HOLD_TIME_STATUSES[number] | string;
  status: typeof HOLD_TIME_STATUSES[number] | string;
  riskLevel: string;
  deviationRequired: boolean;
  linkedDeviationNumber: string;
  capaRequired: boolean;
  linkedCapaNumber: string;
  reviewStatus: typeof HOLD_REVIEW_STATUSES[number];
  isLocked: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
  createdByName?: string;
  updatedByName?: string;
  isDeleted: boolean;
}

export interface HoldTimeSummary {
  total: number;
  compliant: number;
  alert: number;
  action: number;
  exceeded: number;
  highRisk: number;
  deviationTriggered: number;
  capaSuggested: number;
}

export function buildHoldTimeId(batchNumber: string, holdStage: string): string {
  return `HT-${batchNumber}-${holdStage}`.replace(/\s+/g, '-').toUpperCase();
}

export function unitToMinutes(unit: string): number {
  if (unit === 'Minutes') return 1;
  if (unit === 'Hours') return 60;
  if (unit === 'Days') return 1440;
  return 60;
}

export function minutesToUnit(minutes: number, unit: string): number {
  const factor = unitToMinutes(unit);
  return Math.round((minutes / factor) * 100) / 100;
}

export function calculateActualHoldTime(
  startDateTime: string,
  endDateTime: string,
  unit: string,
): number {
  const start = new Date(startDateTime);
  const end = new Date(endDateTime);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  const diffMinutes = (end.getTime() - start.getTime()) / (1000 * 60);
  if (diffMinutes <= 0) return 0;
  return minutesToUnit(diffMinutes, unit);
}

export function calculateHoldDifference(allowed: number, actual: number): number {
  return Math.round((allowed - actual) * 100) / 100;
}

export function evaluateHoldTimeStatus(actual: number, allowed: number): string {
  if (!Number.isFinite(actual) || !Number.isFinite(allowed) || allowed <= 0) return 'Exceeded';
  if (actual > allowed) return 'Exceeded';
  if (actual >= allowed * 0.95) return 'Action';
  if (actual >= allowed * 0.8) return 'Alert';
  return 'Complies';
}

export function evaluateHoldTimeRisk(
  record: Pick<HoldTimeMonitoringRecord, 'holdStage' | 'status' | 'complianceStatus'>,
  exceededCount: number,
): string {
  const status = record.complianceStatus || record.status;
  if (exceededCount >= 3) return 'Critical';
  if (status === 'Exceeded' && record.holdStage === 'Sterile Bulk Hold Time') return 'Critical';
  if (status === 'Exceeded') return 'High';
  if (status === 'Action') return 'Medium';
  if (status === 'Alert') return 'Low';
  return 'Low';
}

export function summarizeHoldTimeRecords(records: HoldTimeMonitoringRecord[]): HoldTimeSummary {
  return {
    total: records.length,
    compliant: records.filter((r) => r.status === 'Complies' || r.complianceStatus === 'Complies').length,
    alert: records.filter((r) => r.status === 'Alert').length,
    action: records.filter((r) => r.status === 'Action').length,
    exceeded: records.filter((r) => r.status === 'Exceeded').length,
    highRisk: records.filter((r) => r.riskLevel === 'High' || r.riskLevel === 'Critical').length,
    deviationTriggered: records.filter((r) => r.deviationRequired || r.linkedDeviationNumber).length,
    capaSuggested: records.filter((r) => r.capaRequired).length,
  };
}

export function buildHoldTimeChartSeries(records: HoldTimeMonitoringRecord[]) {
  const byMonth = new Map<string, { complies: number; total: number }>();
  records.forEach((r) => {
    const key = (r.startDateTime || r.createdAt).slice(0, 7);
    const e = byMonth.get(key) || { complies: 0, total: 0 };
    e.total += 1;
    if (r.status === 'Complies') e.complies += 1;
    byMonth.set(key, e);
  });
  const complianceTrend = Array.from(byMonth.entries())
    .map(([month, v]) => ({ month, rate: v.total ? Math.round((v.complies / v.total) * 100) : 0 }))
    .sort((a, b) => a.month.localeCompare(b.month));

  const stageMap = new Map<string, { actual: number; allowed: number; count: number }>();
  records.forEach((r) => {
    const e = stageMap.get(r.holdStage) || { actual: 0, allowed: 0, count: 0 };
    e.actual += r.actualHoldTime;
    e.allowed += r.allowedHoldTime;
    e.count += 1;
    stageMap.set(r.holdStage, e);
  });
  const stageTrend = Array.from(stageMap.entries()).map(([stage, v]) => ({
    stage,
    actual: v.count ? Math.round(v.actual / v.count * 100) / 100 : 0,
    allowed: v.count ? Math.round(v.allowed / v.count * 100) / 100 : 0,
  }));

  const exceededByMonth = new Map<string, number>();
  records.filter((r) => r.status === 'Exceeded').forEach((r) => {
    const key = (r.startDateTime || r.createdAt).slice(0, 7);
    exceededByMonth.set(key, (exceededByMonth.get(key) || 0) + 1);
  });
  const exceededTrend = Array.from(exceededByMonth.entries())
    .map(([month, count]) => ({ month, count }))
    .sort((a, b) => a.month.localeCompare(b.month));

  const riskMap = new Map<string, number>();
  records.forEach((r) => riskMap.set(r.riskLevel || 'Low', (riskMap.get(r.riskLevel || 'Low') || 0) + 1));
  const riskDistribution = Array.from(riskMap.entries()).map(([level, count]) => ({ level, count }));

  const monthlyAnalysis = complianceTrend.map((m) => ({
    month: m.month,
    compliance: m.rate,
    exceeded: exceededTrend.find((e) => e.month === m.month)?.count ?? 0,
  }));

  return { complianceTrend, stageTrend, exceededTrend, riskDistribution, monthlyAnalysis };
}

export function defaultAllowedForStage(stage: string) {
  return DEFAULT_ALLOWED_HOLD_TIMES[stage] || { allowed: 24, unit: 'Hours' as const };
}
