import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  writeBatch,
  Timestamp,
} from 'firebase/firestore';
import { getFirebaseFirestore } from './firebase';

// ============= TYPES =============

export interface PackagingMaterial {
  id: string;
  materialCode: string;
  materialName: string;
  materialType: 'Primary Packaging' | 'Secondary Packaging' | 'Tertiary Packaging';
  materialCategory: string;
  specificationNo: string;
  stpNo: string;
  packSize: string;
  unit: string;
  storageCondition: string;
  status: 'Active' | 'Inactive' | 'Discontinued';
  remarks: string;
  createdBy: string;
  createdAt: string;
  updatedBy: string;
  updatedAt: string;
}

export interface PackagingReview {
  id: string;
  pqrId: string;
  batchNo: string;
  productName: string;
  packagingMaterialId: string;
  packagingMaterial: string;
  materialCode: string;
  materialType: string;
  manufacturer: string;
  supplier: string;
  vendorAvlStatus: 'Approved' | 'Not Approved' | 'Pending';
  arNo: string;
  lotNo: string;
  quantityReceived: number;
  quantityIssued: number;
  quantityUsed: number;
  quantityRejected: number;
  quantityReturned: number;
  unit: string;
  mfgDate: string;
  expDate: string;
  coaAvailable: boolean;
  qcStatus: 'Approved' | 'Rejected' | 'Pending' | 'On Hold';
  specificationNo: string;
  stpNo: string;
  complianceStatus: 'Compliant' | 'Non-Compliant' | 'Pending';
  remarks: string;
  balanceQty: number;
  reconciliationStatus: 'Matched' | 'Mismatch' | 'Pending';
  createdBy: string;
  createdAt: string;
  updatedBy: string;
  updatedAt: string;
}

export interface PackagingVendorReview {
  id: string;
  vendorName: string;
  materialSupplied: string[];
  totalLotsReceived: number;
  totalLotsApproved: number;
  totalLotsRejected: number;
  approvalPercentage: number;
  rejectionPercentage: number;
  complaintCount: number;
  riskCategory: 'Low' | 'Medium' | 'High';
  lastUpdated: string;
  createdBy: string;
  createdAt: string;
}

export interface ReconciliationRecord {
  id: string;
  packagingReviewId: string;
  quantityReceived: number;
  quantityUsed: number;
  quantityRejected: number;
  quantityReturned: number;
  balanceQty: number;
  status: 'Matched' | 'Mismatch';
  variance: number;
  varianceReason: string;
  resolvedBy: string | null;
  resolvedAt: string | null;
  createdAt: string;
}

export interface PackagingAuditTrail {
  id: string;
  action: 'Create' | 'Edit' | 'Delete' | 'Import' | 'Export' | 'Approval' | 'Vendor Status Change' | 'Compliance Change';
  entityType: 'Material' | 'Review' | 'Vendor' | 'Reconciliation';
  entityId: string;
  changes: Record<string, any>;
  performedBy: string;
  performedAt: string;
}

function calculateReviewState(
  review: Pick<
    PackagingReview,
    | 'quantityReceived'
    | 'quantityUsed'
    | 'quantityRejected'
    | 'quantityReturned'
    | 'vendorAvlStatus'
    | 'qcStatus'
    | 'coaAvailable'
    | 'expDate'
  >
) {
  const balanceQty =
    review.quantityReceived -
    review.quantityUsed -
    review.quantityRejected -
    review.quantityReturned;
  const reconciliationStatus = balanceQty === 0 ? 'Matched' : 'Mismatch';
  const isExpired = Boolean(review.expDate && new Date(review.expDate) < new Date());
  const compliant =
    review.vendorAvlStatus === 'Approved' &&
    review.qcStatus === 'Approved' &&
    review.coaAvailable &&
    !isExpired &&
    reconciliationStatus === 'Matched';

  return {
    balanceQty,
    reconciliationStatus,
    complianceStatus: compliant ? 'Compliant' : 'Non-Compliant',
  } as const;
}

