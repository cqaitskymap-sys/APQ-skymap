export const CIA_MODULE = 'Document Change Impact Assessment';

export const CIA_COLLECTIONS = {
  assessments: 'change_impact_assessments',
  changeControls: 'change_controls',
  documents: 'documents',
  versions: 'document_versions',
  riskAssessments: 'risk_assessments',
  validationAssessments: 'validation_assessments',
  trainingAssignments: 'training_assignments',
  equipment: 'equipment_master',
  products: 'products',
  materials: 'material_master',
  notifications: 'notifications',
  auditTrail: 'audit_trail',
  signatures: 'electronic_signatures',
  capa: 'capa_records',
} as const;

export const ASSESSMENT_TYPES = [
  'Document Revision', 'New Document', 'Document Retirement', 'Emergency Change',
  'Administrative Change', 'Major Change', 'Minor Change',
] as const;

export const IMPACT_RATINGS = ['None', 'Low', 'Medium', 'High', 'Critical'] as const;

export const ASSESSMENT_STATUSES = [
  'Draft', 'In Review', 'Pending Approval', 'Approved', 'Rejected', 'Closed', 'Cancelled',
] as const;

export type AssessmentType = (typeof ASSESSMENT_TYPES)[number];
export type ImpactRating = (typeof IMPACT_RATINGS)[number];
export type AssessmentStatus = (typeof ASSESSMENT_STATUSES)[number];

export interface ImpactDependency {
  type: string;
  id: string;
  number: string;
  title: string;
}

export interface DocumentChangeImpactRecord {
  id: string;
  impact_assessment_id: string;
  assessment_number: string;
  module: string;
  related_change_control_id: string | null;
  related_document_id: string;
  document_number: string;
  document_title: string;
  document_version: string;
  assessment_type: AssessmentType | string;
  assessment_reason: string;
  change_summary: string;
  business_justification: string;
  department: string;
  business_unit: string;
  site: string;
  product_impact: ImpactRating | string;
  process_impact: ImpactRating | string;
  equipment_impact: ImpactRating | string;
  facility_impact: ImpactRating | string;
  validation_impact: ImpactRating | string;
  qualification_impact: ImpactRating | string;
  csv_impact: ImpactRating | string;
  training_impact: ImpactRating | string;
  regulatory_impact: ImpactRating | string;
  customer_impact: ImpactRating | string;
  supplier_impact: ImpactRating | string;
  material_impact: ImpactRating | string;
  risk_assessment_required: boolean;
  capa_required: boolean;
  revalidation_required: boolean;
  retraining_required: boolean;
  regulatory_notification_required: boolean;
  effective_date_impact: string | null;
  priority: string;
  overall_impact_rating: ImpactRating | string;
  assessment_status: AssessmentStatus | string;
  reviewer_id: string;
  reviewer_name: string;
  approver_id: string;
  approver_name: string;
  electronic_signature_required: boolean;
  linked_risk_assessment_id: string | null;
  linked_capa_id: string | null;
  linked_validation_id: string | null;
  dependencies: ImpactDependency[];
  affected_departments: string[];
  created_by: string;
  created_by_name: string;
  updated_by: string;
  updated_by_name: string;
  created_at: string;
  updated_at: string;
}

export interface ChangeImpactKpis {
  openAssessments: number;
  approvedAssessments: number;
  criticalImpacts: number;
  pendingReviews: number;
  pendingApprovals: number;
  validationRequired: number;
  retrainingRequired: number;
  capasGenerated: number;
}

export interface ChangeImpactCharts {
  impactRatingDistribution: { name: string; value: number }[];
  departmentImpact: { name: string; value: number }[];
  assessmentTrend: { month: string; count: number }[];
  riskTrend: { month: string; count: number }[];
  validationImpactTrend: { month: string; count: number }[];
  trainingImpactTrend: { month: string; count: number }[];
}

export interface ChangeImpactFilters {
  status?: string;
  department?: string;
  assessment_type?: string;
  impact_rating?: string;
  priority?: string;
  search?: string;
  open?: boolean;
  critical?: boolean;
  pending_approval?: boolean;
  validation?: boolean;
  retraining?: boolean;
}

export interface ChangeImpactActor {
  id: string;
  name: string;
  role: string;
  department?: string;
}

const ADMIN = ['super_admin', 'admin'];
const QA = [...ADMIN, 'head_qa', 'qa_manager', 'qa_executive'];
const CHANGE_MANAGER = [...ADMIN, 'head_qa', 'qa_manager', 'regulatory_affairs'];
const DOC_CONTROLLER = [...ADMIN, 'regulatory_affairs', 'head_qa', 'qa_manager'];
const DEPT_HEAD = [...ADMIN, 'head_qa', 'qa_manager', 'production_manager', 'qc_manager'];
const AUDITOR = ['auditor'];
const EMPLOYEE = ['employee', 'viewer'];

export function canViewChangeImpact(role: string): boolean {
  return QA.includes(role) || CHANGE_MANAGER.includes(role) || DOC_CONTROLLER.includes(role)
    || DEPT_HEAD.includes(role) || AUDITOR.includes(role) || EMPLOYEE.includes(role);
}
export function canManageChangeImpact(role: string): boolean {
  return CHANGE_MANAGER.includes(role) || DOC_CONTROLLER.includes(role);
}
export function canApproveChangeImpact(role: string): boolean { return QA.includes(role); }
export function isChangeImpactReadOnly(role: string): boolean { return AUDITOR.includes(role); }
export function canExportChangeImpact(role: string): boolean { return canViewChangeImpact(role); }
export function canBulkAssessChangeImpact(role: string): boolean { return canManageChangeImpact(role); }

export function assessmentStatusColor(status: string): string {
  const colors: Record<string, string> = {
    Draft: 'bg-slate-100 text-slate-700',
    'In Review': 'bg-blue-100 text-blue-800',
    'Pending Approval': 'bg-amber-100 text-amber-800',
    Approved: 'bg-green-100 text-green-800',
    Rejected: 'bg-red-100 text-red-700',
    Closed: 'bg-gray-100 text-gray-600',
    Cancelled: 'bg-purple-100 text-purple-800',
  };
  return colors[status] || colors.Draft;
}

export function impactRatingColor(rating: string): string {
  const colors: Record<string, string> = {
    None: 'bg-slate-100 text-slate-600',
    Low: 'bg-green-100 text-green-800',
    Medium: 'bg-amber-100 text-amber-800',
    High: 'bg-orange-100 text-orange-800',
    Critical: 'bg-red-100 text-red-700',
  };
  return colors[rating] || colors.Low;
}

export const CIA_MODULE_TAG = CIA_MODULE;
