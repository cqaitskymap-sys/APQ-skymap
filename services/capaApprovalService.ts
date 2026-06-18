export * from '@/lib/capa-approval-service';
export {
  canViewCapaApproval,
  canActOnCapaApproval,
  canReopenCapa,
  isCapaApprovalReadOnly,
  isCapaRecordLocked,
  approvalStatusLabel,
  approvalStatusColor,
  workflowStepColor,
  roleBadgeColor,
  capaApprovalMeaning,
  CAPA_APPROVAL_MODULE,
  CAPA_APPROVAL_MEANINGS,
  daysPendingCapaApproval,
  capaApprovalPriority,
} from '@/lib/capa-approval-records';
export {
  capaApprovalActionSchema,
  capaApprovalReopenSchema,
  type CapaApprovalActionInput,
  type CapaApprovalReopenInput,
} from '@/lib/capa-approval-schemas';
