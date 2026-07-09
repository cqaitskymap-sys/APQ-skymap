import { z } from 'zod';

export const CPV_CONFIGURATION_MODULE = 'CPV Configuration';

export const CPV_CONFIG_COLLECTIONS = {
  main: 'cpv_configuration',
  products: 'cpv_products',
  parameters: 'parameters',
  cppParameters: 'cpp_parameters',
  cqaParameters: 'cqa_parameters',
  reviewFrequency: 'cpv_review_frequency',
  limitRules: 'cpv_limit_rules',
  alertRules: 'cpv_alert_rules',
  reportTemplates: 'cpv_report_templates',
  workflows: 'cpv_workflows',
  integrationMapping: 'cpv_integration_mapping',
} as const;

export const LEGACY_CONFIG_COLLECTIONS = {
  products: 'cpv_config_products',
  cppMaster: 'cpv_config_cpp_master',
  cqaMaster: 'cpv_config_cqa_master',
  limits: 'cpv_config_limit_master',
  review: 'cpv_config_review',
  workflow: 'cpv_config_workflow',
} as const;

export const REVIEW_FREQUENCY_OPTIONS = ['Monthly', 'Quarterly', 'Half Yearly', 'Yearly'] as const;
export const STATUS_OPTIONS = ['Active', 'Inactive'] as const;
export const REVIEW_MODULE_OPTIONS = ['CPP', 'CQA', 'Yield', 'Stability', 'Risk', 'Annual CPV Review'] as const;
export const CRITICALITY_OPTIONS = ['Low', 'Medium', 'High', 'Critical'] as const;
export const RESULT_TYPE_OPTIONS = ['Numeric', 'Qualitative', 'Limit'] as const;
export const RISK_METHOD_OPTIONS = ['RPN', 'Matrix', 'Qualitative'] as const;
export const CHART_TYPE_OPTIONS = ['Individuals Chart', 'X-Bar R Chart', 'X-Bar S Chart', 'P Chart', 'NP Chart'] as const;

export const ANNUAL_REVIEW_SECTIONS = [
  'Product Summary', 'Batch Summary', 'CPP Review', 'CQA Review', 'Material Review',
  'Packing Review', 'Utility Review', 'Environmental Review', 'Yield Review',
  'Stability Review', 'Hold Time Review', 'Process Capability', 'Trend Analysis',
  'SPC Review', 'Risk Assessment', 'Deviation Review', 'OOS Review', 'CAPA Review',
  'Change Control Review', 'Conclusion', 'Approval',
] as const;

export type ConfigurationSectionId =
  | 'general'
  | 'product'
  | 'cpp'
  | 'cqa'
  | 'limits'
  | 'review-frequency'
  | 'alert-rules'
  | 'capability'
  | 'spc'
  | 'risk'
  | 'annual-template'
  | 'workflow'
  | 'data-source'
  | 'export';

export const CONFIGURATION_SECTIONS: Array<{
  id: ConfigurationSectionId;
  label: string;
  description: string;
  collection?: keyof typeof CPV_CONFIG_COLLECTIONS;
  singleton?: boolean;
}> = [
  { id: 'general', label: 'General CPV Settings', description: 'Global CPV automation and review defaults', singleton: true },
  { id: 'product', label: 'Product CPV Settings', description: 'Product-level CPV scope and ownership', collection: 'products' },
  { id: 'cpp', label: 'CPP Configuration', description: 'Critical process parameter limits and rules', collection: 'cppParameters' },
  { id: 'cqa', label: 'CQA Configuration', description: 'Critical quality attribute specifications', collection: 'cqaParameters' },
  { id: 'limits', label: 'Limit & Threshold Rules', description: 'Alert/action limits and trigger rules', collection: 'limitRules' },
  { id: 'review-frequency', label: 'Review Frequency', description: 'Module review schedules and escalation', collection: 'reviewFrequency' },
  { id: 'alert-rules', label: 'Alert Rule Configuration', description: 'Automated alert generation rules', collection: 'alertRules' },
  { id: 'capability', label: 'Process Capability Settings', description: 'Cpk thresholds and automation', singleton: true },
  { id: 'spc', label: 'SPC Settings', description: 'Control chart rules and automation', singleton: true },
  { id: 'risk', label: 'Risk Scoring Settings', description: 'RPN scales and CAPA triggers', singleton: true },
  { id: 'annual-template', label: 'Annual Review Template', description: 'Annual CPV review document structure', collection: 'reportTemplates' },
  { id: 'workflow', label: 'Approval Workflow Mapping', description: 'Module approval chains', collection: 'workflows' },
  { id: 'data-source', label: 'Data Source Mapping', description: 'CPV section to Firestore collection mapping', collection: 'integrationMapping' },
  { id: 'export', label: 'Export & Report Settings', description: 'PDF/Excel/CSV export options', singleton: true },
];

