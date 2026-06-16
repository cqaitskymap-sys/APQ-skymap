import { z } from 'zod';
import type { PqrBatchReviewRecord } from '@/lib/pqr-batch-review-records';
import { computeBatchSummary } from '@/lib/pqr-batch-review-records';
import type { PqrMaterialReviewRecord } from '@/lib/pqr-material-review-records';
import { computeMaterialSummary } from '@/lib/pqr-material-review-records';
import type { PqrPackagingReviewRecord } from '@/lib/pqr-packaging-review-records';
import { computePackagingSummary } from '@/lib/pqr-packaging-review-records';
import type { PqrEquipmentReviewRecord } from '@/lib/pqr-equipment-review-records';
import { computeEquipmentSummary } from '@/lib/pqr-equipment-review-records';
import type { PqrUtilityEnvironmentalReviewRecord } from '@/lib/pqr-utility-environmental-review-records';
import { computeUtilityEnvSummary } from '@/lib/pqr-utility-environmental-review-records';
import type { PqrStabilityReviewRecord } from '@/lib/pqr-stability-review-records';
import { computeStabilityReviewSummary } from '@/lib/pqr-stability-review-records';

export const PQR_SUMMARY_CONCLUSION_MODULE = 'PQR Summary & Conclusion';

export const PQR_SUMMARY_CONCLUSION_COLLECTIONS = {
  summary: 'pqr_summary_conclusion',
  sections: 'pqr_sections',
  records: 'pqr_records',
  batchReview: 'pqr_batch_review',
  materialReview: 'pqr_material_review',
  packagingReview: 'pqr_packaging_review',
  equipmentReview: 'pqr_equipment_review',
  utilityEnvReview: 'pqr_utility_environmental_review',
  stabilityReview: 'pqr_stability_review',
  deviations: 'deviations',
  oosRecords: 'oos_records',
  capaRecords: 'capa_records',
  changeControls: 'change_controls',
  riskAssessment: 'risk_assessment',
  cpvReviews: 'cpv_reviews',
  processCapability: 'process_capability',
  trendAnalysis: 'trend_analysis',
  recalls: 'recalls',
} as const;

export const PQR_OVERALL_QUALITY_STATUSES = [
  'Excellent', 'Satisfactory', 'Satisfactory With Observation', 'Needs Improvement', 'Unsatisfactory',
] as const;

export const PQR_OVERALL_PROCESS_STATUSES = [
  'In Control', 'Controlled With Monitoring', 'Needs Improvement', 'Not In Control',
] as const;

export const PQR_OVERALL_RISK_LEVELS = ['Low', 'Medium', 'High', 'Critical'] as const;

export const PQR_SUMMARY_STATUSES = [
  'Draft', 'Generated', 'Under Review', 'Approved', 'Rejected', 'Archived',
] as const;

export const PQR_QUALITY_SCORE_BANDS = [
  { min: 90, label: 'Excellent' },
  { min: 75, label: 'Good' },
  { min: 60, label: 'Acceptable' },
  { min: 40, label: 'Needs Improvement' },
  { min: 0, label: 'Unsatisfactory' },
] as const;

export type PqrOverallQualityStatus = (typeof PQR_OVERALL_QUALITY_STATUSES)[number];
export type PqrOverallProcessStatus = (typeof PQR_OVERALL_PROCESS_STATUSES)[number];
export type PqrSummaryStatus = (typeof PQR_SUMMARY_STATUSES)[number];

export interface PqrSummaryMetrics {
  totalBatchesManufactured: number;
  totalReleasedBatches: number;
  totalRejectedBatches: number;
  batchReleasePct: number;
  batchRejectionPct: number;
  totalMaterialLots: number;
  materialCompliancePct: number;
  totalPackagingLots: number;
  packagingCompliancePct: number;
  equipmentCompliancePct: number;
  utilityCompliancePct: number;
  environmentalCompliancePct: number;
  stabilityCompliancePct: number;
  totalDeviations: number;
  openDeviations: number;
  closedDeviations: number;
  totalOos: number;
  openOos: number;
  closedOos: number;
  totalCapa: number;
  openCapa: number;
  closedCapa: number;
  averageCpk: number;
  averagePpk: number;
  totalRisks: number;
  highRisks: number;
  criticalRisks: number;
  qualityScore: number;
  qualityScoreBand: string;
  recallExists: boolean;
  repeatedOot: boolean;
  criticalOos: boolean;
  sterilityFailure: boolean;
  endotoxinFailure: boolean;
}

