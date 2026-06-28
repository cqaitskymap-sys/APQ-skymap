import {
  addDoc, collection, doc, getDoc, getDocs, limit, orderBy, query, setDoc, updateDoc, where,
} from 'firebase/firestore';
import { getFirebaseFirestore } from '@/lib/firebase';
import { getRecords } from '@/lib/firestore-service';
import { downloadCsv } from '@/lib/export-utils';
import { logAuditEvent } from '@/lib/admin/admin-service';
import type { EsignRecord } from '@/lib/admin/schemas';
import type { ElectronicSignatureRecord, SignatureFilters, SignatureActor } from './electronic-signatures-types';
import {
  mapSignatureRaw, mapEsignRecordToSignature, computeSignatureKpis, computeSignatureCharts,
  filterSignatureRecords, emptySignatureKpis, emptySignatureCharts,
} from './electronic-signatures-records';
import {
  ESIG_COLLECTIONS, DEFAULT_SIGNATURE_MEANINGS,
} from './electronic-signatures-types';

function now() { return new Date().toISOString(); }

async function audit(actor: SignatureActor, action: string, recordId: string, oldValue: unknown, newValue: unknown, reason = '') {
  await logAuditEvent({
    userId: actor.id, userName: actor.name, module: 'Electronic Signatures', recordId, action,
    oldValue: oldValue ? JSON.stringify(oldValue) : '',
    newValue: newValue ? JSON.stringify(newValue) : '',
    reason, ipAddress: 'client', device: typeof navigator !== 'undefined' ? navigator.userAgent : 'server',
    status: 'Success',
  });
}

export async function generateTamperEvidentHash(payload: Record<string, string>): Promise<string> {
  const str = JSON.stringify(payload);
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  let h = 0;
  for (let i = 0; i < str.length; i++) h = ((h << 5) - h) + str.charCodeAt(i);
  return Math.abs(h).toString(16).padStart(64, '0');
}

export function getClientDeviceInfo(): { device: string; browser: string; ip: string } {
  if (typeof navigator === 'undefined') return { device: 'server', browser: 'server', ip: 'server' };
  const ua = navigator.userAgent;
  const device = /Mobile|Android|iPhone/i.test(ua) ? 'Mobile' : 'Desktop';
  const browser = ua.match(/(Chrome|Firefox|Safari|Edge|Opera)\/[\d.]+/)?.[0] || ua.slice(0, 60);
  return { device, browser, ip: 'client' };
}

