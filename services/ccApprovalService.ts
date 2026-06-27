export {
  getCcApprovals,
  getCcApprovalHistory,
  fetchAllCcApprovalRecords,
  initializeCcApprovalWorkflow,
  approveCcStep,
  rejectCcStep,
  sendBackCcStep,
  escalateCcApproval,
  escalateOverdueCcApprovals,
  logCcEsignResult,
  fetchCcApprovalPageData,
  fetchCcApprovalDashboardData,
  computeCcApprovalDashboardCounts,
} from '@/lib/cc-approval-service';

export {
  CC_APPROVAL_MODULE,
  CC_APPROVAL_MEANINGS,
  canViewCcApproval,
  canActOnCcApproval,
  isCcApprovalReadOnly,
  ccApprovalMeaning,
  validateCcApprovalAction,
  mapHistoryToCcApprovalTimeline,
} from '@/lib/cc-approval-records';

export type { CcApprovalActor } from '@/lib/cc-approval-service';
