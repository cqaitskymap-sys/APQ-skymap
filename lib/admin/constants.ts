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

/** Modules shown in Role & Permission matrix UI */
export const ROLE_MATRIX_MODULES = [
  'Admin', 'CPV', 'PQR', 'Deviation', 'OOS', 'CAPA', 'Change Control',
  'Stability', 'Complaint', 'Recall', 'DMS', 'Training', 'Audit',
  'Vendor', 'Validation', 'CSV', 'Equipment', 'Monitoring', 'Warehouse', 'eBMR',
] as const;

/** Permission actions in Role & Permission matrix UI */
export const ROLE_MATRIX_ACTIONS = [
  'View', 'Create', 'Edit', 'Delete', 'Review', 'Approve', 'Reject',
  'Close', 'Export', 'Print', 'Read Only',
] as const;

/** Preset role types for role management */
export const ROLE_PRESET_OPTIONS = [
  { id: 'super_admin', name: 'Super Admin', level: 100 },
  { id: 'admin', name: 'Admin', level: 90 },
  { id: 'qa', name: 'QA', level: 75 },
  { id: 'qc', name: 'QC', level: 75 },
  { id: 'production', name: 'Production', level: 70 },
  { id: 'engineering', name: 'Engineering', level: 70 },
  { id: 'warehouse', name: 'Warehouse', level: 70 },
  { id: 'regulatory', name: 'Regulatory', level: 70 },
  { id: 'auditor', name: 'Auditor', level: 50 },
  { id: 'department_head', name: 'Department Head', level: 80 },
  { id: 'reviewer', name: 'Reviewer', level: 55 },
  { id: 'approver', name: 'Approver', level: 60 },
] as const;