export function generateSessionId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `SES-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function createSignatureSession(
  userId: string, module: string, entityId: string, action: string,
): Promise<string> {
  const sessionId = generateSessionId();
  await addDoc(collection(getFirebaseFirestore(), ESIG_COLLECTIONS.sessions), {
    session_id: sessionId, user_id: userId, module, entity_id: entityId, action,
    status: 'initiated', initiated_at: now(), ip_address: getClientDeviceInfo().ip,
  });
  return sessionId;
}

export async function completeSignatureSession(sessionId: string, success: boolean): Promise<void> {
  const snap = await getDocs(query(
    collection(getFirebaseFirestore(), ESIG_COLLECTIONS.sessions),
    where('session_id', '==', sessionId),
    limit(1),
  ));
  if (!snap.empty) {
    await updateDoc(snap.docs[0].ref, {
      status: success ? 'completed' : 'failed',
      completed_at: now(),
    });
  }
}

export async function persistEnterpriseSignature(
  esignRecord: EsignRecord,
  opts?: { sessionId?: string; dualRequired?: boolean },
): Promise<ElectronicSignatureRecord> {
  const client = getClientDeviceInfo();
  const hashPayload = {
    esignRecordId: esignRecord.esignRecordId,
    module: esignRecord.moduleName,
    recordId: esignRecord.recordId,
    userId: esignRecord.userId,
    signedDateTime: esignRecord.signedDateTime,
    meaning: esignRecord.signatureMeaning,
    action: esignRecord.actionType,
  };
  const hash = await generateTamperEvidentHash(hashPayload);

  const payload = {
    signature_id: esignRecord.esignRecordId,
    signature_number: esignRecord.esignRecordId,
    entity_type: esignRecord.moduleName,
    entity_id: esignRecord.recordId,
    reference_number: esignRecord.documentNumber,
    module: esignRecord.moduleName,
    action: esignRecord.actionType,
    signature_meaning: esignRecord.signatureMeaning,
    reason: esignRecord.reasonComment,
    signer_user_id: esignRecord.userId,
    signer_name: esignRecord.userName,
    signer_role: esignRecord.userRole,
    department: esignRecord.department,
    email: esignRecord.userEmail,
    signature_method: esignRecord.isTest ? 'Test' : 'Password Re-authentication',
    authentication_result: esignRecord.authenticationStatus,
    signed_at: esignRecord.signedDateTime,
    ip_address: esignRecord.ipAddress || client.ip,
    device_information: esignRecord.deviceInfo || client.device,
    browser_information: client.browser,
    session_id: opts?.sessionId || '',
    hash_value: hash,
    status: esignRecord.status,
    dual_signature_required: opts?.dualRequired ?? false,
    dual_signature_completed: false,
    esign_record_id: esignRecord.esignRecordId,
    created_at: esignRecord.signedDateTime,
    immutable: true,
  };

  const ref = await addDoc(collection(getFirebaseFirestore(), ESIG_COLLECTIONS.signatures), payload);
  return mapSignatureRaw({ id: ref.id, ...payload });
}

export async function seedSignatureMeanings(): Promise<void> {
  const snap = await getDocs(collection(getFirebaseFirestore(), ESIG_COLLECTIONS.meanings));
  if (!snap.empty) return;
  for (const meaning of DEFAULT_SIGNATURE_MEANINGS) {
    await addDoc(collection(getFirebaseFirestore(), ESIG_COLLECTIONS.meanings), {
      meaning, active: true, created_at: now(),
    });
  }
}

export async function fetchSignatureMeanings(): Promise<string[]> {
  await seedSignatureMeanings();
  try {
    const snap = await getDocs(query(collection(getFirebaseFirestore(), ESIG_COLLECTIONS.meanings), where('active', '==', true)));
    if (snap.empty) return [...DEFAULT_SIGNATURE_MEANINGS];
    return snap.docs.map((d) => d.data().meaning as string);
  } catch {
    return [...DEFAULT_SIGNATURE_MEANINGS];
  }
}

async function listEnterpriseSignatures(): Promise<ElectronicSignatureRecord[]> {
  try {
    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), ESIG_COLLECTIONS.signatures),
      orderBy('signed_at', 'desc'),
    ));
    return snap.docs.map((d) => mapSignatureRaw({ id: d.id, ...d.data() }));
  } catch {
    const snap = await getDocs(collection(getFirebaseFirestore(), ESIG_COLLECTIONS.signatures));
    return snap.docs.map((d) => mapSignatureRaw({ id: d.id, ...d.data() }))
      .sort((a, b) => b.signed_at.localeCompare(a.signed_at));
  }
}

export async function syncFromEsignRecords(): Promise<number> {
  let esignRecords: EsignRecord[] = [];
  try {
    esignRecords = await getRecords<EsignRecord>(ESIG_COLLECTIONS.esignRecords, []);
  } catch { return 0; }
  const existing = await listEnterpriseSignatures();
  const existingIds = new Set(existing.map((e) => e.esign_record_id));
  let synced = 0;
  for (const r of esignRecords) {
    if (!r.esignRecordId || existingIds.has(r.esignRecordId)) continue;
    await persistEnterpriseSignature(r);
    synced++;
  }
  return synced;
}

export async function fetchSignatureDashboardData(filters?: SignatureFilters) {
  await seedSignatureMeanings();
  await syncFromEsignRecords();

  const enterprise = await listEnterpriseSignatures();
  let esignRecords: EsignRecord[] = [];
  try {
    esignRecords = await getRecords<EsignRecord>(ESIG_COLLECTIONS.esignRecords, []);
  } catch { /* ignore */ }
  const esignMapped = esignRecords
    .filter((r) => !enterprise.some((e) => e.esign_record_id === r.esignRecordId))
    .map(mapEsignRecordToSignature);

  let records = [...enterprise, ...esignMapped];
  if (filters) records = filterSignatureRecords(records, filters);

  return {
    records,
    metrics: computeSignatureKpis(records),
    charts: computeSignatureCharts(records),
    meanings: await fetchSignatureMeanings(),
  };
}

export async function getSignatureById(id: string): Promise<ElectronicSignatureRecord | null> {
  const docSnap = await getDoc(doc(getFirebaseFirestore(), ESIG_COLLECTIONS.signatures, id));
  if (docSnap.exists()) return mapSignatureRaw({ id: docSnap.id, ...docSnap.data() });
  const esignSnap = await getDocs(query(
    collection(getFirebaseFirestore(), ESIG_COLLECTIONS.esignRecords),
    limit(100),
  ));
  const match = esignSnap.docs.find((d) => d.id === id || d.data().esignRecordId === id);
  if (match) return mapEsignRecordToSignature({ id: match.id, ...match.data() } as EsignRecord);
  return null;
}

export async function verifySignature(signatureId: string, actor: SignatureActor): Promise<{ valid: boolean; message: string }> {
  const record = await getSignatureById(signatureId);
  if (!record) return { valid: false, message: 'Signature not found' };
  if (!record.hash_value) return { valid: false, message: 'No hash stored — cannot verify integrity' };

  const recomputed = await generateTamperEvidentHash({
    esignRecordId: record.esign_record_id,
    module: record.module,
    recordId: record.entity_id,
    userId: record.signer_user_id,
    signedDateTime: record.signed_at,
    meaning: record.signature_meaning,
    action: record.action,
  });

  const valid = recomputed === record.hash_value;
  await audit(actor, valid ? 'SIGNATURE_VERIFIED' : 'SIGNATURE_VERIFICATION_FAILED', signatureId, record.hash_value, recomputed);
  if (valid && record.id) {
    await updateDoc(doc(getFirebaseFirestore(), ESIG_COLLECTIONS.signatures, record.id), {
      status: 'Verified', verified_at: now(), verified_by: actor.id,
    }).catch(() => undefined);
  }
  return { valid, message: valid ? 'Signature integrity verified — record is tamper-evident' : 'Hash mismatch — record may have been tampered with' };
}

export async function completeDualSignature(signatureId: string, esignRecord: EsignRecord, actor: SignatureActor): Promise<void> {
  const record = await getSignatureById(signatureId);
  if (!record) throw new Error('Signature not found');
  await persistEnterpriseSignature(esignRecord, { dualRequired: true });
  if (record.id) {
    await updateDoc(doc(getFirebaseFirestore(), ESIG_COLLECTIONS.signatures, record.id), {
      dual_signature_completed: true, status: 'Signed', updated_at: now(),
    });
  }
  await audit(actor, 'DUAL_SIGNATURE_COMPLETED', signatureId, null, esignRecord.esignRecordId);
}

export function exportSignaturesCsv(records: ElectronicSignatureRecord[]) {
  downloadCsv('electronic-signatures.csv',
    ['Signature #', 'Module', 'Reference', 'Signer', 'Meaning', 'Status', 'Signed At', 'Hash'],
    records.map((r) => [
      r.signature_number, r.module, r.reference_number, r.signer_name,
      r.signature_meaning, r.status, r.signed_at, r.hash_value?.slice(0, 16),
    ]),
  );
}

export function exportSignaturesExcel(records: ElectronicSignatureRecord[]) { exportSignaturesCsv(records); }

export async function logSignatureDashboardViewed(actor: SignatureActor) {
  await audit(actor, 'SIGNATURE_VIEWED', 'esign-dashboard', null, null);
}

export async function logSignatureExported(actor: SignatureActor, format: string, count: number) {
  await audit(actor, 'SIGNATURE_EXPORTED', 'esign-dashboard', null, { format, count });
}

export async function saveSignatureSettings(settings: Record<string, unknown>, actor: SignatureActor): Promise<void> {
  await setDoc(doc(getFirebaseFirestore(), ESIG_COLLECTIONS.settings, 'global'), {
    ...settings, updated_at: now(), updated_by: actor.id,
  }, { merge: true });
  await audit(actor, 'SETTINGS_UPDATED', 'global', null, settings);
}