// ============= PACKAGING MATERIAL OPERATIONS =============

export async function createPackagingMaterial(
  material: Omit<PackagingMaterial, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'>,
  userId: string
): Promise<PackagingMaterial> {
  const now = new Date().toISOString();
  const docRef = await addDoc(collection(getFirebaseFirestore(), 'packaging_material_master'), {
    ...material,
    createdBy: userId,
    createdAt: now,
    updatedBy: userId,
    updatedAt: now,
  });

  const createdMaterial = {
    id: docRef.id,
    ...material,
    createdBy: userId,
    createdAt: now,
    updatedBy: userId,
    updatedAt: now,
  };

  await logAuditTrail({
    action: 'Create',
    entityType: 'Material',
    entityId: docRef.id,
    changes: material,
    performedBy: userId,
  });

  return createdMaterial;
}

export async function getPackagingMaterial(id: string): Promise<PackagingMaterial> {
  const docRef = doc(getFirebaseFirestore(), 'packaging_material_master', id);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    throw new Error('Packaging material not found');
  }

  return { id: docSnap.id, ...docSnap.data() } as PackagingMaterial;
}

export async function getPackagingMaterials(filters?: {
  materialType?: string;
  status?: string;
  search?: string;
}): Promise<PackagingMaterial[]> {
  const constraints: any[] = [];

  if (filters?.materialType) {
    constraints.push(where('materialType', '==', filters.materialType));
  }

  if (filters?.status) {
    constraints.push(where('status', '==', filters.status));
  }

  constraints.push(orderBy('materialCode', 'asc'));

  const q = query(collection(getFirebaseFirestore(), 'packaging_material_master'), ...constraints);
  const querySnapshot = await getDocs(q);

  let results = querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as PackagingMaterial));

  if (filters?.search) {
    const searchLower = filters.search.toLowerCase();
    results = results.filter(
      (m) =>
        m.materialCode?.toLowerCase().includes(searchLower) ||
        m.materialName?.toLowerCase().includes(searchLower)
    );
  }

  return results;
}

export async function updatePackagingMaterial(
  id: string,
  updates: Partial<Omit<PackagingMaterial, 'id' | 'createdAt' | 'createdBy'>>,
  userId: string
): Promise<void> {
  const docRef = doc(getFirebaseFirestore(), 'packaging_material_master', id);
  const now = new Date().toISOString();

  await updateDoc(docRef, {
    ...updates,
    updatedBy: userId,
    updatedAt: now,
  });

  await logAuditTrail({
    action: 'Edit',
    entityType: 'Material',
    entityId: id,
    changes: updates,
    performedBy: userId,
  });
}

export async function deletePackagingMaterial(id: string, userId: string): Promise<void> {
  const docRef = doc(getFirebaseFirestore(), 'packaging_material_master', id);
  await deleteDoc(docRef);

  await logAuditTrail({
    action: 'Delete',
    entityType: 'Material',
    entityId: id,
    changes: { deleted: true },
    performedBy: userId,
  });
}

// ============= PACKAGING REVIEW OPERATIONS =============

export async function createPackagingReview(
  review: Omit<PackagingReview, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy' | 'balanceQty' | 'reconciliationStatus' | 'complianceStatus'>,
  userId: string
): Promise<PackagingReview> {
  const now = new Date().toISOString();
  const state = calculateReviewState(review);

  const docRef = await addDoc(collection(getFirebaseFirestore(), 'packaging_reviews'), {
    ...review,
    ...state,
    createdBy: userId,
    createdAt: now,
    updatedBy: userId,
    updatedAt: now,
  });

  const createdReview: PackagingReview = {
    id: docRef.id,
    ...review,
    ...state,
    createdBy: userId,
    createdAt: now,
    updatedBy: userId,
    updatedAt: now,
  };

  await createReconciliation({
    packagingReviewId: docRef.id,
    quantityReceived: review.quantityReceived,
    quantityUsed: review.quantityUsed,
    quantityRejected: review.quantityRejected,
    quantityReturned: review.quantityReturned,
    balanceQty: state.balanceQty,
    status: state.reconciliationStatus,
    variance: state.balanceQty,
    varianceReason: '',
    resolvedBy: null,
    resolvedAt: null,
  }, userId);

  await logAuditTrail({
    action: 'Create',
    entityType: 'Review',
    entityId: docRef.id,
    changes: { ...review, ...state },
    performedBy: userId,
  });

  await syncPackagingVendorReviews(userId);
  return createdReview;
}

