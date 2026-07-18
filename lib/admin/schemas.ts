import { z } from 'zod';
import {
  ADMIN_MODULES, PERMISSION_ACTIONS, PARAMETER_TYPES, RESULT_TYPES,
  USER_STATUSES, RECORD_STATUSES, NOTIFICATION_EVENTS, SIGNATURE_MEANINGS,
  BACKUP_STATUSES, LOGIN_STATUSES, ACCESS_REVIEW_STATUSES, TEMPLATE_TYPES,
  ROLE_MATRIX_MODULES, ROLE_MATRIX_ACTIONS, DEPARTMENT_TYPES, DESIGNATION_LEVELS,
  SITE_TYPES, DATE_FORMATS, TIME_FORMATS, CURRENCY_OPTIONS, TIMEZONE_OPTIONS,
  DOSAGE_FORMS, ROUTE_OPTIONS, MARKET_OPTIONS, PRODUCT_STATUSES,
  INGREDIENT_TYPES, PACKING_MATERIAL_TYPES, PRODUCT_ATTACHMENT_TYPES,
  BATCH_STATUSES, RELEASE_STATUSES, BATCH_SIZE_UNITS,
  PARAMETER_CATEGORIES, PROCESS_STAGES, CRITICALITY_OPTIONS, FREQUENCY_OPTIONS,
  WORKFLOW_MODULE_OPTIONS, WORKFLOW_TYPES, WORKFLOW_STEP_TYPES, APPROVAL_WORKFLOW_TYPES,
  APPROVAL_MATRIX_MODULES, RISK_LEVELS,
  DOCUMENT_NUMBERING_MODULES, DOCUMENT_TYPE_OPTIONS,
  NUMBERING_YEAR_FORMATS, NUMBERING_MONTH_FORMATS, NUMBERING_SEPARATOR_OPTIONS,
  NUMBERING_RESET_FREQUENCIES, REVISION_FORMAT_OPTIONS, FORMAT_TOKENS,
  AUDIT_TRAIL_MODULES, AUDIT_ACTION_TYPES, AUDIT_LOG_STATUSES,
  ESIGN_SETTING_MODULES, ESIGN_ACTION_TYPES, ESIGN_SIGNATURE_MEANINGS,
  NOTIFICATION_MODULES, NOTIFICATION_EVENT_TRIGGERS, NOTIFICATION_CHANNEL_TYPES,
  NOTIFICATION_PRIORITIES, REMINDER_FREQUENCIES,
  BACKUP_TYPES, BACKUP_SCOPES, BACKUP_FREQUENCIES,
  RESTORE_TYPES, RESTORE_STATUSES, BACKUP_EXPORT_COLLECTIONS,
  SYSTEM_ENVIRONMENTS, FINANCIAL_YEAR_MONTHS, SIDEBAR_MODES, LOGO_DISPLAY_MODES,
} from './constants';

const baseFields = {
  id: z.string().optional(),
  createdBy: z.string().default(''),
  createdAt: z.string().optional(),
  updatedBy: z.string().default(''),
  updatedAt: z.string().optional(),
  status: z.enum(RECORD_STATUSES).default('Active'),
};

const phoneSchema = z.string()
  .regex(/^$|^\+?[\d\s\-()]{10,15}$/, 'Enter a valid phone number (10–15 digits)')
  .default('');

export const adminUserSchema = z.object({
  ...baseFields,
  userId: z.string().optional(),
  employeeId: z.string().trim().min(1, 'Employee ID is required').max(80),
  employeeCode: z.string().trim().max(80).default(''),
  firstName: z.string().trim().max(100).default(''),
  middleName: z.string().trim().max(100).default(''),
  lastName: z.string().trim().max(100).default(''),
  fullName: z.string().trim().min(1, 'Full name is required').max(200),
  email: z.string().trim().min(1, 'Email is required').email('Valid email required').max(320),
  mobileNumber: phoneSchema,
  alternateMobile: phoneSchema,
  username: z.string()
    .trim()
    .max(80)
    .regex(/^$|^[a-zA-Z0-9._-]+$/, 'Username may contain letters, numbers, dots, underscores, and hyphens')
    .default(''),
  department: z.string().trim().min(1, 'Department is required').max(160),
  designation: z.string().trim().max(160).default(''),
  role: z.string().trim().min(1, 'Role is required').max(80),
  reportingManager: z.string().trim().max(200).default(''),
  managerId: z.string().trim().max(128).default(''),
  businessUnit: z.string().trim().max(160).default(''),
  siteId: z.string().trim().max(128).default(''),
  siteName: z.string().trim().max(200).default(''),
  location: z.string().trim().max(240).default(''),
  shift: z.string().trim().max(80).default(''),
  employmentType: z.enum(['Permanent', 'Contract', 'Temporary', 'Consultant', 'Vendor', 'Intern']).default('Permanent'),
  gender: z.enum(['', 'Female', 'Male', 'Non-binary', 'Prefer not to say']).default(''),
  dateOfBirth: z.string().default(''),
  userStatus: z.enum(USER_STATUSES).or(z.literal('Pending Approval')).default('Active'),
  statusBeforeLock: z.enum(['Active', 'Inactive', 'Suspended', 'Pending Approval']).optional(),
  accountLocked: z.boolean().default(false),
  profilePhoto: z.string()
    .url('Profile picture must be a valid URL')
    .refine((value) => value.startsWith('https://'), 'Profile picture URL must use HTTPS')
    .or(z.literal(''))
    .default(''),
  joiningDate: z.string().default(''),
  remarks: z.string().trim().max(2000).default(''),
  passwordResetRequired: z.boolean().default(false),
  twoFactorEnabled: z.boolean().default(false),
  lastLogin: z.string().nullable().default(null),
  emailVerified: z.boolean().default(false),
  authUid: z.string().optional(),
  isDeleted: z.boolean().optional(),
}).refine(
  (data) => !data.dateOfBirth || data.dateOfBirth < new Date().toISOString().slice(0, 10),
  { message: 'Date of birth must be in the past', path: ['dateOfBirth'] },
).refine(
  (data) => !data.managerId || data.managerId !== data.id && data.managerId !== data.authUid,
  { message: 'A user cannot report to themselves', path: ['managerId'] },
);

export const adminUserCreateSchema = adminUserSchema.and(z.object({
  temporaryPassword: z.string()
    .min(12, 'Password must be at least 12 characters')
    .max(128)
    .regex(/[A-Z]/, 'Password must include an uppercase letter')
    .regex(/[a-z]/, 'Password must include a lowercase letter')
    .regex(/\d/, 'Password must include a number')
    .regex(/[^A-Za-z0-9]/, 'Password must include a special character')
    .optional(),
}));

const matrixPermissionsSchema = z.record(
  z.string(),
  z.record(z.string(), z.boolean()),
);

export const roleSchema = z.object({
  ...baseFields,
  roleId: z.string().min(1, 'Role ID is required'),
  roleName: z.string().min(1, 'Role name is required'),
  roleDescription: z.string().default(''),
  description: z.string().default(''),
  roleLevel: z.coerce.number().min(1).max(100).default(10),
  level: z.coerce.number().min(1).max(100).default(10),
  departmentAccess: z.string().default(''),
  isDeleted: z.boolean().optional(),
});

export const permissionMatrixSchema = z.object({
  ...baseFields,
  roleId: z.string().min(1),
  roleName: z.string().min(1),
  permissions: matrixPermissionsSchema,
});

