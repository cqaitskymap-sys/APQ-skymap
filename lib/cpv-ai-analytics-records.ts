import { z } from 'zod';

export const AI_PREDICTIONS_COLLECTION = 'ai_predictions';
export const AI_RECOMMENDATIONS_COLLECTION = 'ai_recommendations';
export const CPV_AI_ANALYTICS_MODULE = 'CPV AI Analytics';
export const MIN_HISTORICAL_RECORDS = 10;

export const AI_ENGINE_TYPES = [
  'process_health',
  'risk_prediction',
  'oos_prediction',
  'yield_prediction',
  'cpk_forecast',
  'stability_forecast',
  'capa_recommendation',
  'deviation_pattern',
  'batch_failure',
  'management_insights',
] as const;

export const RECOMMENDATION_PRIORITIES = ['Low', 'Medium', 'High', 'Critical'] as const;
export const RECOMMENDATION_STATUSES = ['Open', 'Reviewed', 'Implemented', 'Closed'] as const;
export const RISK_LEVELS = ['Low', 'Medium', 'High', 'Critical'] as const;

export type AiEngineType = (typeof AI_ENGINE_TYPES)[number];
export type RecommendationPriority = (typeof RECOMMENDATION_PRIORITIES)[number];
export type RecommendationStatus = (typeof RECOMMENDATION_STATUSES)[number];

export interface AiPredictionRecord {
  id: string;
  predictionId: string;
  engineType: AiEngineType;
  product: string;
  module: string;
  parameter: string;
  batchNumber: string;
  predictedValue: number | string;
  confidenceScore: number;
  riskLevel: string;
  reason: string;
  recommendedAction: string;
  generatedDate: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
  isDeleted: boolean;
  [key: string]: unknown;
}

export interface AiRecommendationRecord {
  id: string;
  recommendationId: string;
  product: string;
  module: string;
  finding: string;
  riskLevel: string;
  recommendation: string;
  priority: RecommendationPriority;
  status: RecommendationStatus;
  generatedDate: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
  isDeleted: boolean;
  [key: string]: unknown;
}

export interface ProcessHealthResult {
  score: number;
  category: 'Excellent' | 'Good' | 'Attention Required' | 'Critical';
  cppCompliance: number;
  cqaCompliance: number;
  yieldPerformance: number;
  riskCount: number;
  deviationCount: number;
  oosCount: number;
  capaEffectiveness: number;
  cpkPerformance: number;
  productRanking: Array<{ product: string; score: number }>;
  trend: Array<{ month: string; score: number }>;
}

export interface RiskPrediction {
  product: string;
  module: string;
  predictedRiskPct: number;
  riskLevel: string;
  confidenceScore: number;
  reason: string;
}

export interface OosPrediction {
  product: string;
  parameter: string;
  predictedOosPct: number;
  riskLevel: string;
  recommendedAction: string;
  confidenceScore: number;
}

export interface YieldPrediction {
  product: string;
  expectedYieldPct: number;
  confidencePct: number;
  expectedLossPct: number;
  targetYield: number;
  alert: boolean;
}

export interface CpkForecast {
  product: string;
  parameter: string;
  currentCpk: number;
  predictedCpk: number;
  expectedRisk: string;
  alert: boolean;
}

export interface StabilityForecast {
  product: string;
  parameter: string;
  currentValue: number;
  forecast3M: number;
  forecast6M: number;
  forecast12M: number;
  alert: boolean;
  reason: string;
}

export interface DeviationPattern {
  issue: string;
  count: number;
  department: string;
  month: string;
}

export interface BatchFailurePrediction {
  batchNumber: string;
  product: string;
  failureProbability: number;
  category: string;
  reason: string;
}

export interface ManagementInsights {
  topRisks: string[];
  topOosCauses: string[];
  topDeviations: string[];
  worstProducts: string[];
  bestProducts: string[];
  trendingRisks: string[];
  trendingImprovements: string[];
  capaEffectivenessPct: number;
  overallPlantHealth: number;
}

export interface AiAnalyticsDashboard {
  generatedAt: string;
  insufficientData: boolean;
  dataPointCount: number;
  productFilter: string;
  processHealth: ProcessHealthResult | null;
  riskPredictions: RiskPrediction[];
  oosPredictions: OosPrediction[];
  yieldPredictions: YieldPrediction[];
  cpkForecasts: CpkForecast[];
  stabilityForecasts: StabilityForecast[];
  deviationPatterns: DeviationPattern[];
  batchFailurePredictions: BatchFailurePrediction[];
  managementInsights: ManagementInsights | null;
  healthScoreTrend: Array<{ month: string; score: number }>;
  riskTrend: Array<{ month: string; value: number }>;
  yieldTrend: Array<{ month: string; value: number }>;
  cpkTrend: Array<{ month: string; value: number }>;
  oosTrend: Array<{ month: string; value: number }>;
  stabilityTrend: Array<{ month: string; value: number }>;
  deviationTrend: Array<{ name: string; value: number }>;
  capaEffectivenessTrend: Array<{ month: string; value: number }>;
  summary: {
    healthScore: number;
    healthCategory: string;
    predictedRisks: number;
    predictedOos: number;
    predictedYieldLoss: number;
    predictedCpkFailure: number;
    openRecommendations: number;
    criticalAlerts: number;
    topRiskProduct: string;
  };
}

export const recommendationStatusSchema = z.object({
  status: z.enum(RECOMMENDATION_STATUSES),
});

export function healthCategory(score: number): ProcessHealthResult['category'] {
  if (score >= 90) return 'Excellent';
  if (score >= 75) return 'Good';
  if (score >= 60) return 'Attention Required';
  return 'Critical';
}

export function summarizeDashboard(dashboard: AiAnalyticsDashboard | null) {
  if (!dashboard) {
    return {
      healthScore: 0,
      predictedRisks: 0,
      predictedOos: 0,
      predictedYieldLoss: 0,
      predictedCpkFailure: 0,
      openRecommendations: 0,
      criticalAlerts: 0,
      topRiskProduct: '—',
    };
  }
  return dashboard.summary;
}

export function canViewAiAnalytics(role?: string): boolean {
  return [
    'super_admin', 'admin', 'head_qa', 'qa_manager', 'qa', 'auditor', 'viewer',
  ].includes(role || '');
}

export function canManageAiRecommendations(role?: string): boolean {
  return ['super_admin', 'admin', 'head_qa'].includes(role || '');
}

export function canExportAiAnalytics(role?: string): boolean {
  return ['super_admin', 'admin', 'head_qa', 'qa_manager', 'auditor'].includes(role || '');
}

export function isAiAnalyticsViewOnly(role?: string): boolean {
  return ['auditor', 'viewer'].includes(role || '');
}

export function generatePredictionId(count: number): string {
  return `AIP/${new Date().getFullYear()}/${String(count + 1).padStart(4, '0')}`;
}

export function generateRecommendationId(count: number): string {
  return `AIR/${new Date().getFullYear()}/${String(count + 1).padStart(4, '0')}`;
}