export interface PqrSummaryConclusionRecord {
  id?: string;
  summaryId: string;
  pqrId: string;
  pqrNumber: string;
  product: string;
  productCode: string;
  reviewYear: string;
  reviewPeriodFrom: string;
  reviewPeriodTo: string;
  executiveSummary: string;
  qualityPerformanceSummary: string;
  manufacturingPerformanceSummary: string;
  materialPerformanceSummary: string;
  packagingPerformanceSummary: string;
  equipmentPerformanceSummary: string;
  utilityPerformanceSummary: string;
  environmentalPerformanceSummary: string;
  stabilityPerformanceSummary: string;
  deviationSummary: string;
  oosSummary: string;
  capaSummary: string;
  riskAssessmentSummary: string;
  trendAnalysisSummary: string;
  cpvSummary: string;
  overallQualityStatus: PqrOverallQualityStatus | string;
  overallProcessStatus: PqrOverallProcessStatus | string;
  overallRiskLevel: string;
  finalConclusion: string;
  recommendations: string;
  preparedBy: string;
  reviewedBy: string;
  approvedBy: string;
  approvalDate: string;
  reviewerComments: string;
  qaComments: string;
  headQaComments: string;
  finalApprovalComments: string;
  eSignatureApplied: boolean;
  eSignatureMeaning: string;
  metrics: PqrSummaryMetrics;
  status: PqrSummaryStatus | string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
  createdByName?: string;
  updatedByName?: string;
  isDeleted: boolean;
}

export interface PqrSummaryCharts {
  batchReleaseTrend: Array<{ month: string; released: number; rejected: number }>;
  deviationTrend: Array<{ month: string; count: number }>;
  oosTrend: Array<{ month: string; count: number }>;
  capaTrend: Array<{ month: string; count: number }>;
  riskDistribution: Array<{ level: string; count: number }>;
  qualityScoreTrend: Array<{ month: string; score: number }>;
  cpkTrend: Array<{ month: string; cpk: number }>;
  stabilityTrend: Array<{ month: string; compliant: number; nonCompliant: number }>;
  yieldTrend: Array<{ month: string; yield: number }>;
}

export const summaryApprovalSchema = z.object({
  executiveSummary: z.string().min(1, 'Executive Summary is required before approval'),
  finalConclusion: z.string().min(1, 'Final Conclusion is required before approval'),
  recommendations: z.string().min(1, 'Recommendation is required'),
  reviewedBy: z.string().min(1, 'Reviewer is required'),
  approvedBy: z.string().min(1, 'Approver is required'),
  reviewerComments: z.string().default(''),
  qaComments: z.string().default(''),
  headQaComments: z.string().default(''),
  finalApprovalComments: z.string().default(''),
});

export type SummaryApprovalFormData = z.infer<typeof summaryApprovalSchema>;

const str = (v: unknown, fb = '') => (v === null || v === undefined ? fb : String(v));
const num = (v: unknown, fb = 0) => { const n = Number(v); return Number.isFinite(n) ? n : fb; };

function pct(compliant: number, total: number): number {
  return total ? Math.round((compliant / total) * 1000) / 10 : 100;
}

function isOpenStatus(status: string): boolean {
  const s = status.toLowerCase();
  return !s.includes('closed') && !s.includes('complete') && !s.includes('resolved');
}

function isCritical(raw: Record<string, unknown>): boolean {
  const text = `${str(raw.severity)} ${str(raw.riskLevel)} ${str(raw.classification)} ${str(raw.priority)}`.toLowerCase();
  return text.includes('critical');
}