export const roleFormSchema = z.object({
  roleId: z.string().min(1, 'Role ID is required'),
  roleName: z.string().min(1, 'Role name is required'),
  roleDescription: z.string().default(''),
  roleLevel: z.coerce.number().min(1).max(100).default(10),
  departmentAccess: z.string().default(''),
  status: z.enum(RECORD_STATUSES).default('Active'),
  permissions: matrixPermissionsSchema,
}).refine(
  (data) => Object.values(data.permissions).some((mod) => Object.values(mod).some(Boolean)),
  { message: 'At least one module permission is required', path: ['permissions'] },
);

export const departmentSchema = z.object({
  ...baseFields,
  departmentId: z.string().default(''),
  departmentCode: z.string().min(1, 'Department code is required'),
  departmentName: z.string().min(1, 'Department name is required'),
  departmentType: z.enum(DEPARTMENT_TYPES).default('Other'),
  departmentHead: z.string().default(''),
  hodEmail: z.string().email('Valid HOD email required').or(z.literal('')).default(''),
  siteLocation: z.string().default(''),
  description: z.string().default(''),
  isDeleted: z.boolean().optional(),
});

export const departmentFormSchema = z.object({
  departmentCode: z.string().min(1, 'Department code is required'),
  departmentName: z.string().min(1, 'Department name is required'),
  departmentType: z.enum(DEPARTMENT_TYPES, { required_error: 'Department type is required' }),
  departmentHead: z.string().min(1, 'Department head must be selected from active users'),
  hodEmail: z.string().email('Valid HOD email required').or(z.literal('')).default(''),
  siteLocation: z.string().default(''),
  description: z.string().default(''),
  status: z.enum(RECORD_STATUSES).default('Active'),
});

export const designationSchema = z.object({
  ...baseFields,
  designationId: z.string().default(''),
  designationCode: z.string().min(1, 'Designation code is required'),
  designationName: z.string().min(1, 'Designation name is required'),
  department: z.string().min(1, 'Department is required'),
  designationLevel: z.enum(DESIGNATION_LEVELS).default('Executive'),
  approvalLevel: z.coerce.number().min(1).max(10).default(1),
  approvalAuthority: z.boolean().default(false),
  canReview: z.boolean().default(false),
  canApprove: z.boolean().default(false),
  canESign: z.boolean().default(false),
  description: z.string().default(''),
  isDeleted: z.boolean().optional(),
});

export const designationFormSchema = z.object({
  designationCode: z.string().min(1, 'Designation code is required'),
  designationName: z.string().min(1, 'Designation name is required'),
  department: z.string().min(1, 'Department is required'),
  designationLevel: z.enum(DESIGNATION_LEVELS, { required_error: 'Designation level is required' }),
  approvalAuthority: z.boolean().default(false),
  canReview: z.boolean().default(false),
  canApprove: z.boolean().default(false),
  canESign: z.boolean().default(false),
  description: z.string().default(''),
  status: z.enum(RECORD_STATUSES).default('Active'),
});

export const companySiteSchema = z.object({
  ...baseFields,
  companyId: z.string().default(''),
  companyName: z.string().min(1, 'Company name is required'),
  companyCode: z.string().default(''),
  companyLogo: z.string().default(''),
  siteName: z.string().min(1, 'Site name is required'),
  siteCode: z.string().default(''),
  siteType: z.enum(SITE_TYPES).default('Manufacturing Plant'),
  plantName: z.string().default(''),
  plantCode: z.string().default(''),
  plantAddress: z.string().default(''),
  city: z.string().default(''),
  state: z.string().default(''),
  country: z.string().default(''),
  pinZipCode: z.string().default(''),
  gstNumber: z.string().default(''),
  gstNo: z.string().default(''),
  manufacturingLicenseNumber: z.string().default(''),
  drugLicenseNumber: z.string().default(''),
  licenseNo: z.string().default(''),
  contactPerson: z.string().default(''),
  contactEmail: z.string().email('Valid contact email required').or(z.literal('')).default(''),
  contactPhone: z.string().default(''),
  contactNumber: z.string().default(''),
  website: z.string().default(''),
  timezone: z.string().default('Asia/Kolkata'),
  defaultTimezone: z.string().default('Asia/Kolkata'),
  dateFormat: z.enum(DATE_FORMATS).default('DD/MM/YYYY'),
  timeFormat: z.enum(TIME_FORMATS).default('24h'),
  defaultCurrency: z.enum(CURRENCY_OPTIONS).default('INR'),
  documentHeaderFormat: z.string().default(''),
  documentFooterText: z.string().default(''),
  isDefault: z.boolean().default(false),
  isDeleted: z.boolean().optional(),
});

export const companySiteFormSchema = z.object({
  companyName: z.string().min(1, 'Company name is required'),
  companyCode: z.string().min(1, 'Company code is required'),
  siteName: z.string().min(1, 'Site name is required'),
  siteCode: z.string().min(1, 'Site code is required'),
  siteType: z.enum(SITE_TYPES).default('Manufacturing Plant'),
  plantName: z.string().default(''),
  plantCode: z.string().default(''),
  plantAddress: z.string().min(1, 'Plant address is required'),
  city: z.string().default(''),
  state: z.string().default(''),
  country: z.string().default(''),
  pinZipCode: z.string().default(''),
  gstNumber: z.string().default(''),
  manufacturingLicenseNumber: z.string().default(''),
  drugLicenseNumber: z.string().default(''),
  contactPerson: z.string().default(''),
  contactEmail: z.string().email('Valid contact email required').or(z.literal('')).default(''),
  contactPhone: z.string().default(''),
  website: z.string().default(''),
  timezone: z.string().default('Asia/Kolkata'),
  dateFormat: z.enum(DATE_FORMATS).default('DD/MM/YYYY'),
  timeFormat: z.enum(TIME_FORMATS).default('24h'),
  defaultCurrency: z.enum(CURRENCY_OPTIONS).default('INR'),
  documentHeaderFormat: z.string().default(''),
  documentFooterText: z.string().default(''),
  status: z.enum(RECORD_STATUSES).default('Active'),
  isDefault: z.boolean().default(false),
});

export const productCompositionRowSchema = z.object({
  id: z.string().optional(),
  ingredientName: z.string().min(1, 'Ingredient name required'),
  ingredientType: z.enum(INGREDIENT_TYPES),
  grade: z.string().default(''),
  quantity: z.coerce.number().positive('Quantity must be numeric'),
  unit: z.string().default(''),
  functionPurpose: z.string().default(''),
  specificationNo: z.string().default(''),
  stpNo: z.string().default(''),
});

export const productPackingRowSchema = z.object({
  id: z.string().optional(),
  packingMaterial: z.string().min(1, 'Packing material required'),
  materialType: z.enum(PACKING_MATERIAL_TYPES),
  packSize: z.string().default(''),
  quantity: z.coerce.number().min(0, 'Quantity must be numeric').default(0),
  unit: z.string().default(''),
  specificationNo: z.string().default(''),
  stpNo: z.string().default(''),
});

export const adminProductSchema = z.object({
  ...baseFields,
  productId: z.string().default(''),
  productCode: z.string().min(1, 'Product code is required'),
  productName: z.string().min(1, 'Product name is required'),
  genericName: z.string().default(''),
  brandName: z.string().default(''),
  strength: z.string().default(''),
  dosageForm: z.string().default(''),
  routeOfAdministration: z.string().default(''),
  packSize: z.string().default(''),
  market: z.string().default(''),
  therapeuticCategory: z.string().default(''),
  shelfLife: z.string().default(''),
  storageCondition: z.string().default(''),
  standardBatchSize: z.string().default(''),
  batchSize: z.string().default(''),
  manufacturingLicenseNo: z.string().default(''),
  manufacturingLicenseNumber: z.string().default(''),
  mfrNumber: z.string().default(''),
  bmrNumber: z.string().default(''),
  bprNumber: z.string().default(''),
  specificationNumber: z.string().default(''),
  stpNumber: z.string().default(''),
  productStatus: z.enum(PRODUCT_STATUSES).default('Active'),
  remarks: z.string().default(''),
  composition: z.string().default(''),
  packingStyle: z.string().default(''),
  isDeleted: z.boolean().optional(),
});