export async function getPackagingReview(id: string): Promise<PackagingReview> {
  const docRef = doc(getFirebaseFirestore(), 'packaging_reviews', id);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    throw new Error('Packaging review not found');
  }

  return { id: docSnap.id, ...docSnap.data() } as PackagingReview;
}

export async function getPackagingReviews(filters?: {
  pqrId?: string;
  batchNo?: string;
  materialType?: string;
  complianceStatus?: string;
  search?: string;
}): Promise<PackagingReview[]> {
  const constraints: any[] = [];

  if (filters?.pqrId) {
    constraints.push(where('pqrId', '==', filters.pqrId));
  }

  if (filters?.batchNo) {
    constraints.push(where('batchNo', '==', filters.batchNo));
  }

  if (filters?.materialType) {
    constraints.push(where('materialType', '==', filters.materialType));
  }

  if (filters?.complianceStatus) {
    constraints.push(where('complianceStatus', '==', filters.complianceStatus));
  }

  constraints.push(orderBy('createdAt', 'desc'));

  const db = getFirebaseFirestore();
  const col = collection(db, 'packaging_reviews');

  let querySnapshot;
  try {
    querySnapshot = await getDocs(query(col, ...constraints));
  } catch (error) {
    const code = (error as { code?: string })?.code;
    const needsIndex =
      code === 'failed-precondition' ||
      String((error as Error)?.message ?? '').includes('requires an index');
    if (!needsIndex || constraints.length <= 1) throw error;

    // Composite index still building — fetch with filters only, sort client-side.
    const filterConstraints = constraints.slice(0, -1);
    querySnapshot = await getDocs(query(col, ...filterConstraints));
  }

  let results = querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as PackagingReview));

  if (results.length > 1 && constraints.length > 1) {
    results.sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime;
    });
  }

  if (filters?.search) {
    const searchLower = filters.search.toLowerCase();
    results = results.filter(
      (r) =>
        r.batchNo?.toLowerCase().includes(searchLower) ||
        r.materialCode?.toLowerCase().includes(searchLower) ||
        r.packagingMaterial?.toLowerCase().includes(searchLower)
    );
  }

  return results;
}

export async function updatePackagingReview(
  id: string,
  updates: Partial<Omit<PackagingReview, 'id' | 'createdAt' | 'createdBy'>>,
  userId: string
): Promise<PackagingReview> {
  const docRef = doc(getFirebaseFirestore(), 'packaging_reviews', id);
  const now = new Date().toISOString();

  const currentReview = await getPackagingReview(id);
  const mergedReview = { ...currentReview, ...updates };
  const state = calculateReviewState(mergedReview);
  const dataToUpdate = { ...updates, ...state };

  await updateDoc(docRef, {
    ...dataToUpdate,
    updatedBy: userId,
    updatedAt: now,
  });

  await logAuditTrail({
    action: 'Edit',
    entityType: 'Review',
    entityId: id,
    changes: updates,
    performedBy: userId,
  });

  await syncPackagingVendorReviews(userId);
  return getPackagingReview(id);
}

export async function deletePackagingReview(id: string, userId: string): Promise<void> {
  const docRef = doc(getFirebaseFirestore(), 'packaging_reviews', id);
  await deleteDoc(docRef);

  await logAuditTrail({
    action: 'Delete',
    entityType: 'Review',
    entityId: id,
    changes: { deleted: true },
    performedBy: userId,
  });

  await syncPackagingVendorReviews(userId);
}

