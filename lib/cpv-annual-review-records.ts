import { z } from 'zod';

export const CPV_REVIEW_COLLECTION = 'cpv_reviews';
export const CPV_REVIEW_SECTIONS_COLLECTION = 'cpv_review_sections';
export const CPV_REVIEW_APPROVALS_COLLECTION = 'cpv_review_approvals';
export const CPV_REVIEW_LEGACY = ['cpv_annual_review'] as const;
export const CPV_REVIEW_MODULE = 'Annual CPV Review';

export const CPV_REVIEW_STATUSES = [
  'Draft',
  'Data Collection',
  'Generated',
  'Under Review',
  'Approved',
  'Rejected',
  'Archived',
] as const;

export const OVERALL_PROCESS_STATUSES = [
  'In Control',
  'Under Control With Monitoring',
  'Needs Improvement',
  'Not In Control',
] as const;

export const OVERALL_RISK_LEVELS = ['Low', 'Medium', 'High', 'Critical'] as const;

export const REPORT_SECTION_KEYS = [
  'executiveSummary',
  'productBatchSummary',
  'cppReview',
  'cqaReview',
  'rawMaterialReview',
  'packingMaterialReview',
  'utilityReview',
  'environmentalReview',
  'yieldReview',
  'stabilityReview',
  'holdTimeReview',
  'processCapabilityReview',
  'trendAnalysisReview',
  'spcReview',
  'riskAssessmentSummary',
  'deviationReview',
  'oosReview',
  'capaReview',
  'changeControlReview',
  'recommendations',
  'finalConclusion',
  'approvalPage',
] as const;

export const REPORT_SECTION_LABELS: Record<(typeof REPORT_SECTION_KEYS)[number], string> = {
  executiveSummary: '1. Executive Summary',
  productBatchSummary: '2. Product and Batch Summary',
  cppReview: '3. CPP Review',
  cqaReview: '4. CQA Review',
  rawMaterialReview: '5. Raw Material Review',
  packingMaterialReview: '6. Packing Material Review',
  utilityReview: '7. Utility Review',
  environmentalReview: '8. Environmental Review',
  yieldReview: '9. Yield Review',
  stabilityReview: '10. Stability Review',
  holdTimeReview: '11. Hold Time Review',
  processCapabilityReview: '12. Process Capability Review',
  trendAnalysisReview: '13. Trend Analysis Review',
  spcReview: '14. Statistical Process Control Review',
  riskAssessmentSummary: '15. Risk Assessment Summary',
  deviationReview: '16. Deviation Review',
  oosReview: '17. OOS Review',
  capaReview: '18. CAPA Review',
  changeControlReview: '19. Change Control Review',
  recommendations: '20. Recommendations',
  finalConclusion: '21. Final Conclusion',
  approvalPage: '22. Approval Page',
};

export type CpvReviewStatus = (typeof CPV_REVIEW_STATUSES)[number];
export type OverallProcessStatus = (typeof OVERALL_PROCESS_STATUSES)[number];
export type OverallRiskLevel = (typeof OVERALL_RISK_LEVELS)[number];

export interface CpvReviewMetrics {
  totalBatchesReviewed: number;
  releasedBatches: number;
  rejectedBatches: number;
  holdBatches: number;
  cppCompliancePct: number;
  cqaCompliancePct: number;
  yieldAverage: number;
  ootCount: number;
  oosCount: number;
  deviationCount: number;
  capaCount: number;
  openRiskCount: number;
  highRiskCount: number;
  criticalOpenRiskCount: number;
  criticalOosOpen: number;
  repeatedOot: boolean;
  sterilityEndotoxinFailure: boolean;
  averageCp: number;
  averageCpk: number;
  averagePp: number;
  averagePpk: number;
}

