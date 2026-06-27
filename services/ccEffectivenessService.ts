export {
  getCcEffectivenessReview,
  listCcEffectivenessReviews,
  fetchCcEffectivenessPageData,
  fetchCcEffectivenessListData,
  saveCcEffectivenessDraft,
  submitCcEffectivenessForReview,
  submitCcEffectivenessQaReview,
  submitCcEffectivenessHeadQaReview,
  closeCcEffectivenessReview,
  softDeleteCcEffectivenessReview,
  computeCcEffectivenessDashboardMetrics,
  computeCcEffectivenessChartData,
  computeCcEffectivenessScore,
  computeAutoCcEffectivenessResult,
} from '@/lib/cc-effectiveness-service';

export {
  CC_EFFECTIVENESS_MODULE,
  canViewCcEffectiveness,
  canCreateCcEffectiveness,
  canApproveCcEffectiveness,
  canApproveCriticalCcEffectiveness,
  isCcEffectivenessReadOnly,
  isDepartmentCcEffectivenessViewer,
  canProvideValidationEffectivenessInput,
  canProvideCsvEffectivenessInput,
  canProvideRegulatoryEffectivenessInput,
  effectivenessStatusColor,
  effectivenessResultColor,
  generateCapaRecommendation,
  mapCcEffectivenessAuditToTimeline,
} from '@/lib/cc-effectiveness-records';

export type {
  CcEffectivenessActor,
  CcEffectivenessFormInput,
  CcEffectivenessQaReviewInput,
  CcEffectivenessDashboardMetrics,
  CcEffectivenessChartData,
} from '@/lib/cc-effectiveness-service';
