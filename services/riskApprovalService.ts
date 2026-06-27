export {
  getRiskApprovals,
  getRiskApprovalHistory,
  fetchAllRiskApprovalRecords,
  initializeRiskApprovalWorkflow,
  approveRiskStep,
  rejectRiskStep,
  sendBackRiskStep,
  escalateOverdueRiskApprovals,
  logRiskEsignResult,
  fetchRiskApprovalPageData,
  fetchRiskApprovalDashboardData,
} from '@/lib/risk-approval-service';

export type { RiskApprovalActor } from '@/lib/risk-approval-service';
