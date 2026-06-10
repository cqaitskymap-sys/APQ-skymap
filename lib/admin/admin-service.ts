import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc,
  query, where, orderBy, limit, writeBatch, QueryConstraint,
} from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { firestore, auth } from '@/lib/firebase';
import { ADMIN_COLLECTIONS } from './constants';
import { createRecord, getRecords, getRecord, updateRecord, deleteRecord } from '@/lib/firestore-service';
import type { AdminAuditLog } from './schemas';

export async function logAuditEvent(
  event: Omit<AdminAuditLog, 'id' | 'dateTime'> & { status?: string },
  userId?: string
): Promise<void> {
  try {
    await addDoc(collection(firestore, ADMIN_COLLECTIONS.auditLogs), {
      ...event,
      dateTime: new Date().toISOString(),
      userId: event.userId || userId || 'system',
      status: event.status || 'Success',
    });
  } catch (error) {
    console.error('Audit log failed:', error);
  }
}

export async function checkUniqueField(
  collectionName: string,
  field: string,
  value: string,
  excludeId?: string
): Promise<boolean> {
  const q = query(collection(firestore, collectionName), where(field, '==', value));
  const snap = await getDocs(q);
  if (snap.empty) return true;
  if (excludeId) {
    return snap.docs.every((d) => d.id === excludeId);
  }
  return false;
}

export async function getAdminRecords<T extends Record<string, unknown>>(
  collectionName: string,
  constraints: QueryConstraint[] = []
): Promise<T[]> {
  return getRecords<T>(collectionName, [orderBy('createdAt', 'desc'), ...constraints]);
}

export async function createAdminRecord<T extends Record<string, unknown>>(
  collectionName: string,
  data: Omit<T, 'id'>,
  auditMeta: { userId: string; userName: string; module: string; action?: string }
): Promise<T> {
  const record = await createRecord<T>(collectionName, data as Omit<T, 'id'>, {
    createdBy: auditMeta.userId,
    updatedBy: auditMeta.userId,
  });

  await logAuditEvent({
    userId: auditMeta.userId,
    userName: auditMeta.userName,
    module: auditMeta.module,
    recordId: (record as { id?: string }).id || '',
    action: auditMeta.action || 'CREATE',
    oldValue: '',
    newValue: JSON.stringify(data),
    reason: '',
    ipAddress: typeof window !== 'undefined' ? 'client' : 'server',
    device: typeof navigator !== 'undefined' ? navigator.userAgent : 'server',
    status: 'Success',
  });

  return record;
}

export async function updateAdminRecord<T extends Record<string, unknown>>(
  collectionName: string,
  recordId: string,
  updates: Partial<T>,
  auditMeta: { userId: string; userName: string; module: string; oldValue?: string }
): Promise<T | null> {
  const existing = await getRecord<T>(collectionName, recordId);
  const record = await updateRecord<T>(collectionName, recordId, updates, {
    updatedBy: auditMeta.userId,
  });

  if (record) {
    await logAuditEvent({
      userId: auditMeta.userId,
      userName: auditMeta.userName,
      module: auditMeta.module,
      recordId,
      action: 'UPDATE',
      oldValue: auditMeta.oldValue || JSON.stringify(existing),
      newValue: JSON.stringify(updates),
      reason: '',
      ipAddress: 'client',
      device: typeof navigator !== 'undefined' ? navigator.userAgent : 'server',
      status: 'Success',
    });
  }

  return record;
}

export async function deleteAdminRecord(
  collectionName: string,
  recordId: string,
  auditMeta: { userId: string; userName: string; module: string }
): Promise<boolean> {
  const existing = await getRecord(collectionName, recordId);
  const success = await deleteRecord(collectionName, recordId);

  if (success) {
    await logAuditEvent({
      userId: auditMeta.userId,
      userName: auditMeta.userName,
      module: auditMeta.module,
      recordId,
      action: 'DELETE',
      oldValue: JSON.stringify(existing),
      newValue: '',
      reason: '',
      ipAddress: 'client',
      device: typeof navigator !== 'undefined' ? navigator.userAgent : 'server',
      status: 'Success',
    });
  }

  return success;
}

