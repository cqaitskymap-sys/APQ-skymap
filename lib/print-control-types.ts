export const PCM_MODULE = 'Print Control Management';

export const PCM_COLLECTIONS = {
  requests: 'print_requests',
  printedDocuments: 'printed_documents',
  copies: 'print_copies',
  locations: 'print_locations',
  distribution: 'print_distribution',
  reconciliation: 'print_reconciliation',
  returns: 'print_returns',
  destruction: 'print_destruction',
  documents: 'documents',
  versions: 'document_versions',
  notifications: 'notifications',
  auditTrail: 'audit_trail',
  signatures: 'electronic_signatures',
  users: 'users',
  roles: 'roles',
} as const;

export const PRINT_TYPES = [
  'Controlled Copy', 'Uncontrolled Copy', 'Training Copy', 'Reference Copy',
  'Inspection Copy', 'Validation Copy', 'Temporary Copy',
] as const;

export const PRINT_STATUSES = [
  'Draft', 'Pending Approval', 'Approved', 'Printed', 'Issued',
  'Returned', 'Reconciled', 'Destroyed', 'Cancelled',
] as const;

export const RECONCILIATION_STATUSES = ['Pending', 'In Progress', 'Completed', 'Exception'] as const;
export const DESTRUCTION_STATUSES = ['Pending', 'Approved', 'Completed', 'Cancelled'] as const;

export type PrintType = (typeof PRINT_TYPES)[number];
export type PrintStatus = (typeof PRINT_STATUSES)[number];

export interface PrintCopyRecord {
  id: string;
  copy_id: string;
  controlled_copy_number: string;
  print_request_id: string;
  print_number: string;
  document_id: string;
  document_number: string;
  document_title: string;
  version: string;
  print_type: PrintType | string;
  copy_status: PrintStatus | string;
  barcode: string;
  qr_code: string;
  print_watermark: string;
  issued_to: string;
  issued_to_name: string;
  issue_date: string | null;
  return_due_date: string | null;
  return_date: string | null;
  reconciliation_status: string;
  destruction_status: string;
  is_replacement: boolean;
  replaced_copy_id: string | null;
  department: string;
  site: string;
  print_location: string;
  printer: string;
  created_at: string;
  updated_at: string;
}

export interface PrintRequestRecord {
  id: string;
  print_request_id: string;
  print_number: string;
  document_id: string;
  document_number: string;
  document_title: string;
  document_type: string;
  version: string;
  print_reason: string;
  print_type: PrintType | string;
  print_status: PrintStatus | string;
  controlled_copy_number: string;
  total_copies: number;
  issued_copies: number;
  returned_copies: number;
  destroyed_copies: number;
  print_location: string;
  printer: string;
  department: string;
  site: string;
  requestor_id: string;
  requestor_name: string;
  approver_id: string;
  approver_name: string;
  issued_to: string;
  issued_to_name: string;
  issue_date: string | null;
  return_due_date: string | null;
  return_date: string | null;
  reconciliation_status: string;
  destruction_status: string;
  electronic_signature_required: boolean;
  print_watermark: string;
  barcode: string;
  qr_code: string;
  created_by: string;
  created_by_name: string;
  updated_by: string;
  updated_by_name: string;
  created_at: string;
  updated_at: string;
}

export interface PrintControlKpis {
  printRequests: number;
  controlledCopies: number;
  issuedCopies: number;
  returnedCopies: number;
  outstandingCopies: number;
  destroyedCopies: number;
  pendingApprovals: number;
  reconciliationPending: number;
}

export interface PrintControlCharts {
  printTrend: { month: string; count: number }[];
  documentTypeDistribution: { name: string; value: number }[];
  departmentPrinting: { name: string; value: number }[];
  controlledVsUncontrolled: { name: string; value: number }[];
  outstandingCopyTrend: { month: string; count: number }[];
  destructionTrend: { month: string; count: number }[];
}

export interface PrintControlFilters {
  status?: string;
  department?: string;
  document_type?: string;
  print_type?: string;
  search?: string;
  pending_approval?: boolean;
  outstanding?: boolean;
  pending_return?: boolean;
  reconciliation?: boolean;
  destroyed?: boolean;
  replacement?: boolean;
  department_only?: string;
}

export interface PrintControlActor {
  id: string;
  name: string;
  role: string;
  department?: string;
}

const ADMIN = ['super_admin', 'admin'];
const DOC_CONTROLLER = [...ADMIN, 'document_controller', 'regulatory_affairs', 'head_qa'];
const QA = [...ADMIN, 'head_qa', 'qa_manager', 'qa_executive'];
const DEPT_HEAD = [...ADMIN, 'head_qa', 'qa_manager', 'production_manager', 'qc_manager'];
const AUDITOR = ['auditor'];
const EMPLOYEE = ['employee', 'viewer'];

export function canViewPrintControl(role: string): boolean {
  return DOC_CONTROLLER.includes(role) || QA.includes(role) || DEPT_HEAD.includes(role)
    || AUDITOR.includes(role) || EMPLOYEE.includes(role);
}
export function canManagePrintControl(role: string): boolean { return DOC_CONTROLLER.includes(role); }
export function canApprovePrintControl(role: string): boolean { return QA.includes(role); }
export function canRequestPrint(role: string): boolean {
  return DOC_CONTROLLER.includes(role) || DEPT_HEAD.includes(role);
}
export function isPrintControlReadOnly(role: string): boolean { return AUDITOR.includes(role); }
export function canExportPrintControl(role: string): boolean { return canViewPrintControl(role); }
export function isEmployeeAssignedView(role: string): boolean {
  return EMPLOYEE.includes(role) && !DOC_CONTROLLER.includes(role) && !QA.includes(role);
}

export function printStatusColor(status: string): string {
  const colors: Record<string, string> = {
    Draft: 'bg-slate-100 text-slate-700',
    'Pending Approval': 'bg-amber-100 text-amber-800',
    Approved: 'bg-blue-100 text-blue-800',
    Printed: 'bg-indigo-100 text-indigo-800',
    Issued: 'bg-green-100 text-green-800',
    Returned: 'bg-teal-100 text-teal-800',
    Reconciled: 'bg-purple-100 text-purple-800',
    Destroyed: 'bg-red-100 text-red-800',
    Cancelled: 'bg-gray-100 text-gray-600',
  };
  return colors[status] || colors.Draft;
}

export const DEFAULT_WATERMARK = 'CONTROLLED COPY — DO NOT DUPLICATE';
export const RETURN_DUE_DAYS = 30;
export const isControlledPrintType = (t: string) => t === 'Controlled Copy' || t === 'Validation Copy';