export const productFormSchema = z.object({
  productCode: z.string().min(1, 'Product code is required'),
  productName: z.string().min(1, 'Product name is required'),
  genericName: z.string().min(1, 'Generic name is required'),
  brandName: z.string().default(''),
  strength: z.string().min(1, 'Strength is required'),
  dosageForm: z.enum(DOSAGE_FORMS, { required_error: 'Dosage form is required' }),
  routeOfAdministration: z.string().default(''),
  packSize: z.string().default(''),
  market: z.enum(MARKET_OPTIONS).default('Domestic'),
  therapeuticCategory: z.string().default(''),
  shelfLife: z.string().min(1, 'Shelf life is required').refine((v) => /^\d+/.test(v.trim()), 'Shelf life must be numeric'),
  storageCondition: z.string().default(''),
  standardBatchSize: z.string().default(''),
  manufacturingLicenseNumber: z.string().default(''),
  mfrNumber: z.string().default(''),
  bmrNumber: z.string().default(''),
  bprNumber: z.string().default(''),
  specificationNumber: z.string().default(''),
  stpNumber: z.string().default(''),
  productStatus: z.enum(PRODUCT_STATUSES).default('Active'),
  remarks: z.string().default(''),
  compositions: z.array(productCompositionRowSchema).default([]),
  packingDetails: z.array(productPackingRowSchema).default([]),
}).refine(
  (data) => data.compositions.some((c) => c.ingredientType === 'API'),
  { message: 'At least one API ingredient is required', path: ['compositions'] },
);

export const productAttachmentSchema = z.object({
  id: z.string().optional(),
  productId: z.string(),
  fileName: z.string(),
  fileType: z.string(),
  fileSize: z.number(),
  attachmentType: z.enum(PRODUCT_ATTACHMENT_TYPES),
  storagePath: z.string(),
  downloadUrl: z.string(),
  uploadedBy: z.string().default(''),
  uploadedAt: z.string().optional(),
});

export const adminBatchSchema = z.object({
  ...baseFields,
  batchId: z.string().default(''),
  batchNumber: z.string().min(1, 'Batch number is required'),
  productCode: z.string().min(1, 'Product is required'),
  productName: z.string().default(''),
  genericName: z.string().default(''),
  strength: z.string().default(''),
  dosageForm: z.string().default(''),
  market: z.string().default(''),
  batchSize: z.string().default(''),
  batchSizeUnit: z.string().default(''),
  unit: z.string().default(''),
  manufacturingDate: z.string().default(''),
  expiryDate: z.string().default(''),
  manufacturingSite: z.string().default(''),
  manufacturingLine: z.string().default(''),
  lineNumber: z.string().default(''),
  shift: z.string().default(''),
  mfrNumber: z.string().default(''),
  bmrNumber: z.string().default(''),
  bprNumber: z.string().default(''),
  manufacturedFor: z.string().default(''),
  customerName: z.string().default(''),
  batchStatus: z.enum(BATCH_STATUSES).default('Planned'),
  releaseStatus: z.enum(RELEASE_STATUSES).default('Pending'),
  releaseDate: z.string().default(''),
  qaReleasedBy: z.string().default(''),
  semiFinishedBatchNumber: z.string().default(''),
  finishedProductBatchNumber: z.string().default(''),
  packingBatchNumber: z.string().default(''),
  statusChangeReason: z.string().default(''),
  remarks: z.string().default(''),
  isDeleted: z.boolean().optional(),
});

export const batchFormSchema = z.object({
  productCode: z.string().min(1, 'Product is required'),
  batchNumber: z.string().min(1, 'Batch number is required'),
  productName: z.string().default(''),
  genericName: z.string().default(''),
  strength: z.string().default(''),
  dosageForm: z.string().default(''),
  market: z.string().default(''),
  batchSize: z.coerce.number().positive('Batch size must be numeric'),
  batchSizeUnit: z.enum(BATCH_SIZE_UNITS).default('Vials'),
  manufacturingDate: z.string().min(1, 'Manufacturing date is required'),
  expiryDate: z.string().min(1, 'Expiry date is required'),
  manufacturingSite: z.string().default(''),
  manufacturingLine: z.string().default(''),
  shift: z.string().default(''),
  mfrNumber: z.string().default(''),
  bmrNumber: z.string().default(''),
  bprNumber: z.string().default(''),
  manufacturedFor: z.string().default(''),
  customerName: z.string().default(''),
  batchStatus: z.enum(BATCH_STATUSES).default('Planned'),
  releaseStatus: z.enum(RELEASE_STATUSES).default('Pending'),
  releaseDate: z.string().default(''),
  qaReleasedBy: z.string().default(''),
  semiFinishedBatchNumber: z.string().default(''),
  finishedProductBatchNumber: z.string().default(''),
  packingBatchNumber: z.string().default(''),
  statusChangeReason: z.string().default(''),
  remarks: z.string().default(''),
  qaOverride: z.boolean().optional(),
}).refine(
  (data) => !data.manufacturingDate || !data.expiryDate || data.expiryDate > data.manufacturingDate,
  { message: 'Expiry date must be after manufacturing date', path: ['expiryDate'] },
).refine(
  (data) => data.batchStatus !== 'Rejected' || data.statusChangeReason.trim().length > 0,
  { message: 'Rejection reason is required', path: ['statusChangeReason'] },
).refine(
  (data) => data.batchStatus !== 'Hold' || data.statusChangeReason.trim().length > 0,
  { message: 'Hold reason is required', path: ['statusChangeReason'] },
);

export const batchAttachmentSchema = z.object({
  id: z.string().optional(),
  batchId: z.string(),
  fileName: z.string(),
  fileType: z.string(),
  fileSize: z.number(),
  storagePath: z.string(),
  downloadUrl: z.string(),
  uploadedBy: z.string().default(''),
  uploadedAt: z.string().optional(),
});

export const parameterSchema = z.object({
  ...baseFields,
  parameterId: z.string().default(''),
  parameterCode: z.string().min(1, 'Parameter code is required'),
  parameterName: z.string().min(1, 'Parameter name is required'),
  parameterType: z.enum(PARAMETER_TYPES),
  parameterCategory: z.string().default(''),
  productLink: z.string().default(''),
  product: z.string().default(''),
  processStage: z.string().default(''),
  department: z.string().default(''),
  testMethodStp: z.string().default(''),
  specificationNo: z.string().default(''),
  targetValue: z.string().default(''),
  target: z.string().default(''),
  lowerLimit: z.string().default(''),
  lsl: z.string().default(''),
  upperLimit: z.string().default(''),
  usl: z.string().default(''),
  alertLimitLow: z.string().default(''),
  alertLimitHigh: z.string().default(''),
  actionLimitLow: z.string().default(''),
  actionLimitHigh: z.string().default(''),
  unit: z.string().default(''),
  resultType: z.enum(RESULT_TYPES),
  frequency: z.string().default(''),
  criticality: z.string().default(''),
  ootApplicable: z.boolean().default(false),
  oosApplicable: z.boolean().default(false),
  autoDeviationRequired: z.boolean().default(false),
  autoCapaRequired: z.boolean().default(false),
  remarks: z.string().default(''),
  isDeleted: z.boolean().optional(),
});

