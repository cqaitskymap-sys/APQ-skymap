export const CD_MODULE = 'Controlled Document Distribution';

export const CD_COLLECTIONS = {
  distribution: 'document_distribution',
  lists: 'distribution_lists',
  groups: 'distribution_groups',
  documents: 'documents',
  sopMaster: 'sop_master',
  workInstructions: 'work_instructions',
  formsTemplates: 'forms_templates',
  employees: 'employees',
  departments: 'departments',
  sites: 'sites',
  plants: 'plants',
  roles: 'roles',
  notifications: 'notifications',
  auditTrail: 'audit_trail',
  trainingAssignments: 'training_assignments',
} as const;

export const DISTRIBUTION_TYPES = [
  'Individual', 'Department', 'Role Based', 'Site', 'Plant', 'Business Unit', 'Global',
] as const;

export const DISTRIBUTION_STATUSES = [
  'Draft', 'Scheduled', 'Distributed', 'Pending Acknowledgement', 'Completed', 'Expired', 'Cancelled', 'Withdrawn',
] as const;

export type DistributionType = (typeof DISTRIBUTION_TYPES)[number];
export type DistributionStatus = (typeof DISTRIBUTION_STATUSES)[number];

export interface ControlledDistributionRecord {
  id: string;
  distribution_id: string;
  distribution_number: string;
  document_id: string;
  document_number: string;
  document_title: string;
  document_type: string;
  document_version: string;
  distribution_type: DistributionType | string;
  distribution_group: string;
  department: string;
  site: string;
  plant: string;
  assigned_users: string[];
  assigned_user_names: string[];
  assigned_roles: string[];
  assigned_departments: string[];
  distribution_date: string | null;
  effective_date: string;
  expiry_date: string | null;
  acknowledgement_required: boolean;
  training_required: boolean;
  read_confirmation_required: boolean;
  status: DistributionStatus | string;
  reason: string;
  pending_acknowledgements: number;
  pending_training: number;
  pending_read_confirmations: number;
  withdrawn_at: string | null;
  withdrawn_reason: string | null;
  is_immutable: boolean;
  created_by: string;
  created_by_name: string;
  updated_by: string;
  updated_by_name: string;
  created_at: string;
  updated_at: string;
}

export interface DistributionKpis {
  totalDistributions: number;
  activeDistributions: number;
  pendingAcknowledgements: number;
  completed: number;
  expired: number;
  cancelled: number;
  trainingPending: number;
  readConfirmationsPending: number;
}

export interface DistributionCharts {
  distributionTrend: { month: string; count: number }[];
  departmentDistribution: { name: string; value: number }[];
  documentTypeDistribution: { name: string; value: number }[];
  acknowledgementStatus: { name: string; value: number }[];
  trainingAssignmentTrend: { month: string; count: number }[];
  siteDistribution: { name: string; value: number }[];
}

export interface DistributionFilters {
  status?: string;
  distribution_type?: string;
  department?: string;
  document_type?: string;
  site?: string;
  search?: string;
  pending_ack?: boolean;
  training_pending?: boolean;
  expiring?: boolean;
}

export interface DistributionActor {
  id: string;
  name: string;
  role: string;
  department?: string;
}

const ADMIN = ['super_admin', 'admin'];
const DOC_CONTROLLER = [...ADMIN, 'regulatory_affairs', 'head_qa', 'qa_manager'];
const QA = [...ADMIN, 'head_qa', 'qa_manager', 'qa_executive'];
const DEPT_HEAD = [...ADMIN, 'head_qa', 'qa_manager', 'production_manager', 'qc_manager', 'engineering_manager', 'warehouse_manager'];
const AUDITOR = ['auditor'];

export function canViewDistribution(_role: string): boolean { return true; }
export function canManageDistribution(role: string): boolean { return DOC_CONTROLLER.includes(role); }
export function canCreateDistribution(role: string): boolean { return DOC_CONTROLLER.includes(role) && !AUDITOR.includes(role); }
export function canReviewDistribution(role: string): boolean { return QA.includes(role); }
export function canDeptDistribute(role: string): boolean { return DEPT_HEAD.includes(role); }
export function canViewAssignedOnly(role: string): boolean { return role === 'viewer' || role === 'employee'; }
export function isDistributionReadOnly(role: string): boolean { return AUDITOR.includes(role); }
export function canExportDistribution(role: string): boolean { return !isDistributionReadOnly(role) || role === 'auditor'; }
export function canBulkDistribute(role: string): boolean { return DOC_CONTROLLER.includes(role); }

export function distributionStatusColor(status: string): string {
  const colors: Record<string, string> = {
    Draft: 'bg-slate-100 text-slate-700',
    Scheduled: 'bg-cyan-100 text-cyan-800',
    Distributed: 'bg-blue-100 text-blue-800',
    'Pending Acknowledgement': 'bg-amber-100 text-amber-800',
    Completed: 'bg-green-100 text-green-800',
    Expired: 'bg-gray-100 text-gray-600',
    Cancelled: 'bg-red-100 text-red-700',
    Withdrawn: 'bg-purple-100 text-purple-800',
  };
  return colors[status] || colors.Draft;
}

export function isDistributionActive(status: string): boolean {
  return ['Distributed', 'Pending Acknowledgement', 'Scheduled'].includes(status);
}

export function isDistributionExpired(expiryDate: string | null): boolean {
  if (!expiryDate) return false;
  return expiryDate < new Date().toISOString().split('T')[0];
}