const requiredText = z.string().trim().min(1, 'Required');
const finiteNumber = z.coerce.number().finite();
const statusField = z.enum(STATUS_OPTIONS).default('Active');

const auditMetaSchema = z.object({
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  createdBy: z.string().optional(),
  updatedBy: z.string().optional(),
  isDeleted: z.boolean().optional(),
});

export const generalSettingsSchema = z.object({
  cpvEnabled: z.boolean().default(true),
  defaultReviewFrequency: z.enum(REVIEW_FREQUENCY_OPTIONS),
  defaultReviewPeriod: z.string().trim().optional().default('Calendar Year'),
  defaultProductOwnerRole: z.string().trim().default('production'),
  defaultQaReviewerRole: z.string().trim().default('qa'),
  defaultFinalApproverRole: z.string().trim().default('head_qa'),
  autoGenerateCpvReviewNumber: z.boolean().default(true),
  autoPullDataFromModules: z.boolean().default(true),
  autoCreateAlerts: z.boolean().default(true),
  autoCreateRiskRecords: z.boolean().default(true),
  autoSuggestCapa: z.boolean().default(true),
  requireESignatureForApproval: z.boolean().default(true),
  allowQaOverride: z.boolean().default(false),
  status: statusField,
}).merge(auditMetaSchema);

export const productCpvSettingsSchema = z.object({
  product: requiredText,
  productCode: z.string().trim().optional().default(''),
  cpvRequired: z.boolean().default(true),
  cpvStartDate: z.string().trim().optional().default(''),
  reviewFrequency: z.enum(REVIEW_FREQUENCY_OPTIONS).default('Yearly'),
  cpvOwner: z.string().trim().default('production'),
  qaReviewer: z.string().trim().default('qa'),
  finalApprover: z.string().trim().default('head_qa'),
  linkedCppParameters: z.string().trim().optional().default(''),
  linkedCqaParameters: z.string().trim().optional().default(''),
  linkedYieldParameters: z.string().trim().optional().default(''),
  linkedStabilityParameters: z.string().trim().optional().default(''),
  status: statusField,
}).merge(auditMetaSchema);

export const cppConfigurationSchema = z.object({
  parameterCode: requiredText,
  parameterName: requiredText,
  processStage: z.string().trim().default('Manufacturing'),
  targetValue: finiteNumber,
  lowerLimit: finiteNumber,
  upperLimit: finiteNumber,
  alertLimitLow: finiteNumber.optional().default(0),
  alertLimitHigh: finiteNumber.optional().default(0),
  actionLimitLow: finiteNumber.optional().default(0),
  actionLimitHigh: finiteNumber.optional().default(0),
  unit: requiredText,
  frequency: z.string().trim().default('Per Batch'),
  criticality: z.enum(CRITICALITY_OPTIONS).default('Medium'),
  autoDeviationRequired: z.boolean().default(false),
  autoCapaRequired: z.boolean().default(false),
  status: statusField,
}).merge(auditMetaSchema);