const numericLimit = (val: string) => val.trim() !== '' && !Number.isNaN(Number(val));

export const parameterFormSchema = z.object({
  parameterCode: z.string().min(1, 'Parameter code is required'),
  parameterName: z.string().min(1, 'Parameter name is required'),
  parameterType: z.enum(PARAMETER_TYPES),
  parameterCategory: z.enum(PARAMETER_CATEGORIES).default('Manufacturing'),
  productLink: z.string().default(''),
  processStage: z.enum(PROCESS_STAGES).default('Mixing'),
  department: z.string().default(''),
  testMethodStp: z.string().default(''),
  specificationNo: z.string().default(''),
  targetValue: z.string().default(''),
  lowerLimit: z.string().default(''),
  upperLimit: z.string().default(''),
  alertLimitLow: z.string().default(''),
  alertLimitHigh: z.string().default(''),
  actionLimitLow: z.string().default(''),
  actionLimitHigh: z.string().default(''),
  unit: z.string().default(''),
  resultType: z.enum(RESULT_TYPES),
  frequency: z.enum(FREQUENCY_OPTIONS).default('Per Batch'),
  criticality: z.enum(CRITICALITY_OPTIONS).default('Major'),
  ootApplicable: z.boolean().default(false),
  oosApplicable: z.boolean().default(false),
  autoDeviationRequired: z.boolean().default(false),
  autoCapaRequired: z.boolean().default(false),
  remarks: z.string().default(''),
}).refine(
  (data) => data.resultType !== 'Numeric' || data.unit.trim().length > 0,
  { message: 'Unit is required for numeric parameters', path: ['unit'] },
).refine(
  (data) => data.resultType !== 'Numeric' || (numericLimit(data.lowerLimit) && numericLimit(data.upperLimit)),
  { message: 'Lower and upper limits are required for numeric parameters', path: ['lowerLimit'] },
).refine(
  (data) => {
    if (data.resultType !== 'Numeric') return true;
    if (!numericLimit(data.lowerLimit) || !numericLimit(data.upperLimit)) return true;
    return Number(data.upperLimit) > Number(data.lowerLimit);
  },
  { message: 'Upper limit must be greater than lower limit', path: ['upperLimit'] },
).refine(
  (data) => {
    if (data.resultType !== 'Numeric' || !numericLimit(data.alertLimitLow)) return true;
    if (!numericLimit(data.lowerLimit)) return true;
    return Number(data.alertLimitLow) >= Number(data.lowerLimit);
  },
  { message: 'Alert limit low must be within specification limits', path: ['alertLimitLow'] },
).refine(
  (data) => {
    if (data.resultType !== 'Numeric' || !numericLimit(data.alertLimitHigh)) return true;
    if (!numericLimit(data.upperLimit)) return true;
    return Number(data.alertLimitHigh) <= Number(data.upperLimit);
  },
  { message: 'Alert limit high must be within specification limits', path: ['alertLimitHigh'] },
).refine(
  (data) => {
    if (data.resultType !== 'Numeric' || !numericLimit(data.actionLimitLow)) return true;
    if (!numericLimit(data.lowerLimit)) return true;
    return Number(data.actionLimitLow) >= Number(data.lowerLimit);
  },
  { message: 'Action limit low must be within specification limits', path: ['actionLimitLow'] },
).refine(
  (data) => {
    if (data.resultType !== 'Numeric' || !numericLimit(data.actionLimitHigh)) return true;
    if (!numericLimit(data.upperLimit)) return true;
    return Number(data.actionLimitHigh) <= Number(data.upperLimit);
  },
  { message: 'Action limit high must be within specification limits', path: ['actionLimitHigh'] },
);

export const workflowStepSchema = z.object({
  id: z.string().optional(),
  workflowId: z.string().optional(),
  stepNumber: z.coerce.number().min(1),
  stepName: z.string().min(1, 'Step name is required'),
  stepType: z.enum(WORKFLOW_STEP_TYPES),
  department: z.string().default(''),
  assignedRole: z.string().min(1, 'Assigned role is required'),
  assignedUser: z.string().default(''),
  isMandatory: z.boolean().default(true),
  canApprove: z.boolean().default(false),
  canReject: z.boolean().default(false),
  canSendBack: z.boolean().default(false),
  requireESignature: z.boolean().default(false),
  requireComment: z.boolean().default(false),
  dueDays: z.coerce.number().min(0).default(3),
  escalationRole: z.string().default(''),
  status: z.enum(RECORD_STATUSES).default('Active'),
  isDeleted: z.boolean().optional(),
});

export const workflowSchema = z.object({
  ...baseFields,
  workflowId: z.string().default(''),
  workflowCode: z.string().min(1, 'Workflow code is required'),
  workflowName: z.string().min(1, 'Workflow name is required'),
  moduleName: z.string().min(1, 'Module name is required'),
  department: z.string().default(''),
  workflowType: z.enum(WORKFLOW_TYPES).default('Multi Level Approval'),
  initiatorRole: z.string().default(''),
  reviewerRoles: z.string().default(''),
  approverRoles: z.string().default(''),
  reviewerRole: z.string().default(''),
  approverRole: z.string().default(''),
  finalApproverRole: z.string().default(''),
  escalationRole: z.string().default(''),
  approvalLevels: z.coerce.number().min(1).default(1),
  requireESignature: z.boolean().default(true),
  requireRemarks: z.boolean().default(true),
  allowRejection: z.boolean().default(true),
  allowResubmission: z.boolean().default(true),
  allowDelegation: z.boolean().default(false),
  autoEscalationEnabled: z.boolean().default(false),
  autoEscalationDays: z.coerce.number().min(0).default(3),
  escalationDays: z.coerce.number().min(0).default(3),
  targetCompletionDays: z.coerce.number().min(0).default(30),
  description: z.string().default(''),
  workflowChain: z.string().default(''),
  isDeleted: z.boolean().optional(),
});

export const workflowFormSchema = z.object({
  workflowCode: z.string().min(1, 'Workflow code is required'),
  workflowName: z.string().min(1, 'Workflow name is required'),
  moduleName: z.enum(WORKFLOW_MODULE_OPTIONS),
  department: z.string().default(''),
  workflowType: z.enum(WORKFLOW_TYPES),
  initiatorRole: z.string().default(''),
  reviewerRoles: z.string().default(''),
  approverRoles: z.string().default(''),
  finalApproverRole: z.string().default(''),
  escalationRole: z.string().default(''),
  approvalLevels: z.coerce.number().min(1).default(1),
  requireESignature: z.boolean().default(true),
  requireRemarks: z.boolean().default(true),
  allowRejection: z.boolean().default(true),
  allowResubmission: z.boolean().default(true),
  allowDelegation: z.boolean().default(false),
  autoEscalationEnabled: z.boolean().default(false),
  escalationDays: z.coerce.number().min(0).default(3),
  targetCompletionDays: z.coerce.number().min(0).default(30),
  description: z.string().default(''),
  steps: z.array(workflowStepSchema).min(1, 'At least one workflow step is required'),
}).refine(
  (data) => !APPROVAL_WORKFLOW_TYPES.includes(data.workflowType as typeof APPROVAL_WORKFLOW_TYPES[number])
    || data.finalApproverRole.trim().length > 0
    || data.steps.some((s) => s.stepType === 'Final Approve'),
  { message: 'Final approver is required for approval workflows', path: ['finalApproverRole'] },
);

