import {
  EmailAuthProvider, reauthenticateWithCredential,
} from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { createAuditLog } from '@/lib/audit-trail';
import { getFirebaseAuth, getFirebaseFirestore, isFirebaseConfigured } from '@/lib/firebase';
import { createRecord, getRecords } from '@/lib/firestore-service';
import {
  createSignatureSession, completeSignatureSession, persistEnterpriseSignature, getClientDeviceInfo,
} from '@/lib/electronic-signatures-service';
import { ADMIN_COLLECTIONS } from './constants';
import {
  fetchActiveEsignSetting, fetchEsignSettings, normalizeEsignSetting,
} from './esign-settings-service';
import type { EsignRecord, EsignSettings } from './schemas';

export interface PerformEsignInput {
  moduleName: string;
  recordId: string;
  documentNumber?: string;
  actionType: string;
  signatureMeaning?: string;
  password?: string;
  reasonComment?: string;
  confirmed?: boolean;
  userId: string;
  userName: string;
  userEmail: string;
  userRole?: string;
  department?: string;
  isTest?: boolean;
}

export interface PerformEsignResult {
  success: boolean;
  record?: EsignRecord;
  error?: string;
  locked?: boolean;
}

function buildEsignRecordId(): string {
  return `ESR-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

function getDeviceInfo(): string {
  return getClientDeviceInfo().device;
}

export async function fetchEsignRecords(): Promise<EsignRecord[]> {
  try {
    const records = await getRecords<EsignRecord>(ADMIN_COLLECTIONS.esignRecords, []);
    return records.sort((a, b) => String(b.signedDateTime).localeCompare(String(a.signedDateTime)));
  } catch {
    return [];
  }
}

export async function fetchEsignRecordsForRecord(recordId: string): Promise<EsignRecord[]> {
  const all = await fetchEsignRecords();
  return all.filter((r) => r.recordId === recordId && !r.isTest);
}

export function getEsignRecordsSummary(records: EsignRecord[]) {
  return {
    totalRecords: records.filter((r) => !r.isTest).length,
    failedAttempts: records.filter((r) => r.authenticationStatus === 'Failed').length,
    testSignatures: records.filter((r) => r.isTest).length,
  };
}

async function getUserLockState(userId: string): Promise<{ failedAttempts: number; lockedUntil: string | null }> {
  if (!isFirebaseConfigured()) return { failedAttempts: 0, lockedUntil: null };
  const snap = await getDoc(doc(getFirebaseFirestore(), ADMIN_COLLECTIONS.users, userId));
  if (!snap.exists()) return { failedAttempts: 0, lockedUntil: null };
  const data = snap.data();
  return {
    failedAttempts: Number(data.esignFailedAttempts ?? 0),
    lockedUntil: data.esignLockedUntil ? String(data.esignLockedUntil) : null,
  };
}

async function incrementFailedAttempts(
  userId: string,
  maxAttempts: number,
  lockAccount: boolean,
): Promise<{ locked: boolean; attempts: number }> {
  if (!isFirebaseConfigured()) return { locked: false, attempts: 0 };
  const ref = doc(getFirebaseFirestore(), ADMIN_COLLECTIONS.users, userId);
  const snap = await getDoc(ref);
  const current = Number(snap.data()?.esignFailedAttempts ?? 0) + 1;
  const locked = lockAccount && current >= maxAttempts;
  const lockedUntil = locked ? new Date(Date.now() + 30 * 60 * 1000).toISOString() : null;

  await updateDoc(ref, {
    esignFailedAttempts: current,
    esignLockedUntil: lockedUntil,
    updatedAt: new Date().toISOString(),
  });

  return { locked, attempts: current };
}

async function resetFailedAttempts(userId: string): Promise<void> {
  if (!isFirebaseConfigured()) return;
  const ref = doc(getFirebaseFirestore(), ADMIN_COLLECTIONS.users, userId);
  await updateDoc(ref, {
    esignFailedAttempts: 0,
    esignLockedUntil: null,
    updatedAt: new Date().toISOString(),
  }).catch(() => undefined);
}

async function saveEsignRecord(data: Omit<EsignRecord, 'id'>): Promise<EsignRecord> {
  return createRecord<EsignRecord>(
    ADMIN_COLLECTIONS.esignRecords,
    data as Omit<EsignRecord, 'id' | 'createdAt' | 'updatedAt' | 'isDeleted'>,
    { moduleName: 'E-Signature', actor: { id: data.userId, name: data.userName } },
  );
}

export async function performEsign(input: PerformEsignInput): Promise<PerformEsignResult> {
  const setting = await fetchActiveEsignSetting(input.moduleName, input.actionType);
  if (!setting && !input.isTest) {
    return { success: false, error: `No active e-signature setting for ${input.moduleName} / ${input.actionType}` };
  }

  const normalized = setting ? normalizeEsignSetting(setting) : null;
  const lockState = await getUserLockState(input.userId);
  if (lockState.lockedUntil && new Date(lockState.lockedUntil) > new Date()) {
    return { success: false, error: 'Account is temporarily locked due to failed e-signature attempts', locked: true };
  }

  if (normalized?.requireActiveSession && !input.userId) {
    return { success: false, error: 'Active session required' };
  }

  if (!input.confirmed) {
    return { success: false, error: 'Electronic signature confirmation is required' };
  }

  let sessionId = '';
  try {
    sessionId = await createSignatureSession(input.userId, input.moduleName, input.recordId, input.actionType);
  } catch { /* session optional */ }

  const clientInfo = getClientDeviceInfo();

  const meaning = input.signatureMeaning || normalized?.signatureMeaning || '';
  if (normalized?.requireCommentReason && !input.reasonComment?.trim()) {
    return { success: false, error: 'Reason or comment is required' };
  }

  if (normalized?.requirePasswordReAuthentication) {
    if (!input.password) {
      return { success: false, error: 'Password is required for re-authentication' };
    }
    if (!isFirebaseConfigured()) {
      return { success: false, error: 'Firebase not configured' };
    }
    try {
      const auth = getFirebaseAuth();
      const currentUser = auth.currentUser;
      if (!currentUser || currentUser.uid !== input.userId) {
        return { success: false, error: 'You can only sign as the logged-in user' };
      }
      const credential = EmailAuthProvider.credential(input.userEmail, input.password);
      await reauthenticateWithCredential(currentUser, credential);
    } catch (e) {
      const maxAttempts = normalized?.maxFailedEsignAttempts ?? 3;
      const lockResult = await incrementFailedAttempts(
        input.userId,
        maxAttempts,
        normalized?.lockAccountAfterFailedAttempts ?? true,
      );

      const failedRecord = await saveEsignRecord({
        esignRecordId: buildEsignRecordId(),
        moduleName: input.moduleName,
        recordId: input.recordId,
        documentNumber: input.documentNumber || '',
        actionType: input.actionType,
        signatureMeaning: meaning,
        userId: input.userId,
        userName: input.userName,
        userEmail: input.userEmail,
        userRole: input.userRole || '',
        department: input.department || '',
        signedDateTime: new Date().toISOString(),
        reasonComment: input.reasonComment || '',
        ipAddress: clientInfo.ip,
        deviceInfo: clientInfo.device,
        authenticationStatus: 'Failed',
        status: 'Failed',
        isTest: input.isTest ?? false,
      });

      await createAuditLog({
        moduleName: input.moduleName,
        collectionName: ADMIN_COLLECTIONS.esignRecords,
        recordId: input.recordId,
        documentNumber: input.documentNumber,
        actionType: 'E-Signature',
        actionDescription: 'Failed e-signature attempt',
        user: { id: input.userId, name: input.userName, role: input.userRole, department: input.department },
        status: 'Failed',
        newValue: { attempts: lockResult.attempts },
      });

      if (lockResult.locked) {
        await createAuditLog({
          moduleName: 'Admin',
          collectionName: ADMIN_COLLECTIONS.users,
          recordId: input.userId,
          actionType: 'Override',
          actionDescription: 'Account locked due to failed e-signature attempts',
          user: { id: input.userId, name: input.userName },
          status: 'Success',
        });
      }

      return {
        success: false,
        error: lockResult.locked
          ? 'Maximum failed attempts reached. Account temporarily locked.'
          : 'Password re-authentication failed',
        locked: lockResult.locked,
        record: failedRecord,
      };
    }
  }

  await resetFailedAttempts(input.userId);

  const record = await saveEsignRecord({
    esignRecordId: buildEsignRecordId(),
    moduleName: input.moduleName,
    recordId: input.recordId,
    documentNumber: input.documentNumber || '',
    actionType: input.actionType,
    signatureMeaning: meaning,
    userId: input.userId,
    userName: input.userName,
    userEmail: input.userEmail,
    userRole: input.userRole || '',
    department: input.department || '',
    signedDateTime: new Date().toISOString(),
    reasonComment: input.reasonComment || '',
    ipAddress: clientInfo.ip,
    deviceInfo: clientInfo.device,
    authenticationStatus: 'Success',
    status: input.isTest ? 'Test' : 'Signed',
    isTest: input.isTest ?? false,
  });

  try {
    await persistEnterpriseSignature(record, { sessionId });
    await completeSignatureSession(sessionId, true);
  } catch { /* enterprise store optional during migration */ }

  await createAuditLog({
    moduleName: input.moduleName,
    collectionName: ADMIN_COLLECTIONS.esignRecords,
    recordId: input.recordId,
    documentNumber: input.documentNumber,
    actionType: 'E-Signature',
    actionDescription: input.isTest ? 'Test e-signature' : 'Successful e-signature',
    fieldName: 'actionType',
    newValue: input.actionType,
    reason: input.reasonComment,
    user: { id: input.userId, name: input.userName, role: input.userRole, department: input.department },
    status: 'Success',
    eSignatureRequired: true,
    eSignatureStatus: 'Signed',
  });

  return { success: true, record };
}

/** Backward-compatible global settings reader */
export async function getEsignSettings(): Promise<EsignSettings | null> {
  const settings = await fetchEsignSettings();
  return settings.find((s) => s.status === 'Active') ?? settings[0] ?? null;
}
