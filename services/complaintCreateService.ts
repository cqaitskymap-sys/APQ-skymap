export * from '@/lib/complaint-create-service';
export {
  COMPLAINT_CREATE_MODULE,
  COMPLAINT_WIZARD_STEPS,
  buildComplaintNumberFallback,
  canCreateComplaintWizard,
  computeComplaintAutoRules,
  deriveRiskLevel,
  isComplaintCreateReadOnly,
  mapBatchToForm,
  mapCustomerToForm,
} from '@/lib/complaint-create-records';
