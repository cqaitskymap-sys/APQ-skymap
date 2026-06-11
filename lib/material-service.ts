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
  Query,
  writeBatch,
} from 'firebase/firestore';
import { firestore } from './firebase';
import { MaterialMaster, VendorMaster, MaterialReview, AuditLogMaterial, DEFAULT_MATERIALS } from './material-schemas';

// ============= MATERIAL MASTER OPERATIONS =============

export async function createMaterialMaster(
  material: Omit<MaterialMaster, 'id' | 'createdAt' | 'updatedAt'>,
  userId: string
) {
  const now = new Date().toISOString();
  const docRef = await addDoc(collection(firestore, 'material_master'), {
    ...material,
    createdBy: userId,
    createdAt: now,
    updatedBy: userId,
    updatedAt: now,
  });
  
  return { id: docRef.id, ...material, createdBy: userId, createdAt: now, updatedBy: userId, updatedAt: now };
}

export async function getMaterialMasterById(id: string) {
  const docRef = doc(firestore, 'material_master', id);
  const docSnap = await getDoc(docRef);
  
  if (!docSnap.exists()) {
    throw new Error('Material not found');
  }
  
  return { id: docSnap.id, ...docSnap.data() } as MaterialMaster;
}

export async function getMaterialMasters(
  filters?: {
    materialType?: string;
    status?: string;
    search?: string;
  }
) {
  const constraints: any[] = [];

  if (filters?.materialType) {
    constraints.push(where('materialType', '==', filters.materialType));
  }

  if (filters?.status) {
    constraints.push(where('status', '==', filters.status));
  }

  constraints.push(orderBy('materialCode', 'asc'));

  const q = query(collection(firestore, 'material_master'), ...constraints);
  const querySnapshot = await getDocs(q);
  
  let results = querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as MaterialMaster));

  // Client-side search if provided
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

export async function updateMaterialMaster(
  id: string,
  updates: Partial<Omit<MaterialMaster, 'id' | 'createdBy' | 'createdAt'>>,
  userId: string
) {
  const docRef = doc(firestore, 'material_master', id);
  const now = new Date().toISOString();
  
  await updateDoc(docRef, {
    ...updates,
    updatedBy: userId,
    updatedAt: now,
  });

  const docSnap = await getDoc(docRef);
  return { id: docSnap.id, ...docSnap.data() } as MaterialMaster;
}

export async function deleteMaterialMaster(id: string) {
  const docRef = doc(firestore, 'material_master', id);
  await deleteDoc(docRef);
}

/**
 * Initialize default materials if not already present
 */
export async function initializeDefaultMaterials() {
  const q = query(collection(firestore, 'material_master'), limit(1));
  const querySnapshot = await getDocs(q);

  if (querySnapshot.docs.length > 0) {
    return; // Materials already exist
  }

  const batch = writeBatch(firestore);
  const now = new Date().toISOString();

  DEFAULT_MATERIALS.forEach((material) => {
    const docRef = doc(collection(firestore, 'material_master'));
    batch.set(docRef, {
      ...material,
      createdBy: 'system',
      createdAt: now,
      updatedBy: 'system',
      updatedAt: now,
    });
  });

  await batch.commit();
}

// ============= VENDOR MASTER OPERATIONS =============

export async function createVendorMaster(
  vendor: Omit<VendorMaster, 'id' | 'createdAt' | 'updatedAt'>,
  userId: string
) {
  const now = new Date().toISOString();
  const docRef = await addDoc(collection(firestore, 'vendor_master'), {
    ...vendor,
    createdBy: userId,
    createdAt: now,
    updatedBy: userId,
    updatedAt: now,
  });

  return { id: docRef.id, ...vendor, createdBy: userId, createdAt: now, updatedBy: userId, updatedAt: now };
}

export async function getVendorMasterById(id: string) {
  const docRef = doc(firestore, 'vendor_master', id);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    throw new Error('Vendor not found');
  }

  return { id: docSnap.id, ...docSnap.data() } as VendorMaster;
}

