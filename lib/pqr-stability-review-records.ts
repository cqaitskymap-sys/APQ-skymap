import { z } from 'zod';
import {
  DEFAULT_STABILITY_LIMITS,
  DEFAULT_STABILITY_PARAMETERS,
  STABILITY_PULLING_INTERVALS,
  STABILITY_STORAGE_CONDITIONS,
  STABILITY_STUDY_TYPES,
  evaluateStabilityRisk,
  evaluateStabilityStatus,
  intervalToMonths,
} from '@/lib/cpv-stability-monitoring';

export const PQR_STABILITY_REVIEW_MODULE = 'PQR Stability Review';

export const PQR_STABILITY_REVIEW_COLLECTIONS = {
  review: 'pqr_stability_review',
  sections: 'pqr_sections',
  records: 'pqr_records',
  stabilityMonitoring: 'stability_monitoring',
  stabilityStudies: 'stability_studies',
  stabilitySchedules: 'stability_schedules',
  stabilityResults: 'stability_results',
  oosRecords: 'oos_records',
  deviations: 'deviations',
  capaRecords: 'capa_records',
} as const;

export const PQR_STABILITY_RESULT_STATUSES = [
  'Complies', 'OOT', 'OOS', 'Action', 'Under Review',
] as const;

export const PQR_STABILITY_COMPLIANCE_STATUSES = [
  'Complies', 'Observation', 'Critical Observation',
] as const;

export const PQR_RISK_LEVELS = ['Low', 'Medium', 'High', 'Critical'] as const;

export type PqrStabilityResultStatus = (typeof PQR_STABILITY_RESULT_STATUSES)[number];
export type PqrStabilityComplianceStatus = (typeof PQR_STABILITY_COMPLIANCE_STATUSES)[number];

export interface PqrStabilityReviewRecord {
  id?: string;
  stabilityReviewId: string;
  pqrId: string;
  pqrNumber: string;
  product: string;
  productCode: string;
  batchNumber: string;
  studyNumber: string;
  studyType: string;
  storageCondition: string;
  pullingInterval: string;
  samplePullingDueDate: string;
  actualPullingDate: string;
  testDate: string;
  studyStartDate: string;
  parameterName: string;
  observedResult: string | number;
  lowerLimit: number;
  upperLimit: number;
  unit: string;
  resultStatus: string;
  samplePullStatus: string;
  ootCount: number;
  oosCount: number;
  capaCount: number;
  complianceStatus: PqrStabilityComplianceStatus | string;
  complianceReasons: string[];
  riskLevel: string;
  impactOnShelfLife: string;
  impactOnProductQuality: string;
  conclusion: string;
  remarks: string;
  sourceType?: 'manual' | 'pull';
  sourceIds?: string[];
  attachmentUrls?: string[];
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
  createdByName?: string;
  updatedByName?: string;
  isDeleted: boolean;
}

export interface PqrStabilityReviewSummary {
  totalStabilityStudies: number;
  totalStabilityBatches: number;
  longTermStudies: number;
  acceleratedStudies: number;
  intermediateStudies: number;
  samplesDue: number;
  samplesPulled: number;
  samplesMissed: number;
  compliantResults: number;
  ootResults: number;
  oosResults: number;
  capaLinked: number;
  highRiskStudies: number;
  criticalRiskStudies: number;
}

export interface PqrStabilityReviewCharts {
  assayTrend: Array<{ label: string; observed: number; lsl?: number; usl?: number }>;
  phTrend: Array<{ label: string; observed: number; lsl?: number; usl?: number }>;
  relatedSubstanceTrend: Array<{ label: string; observed: number; lsl?: number; usl?: number }>;
  preservativeTrend: Array<{ label: string; observed: number; lsl?: number; usl?: number }>;
  ootOosTrend: Array<{ month: string; oot: number; oos: number }>;
  storageConditionCompliance: Array<{ condition: string; rate: number }>;
  intervalCompliance: Array<{ interval: string; rate: number }>;
  riskDistribution: Array<{ level: string; count: number }>;
  samplePullingCompliance: Array<{ label: string; pulled: number; missed: number; due: number }>;
}

