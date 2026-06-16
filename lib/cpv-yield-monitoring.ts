import { z } from 'zod';

export const YIELD_MONITORING_COLLECTION = 'yield_monitoring';
export const YIELD_LEGACY_COLLECTIONS = ['cpv_yield_monitoring', 'cpv_yield'] as const;
export const YIELD_MODULE_NAME = 'Yield Monitoring';

export const YIELD_STAGES = [
  'Bulk Yield',
  'Filling Yield',
  'Packing Yield',
  'Overall Yield',
] as const;

export const YIELD_STATUSES = ['Complies', 'Low Yield', 'High Yield', 'Alert', 'Action'] as const;
export const YIELD_REVIEW_STATUSES = ['Draft', 'Under Review', 'Approved'] as const;

export const DEFAULT_YIELD_LIMITS: Record<string, { lowerLimit: number; upperLimit: number; targetYield: number }> = {
  'Bulk Yield': { lowerLimit: 96, upperLimit: 100, targetYield: 98 },
  'Filling Yield': { lowerLimit: 90, upperLimit: 100, targetYield: 95 },
  'Packing Yield': { lowerLimit: 94, upperLimit: 100, targetYield: 96 },
  'Overall Yield': { lowerLimit: 90, upperLimit: 100, targetYield: 95 },
};

const requiredText = z.string().trim().min(1, 'Required');

export const yieldMonitoringFormSchema = z.object({
  cpvProductId: requiredText,
  productName: requiredText,
  productCode: requiredText,
  batchNumber: requiredText,
  manufacturingDate: requiredText,
  batchSize: z.string().trim().default(''),
  batchSizeUnit: z.string().trim().default(''),
  yieldStage: z.enum(YIELD_STAGES),
  theoreticalQuantity: z.coerce.number().positive('Theoretical quantity must be greater than 0'),
  actualQuantity: z.coerce.number().min(0, 'Actual quantity cannot be negative'),
  rejectQuantity: z.coerce.number().min(0).default(0),
  reworkQuantity: z.coerce.number().min(0).default(0),
  lowerLimit: z.coerce.number(),
  upperLimit: z.coerce.number(),
  targetYield: z.coerce.number(),
  unit: z.string().trim().default('units'),
  alertLimitLow: z.coerce.number().optional(),
  alertLimitHigh: z.coerce.number().optional(),
  actionLimitLow: z.coerce.number().optional(),
  actionLimitHigh: z.coerce.number().optional(),
  recordedBy: requiredText,
  reviewedBy: z.string().trim().default(''),
  reviewDate: z.string().trim().default(''),
  remarks: z.string().trim().default(''),
  autoDeviationRequired: z.boolean().default(true),
}).refine((d) => d.lowerLimit < d.upperLimit, {
  message: 'Upper limit must be greater than lower limit',
  path: ['upperLimit'],
});

export type YieldMonitoringFormData = z.infer<typeof yieldMonitoringFormSchema>;

export interface YieldMonitoringRecord extends YieldMonitoringFormData, Record<string, unknown> {
  id: string;
  yieldMonitoringId: string;
  lossQuantity: number;
  yieldPercentage: number;
  variancePercentage: number;
  status: typeof YIELD_STATUSES[number] | string;
  riskLevel: string;
  deviationRequired: boolean;
  linkedDeviationNumber: string;
  capaRequired: boolean;
  linkedCapaNumber: string;
  reviewStatus: typeof YIELD_REVIEW_STATUSES[number];
  isLocked: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
  createdByName?: string;
  updatedByName?: string;
  isDeleted: boolean;
}

export interface YieldSummary {
  total: number;
  compliant: number;
  lowYield: number;
  highYield: number;
  avgBulkYield: number;
  avgFillingYield: number;
  avgPackingYield: number;
  avgOverallYield: number;
  deviationTriggered: number;
  capaSuggested: number;
}

export function buildYieldMonitoringId(batchNumber: string, yieldStage: string): string {
  return `YLD-${batchNumber}-${yieldStage}`.replace(/\s+/g, '-').toUpperCase();
}

export function calculateLossQuantity(theoretical: number, actual: number): number {
  if (!Number.isFinite(theoretical) || !Number.isFinite(actual)) return 0;
  return Math.max(0, theoretical - actual);
}

export function calculateYieldPercentage(theoretical: number, actual: number): number {
  if (!Number.isFinite(theoretical) || theoretical <= 0) return 0;
  if (!Number.isFinite(actual)) return 0;
  return Math.round((actual / theoretical) * 10000) / 100;
}

export function calculateVariancePercentage(targetYield: number, yieldPercentage: number): number {
  return Math.round((targetYield - yieldPercentage) * 100) / 100;
}