// ============= PACKAGING VENDOR REVIEW OPERATIONS =============

export async function createPackagingVendorReview(
  vendorReview: Omit<PackagingVendorReview, 'id' | 'createdAt' | 'createdBy' | 'lastUpdated'>,
  userId: string
): Promise<PackagingVendorReview> {
  const now = new Date().toISOString();
  const docRef = await addDoc(collection(getFirebaseFirestore(), 'packaging_vendor_review'), {
    ...vendorReview,
    createdBy: userId,
    createdAt: now,
    lastUpdated: now,
  });

  return {
    id: docRef.id,
    ...vendorReview,
    createdBy: userId,
    createdAt: now,
    lastUpdated: now,
  };
}

export async function getPackagingVendorReview(id: string): Promise<PackagingVendorReview> {
  const docRef = doc(getFirebaseFirestore(), 'packaging_vendor_review', id);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    throw new Error('Vendor review not found');
  }

  return { id: docSnap.id, ...docSnap.data() } as PackagingVendorReview;
}

export async function getPackagingVendorReviews(): Promise<PackagingVendorReview[]> {
  const q = query(collection(getFirebaseFirestore(), 'packaging_vendor_review'), orderBy('vendorName', 'asc'));
  const querySnapshot = await getDocs(q);

  return querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as PackagingVendorReview));
}

export async function updatePackagingVendorReview(
  id: string,
  updates: Partial<Omit<PackagingVendorReview, 'id' | 'createdAt' | 'createdBy'>>,
  userId: string
): Promise<void> {
  const docRef = doc(getFirebaseFirestore(), 'packaging_vendor_review', id);
  const now = new Date().toISOString();

  await updateDoc(docRef, {
    ...updates,
    lastUpdated: now,
  });

  await logAuditTrail({
    action: 'Vendor Status Change',
    entityType: 'Vendor',
    entityId: id,
    changes: updates,
    performedBy: userId,
  });
}

export async function calculateVendorMetrics(vendorName: string): Promise<Partial<PackagingVendorReview>> {
  const reviews = await getPackagingReviews();
  const vendorReviews = reviews.filter((r) => r.supplier === vendorName);

  if (vendorReviews.length === 0) {
    return {
      totalLotsReceived: 0,
      totalLotsApproved: 0,
      totalLotsRejected: 0,
      approvalPercentage: 0,
      rejectionPercentage: 0,
      riskCategory: 'Low',
    };
  }

  const approved = vendorReviews.filter((r) => r.complianceStatus === 'Compliant').length;
  const rejected = vendorReviews.filter((r) => r.complianceStatus === 'Non-Compliant').length;
  const total = vendorReviews.length;

  const rejectionPercentage = (rejected / total) * 100;
  let riskCategory: 'Low' | 'Medium' | 'High' = 'Low';
  
  if (rejectionPercentage > 5) {
    riskCategory = 'High';
  } else if (rejectionPercentage > 2) {
    riskCategory = 'Medium';
  }

  return {
    totalLotsReceived: total,
    totalLotsApproved: approved,
    totalLotsRejected: rejected,
    approvalPercentage: (approved / total) * 100,
    rejectionPercentage,
    riskCategory,
  };
}

