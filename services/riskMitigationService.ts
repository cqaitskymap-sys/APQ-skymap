export {
  getRiskMitigations,
  listAllRiskMitigations,
  fetchRiskMitigationPageData,
  fetchRiskMitigationDashboard,
  saveRiskMitigationDraft,
  submitMitigationForReview,
  approveMitigation,
  rejectMitigation,
  closeMitigation,
  softDeleteMitigation,
  escalateOverdueMitigations,
  canEditRiskMitigation,
} from '@/lib/risk-mitigation-service';

export type { RiskMitigationActor, RiskMitigationFormInput } from '@/lib/risk-mitigation-records';