export const cqaConfigurationSchema = z.object({
  parameterCode: requiredText,
  parameterName: requiredText,
  testStage: z.string().trim().default('Finished Product Testing'),
  specificationNumber: z.string().trim().optional().default(''),
  stpNumber: z.string().trim().optional().default(''),
  targetValue: finiteNumber,
  lowerLimit: finiteNumber,
  upperLimit: finiteNumber,
  alertLimitLow: finiteNumber.optional().default(0),
  alertLimitHigh: finiteNumber.optional().default(0),
  actionLimitLow: finiteNumber.optional().default(0),
  actionLimitHigh: finiteNumber.optional().default(0),
  unit: requiredText,
  resultType: z.enum(RESULT_TYPE_OPTIONS).default('Numeric'),
  criticality: z.enum(CRITICALITY_OPTIONS).default('Medium'),
  oosRequired: z.boolean().default(true),
  autoCapaRequired: z.boolean().default(false),
  status: statusField,
}).merge(auditMetaSchema);

export const limitRuleSchema = z.object({
  ruleName: requiredText,
  parameterType: z.string().trim().default('CPP'),
  moduleName: z.string().trim().default('CPP Monitoring'),
  alertLimitPercent: finiteNumber.min(0).max(100).default(80),
  actionLimitPercent: finiteNumber.min(0).max(100).default(95),
  ootRule: z.string().trim().optional().default('Enabled'),
  oosRule: z.string().trim().optional().default('Enabled'),
  repeatedFailureCount: z.coerce.number().int().min(1).default(3),
  triggerDeviation: z.boolean().default(true),
  triggerOos: z.boolean().default(true),
  triggerCapa: z.boolean().default(false),
  status: statusField,
}).merge(auditMetaSchema);

export const reviewFrequencySchema = z.object({
  product: requiredText,
  moduleName: z.enum(REVIEW_MODULE_OPTIONS),
  reviewFrequency: z.enum(REVIEW_FREQUENCY_OPTIONS),
  dueDay: z.coerce.number().int().min(1).max(31).default(1),
  reminderBeforeDays: z.coerce.number().int().min(0).default(7),
  escalationAfterDays: z.coerce.number().int().min(0).default(3),
  responsibleRole: z.string().trim().default('qa'),
  reviewerRole: z.string().trim().default('head_qa'),
  status: statusField,
}).merge(auditMetaSchema);

export const alertRuleConfigSchema = z.object({
  ruleCode: requiredText,
  ruleName: requiredText,
  sourceModule: z.string().trim().default('CPP Monitoring'),
  condition: z.string().trim().default('Value Outside Limit'),
  priority: z.enum(['Low', 'Medium', 'High', 'Critical']).default('High'),
  severity: z.enum(['Information', 'Warning', 'Major', 'Critical']).default('Major'),
  notifyRole: z.string().trim().default('qa'),
  escalationRole: z.string().trim().default('head_qa'),
  autoCreateDeviation: z.boolean().default(false),
  autoCreateOos: z.boolean().default(false),
  autoSuggestCapa: z.boolean().default(false),
  status: statusField,
}).merge(auditMetaSchema);

export const capabilitySettingsSchema = z.object({
  minimumSampleCount: z.coerce.number().int().min(1).default(5),
  cpkExcellentLimit: finiteNumber.default(1.67),
  cpkAcceptableLimit: finiteNumber.default(1.33),
  cpkWarningLimit: finiteNumber.default(1.0),
  cpkCriticalLimit: finiteNumber.default(1.0),
  cpRequired: z.boolean().default(true),
  ppPpkRequired: z.boolean().default(false),
  autoRiskIfCpkBelow: finiteNumber.default(1.33),
  autoCapaIfCpkBelow: finiteNumber.default(1.0),
  status: statusField,
}).merge(auditMetaSchema);

export const spcSettingsSchema = z.object({
  defaultChartType: z.enum(CHART_TYPE_OPTIONS).default('Individuals Chart'),
  enableRule1OutsideControlLimit: z.boolean().default(true),
  enableRule2SevenPointsSameSide: z.boolean().default(true),
  enableRule3SixIncreasingDecreasing: z.boolean().default(true),
  enableRule4TwoOfThreeNearLimit: z.boolean().default(true),
  enableAutoRiskCreation: z.boolean().default(true),
  enableCapaSuggestion: z.boolean().default(false),
  status: statusField,
}).merge(auditMetaSchema);

