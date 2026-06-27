export {
  getCcRiskAssessment,
  getCcRiskRecords,
  getCcRiskHeader,
  getCcRiskRows,
  listCcRiskAssessments,
  fetchCcRiskPageData,
  fetchCcRiskListData,
  saveCcRiskHeader,
  createCcRiskRow,
  updateCcRiskRow,
  linkCcRiskCapa,
  submitCcRiskForReview,
  submitCcRiskQaReview,
  softDeleteCcRiskRow,
  getLegacyRiskAssessment,
  computeCcRiskDashboardMetrics,
  computeCcRiskChartData,
} from '@/lib/cc-risk-service';

export type {
  CcRiskActor,
  CcRiskHeaderInput,
  CcRiskRowInput,
  CcRiskQaReviewInput,
  CcRiskDashboardMetrics,
  CcRiskChartData,
} from '@/lib/cc-risk-service';
