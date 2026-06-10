import { z } from 'zod';
import {
  ADMIN_MODULES, PERMISSION_ACTIONS, PARAMETER_TYPES, RESULT_TYPES,
  USER_STATUSES, RECORD_STATUSES, NOTIFICATION_EVENTS, SIGNATURE_MEANINGS,
} from './constants';

const baseFields = {
  id: z.string().optional(),
  createdBy: z.string().default(''),
  createdAt: z.string().optional(),
  updatedBy: z.string().default(''),
  updatedAt: z.string().optional(),
  status: z.enum(RECORD_STATUSES).default('Active'),
};

export const adminUserSchema = z.object({
  ...baseFields,
  employeeId: z.string().min(1, 'Employee ID is required'),
  fullName: z.string().min(1, 'Full name is required'),
  email: z.string().email('Valid email required'),
  mobileNumber: z.string().default(''),
  department: z.string().min(1, 'Department is required'),
  designation: z.string().default(''),
  role: z.string().min(1, 'Role is required'),
  reportingManager: z.string().default(''),
  userStatus: z.enum(USER_STATUSES).default('Active'),
  profilePhoto: z.string().default(''),
  joiningDate: z.string().default(''),
  passwordResetRequired: z.boolean().default(false),
  twoFactorEnabled: z.boolean().default(false),
  lastLogin: z.string().nullable().default(null),
  authUid: z.string().optional(),
});

export const roleSchema = z.object({
  ...baseFields,
  roleId: z.string().min(1, 'Role ID is required'),
  roleName: z.string().min(1, 'Role name is required'),
  description: z.string().default(''),
  level: z.number().default(1),
});

export const permissionMatrixSchema = z.object({
  ...baseFields,
  roleId: z.string().min(1),
  roleName: z.string().min(1),
  permissions: z.record(
    z.enum(ADMIN_MODULES),
    z.record(z.enum(PERMISSION_ACTIONS), z.boolean())
  ),
});

export const departmentSchema = z.object({
  ...baseFields,
  departmentCode: z.string().min(1, 'Department code is required'),
  departmentName: z.string().min(1, 'Department name is required'),
  departmentHead: z.string().default(''),
  description: z.string().default(''),
});

export const designationSchema = z.object({
  ...baseFields,
  designationCode: z.string().min(1, 'Designation code is required'),
  designationName: z.string().min(1, 'Designation name is required'),
  department: z.string().min(1, 'Department is required'),
  approvalLevel: z.coerce.number().min(1).max(10).default(1),
});

export const companySiteSchema = z.object({
  ...baseFields,
  companyName: z.string().min(1, 'Company name is required'),
  companyLogo: z.string().default(''),
  siteName: z.string().min(1, 'Site name is required'),
  plantAddress: z.string().default(''),
  city: z.string().default(''),
  state: z.string().default(''),
  country: z.string().default(''),
  licenseNo: z.string().default(''),
  gstNo: z.string().default(''),
  contactEmail: z.string().email().or(z.literal('')).default(''),
  contactNumber: z.string().default(''),
  defaultTimezone: z.string().default('Asia/Kolkata'),
  documentHeaderFormat: z.string().default(''),
  isDefault: z.boolean().default(false),
});

export const adminProductSchema = z.object({
  ...baseFields,
  productCode: z.string().min(1, 'Product code is required'),
  productName: z.string().min(1, 'Product name is required'),
  genericName: z.string().default(''),
  strength: z.string().default(''),
  dosageForm: z.string().default(''),
  market: z.string().default(''),
  shelfLife: z.string().default(''),
  batchSize: z.string().default(''),
  manufacturingLicenseNo: z.string().default(''),
  composition: z.string().default(''),
  packingStyle: z.string().default(''),
});

export const adminBatchSchema = z.object({
  ...baseFields,
  batchNumber: z.string().min(1, 'Batch number is required'),
  productCode: z.string().min(1, 'Product is required'),
  productName: z.string().default(''),
  manufacturingDate: z.string().default(''),
  expiryDate: z.string().default(''),
  batchSize: z.string().default(''),
  unit: z.string().default(''),
  lineNumber: z.string().default(''),
  batchStatus: z.string().default('In Process'),
});

export const parameterSchema = z.object({
  ...baseFields,
  parameterCode: z.string().min(1, 'Parameter code is required'),
  parameterName: z.string().min(1, 'Parameter name is required'),
  parameterType: z.enum(PARAMETER_TYPES),
  product: z.string().default(''),
  processStage: z.string().default(''),
  lsl: z.string().default(''),
  usl: z.string().default(''),
  target: z.string().default(''),
  unit: z.string().default(''),
  frequency: z.string().default(''),
  criticality: z.string().default(''),
  resultType: z.enum(RESULT_TYPES),
});