export async function getVendorMasters(
  filters?: {
    vendorType?: string;
    avlStatus?: string;
    status?: string;
    search?: string;
    materialService?: string;
  }
) {
  const constraints: any[] = [];

  if (filters?.vendorType) {
    constraints.push(where('vendorType', '==', filters.vendorType));
  }

  if (filters?.avlStatus) {
    constraints.push(where('avlStatus', '==', filters.avlStatus));
  }

  if (filters?.status) {
    constraints.push(where('status', '==', filters.status));
  }

  constraints.push(orderBy('vendorCode', 'asc'));

  const q = query(collection(firestore, 'vendor_master'), ...constraints);
  const querySnapshot = await getDocs(q);

  let results = querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as VendorMaster));

  // Merge approved vendors from QMS Vendor Management module
  const wantsApproved = !filters?.avlStatus || ['Approved', 'Conditional Approved'].includes(filters.avlStatus);
  if (wantsApproved) {
    try {
      const { listSelectableVendors } = await import('./vendor-mgmt-service');
      const qmsVendors = await listSelectableVendors(filters?.materialService);
      const mapped: VendorMaster[] = qmsVendors.map((v) => ({
        id: v.id,
        vendorCode: v.vendor_code,
        vendorName: v.vendor_name,
        vendorType: 'Supplier',
        materialSupplied: v.material_service_supplied,
        manufacturerName: v.manufacturer_name,
        supplierName: v.supplier_name,
        address: v.address,
        country: v.country,
        avlStatus: v.approval_status === 'Conditionally Approved' ? 'Conditional Approved' : 'Approved',
        approvalDate: null,
        approvalExpiryDate: null,
        lastAuditDate: null,
        nextAuditDueDate: v.next_audit_due,
        riskCategory: (['Low', 'Medium', 'High'].includes(v.risk_category) ? v.risk_category : 'High') as VendorMaster['riskCategory'],
        status: v.vendor_status === 'Blocked' ? 'Blocked' : v.vendor_status === 'Inactive' ? 'Inactive' : 'Active',
        remarks: v.remarks,
      }));
      const existingCodes = new Set(results.map((r) => r.vendorCode));
      for (const m of mapped) {
        if (!existingCodes.has(m.vendorCode)) results.push(m);
      }
    } catch {
      // QMS vendor module unavailable — legacy vendors only
    }
  }

  if (filters?.avlStatus === 'Approved') {
    results = results.filter((v) => v.avlStatus === 'Approved' || v.avlStatus === 'Conditional Approved');
  }

  // Client-side search if provided
  if (filters?.search) {
    const searchLower = filters.search.toLowerCase();
    results = results.filter(
      (v) =>
        v.vendorCode?.toLowerCase().includes(searchLower) ||
        v.vendorName?.toLowerCase().includes(searchLower)
    );
  }

  return results;
}

export async function updateVendorMaster(
  id: string,
  updates: Partial<Omit<VendorMaster, 'id' | 'createdBy' | 'createdAt'>>,
  userId: string
) {
  const docRef = doc(firestore, 'vendor_master', id);
  const now = new Date().toISOString();

  await updateDoc(docRef, {
    ...updates,
    updatedBy: userId,
    updatedAt: now,
  });

  const docSnap = await getDoc(docRef);
  return { id: docSnap.id, ...docSnap.data() } as VendorMaster;
}

export async function deleteVendorMaster(id: string) {
  const docRef = doc(firestore, 'vendor_master', id);
  await deleteDoc(docRef);
}

// ============= MATERIAL REVIEW OPERATIONS =============

export async function createMaterialReview(
  review: Omit<MaterialReview, 'id' | 'createdAt' | 'updatedAt'>,
  userId: string
) {
  const now = new Date().toISOString();
  const docRef = await addDoc(collection(firestore, 'material_review'), {
    ...review,
    createdBy: userId,
    createdAt: now,
    updatedBy: userId,
    updatedAt: now,
  });

  return { id: docRef.id, ...review, createdBy: userId, createdAt: now, updatedBy: userId, updatedAt: now };
}

export async function getMaterialReviewById(id: string) {
  const docRef = doc(firestore, 'material_review', id);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    throw new Error('Material review not found');
  }

  return { id: docSnap.id, ...docSnap.data() } as MaterialReview;
}