export function computeQualityScore(metrics: Partial<PqrSummaryMetrics>): { score: number; band: string } {
  let score = 100;
  score -= (metrics.totalDeviations ?? 0) * 2;
  score -= (metrics.totalOos ?? 0) * 5;
  score -= (metrics.openCapa ?? 0) * 3;
  score -= (metrics.criticalRisks ?? 0) * 5;
  score -= (metrics.highRisks ?? 0) * 3;
  if ((metrics.averageCpk ?? 1.33) < 1.33) score -= 5;
  if ((metrics.averageCpk ?? 1.33) < 1.0) score -= 10;
  if (metrics.recallExists) score -= 10;
  score = Math.max(0, Math.min(100, Math.round(score)));
  const band = PQR_QUALITY_SCORE_BANDS.find((b) => score >= b.min)?.label || 'Unsatisfactory';
  return { score, band };
}

export interface ConsolidatedReviewData {
  batches: PqrBatchReviewRecord[];
  materials: PqrMaterialReviewRecord[];
  packaging: PqrPackagingReviewRecord[];
  equipment: PqrEquipmentReviewRecord[];
  utilityEnv: PqrUtilityEnvironmentalReviewRecord[];
  stability: PqrStabilityReviewRecord[];
  deviations: Record<string, unknown>[];
  oos: Record<string, unknown>[];
  capa: Record<string, unknown>[];
  changeControls: Record<string, unknown>[];
  risks: Record<string, unknown>[];
  cpvReviews: Record<string, unknown>[];
  capability: Record<string, unknown>[];
  trends: Record<string, unknown>[];
  recalls: Record<string, unknown>[];
}