export const approvalMatrixSchema = z.object({
  ...baseFields,
  approvalMatrixId: z.string().default(''),
  matrixId: z.string().default(''),
  matrixCode: z.string().min(1, 'Matrix code is required'),
  matrixName: z.string().min(1, 'Matrix name is required'),
  moduleName: z.string().min(1, 'Module is required'),
  module: z.string().default(''),
  department: z.string().min(1, 'Department is required'),
  siteLocation: z.string().default(''),
  productOptional: z.string().default(''),
  processOptional: z.string().default(''),
  riskLevel: z.enum(RISK_LEVELS).default('Medium'),
  preparedByRole: z.string().default(''),
  reviewedByRole: z.string().default(''),
  verifiedByRole: z.string().default(''),
  approvedByRole: z.string().default(''),
  finalApproverRole: z.string().default(''),
  escalationRole: z.string().default(''),
  level1Reviewer: z.string().default(''),
  level2Reviewer: z.string().default(''),
  finalApprover: z.string().default(''),
  minimumApprovalLevel: z.coerce.number().min(1).default(1),
  eSignatureRequired: z.boolean().default(true),
  eSignRequired: z.boolean().default(true),
  approvalCommentRequired: z.boolean().default(true),
  mandatoryRemarks: z.boolean().default(true),
  parallelApprovalAllowed: z.boolean().default(false),
  sequentialApprovalRequired: z.boolean().default(true),
  delegationAllowed: z.boolean().default(false),
  remarks: z.string().default(''),
  isDeleted: z.boolean().optional(),
});

export const approvalMatrixFormSchema = z.object({
  matrixCode: z.string().min(1, 'Matrix code is required'),
  matrixName: z.string().min(1, 'Matrix name is required'),
  moduleName: z.enum(APPROVAL_MATRIX_MODULES),
  department: z.string().min(1, 'Department is required'),
  siteLocation: z.string().default(''),
  productOptional: z.string().default(''),
  processOptional: z.string().default(''),
  riskLevel: z.enum(RISK_LEVELS).default('Medium'),
  preparedByRole: z.string().default(''),
  reviewedByRole: z.string().default(''),
  verifiedByRole: z.string().default(''),
  approvedByRole: z.string().default(''),
  finalApproverRole: z.string().default(''),
  escalationRole: z.string().default(''),
  minimumApprovalLevel: z.coerce.number().min(1).default(1),
  eSignatureRequired: z.boolean().default(true),
  approvalCommentRequired: z.boolean().default(true),
  parallelApprovalAllowed: z.boolean().default(false),
  sequentialApprovalRequired: z.boolean().default(true),
  delegationAllowed: z.boolean().default(false),
  remarks: z.string().default(''),
}).refine(
  (data) => {
    const hasApprover = data.finalApproverRole.trim() || data.approvedByRole.trim()
      || data.reviewedByRole.trim() || data.verifiedByRole.trim();
    return Boolean(hasApprover);
  },
  { message: 'At least one approver role is required', path: ['finalApproverRole'] },
).refine(
  (data) => data.riskLevel !== 'High' && data.riskLevel !== 'Critical'
    || data.finalApproverRole.trim().length > 0,
  { message: 'Final approver is required for High and Critical risk', path: ['finalApproverRole'] },
).refine(
  (data) => data.riskLevel !== 'Critical' || data.finalApproverRole === 'head_qa' || data.finalApproverRole.trim().length > 0,
  { message: 'Critical risk requires Head QA or configured final approver', path: ['finalApproverRole'] },
);

export const documentNumberingSchema = z.object({
  ...baseFields,
  numberingId: z.string().default(''),
  numberingCode: z.string().min(1, 'Numbering code is required'),
  moduleName: z.string().min(1, 'Module is required'),
  module: z.string().default(''),
  documentType: z.string().min(1, 'Document type is required'),
  prefix: z.string().min(1, 'Prefix is required'),
  siteCode: z.string().default(''),
  departmentCode: z.string().default(''),
  productCodeOptional: z.string().default(''),
  yearFormat: z.enum(NUMBERING_YEAR_FORMATS).default('YYYY'),
  monthFormat: z.enum(NUMBERING_MONTH_FORMATS).default('None'),
  separator: z.enum(NUMBERING_SEPARATOR_OPTIONS).default('/'),
  runningNumberLength: z.coerce.number().min(1).default(4),
  runningNumber: z.coerce.number().min(1).default(4),
  currentRunningNumber: z.coerce.number().min(0).default(0),
  currentNumber: z.coerce.number().min(0).default(0),
  resetFrequency: z.enum(NUMBERING_RESET_FREQUENCIES).default('Yearly'),
  revisionFormat: z.enum(REVISION_FORMAT_OPTIONS).default('00'),
  formatTokens: z.string().default('PREFIX,DEPARTMENT_CODE,RUNNING_NUMBER,YEAR'),
  exampleNumberPreview: z.string().default(''),
  exampleFormat: z.string().default(''),
  autoGenerateEnabled: z.boolean().default(true),
  manualOverrideAllowed: z.boolean().default(false),
  remarks: z.string().default(''),
  isDeleted: z.boolean().optional(),
});

export const documentNumberingFormSchema = z.object({
  numberingCode: z.string().min(1, 'Numbering code is required'),
  moduleName: z.enum(DOCUMENT_NUMBERING_MODULES),
  documentType: z.string().min(1, 'Document type is required'),
  prefix: z.string().min(1, 'Prefix is required'),
  siteCode: z.string().default(''),
  departmentCode: z.string().default(''),
  productCodeOptional: z.string().default(''),
  yearFormat: z.enum(NUMBERING_YEAR_FORMATS).default('YYYY'),
  monthFormat: z.enum(NUMBERING_MONTH_FORMATS).default('None'),
  separator: z.enum(NUMBERING_SEPARATOR_OPTIONS).default('/'),
  runningNumberLength: z.coerce.number().min(1, 'Running number length is required'),
  currentRunningNumber: z.coerce.number().min(0, 'Current running number is required'),
  resetFrequency: z.enum(NUMBERING_RESET_FREQUENCIES).default('Yearly'),
  revisionFormat: z.enum(REVISION_FORMAT_OPTIONS).default('00'),
  formatTokens: z.string().min(1, 'Format tokens are required'),
  autoGenerateEnabled: z.boolean().default(true),
  manualOverrideAllowed: z.boolean().default(false),
  remarks: z.string().default(''),
}).refine(
  (data) => data.resetFrequency !== 'Yearly' || data.formatTokens.includes('YEAR') || data.yearFormat === 'None',
  { message: 'Yearly reset should include YEAR token in format', path: ['formatTokens'] },
).refine(
  (data) => data.resetFrequency !== 'Monthly' || data.formatTokens.includes('MONTH') || data.monthFormat === 'None',
  { message: 'Monthly reset should include MONTH token in format', path: ['formatTokens'] },
);

export const auditLogSchema = z.object({
  id: z.string().optional(),
  dateTime: z.string(),
  userId: z.string().default(''),
  userName: z.string().default(''),
  module: z.string().default(''),
  recordId: z.string().default(''),
  action: z.string().default(''),
  oldValue: z.string().default(''),
  newValue: z.string().default(''),
  reason: z.string().default(''),
  ipAddress: z.string().default(''),
  device: z.string().default(''),
  status: z.string().default('Success'),
});