export async function getMaterialReviewsByPQR(
  pqrId: string,
  filters?: {
    materialType?: string;
    materialName?: string;
    batchNo?: string;
    manufacturer?: string;
    supplier?: string;
    qcStatus?: string;
    avlStatus?: string;
    complianceStatus?: string;
    dateFrom?: string;
    dateTo?: string;
  }
) {
  const constraints: any[] = [where('pqrId', '==', pqrId)];

  if (filters?.materialType) {
    constraints.push(where('materialType', '==', filters.materialType));
  }

  if (filters?.qcStatus) {
    constraints.push(where('qcStatus', '==', filters.qcStatus));
  }

  if (filters?.avlStatus) {
    constraints.push(where('avlStatus', '==', filters.avlStatus));
  }

  if (filters?.complianceStatus) {
    constraints.push(where('complianceStatus', '==', filters.complianceStatus));
  }

  constraints.push(orderBy('createdAt', 'desc'));

  const q = query(collection(firestore, 'material_review'), ...constraints);
  const querySnapshot = await getDocs(q);

  let results = querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as MaterialReview));

  // Client-side filtering for text search and date ranges
  if (filters?.materialName) {
    const searchLower = filters.materialName.toLowerCase();
    results = results.filter((r) => r.materialName?.toLowerCase().includes(searchLower));
  }

  if (filters?.batchNo) {
    const searchLower = filters.batchNo.toLowerCase();
    results = results.filter((r) => r.batchNo?.toLowerCase().includes(searchLower));
  }

  if (filters?.manufacturer) {
    const searchLower = filters.manufacturer.toLowerCase();
    results = results.filter((r) => r.manufacturerName?.toLowerCase().includes(searchLower));
  }

  if (filters?.supplier) {
    const searchLower = filters.supplier.toLowerCase();
    results = results.filter((r) => r.supplierName?.toLowerCase().includes(searchLower));
  }

  if (filters?.dateFrom) {
    results = results.filter((r) => Boolean(r.createdAt && r.createdAt >= filters.dateFrom!));
  }

  if (filters?.dateTo) {
    results = results.filter((r) => Boolean(r.createdAt && r.createdAt <= filters.dateTo!));
  }

  return results;
}

export async function updateMaterialReview(
  id: string,
  updates: Partial<Omit<MaterialReview, 'id' | 'createdBy' | 'createdAt' | 'pqrId'>>,
  userId: string
) {
  const docRef = doc(firestore, 'material_review', id);
  const now = new Date().toISOString();

  await updateDoc(docRef, {
    ...updates,
    updatedBy: userId,
    updatedAt: now,
  });

  const docSnap = await getDoc(docRef);
  return { id: docSnap.id, ...docSnap.data() } as MaterialReview;
}

export async function deleteMaterialReview(id: string) {
  const docRef = doc(firestore, 'material_review', id);
  await deleteDoc(docRef);
}

// ============= AUDIT LOG OPERATIONS =============

export async function logMaterialAudit(
  audit: Omit<AuditLogMaterial, 'id' | 'changedAt'>,
  userId: string
) {
  const now = new Date().toISOString();
  const docRef = await addDoc(collection(firestore, 'audit_logs_material'), {
    ...audit,
    changedAt: now,
  });

  return { id: docRef.id, ...audit, changedAt: now };
}

export async function getMaterialAuditLogs(
  filters?: {
    module?: string;
    recordId?: string;
    dateFrom?: string;
    dateTo?: string;
  }
) {
  const constraints: any[] = [];

  if (filters?.module) {
    constraints.push(where('module', '==', filters.module));
  }

  if (filters?.recordId) {
    constraints.push(where('recordId', '==', filters.recordId));
  }

  constraints.push(orderBy('changedAt', 'desc'));

  const q = query(collection(firestore, 'audit_logs_material'), ...constraints);
  const querySnapshot = await getDocs(q);

  let results = querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as AuditLogMaterial));

  // Client-side filtering for date ranges
  if (filters?.dateFrom) {
    results = results.filter((r) => Boolean(r.changedAt && r.changedAt >= filters.dateFrom!));
  }

  if (filters?.dateTo) {
    results = results.filter((r) => Boolean(r.changedAt && r.changedAt <= filters.dateTo!));
  }

  return results;
}

// ============= VALIDATION HELPERS =============

export async function checkDuplicateARNo(arNo: string, excludeId?: string): Promise<boolean> {
  const q = query(collection(firestore, 'material_review'), where('arNo', '==', arNo));
  const querySnapshot = await getDocs(q);

  if (excludeId) {
    return querySnapshot.docs.some((doc) => doc.id !== excludeId);
  }

  return querySnapshot.docs.length > 0;
}

export async function checkMaterialExists(materialId: string): Promise<boolean> {
  try {
    const docRef = doc(firestore, 'material_master', materialId);
    const docSnap = await getDoc(docRef);
    return docSnap.exists();
  } catch (error) {
    return false;
  }
}

export async function checkVendorExists(vendorId: string): Promise<boolean> {
  try {
    const docRef = doc(firestore, 'vendor_master', vendorId);
    const docSnap = await getDoc(docRef);
    return docSnap.exists();
  } catch (error) {
    return false;
  }
}