export function buildSummaryMetrics(data: ConsolidatedReviewData): PqrSummaryMetrics {
  const batchSum = computeBatchSummary(data.batches);
  const matSum = computeMaterialSummary(data.materials);
  const packSum = computePackagingSummary(data.packaging);
  const equipSum = computeEquipmentSummary(data.equipment);
  const utilSum = computeUtilityEnvSummary(data.utilityEnv);
  const stabSum = computeStabilityReviewSummary(data.stability);

  const matCompliant = data.materials.filter((r) => !r.isDeleted && r.complianceStatus === 'Complies').length;
  const packCompliant = data.packaging.filter((r) => !r.isDeleted && r.complianceStatus === 'Complies').length;
  const equipCompliant = data.equipment.filter((r) => !r.isDeleted && r.complianceStatus === 'Complies').length;
  const utilCompliant = data.utilityEnv.filter((r) => !r.isDeleted && r.reviewType === 'Utility Review' && r.complianceStatus === 'Complies').length;
  const utilTotal = data.utilityEnv.filter((r) => !r.isDeleted && r.reviewType === 'Utility Review').length;
  const envCompliant = data.utilityEnv.filter((r) => !r.isDeleted && r.reviewType === 'Environmental Review' && r.complianceStatus === 'Complies').length;
  const envTotal = data.utilityEnv.filter((r) => !r.isDeleted && r.reviewType === 'Environmental Review').length;

  const openDev = data.deviations.filter((d) => isOpenStatus(str(d.status))).length;
  const openOos = data.oos.filter((d) => isOpenStatus(str(d.status))).length;
  const openCapa = data.capa.filter((d) => isOpenStatus(str(d.status))).length;
  const closedDev = data.deviations.length - openDev;
  const closedOos = data.oos.length - openOos;
  const closedCapa = data.capa.length - openCapa;

  const cpkVals = data.capability.map((c) => num(c.cpk ?? c.Cpk)).filter((v) => v > 0);
  const ppkVals = data.capability.map((c) => num(c.ppk ?? c.Ppk)).filter((v) => v > 0);
  const avgCpk = cpkVals.length ? cpkVals.reduce((a, b) => a + b, 0) / cpkVals.length : 0;
  const avgPpk = ppkVals.length ? ppkVals.reduce((a, b) => a + b, 0) / ppkVals.length : 0;

  const highRisks = data.risks.filter((r) => str(r.riskLevel).toLowerCase() === 'high').length
    + data.stability.filter((r) => r.riskLevel === 'High').length
    + data.equipment.filter((r) => r.riskLevel === 'High').length;
  const criticalRisks = data.risks.filter((r) => str(r.riskLevel).toLowerCase() === 'critical').length
    + data.stability.filter((r) => r.riskLevel === 'Critical').length
    + data.equipment.filter((r) => r.riskLevel === 'Critical').length
    + utilSum.openCriticalRisks;

  const recallExists = data.recalls.length > 0;
  const repeatedOot = stabSum.ootResults >= 2 || data.stability.some((r) => r.ootCount >= 2);
  const criticalOos = data.oos.some(isCritical) || stabSum.oosResults > 0;
  const sterilityFailure = data.stability.some((r) =>
    r.parameterName.toLowerCase().includes('sterility') && (r.resultStatus === 'OOS' || r.oosCount > 0),
  );
  const endotoxinFailure = data.stability.some((r) =>
    r.parameterName.toLowerCase().includes('endotoxin') && (r.resultStatus === 'OOS' || r.oosCount > 0),
  );

  const partial: PqrSummaryMetrics = {
    totalBatchesManufactured: batchSum.totalBatches,
    totalReleasedBatches: batchSum.releasedBatches,
    totalRejectedBatches: batchSum.rejectedBatches,
    batchReleasePct: batchSum.releasePct,
    batchRejectionPct: batchSum.rejectionPct,
    totalMaterialLots: matSum.totalMaterialLots,
    materialCompliancePct: pct(matCompliant, data.materials.filter((r) => !r.isDeleted).length),
    totalPackagingLots: packSum.totalPackagingLots,
    packagingCompliancePct: pct(packCompliant, data.packaging.filter((r) => !r.isDeleted).length),
    equipmentCompliancePct: pct(equipCompliant, data.equipment.filter((r) => !r.isDeleted).length),
    utilityCompliancePct: pct(utilCompliant, utilTotal),
    environmentalCompliancePct: pct(envCompliant, envTotal),
    stabilityCompliancePct: stabSum.compliantResults && data.stability.length
      ? pct(stabSum.compliantResults, data.stability.filter((r) => !r.isDeleted).length)
      : 100,
    totalDeviations: data.deviations.length,
    openDeviations: openDev,
    closedDeviations: closedDev,
    totalOos: data.oos.length,
    openOos,
    closedOos,
    totalCapa: data.capa.length,
    openCapa,
    closedCapa,
    averageCpk: Math.round(avgCpk * 1000) / 1000,
    averagePpk: Math.round(avgPpk * 1000) / 1000,
    totalRisks: data.risks.length + highRisks + criticalRisks,
    highRisks,
    criticalRisks,
    recallExists,
    repeatedOot,
    criticalOos,
    sterilityFailure,
    endotoxinFailure,
    qualityScore: 0,
    qualityScoreBand: 'Excellent',
  };

  const { score, band } = computeQualityScore(partial);
  return { ...partial, qualityScore: score, qualityScoreBand: band };
}