export const ADMIN_ROLES = [
  { id: 'super_admin', name: 'Super Admin', level: 100 },
  { id: 'admin', name: 'Admin', level: 90 },
  { id: 'qa', name: 'QA', level: 65 },
  { id: 'qc', name: 'QC', level: 65 },
  { id: 'production', name: 'Production', level: 65 },
  { id: 'engineering', name: 'Engineering', level: 65 },
  { id: 'warehouse', name: 'Warehouse', level: 65 },
  { id: 'regulatory', name: 'Regulatory', level: 65 },
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
  { id: 'hr', name: 'HR', level: 65 },
  { id: 'training_coordinator', name: 'Training Coordinator', level: 65 },
  { id: 'document_controller', name: 'Document Controller', level: 65 },
  { id: 'department_head', name: 'Department Head', level: 75 },
  { id: 'employee', name: 'Employee', level: 30 },
  { id: 'auditor', name: 'Auditor', level: 50 },
  { id: 'vendor', name: 'Vendor', level: 20 },
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

export const PARAMETER_TYPES = [
  'CPP', 'CQA', 'IPC', 'Finished Product Test', 'Stability Test',
  'Utility Parameter', 'Environmental Parameter', 'Raw Material Test',
  'Packing Material Test', 'Yield Parameter',
] as const;

export const PARAMETER_CATEGORIES = [
  'Manufacturing', 'Quality Control', 'Microbiology', 'Stability',
  'Utility', 'Environmental', 'Packaging', 'Warehouse', 'Validation',
] as const;

export const PROCESS_STAGES = [
  'Dispensing', 'Mixing', 'pH Adjustment', 'Filtration', 'Sterilization',
  'Vial Washing', 'Depyrogenation', 'Filling', 'Sealing', 'Visual Inspection',
  'Packing', 'Finished Product Testing', 'Stability Testing',
  'Utility Monitoring', 'Environmental Monitoring',
] as const;

export const CRITICALITY_OPTIONS = ['Critical', 'Major', 'Minor'] as const;

export const FREQUENCY_OPTIONS = [
  'Per Batch', 'Hourly', 'Daily', 'Weekly', 'Monthly',
  'Quarterly', 'Yearly', 'As Required',
] as const;

export const RESULT_TYPES = ['Numeric', 'Text', 'Pass/Fail', 'Complies/Does Not Comply'] as const;

export const USER_STATUSES = ['Active', 'Inactive', 'Suspended', 'Locked'] as const;
export const RECORD_STATUSES = ['Active', 'Inactive'] as const;

export const DEPARTMENT_TYPES = [
  'QA', 'QC', 'Production', 'Warehouse', 'Engineering', 'HR', 'IT',
  'Regulatory', 'Purchase', 'Microbiology', 'Validation', 'Maintenance', 'Admin', 'Other',
] as const;

export const DESIGNATION_LEVELS = [
  'Executive', 'Senior Executive', 'Assistant Manager', 'Deputy Manager',
  'Manager', 'Senior Manager', 'AGM', 'DGM', 'GM', 'Head', 'Director', 'Admin',
] as const;

export const DESIGNATION_LEVEL_APPROVAL_MAP: Record<string, number> = {
  Executive: 1,
  'Senior Executive': 2,
  'Assistant Manager': 3,
  'Deputy Manager': 3,
  Manager: 4,
  'Senior Manager': 5,
  AGM: 6,
  DGM: 7,
  GM: 8,
  Head: 9,
  Director: 10,
  Admin: 5,
};

export const DESIGNATION_PRESETS = [
  { code: 'QAE', name: 'QA Executive', department: 'QA', level: 'Executive' },
  { code: 'QAM', name: 'QA Manager', department: 'QA', level: 'Manager' },
  { code: 'HQA', name: 'Head QA', department: 'QA', level: 'Head' },
  { code: 'QCE', name: 'QC Executive', department: 'QC', level: 'Executive' },
  { code: 'QCM', name: 'QC Manager', department: 'QC', level: 'Manager' },
  { code: 'PE', name: 'Production Executive', department: 'Production', level: 'Executive' },
  { code: 'PM', name: 'Production Manager', department: 'Production', level: 'Manager' },
  { code: 'WE', name: 'Warehouse Executive', department: 'Warehouse', level: 'Executive' },
  { code: 'WM', name: 'Warehouse Manager', department: 'Warehouse', level: 'Manager' },
  { code: 'EE', name: 'Engineering Executive', department: 'Engineering', level: 'Executive' },
  { code: 'EM', name: 'Engineering Manager', department: 'Engineering', level: 'Manager' },
  { code: 'CQA-IT', name: 'CQA IT', department: 'CQA', level: 'Senior Manager' },
  { code: 'RE', name: 'Regulatory Executive', department: 'Regulatory Affairs', level: 'Executive' },
  { code: 'AUD', name: 'Auditor', department: 'QA', level: 'Executive' },
] as const;

export const NOTIFICATION_EVENTS = [
  'PQR Approval Pending', 'CPV Review Due', 'CAPA Due', 'OOS Open',
  'Deviation Open', 'Change Control Pending', 'Calibration Due',
  'Qualification Due', 'Training Due', 'Document Review Due',
] as const;

export const NOTIFICATION_MODULES = [
  'PQR', 'CPV', 'Deviation', 'OOS', 'CAPA', 'Change Control', 'Stability',
  'Complaint', 'Recall', 'DMS', 'Training', 'Audit', 'Vendor', 'Validation',
  'CSV', 'Equipment', 'Monitoring', 'Warehouse', 'eBMR', 'Admin',
] as const;

export const NOTIFICATION_EVENT_TRIGGERS = [
  'Record Created', 'Record Submitted', 'Review Pending', 'Approval Pending',
  'Approved', 'Rejected', 'Closed', 'Overdue', 'Due Soon', 'Assigned', 'Escalated',
  'OOS Detected', 'OOT Detected', 'Deviation Created', 'CAPA Due', 'CAPA Overdue',
  'Change Implementation Due', 'Training Due', 'Training Overdue', 'Document Review Due',
  'Calibration Due', 'PM Due', 'Stability Sample Due', 'Audit Finding Assigned',
  'Recall Initiated', 'Backup Completed', 'Login Failed', 'User Locked',
] as const;

export const NOTIFICATION_CHANNEL_TYPES = [
  'In-App', 'Email', 'SMS', 'In-App + Email', 'In-App + Email + SMS',
] as const;

export const NOTIFICATION_PRIORITIES = ['Low', 'Medium', 'High', 'Critical'] as const;

export const REMINDER_FREQUENCIES = ['None', 'Daily', 'Weekly', 'Bi-Weekly', 'Monthly'] as const;

export const NOTIFICATION_READ_STATUSES = ['Unread', 'Read'] as const;

export const NOTIFICATION_SENT_STATUSES = ['Pending', 'Sent', 'Failed'] as const;

export const SIGNATURE_MEANINGS = [
  'Prepared By', 'Reviewed By', 'Approved By', 'Rejected By', 'Verified By',
] as const;

export const ESIGN_SETTING_MODULES = [
  'PQR', 'CPV Annual Review', 'Deviation', 'OOS', 'CAPA', 'Change Control',
  'Stability', 'Complaint', 'Recall', 'DMS', 'Training', 'Audit',
  'Vendor Qualification', 'Validation', 'CSV', 'Equipment', 'Monitoring',
  'Warehouse', 'eBMR', 'Admin Changes',
] as const;

export const ESIGN_ACTION_TYPES = [
  'Prepared By', 'Reviewed By', 'Verified By', 'Approved By', 'Rejected By',
  'Closed By', 'Submitted By', 'Implemented By', 'Effectiveness Checked By',
  'QA Override', 'Batch Released By', 'Document Effective By',
] as const;

export const ESIGN_SIGNATURE_MEANINGS = [
  'I am the author of this record',
  'I have reviewed this record',
  'I approve this record',
  'I reject this record',
  'I verify this activity',
  'I close this record',
  'I confirm this action',
  'I release this batch',
  'I approve this change',
  'I confirm effectiveness',
] as const;

export const ADMIN_COLLECTIONS = {
  users: 'users',
  roles: 'roles',
  permissions: 'permissions',
  userPermissions: 'user_permissions',
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
  auditTrail: 'audit_trail',
  esignSettings: 'esign_settings',
  esignRecords: 'esign_records',
  notificationSettings: 'notification_settings',
  notificationTemplates: 'notification_templates',
  backupHistory: 'backup_history',
  backupRestore: 'backup_restore',
  backupSettings: 'backup_settings',
  restoreHistory: 'restore_history',
  systemSettings: 'system_settings',
  systemLogs: 'system_logs',
  loginActivity: 'login_activity',
  accessReviews: 'access_reviews',
  passwordPolicy: 'password_policy',
  moduleConfiguration: 'module_configuration',
  emailSmsTemplates: 'email_sms_templates',
  masterDataImportExport: 'master_data_import_export',
  productCompositions: 'product_compositions',
  productPackingDetails: 'product_packing_details',
  productAttachments: 'product_attachments',
  batchAttachments: 'batch_attachments',
  workflowSteps: 'workflow_steps',
  documentNumberSequences: 'document_number_sequences',
} as const;

export const DOCUMENT_NUMBERING_MODULES = [
  'PQR', 'CPV', 'Deviation', 'OOS', 'CAPA', 'Change Control', 'Stability',
  'Complaint', 'Recall', 'DMS', 'Training', 'Audit', 'Vendor Qualification',
  'Validation', 'CSV', 'Equipment', 'Calibration', 'Warehouse', 'eBMR', 'Admin',
] as const;

export const DOCUMENT_TYPE_OPTIONS = [
  'PQR Report', 'CPV Review', 'Deviation Report', 'OOS Investigation', 'CAPA Report',
  'Change Control', 'Stability Study', 'Complaint Investigation', 'Recall Report',
  'SOP', 'STP', 'Specification', 'BMR', 'BPR', 'Validation Protocol', 'Validation Report',
  'CSV URS', 'CSV IQ', 'CSV OQ', 'CSV PQ', 'Audit Report', 'Training Record',
] as const;

export const NUMBERING_YEAR_FORMATS = ['YYYY', 'YY', 'None'] as const;
export const NUMBERING_MONTH_FORMATS = ['MM', 'MMM', 'None'] as const;
export const NUMBERING_SEPARATOR_OPTIONS = ['/', '-', '_', 'None'] as const;
export const NUMBERING_RESET_FREQUENCIES = ['Never', 'Yearly', 'Monthly', 'Daily'] as const;
export const REVISION_FORMAT_OPTIONS = ['00', '01', 'Rev-00', 'R00', 'V1.0', 'Custom'] as const;

export const FORMAT_TOKENS = [
  'PREFIX', 'SITE_CODE', 'DEPARTMENT_CODE', 'PRODUCT_CODE', 'DOCUMENT_TYPE',
  'RUNNING_NUMBER', 'MONTH', 'YEAR', 'REVISION',
] as const;

export const AUDIT_TRAIL_MODULES = [
  'Admin', 'CPV', 'PQR', 'Deviation', 'OOS', 'CAPA', 'Change Control',
  'Stability', 'Complaint', 'Recall', 'DMS', 'Training', 'Audit', 'Vendor',
  'Validation', 'CSV', 'Equipment', 'Monitoring', 'Warehouse', 'eBMR',
] as const;

export const AUDIT_ACTION_TYPES = [
  'Create', 'Update', 'Delete', 'Soft Delete', 'Restore', 'Approve', 'Reject',
  'Review', 'Submit', 'Close', 'Reopen', 'Login', 'Logout', 'Failed Login',
  'Password Reset', 'Role Change', 'Permission Change', 'File Upload', 'File Delete',
  'Export', 'Import', 'Print', 'Status Change', 'E-Signature', 'Override',
  'System Setting Change', 'Backup',
] as const;

export const AUDIT_LOG_STATUSES = ['Success', 'Failed', 'Pending', 'System Generated'] as const;

export const ADMIN_AUDIT_MODULES = [
  'Admin', 'Document', 'User', 'Role', 'Department', 'Designation', 'Company Site',
  'Product', 'Batch', 'Parameter', 'Workflow', 'Approval Matrix', 'Document Numbering',
  'System Settings', 'Backup', 'Login Activity',
] as const;

export const QMS_AUDIT_MODULES = [
  'PQR', 'CPV', 'Deviation', 'OOS', 'CAPA', 'Change Control', 'Stability',
  'Complaint', 'Recall', 'DMS', 'Training', 'Audit', 'Vendor', 'Validation',
  'CSV', 'Equipment', 'Monitoring', 'Warehouse', 'eBMR',
] as const;

export const CRITICAL_AUDIT_ACTIONS = [
  'Delete', 'Approve', 'Reject', 'Role Change', 'Permission Change',
  'E-Signature', 'Override', 'System Setting Change', 'Backup', 'Restore',
] as const;

export const WORKFLOW_MODULE_OPTIONS = [
  'PQR', 'CPV', 'Deviation', 'OOS', 'CAPA', 'Change Control', 'Stability',
  'Complaint', 'Recall', 'DMS', 'Training', 'Audit', 'Vendor', 'Validation',
  'CSV', 'Equipment', 'Monitoring', 'Warehouse', 'eBMR', 'Admin',
] as const;

export const WORKFLOW_TYPES = [
  'Single Level Approval',
  'Multi Level Approval',
  'Parallel Review',
  'Sequential Review',
  'Review + Approval',
  'Investigation + Approval',
  'Execution + Review + Approval',
] as const;

export const WORKFLOW_STEP_TYPES = [
  'Prepare', 'Submit', 'Review', 'Investigate', 'Execute', 'Verify',
  'Approve', 'Final Approve', 'Close',
] as const;

export const APPROVAL_WORKFLOW_TYPES = [
  'Single Level Approval',
  'Multi Level Approval',
  'Review + Approval',
  'Investigation + Approval',
  'Execution + Review + Approval',
] as const;

export const APPROVAL_MATRIX_MODULES = [
  'PQR', 'CPV Annual Review', 'Deviation', 'OOS', 'CAPA', 'Change Control',
  'Stability', 'Complaint', 'Recall', 'DMS', 'Training', 'Audit',
  'Vendor Qualification', 'Validation', 'CSV', 'Equipment', 'Monitoring',
  'Warehouse', 'eBMR', 'Admin Changes',
] as const;

export const RISK_LEVELS = ['Low', 'Medium', 'High', 'Critical', 'All'] as const;

export const BACKUP_STATUSES = [
  'Pending', 'In Progress', 'Completed', 'Failed', 'Verified', 'Restored',
  'Success', // legacy
] as const;

export const BACKUP_TYPES = [
  'Manual Backup',
  'Scheduled Backup',
  'Pre-Restore Backup',
  'System Backup',
] as const;

export const BACKUP_SCOPES = [
  'Full System',
  'Admin Data',
  'QMS Data',
  'PQR Data',
  'CPV Data',
  'Master Data',
  'Audit Trail',
  'Selected Collections',
] as const;

export const BACKUP_FREQUENCIES = [
  'Daily',
  'Weekly',
  'Monthly',
  'Quarterly',
  'Manual Only',
] as const;

export const RESTORE_TYPES = [
  'Full Restore',
  'Selected Collection Restore',
  'Rollback Restore',
] as const;

export const RESTORE_STATUSES = [
  'Requested',
  'Approved',
  'In Progress',
  'Completed',
  'Failed',
  'Cancelled',
] as const;

/** All Firestore collections supported for backup export */
export const BACKUP_EXPORT_COLLECTIONS = [
  'users', 'roles', 'permissions', 'departments', 'designations', 'company_sites',
  'products', 'batches', 'parameters', 'workflows', 'approval_matrix', 'document_numbering',
  'esign_settings', 'notification_settings', 'cpv_reviews', 'cpp_parameters', 'cpp_results',
  'cqa_parameters', 'cqa_results', 'pqr_records', 'deviations', 'oos_records', 'capa_records',
  'change_controls', 'stability_studies', 'complaints', 'recalls', 'documents',
  'training_records', 'training_master', 'training_assignments', 'training_assessments',
  'training_effectiveness', 'training_matrix', 'training_attendance', 'competency_records',
  'document_training_links', 'audits', 'vendors', 'validation_records', 'csv_systems',
  'equipment_master', 'monitoring_records', 'warehouse_materials', 'ebmr_records',
  'audit_trail', 'notifications',
] as const;

export const BACKUP_SCOPE_COLLECTIONS: Record<string, readonly string[]> = {
  'Full System': BACKUP_EXPORT_COLLECTIONS,
  'Admin Data': [
    'users', 'roles', 'permissions', 'departments', 'designations', 'company_sites',
    'workflows', 'approval_matrix', 'document_numbering', 'esign_settings',
    'notification_settings', 'system_settings',
  ],
  'QMS Data': [
    'deviations', 'oos_records', 'capa_records', 'change_controls', 'stability_studies',
    'complaints', 'recalls', 'documents', 'training_records', 'training_master',
    'training_assignments', 'training_assessments', 'training_effectiveness', 'training_matrix',
    'training_attendance', 'competency_records', 'audits', 'vendors',
    'validation_records', 'csv_systems', 'equipment_master', 'monitoring_records',
    'warehouse_materials', 'ebmr_records',
  ],
  'PQR Data': ['pqr_records'],
  'CPV Data': ['cpv_reviews', 'cpp_parameters', 'cpp_results', 'cqa_parameters', 'cqa_results'],
  'Master Data': [
    'users', 'roles', 'departments', 'designations', 'company_sites', 'products',
    'batches', 'parameters',
  ],
  'Audit Trail': ['audit_trail'],
  'Selected Collections': [],
};
export const LOGIN_STATUSES = ['Success', 'Failed', 'Locked'] as const;
export const ACCESS_REVIEW_STATUSES = ['Pending', 'Completed', 'Overdue'] as const;
export const TEMPLATE_TYPES = ['Email', 'SMS', 'In-App'] as const;

export const SITE_TYPES = [
  'Manufacturing Plant',
  'Corporate Office',
  'R&D Site',
  'Warehouse',
  'Testing Laboratory',
  'Contract Manufacturing Site',
] as const;

export const DATE_FORMATS = ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'] as const;
export const TIME_FORMATS = ['24h', '12h'] as const;
export const CURRENCY_OPTIONS = ['INR', 'USD', 'EUR', 'GBP'] as const;
export const TIMEZONE_OPTIONS = [
  'Asia/Kolkata', 'Asia/Singapore', 'Europe/London', 'America/New_York', 'UTC',
] as const;

export const LOGO_MAX_BYTES = 2 * 1024 * 1024;
export const LOGO_ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];

