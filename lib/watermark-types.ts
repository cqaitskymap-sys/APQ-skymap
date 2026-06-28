export const WM_MODULE = 'Watermark Management';

export const WM_COLLECTIONS = {
  templates: 'watermark_templates',
  rules: 'watermark_rules',
  history: 'watermark_history',
  documentWatermarks: 'document_watermarks',
  documents: 'documents',
  versions: 'document_versions',
  printedDocuments: 'printed_documents',
  distribution: 'document_distribution',
  exports: 'exports',
  notifications: 'notifications',
  auditTrail: 'audit_trail',
  users: 'users',
  roles: 'roles',
} as const;

export const WATERMARK_TYPES = [
  'Controlled Copy', 'Uncontrolled Copy', 'Draft', 'Pending Review', 'Pending Approval',
  'Effective', 'Superseded', 'Obsolete', 'Archived', 'For Training', 'For External Use',
  'Inspection Copy', 'Confidential', 'Custom',
] as const;

export const TRIGGER_EVENTS = [
  'View', 'Download', 'Print', 'Export PDF', 'Export Word', 'Export Excel',
  'Email', 'Distribution', 'Archive',
] as const;

export const VISIBILITY_TYPES = ['Visible', 'Invisible Metadata', 'Both'] as const;

export const WATERMARK_POSITIONS = [
  'Center', 'Top Left', 'Top Right', 'Bottom Left', 'Bottom Right', 'Diagonal', 'Header', 'Footer',
] as const;

export const WATERMARK_STATUSES = ['Active', 'Inactive', 'Pending Approval'] as const;

export const DOCUMENT_STATUSES = [
  'Draft', 'Pending Review', 'Pending Approval', 'Effective',
  'Superseded', 'Obsolete', 'Archived',
] as const;

export type WatermarkType = (typeof WATERMARK_TYPES)[number];
export type TriggerEvent = (typeof TRIGGER_EVENTS)[number];
export type VisibilityType = (typeof VISIBILITY_TYPES)[number];
export type WatermarkStatus = (typeof WATERMARK_STATUSES)[number];

export interface WatermarkTemplateRecord {
  id: string;
  watermark_id: string;
  template_name: string;
  watermark_type: WatermarkType | string;
  display_text: string;
  description: string;
  document_status: string;
  applies_to: string;
  trigger_event: TriggerEvent | string;
  visibility: VisibilityType | string;
  position: string;
  rotation: number;
  opacity: number;
  font_family: string;
  font_size: number;
  color: string;
  repeat_pattern: string;
  background_image: string;
  qr_code_enabled: boolean;
  barcode_enabled: boolean;
  include_document_number: boolean;
  include_version: boolean;
  include_copy_number: boolean;
  include_print_date: boolean;
  include_user_name: boolean;
  include_department: boolean;
  include_timestamp: boolean;
  include_confidentiality_level: boolean;
  include_digital_fingerprint: boolean;
  status: WatermarkStatus | string;
  created_by: string;
  created_by_name: string;
  updated_by: string;
  updated_by_name: string;
  created_at: string;
  updated_at: string;
}

export interface WatermarkRuleRecord {
  id: string;
  rule_id: string;
  rule_name: string;
  template_id: string;
  template_name: string;
  document_status: string;
  document_type: string;
  trigger_event: TriggerEvent | string;
  watermark_type: WatermarkType | string;
  priority: number;
  status: WatermarkStatus | string;
  approved_by: string;
  approved_by_name: string;
  approved_at: string | null;
  created_by: string;
  created_by_name: string;
  updated_by: string;
  updated_by_name: string;
  created_at: string;
  updated_at: string;
}

export interface WatermarkHistoryRecord {
  id: string;
  event_id: string;
  document_id: string;
  document_number: string;
  document_title: string;
  version: string;
  template_id: string;
  template_name: string;
  watermark_type: string;
  trigger_event: string;
  display_text: string;
  rendered_text: string;
  barcode: string;
  qr_code: string;
  metadata: Record<string, string>;
  department: string;
  user_id: string;
  user_name: string;
  event_status: 'Applied' | 'Failed' | 'Removed';
  failure_reason: string;
  created_at: string;
}

export interface DocumentWatermarkRecord {
  id: string;
  document_id: string;
  document_number: string;
  document_title: string;
  version: string;
  document_status: string;
  watermark_type: string;
  template_id: string;
  display_text: string;
  rendered_text: string;
  trigger_event: string;
  copy_number: string;
  barcode: string;
  qr_code: string;
  department: string;
  applied_by: string;
  applied_by_name: string;
  applied_at: string;
  updated_at: string;
}