export const workflowSchema = z.object({
  ...baseFields,
  moduleName: z.string().min(1, 'Module name is required'),
  initiatorRole: z.string().default(''),
  reviewerRole: z.string().default(''),
  approverRole: z.string().default(''),
  escalationRole: z.string().default(''),
  approvalLevels: z.coerce.number().min(1).default(1),
  autoEscalationDays: z.coerce.number().min(0).default(3),
  allowRejection: z.boolean().default(true),
  allowResubmission: z.boolean().default(true),
  requireESignature: z.boolean().default(true),
  workflowChain: z.string().default(''),
});

export const approvalMatrixSchema = z.object({
  ...baseFields,
  module: z.string().min(1, 'Module is required'),
  department: z.string().default(''),
  level1Reviewer: z.string().default(''),
  level2Reviewer: z.string().default(''),
  finalApprover: z.string().default(''),
  mandatoryRemarks: z.boolean().default(true),
  eSignRequired: z.boolean().default(true),
});

export const documentNumberingSchema = z.object({
  ...baseFields,
  module: z.string().min(1, 'Module is required'),
  prefix: z.string().min(1, 'Prefix is required'),
  siteCode: z.string().default(''),
  departmentCode: z.string().default(''),
  yearFormat: z.string().default('YYYY'),
  runningNumber: z.coerce.number().min(1).default(4),
  separator: z.string().default('/'),
  exampleFormat: z.string().default(''),
  currentNumber: z.coerce.number().min(0).default(0),
  resetFrequency: z.enum(['Never', 'Yearly', 'Monthly']).default('Yearly'),
});

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

export const esignSettingsSchema = z.object({
  ...baseFields,
  requirePasswordConfirmation: z.boolean().default(true),
  requireReason: z.boolean().default(true),
  requireRoleVerification: z.boolean().default(true),
  sessionTimeout: z.coerce.number().min(1).default(15),
  signatureMeanings: z.array(z.enum(SIGNATURE_MEANINGS)).default([...SIGNATURE_MEANINGS]),
});

export const notificationSettingSchema = z.object({
  ...baseFields,
  eventName: z.enum(NOTIFICATION_EVENTS),
  recipientRole: z.string().default(''),
  beforeDueDays: z.coerce.number().min(0).default(3),
  escalationDays: z.coerce.number().min(0).default(7),
  emailEnabled: z.boolean().default(true),
  inAppEnabled: z.boolean().default(true),
  smsEnabled: z.boolean().default(false),
  template: z.string().default(''),
});

export const backupHistorySchema = z.object({
  ...baseFields,
  backupId: z.string().min(1),
  backupDate: z.string(),
  backupType: z.enum(['Manual', 'Automatic']),
  fileSize: z.string().default(''),
  filePath: z.string().default(''),
});

export const systemSettingsSchema = z.object({
  ...baseFields,
  applicationName: z.string().default('Skymap PharmaQMS'),
  defaultTheme: z.enum(['light', 'dark', 'system']).default('light'),
  defaultLanguage: z.string().default('en'),
  dateFormat: z.string().default('DD/MM/YYYY'),
  timeFormat: z.string().default('24h'),
  passwordPolicy: z.string().default('Min 8 chars, 1 uppercase, 1 number, 1 special'),
  sessionTimeout: z.coerce.number().min(5).default(30),
  maxLoginAttempts: z.coerce.number().min(1).default(5),
  accountLockDuration: z.coerce.number().min(1).default(30),
  allowedFileTypes: z.string().default('.pdf,.doc,.docx,.xls,.xlsx,.jpg,.png'),
  maxUploadSize: z.coerce.number().min(1).default(10),
});

export type AdminUser = z.infer<typeof adminUserSchema>;
export type AdminRole = z.infer<typeof roleSchema>;
export type PermissionMatrix = z.infer<typeof permissionMatrixSchema>;
export type Department = z.infer<typeof departmentSchema>;
export type Designation = z.infer<typeof designationSchema>;
export type CompanySite = z.infer<typeof companySiteSchema>;
export type AdminProduct = z.infer<typeof adminProductSchema>;
export type AdminBatch = z.infer<typeof adminBatchSchema>;
export type Parameter = z.infer<typeof parameterSchema>;
export type Workflow = z.infer<typeof workflowSchema>;
export type ApprovalMatrix = z.infer<typeof approvalMatrixSchema>;
export type DocumentNumbering = z.infer<typeof documentNumberingSchema>;
export type AdminAuditLog = z.infer<typeof auditLogSchema>;
export type EsignSettings = z.infer<typeof esignSettingsSchema>;
export type NotificationSetting = z.infer<typeof notificationSettingSchema>;
export type BackupHistory = z.infer<typeof backupHistorySchema>;
export type SystemSettings = z.infer<typeof systemSettingsSchema>;