export const auditTrailEntrySchema = z.object({
  id: z.string().optional(),
  auditId: z.string().default(''),
  dateTime: z.string(),
  timestamp: z.string().optional(),
  moduleName: z.string().min(1),
  collectionName: z.string().default(''),
  recordId: z.string().default(''),
  documentId: z.string().optional(),
  documentNumber: z.string().default(''),
  actionType: z.string().min(1),
  action: z.string().optional(),
  actionDescription: z.string().default(''),
  fieldName: z.string().default(''),
  oldValue: z.union([z.string(), z.record(z.unknown())]).optional(),
  newValue: z.union([z.string(), z.record(z.unknown())]).optional(),
  changedByUserId: z.string().default(''),
  changedByUserName: z.string().default(''),
  changedByRole: z.string().default(''),
  userId: z.string().optional(),
  userName: z.string().optional(),
  department: z.string().default(''),
  reasonForChange: z.string().default(''),
  reason: z.string().optional(),
  ipAddress: z.string().default(''),
  deviceInfo: z.string().default(''),
  device: z.string().optional(),
  browserInfo: z.string().default(''),
  location: z.string().default(''),
  eSignatureRequired: z.boolean().default(false),
  eSignatureStatus: z.string().default(''),
  status: z.enum(AUDIT_LOG_STATUSES).default('Success'),
});

export const esignSettingsSchema = z.object({
  ...baseFields,
  esignSettingId: z.string().default(''),
  settingCode: z.string().min(1, 'Setting code is required'),
  moduleName: z.string().min(1, 'Module is required'),
  actionType: z.string().min(1, 'Action type is required'),
  signatureMeaning: z.string().min(1, 'Signature meaning is required'),
  requirePasswordReAuthentication: z.boolean().default(true),
  requirePasswordConfirmation: z.boolean().default(true),
  requireCommentReason: z.boolean().default(true),
  requireReason: z.boolean().default(true),
  requireRoleVerification: z.boolean().default(true),
  requireDepartmentVerification: z.boolean().default(false),
  requireActiveSession: z.boolean().default(true),
  sessionTimeoutMinutes: z.coerce.number().min(1).default(15),
  sessionTimeout: z.coerce.number().min(1).default(15),
  maxFailedEsignAttempts: z.coerce.number().min(1).default(3),
  lockAccountAfterFailedAttempts: z.boolean().default(true),
  allowDelegatedSignature: z.boolean().default(false),
  requireFinalApprovalSignature: z.boolean().default(false),
  showSignatureStatement: z.boolean().default(true),
  signatureStatementText: z.string().default(''),
  signatureMeanings: z.array(z.enum(SIGNATURE_MEANINGS)).default([...SIGNATURE_MEANINGS]),
  remarks: z.string().default(''),
  isDeleted: z.boolean().optional(),
});

export const esignSettingFormSchema = z.object({
  settingCode: z.string().min(1, 'Setting code is required'),
  moduleName: z.enum(ESIGN_SETTING_MODULES),
  actionType: z.enum(ESIGN_ACTION_TYPES),
  signatureMeaning: z.enum(ESIGN_SIGNATURE_MEANINGS),
  requirePasswordReAuthentication: z.boolean().default(true),
  requireCommentReason: z.boolean().default(true),
  requireRoleVerification: z.boolean().default(true),
  requireDepartmentVerification: z.boolean().default(false),
  requireActiveSession: z.boolean().default(true),
  sessionTimeoutMinutes: z.coerce.number().min(1).default(15),
  maxFailedEsignAttempts: z.coerce.number().min(1).default(3),
  lockAccountAfterFailedAttempts: z.boolean().default(true),
  allowDelegatedSignature: z.boolean().default(false),
  requireFinalApprovalSignature: z.boolean().default(false),
  showSignatureStatement: z.boolean().default(true),
  signatureStatementText: z.string().default(''),
  remarks: z.string().default(''),
});

export const esignRecordSchema = z.object({
  id: z.string().optional(),
  esignRecordId: z.string().default(''),
  moduleName: z.string().default(''),
  recordId: z.string().default(''),
  documentNumber: z.string().default(''),
  actionType: z.string().default(''),
  signatureMeaning: z.string().default(''),
  userId: z.string().default(''),
  userName: z.string().default(''),
  userEmail: z.string().default(''),
  userRole: z.string().default(''),
  department: z.string().default(''),
  signedDateTime: z.string().default(''),
  reasonComment: z.string().default(''),
  ipAddress: z.string().default(''),
  deviceInfo: z.string().default(''),
  authenticationStatus: z.string().default('Success'),
  status: z.string().default('Signed'),
  isTest: z.boolean().default(false),
});

export const notificationSettingSchema = z.object({
  ...baseFields,
  notificationSettingId: z.string().default(''),
  notificationCode: z.string().min(1, 'Notification code is required'),
  eventName: z.string().min(1, 'Event name is required'),
  moduleName: z.string().min(1, 'Module is required'),
  eventTrigger: z.string().min(1, 'Event trigger is required'),
  notificationType: z.enum(NOTIFICATION_CHANNEL_TYPES).default('In-App + Email'),
  recipientRole: z.string().default(''),
  recipientUserOptional: z.string().default(''),
  recipientDepartmentOptional: z.string().default(''),
  ccRoleOptional: z.string().default(''),
  escalationRole: z.string().default(''),
  notifyBeforeDueDays: z.coerce.number().min(0).default(3),
  beforeDueDays: z.coerce.number().min(0).default(3),
  escalationAfterDays: z.coerce.number().min(0).default(7),
  escalationDays: z.coerce.number().min(0).default(7),
  repeatReminder: z.boolean().default(false),
  reminderFrequency: z.enum(REMINDER_FREQUENCIES).default('None'),
  templateSubject: z.string().default(''),
  templateBody: z.string().default(''),
  template: z.string().default(''),
  priority: z.enum(NOTIFICATION_PRIORITIES).default('Medium'),
  enableInAppNotification: z.boolean().default(true),
  inAppEnabled: z.boolean().default(true),
  enableEmailNotification: z.boolean().default(true),
  emailEnabled: z.boolean().default(true),
  enableSmsNotification: z.boolean().default(false),
  smsEnabled: z.boolean().default(false),
  remarks: z.string().default(''),
  isDeleted: z.boolean().optional(),
});

export const notificationSettingFormSchema = z.object({
  notificationCode: z.string().min(1, 'Notification code is required'),
  eventName: z.string().min(1, 'Event name is required'),
  moduleName: z.enum(NOTIFICATION_MODULES),
  eventTrigger: z.enum(NOTIFICATION_EVENT_TRIGGERS),
  notificationType: z.enum(NOTIFICATION_CHANNEL_TYPES).default('In-App + Email'),
  recipientRole: z.string().default(''),
  recipientUserOptional: z.string().default(''),
  recipientDepartmentOptional: z.string().default(''),
  ccRoleOptional: z.string().default(''),
  escalationRole: z.string().default(''),
  notifyBeforeDueDays: z.coerce.number().min(0).default(3),
  escalationAfterDays: z.coerce.number().min(0).default(7),
  repeatReminder: z.boolean().default(false),
  reminderFrequency: z.enum(REMINDER_FREQUENCIES).default('None'),
  templateSubject: z.string().default(''),
  templateBody: z.string().min(1, 'Template body is required'),
  priority: z.enum(NOTIFICATION_PRIORITIES).default('Medium'),
  enableInAppNotification: z.boolean().default(true),
  enableEmailNotification: z.boolean().default(true),
  enableSmsNotification: z.boolean().default(false),
  remarks: z.string().default(''),
}).refine(
  (data) => data.recipientRole.trim() || data.recipientUserOptional.trim(),
  { message: 'Recipient role or user is required', path: ['recipientRole'] },
).refine(
  (data) => !data.enableEmailNotification || data.templateSubject.trim().length > 0,
  { message: 'Template subject is required for email notifications', path: ['templateSubject'] },
);

