export {
  getRiskClosure,
  listRiskClosures,
  fetchRiskClosurePageData,
  fetchRiskClosureDashboard,
  saveRiskClosureDraft,
  submitRiskClosureForQaReview,
  approveHeadQaRiskClosure,
  closeRiskWithClosure,
  rejectRiskClosure,
  reopenRiskClosure,
  logRiskClosureEsignResult,
  softDeleteRiskClosure,
} from '@/lib/risk-closure-service';

export type { RiskClosureActor, RiskClosureFormInput } from '@/lib/risk-closure-service';