const numericParams = new Set(
  Object.entries(DEFAULT_STABILITY_LIMITS)
    .filter(([, v]) => v.resultType === 'Numeric')
    .map(([k]) => k),
);

export const stabilityReviewFormSchema = z.object({
  pqrId: z.string().min(1, 'PQR selection is required'),
  product: z.string().min(1, 'Product is required'),
  productCode: z.string().min(1, 'Product code is required'),
  batchNumber: z.string().min(1, 'Batch Number is required'),
  studyNumber: z.string().default(''),
  studyType: z.enum(STABILITY_STUDY_TYPES),
  storageCondition: z.enum(STABILITY_STORAGE_CONDITIONS),
  pullingInterval: z.enum(STABILITY_PULLING_INTERVALS),
  samplePullingDueDate: z.string().default(''),
  actualPullingDate: z.string().default(''),
  testDate: z.string().min(1, 'Test Date is required'),
  studyStartDate: z.string().default(''),
  parameterName: z.string().min(1, 'Parameter is required'),
  observedResult: z.union([z.coerce.number(), z.string().trim().min(1, 'Observed Result is required')]),
  lowerLimit: z.coerce.number(),
  upperLimit: z.coerce.number(),
  unit: z.string().default(''),
  resultStatus: z.enum(PQR_STABILITY_RESULT_STATUSES).default('Complies'),
  samplePullStatus: z.string().default('Pending'),
  ootCount: z.coerce.number().nonnegative().default(0),
  oosCount: z.coerce.number().nonnegative().default(0),
  capaCount: z.coerce.number().nonnegative().default(0),
  impactOnShelfLife: z.string().default('No'),
  impactOnProductQuality: z.string().default('No'),
  conclusion: z.string().default(''),
  remarks: z.string().default(''),
}).refine((d) => d.upperLimit > d.lowerLimit, {
  message: 'Upper Limit must be greater than Lower Limit', path: ['upperLimit'],
}).refine((d) => {
  if (!d.actualPullingDate || !d.studyStartDate) return true;
  return d.actualPullingDate >= d.studyStartDate;
}, { message: 'Actual Pulling Date cannot be before Study Start Date', path: ['actualPullingDate'] })
  .superRefine((d, ctx) => {
    if (numericParams.has(d.parameterName) && typeof d.observedResult === 'string') {
      const n = Number(d.observedResult);
      if (!Number.isFinite(n)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Observed Result must be numeric for this parameter',
          path: ['observedResult'],
        });
      }
    }
  });

export type StabilityReviewFormData = z.infer<typeof stabilityReviewFormSchema>;

export function autoResultStatus(
  observed: string | number,
  lower: number,
  upper: number,
  parameterName: string,
): PqrStabilityResultStatus {
  const lim = DEFAULT_STABILITY_LIMITS[parameterName];
  const resultType = lim?.resultType || 'Numeric';
  const status = evaluateStabilityStatus(
    observed,
    lower,
    upper,
    resultType,
    lim?.alertLow,
    lim?.alertHigh,
    lim?.actionLow,
    lim?.actionHigh,
  );
  if (status === 'Action') return 'Action';
  if (status === 'OOT') return 'OOT';
  if (status === 'OOS') return 'OOS';
  return 'Complies';
}