export const riskScoringSettingsSchema = z.object({
  riskMethod: z.enum(RISK_METHOD_OPTIONS).default('RPN'),
  severityScale: z.coerce.number().int().min(1).default(10),
  occurrenceScale: z.coerce.number().int().min(1).default(10),
  detectionScale: z.coerce.number().int().min(1).default(10),
  lowRiskMaxRpn: z.coerce.number().int().min(1).default(50),
  mediumRiskMaxRpn: z.coerce.number().int().min(1).default(100),
  highRiskMaxRpn: z.coerce.number().int().min(1).default(200),
  criticalRiskMinRpn: z.coerce.number().int().min(1).default(201),
  autoCapaForCriticalRisk: z.boolean().default(true),
  status: statusField,
}).merge(auditMetaSchema);

export const annualReviewTemplateSchema = z.object({
  templateName: requiredText,
  templateVersion: z.string().trim().default('1.0'),
  sectionsEnabled: z.array(z.string()).min(1, 'At least one section required'),
  defaultExecutiveSummaryText: z.string().trim().optional().default(''),
  defaultConclusionText: z.string().trim().optional().default(''),
  defaultRecommendationText: z.string().trim().optional().default(''),
  requireAllSectionsBeforeApproval: z.boolean().default(true),
  status: statusField,
}).merge(auditMetaSchema);

export const workflowMappingSchema = z.object({
  moduleName: requiredText,
  workflow: z.string().trim().default('Standard CPV Workflow'),
  approvalMatrix: z.string().trim().optional().default(''),
  eSignatureRequired: z.boolean().default(true),
  preparedByRole: z.string().trim().default('qa'),
  reviewedByRole: z.string().trim().default('qa_manager'),
  approvedByRole: z.string().trim().default('head_qa'),
  finalApproverRole: z.string().trim().default('head_qa'),
  status: statusField,
}).merge(auditMetaSchema);

export const dataSourceMappingSchema = z.object({
  cpvSection: requiredText,
  sourceCollection: requiredText,
  sourceFieldMapping: z.string().trim().optional().default(''),
  productField: z.string().trim().default('productName'),
  batchField: z.string().trim().default('batchNumber'),
  parameterField: z.string().trim().default('parameterName'),
  observedValueField: z.string().trim().default('observedValue'),
  dateField: z.string().trim().default('recordedDate'),
  statusField: z.string().trim().default('status'),
  riskField: z.string().trim().optional().default('riskLevel'),
  status: statusField,
}).merge(auditMetaSchema);

export const exportReportSettingsSchema = z.object({
  enablePdfExport: z.boolean().default(true),
  enableExcelExport: z.boolean().default(true),
  enableCsvExport: z.boolean().default(true),
  reportHeaderSource: z.string().trim().default('Company Site Master'),
  showCompanyLogo: z.boolean().default(true),
  showPageNumber: z.boolean().default(true),
  showRevisionNumber: z.boolean().default(true),
  showESignatureBlock: z.boolean().default(true),
  showAuditTrailSummary: z.boolean().default(true),
  status: statusField,
}).merge(auditMetaSchema);

export type GeneralSettings = z.infer<typeof generalSettingsSchema> & { id?: string };
export type ProductCpvSettings = z.infer<typeof productCpvSettingsSchema> & { id?: string };
export type CppConfiguration = z.infer<typeof cppConfigurationSchema> & { id?: string };
export type CqaConfiguration = z.infer<typeof cqaConfigurationSchema> & { id?: string };
export type LimitRule = z.infer<typeof limitRuleSchema> & { id?: string };
export type ReviewFrequencyConfig = z.infer<typeof reviewFrequencySchema> & { id?: string };
export type AlertRuleConfig = z.infer<typeof alertRuleConfigSchema> & { id?: string };
export type CapabilitySettings = z.infer<typeof capabilitySettingsSchema> & { id?: string };
export type SpcSettings = z.infer<typeof spcSettingsSchema> & { id?: string };
export type RiskScoringSettings = z.infer<typeof riskScoringSettingsSchema> & { id?: string };
export type AnnualReviewTemplate = z.infer<typeof annualReviewTemplateSchema> & { id?: string };
export type WorkflowMapping = z.infer<typeof workflowMappingSchema> & { id?: string };
export type DataSourceMapping = z.infer<typeof dataSourceMappingSchema> & { id?: string };
export type ExportReportSettings = z.infer<typeof exportReportSettingsSchema> & { id?: string };