export const backupHistorySchema = z.object({
  ...baseFields,
  backupId: z.string().min(1),
  backupNumber: z.string().min(1, 'Backup number is required'),
  backupType: z.enum(BACKUP_TYPES),
  backupScope: z.enum(BACKUP_SCOPES),
  backupDateTime: z.string(),
  backupDate: z.string().optional(), // legacy
  backupStatus: z.enum(BACKUP_STATUSES).default('Pending'),
  fileName: z.string().default(''),
  fileSize: z.string().default(''),
  fileSizeBytes: z.coerce.number().min(0).default(0),
  storageLocation: z.string().default(''),
  filePath: z.string().default(''), // legacy
  collectionsIncluded: z.array(z.string()).default([]),
  recordsCount: z.coerce.number().min(0).default(0),
  backupFrequency: z.enum(BACKUP_FREQUENCIES).default('Manual Only'),
  nextBackupDue: z.string().default(''),
  restorePointCreated: z.boolean().default(false),
  checksum: z.string().default(''),
  remarks: z.string().default(''),
  isDeleted: z.boolean().optional(),
});

export const backupFormSchema = z.object({
  backupNumber: z.string().min(1, 'Backup number is required'),
  backupType: z.enum(BACKUP_TYPES),
  backupScope: z.enum(BACKUP_SCOPES),
  selectedCollections: z.array(z.string()).default([]),
  backupFrequency: z.enum(BACKUP_FREQUENCIES).default('Manual Only'),
  remarks: z.string().default(''),
}).refine(
  (data) => data.backupScope !== 'Selected Collections' || data.selectedCollections.length > 0,
  { message: 'Select at least one collection', path: ['selectedCollections'] },
);

export const backupSettingsSchema = z.object({
  ...baseFields,
  autoBackupEnabled: z.boolean().default(false),
  backupFrequency: z.enum(BACKUP_FREQUENCIES).default('Weekly'),
  backupTime: z.string().default('02:00'),
  backupScope: z.enum(BACKUP_SCOPES).default('Full System'),
  retentionPeriodDays: z.coerce.number().min(1, 'Retention period must be numeric').default(90),
  notifyAdminOnSuccess: z.boolean().default(true),
  notifyAdminOnFailure: z.boolean().default(true),
  lastBackupDate: z.string().default(''),
  nextBackupDate: z.string().default(''),
}).refine(
  (data) => !data.autoBackupEnabled || data.backupFrequency !== 'Manual Only',
  { message: 'Backup frequency is required when auto backup is enabled', path: ['backupFrequency'] },
);

export const restoreHistorySchema = z.object({
  ...baseFields,
  restoreId: z.string().min(1),
  backupId: z.string().min(1),
  restoreDateTime: z.string(),
  restoreType: z.enum(RESTORE_TYPES),
  restoredBy: z.string().default(''),
  restoreStatus: z.enum(RESTORE_STATUSES).default('Requested'),
  collectionsRestored: z.array(z.string()).default([]),
  recordsRestored: z.coerce.number().min(0).default(0),
  reasonForRestore: z.string().min(1, 'Reason for restore is required'),
  approvalRequired: z.boolean().default(true),
  approvedBy: z.string().default(''),
  approvedAt: z.string().default(''),
  preRestoreBackupId: z.string().default(''),
  remarks: z.string().default(''),
});

export const restoreRequestFormSchema = z.object({
  backupId: z.string().min(1, 'Backup is required'),
  restoreType: z.enum(RESTORE_TYPES),
  selectedCollections: z.array(z.string()).default([]),
  reasonForRestore: z.string().min(1, 'Reason for restore is required'),
  remarks: z.string().default(''),
}).refine(
  (data) => data.restoreType !== 'Selected Collection Restore' || data.selectedCollections.length > 0,
  { message: 'Select at least one collection to restore', path: ['selectedCollections'] },
);

export const systemSettingsSchema = z.object({
  ...baseFields,
  // General
  applicationName: z.string().min(1, 'Application name is required'),
  applicationShortName: z.string().default('PharmaQMS'),
  companyDefaultSite: z.string().default(''),
  defaultLanguage: z.string().default('en'),
  timezone: z.string().min(1, 'Timezone is required'),
  dateFormat: z.enum(DATE_FORMATS),
  timeFormat: z.enum(TIME_FORMATS),
  defaultCurrency: z.enum(CURRENCY_OPTIONS).default('INR'),
  financialYearStartMonth: z.enum(FINANCIAL_YEAR_MONTHS).default('April'),
  supportEmail: z.string().default(''),
  supportPhone: z.string().default(''),
  applicationVersion: z.string().default('1.0.0'),
  environment: z.enum(SYSTEM_ENVIRONMENTS).default('Production'),
  // Security
  enableRoleBasedAccess: z.boolean().default(true),
  enablePermissionGuard: z.boolean().default(true),
  enableAuditTrail: z.boolean().default(true),
  enableESignature: z.boolean().default(true),
  enableTwoFactorAuth: z.boolean().default(false),
  allowMultipleSessions: z.boolean().default(true),
  allowIpRestriction: z.boolean().default(false),
  allowedIpList: z.string().default(''),
  enableAccountLockout: z.boolean().default(true),
  maxFailedLoginAttempts: z.coerce.number().min(1).default(5),
  accountLockDurationMinutes: z.coerce.number().min(1).default(30),
  // Password policy (embedded)
  minPasswordLength: z.coerce.number().min(6).default(8),
  requireUppercase: z.boolean().default(true),
  requireLowercase: z.boolean().default(true),
  requireNumber: z.boolean().default(true),
  requireSpecialChar: z.boolean().default(true),
  passwordExpiryDays: z.coerce.number().min(0).default(90),
  preventLastPasswordReuseCount: z.coerce.number().min(0).default(5),
  forcePasswordChangeOnFirstLogin: z.boolean().default(true),
  // Session
  sessionTimeoutMinutes: z.coerce.number().min(5).default(30),
  idleTimeoutMinutes: z.coerce.number().min(5).default(15),
  rememberMeEnabled: z.boolean().default(true),
  autoLogoutWarningMinutes: z.coerce.number().min(1).default(2),
  // File upload
  allowedFileTypes: z.string().default('.pdf,.doc,.docx,.xls,.xlsx,.jpg,.png'),
  maxFileSizeMb: z.coerce.number().min(1).default(10),
  enableVirusScanPlaceholder: z.boolean().default(false),
  storagePathFormat: z.string().default('{module}/{year}/{recordId}'),
  allowPdf: z.boolean().default(true),
  allowExcel: z.boolean().default(true),
  allowWord: z.boolean().default(true),
  allowImages: z.boolean().default(true),
  // Theme
  defaultTheme: z.enum(['light', 'dark', 'system']).default('light'),
  enableDarkMode: z.boolean().default(true),
  primaryColor: z.string().default('#2563eb'),
  sidebarMode: z.enum(SIDEBAR_MODES).default('Expanded'),
  logoDisplayMode: z.enum(LOGO_DISPLAY_MODES).default('Full Logo'),
  compactMode: z.boolean().default(false),
  companyLogo: z.string().default(''),
  // Maintenance
  maintenanceModeEnabled: z.boolean().default(false),
  maintenanceMessage: z.string().default('System is under scheduled maintenance. Please try again later.'),
  allowedAdminAccessDuringMaintenance: z.boolean().default(true),
  scheduledMaintenanceStart: z.string().default(''),
  scheduledMaintenanceEnd: z.string().default(''),
  // System logs
  enableSystemLogs: z.boolean().default(true),
  logRetentionDays: z.coerce.number().min(1).default(90),
  enableErrorTracking: z.boolean().default(true),
  enablePerformanceLogs: z.boolean().default(false),
  // Legacy compatibility
  passwordPolicy: z.string().default(''),
  sessionTimeout: z.coerce.number().optional(),
  maxLoginAttempts: z.coerce.number().optional(),
  accountLockDuration: z.coerce.number().optional(),
  maxUploadSize: z.coerce.number().optional(),
  maintenanceMode: z.boolean().optional(),
}).refine(
  (data) => !data.maintenanceModeEnabled || data.maintenanceMessage.trim().length > 0,
  { message: 'Maintenance message is required when maintenance mode is enabled', path: ['maintenanceMessage'] },
);

