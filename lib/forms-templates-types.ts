export const FORMS_TEMPLATES_MODULE = 'Forms & Templates Management';

export const FT_COLLECTIONS = {
  master: 'forms_templates',
  versions: 'form_versions',
  reviews: 'form_reviews',
  approvals: 'form_approvals',
  distribution: 'form_distribution',
  acknowledgements: 'form_acknowledgements',
  periodicReviews: 'form_periodic_reviews',
  archive: 'form_archive',
  documents: 'documents',
  sopMaster: 'sop_master',
  workInstructions: 'work_instructions',
  changeControls: 'change_controls',
  trainingAssignments: 'training_assignments',
  auditTrail: 'audit_trail',
  notifications: 'notifications',
  departments: 'departments',
  users: 'users',
  roles: 'roles',
} as const;

export const FORM_TYPES = [
  'Form', 'Template', 'Checklist', 'Log Sheet', 'Worksheet', 'Protocol',
  'Record Sheet', 'Inspection Form', 'Cleaning Log', 'Calibration Record',
  'Maintenance Record', 'Batch Record', 'Validation Template',
] as const;

export const FORM_CATEGORIES = [
  'Production', 'Quality Assurance', 'Quality Control', 'Warehouse', 'Engineering',
  'Maintenance', 'Validation', 'Calibration', 'Microbiology', 'Regulatory',
  'Packaging', 'Laboratory', 'Safety', 'Administration',
] as const;

export const FORM_STATUSES = [
  'Draft', 'Author Review', 'Department Review', 'QA Review', 'Pending Approval',
  'Approved', 'Scheduled', 'Effective', 'Periodic Review', 'Revision Required',
  'Superseded', 'Archived', 'Obsolete', 'Retired',
] as const;

export const FORM_WORKFLOW = [
  'Draft', 'Author Review', 'Department Review', 'QA Review', 'Pending Approval',
  'Approved', 'Distribution', 'Effective', 'Periodic Review', 'Revision Required',
  'Superseded', 'Archived', 'Retired',
] as const;

export type FormType = (typeof FORM_TYPES)[number];
export type FormCategory = (typeof FORM_CATEGORIES)[number];
export type FormStatus = (typeof FORM_STATUSES)[number];

export interface FormTemplateRecord {
  id: string;
  form_id: string;
  form_number: string;
  form_title: string;
  short_title: string;
  form_type: string;
  category: string;
  department: string;
  business_unit: string;
  site: string;
  owner: string;
  owner_name: string;
  author: string;
  author_name: string;
  reviewer: string;
  reviewer_name: string;
  approver: string;
  approver_name: string;
  related_sop: string;
  related_sop_id: string | null;
  related_wi: string;
  related_wi_id: string | null;
  linked_change_control: string | null;
  version: string;
  major_version: number;
  minor_version: number;
  status: FormStatus | string;
  workflow_status: string;
  effective_date: string | null;
  review_due_date: string | null;
  superseded_date: string | null;
  archive_date: string | null;
  retention_period: string | null;
  training_required: boolean;
  electronic_signature_required: boolean;
  attachment_url: string | null;
  keywords: string[];
  language: string;
  confidentiality: string;
  document_id: string | null;
  is_latest: boolean;
  is_favorite: boolean;
  training_pending: boolean;
  training_completion_pct: number;
  created_by: string;
  created_by_name: string;
  updated_by: string;
  updated_by_name: string;
  created_at: string;
  updated_at: string;
}

export interface FormKpis {
  totalForms: number;
  effectiveForms: number;
  draftForms: number;
  pendingReview: number;
  pendingApproval: number;
  reviewDue: number;
  trainingPending: number;
  archivedForms: number;
  obsoleteForms: number;
}

export interface FormCharts {
  statusDistribution: { name: string; value: number }[];
  categoryDistribution: { name: string; value: number }[];
  departmentDistribution: { name: string; value: number }[];
  reviewDueTrend: { month: string; count: number }[];
  versionTrend: { month: string; count: number }[];
  revisionTrend: { month: string; count: number }[];
  trainingCompletionTrend: { month: string; pct: number }[];
}

export interface FormFilters {
  status?: string;
  department?: string;
  category?: string;
  form_type?: string;
  owner?: string;
  search?: string;
  review_due?: boolean;
  overdue?: boolean;
  training_pending?: boolean;
  favorites?: boolean;
}

