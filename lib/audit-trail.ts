import { collection, addDoc } from 'firebase/firestore';
import { getFirebaseFirestore, isFirebaseConfigured } from './firebase';

export const AUDIT_TRAIL_COLLECTION = 'audit_trail';

export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'STATUS_CHANGE' | 'APPROVE' | 'REJECT' | 'LOGIN' | 'LOGOUT';

export interface AuditTrailEntry {
  id?: string;
  collectionName: string;
  documentId: string;
  action: AuditAction | string;
  oldValue: unknown;
  newValue: unknown;
  userId: string;
  userName: string;
  timestamp: string;
  ipAddress?: string;
  moduleName: string;
}

export interface AuditActor {
  id?: string;
  name?: string;
  role?: string;
}

function nowIso() {
  return new Date().toISOString();
}

function getClientIp(): string | undefined {
  if (typeof window === 'undefined') return 'server';
  return 'client';
}

export async function writeAuditTrail(
  entry: Omit<AuditTrailEntry, 'timestamp' | 'ipAddress'> & { ipAddress?: string },
  collectionName = AUDIT_TRAIL_COLLECTION,
): Promise<string | null> {
  if (!isFirebaseConfigured()) {
    console.warn('Audit trail skipped: Firebase not configured');
    return null;
  }
  try {
    const db = getFirebaseFirestore();
    const docRef = await addDoc(collection(db, collectionName), {
      collectionName: entry.collectionName,
      documentId: entry.documentId,
      action: entry.action,
      oldValue: entry.oldValue ?? null,
      newValue: entry.newValue ?? null,
      userId: entry.userId || 'system',
      userName: entry.userName || 'System',
      timestamp: nowIso(),
      ipAddress: entry.ipAddress ?? getClientIp(),
      moduleName: entry.moduleName,
    });
    return docRef.id;
  } catch (error) {
    console.error('Audit trail write failed:', error);
    return null;
  }
}

export async function auditCreate(
  collectionName: string,
  documentId: string,
  moduleName: string,
  actor: AuditActor,
  newValue: unknown,
) {
  return writeAuditTrail({
    collectionName,
    documentId,
    action: 'CREATE',
    oldValue: null,
    newValue,
    userId: actor.id || 'system',
    userName: actor.name || 'System',
    moduleName,
  });
}

export async function auditUpdate(
  collectionName: string,
  documentId: string,
  moduleName: string,
  actor: AuditActor,
  oldValue: unknown,
  newValue: unknown,
  action: AuditAction = 'UPDATE',
) {
  return writeAuditTrail({
    collectionName,
    documentId,
    action,
    oldValue,
    newValue,
    userId: actor.id || 'system',
    userName: actor.name || 'System',
    moduleName,
  });
}

export async function auditDelete(
  collectionName: string,
  documentId: string,
  moduleName: string,
  actor: AuditActor,
  oldValue: unknown,
) {
  return writeAuditTrail({
    collectionName,
    documentId,
    action: 'DELETE',
    oldValue,
    newValue: { isDeleted: true },
    userId: actor.id || 'system',
    userName: actor.name || 'System',
    moduleName,
  });
}
