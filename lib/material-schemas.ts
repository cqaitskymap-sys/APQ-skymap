import { z } from 'zod';

// Material Type Options
export const MATERIAL_TYPES = [
  'API',
  'Raw Material',
  'Excipient',
  'Solvent',
  'Preservative',
  'Buffer',
  'pH Adjuster',
  'Other',
] as const;

// Material Status Options
export const MATERIAL_STATUSES = ['Active', 'Inactive', 'Blocked'] as const;

// Vendor Type Options
export const VENDOR_TYPES = ['Manufacturer', 'Supplier', 'Manufacturer + Supplier'] as const;

// AVL Status Options
export const AVL_STATUSES = ['Approved', 'Not Approved', 'Conditional Approved', 'Blocked'] as const;

// Risk Categories
export const RISK_CATEGORIES = ['Low', 'Medium', 'High'] as const;

// Vendor Status
export const VENDOR_STATUSES = ['Active', 'Inactive', 'Blocked'] as const;

// QC Status Options
export const QC_STATUSES = ['Approved', 'Rejected', 'Under Test', 'Quarantine', 'Retest Required'] as const;

// COA Available Options
export const COA_AVAILABLE_OPTIONS = ['Yes', 'No'] as const;

// Compliance Status Options
export const COMPLIANCE_STATUSES = ['Complies', 'Does Not Comply', 'Not Applicable'] as const;

// ============= Material Master Schema =============
export const materialMasterSchema = z.object({
  id: z.string().optional(),
  materialCode: z.string().min(1, 'Material Code required'),
  materialName: z.string().min(1, 'Material Name required'),
  materialType: z.enum(MATERIAL_TYPES),
  grade: z.string().default(''),
  specificationNo: z.string().default(''),
  stpNo: z.string().default(''),
  approvedVendorRequired: z.boolean().default(true),
  storageCondition: z.string().default(''),
  retestPeriod: z.string().default(''),
  shelfLife: z.string().default(''),
  status: z.enum(MATERIAL_STATUSES).default('Active'),
  remarks: z.string().default(''),
  createdBy: z.string().optional(),
  createdAt: z.string().optional(),
  updatedBy: z.string().optional(),
  updatedAt: z.string().optional(),
});

export type MaterialMaster = z.infer<typeof materialMasterSchema>;

// ============= Vendor Master Schema =============
export const vendorMasterSchema = z.object({
  id: z.string().optional(),
  vendorCode: z.string().min(1, 'Vendor Code required'),
  vendorName: z.string().min(1, 'Vendor Name required'),
  vendorType: z.enum(VENDOR_TYPES),
  materialSupplied: z.string().min(1, 'Material Supplied required'),
  manufacturerName: z.string().default(''),
  supplierName: z.string().default(''),
  address: z.string().default(''),
  country: z.string().default(''),
  avlStatus: z.enum(AVL_STATUSES).default('Not Approved'),
  approvalDate: z.string().nullable().default(null),
  approvalExpiryDate: z.string().nullable().default(null),
  lastAuditDate: z.string().nullable().default(null),
  nextAuditDueDate: z.string().nullable().default(null),
  riskCategory: z.enum(RISK_CATEGORIES).default('Medium'),
  status: z.enum(VENDOR_STATUSES).default('Active'),
  remarks: z.string().default(''),
  createdBy: z.string().optional(),
  createdAt: z.string().optional(),
  updatedBy: z.string().optional(),
  updatedAt: z.string().optional(),
}).refine(
  (data) => {
    if (data.approvalDate && data.approvalExpiryDate) {
      return new Date(data.approvalExpiryDate) > new Date(data.approvalDate);
    }
    return true;
  },
  {
    message: 'Approval Expiry Date must be after Approval Date',
    path: ['approvalExpiryDate'],
  }
);

export type VendorMaster = z.infer<typeof vendorMasterSchema>;