export async function syncPackagingVendorReviews(userId: string): Promise<void> {
  const [reviews, existingVendors] = await Promise.all([
    getPackagingReviews(),
    getPackagingVendorReviews(),
  ]);
  const vendorNames = Array.from(
    new Set(reviews.map((review) => review.supplier.trim()).filter(Boolean))
  );

  for (const vendorName of vendorNames) {
    const vendorReviews = reviews.filter((review) => review.supplier.trim() === vendorName);
    const totalLotsReceived = vendorReviews.length;
    const totalLotsApproved = vendorReviews.filter(
      (review) => review.complianceStatus === 'Compliant'
    ).length;
    const totalLotsRejected = vendorReviews.filter(
      (review) => review.complianceStatus === 'Non-Compliant'
    ).length;
    const approvalPercentage =
      totalLotsReceived > 0 ? (totalLotsApproved / totalLotsReceived) * 100 : 0;
    const rejectionPercentage =
      totalLotsReceived > 0 ? (totalLotsRejected / totalLotsReceived) * 100 : 0;
    const riskCategory =
      rejectionPercentage > 5 ? 'High' : rejectionPercentage > 2 ? 'Medium' : 'Low';
    const materialSupplied = Array.from(
      new Set(vendorReviews.map((review) => review.packagingMaterial).filter(Boolean))
    );
    const existing = existingVendors.find((vendor) => vendor.vendorName === vendorName);
    const metrics = {
      vendorName,
      materialSupplied,
      totalLotsReceived,
      totalLotsApproved,
      totalLotsRejected,
      approvalPercentage,
      rejectionPercentage,
      complaintCount: existing?.complaintCount ?? 0,
      riskCategory: riskCategory as PackagingVendorReview['riskCategory'],
    };

    if (existing) {
      await updatePackagingVendorReview(existing.id, metrics, userId);
    } else {
      await createPackagingVendorReview(metrics, userId);
    }
  }
}

// ============= RECONCILIATION OPERATIONS =============

export async function createReconciliation(
  reconciliation: Omit<ReconciliationRecord, 'id' | 'createdAt'>,
  userId: string
): Promise<ReconciliationRecord> {
  const now = new Date().toISOString();
  const docRef = await addDoc(collection(getFirebaseFirestore(), 'packaging_reconciliation'), {
    ...reconciliation,
    createdAt: now,
  });

  return {
    id: docRef.id,
    ...reconciliation,
    createdAt: now,
  };
}

export async function getReconciliation(id: string): Promise<ReconciliationRecord> {
  const docRef = doc(getFirebaseFirestore(), 'packaging_reconciliation', id);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    throw new Error('Reconciliation record not found');
  }

  return { id: docSnap.id, ...docSnap.data() } as ReconciliationRecord;
}

export async function getReconciliations(packagingReviewId?: string): Promise<ReconciliationRecord[]> {
  const constraints: any[] = [];

  if (packagingReviewId) {
    constraints.push(where('packagingReviewId', '==', packagingReviewId));
  }

  constraints.push(orderBy('createdAt', 'desc'));

  const q = query(collection(getFirebaseFirestore(), 'packaging_reconciliation'), ...constraints);
  const querySnapshot = await getDocs(q);

  return querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as ReconciliationRecord));
}

export async function resolveReconciliation(
  id: string,
  reason: string,
  userId: string
): Promise<void> {
  const docRef = doc(getFirebaseFirestore(), 'packaging_reconciliation', id);
  const now = new Date().toISOString();

  await updateDoc(docRef, {
    status: 'Matched',
    varianceReason: reason,
    resolvedBy: userId,
    resolvedAt: now,
  });
}

// ============= COMPLIANCE ENGINE =============

export async function checkCompliance(reviewId: string): Promise<{
  compliant: boolean;
  reasons: string[];
}> {
  const review = await getPackagingReview(reviewId);

  const reasons: string[] = [];
  let compliant = true;

  // Check vendor approval
  if (review.vendorAvlStatus !== 'Approved') {
    reasons.push('Vendor not approved');
    compliant = false;
  }

  // Check QC status
  if (review.qcStatus !== 'Approved') {
    reasons.push('QC not approved');
    compliant = false;
  }

  // Check COA
  if (!review.coaAvailable) {
    reasons.push('COA not available');
    compliant = false;
  }

  // Check expiry
  if (review.expDate) {
    const expDate = new Date(review.expDate);
    if (expDate < new Date()) {
      reasons.push('Material expired');
      compliant = false;
    }
  }

  // Check reconciliation
  if (review.reconciliationStatus !== 'Matched') {
    reasons.push('Reconciliation mismatch');
    compliant = false;
  }

  return {
    compliant,
    reasons,
  };
}

