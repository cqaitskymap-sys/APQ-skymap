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
  QueryConstraint,
  DocumentSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import { firestore } from './firebase';

interface GenericRecord {
  id?: string;
  [key: string]: unknown;
}

export interface FirestoreActor {
  id?: string;
  name?: string;
  role?: string;
}

export interface PaginatedResult<T> {
  items: T[];
  hasMore: boolean;
  lastDoc: DocumentSnapshot | null;
}

const DEFAULT_AUDIT_COLLECTION = 'audit_trail';

function nowIso() {
  return new Date().toISOString();
}

export async function writeAuditTrail(
  action: string,
  module: string,
  recordId: string,
  actor: FirestoreActor,
  payload?: unknown,
  collectionName = DEFAULT_AUDIT_COLLECTION,
) {
  try {
    await addDoc(collection(firestore, collectionName), {
      action,
      module,
      recordId,
      actorId: actor.id || 'system',
      actorName: actor.name || 'System',
      actorRole: actor.role || 'unknown',
      payload: payload ?? null,
      timestamp: nowIso(),
      serverTimestamp: serverTimestamp(),
    });
  } catch (error) {
    console.error('Audit trail write failed:', error);
  }
}

/**
 * Generic CRUD operations for Firestore
 */

export async function createRecord<T extends GenericRecord>(
  collectionName: string,
  data: Omit<T, 'id'>,
  metadata?: { createdBy?: string; updatedBy?: string; createdByName?: string },
  audit?: { module: string; actor: FirestoreActor },
): Promise<T> {
  try {
    const now = nowIso();
    const docRef = await addDoc(collection(firestore, collectionName), {
      ...data,
      createdAt: now,
      updatedAt: now,
      ...(metadata?.createdBy && { createdBy: metadata.createdBy }),
      ...(metadata?.createdByName && { createdByName: metadata.createdByName }),
      ...(metadata?.updatedBy && { updatedBy: metadata.updatedBy }),
    });

    if (audit) {
      await writeAuditTrail('CREATE', audit.module, docRef.id, audit.actor, data);
    }

    return { id: docRef.id, ...data, createdAt: now, updatedAt: now } as unknown as T;
  } catch (error) {
    console.error(`Error creating record in ${collectionName}:`, error);
    throw error;
  }
}

export async function getRecord<T extends GenericRecord>(
  collectionName: string,
  recordId: string
): Promise<T | null> {
  try {
    const docRef = doc(firestore, collectionName, recordId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    return { id: docSnap.id, ...docSnap.data() } as T;
  } catch (error) {
    console.error(`Error fetching record from ${collectionName}:`, error);
    return null;
  }
}

export async function getRecords<T extends GenericRecord>(
  collectionName: string,
  constraints?: QueryConstraint[]
): Promise<T[]> {
  try {
    const q = query(collection(firestore, collectionName), ...(constraints || []));
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as T[];
  } catch (error) {
    console.error(`Error fetching records from ${collectionName}:`, error);
    return [];
  }
}

export async function getRecordsPaginated<T extends GenericRecord>(
  collectionName: string,
  pageSize = 25,
  cursor: DocumentSnapshot | null = null,
  constraints: QueryConstraint[] = [],
): Promise<PaginatedResult<T>> {
  try {
    const base = [
      orderBy('createdAt', 'desc'),
      ...constraints,
      limit(pageSize + 1),
    ] as QueryConstraint[];

    const q = cursor
      ? query(collection(firestore, collectionName), ...base, startAfter(cursor))
      : query(collection(firestore, collectionName), ...base);

    const snapshot = await getDocs(q);
    const docs = snapshot.docs;
    const hasMore = docs.length > pageSize;
    const pageDocs = hasMore ? docs.slice(0, pageSize) : docs;

    return {
      items: pageDocs.map((d) => ({ id: d.id, ...d.data() } as T)),
      hasMore,
      lastDoc: pageDocs.length ? pageDocs[pageDocs.length - 1] : null,
    };
  } catch (error) {
    console.error(`Error paginating ${collectionName}:`, error);
    return { items: [], hasMore: false, lastDoc: null };
  }
}

export async function updateRecord<T extends GenericRecord>(
  collectionName: string,
  recordId: string,
  updates: Partial<Omit<T, 'id' | 'createdAt' | 'createdBy'>>,
  metadata?: { updatedBy?: string; updatedByName?: string },
  audit?: { module: string; actor: FirestoreActor },
): Promise<T | null> {
  try {
    const docRef = doc(firestore, collectionName, recordId);
    const now = nowIso();

    await updateDoc(docRef, {
      ...updates,
      updatedAt: now,
      ...(metadata?.updatedBy && { updatedBy: metadata.updatedBy }),
      ...(metadata?.updatedByName && { updatedByName: metadata.updatedByName }),
    });

    if (audit) {
      await writeAuditTrail('UPDATE', audit.module, recordId, audit.actor, updates);
    }

    const updatedDoc = await getDoc(docRef);
    return { id: updatedDoc.id, ...updatedDoc.data() } as T;
  } catch (error) {
    console.error(`Error updating record in ${collectionName}:`, error);
    return null;
  }
}

export async function deleteRecord(
  collectionName: string,
  recordId: string,
  audit?: { module: string; actor: FirestoreActor },
): Promise<boolean> {
  try {
    const docRef = doc(firestore, collectionName, recordId);
    await deleteDoc(docRef);
    if (audit) {
      await writeAuditTrail('DELETE', audit.module, recordId, audit.actor);
    }
    return true;
  } catch (error) {
    console.error(`Error deleting record from ${collectionName}:`, error);
    return false;
  }
}

export async function recordExists(
  collectionName: string,
  recordId: string
): Promise<boolean> {
  try {
    const docRef = doc(firestore, collectionName, recordId);
    const docSnap = await getDoc(docRef);
    return docSnap.exists();
  } catch (error) {
    return false;
  }
}