export async function createAuthUser(
  email: string,
  password: string,
  profileData: Record<string, unknown>
): Promise<{ uid: string | null; error: string | null }> {
  try {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    const uid = result.user.uid;

    await updateDoc(doc(firestore, 'profiles', uid), profileData as Record<string, string | boolean>).catch(async () => {
      const { setDoc } = await import('firebase/firestore');
      await setDoc(doc(firestore, 'profiles', uid), { id: uid, ...profileData });
    });

    return { uid, error: null };
  } catch (error) {
    return { uid: null, error: (error as Error).message };
  }
}

export async function getDashboardStats() {
  const collections = [
    ADMIN_COLLECTIONS.users,
    ADMIN_COLLECTIONS.departments,
    ADMIN_COLLECTIONS.products,
    ADMIN_COLLECTIONS.auditLogs,
  ];

  const [users, departments, products, auditLogs] = await Promise.all(
    collections.map((c) => getDocs(collection(firestore, c)).catch(() => ({ size: 0, docs: [] })))
  );

  const userDocs = users.docs?.map((d) => d.data()) || [];
  const activeUsers = userDocs.filter((u) => u.userStatus === 'Active' || u.status === 'Active').length;
  const inactiveUsers = userDocs.filter((u) => u.userStatus === 'Inactive' || u.status === 'Inactive').length;
  const pendingApprovals = userDocs.filter((u) => u.userStatus === 'Pending Approval').length;

  const auditCount = auditLogs.size || 0;

  return {
    totalUsers: userDocs.length,
    activeUsers,
    inactiveUsers,
    pendingApprovals,
    totalDepartments: departments.size || 0,
    totalProducts: products.size || 0,
    openDeviations: 0,
    openCapa: 0,
    openOos: 0,
    pendingPqr: 0,
    pendingCpvReview: 0,
    systemHealth: 'Healthy',
    auditTrailCount: auditCount,
  };
}

export async function getAuditLogs(filters?: {
  userId?: string;
  module?: string;
  action?: string;
  recordId?: string;
  startDate?: string;
  endDate?: string;
}) {
  const constraints: QueryConstraint[] = [orderBy('dateTime', 'desc'), limit(500)];

  if (filters?.module) constraints.unshift(where('module', '==', filters.module));
  if (filters?.action) constraints.unshift(where('action', '==', filters.action));
  if (filters?.userId) constraints.unshift(where('userId', '==', filters.userId));
  if (filters?.recordId) constraints.unshift(where('recordId', '==', filters.recordId));

  return getRecords<AdminAuditLog>(ADMIN_COLLECTIONS.auditLogs, constraints);
}

export async function generateDocumentNumber(modulePrefix: string): Promise<string | null> {
  const q = query(
    collection(firestore, ADMIN_COLLECTIONS.documentNumbering),
    where('prefix', '==', modulePrefix),
    limit(1)
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;

  const docRef = snap.docs[0];
  const data = docRef.data();
  const nextNum = (data.currentNumber || 0) + 1;
  const year = new Date().getFullYear();
  const padded = String(nextNum).padStart(data.runningNumber || 4, '0');
  const sep = data.separator || '/';

  const number = [
    data.prefix,
    data.siteCode,
    padded,
    data.departmentCode,
    year,
  ].filter(Boolean).join(sep);

  await updateDoc(docRef.ref, { currentNumber: nextNum, updatedAt: new Date().toISOString() });
  return number;
}

export async function seedDefaultData(userId: string) {
  const deptSnap = await getDocs(collection(firestore, ADMIN_COLLECTIONS.departments));
  if (deptSnap.empty) {
    const { DEFAULT_DEPARTMENTS, DEFAULT_DESIGNATIONS } = await import('./constants');
    const batch = writeBatch(firestore);
    const now = new Date().toISOString();

    DEFAULT_DEPARTMENTS.forEach((dept) => {
      const ref = doc(collection(firestore, ADMIN_COLLECTIONS.departments));
      batch.set(ref, { ...dept, status: 'Active', createdBy: userId, updatedBy: userId, createdAt: now, updatedAt: now });
    });

    DEFAULT_DESIGNATIONS.forEach((des) => {
      const ref = doc(collection(firestore, ADMIN_COLLECTIONS.designations));
      batch.set(ref, { ...des, status: 'Active', createdBy: userId, updatedBy: userId, createdAt: now, updatedAt: now });
    });

    await batch.commit();
  }
}

export { ADMIN_COLLECTIONS };
