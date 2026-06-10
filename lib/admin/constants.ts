export const ADMIN_MODULES = [
  'Dashboard', 'PQR', 'CPV', 'CPP', 'CQA', 'Batch', 'Product', 'Material',
  'Vendor', 'Equipment', 'Deviation', 'OOS', 'CAPA', 'Change Control',
  'Complaint', 'Recall', 'Stability', 'Validation', 'Document', 'Training',
  'Reports', 'Admin',
] as const;

export const PERMISSION_ACTIONS = [
  'view', 'create', 'edit', 'delete', 'review', 'approve', 'reject',
  'export', 'import', 'archive', 'eSign',
] as const;

export const ADMIN_ROLES = [
  { id: 'super_admin', name: 'Super Admin', level: 100 },
  { id: 'admin', name: 'Admin', level: 90 },
  { id: 'head_qa', name: 'Head QA', level: 80 },
  { id: 'qa_manager', name: 'QA Manager', level: 70 },
  { id: 'qa_executive', name: 'QA Executive', level: 60 },
  { id: 'qc_manager', name: 'QC Manager', level: 70 },
  { id: 'qc_executive', name: 'QC Executive', level: 60 },
  { id: 'production_manager', name: 'Production Manager', level: 70 },
  { id: 'production_executive', name: 'Production Executive', level: 60 },
  { id: 'warehouse_manager', name: 'Warehouse Manager', level: 70 },
  { id: 'warehouse_executive', name: 'Warehouse Executive', level: 60 },
  { id: 'engineering_manager', name: 'Engineering Manager', level: 70 },
  { id: 'engineering_executive', name: 'Engineering Executive', level: 60 },
  { id: 'regulatory_affairs', name: 'Regulatory Affairs', level: 65 },
  { id: 'auditor', name: 'Auditor', level: 50 },
  { id: 'viewer', name: 'Viewer', level: 10 },
] as const;

export const DEFAULT_DEPARTMENTS = [
  { departmentCode: 'QA', departmentName: 'QA', description: 'Quality Assurance' },
  { departmentCode: 'QC', departmentName: 'QC', description: 'Quality Control' },
  { departmentCode: 'PROD', departmentName: 'Production', description: 'Production Operations' },
  { departmentCode: 'WH', departmentName: 'Warehouse', description: 'Warehouse & Logistics' },
  { departmentCode: 'ENG', departmentName: 'Engineering', description: 'Engineering & Maintenance' },
  { departmentCode: 'RA', departmentName: 'Regulatory Affairs', description: 'Regulatory Affairs' },
  { departmentCode: 'IT', departmentName: 'IT', description: 'Information Technology' },
  { departmentCode: 'CQA', departmentName: 'CQA', description: 'Corporate Quality Assurance' },
  { departmentCode: 'ADMIN', departmentName: 'Admin', description: 'Administration' },
];

export const DEFAULT_DESIGNATIONS = [
  { designationCode: 'HQA', designationName: 'Head QA', department: 'QA', approvalLevel: 5 },
  { designationCode: 'QAM', designationName: 'QA Manager', department: 'QA', approvalLevel: 4 },
  { designationCode: 'QAE', designationName: 'QA Executive', department: 'QA', approvalLevel: 2 },
  { designationCode: 'QCM', designationName: 'QC Manager', department: 'QC', approvalLevel: 4 },
  { designationCode: 'QCE', designationName: 'QC Executive', department: 'QC', approvalLevel: 2 },
  { designationCode: 'PM', designationName: 'Production Manager', department: 'Production', approvalLevel: 4 },
  { designationCode: 'WM', designationName: 'Warehouse Manager', department: 'Warehouse', approvalLevel: 4 },
  { designationCode: 'EM', designationName: 'Engineering Manager', department: 'Engineering', approvalLevel: 4 },
  { designationCode: 'CQA-IT', designationName: 'CQA IT', department: 'CQA', approvalLevel: 3 },
  { designationCode: 'AUD', designationName: 'Auditor', department: 'QA', approvalLevel: 1 },
];

export const PARAMETER_TYPES = ['CPP', 'CQA'] as const;
export const RESULT_TYPES = ['Numeric', 'Text', 'Pass/Fail', 'Complies/Does Not Comply'] as const;
export const USER_STATUSES = ['Active', 'Inactive', 'Locked', 'Pending Approval'] as const;
export const RECORD_STATUSES = ['Active', 'Inactive'] as const;

export const NOTIFICATION_EVENTS = [
  'PQR Approval Pending', 'CPV Review Due', 'CAPA Due', 'OOS Open',
  'Deviation Open', 'Change Control Pending', 'Calibration Due',
  'Qualification Due', 'Training Due', 'Document Review Due',
] as const;

export const SIGNATURE_MEANINGS = [
  'Prepared By', 'Reviewed By', 'Approved By', 'Rejected By', 'Verified By',
] as const;

export const ADMIN_COLLECTIONS = {
  users: 'users',
  roles: 'roles',
  permissions: 'permissions',
  departments: 'departments',
  designations: 'designations',
  companySites: 'company_sites',
  products: 'products',
  batches: 'batches',
  parameters: 'parameters',
  workflows: 'workflows',
  approvalMatrix: 'approval_matrix',
  documentNumbering: 'document_numbering',
  auditLogs: 'audit_logs',
  esignSettings: 'esign_settings',
  notificationSettings: 'notification_settings',
  backupHistory: 'backup_history',
  systemSettings: 'system_settings',
} as const;

export const ADMIN_NAV_ITEMS = [
  { label: 'Admin Dashboard', href: '/dashboard/admin', icon: 'LayoutDashboard' },
  { label: 'User Management', href: '/dashboard/admin/users', icon: 'Users' },
  { label: 'Role & Permission Management', href: '/dashboard/admin/roles', icon: 'Shield' },
  { label: 'Department Master', href: '/dashboard/admin/departments', icon: 'Building2' },
  { label: 'Designation Master', href: '/dashboard/admin/designations', icon: 'BadgeCheck' },
  { label: 'Company / Site Master', href: '/dashboard/admin/company-sites', icon: 'Factory' },
  { label: 'Product Master', href: '/dashboard/admin/products', icon: 'FlaskConical' },
  { label: 'Batch Master', href: '/dashboard/admin/batches', icon: 'Package' },
  { label: 'Parameter Master', href: '/dashboard/admin/parameters', icon: 'SlidersHorizontal' },
  { label: 'Workflow Configuration', href: '/dashboard/admin/workflows', icon: 'GitBranch' },
  { label: 'Approval Matrix', href: '/dashboard/admin/approval-matrix', icon: 'CheckSquare' },
  { label: 'Document Numbering', href: '/dashboard/admin/document-numbering', icon: 'Hash' },
  { label: 'Audit Trail', href: '/dashboard/admin/audit-trail', icon: 'FileSearch' },
  { label: 'E-Signature Settings', href: '/dashboard/admin/esign-settings', icon: 'PenLine' },
  { label: 'Notification Settings', href: '/dashboard/admin/notifications', icon: 'Bell' },
  { label: 'Backup & Restore', href: '/dashboard/admin/backup', icon: 'Database' },
  { label: 'System Settings', href: '/dashboard/admin/system-settings', icon: 'Settings' },
] as const;