export interface CpvReviewSectionRecord {
  id?: string;
  cpvReviewId: string;
  sectionKey: (typeof REPORT_SECTION_KEYS)[number];
  sectionTitle: string;
  content: string;
  summary: string;
  data?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

export interface CpvReviewApprovalRecord {
  id?: string;
  cpvReviewId: string;
  role: 'prepared' | 'reviewed' | 'approved';
  designation: string;
  name: string;
  signatureText: string;
  meaning: string;
  reason: string;
  signedAt: string | null;
  userId?: string;
  status: string;
}

export interface CpvAnnualReviewRecord extends Record<string, unknown> {
  id: string;
  cpvReviewId: string;
  cpvReviewNumber: string;
  productName: string;
  productCode: string;
  genericName: string;
  strength: string;
  dosageForm: string;
  reviewPeriodFrom: string;
  reviewPeriodTo: string;
  reviewYear: number;
  totalBatchesReviewed: number;
  totalCppParametersReviewed: number;
  totalCqaParametersReviewed: number;
  totalDeviations: number;
  totalOos: number;
  totalCapa: number;
  totalChangeControls: number;
  averageCpk: number;
  averagePpk: number;
  overallProcessStatus: OverallProcessStatus;
  overallRiskLevel: OverallRiskLevel;
  executiveSummary: string;
  conclusion: string;
  recommendations: string;
  preparedBy: string;
  reviewedBy: string;
  approvedBy: string;
  reviewStatus: CpvReviewStatus;
  metrics: CpvReviewMetrics;
  snapshot: Record<string, unknown>;
  sections: CpvReviewSectionRecord[];
  signatures: CpvReviewApprovalRecord[];
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
  createdByName?: string;
  updatedByName?: string;
  isDeleted: boolean;
}

export interface CpvReviewListSummary {
  total: number;
  draft: number;
  underReview: number;
  approved: number;
  rejected: number;
  due: number;
  highRisk: number;
  averageHealthScore: number;
}

const requiredText = z.string().trim().min(1, 'Required');

export const cpvReviewFormSchema = z.object({
  productName: requiredText,
  productCode: z.string().trim().optional().default(''),
  genericName: z.string().trim().optional().default(''),
  strength: z.string().trim().optional().default(''),
  dosageForm: z.string().trim().optional().default(''),
  reviewPeriodFrom: requiredText,
  reviewPeriodTo: requiredText,
  executiveSummary: z.string().trim().optional().default(''),
  conclusion: z.string().trim().optional().default(''),
  recommendations: z.string().trim().optional().default(''),
}).refine((d) => new Date(d.reviewPeriodTo) >= new Date(d.reviewPeriodFrom), {
  message: 'Review period end must be on or after start date',
  path: ['reviewPeriodTo'],
});

export type CpvReviewFormData = z.infer<typeof cpvReviewFormSchema>;

export function buildCpvReviewId(productCode: string): string {
  const code = (productCode || 'ALL').replace(/\s+/g, '-').toUpperCase();
  return `CPV-REV-${code}-${Date.now()}`;
}

export function generateCpvReviewNumber(year: number, existingCount: number): string {
  return `CPV/${year}/${String(existingCount + 1).padStart(4, '0')}`;
}

export function reviewStatusLabel(status: string): string {
  const legacy: Record<string, string> = {
    draft: 'Draft',
    under_review: 'Under Review',
    approved: 'Approved',
    archived: 'Archived',
  };
  return legacy[status] || status;
}

export function computeOverallAssessment(metrics: CpvReviewMetrics): {
  overallProcessStatus: OverallProcessStatus;
  overallRiskLevel: OverallRiskLevel;
} {
  if (metrics.criticalOosOpen || metrics.criticalOpenRiskCount > 0 || metrics.sterilityEndotoxinFailure) {
    return { overallProcessStatus: 'Not In Control', overallRiskLevel: 'Critical' };
  }
  if (metrics.averageCpk < 1.33 || metrics.repeatedOot || metrics.highRiskCount > 0) {
    return {
      overallProcessStatus: 'Needs Improvement',
      overallRiskLevel: metrics.highRiskCount > 0 ? 'High' : 'Medium',
    };
  }
  if (
    metrics.cppCompliancePct >= 95
    && metrics.cqaCompliancePct >= 95
    && metrics.criticalOpenRiskCount === 0
    && metrics.averageCpk >= 1.33
    && !metrics.criticalOosOpen
  ) {
    return { overallProcessStatus: 'In Control', overallRiskLevel: 'Low' };
  }
  return { overallProcessStatus: 'Under Control With Monitoring', overallRiskLevel: 'Medium' };
}

export function computeProcessHealthScore(metrics: CpvReviewMetrics): number {
  let score = 100;
  if (metrics.cppCompliancePct < 95) score -= 10;
  if (metrics.cqaCompliancePct < 95) score -= 10;
  if (metrics.averageCpk < 1.33) score -= 15;
  if (metrics.oosCount > 0) score -= 10;
  if (metrics.openRiskCount > 0) score -= 5;
  if (metrics.highRiskCount > 0) score -= 10;
  if (metrics.criticalOpenRiskCount > 0) score -= 25;
  return Math.max(0, Math.min(100, score));
}

export function summarizeCpvReviews(records: CpvAnnualReviewRecord[]): CpvReviewListSummary {
  const active = records.filter((r) => !r.isDeleted);
  const now = new Date();
  return {
    total: active.length,
    draft: active.filter((r) => ['Draft', 'Data Collection', 'Generated'].includes(r.reviewStatus)).length,
    underReview: active.filter((r) => r.reviewStatus === 'Under Review').length,
    approved: active.filter((r) => r.reviewStatus === 'Approved').length,
    rejected: active.filter((r) => r.reviewStatus === 'Rejected').length,
    due: active.filter((r) => {
      if (['Approved', 'Archived', 'Rejected'].includes(r.reviewStatus)) return false;
      const to = new Date(r.reviewPeriodTo);
      return !Number.isNaN(to.getTime()) && to < now;
    }).length,
    highRisk: active.filter((r) => ['High', 'Critical'].includes(r.overallRiskLevel)).length,
    averageHealthScore: active.length
      ? Math.round(active.reduce((s, r) => s + computeProcessHealthScore(r.metrics), 0) / active.length)
      : 0,
  };
}

export function buildCpvReviewCharts(snapshot: Record<string, unknown>) {
  const cpp = snapshot.cpp as { total?: number; complies?: number; oot?: number; oos?: number } | undefined;
  const cqa = snapshot.cqa as { total?: number; complies?: number; oot?: number; oos?: number } | undefined;
  const risk = snapshot.risk as { critical?: number; high?: number; medium?: number; low?: number } | undefined;
  const metrics = snapshot.metrics as CpvReviewMetrics | undefined;

  return {
    cppCompliance: [
      { name: 'Pass', value: cpp?.complies ?? 0 },
      { name: 'OOT', value: cpp?.oot ?? 0 },
      { name: 'OOS', value: cpp?.oos ?? 0 },
    ],
    cqaCompliance: [
      { name: 'Pass', value: cqa?.complies ?? 0 },
      { name: 'OOT', value: cqa?.oot ?? 0 },
      { name: 'OOS', value: cqa?.oos ?? 0 },
    ],
    riskDistribution: [
      { name: 'Critical', value: risk?.critical ?? 0 },
      { name: 'High', value: risk?.high ?? 0 },
      { name: 'Medium', value: risk?.medium ?? 0 },
      { name: 'Low', value: risk?.low ?? 0 },
    ],
    deviationTrend: [{ name: 'Deviations', value: metrics?.deviationCount ?? 0 }],
    oosTrend: [{ name: 'OOS', value: metrics?.oosCount ?? 0 }],
    capaTrend: [{ name: 'CAPA', value: metrics?.capaCount ?? 0 }],
    cpkTrend: [{ name: 'Avg Cpk', value: Number((metrics?.averageCpk ?? 0).toFixed(2)) }],
    yieldTrend: [{ name: 'Yield Avg %', value: Number((metrics?.yieldAverage ?? 0).toFixed(1)) }],
  };
}

export function riskLevelColor(level: string): string {
  if (level === 'Critical') return '#991b1b';
  if (level === 'High') return '#dc2626';
  if (level === 'Medium') return '#d97706';
  return '#059669';
}

export function processStatusColor(status: string): 'green' | 'amber' | 'red' | 'blue' {
  if (status === 'In Control') return 'green';
  if (status === 'Not In Control') return 'red';
  if (status === 'Needs Improvement') return 'amber';
  return 'blue';
}