export const DOSAGE_FORMS = [
  'Injection', 'Tablet', 'Capsule', 'Syrup', 'Suspension', 'Ointment',
  'Cream', 'Gel', 'Drops', 'Powder', 'Other',
] as const;

export const ROUTE_OPTIONS = ['IV', 'IM', 'Oral', 'Topical', 'Ophthalmic', 'Nasal', 'Other'] as const;
export const MARKET_OPTIONS = ['Domestic', 'Export', 'Both'] as const;

export const PRODUCT_STATUSES = [
  'Active', 'Inactive', 'Discontinued', 'Under Development',
] as const;

export const INGREDIENT_TYPES = [
  'API', 'Excipient', 'Preservative', 'Solvent', 'Buffer', 'pH Adjuster', 'Vehicle', 'Other',
] as const;

export const PACKING_MATERIAL_TYPES = [
  'Primary Packing', 'Secondary Packing', 'Tertiary Packing',
] as const;

export const PRODUCT_ATTACHMENT_TYPES = ['specification', 'stp', 'other'] as const;

export const PRODUCT_PRESET = {
  productName: 'Amikacin Injection IP',
  genericName: 'Amikacin Sulphate',
  strength: '500 mg / 2 ml',
  dosageForm: 'Injection',
  routeOfAdministration: 'IM / IV',
  shelfLife: '24',
  storageCondition: 'Store below 25°C',
  standardBatchSize: '10000 Vials',
  productStatus: 'Active' as const,
};