export function determineOverallStatuses(metrics: PqrSummaryMetrics): {
  overallQualityStatus: PqrOverallQualityStatus;
  overallProcessStatus: PqrOverallProcessStatus;
  overallRiskLevel: string;
  finalConclusion: string;
} {
  if (
    metrics.criticalOos || metrics.criticalRisks > 0 || metrics.recallExists
    || metrics.sterilityFailure || metrics.endotoxinFailure
  ) {
    return {
      overallQualityStatus: 'Unsatisfactory',
      overallProcessStatus: 'Not In Control',
      overallRiskLevel: 'Critical',
      finalConclusion:
        'Critical quality events including OOS, recall or sterility/endotoxin failure were identified during the review period. Immediate corrective actions and management review are required before continued commercial manufacturing.',
    };
  }

  if (metrics.repeatedOot || metrics.highRisks > 0 || metrics.averageCpk < 1.33) {
    return {
      overallQualityStatus: 'Satisfactory With Observation',
      overallProcessStatus: 'Controlled With Monitoring',
      overallRiskLevel: 'Medium',
      finalConclusion:
        'The product quality profile during the review period was generally acceptable; however, observed OOT trends, elevated risk items or process capability below target require continued monitoring and follow-up actions.',
    };
  }

  if (
    metrics.batchReleasePct >= 95 && !metrics.criticalOos && !metrics.recallExists
    && metrics.averageCpk >= 1.33 && metrics.criticalRisks === 0
  ) {
    return {
      overallQualityStatus: 'Satisfactory',
      overallProcessStatus: 'In Control',
      overallRiskLevel: 'Low',
      finalConclusion:
        'Based on the review of manufacturing, quality control, stability, deviation, OOS, CAPA and CPV data, the product remained in a state of control throughout the review period. No adverse trend affecting product quality was identified. The product continues to meet approved specifications and is considered suitable for continued commercial manufacturing.',
    };
  }

  if (metrics.qualityScore >= 90) {
    return {
      overallQualityStatus: 'Excellent',
      overallProcessStatus: 'In Control',
      overallRiskLevel: 'Low',
      finalConclusion:
        'Overall quality performance during the review period was excellent with strong batch release, compliance and process capability indicators.',
    };
  }

  if (metrics.qualityScore < 60) {
    return {
      overallQualityStatus: 'Needs Improvement',
      overallProcessStatus: 'Needs Improvement',
      overallRiskLevel: metrics.highRisks > 0 ? 'High' : 'Medium',
      finalConclusion:
        'Quality performance indicators during the review period require improvement. Management review and corrective actions are recommended.',
    };
  }

  return {
    overallQualityStatus: 'Satisfactory',
    overallProcessStatus: 'Controlled With Monitoring',
    overallRiskLevel: 'Low',
    finalConclusion:
      'Based on consolidated PQR data, the product quality profile during the review period supports continued manufacturing with routine monitoring.',
  };
}

export function generateRecommendations(metrics: PqrSummaryMetrics, data: ConsolidatedReviewData): string {
  const items: string[] = [];
  if (metrics.batchRejectionPct > 5) items.push('Review manufacturing process and investigate batch rejection trends.');
  if (metrics.repeatedOot) items.push('Increase monitoring frequency and perform trend investigation for repeated OOT.');
  if (metrics.averageCpk < 1.33) items.push('Perform process capability improvement activity for parameters with Cpk below 1.33.');
  if (metrics.totalDeviations >= 3) items.push('Review effectiveness of CAPA implementation for repeated deviations.');
  if (computePackagingSummary(data.packaging).reconciliationMismatchCount > 0) {
    items.push('Strengthen packaging material reconciliation process.');
  }
  if (computeUtilityEnvSummary(data.utilityEnv).excursionRecords > 0) {
    items.push('Review utility and environmental monitoring program following observed excursions.');
  }
  if (metrics.openCapa > 0) items.push('Close open CAPA records within approved timelines.');
  if (metrics.openOos > 0) items.push('Complete investigation and disposition of open OOS records.');
  if (metrics.stabilityCompliancePct < 100) items.push('Evaluate stability data trends and assess shelf-life impact.');
  if (!items.length) {
    items.push('Continue routine PQR monitoring and maintain current control strategy.');
  }
  return items.map((t, i) => `${i + 1}. ${t}`).join('\n');
}

export function generateSectionNarratives(
  metrics: PqrSummaryMetrics,
  data: ConsolidatedReviewData,
): Pick<PqrSummaryConclusionRecord,
  'executiveSummary' | 'qualityPerformanceSummary' | 'manufacturingPerformanceSummary'
  | 'materialPerformanceSummary' | 'packagingPerformanceSummary' | 'equipmentPerformanceSummary'
  | 'utilityPerformanceSummary' | 'environmentalPerformanceSummary' | 'stabilityPerformanceSummary'
  | 'deviationSummary' | 'oosSummary' | 'capaSummary' | 'riskAssessmentSummary'
  | 'trendAnalysisSummary' | 'cpvSummary'
