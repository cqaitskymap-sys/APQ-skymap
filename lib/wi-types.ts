export const WI_MODULE = 'Work Instruction Management';

export const WI_COLLECTIONS = {
  master: 'work_instructions',
  versions: 'wi_versions',
  reviews: 'wi_reviews',
  approvals: 'wi_approvals',
  trainingLinks: 'wi_training_links',
  distribution: 'wi_distribution',
  acknowledgements: 'wi_acknowledgements',
  periodicReviews: 'wi_periodic_reviews',
  archive: 'wi_archive',
  documents: 'documents',
  equipment: 'equipment',
  productionLines: 'production_lines',
  changeControls: 'change_controls',
  trainingAssignments: 'training_assignments',
  auditTrail: 'audit_trail',
  notifications: 'notifications',
  departments: 'departments',
  users: 'users',
  roles: 'roles',
} as const;

export const WI_CATEGORIES = [
  'Production', 'Packaging', 'Warehouse', 'Engineering', 'Maintenance', 'Calibration',
  'Validation', 'Quality Control', 'Microbiology', 'IT', 'Cleaning', 'Sampling',
  'Laboratory', 'Utilities', 'Safety',
] as const;

export const WI_STATUSES = [
  'Draft', 'Author Review', 'Department Review', 'QA Review', 'Pending Approval',
  'Approved', 'Scheduled', 'Effective', 'Periodic Review', 'Revision Required',
  'Superseded', 'Archived', 'Obsolete', 'Retired',
] as const;

export const WI_WORKFLOW = [
  'Draft', 'Author Review', 'Department Review', 'QA Review', 'Pending Approval',
  'Approved', 'Training Assignment', 'Effective', 'Periodic Review', 'Revision Required',
  'Superseded', 'Archived', 'Retired',
] as const;

export type WiCategory = (typeof WI_CATEGORIES)[number];
export type WiStatus = (typeof WI_STATUSES)[number];

export interface WorkInstructionRecord {
  id: string;
  wi_id: string;
  wi_number: string;
  wi_title: string;
  short_title: string;
  department: string;
  business_unit: string;
  site: string;
  area: string;
  equipment: string;
  equipment_id: string | null;
  production_line: string;
  production_line_id: string | null;
  related_sop: string;
  related_sop_id: string | null;
  category: string;
  owner: string;
  owner_name: string;
  author: string;
  author_name: string;
  reviewer: string;
  reviewer_name: string;
  approver: string;
  approver_name: string;
  version: string;
  major_version: number;
  minor_version: number;
  status: WiStatus | string;
  workflow_status: string;
  effective_date: string | null;
  review_due_date: string | null;
  superseded_date: string | null;
  archive_date: string | null;
  retention_period: string | null;
  training_required: boolean;
  electronic_signature_required: boolean;
  linked_change_control: string | null;
  linked_capa: string | null;
  linked_risk_assessment: string | null;
  linked_validation: string | null;
  linked_forms: string[];
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

export interface WiKpis {
  totalWis: number;
  effectiveWis: number;
  draftWis: number;
  pendingReview: number;
  pendingApproval: number;
  trainingPending: number;
  reviewDue: number;
  overdueReviews: number;
  archivedWis: number;
  obsoleteWis: number;
}

export interface WiCharts {
  statusDistribution: { name: string; value: number }[];
  departmentDistribution: { name: string; value: number }[];
  equipmentDistribution: { name: string; value: number }[];
  reviewDueTrend: { month: string; count: number }[];
  versionTrend: { month: string; count: number }[];
  trainingCompletionTrend: { month: string; pct: number }[];
  revisionTrend: { month: string; count: number }[];
}

export interface WiFilters {
  status?: string;
  department?: string;
  category?: string;
  equipment?: string;
  owner?: string;
  search?: string;
  review_due?: boolean;
  overdue?: boolean;
  training_pending?: boolean;
  favorites?: boolean;
  date_from?: string;
  date_to?: string;
}

export interface WiActor {
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

export function canViewWi(_role: string): boolean { return true; }
export function canManageWi(role: string): boolean { return DOC_CONTROLLER.includes(role); }
export function canApproveWi(role: string): boolean { return QA.includes(role); }
export function canReviewWi(role: string): boolean { return QA.includes(role) || DEPT_HEAD.includes(role); }
export function canCreateWi(role: string): boolean { return AUTHOR.includes(role) && !AUDITOR.includes(role); }
export function canReadEffectiveWiOnly(role: string): boolean { return role === 'viewer'; }
export function isWiReadOnly(role: string): boolean { return AUDITOR.includes(role); }
export function canExportWi(role: string): boolean { return !isWiReadOnly(role) || role === 'auditor'; }
export function canBulkWi(role: string): boolean { return DOC_CONTROLLER.includes(role); }

export function wiStatusColor(status: string): string {
  const colors: Record<string, string> = {
    Draft: 'bg-slate-100 text-slate-700',
    'Author Review': 'bg-indigo-100 text-indigo-800',
    'Department Review': 'bg-violet-100 text-violet-800',
    'QA Review': 'bg-purple-100 text-purple-800',
    'Pending Approval': 'bg-amber-100 text-amber-800',
    Approved: 'bg-blue-100 text-blue-800',
    Scheduled: 'bg-cyan-100 text-cyan-800',
    Effective: 'bg-green-100 text-green-800',
    'Periodic Review': 'bg-teal-100 text-teal-800',
    'Revision Required': 'bg-orange-100 text-orange-800',
    Superseded: 'bg-gray-100 text-gray-600',
    Archived: 'bg-purple-100 text-purple-800',
    Obsolete: 'bg-red-100 text-red-700',
    Retired: 'bg-stone-100 text-stone-600',
  };
  return colors[status] || colors.Draft;
}

export function parseWiVersion(version: string): { major: number; minor: number } {
  const parts = version.split('.');
  return { major: parseInt(parts[0] || '1', 10) || 1, minor: parseInt(parts[1] || '0', 10) || 0 };
}

export function incrementWiVersion(current: string, isMajor: boolean): string {
  const { major, minor } = parseWiVersion(current);
  return isMajor ? `${major + 1}.0` : `${major}.${minor + 1}`;
}

export function isWiReviewOverdue(date: string | null): boolean {
  if (!date) return false;
  return date < new Date().toISOString().split('T')[0];
}

export function isWiReviewDueSoon(date: string | null, days = 30): boolean {
  if (!date) return false;
  const due = new Date(date);
  const threshold = new Date();
  threshold.setDate(threshold.getDate() + days);
  return due <= threshold;
}

export const DEPT_WI_PREFIX: Record<string, string> = {
  Production: 'PRD', QC: 'QC', QA: 'QA', Engineering: 'ENG', Warehouse: 'WH',
  Regulatory: 'REG', Microbiology: 'MIC', Packaging: 'PKG', Maintenance: 'MNT',
  'IT / CSV': 'IT', PQR: 'PQR', CPV: 'CPV',
};