export function computeStabilityCompliance(record: Partial<PqrStabilityReviewRecord>): {
  complianceStatus: PqrStabilityComplianceStatus;
  complianceReasons: string[];
  riskLevel: string;
} {
  const reasons: string[] = [];
  const param = (record.parameterName || '').toLowerCase();
  const status = record.resultStatus || 'Complies';
  const oot = record.ootCount ?? 0;
  const oos = record.oosCount ?? 0;
  const capa = record.capaCount ?? 0;
  const pullStatus = (record.samplePullStatus || '').toLowerCase();
  const shelfImpact = (record.impactOnShelfLife || '').toLowerCase() === 'yes';
  const qualityImpact = (record.impactOnProductQuality || '').toLowerCase() === 'yes';

  if (status === 'OOS' || oos > 0) reasons.push('OOS observed');
  if (status === 'OOT' || oot > 0) reasons.push('OOT observed');
  if (pullStatus === 'missed') reasons.push('Sample pulling missed');
  if (pullStatus === 'missed' && record.remarks) reasons.push('Missed pull justified in remarks');
  if (capa > 0) reasons.push('CAPA linked');
  if (param.includes('sterility') && (status === 'OOS' || oos > 0)) reasons.push('Sterility failure');
  if (param.includes('endotoxin') && (status === 'OOS' || oos > 0)) reasons.push('Endotoxin failure');
  if (param.includes('assay') && (status === 'OOS' || oos > 0)) reasons.push('Assay failure');
  if (qualityImpact) reasons.push('Product quality impact identified');
  if (shelfImpact) reasons.push('Shelf life impact identified');

  let complianceStatus: PqrStabilityComplianceStatus = 'Complies';
  if (
    status === 'OOS' || oos > 0 || qualityImpact
    || param.includes('sterility') && (status === 'OOS' || oos > 0)
    || param.includes('endotoxin') && (status === 'OOS' || oos > 0)
    || param.includes('assay') && (status === 'OOS' || oos > 0)
  ) {
    complianceStatus = 'Critical Observation';
  } else if (
    (pullStatus === 'missed' && record.remarks)
    || status === 'OOT' || oot > 0
    || pullStatus === 'missed'
  ) {
    complianceStatus = 'Observation';
  } else if (status === 'Complies' && oot === 0 && oos === 0 && pullStatus !== 'missed') {
    complianceStatus = 'Complies';
  }

  const riskLevel = computeStabilityRisk(record, complianceStatus);
  return { complianceStatus, complianceReasons: reasons, riskLevel };
}

function computeStabilityRisk(
  record: Partial<PqrStabilityReviewRecord>,
  compliance: PqrStabilityComplianceStatus,
): string {
  const param = (record.parameterName || '').toLowerCase();
  const status = record.resultStatus || 'Complies';
  const oot = record.ootCount ?? 0;
  const oos = record.oosCount ?? 0;
  const shelfImpact = (record.impactOnShelfLife || '').toLowerCase() === 'yes';

  if (shelfImpact) return 'Critical';
  if (status === 'OOS' || oos > 0) return 'Critical';
  if (param.includes('sterility') && (status === 'OOS' || oos > 0)) return 'Critical';
  if (param.includes('endotoxin') && (status === 'OOS' || oos > 0)) return 'Critical';
  if (oot >= 2 || (record.ootCount ?? 0) >= 2) return 'High';
  if (status === 'OOT' || oot > 0) return 'Medium';
  if (compliance === 'Critical Observation') return 'Critical';
  if (compliance === 'Observation') return 'Medium';

  const riskFromEval = evaluateStabilityRisk(
    { status: status === 'Action' ? 'Action' : status, parameterName: record.parameterName || '', observedResult: record.observedResult ?? '' },
    oot,
  );
  return riskFromEval || 'Low';
}

export function computeStabilityReviewSummary(records: PqrStabilityReviewRecord[]): PqrStabilityReviewSummary {
  const active = records.filter((r) => !r.isDeleted);
  const studySet = new Set(active.map((r) => r.studyNumber || `${r.batchNumber}-${r.studyType}`).filter(Boolean));
  const batchSet = new Set(active.map((r) => r.batchNumber).filter(Boolean));

  return {
    totalStabilityStudies: studySet.size,
    totalStabilityBatches: batchSet.size,
    longTermStudies: active.filter((r) => r.studyType === 'Long Term').length,
    acceleratedStudies: active.filter((r) => r.studyType === 'Accelerated').length,
    intermediateStudies: active.filter((r) => r.studyType === 'Intermediate').length,
    samplesDue: active.filter((r) => {
      const ps = (r.samplePullStatus || '').toLowerCase();
      return ps === 'pending' || ps === 'due soon' || (r.samplePullingDueDate && !r.actualPullingDate);
    }).length,
    samplesPulled: active.filter((r) => Boolean(r.actualPullingDate)).length,
    samplesMissed: active.filter((r) => (r.samplePullStatus || '').toLowerCase() === 'missed').length,
    compliantResults: active.filter((r) => r.resultStatus === 'Complies').length,
    ootResults: active.filter((r) => r.resultStatus === 'OOT' || r.ootCount > 0).length,
    oosResults: active.filter((r) => r.resultStatus === 'OOS' || r.oosCount > 0).length,
    capaLinked: active.reduce((s, r) => s + (r.capaCount || 0), 0),
    highRiskStudies: active.filter((r) => r.riskLevel === 'High').length,
    criticalRiskStudies: active.filter((r) => r.riskLevel === 'Critical').length,
  };
}