> {
  const batchSum = computeBatchSummary(data.batches);
  return {
    executiveSummary:
      `Product Quality Review for ${metrics.totalBatchesManufactured} batch(es) with ${metrics.batchReleasePct}% release rate. Quality score: ${metrics.qualityScore}/100 (${metrics.qualityScoreBand}).`,
    qualityPerformanceSummary:
      `Quality score ${metrics.qualityScore}/100. ${metrics.totalOos} OOS, ${metrics.totalDeviations} deviations, ${metrics.totalCapa} CAPA during review period.`,
    manufacturingPerformanceSummary:
      `${batchSum.totalBatches} batches manufactured; ${batchSum.releasedBatches} released (${metrics.batchReleasePct}%), ${batchSum.rejectedBatches} rejected.`,
    materialPerformanceSummary:
      `${metrics.totalMaterialLots} material lots reviewed with ${metrics.materialCompliancePct}% compliance.`,
    packagingPerformanceSummary:
      `${metrics.totalPackagingLots} packaging lots reviewed with ${metrics.packagingCompliancePct}% compliance.`,
    equipmentPerformanceSummary:
      `${data.equipment.length} equipment items reviewed with ${metrics.equipmentCompliancePct}% compliance.`,
    utilityPerformanceSummary:
      `${metrics.utilityCompliancePct}% utility monitoring compliance across reviewed systems.`,
    environmentalPerformanceSummary:
      `${metrics.environmentalCompliancePct}% environmental monitoring compliance across reviewed areas.`,
    stabilityPerformanceSummary:
      `${metrics.stabilityCompliancePct}% stability result compliance; ${computeStabilityReviewSummary(data.stability).ootResults} OOT and ${computeStabilityReviewSummary(data.stability).oosResults} OOS.`,
    deviationSummary:
      `${metrics.totalDeviations} deviations (${metrics.openDeviations} open, ${metrics.closedDeviations} closed).`,
    oosSummary: `${metrics.totalOos} OOS records (${metrics.openOos} open, ${metrics.closedOos} closed).`,
    capaSummary: `${metrics.totalCapa} CAPA records (${metrics.openCapa} open, ${metrics.closedCapa} closed).`,
    riskAssessmentSummary:
      `${metrics.totalRisks} risk items identified; ${metrics.highRisks} high and ${metrics.criticalRisks} critical.`,
    trendAnalysisSummary:
      `${data.trends.length} trend analysis record(s) reviewed during the period.`,
    cpvSummary:
      `${data.cpvReviews.length} CPV review(s); average Cpk ${metrics.averageCpk}, average Ppk ${metrics.averagePpk}.`,
  };
}

export function buildSummaryCharts(data: ConsolidatedReviewData, metrics: PqrSummaryMetrics): PqrSummaryCharts {
  const monthCount = (rows: Record<string, unknown>[], field = 'createdAt') => {
    const map = new Map<string, number>();
    rows.forEach((r) => {
      const m = str(r[field] || r.created_at || r.reportedDate).slice(0, 7);
      if (m) map.set(m, (map.get(m) || 0) + 1);
    });
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([month, count]) => ({ month, count }));
  };

  const batchMonth = new Map<string, { released: number; rejected: number }>();
  data.batches.forEach((b) => {
    const m = (b.releaseDate || b.manufacturingDate || b.createdAt || '').slice(0, 7);
    if (!m) return;
    const cur = batchMonth.get(m) || { released: 0, rejected: 0 };
    if (b.releaseStatus === 'Released') cur.released += 1;
    if (b.releaseStatus === 'Rejected') cur.rejected += 1;
    batchMonth.set(m, cur);
  });

  const stabMonth = new Map<string, { compliant: number; nonCompliant: number }>();
  data.stability.forEach((r) => {
    const m = (r.testDate || r.createdAt || '').slice(0, 7);
    if (!m) return;
    const cur = stabMonth.get(m) || { compliant: 0, nonCompliant: 0 };
    if (r.resultStatus === 'Complies') cur.compliant += 1;
    else cur.nonCompliant += 1;
    stabMonth.set(m, cur);
  });

  const riskMap = new Map<string, number>();
  data.risks.forEach((r) => {
    const level = str(r.riskLevel, 'Low');
    riskMap.set(level, (riskMap.get(level) || 0) + 1);
  });
  data.stability.forEach((r) => riskMap.set(r.riskLevel || 'Low', (riskMap.get(r.riskLevel || 'Low') || 0) + 1));

  const cpkMonth = new Map<string, { sum: number; n: number }>();
  data.capability.forEach((c) => {
    const m = str(c.testDate || c.createdAt).slice(0, 7);
    const v = num(c.cpk ?? c.Cpk);
    if (!m || v <= 0) return;
    const cur = cpkMonth.get(m) || { sum: 0, n: 0 };
    cur.sum += v;
    cur.n += 1;
    cpkMonth.set(m, cur);
  });

  return {
    batchReleaseTrend: Array.from(batchMonth.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([month, v]) => ({ month, ...v })),
    deviationTrend: monthCount(data.deviations),
    oosTrend: monthCount(data.oos),
    capaTrend: monthCount(data.capa),
    riskDistribution: Array.from(riskMap.entries()).map(([level, count]) => ({ level, count })),
    qualityScoreTrend: [{ month: 'Current', score: metrics.qualityScore }],
    cpkTrend: Array.from(cpkMonth.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([month, v]) => ({
      month, cpk: v.n ? Math.round((v.sum / v.n) * 1000) / 1000 : 0,
    })),
    stabilityTrend: Array.from(stabMonth.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([month, v]) => ({ month, ...v })),
    yieldTrend: [],
  };
}