export interface FormActor {
  id: string;
  name: string;
  role: string;
  department?: string;
}

const ADMIN = ['super_admin', 'admin'];
const DOC_CONTROLLER = [...ADMIN, 'regulatory_affairs', 'head_qa', 'qa_manager'];
const QA = [...ADMIN, 'head_qa', 'qa_manager', 'qa_executive'];
const DEPT_HEAD = [...ADMIN, 'head_qa', 'qa_manager', 'production_manager', 'qc_manager', 'engineering_manager', 'warehouse_manager'];
const AUTHOR = [...DOC_CONTROLLER, 'production_manager', 'qc_manager', 'engineering_manager', 'production_executive'];
const AUDITOR = ['auditor', 'viewer'];

export function canViewForms(_role: string): boolean { return true; }
export function canManageForms(role: string): boolean { return DOC_CONTROLLER.includes(role); }
export function canApproveForms(role: string): boolean { return QA.includes(role); }
export function canReviewForms(role: string): boolean { return QA.includes(role) || DEPT_HEAD.includes(role); }
export function canCreateForms(role: string): boolean { return AUTHOR.includes(role) && !AUDITOR.includes(role); }
export function canReadEffectiveFormsOnly(role: string): boolean { return role === 'viewer'; }
export function isFormsReadOnly(role: string): boolean { return AUDITOR.includes(role); }
export function canExportForms(role: string): boolean { return !isFormsReadOnly(role) || role === 'auditor'; }
export function canBulkForms(role: string): boolean { return DOC_CONTROLLER.includes(role); }

export function formStatusColor(status: string): string {
  const colors: Record<string, string> = {
    Draft: 'bg-slate-100 text-slate-700', 'Author Review': 'bg-indigo-100 text-indigo-800',
    'Department Review': 'bg-violet-100 text-violet-800', 'QA Review': 'bg-purple-100 text-purple-800',
    'Pending Approval': 'bg-amber-100 text-amber-800', Approved: 'bg-blue-100 text-blue-800',
    Scheduled: 'bg-cyan-100 text-cyan-800', Effective: 'bg-green-100 text-green-800',
    'Periodic Review': 'bg-teal-100 text-teal-800', 'Revision Required': 'bg-orange-100 text-orange-800',
    Superseded: 'bg-gray-100 text-gray-600', Archived: 'bg-purple-100 text-purple-800',
    Obsolete: 'bg-red-100 text-red-700', Retired: 'bg-stone-100 text-stone-600',
  };
  return colors[status] || colors.Draft;
}

export function parseFormVersion(version: string): { major: number; minor: number } {
  const parts = version.split('.');
  return { major: parseInt(parts[0] || '1', 10) || 1, minor: parseInt(parts[1] || '0', 10) || 0 };
}

export function incrementFormVersion(current: string, isMajor: boolean): string {
  const { major, minor } = parseFormVersion(current);
  return isMajor ? `${major + 1}.0` : `${major}.${minor + 1}`;
}

export function isFormReviewOverdue(date: string | null): boolean {
  if (!date) return false;
  return date < new Date().toISOString().split('T')[0];
}

export function isFormReviewDueSoon(date: string | null, days = 30): boolean {
  if (!date) return false;
  const due = new Date(date);
  const threshold = new Date();
  threshold.setDate(threshold.getDate() + days);
  return due <= threshold;
}

export const DEPT_FORM_PREFIX: Record<string, string> = {
  Production: 'PRD', QC: 'QC', QA: 'QA', Engineering: 'ENG', Warehouse: 'WH',
  Regulatory: 'REG', Microbiology: 'MIC', Packaging: 'PKG', Maintenance: 'MNT',
  'IT / CSV': 'IT', PQR: 'PQR', CPV: 'CPV',
};

export const FORM_TYPE_PREFIX: Record<string, string> = {
  Form: 'FRM', Template: 'TPL', Checklist: 'CHK', 'Log Sheet': 'LOG', Worksheet: 'WKS',
  Protocol: 'PRT', 'Record Sheet': 'REC', 'Inspection Form': 'INS', 'Cleaning Log': 'CLN',
  'Calibration Record': 'CAL', 'Maintenance Record': 'MNT', 'Batch Record': 'BMR', 'Validation Template': 'VAL',
};
