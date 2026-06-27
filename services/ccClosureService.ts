export * from '@/lib/cc-closure-service';
export {
  CC_CLOSURE_MODULE,
  computeCcClosureReadiness,
  computeCcClosureDashboardMetrics,
  canViewCcClosure,
  canReviewCcClosure,
  canApproveCcClosure,
  canRejectCcClosure,
  canReopenCcClosure,
  isCcClosureReadOnly,
  isDepartmentCcClosureViewer,
  closureStatusColor,
  mapCcClosureAuditToTimeline,
  ccClosureMeaning,
} from '@/lib/cc-closure-records';