export function canViewSummaryConclusion(role?: string): boolean {
  return [
    'super_admin', 'admin', 'qa', 'head_qa', 'qa_manager', 'qa_executive',
    'management', 'production_manager', 'auditor', 'viewer',
  ].includes(role || '');
}

export function canManageSummaryConclusion(role?: string): boolean {
  return ['super_admin', 'admin', 'qa', 'head_qa', 'qa_manager', 'qa_executive'].includes(role || '');
}

export function canApproveSummaryConclusion(role?: string): boolean {
  return ['super_admin', 'admin', 'head_qa', 'qa_manager', 'management'].includes(role || '');
}

export function canExportSummaryConclusion(role?: string): boolean {
  return ['super_admin', 'admin', 'qa', 'head_qa', 'qa_manager', 'auditor', 'management'].includes(role || '');
}

export function qualityStatusColor(status: string): string {
  if (status === 'Excellent' || status === 'Satisfactory') return 'bg-green-50 text-green-700 border-green-200';
  if (status === 'Satisfactory With Observation') return 'bg-amber-50 text-amber-800 border-amber-200';
  if (status === 'Needs Improvement') return 'bg-orange-50 text-orange-800 border-orange-200';
  return 'bg-red-50 text-red-700 border-red-200';
}

export function processStatusColor(status: string): string {
  if (status === 'In Control') return 'bg-green-50 text-green-700 border-green-200';
  if (status === 'Controlled With Monitoring') return 'bg-blue-50 text-blue-700 border-blue-200';
  if (status === 'Needs Improvement') return 'bg-amber-50 text-amber-800 border-amber-200';
  return 'bg-red-50 text-red-700 border-red-200';
}

export function riskLevelColor(level: string): string {
  if (level === 'Critical') return 'bg-red-900/10 text-red-900 border-red-300';
  if (level === 'High') return 'bg-red-50 text-red-700 border-red-200';
  if (level === 'Medium') return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-green-50 text-green-700 border-green-200';
}

export function summaryStatusColor(status: string): string {
  if (status === 'Approved') return 'bg-green-50 text-green-700 border-green-200';
  if (status === 'Under Review') return 'bg-blue-50 text-blue-700 border-blue-200';
  if (status === 'Generated') return 'bg-slate-50 text-slate-700 border-slate-200';
  if (status === 'Rejected') return 'bg-red-50 text-red-700 border-red-200';
  return 'bg-amber-50 text-amber-800 border-amber-200';
}

export function scoreGaugeColor(score: number): string {
  if (score >= 90) return '#059669';
  if (score >= 75) return '#2563eb';
  if (score >= 60) return '#d97706';
  if (score >= 40) return '#ea580c';
  return '#dc2626';
}