export interface CpvConfigurationBundle {
  general: GeneralSettings | null;
  products: ProductCpvSettings[];
  cppParameters: CppConfiguration[];
  cqaParameters: CqaConfiguration[];
  limitRules: LimitRule[];
  reviewFrequency: ReviewFrequencyConfig[];
  alertRules: AlertRuleConfig[];
  capability: CapabilitySettings | null;
  spc: SpcSettings | null;
  risk: RiskScoringSettings | null;
  annualTemplates: AnnualReviewTemplate[];
  workflows: WorkflowMapping[];
  dataSourceMappings: DataSourceMapping[];
  exportSettings: ExportReportSettings | null;
}

export interface ConfigurationValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  completenessPct: number;
}

export const DEFAULT_GENERAL_SETTINGS: Omit<GeneralSettings, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy' | 'isDeleted'> = {
  cpvEnabled: true,
  defaultReviewFrequency: 'Yearly',
  defaultReviewPeriod: 'Calendar Year',
  defaultProductOwnerRole: 'production',
  defaultQaReviewerRole: 'qa',
  defaultFinalApproverRole: 'head_qa',
  autoGenerateCpvReviewNumber: true,
  autoPullDataFromModules: true,
  autoCreateAlerts: true,
  autoCreateRiskRecords: true,
  autoSuggestCapa: true,
  requireESignatureForApproval: true,
  allowQaOverride: false,
  status: 'Active',
};

export const DEFAULT_CAPABILITY_SETTINGS: Omit<CapabilitySettings, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy' | 'isDeleted'> = {
  minimumSampleCount: 5,
  cpkExcellentLimit: 1.67,
  cpkAcceptableLimit: 1.33,
  cpkWarningLimit: 1.0,
  cpkCriticalLimit: 1.0,
  cpRequired: true,
  ppPpkRequired: false,
  autoRiskIfCpkBelow: 1.33,
  autoCapaIfCpkBelow: 1.0,
  status: 'Active',
};

export const DEFAULT_SPC_SETTINGS: Omit<SpcSettings, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy' | 'isDeleted'> = {
  defaultChartType: 'Individuals Chart',
  enableRule1OutsideControlLimit: true,
  enableRule2SevenPointsSameSide: true,
  enableRule3SixIncreasingDecreasing: true,
  enableRule4TwoOfThreeNearLimit: true,
  enableAutoRiskCreation: true,
  enableCapaSuggestion: false,
  status: 'Active',
};

export const DEFAULT_RISK_SETTINGS: Omit<RiskScoringSettings, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy' | 'isDeleted'> = {
  riskMethod: 'RPN',
  severityScale: 10,
  occurrenceScale: 10,
  detectionScale: 10,
  lowRiskMaxRpn: 50,
  mediumRiskMaxRpn: 100,
  highRiskMaxRpn: 200,
  criticalRiskMinRpn: 201,
  autoCapaForCriticalRisk: true,
  status: 'Active',
};

export const DEFAULT_EXPORT_SETTINGS: Omit<ExportReportSettings, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy' | 'isDeleted'> = {
  enablePdfExport: true,
  enableExcelExport: true,
  enableCsvExport: true,
  reportHeaderSource: 'Company Site Master',
  showCompanyLogo: true,
  showPageNumber: true,
  showRevisionNumber: true,
  showESignatureBlock: true,
  showAuditTrailSummary: true,
  status: 'Active',
};