export const loginActivitySchema = z.object({
  ...baseFields,
  userId: z.string().default(''),
  userName: z.string().default(''),
  email: z.string().default(''),
  loginStatus: z.enum(LOGIN_STATUSES).default('Success'),
  ipAddress: z.string().default(''),
  deviceInfo: z.string().default(''),
  loginTime: z.string().default(''),
  logoutTime: z.string().nullable().default(null),
  failureReason: z.string().default(''),
});

export const accessReviewSchema = z.object({
  ...baseFields,
  reviewId: z.string().min(1, 'Review ID is required'),
  userId: z.string().default(''),
  userName: z.string().default(''),
  department: z.string().default(''),
  role: z.string().default(''),
  reviewPeriod: z.string().default(''),
  reviewerName: z.string().default(''),
  reviewStatus: z.enum(ACCESS_REVIEW_STATUSES).default('Pending'),
  findings: z.string().default(''),
  actionTaken: z.string().default(''),
  reviewDate: z.string().default(''),
  nextReviewDate: z.string().default(''),
});

export const passwordPolicySchema = z.object({
  ...baseFields,
  minLength: z.coerce.number().min(6).default(8),
  requireUppercase: z.boolean().default(true),
  requireLowercase: z.boolean().default(true),
  requireNumber: z.boolean().default(true),
  requireSpecialChar: z.boolean().default(true),
  passwordExpiryDays: z.coerce.number().min(0).default(90),
  maxLoginAttempts: z.coerce.number().min(1).default(5),
  lockoutDurationMinutes: z.coerce.number().min(1).default(30),
  preventReuseCount: z.coerce.number().min(0).default(5),
  forceResetOnFirstLogin: z.boolean().default(true),
});

export const moduleConfigSchema = z.object({
  ...baseFields,
  moduleName: z.string().min(1, 'Module name is required'),
  moduleCode: z.string().min(1, 'Module code is required'),
  isEnabled: z.boolean().default(true),
  description: z.string().default(''),
  icon: z.string().default(''),
  route: z.string().default(''),
  sortOrder: z.coerce.number().min(0).default(0),
  requiredRole: z.string().default(''),
});

export const emailSmsTemplateSchema = z.object({
  ...baseFields,
  templateCode: z.string().min(1, 'Template code is required'),
  templateName: z.string().min(1, 'Template name is required'),
  templateType: z.enum(TEMPLATE_TYPES).default('Email'),
  subject: z.string().default(''),
  body: z.string().min(1, 'Body is required'),
  variables: z.string().default(''),
  module: z.string().default(''),
});

export const masterDataImportExportSchema = z.object({
  ...baseFields,
  operationId: z.string().min(1, 'Operation ID is required'),
  operationType: z.enum(['Import', 'Export']).default('Export'),
  masterType: z.string().min(1, 'Master type is required'),
  fileName: z.string().default(''),
  recordCount: z.coerce.number().min(0).default(0),
  operationDate: z.string().default(''),
  performedBy: z.string().default(''),
  operationStatus: z.enum(['Success', 'Failed', 'In Progress']).default('Success'),
  errorLog: z.string().default(''),
});

/** Legacy schema for backup_restore collection compatibility */
export const backupRestoreSchema = backupHistorySchema.extend({
  restorePoint: z.string().default(''),
  restoreHistory: z.string().default(''),
});

export type AdminUser = z.infer<typeof adminUserSchema>;
export type AdminRole = z.infer<typeof roleSchema>;
export type PermissionMatrix = z.infer<typeof permissionMatrixSchema>;
export type RoleFormData = z.infer<typeof roleFormSchema>;
export type RoleMatrixModule = typeof ROLE_MATRIX_MODULES[number];
export type RoleMatrixAction = typeof ROLE_MATRIX_ACTIONS[number];
export type Department = z.infer<typeof departmentSchema>;
export type DepartmentFormData = z.infer<typeof departmentFormSchema>;
export type Designation = z.infer<typeof designationSchema>;
export type DesignationFormData = z.infer<typeof designationFormSchema>;
export type CompanySite = z.infer<typeof companySiteSchema>;
export type CompanySiteFormData = z.infer<typeof companySiteFormSchema>;
export type AdminProduct = z.infer<typeof adminProductSchema>;
export type ProductFormData = z.infer<typeof productFormSchema>;
export type ProductCompositionRow = z.infer<typeof productCompositionRowSchema>;
export type ProductPackingRow = z.infer<typeof productPackingRowSchema>;
export type ProductAttachment = z.infer<typeof productAttachmentSchema>;
export type AdminBatch = z.infer<typeof adminBatchSchema>;
export type BatchFormData = z.infer<typeof batchFormSchema>;
export type BatchAttachment = z.infer<typeof batchAttachmentSchema>;
export type Parameter = z.infer<typeof parameterSchema>;
export type ParameterFormData = z.infer<typeof parameterFormSchema>;
export type Workflow = z.infer<typeof workflowSchema>;
export type WorkflowStep = z.infer<typeof workflowStepSchema>;
export type WorkflowFormData = z.infer<typeof workflowFormSchema>;
export type ApprovalMatrix = z.infer<typeof approvalMatrixSchema>;
export type ApprovalMatrixFormData = z.infer<typeof approvalMatrixFormSchema>;
export type DocumentNumbering = z.infer<typeof documentNumberingSchema>;
export type DocumentNumberingFormData = z.infer<typeof documentNumberingFormSchema>;
export type AdminAuditLog = z.infer<typeof auditLogSchema>;
export type AuditTrailEntry = z.infer<typeof auditTrailEntrySchema>;
export type EsignSettings = z.infer<typeof esignSettingsSchema>;
export type EsignSettingFormData = z.infer<typeof esignSettingFormSchema>;
export type EsignRecord = z.infer<typeof esignRecordSchema>;
export type NotificationSetting = z.infer<typeof notificationSettingSchema>;
export type NotificationSettingFormData = z.infer<typeof notificationSettingFormSchema>;
export type BackupHistory = z.infer<typeof backupHistorySchema>;
export type BackupFormData = z.infer<typeof backupFormSchema>;
export type BackupSettings = z.infer<typeof backupSettingsSchema>;
export type RestoreHistory = z.infer<typeof restoreHistorySchema>;
export type RestoreRequestFormData = z.infer<typeof restoreRequestFormSchema>;
export type SystemSettings = z.infer<typeof systemSettingsSchema>;
export type LoginActivity = z.infer<typeof loginActivitySchema>;
export type AccessReview = z.infer<typeof accessReviewSchema>;
export type PasswordPolicy = z.infer<typeof passwordPolicySchema>;
export type ModuleConfig = z.infer<typeof moduleConfigSchema>;
export type EmailSmsTemplate = z.infer<typeof emailSmsTemplateSchema>;
export type MasterDataImportExport = z.infer<typeof masterDataImportExportSchema>;
export type BackupRestore = z.infer<typeof backupRestoreSchema>;