export interface WatermarkKpis {
  watermarkTemplates: number;
  documentsWatermarked: number;
  controlledCopies: number;
  uncontrolledCopies: number;
  trainingCopies: number;
  inspectionCopies: number;
  archivedDocuments: number;
  watermarkEventsToday: number;
}

export interface WatermarkCharts {
  usageTrend: { month: string; count: number }[];
  documentStatusDistribution: { name: string; value: number }[];
  watermarkTypeDistribution: { name: string; value: number }[];
  departmentDistribution: { name: string; value: number }[];
  printWatermarkTrend: { month: string; count: number }[];
  exportWatermarkTrend: { month: string; count: number }[];
}

export interface WatermarkFilters {
  status?: string;
  department?: string;
  watermark_type?: string;
  trigger_event?: string;
  document_status?: string;
  search?: string;
  controlled?: boolean;
  uncontrolled?: boolean;
  training?: boolean;
  inspection?: boolean;
  archived?: boolean;
  failed?: boolean;
  pending_rules?: boolean;
  visibility?: string;
  department_only?: string;
}

export interface WatermarkActor {
  id: string;
  name: string;
  role: string;
  department?: string;
}

export interface DynamicWatermarkContext {
  document_number?: string;
  version?: string;
  copy_number?: string;
  user_name?: string;
  department?: string;
  confidentiality_level?: string;
  document_status?: string;
  print_date?: string;
}

const ADMIN = ['super_admin', 'admin'];
const DOC_CONTROLLER = [...ADMIN, 'document_controller', 'regulatory_affairs', 'head_qa'];
const QA = [...ADMIN, 'head_qa', 'qa_manager', 'qa_executive'];
const RECORDS_MANAGER = [...ADMIN, 'document_controller', 'records_manager', 'regulatory_affairs'];
const DEPT_HEAD = [...ADMIN, 'head_qa', 'qa_manager', 'production_manager', 'qc_manager'];
const AUDITOR = ['auditor'];
const EMPLOYEE = ['employee', 'viewer'];

export function canViewWatermarks(role: string): boolean {
  return DOC_CONTROLLER.includes(role) || QA.includes(role) || RECORDS_MANAGER.includes(role)
    || DEPT_HEAD.includes(role) || AUDITOR.includes(role) || EMPLOYEE.includes(role);
}
export function canManageWatermarkTemplates(role: string): boolean { return DOC_CONTROLLER.includes(role); }
export function canManageWatermarks(role: string): boolean { return RECORDS_MANAGER.includes(role); }
export function canApproveWatermarkRules(role: string): boolean { return QA.includes(role); }
export function isWatermarkReadOnly(role: string): boolean { return AUDITOR.includes(role); }
export function canExportWatermarks(role: string): boolean { return canViewWatermarks(role); }
export function isDeptHeadWatermarkView(role: string): boolean {
  return DEPT_HEAD.includes(role) && !DOC_CONTROLLER.includes(role) && !RECORDS_MANAGER.includes(role);
}

export function watermarkStatusColor(status: string): string {
  const colors: Record<string, string> = {
    Active: 'bg-green-100 text-green-800',
    Inactive: 'bg-gray-100 text-gray-600',
    'Pending Approval': 'bg-amber-100 text-amber-800',
    Applied: 'bg-blue-100 text-blue-800',
    Failed: 'bg-red-100 text-red-800',
    Removed: 'bg-slate-100 text-slate-700',
  };
  return colors[status] || colors.Active;
}

export const STATUS_WATERMARK_DEFAULTS: Record<string, string> = {
  Draft: 'DRAFT — NOT FOR USE',
  'Pending Review': 'PENDING REVIEW',
  'Pending Approval': 'PENDING APPROVAL',
  Effective: '',
  Superseded: 'SUPERSEDED',
  Obsolete: 'OBSOLETE',
  Archived: 'ARCHIVED',
  'Controlled Copy': 'CONTROLLED COPY',
  'Uncontrolled Copy': 'UNCONTROLLED COPY',
  'For Training': 'FOR TRAINING ONLY',
  'Inspection Copy': 'INSPECTION COPY',
  Confidential: 'CONFIDENTIAL',
};

export const DEFAULT_WATERMARK_TEMPLATE = {
  display_text: 'CONTROLLED COPY — DO NOT DUPLICATE',
  opacity: 0.25,
  rotation: -45,
  position: 'Diagonal',
  font_family: 'Arial',
  font_size: 48,
  color: '#CC0000',
  visibility: 'Both' as VisibilityType,
};