export const DEFAULT_LIMIT_RULES: Omit<LimitRule, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy' | 'isDeleted'>[] = [
  {
    ruleName: 'Default Alert Limit',
    parameterType: 'All',
    moduleName: 'All Modules',
    alertLimitPercent: 80,
    actionLimitPercent: 95,
    ootRule: 'Enabled',
    oosRule: 'Enabled',
    repeatedFailureCount: 3,
    triggerDeviation: true,
    triggerOos: true,
    triggerCapa: false,
    status: 'Active',
  },
  {
    ruleName: 'Cpk Alert Threshold',
    parameterType: 'Capability',
    moduleName: 'Process Capability',
    alertLimitPercent: 0,
    actionLimitPercent: 0,
    ootRule: 'Cpk < 1.33',
    oosRule: 'Cpk < 1.00',
    repeatedFailureCount: 3,
    triggerDeviation: false,
    triggerOos: false,
    triggerCapa: true,
    status: 'Active',
  },
];

export const DEFAULT_DATA_SOURCE_MAPPINGS: Omit<DataSourceMapping, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy' | 'isDeleted'>[] = [
  { cpvSection: 'CPP Review', sourceCollection: 'cpp_results', sourceFieldMapping: '', productField: 'productName', batchField: 'batchNumber', parameterField: 'parameterName', observedValueField: 'observedValue', dateField: 'recordedDate', statusField: 'status', riskField: 'riskLevel', status: 'Active' },
  { cpvSection: 'CQA Review', sourceCollection: 'cqa_results', sourceFieldMapping: '', productField: 'productName', batchField: 'batchNumber', parameterField: 'testParameter', observedValueField: 'resultValue', dateField: 'testDate', statusField: 'status', riskField: 'riskLevel', status: 'Active' },
  { cpvSection: 'Yield Review', sourceCollection: 'yield_monitoring', sourceFieldMapping: '', productField: 'productName', batchField: 'batchNumber', parameterField: 'stage', observedValueField: 'yieldPercent', dateField: 'recordedDate', statusField: 'status', riskField: 'riskLevel', status: 'Active' },
  { cpvSection: 'Risk Review', sourceCollection: 'risk_assessment', sourceFieldMapping: '', productField: 'productName', batchField: 'batchNumber', parameterField: 'riskTitle', observedValueField: 'rpn', dateField: 'assessmentDate', statusField: 'status', riskField: 'riskLevel', status: 'Active' },
  { cpvSection: 'Annual CPV Review', sourceCollection: 'cpv_reviews', sourceFieldMapping: '', productField: 'productName', batchField: 'batchNumber', parameterField: 'reviewSection', observedValueField: 'complianceScore', dateField: 'reviewDate', statusField: 'status', riskField: 'riskLevel', status: 'Active' },
];

export const DEFAULT_ANNUAL_TEMPLATE: Omit<AnnualReviewTemplate, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy' | 'isDeleted'> = {
  templateName: 'Standard Annual CPV Review',
  templateVersion: '1.0',
  sectionsEnabled: [...ANNUAL_REVIEW_SECTIONS],
  defaultExecutiveSummaryText: 'This annual CPV review summarizes process performance, quality attributes, and risk for the review period.',
  defaultConclusionText: 'Based on the data reviewed, the process remains in a state of control.',
  defaultRecommendationText: 'Continue routine CPV monitoring and address identified gaps through the quality system.',
  requireAllSectionsBeforeApproval: true,
  status: 'Active',
};

