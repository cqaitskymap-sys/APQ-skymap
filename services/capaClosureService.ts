export * from '@/lib/capa-closure-service';
export {
  canViewCapaClosure,
  canReviewCapaClosure,
  canApproveCapaClosure,
  canReopenCapaClosure,
  isCapaClosureReadOnly,
  closureStatusColor,
  computeCapaClosureReadiness,
  computeCapaClosureDashboardMetrics,
  mapClosureAuditToTimeline,
  capaClosureMeaning,
  CAPA_CLOSURE_MODULE,
} from '@/lib/capa-closure-records';
export {
  capaClosureDraftSchema,
  capaClosureSubmitSchema,
  capaClosureReopenSchema,
  type CapaClosureDraftInput,
  type CapaClosureSubmitInput,
} from '@/lib/capa-closure-schemas';
