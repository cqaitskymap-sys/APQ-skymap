import { collection, addDoc } from 'firebase/firestore';
import { getFirebaseFirestore, isFirebaseConfigured } from './firebase';
import { AUDIT_LOG_STATUSES } from './admin/constants';

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
  department?: string;
}

export interface CreateAuditLogInput {
  moduleName: string;
  collectionName: string;
  recordId: string;
  documentNumber?: string;
  actionType: string;
  actionDescription?: string;
  fieldName?: string;
  oldValue?: unknown;
  newValue?: unknown;
  reason?: string;
  user: AuditActor;
  status?: typeof AUDIT_LOG_STATUSES[number];
  eSignatureRequired?: boolean;
  eSignatureStatus?: string;
  location?: string;
  ipAddress?: string;
  deviceInfo?: string;
  browserInfo?: string;
}

const SKIP_COMPARE_FIELDS = new Set([
  'updatedAt', 'updatedBy', 'createdAt', 'createdBy', 'id', 'isDeleted',
]);

function nowIso() {
  return new Date().toISOString();
}

function buildAuditId() {
  const ts = Date.now().toString(36).toUpperCase();
  const rnd = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `AUD-${ts}-${rnd}`;
}

function getClientIp(): string {
  if (typeof window === 'undefined') return 'server';
  return 'client';
}

function getBrowserInfo(): string {
  if (typeof navigator === 'undefined') return 'server';
  return navigator.userAgent;
}

function getDeviceInfo(): string {
  if (typeof navigator === 'undefined') return 'server';
  const ua = navigator.userAgent;
  if (/Mobile|Android|iPhone/i.test(ua)) return 'Mobile';
  if (/Tablet|iPad/i.test(ua)) return 'Tablet';
  return 'Desktop';
}

function serializeValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/**
 * GMP / 21 CFR Part 11 compliant append-only audit log writer.
 * All modules should use this function for audit events.
 */
export async function createAuditLog(
  input: CreateAuditLogInput,
  collectionName = AUDIT_TRAIL_COLLECTION,
): Promise<string | null> {
  if (!isFirebaseConfigured()) {
    console.warn('Audit log skipped: Firebase not configured');
    return null;
  }

  const dateTime = nowIso();
  const auditId = buildAuditId();
  const userId = input.user.id || 'system';
  const userName = input.user.name || 'System';

  const entry = {
    auditId,
    dateTime,
    timestamp: dateTime,
    moduleName: input.moduleName,
    collectionName: input.collectionName,
    recordId: input.recordId,
    documentId: input.recordId,
    documentNumber: input.documentNumber || '',
    actionType: input.actionType,
    action: input.actionType,
    actionDescription: input.actionDescription || `${input.actionType} on ${input.moduleName}`,
    fieldName: input.fieldName || '',
    oldValue: serializeValue(input.oldValue),
    newValue: serializeValue(input.newValue),
    changedByUserId: userId,
    changedByUserName: userName,
    changedByRole: input.user.role || '',
    userId,
    userName,
    department: input.user.department || '',
    reasonForChange: input.reason || '',
    reason: input.reason || '',
    ipAddress: input.ipAddress ?? getClientIp(),
    deviceInfo: input.deviceInfo ?? getDeviceInfo(),
    device: input.deviceInfo ?? getDeviceInfo(),
    browserInfo: input.browserInfo ?? getBrowserInfo(),
    location: input.location || '',
    eSignatureRequired: input.eSignatureRequired ?? false,
    eSignatureStatus: input.eSignatureStatus || '',
    status: input.status || 'Success',
    appendOnly: true,
  };

  try {
    const db = getFirebaseFirestore();
    const docRef = await addDoc(collection(db, collectionName), entry);
    return docRef.id;
  } catch (error) {
    console.error('Audit log write failed:', error);
    return null;
  }
}

export async function writeAuditTrail(
  entry: Omit<AuditTrailEntry, 'timestamp' | 'ipAddress'> & { ipAddress?: string },
  collectionName = AUDIT_TRAIL_COLLECTION,
): Promise<string | null> {
  return createAuditLog({
    moduleName: entry.moduleName,
    collectionName: entry.collectionName,
    recordId: entry.documentId,
    actionType: String(entry.action),
    oldValue: entry.oldValue,
    newValue: entry.newValue,
    user: { id: entry.userId, name: entry.userName },
    ipAddress: entry.ipAddress,
  }, collectionName);
}

export async function auditCreate(
  collectionName: string,
  documentId: string,
  moduleName: string,
  actor: AuditActor,
  newValue: unknown,
) {
  return createAuditLog({
    moduleName,
    collectionName,
    recordId: documentId,
    actionType: 'Create',
    actionDescription: `Created record in ${collectionName}`,
    newValue,
    user: actor,
    status: 'Success',
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
  const actionType = action === 'STATUS_CHANGE' ? 'Status Change' : 'Update';
  return createAuditLog({
    moduleName,
    collectionName,
    recordId: documentId,
    actionType,
    oldValue,
    newValue,
    user: actor,
    status: 'Success',
  });
}

export async function auditDelete(
  collectionName: string,
  documentId: string,
  moduleName: string,
  actor: AuditActor,
  oldValue: unknown,
) {
  return createAuditLog({
    moduleName,
    collectionName,
    recordId: documentId,
    actionType: 'Delete',
    oldValue,
    newValue: { isDeleted: true },
    user: actor,
    status: 'Success',
  });
}

export async function createFieldChangeAuditLogs(
  params: {
    moduleName: string;
    collectionName: string;
    recordId: string;
    documentNumber?: string;
    oldData: Record<string, unknown>;
    newData: Record<string, unknown>;
    user: AuditActor;
    reason?: string;
    fieldsToTrack?: string[];
  },
): Promise<number> {
  const keys = params.fieldsToTrack
    ?? Object.keys({ ...params.oldData, ...params.newData }).filter((k) => !SKIP_COMPARE_FIELDS.has(k));

  let count = 0;
  for (const field of keys) {
    const oldVal = params.oldData[field];
    const newVal = params.newData[field];
    const oldStr = serializeValue(oldVal);
    const newStr = serializeValue(newVal);
    if (oldStr === newStr) continue;

    await createAuditLog({
      moduleName: params.moduleName,
      collectionName: params.collectionName,
      recordId: params.recordId,
      documentNumber: params.documentNumber,
      actionType: 'Update',
      actionDescription: `Field "${field}" changed`,
      fieldName: field,
      oldValue: oldVal,
      newValue: newVal,
      reason: params.reason,
      user: params.user,
      status: 'Success',
    });
    count += 1;
  }
  return count;
}