export async function updateCompliance(reviewId: string, userId: string): Promise<void> {
  const { compliant } = await checkCompliance(reviewId);
  const docRef = doc(getFirebaseFirestore(), 'packaging_reviews', reviewId);

  await updateDoc(docRef, {
    complianceStatus: compliant ? 'Compliant' : 'Non-Compliant',
    updatedBy: userId,
    updatedAt: new Date().toISOString(),
  });

  await logAuditTrail({
    action: 'Compliance Change',
    entityType: 'Review',
    entityId: reviewId,
    changes: { complianceStatus: compliant ? 'Compliant' : 'Non-Compliant' },
    performedBy: userId,
  });
}

// ============= AUDIT TRAIL =============

export async function logAuditTrail(
  auditLog: Omit<PackagingAuditTrail, 'id' | 'performedAt'>
): Promise<void> {
  const now = new Date().toISOString();
  await addDoc(collection(getFirebaseFirestore(), 'packaging_audit_trail'), {
    ...auditLog,
    performedAt: now,
  });
}

export async function getAuditTrail(entityId?: string): Promise<PackagingAuditTrail[]> {
  const constraints: any[] = [];

  if (entityId) {
    constraints.push(where('entityId', '==', entityId));
  }

  constraints.push(orderBy('performedAt', 'desc'));

  const q = query(collection(getFirebaseFirestore(), 'packaging_audit_trail'), ...constraints);
  const querySnapshot = await getDocs(q);

  return querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as PackagingAuditTrail));
}

// ============= ANALYTICS =============

export async function getPackagingAnalytics() {
  const reviews = await getPackagingReviews();
  const materials = await getPackagingMaterials();
  const vendors = await getPackagingVendorReviews();

  const totalLots = reviews.length;
  const approvedLots = reviews.filter((r) => r.complianceStatus === 'Compliant').length;
  const rejectedLots = reviews.filter((r) => r.complianceStatus === 'Non-Compliant').length;
  const pendingLots = reviews.filter((r) => r.complianceStatus === 'Pending').length;
  const matchedReconciliation = reviews.filter((r) => r.reconciliationStatus === 'Matched').length;
  const mismatchReconciliation = reviews.filter((r) => r.reconciliationStatus === 'Mismatch').length;

  return {
    totalLots,
    approvedLots,
    rejectedLots,
    pendingLots,
    compliantLots: approvedLots,
    nonCompliantLots: rejectedLots,
    vendorCount: vendors.length,
    materialCount: materials.length,
    matchedReconciliation,
    mismatchReconciliation,
    reconciliationComplianceRate: totalLots > 0 ? (matchedReconciliation / totalLots) * 100 : 0,
  };
}

// ============= DEFAULT DATA INITIALIZATION =============

