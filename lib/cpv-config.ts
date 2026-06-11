import { z } from 'zod';

const requiredText = z.string().trim().min(1, 'Required');
const finiteNumber = z.coerce.number().finite();
const statusField = z.enum(['Active', 'Inactive']).default('Active');

export const CPV_CONFIG_COLLECTIONS = {
  products: 'cpv_config_products',
  cppMaster: 'cpv_config_cpp_master',
  cqaMaster: 'cpv_config_cqa_master',
  limits: 'cpv_config_limit_master',
  controlLimits: 'cpv_config_control_limit_master',
  targets: 'cpv_config_target_master',
  sampling: 'cpv_config_sampling',
  alerts: 'cpv_config_alerts',
  review: 'cpv_config_review',
  workflow: 'cpv_config_workflow',
} as const;

export const productMasterSchema = z.object({
  productCode: requiredText,
  productName: requiredText,
  genericName: z.string().trim().optional().default(''),
  strength: z.string().trim().optional().default(''),
  dosageForm: z.string().trim().optional().default(''),
  status: statusField,
});

export const cppMasterSchema = z.object({
  productName: requiredText,
  parameterName: requiredText,
  processStage: z.string().trim().optional().default('Manufacturing'),
  target: finiteNumber,
  lsl: finiteNumber,
  usl: finiteNumber,
  unit: requiredText,
  samplingFrequency: z.string().trim().optional().default('Per Batch'),
  status: statusField,
});

export const cqaMasterSchema = z.object({
  productName: requiredText,
  testParameter: requiredText,
  target: finiteNumber,
  lsl: finiteNumber,
  usl: finiteNumber,
  unit: requiredText,
  parameterType: z.enum(['numeric', 'qualitative', 'limit']).default('numeric'),
  samplingFrequency: z.string().trim().optional().default('Per Batch'),
  status: statusField,
});

export const limitMasterSchema = z.object({
  productName: requiredText,
  parameterName: requiredText,
  parameterType: z.enum(['CPP', 'CQA']).default('CPP'),
  lsl: finiteNumber,
  usl: finiteNumber,
  unit: requiredText,
  effectiveDate: z.string().trim().optional().default(''),
  status: statusField,
});

export const controlLimitMasterSchema = z.object({
  productName: requiredText,
  parameterName: requiredText,
  centerLine: finiteNumber,
  ucl: finiteNumber,
  lcl: finiteNumber,
  chartType: z.enum(['I-MR', 'X-Bar-R', 'Both']).default('I-MR'),
  subgroupSize: z.coerce.number().int().min(2).max(10).default(4),
  status: statusField,
});

export const targetMasterSchema = z.object({
  productName: requiredText,
  parameterName: requiredText,
  parameterType: z.enum(['CPP', 'CQA']).default('CPP'),
  target: finiteNumber,
  unit: requiredText,
  effectiveDate: z.string().trim().optional().default(''),
  status: statusField,
});

export const samplingFrequencySchema = z.object({
  productName: requiredText,
  parameterName: requiredText,
  module: z.enum(['CPP', 'CQA']).default('CPP'),
  frequency: z.enum(['Per Batch', 'Daily', 'Weekly', 'Monthly', 'Quarterly']).default('Per Batch'),
  sampleSize: z.coerce.number().int().min(1).default(1),
  status: statusField,
});

export const alertThresholdSchema = z.object({
  productName: requiredText,
  parameterName: requiredText,
  module: z.enum(['CPP', 'CQA']).default('CPP'),
  ootWarningPercent: z.coerce.number().min(0).max(100).default(10),
  cpkMinimum: z.coerce.number().min(0).default(1.0),
  notifyRoles: z.string().trim().optional().default('qa,qc'),
  status: statusField,
});

export const reviewFrequencySchema = z.object({
  module: z.enum(['CPP', 'CQA', 'CPV', 'Risk', 'Annual Review']).default('CPV'),
  productName: z.string().trim().optional().default('All Products'),
  frequency: z.enum(['Monthly', 'Quarterly', 'Semi-Annual', 'Annual']).default('Annual'),
  nextReviewDate: z.string().trim().optional().default(''),
  status: statusField,
});

export const approvalWorkflowSchema = z.object({
  module: z.enum(['CPP', 'CQA', 'CPV', 'Risk', 'Annual Review']).default('CPV'),
  stepOrder: z.coerce.number().int().min(1).default(1),
  designation: requiredText,
  role: requiredText,
  eSignRequired: z.boolean().default(true),
  status: statusField,
});

export type ProductMaster = z.infer<typeof productMasterSchema> & { id?: string };
export type CppMaster = z.infer<typeof cppMasterSchema> & { id?: string };
export type CqaMaster = z.infer<typeof cqaMasterSchema> & { id?: string };
export type LimitMaster = z.infer<typeof limitMasterSchema> & { id?: string };
export type ControlLimitMaster = z.infer<typeof controlLimitMasterSchema> & { id?: string };
export type TargetMaster = z.infer<typeof targetMasterSchema> & { id?: string };
export type SamplingFrequency = z.infer<typeof samplingFrequencySchema> & { id?: string };
export type AlertThreshold = z.infer<typeof alertThresholdSchema> & { id?: string };
export type ReviewFrequency = z.infer<typeof reviewFrequencySchema> & { id?: string };
export type ApprovalWorkflow = z.infer<typeof approvalWorkflowSchema> & { id?: string };

export interface CpvConfigBundle {
  products: ProductMaster[];
  cppMaster: CppMaster[];
  cqaMaster: CqaMaster[];
  limits: LimitMaster[];
  controlLimits: ControlLimitMaster[];
  targets: TargetMaster[];
  sampling: SamplingFrequency[];
  alerts: AlertThreshold[];
  review: ReviewFrequency[];
  workflow: ApprovalWorkflow[];
}

export interface ParameterSpecResolved {
  target: number;
  lsl: number;
  usl: number;
  unit: string;
  samplingFrequency?: string;
  source: 'config' | 'default';
}

export type ConfigTabId =
  | 'products'
  | 'cpp'
  | 'cqa'
  | 'limits'
  | 'control'
  | 'targets'
  | 'sampling'
  | 'alerts'
  | 'review'
  | 'workflow';

export const CONFIG_TABS: Array<{ id: ConfigTabId; label: string; description: string }> = [
  { id: 'products', label: 'Product Master', description: 'Products under CPV scope' },
  { id: 'cpp', label: 'CPP Master', description: 'Critical process parameters per product' },
  { id: 'cqa', label: 'CQA Master', description: 'Critical quality attributes per product' },
  { id: 'limits', label: 'Limit Master', description: 'LSL / USL specification limits' },
  { id: 'control', label: 'Control Limit Master', description: 'SPC UCL / CL / LCL' },
  { id: 'targets', label: 'Target Value Master', description: 'Target values per parameter' },
  { id: 'sampling', label: 'Sampling Frequency', description: 'When and how often to sample' },
  { id: 'alerts', label: 'Alert Threshold', description: 'OOT warning and Cpk alert levels' },
  { id: 'review', label: 'Review Frequency', description: 'Scheduled CPV review cycles' },
  { id: 'workflow', label: 'Approval Workflow', description: 'Multi-step approval chain' },
];

export const SAMPLING_OPTIONS = ['Per Batch', 'Daily', 'Weekly', 'Monthly', 'Quarterly'] as const;
export const REVIEW_OPTIONS = ['Monthly', 'Quarterly', 'Semi-Annual', 'Annual'] as const;
export const MODULE_OPTIONS = ['CPP', 'CQA', 'CPV', 'Risk', 'Annual Review'] as const;