export function evaluateYieldStatus(
  yieldPct: number,
  lowerLimit: number,
  upperLimit: number,
  alertLow?: number,
  alertHigh?: number,
  actionLow?: number,
  actionHigh?: number,
): string {
  if (!Number.isFinite(yieldPct)) return 'Low Yield';
  if (yieldPct < lowerLimit) return 'Low Yield';
  if (yieldPct > upperLimit) return 'High Yield';
  if (actionLow != null && !Number.isNaN(actionLow) && yieldPct < actionLow) return 'Action';
  if (actionHigh != null && !Number.isNaN(actionHigh) && yieldPct > actionHigh) return 'Action';
  if (alertLow != null && !Number.isNaN(alertLow) && yieldPct < alertLow) return 'Alert';
  if (alertHigh != null && !Number.isNaN(alertHigh) && yieldPct > alertHigh) return 'Alert';
  return 'Complies';
}

export function evaluateYieldRisk(
  record: Pick<YieldMonitoringRecord, 'yieldStage' | 'yieldPercentage' | 'variancePercentage' | 'status' | 'targetYield'>,
  lowYieldBatchCount: number,
): string {
  if (lowYieldBatchCount >= 3) return 'Critical';
  const variance = Math.abs(record.variancePercentage);
  if (variance > 5) return 'High';
  if (record.yieldStage === 'Packing Yield' && record.yieldPercentage < 94) {
    const diff = 94 - record.yieldPercentage;
    return diff > 3 ? 'High' : 'Medium';
  }
  const criticalStages = ['Bulk Yield', 'Filling Yield'];
  if (criticalStages.includes(record.yieldStage) && record.status === 'Low Yield') return 'High';
  if (['Low Yield', 'High Yield', 'Action'].includes(record.status)) return 'Medium';
  if (record.status === 'Alert') return 'Low';
  return 'Low';
}

export function summarizeYieldRecords(records: YieldMonitoringRecord[]): YieldSummary {
  const avg = (stage: string) => {
    const rows = records.filter((r) => r.yieldStage === stage);
    if (!rows.length) return 0;
    return Math.round(rows.reduce((s, r) => s + r.yieldPercentage, 0) / rows.length * 100) / 100;
  };
  return {
    total: records.length,
    compliant: records.filter((r) => r.status === 'Complies').length,
    lowYield: records.filter((r) => r.status === 'Low Yield').length,
    highYield: records.filter((r) => r.status === 'High Yield').length,
    avgBulkYield: avg('Bulk Yield'),
    avgFillingYield: avg('Filling Yield'),
    avgPackingYield: avg('Packing Yield'),
    avgOverallYield: avg('Overall Yield'),
    deviationTriggered: records.filter((r) => r.deviationRequired || r.linkedDeviationNumber).length,
    capaSuggested: records.filter((r) => r.capaRequired).length,
  };
}

export function buildYieldChartSeries(records: YieldMonitoringRecord[]) {
  const stageTrend = (stage: string) =>
    records
      .filter((r) => r.yieldStage === stage)
      .sort((a, b) => (a.manufacturingDate || a.createdAt).localeCompare(b.manufacturingDate || b.createdAt))
      .map((r) => ({
        label: r.batchNumber,
        yield: r.yieldPercentage,
        target: r.targetYield,
        lower: r.lowerLimit,
        upper: r.upperLimit,
      }));

  const batchMap = new Map<string, { batch: string; yield: number; stage: string }[]>();
  records.forEach((r) => {
    const list = batchMap.get(r.batchNumber) || [];
    list.push({ batch: r.batchNumber, yield: r.yieldPercentage, stage: r.yieldStage });
    batchMap.set(r.batchNumber, list);
  });
  const batchComparison = Array.from(batchMap.entries()).map(([batch, stages]) => {
    const overall = stages.find((s) => s.stage === 'Overall Yield');
    const bulk = stages.find((s) => s.stage === 'Bulk Yield');
    return {
      batch,
      overall: overall?.yield ?? bulk?.yield ?? 0,
    };
  }).slice(0, 15);

  const varianceByMonth = new Map<string, number>();
  records.forEach((r) => {
    const key = (r.manufacturingDate || r.createdAt || '').slice(0, 7) || 'unknown';
    const entries = varianceByMonth.get(key);
    const v = Math.abs(r.variancePercentage);
    if (!entries) varianceByMonth.set(key, v);
    else varianceByMonth.set(key, (entries + v) / 2);
  });
  const varianceTrend = Array.from(varianceByMonth.entries())
    .map(([month, variance]) => ({ month, variance: Math.round(variance * 100) / 100 }))
    .sort((a, b) => a.month.localeCompare(b.month));

  const riskMap = new Map<string, number>();
  records.forEach((r) => riskMap.set(r.riskLevel || 'Low', (riskMap.get(r.riskLevel || 'Low') || 0) + 1));
  const riskDistribution = Array.from(riskMap.entries()).map(([level, count]) => ({ level, count }));

  return {
    bulkYieldTrend: stageTrend('Bulk Yield'),
    fillingYieldTrend: stageTrend('Filling Yield'),
    packingYieldTrend: stageTrend('Packing Yield'),
    overallYieldTrend: stageTrend('Overall Yield'),
    batchComparison,
    varianceTrend,
    riskDistribution,
  };
}

export function defaultLimitsForStage(stage: string) {
  return DEFAULT_YIELD_LIMITS[stage] || DEFAULT_YIELD_LIMITS['Overall Yield'];
}