export const DEFAULT_PACKAGING_MATERIALS = [
  // Primary Packaging
  {
    materialCode: 'PKG-PRI-001',
    materialName: 'Glass Vial 2ml',
    materialType: 'Primary Packaging',
    materialCategory: 'Glass Vials',
    specificationNo: 'SPEC-2024-001',
    stpNo: 'STP-2024-001',
    packSize: '2ml',
    unit: 'Vials',
    storageCondition: 'Room Temperature, Dry Place',
    status: 'Active',
    remarks: 'Clear Borosilicate Glass',
  },
  {
    materialCode: 'PKG-PRI-002',
    materialName: 'Rubber Stopper 13mm',
    materialType: 'Primary Packaging',
    materialCategory: 'Stoppers',
    specificationNo: 'SPEC-2024-002',
    stpNo: 'STP-2024-002',
    packSize: '13mm',
    unit: 'Pieces',
    storageCondition: 'Room Temperature, Dark Place',
    status: 'Active',
    remarks: 'Butyl Rubber',
  },
  {
    materialCode: 'PKG-PRI-003',
    materialName: 'Flip Off Seal 13mm',
    materialType: 'Primary Packaging',
    materialCategory: 'Seals',
    specificationNo: 'SPEC-2024-003',
    stpNo: 'STP-2024-003',
    packSize: '13mm',
    unit: 'Pieces',
    storageCondition: 'Room Temperature',
    status: 'Active',
    remarks: 'Aluminum with Plastic Ring',
  },
  // Secondary Packaging
  {
    materialCode: 'PKG-SEC-001',
    materialName: 'Label',
    materialType: 'Secondary Packaging',
    materialCategory: 'Labels',
    specificationNo: 'SPEC-2024-004',
    stpNo: 'STP-2024-004',
    packSize: 'A4',
    unit: 'Sheets',
    storageCondition: 'Room Temperature, Dry Place',
    status: 'Active',
    remarks: 'Printed with Product Info',
  },
  {
    materialCode: 'PKG-SEC-002',
    materialName: 'Carton',
    materialType: 'Secondary Packaging',
    materialCategory: 'Cartons',
    specificationNo: 'SPEC-2024-005',
    stpNo: 'STP-2024-005',
    packSize: 'Standard',
    unit: 'Boxes',
    storageCondition: 'Room Temperature',
    status: 'Active',
    remarks: 'Corrugated Box',
  },
  {
    materialCode: 'PKG-SEC-003',
    materialName: 'Package Insert / Leaflet',
    materialType: 'Secondary Packaging',
    materialCategory: 'Leaflets',
    specificationNo: 'SPEC-2024-006',
    stpNo: 'STP-2024-006',
    packSize: 'A5',
    unit: 'Leaflets',
    storageCondition: 'Room Temperature, Dry Place',
    status: 'Active',
    remarks: 'Folded Printed Sheet',
  },
  // Tertiary Packaging
  {
    materialCode: 'PKG-TER-001',
    materialName: 'Shipper Box',
    materialType: 'Tertiary Packaging',
    materialCategory: 'Shippers',
    specificationNo: 'SPEC-2024-007',
    stpNo: 'STP-2024-007',
    packSize: 'Large',
    unit: 'Boxes',
    storageCondition: 'Room Temperature',
    status: 'Active',
    remarks: 'Double Wall Corrugated',
  },
  {
    materialCode: 'PKG-TER-002',
    materialName: 'PVC Film',
    materialType: 'Tertiary Packaging',
    materialCategory: 'Films',
    specificationNo: 'SPEC-2024-008',
    stpNo: 'STP-2024-008',
    packSize: 'Roll',
    unit: 'Meters',
    storageCondition: 'Room Temperature, Dark Place',
    status: 'Active',
    remarks: 'Transparent PVC',
  },
  {
    materialCode: 'PKG-TER-003',
    materialName: 'BOPP Tape',
    materialType: 'Tertiary Packaging',
    materialCategory: 'Tapes',
    specificationNo: 'SPEC-2024-009',
    stpNo: 'STP-2024-009',
    packSize: 'Roll',
    unit: 'Meters',
    storageCondition: 'Room Temperature',
    status: 'Active',
    remarks: 'Biaxially Oriented Polypropylene',
  },
];

export async function initializeDefaultPackagingMaterials(userId: string): Promise<void> {
  const existingMaterials = await getPackagingMaterials();

  if (existingMaterials.length > 0) {
    return; // Already initialized
  }

  const batch = writeBatch(getFirebaseFirestore());
  const now = new Date().toISOString();

  DEFAULT_PACKAGING_MATERIALS.forEach((material) => {
    const docRef = doc(collection(getFirebaseFirestore(), 'packaging_material_master'));
    batch.set(docRef, {
      ...material,
      createdBy: userId,
      createdAt: now,
      updatedBy: userId,
      updatedAt: now,
    });
  });

  await batch.commit();
}