export function generateStabilityNarrative(
  summary: PqrStabilityReviewSummary,
  records: PqrStabilityReviewRecord[],
): string {
  if (records.length === 0) {
    return 'No stability study data was reviewed for the selected PQR period.';
  }
  const parts: string[] = [];
  const allComply = records.every((r) => r.resultStatus === 'Complies' && r.complianceStatus === 'Complies');
  if (allComply) {
    parts.push('Stability data reviewed during the period indicates that the product remains within approved specification.');
  }
  if (summary.oosResults === 0 && summary.ootResults === 0) {
    parts.push('No OOT/OOS was observed in stability studies during the review period.');
  } else if (summary.ootResults > 0 && summary.oosResults === 0) {
    parts.push('OOT trend was observed in stability data and evaluated for potential impact on product quality.');
  }
  if (summary.oosResults > 0) {
    parts.push('OOS was observed in stability study and investigated as per approved procedure.');
  }
  const shelfImpact = records.some((r) => (r.impactOnShelfLife || '').toLowerCase() === 'yes');
  if (!shelfImpact) {
    parts.push('No adverse impact on approved shelf life was identified based on reviewed stability data.');
  }
  parts.push(
    `Reviewed ${summary.totalStabilityStudies} stability studies across ${summary.totalStabilityBatches} batch(es) with ${summary.compliantResults} compliant result(s).`,
  );
  return parts.join(' ');
}

function trendFromRecords(
  records: PqrStabilityReviewRecord[],
  parameterName: string,
) {
  return records
    .filter((r) => r.parameterName === parameterName && Number.isFinite(Number(r.observedResult)))
    .sort((a, b) => intervalToMonths(a.pullingInterval) - intervalToMonths(b.pullingInterval))
    .map((r) => ({
      label: r.pullingInterval,
      observed: Number(r.observedResult),
      lsl: r.lowerLimit,
      usl: r.upperLimit,
    }));
}

export function buildStabilityReviewCharts(records: PqrStabilityReviewRecord[]): PqrStabilityReviewCharts {
  const active = records.filter((r) => !r.isDeleted);

  const byMonth = new Map<string, { oot: number; oos: number }>();
  active.forEach((r) => {
    const key = (r.testDate || r.createdAt || '').slice(0, 7);
    if (!key) return;
    const e = byMonth.get(key) || { oot: 0, oos: 0 };
    if (r.resultStatus === 'OOT' || r.ootCount > 0) e.oot += 1;
    if (r.resultStatus === 'OOS' || r.oosCount > 0) e.oos += 1;
    byMonth.set(key, e);
  });

  const condMap = new Map<string, { ok: number; total: number }>();
  active.forEach((r) => {
    const e = condMap.get(r.storageCondition) || { ok: 0, total: 0 };
    e.total += 1;
    if (r.resultStatus === 'Complies') e.ok += 1;
    condMap.set(r.storageCondition, e);
  });

  const intervalMap = new Map<string, { ok: number; total: number }>();
  active.forEach((r) => {
    const e = intervalMap.get(r.pullingInterval) || { ok: 0, total: 0 };
    e.total += 1;
    if (r.resultStatus === 'Complies') e.ok += 1;
    intervalMap.set(r.pullingInterval, e);
  });

  const riskMap = new Map<string, number>();
  active.forEach((r) => riskMap.set(r.riskLevel || 'Low', (riskMap.get(r.riskLevel || 'Low') || 0) + 1));

  const pullMap = new Map<string, { pulled: number; missed: number; due: number }>();
  active.forEach((r) => {
    const key = r.studyType || 'Study';
    const e = pullMap.get(key) || { pulled: 0, missed: 0, due: 0 };
    const ps = (r.samplePullStatus || '').toLowerCase();
    if (r.actualPullingDate) e.pulled += 1;
    else if (ps === 'missed') e.missed += 1;
    else e.due += 1;
    pullMap.set(key, e);
  });

  return {
    assayTrend: trendFromRecords(active, 'Assay'),
    phTrend: trendFromRecords(active, 'pH'),
    relatedSubstanceTrend: trendFromRecords(active, 'Related Substances'),
    preservativeTrend: trendFromRecords(active, 'Preservative Content'),
    ootOosTrend: Array.from(byMonth.entries())
      .map(([month, v]) => ({ month, ...v }))
      .sort((a, b) => a.month.localeCompare(b.month)),
    storageConditionCompliance: Array.from(condMap.entries()).map(([condition, v]) => ({
      condition,
      rate: v.total ? Math.round((v.ok / v.total) * 100) : 0,
    })),
    intervalCompliance: Array.from(intervalMap.entries())
      .map(([interval, v]) => ({
        interval,
        rate: v.total ? Math.round((v.ok / v.total) * 100) : 0,
      }))
      .sort((a, b) => intervalToMonths(a.interval) - intervalToMonths(b.interval)),
    riskDistribution: Array.from(riskMap.entries()).map(([level, count]) => ({ level, count })),
    samplePullingCompliance: Array.from(pullMap.entries()).map(([label, v]) => ({ label, ...v })),
  };
}

