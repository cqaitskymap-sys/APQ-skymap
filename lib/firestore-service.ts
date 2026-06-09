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
  QueryConstraint,
} from 'firebase/firestore';
import { firestore } from './firebase';

interface GenericRecord {
  id?: string;
  [key: string]: any;
}

/**
 * Generic CRUD operations for Firestore
 */

export async function createRecord<T extends GenericRecord>(
  collectionName: string,
  data: Omit<T, 'id'>,
  metadata?: { createdBy?: string; updatedBy?: string }
): Promise<T> {
  const now = new Date().toISOString();
  const docRef = await addDoc(collection(firestore, collectionName), {
    ...data,
    createdAt: now,
    updatedAt: now,
    ...(metadata?.createdBy && { createdBy: metadata.createdBy }),
    ...(metadata?.updatedBy && { updatedBy: metadata.updatedBy }),
  });

  return { id: docRef.id, ...data } as T;
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

export async function updateRecord<T extends GenericRecord>(
  collectionName: string,
  recordId: string,
  updates: Partial<Omit<T, 'id' | 'createdAt' | 'createdBy'>>,
  metadata?: { updatedBy?: string }
): Promise<T | null> {
  try {
    const docRef = doc(firestore, collectionName, recordId);
    const now = new Date().toISOString();

    await updateDoc(docRef, {
      ...updates,
      updatedAt: now,
      ...(metadata?.updatedBy && { updatedBy: metadata.updatedBy }),
    });

    const updatedDoc = await getDoc(docRef);
    return { id: updatedDoc.id, ...updatedDoc.data() } as T;
  } catch (error) {
    console.error(`Error updating record in ${collectionName}:`, error);
    return null;
  }
}

export async function deleteRecord(
  collectionName: string,
  recordId: string
): Promise<boolean> {
  try {
    const docRef = doc(firestore, collectionName, recordId);
    await deleteDoc(docRef);
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