// ============= Material Review Schema =============
export const materialReviewSchema = z.object({
  id: z.string().optional(),
  pqrId: z.string().min(1, 'PQR ID required'),
  productId: z.string().default(''),
  productName: z.string().default(''),
  batchId: z.string().default(''),
  batchNo: z.string().min(1, 'Batch No. required'),
  materialType: z.enum(MATERIAL_TYPES),
  materialId: z.string().min(1, 'Material Name required'),
  materialName: z.string().min(1, 'Material Name required'),
  materialCode: z.string().default(''),
  manufacturerName: z.string().min(1, 'Manufacturer Name required'),
  supplierName: z.string().min(1, 'Supplier Name required'),
  vendorId: z.string().default(''),
  avlStatus: z.enum(AVL_STATUSES).default('Not Approved'),
  arNo: z.string().min(1, 'AR No. required').default(''),
  grnNo: z.string().default(''),
  receivedQuantity: z.number().nonnegative('Received Quantity cannot be negative').default(0),
  issuedQuantity: z.number().nonnegative('Issued Quantity cannot be negative').default(0),
  usedQuantity: z.number().nonnegative('Used Quantity cannot be negative').min(1, 'Used Quantity required'),
  unit: z.string().min(1, 'Unit required'),
  lotNo: z.string().default(''),
  mfgDate: z.string().default(''),
  expDate: z.string().default(''),
  retestDate: z.string().nullable().default(null),
  qcStatus: z.enum(QC_STATUSES),
  coaAvailable: z.enum(COA_AVAILABLE_OPTIONS),
  specificationNo: z.string().default(''),
  stpNo: z.string().default(''),
  testResultSummary: z.string().default(''),
  complianceStatus: z.enum(COMPLIANCE_STATUSES).default('Not Applicable'),
  complianceReasons: z.array(z.string()).default([]),
  remarks: z.string().default(''),
  createdBy: z.string().optional(),
  createdAt: z.string().optional(),
  updatedBy: z.string().optional(),
  updatedAt: z.string().optional(),
}).refine(
  (data) => {
    if (data.usedQuantity && data.issuedQuantity) {
      return data.usedQuantity <= data.issuedQuantity;
    }
    return true;
  },
  {
    message: 'Used Quantity cannot exceed Issued Quantity',
    path: ['usedQuantity'],
  }
).refine(
  (data) => {
    if (data.mfgDate && data.expDate) {
      return new Date(data.expDate) > new Date(data.mfgDate);
    }
    return true;
  },
  {
    message: 'Expiry Date must be after Manufacturing Date',
    path: ['expDate'],
  }
);

export type MaterialReview = z.infer<typeof materialReviewSchema>;

// ============= Audit Log Schema =============
export const auditLogMaterialSchema = z.object({
  id: z.string().optional(),
  module: z.string(),
  recordId: z.string(),
  fieldName: z.string(),
  oldValue: z.string(),
  newValue: z.string(),
  changedBy: z.string(),
  changedAt: z.string().optional(),
  reason: z.string().default(''),
});

export type AuditLogMaterial = z.infer<typeof auditLogMaterialSchema>;

// ============= Default Materials =============
export const DEFAULT_MATERIALS: Omit<MaterialMaster, 'id' | 'createdAt' | 'updatedAt'>[] = [
  {
    materialCode: 'API-001',
    materialName: 'Amikacin Sulphate IP',
    materialType: 'API',
    grade: 'IP',
    specificationNo: 'IS/IP',
    stpNo: '',
    approvedVendorRequired: true,
    storageCondition: 'Room Temperature',
    retestPeriod: '24 months',
    shelfLife: '36 months',
    status: 'Active',
    remarks: 'Imported API',
  },
  {
    materialCode: 'RM-001',
    materialName: 'Methyl Paraben IP',
    materialType: 'Preservative',
    grade: 'IP',
    specificationNo: 'IS/IP',
    stpNo: '',
    approvedVendorRequired: true,
    storageCondition: 'Room Temperature',
    retestPeriod: '12 months',
    shelfLife: '24 months',
    status: 'Active',
    remarks: 'Preservative - Local',
  },
  {
    materialCode: 'RM-002',
    materialName: 'Propyl Paraben IP',
    materialType: 'Preservative',
    grade: 'IP',
    specificationNo: 'IS/IP',
    stpNo: '',
    approvedVendorRequired: true,
    storageCondition: 'Room Temperature',
    retestPeriod: '12 months',
    shelfLife: '24 months',
    status: 'Active',
    remarks: 'Preservative - Local',
  },
  {
    materialCode: 'RM-003',
    materialName: 'Sodium Metabisulphite IP',
    materialType: 'Preservative',
    grade: 'IP',
    specificationNo: 'IS/IP',
    stpNo: '',
    approvedVendorRequired: true,
    storageCondition: 'Room Temperature',
    retestPeriod: '24 months',
    shelfLife: '36 months',
    status: 'Active',
    remarks: 'Antioxidant',
  },
  {
    materialCode: 'RM-004',
    materialName: 'Trisodium Citrate IP',
    materialType: 'Buffer',
    grade: 'IP',
    specificationNo: 'IS/IP',
    stpNo: '',
    approvedVendorRequired: true,
    storageCondition: 'Room Temperature',
    retestPeriod: '24 months',
    shelfLife: '36 months',
    status: 'Active',
    remarks: 'Buffer agent - Local',
  },
  {
    materialCode: 'RM-005',
    materialName: 'Sulphuric Acid IP',
    materialType: 'Solvent',
    grade: 'IP',
    specificationNo: 'IS/IP',
    stpNo: '',
    approvedVendorRequired: true,
    storageCondition: 'Cool Place',
    retestPeriod: '12 months',
    shelfLife: '24 months',
    status: 'Active',
    remarks: 'Chemical - Handle with care',
  },
  {
    materialCode: 'RM-006',
    materialName: 'Water for Injection IP',
    materialType: 'Solvent',
    grade: 'IP',
    specificationNo: 'IS/IP',
    stpNo: '',
    approvedVendorRequired: false,
    storageCondition: 'Room Temperature',
    retestPeriod: '6 months',
    shelfLife: '12 months',
    status: 'Active',
    remarks: 'In-house Generated',
  },
];
