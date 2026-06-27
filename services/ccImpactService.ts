export {
  getCcImpactAssessment,
  listCcImpactAssessments,
  fetchCcImpactPageData,
  fetchCcImpactListData,
  saveCcImpactDraft,
  submitCcImpactForReview,
  submitCcImpactQaReview,
  getLegacyImpactAssessment,
  computeCcImpactDashboardMetrics,
} from '@/lib/cc-impact-service';

export type {
  CcImpactActor,
  CcImpactFormInput,
  CcImpactQaReviewInput,
  CcImpactDashboardMetrics,
} from '@/lib/cc-impact-service';