export function summarizeConfiguration(bundle: CpvConfigurationBundle) {
  const listCounts = [
    bundle.products.length,
    bundle.cppParameters.length,
    bundle.cqaParameters.length,
    bundle.limitRules.length,
    bundle.reviewFrequency.length,
    bundle.alertRules.length,
    bundle.annualTemplates.length,
    bundle.workflows.length,
    bundle.dataSourceMappings.length,
  ];
  const singletonCount = [bundle.general, bundle.capability, bundle.spc, bundle.risk, bundle.exportSettings].filter(Boolean).length;
  const totalRecords = listCounts.reduce((a, b) => a + b, 0) + singletonCount;
  const activeSections = CONFIGURATION_SECTIONS.filter((section) => {
    if (section.singleton) {
      const key = section.id === 'general' ? bundle.general
        : section.id === 'capability' ? bundle.capability
          : section.id === 'spc' ? bundle.spc
            : section.id === 'risk' ? bundle.risk
              : bundle.exportSettings;
      return Boolean(key);
    }
    const map: Partial<Record<ConfigurationSectionId, unknown[]>> = {
      product: bundle.products,
      cpp: bundle.cppParameters,
      cqa: bundle.cqaParameters,
      limits: bundle.limitRules,
      'review-frequency': bundle.reviewFrequency,
      'alert-rules': bundle.alertRules,
      'annual-template': bundle.annualTemplates,
      workflow: bundle.workflows,
      'data-source': bundle.dataSourceMappings,
    };
    return (map[section.id]?.length || 0) > 0;
  }).length;
  return { totalRecords, activeSections, sectionCount: CONFIGURATION_SECTIONS.length };
}

export function validateConfiguration(bundle: CpvConfigurationBundle): ConfigurationValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!bundle.general?.cpvEnabled && bundle.general?.cpvEnabled !== false) {
    errors.push('General CPV settings are missing.');
  } else if (!bundle.general?.defaultReviewFrequency) {
    errors.push('Default Review Frequency is required.');
  }

  if (bundle.capability && bundle.capability.minimumSampleCount < 1) {
    errors.push('Minimum sample count must be at least 1.');
  }

  if (bundle.annualTemplates.some((t) => !t.sectionsEnabled?.length)) {
    errors.push('Annual review template must include at least one section.');
  }

  if (!bundle.dataSourceMappings.some((m) => m.cpvSection === 'Annual CPV Review' && m.status === 'Active')) {
    errors.push('Data source mapping for Annual CPV Review is required.');
  }

  if (!bundle.cppParameters.length) warnings.push('No CPP parameters configured.');
  if (!bundle.cqaParameters.length) warnings.push('No CQA parameters configured.');
  if (!bundle.limitRules.length) warnings.push('No limit/threshold rules configured.');
  if (!bundle.alertRules.length) warnings.push('No alert rules configured.');

  const checks = [
    Boolean(bundle.general),
    bundle.products.length > 0,
    bundle.cppParameters.length > 0,
    bundle.cqaParameters.length > 0,
    bundle.limitRules.length > 0,
    bundle.reviewFrequency.length > 0,
    bundle.alertRules.length > 0,
    Boolean(bundle.capability),
    Boolean(bundle.spc),
    Boolean(bundle.risk),
    bundle.annualTemplates.length > 0,
    bundle.workflows.length > 0,
    bundle.dataSourceMappings.length > 0,
    Boolean(bundle.exportSettings),
  ];
  const completenessPct = Math.round((checks.filter(Boolean).length / checks.length) * 100);

  return { valid: errors.length === 0, errors, warnings, completenessPct };
}

export function canViewCpvConfiguration(role?: string): boolean {
  return [
    'super_admin', 'admin', 'qa', 'head_qa', 'qa_manager', 'auditor', 'viewer',
  ].includes(role || '');
}

export function canEditCpvConfiguration(role?: string): boolean {
  return ['super_admin', 'admin'].includes(role || '');
}

export function canSuggestCpvConfiguration(role?: string): boolean {
  return ['qa', 'head_qa', 'qa_manager'].includes(role || '');
}

export function canApproveCpvConfiguration(role?: string): boolean {
  return ['super_admin', 'head_qa'].includes(role || '');
}

export function canImportExportCpvConfiguration(role?: string): boolean {
  return ['super_admin', 'admin'].includes(role || '');
}

export function isCpvConfigurationViewOnly(role?: string): boolean {
  return ['auditor', 'viewer'].includes(role || '');
}