export function canViewStabilityReview(role?: string): boolean {
  return [
    'super_admin', 'admin', 'qa', 'head_qa', 'qa_manager', 'qa_executive',
    'qc', 'qc_manager', 'qc_executive', 'warehouse', 'warehouse_manager',
    'production', 'production_manager', 'production_executive',
    'auditor', 'viewer',
  ].includes(role || '');
}

export function canManageStabilityReview(role?: string): boolean {
  return ['super_admin', 'admin'].includes(role || '');
}

export function canPullStabilityReview(role?: string): boolean {
  return ['super_admin', 'admin', 'qa', 'head_qa', 'qa_manager', 'qa_executive'].includes(role || '');
}

export function canUpdateStabilityTestData(role?: string): boolean {
  return ['super_admin', 'admin', 'qc', 'qc_manager', 'qc_executive'].includes(role || '');
}

export function canUpdateSamplePulling(role?: string): boolean {
  return ['super_admin', 'admin', 'warehouse', 'warehouse_manager'].includes(role || '');
}

export function canExportStabilityReview(role?: string): boolean {
  return ['super_admin', 'admin', 'qa', 'head_qa', 'qa_manager', 'auditor'].includes(role || '');
}

export function resultStatusColor(status: string): string {
  if (status === 'Complies') return 'bg-green-50 text-green-700 border-green-200';
  if (status === 'OOT' || status === 'Action') return 'bg-amber-50 text-amber-800 border-amber-200';
  if (status === 'OOS') return 'bg-red-50 text-red-700 border-red-200';
  if (status === 'Under Review') return 'bg-blue-50 text-blue-700 border-blue-200';
  return 'bg-slate-50 text-slate-600 border-slate-200';
}

export function complianceStatusColor(status: string): string {
  if (status === 'Complies') return 'bg-green-50 text-green-700 border-green-200';
  if (status === 'Observation') return 'bg-amber-50 text-amber-800 border-amber-200';
  return 'bg-red-50 text-red-700 border-red-200';
}

export function riskLevelColor(level: string): string {
  if (level === 'Critical') return 'bg-red-900/10 text-red-900 border-red-300';
  if (level === 'High') return 'bg-red-50 text-red-700 border-red-200';
  if (level === 'Medium') return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-green-50 text-green-700 border-green-200';
}

export function storageConditionBadgeColor(): string {
  return 'bg-blue-50 text-blue-800 border-blue-200';
}

export function intervalBadgeColor(): string {
  return 'bg-slate-50 text-slate-700 border-slate-200';
}

export { DEFAULT_STABILITY_PARAMETERS, STABILITY_PULLING_INTERVALS, STABILITY_STORAGE_CONDITIONS, STABILITY_STUDY_TYPES };
