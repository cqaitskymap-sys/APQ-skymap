export {
  approveComplaintStep,
  escalateOverdueComplaintApprovals,
  fetchComplaintApprovalDashboardData,
  fetchComplaintApprovalPageData,
  getAuditLogsForComplaint,
  getComplaintApprovals,
  getComplaintApprovalHistory,
  initializeComplaintApprovalWorkflow,
  logComplaintEsignResult,
  rejectComplaintStep,
  sendBackComplaintStep,
  buildComplaintWorkflowSteps,
  getCurrentPendingComplaintApproval,
  mapAuditToComplaintApprovalTimeline,
} from '@/lib/complaint-approval-service';

export type { ComplaintApprovalActor } from '@/lib/complaint-approval-service';