export const PRODUCT_ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;

export const BATCH_STATUSES = [
  'Planned', 'Manufacturing', 'Under QC Testing', 'Under QA Review',
  'Released', 'Rejected', 'Hold', 'Reworked', 'Reprocessed', 'Cancelled',
] as const;

export const RELEASE_STATUSES = [
  'Pending', 'Released', 'Rejected', 'On Hold', 'Not Applicable',
] as const;

export const BATCH_SIZE_UNITS = ['Vials', 'Tablets', 'Capsules', 'Bottles', 'Kg', 'L', 'Units'] as const;

export const BATCH_ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;

export const ADMIN_NAV_ITEMS = [
  { label: 'Admin Dashboard', href: '/admin', icon: 'LayoutDashboard' },
  { label: 'User Management', href: '/admin/users', icon: 'Users' },
  { label: 'Role & Permission', href: '/admin/roles', icon: 'Shield' },
  { label: 'Department Master', href: '/admin/departments', icon: 'Building2' },
  { label: 'Designation Master', href: '/admin/designations', icon: 'BadgeCheck' },
  { label: 'Company / Site Master', href: '/admin/company-site', icon: 'Factory' },
  { label: 'Product Master', href: '/admin/products', icon: 'FlaskConical' },
  { label: 'Batch Master', href: '/admin/batches', icon: 'Package' },
  { label: 'Parameter Master', href: '/admin/parameters', icon: 'SlidersHorizontal' },
  { label: 'Workflow Configuration', href: '/admin/workflows', icon: 'GitBranch' },
  { label: 'Approval Matrix', href: '/admin/approval-matrix', icon: 'CheckSquare' },
  { label: 'Document Numbering', href: '/admin/document-numbering', icon: 'Hash' },
  { label: 'Audit Trail', href: '/admin/audit-trail', icon: 'FileSearch' },
  { label: 'Login Activity', href: '/dashboard/admin/login-activity', icon: 'LogIn' },
  { label: 'User Access Review', href: '/dashboard/admin/user-access-review', icon: 'UserCheck' },
  { label: 'Password Policy', href: '/dashboard/admin/password-policy', icon: 'KeyRound' },
  { label: 'E-Signature Settings', href: '/admin/esign-settings', icon: 'PenLine' },
  { label: 'Notification Settings', href: '/admin/notifications', icon: 'Bell' },
  { label: 'Email/SMS Templates', href: '/dashboard/admin/email-sms-templates', icon: 'Mail' },
  { label: 'Module Configuration', href: '/dashboard/admin/module-configuration', icon: 'Blocks' },
  { label: 'Master Data Import/Export', href: '/dashboard/admin/master-data-import-export', icon: 'FileUp' },
  { label: 'Backup & Restore', href: '/admin/backup', icon: 'Database' },
  { label: 'Backup History', href: '/admin/backup/history', icon: 'HardDrive' },
  { label: 'Firebase Connection', href: '/dashboard/admin/firebase-status', icon: 'Cloud' },
  { label: 'System Health Check', href: '/dashboard/admin/system-health', icon: 'Activity' },
  { label: 'System Settings', href: '/admin/system-settings', icon: 'Settings' },
] as const;

export const SYSTEM_ENVIRONMENTS = ['Production', 'Staging', 'Development', 'UAT'] as const;

export const FINANCIAL_YEAR_MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

export const SIDEBAR_MODES = ['Expanded', 'Collapsed', 'Auto'] as const;
export const LOGO_DISPLAY_MODES = ['Full Logo', 'Icon Only', 'Text Only'] as const;

export const SYSTEM_SETTINGS_TABS = [
  { id: 'general', label: 'General', href: '/admin/system-settings/general' },
  { id: 'security', label: 'Security', href: '/admin/system-settings/security' },
  { id: 'password-policy', label: 'Password Policy', href: '/admin/system-settings/password-policy' },
  { id: 'session', label: 'Session', href: '/admin/system-settings/session' },
  { id: 'file-upload', label: 'File Upload', href: '/admin/system-settings/file-upload' },
  { id: 'theme', label: 'Theme', href: '/admin/system-settings/theme' },
  { id: 'maintenance', label: 'Maintenance', href: '/admin/system-settings/maintenance' },
  { id: 'firebase', label: 'Firebase Health', href: '/admin/system-settings/firebase' },
  { id: 'logs', label: 'System Logs', href: '/admin/system-settings/logs' },
] as const;
