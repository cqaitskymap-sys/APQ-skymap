import {
  addDoc, collection, doc, getDoc, getDocs, limit, orderBy, query, updateDoc, where,
} from 'firebase/firestore';
import { getFirebaseFirestore } from '@/lib/firebase';
import { logAuditEvent } from '@/lib/admin/admin-service';
import { downloadCsv } from '@/lib/export-utils';
import { listDocuments, getDocumentById } from '@/lib/dms-service';
import type { ArchiveRecord, ArchiveFilters, ArchiveActor } from './archive-management-types';
import {
  mapArchiveRaw, computeArchiveKpis, computeArchiveCharts, filterArchiveRecords,
} from './archive-management-records';
import type {
  CreateArchiveRequestInput, ApproveArchiveInput, RestoreRequestInput,
  ApproveRestoreInput, BulkArchiveInput, ApplyHoldInput,
} from './archive-management-schemas';
import { AM_COLLECTIONS, AM_MODULE, DEFAULT_RETENTION_YEARS } from './archive-management-types';

function now() { return new Date().toISOString(); }

async function audit(actor: ArchiveActor, action: string, recordId: string, oldValue: unknown, newValue: unknown, reason = '') {
  await logAuditEvent({
    userId: actor.id, userName: actor.name, module: AM_MODULE, recordId, action,
    oldValue: oldValue ? JSON.stringify(oldValue) : '',
    newValue: newValue ? JSON.stringify(newValue) : '',
    reason, ipAddress: 'client', device: typeof navigator !== 'undefined' ? navigator.userAgent : 'server',
    status: 'Success',
  });
}

async function notify(title: string, message: string, recordId: string, roles: string[] = []) {
  try {
    for (const role of roles) {
      await addDoc(collection(getFirebaseFirestore(), AM_COLLECTIONS.notifications), {
        title, message, module: AM_MODULE, record_id: recordId,
        target_role: role, read: false, created_at: now(),
      });
    }
  } catch (e) { console.error('Archive notification failed:', e); }
}

export async function generateArchiveNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `ARC-${year}-`;
  try {
    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), AM_COLLECTIONS.archives),
      where('archive_number', '>=', prefix),
      where('archive_number', '<=', `${prefix}\uf8ff`),
      orderBy('archive_number', 'desc'),
      limit(1),
    ));
    if (!snap.empty) {
      const last = snap.docs[0].data().archive_number as string;
      return `${prefix}${String(parseInt(last.split('-').pop() || '0', 10) + 1).padStart(4, '0')}`;
    }
  } catch {
    const all = await getDocs(collection(getFirebaseFirestore(), AM_COLLECTIONS.archives));
    return `${prefix}${String(all.size + 1).padStart(4, '0')}`;
  }
  return `${prefix}0001`;
}

export async function generateIntegrityChecksum(payload: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(payload));
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  let hash = 0;
  for (let i = 0; i < payload.length; i++) hash = ((hash << 5) - hash + payload.charCodeAt(i)) | 0;
  return `fallback-${Math.abs(hash).toString(16)}`;
}

function addYears(dateStr: string, years: number): string {
  const d = new Date(`${dateStr}T12:00:00`);
  d.setFullYear(d.getFullYear() + years);
  return d.toISOString().split('T')[0];
}

function inferArchiveCategory(status: string): string {
  if (status === 'superseded') return 'Superseded';
  if (status === 'retired') return 'Retired';
  if (status === 'obsolete') return 'Obsolete';
  if (status === 'archived') return 'Historical Record';
  return 'Quality Archive';
}

async function listAllArchiveRecords(): Promise<ArchiveRecord[]> {
  try {
    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), AM_COLLECTIONS.archives),
      orderBy('updated_at', 'desc'),
    ));
    return snap.docs.map((d) => mapArchiveRaw({ id: d.id, ...d.data() }));
  } catch {
    const snap = await getDocs(collection(getFirebaseFirestore(), AM_COLLECTIONS.archives));
    return snap.docs.map((d) => mapArchiveRaw({ id: d.id, ...d.data() }))
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  }
}

async function hasOpenArchiveRequest(documentId: string): Promise<boolean> {
  const snap = await getDocs(query(
    collection(getFirebaseFirestore(), AM_COLLECTIONS.archives),
    where('document_id', '==', documentId),
    limit(10),
  ));
  return snap.docs.some((d) => {
    const status = String(d.data().archive_status || '');
    return !['Archived', 'Destroyed', 'Restored', 'Retention Complete'].includes(status);
  });
}

async function hasArchivedRecord(documentId: string): Promise<boolean> {
  const snap = await getDocs(query(
    collection(getFirebaseFirestore(), AM_COLLECTIONS.archives),
    where('document_id', '==', documentId),
    where('archive_status', '==', 'Archived'),
    limit(1),
  ));
  return !snap.empty;
}

function buildArchivePayload(
  docRecord: NonNullable<Awaited<ReturnType<typeof getDocumentById>>>,
  archiveNumber: string,
  input: Partial<CreateArchiveRequestInput> & { archive_reason: string; archive_category: string; retention_policy: string },
  actor: ArchiveActor,
  checksum: string,
): Record<string, unknown> {
  const timestamp = now();
  const today = timestamp.split('T')[0];
  const retentionYears = input.retention_years ?? DEFAULT_RETENTION_YEARS;
  return {
    archive_id: archiveNumber,
    archive_number: archiveNumber,
    module: AM_MODULE,
    document_id: docRecord.id,
    document_number: docRecord.document_number,
    document_title: docRecord.document_title,
    document_type: docRecord.document_type,
    document_category: (docRecord as { document_category?: string }).document_category || docRecord.document_type,
    department: docRecord.department,
    business_unit: (docRecord as { business_unit?: string }).business_unit || '',
    site: (docRecord as { site?: string }).site || '',
    version: docRecord.version,
    revision: String(docRecord.revision_number ?? docRecord.version),
    current_status: docRecord.status,
    archive_status: 'Pending',
    archive_reason: input.archive_reason,
    archive_category: input.archive_category,
    archive_date: null,
    archive_location: input.archive_location || 'Primary Archive Vault',
    retention_policy: input.retention_policy,
    retention_expiry_date: addYears(today, retentionYears),
    original_effective_date: docRecord.effective_date || null,
    superseded_date: docRecord.status === 'superseded' ? today : null,
    obsolete_date: docRecord.status === 'obsolete' ? today : null,
    retired_date: docRecord.status === 'retired' ? today : null,
    destroyed_date: null,
    requested_by: actor.id,
    requested_by_name: actor.name,
    approved_by: '',
    approved_by_name: '',
    electronic_signature_required: input.electronic_signature_required ?? false,
    restoration_allowed: input.restoration_allowed !== false,
    restoration_status: null,
    restoration_reason: null,
    checksum,
    checksum_verified: false,
    checksum_verified_at: null,
    storage_class: input.storage_class || 'Standard',
    storage_tier: input.storage_tier || 'Primary',
    legal_hold: false,
    regulatory_hold: false,
    inspection_mode: false,
    storage_bytes: (docRecord as { file_size?: number }).file_size || 0,
    created_by: actor.id,
    created_by_name: actor.name,
    updated_by: actor.id,
    updated_by_name: actor.name,
    created_at: timestamp,
    updated_at: timestamp,
  };
}

export async function createArchiveRequest(input: CreateArchiveRequestInput, actor: ArchiveActor): Promise<ArchiveRecord> {
  const docRecord = await getDocumentById(input.document_id);
  if (!docRecord) throw new Error('Document not found');
  if (await hasOpenArchiveRequest(input.document_id)) {
    throw new Error('An open archive request already exists for this document');
  }

  const archiveNumber = await generateArchiveNumber();
  const checksumPayload = `${docRecord.id}|${docRecord.document_number}|${docRecord.version}|${docRecord.updated_at}`;
  const checksum = await generateIntegrityChecksum(checksumPayload);
  const payload = buildArchivePayload(docRecord, archiveNumber, input, actor, checksum);

  const ref = await addDoc(collection(getFirebaseFirestore(), AM_COLLECTIONS.archives), payload);
  await audit(actor, 'ARCHIVE_INITIATED', ref.id, null, payload);
  await notify('Archive Scheduled', `${docRecord.document_number} scheduled for archive`, ref.id, ['document_controller']);
  return mapArchiveRaw({ id: ref.id, ...payload });
}

export async function approveArchiveRequest(archiveId: string, input: ApproveArchiveInput, actor: ArchiveActor): Promise<void> {
  const rec = await getArchiveById(archiveId);
  if (!rec) throw new Error('Archive record not found');
  if (rec.archive_status !== 'Pending') throw new Error('Only pending archive requests can be approved');
  if (rec.electronic_signature_required && !input.signature_meaning?.trim()) {
    throw new Error('Electronic signature required for approval');
  }

  await updateDoc(doc(getFirebaseFirestore(), AM_COLLECTIONS.archives, archiveId), {
    archive_status: 'Approved',
    approved_by: actor.id,
    approved_by_name: actor.name,
    updated_at: now(),
    updated_by: actor.id,
    updated_by_name: actor.name,
  });
  if (input.signature_meaning) {
    await audit(actor, 'ELECTRONIC_SIGNATURE_COMPLETED', archiveId, null, { meaning: input.signature_meaning });
  }
  await audit(actor, 'ARCHIVE_APPROVED', archiveId, 'Pending', 'Approved', input.comments);
  await notify('Archive Approved', `${rec.document_number} archive approved`, archiveId, ['document_controller']);
}

export async function completeArchive(archiveId: string, actor: ArchiveActor): Promise<void> {
  const rec = await getArchiveById(archiveId);
  if (!rec) throw new Error('Archive record not found');
  if (rec.archive_status !== 'Approved') throw new Error('Archive must be approved before completion');
  if (rec.legal_hold || rec.regulatory_hold) {
    throw new Error('Cannot complete archive while legal or regulatory hold is active');
  }

  const timestamp = now();
  const today = timestamp.split('T')[0];

  await updateDoc(doc(getFirebaseFirestore(), AM_COLLECTIONS.documents, rec.document_id), {
    status: 'archived',
    lifecycle_stage: 'Archived',
    updated_at: timestamp,
    updated_by: actor.id,
    updated_by_name: actor.name,
  });

  await updateDoc(doc(getFirebaseFirestore(), AM_COLLECTIONS.archives, archiveId), {
    archive_status: 'Archived',
    archive_date: today,
    checksum_verified: true,
    checksum_verified_at: timestamp,
    updated_at: timestamp,
    updated_by: actor.id,
    updated_by_name: actor.name,
  });

  await addDoc(collection(getFirebaseFirestore(), AM_COLLECTIONS.jobs), {
    archive_id: archiveId,
    document_id: rec.document_id,
    job_type: 'archive_complete',
    status: 'completed',
    checksum: rec.checksum,
    created_at: timestamp,
  });

  await audit(actor, 'CHECKSUM_VERIFIED', archiveId, null, { checksum: rec.checksum });
  await audit(actor, 'ARCHIVE_COMPLETED', archiveId, 'Approved', 'Archived');
  await notify('Archive Completed', `${rec.document_number} archived successfully`, archiveId, ['qa_manager']);
}

export async function requestRestoration(archiveId: string, input: RestoreRequestInput, actor: ArchiveActor): Promise<void> {
  const rec = await getArchiveById(archiveId);
  if (!rec) throw new Error('Archive record not found');
  if (rec.archive_status !== 'Archived') throw new Error('Only archived documents can be restored');
  if (!rec.restoration_allowed) throw new Error('Restoration is not allowed for this record');
  if (rec.legal_hold || rec.regulatory_hold) {
    throw new Error('Cannot restore while legal or regulatory hold is active');
  }

  await updateDoc(doc(getFirebaseFirestore(), AM_COLLECTIONS.archives, archiveId), {
    archive_status: 'Restoration Requested',
    restoration_status: 'Pending',
    restoration_reason: input.restoration_reason,
    updated_at: now(),
    updated_by: actor.id,
    updated_by_name: actor.name,
  });

  await addDoc(collection(getFirebaseFirestore(), AM_COLLECTIONS.restorationRequests), {
    archive_id: archiveId,
    document_id: rec.document_id,
    document_number: rec.document_number,
    reason: input.restoration_reason,
    status: 'Pending',
    requested_by: actor.id,
    requested_by_name: actor.name,
    created_at: now(),
  });

  await audit(actor, 'RESTORATION_REQUESTED', archiveId, 'Archived', input.restoration_reason);
  await notify('Restoration Requested', `${rec.document_number} restoration requested`, archiveId, ['head_qa']);
}

export async function approveRestoration(archiveId: string, input: ApproveRestoreInput, actor: ArchiveActor): Promise<void> {
  const rec = await getArchiveById(archiveId);
  if (!rec) throw new Error('Archive record not found');
  if (rec.archive_status !== 'Restoration Requested') throw new Error('No pending restoration request');

  const timestamp = now();
  await updateDoc(doc(getFirebaseFirestore(), AM_COLLECTIONS.documents, rec.document_id), {
    status: 'obsolete',
    lifecycle_stage: 'Obsolete',
    updated_at: timestamp,
    updated_by: actor.id,
    updated_by_name: actor.name,
  });

  await updateDoc(doc(getFirebaseFirestore(), AM_COLLECTIONS.archives, archiveId), {
    archive_status: 'Restored',
    restoration_status: 'Approved',
    updated_at: timestamp,
    updated_by: actor.id,
    updated_by_name: actor.name,
  });

  if (input.signature_meaning) {
    await audit(actor, 'ELECTRONIC_SIGNATURE_COMPLETED', archiveId, null, { meaning: input.signature_meaning });
  }
  await audit(actor, 'RESTORATION_APPROVED', archiveId, 'Restoration Requested', 'Restored', input.comments);
  await audit(actor, 'DOCUMENT_RESTORED', archiveId, 'Archived', 'Restored');
  await notify('Restoration Approved', `${rec.document_number} restored to obsolete status`, archiveId, ['document_controller']);
}

export async function applyHold(archiveId: string, input: ApplyHoldInput, actor: ArchiveActor): Promise<void> {
  const rec = await getArchiveById(archiveId);
  if (!rec) throw new Error('Archive record not found');
  const updates: Record<string, string | boolean> = {
    updated_at: now(),
    updated_by: actor.id,
    updated_by_name: actor.name,
  };
  if (input.hold_type === 'legal') updates.legal_hold = true;
  else updates.regulatory_hold = true;

  await updateDoc(doc(getFirebaseFirestore(), AM_COLLECTIONS.archives, archiveId), updates);
  const action = input.hold_type === 'legal' ? 'LEGAL_HOLD_APPLIED' : 'REGULATORY_HOLD_APPLIED';
  await audit(actor, action, archiveId, null, { reason: input.reason });
  await notify(`${input.hold_type === 'legal' ? 'Legal' : 'Regulatory'} Hold Applied`, rec.document_number, archiveId, ['head_qa']);
}

export async function toggleInspectionMode(archiveId: string, enabled: boolean, actor: ArchiveActor): Promise<void> {
  await updateDoc(doc(getFirebaseFirestore(), AM_COLLECTIONS.archives, archiveId), {
    inspection_mode: enabled,
    updated_at: now(),
    updated_by: actor.id,
    updated_by_name: actor.name,
  });
  await audit(actor, enabled ? 'INSPECTION_MODE_ENABLED' : 'INSPECTION_MODE_DISABLED', archiveId, null, { enabled });
}

export async function verifyChecksum(archiveId: string, actor: ArchiveActor): Promise<boolean> {
  const rec = await getArchiveById(archiveId);
  if (!rec) throw new Error('Archive record not found');
  const docRecord = await getDocumentById(rec.document_id);
  if (!docRecord) throw new Error('Source document not found');

  const checksumPayload = `${docRecord.id}|${docRecord.document_number}|${docRecord.version}|${docRecord.updated_at}`;
  const computed = await generateIntegrityChecksum(checksumPayload);
  const verified = computed === rec.checksum;

  await updateDoc(doc(getFirebaseFirestore(), AM_COLLECTIONS.archives, archiveId), {
    checksum_verified: verified,
    checksum_verified_at: now(),
    updated_by: actor.id,
    updated_by_name: actor.name,
    updated_at: now(),
  });
  await audit(actor, 'CHECKSUM_VERIFIED', archiveId, rec.checksum, { computed, verified });
  return verified;
}

export async function bulkArchiveDocuments(input: BulkArchiveInput, actor: ArchiveActor): Promise<number> {
  let count = 0;
  for (const docId of input.document_ids) {
    try {
      if (await hasOpenArchiveRequest(docId) || await hasArchivedRecord(docId)) continue;
      await createArchiveRequest({
        document_id: docId,
        archive_reason: input.archive_reason,
        archive_category: input.archive_category as CreateArchiveRequestInput['archive_category'],
        retention_policy: input.retention_policy,
        archive_location: input.archive_location,
        electronic_signature_required: false,
        restoration_allowed: true,
        retention_years: DEFAULT_RETENTION_YEARS,
        storage_class: 'Standard',
        storage_tier: 'Primary',
      }, actor);
      count++;
    } catch { /* skip */ }
  }
  return count;
}

export async function syncAutoArchiveFromDocuments(): Promise<number> {
  const docs = await listDocuments();
  const candidates = docs.filter((d) =>
    ['superseded', 'retired', 'obsolete'].includes(d.status) && d.status !== 'archived',
  );
  let created = 0;
  const actor: ArchiveActor = { id: 'system', name: 'System', role: 'system' };

  for (const d of candidates) {
    if (await hasOpenArchiveRequest(d.id) || await hasArchivedRecord(d.id)) continue;
    try {
      const archiveNumber = await generateArchiveNumber();
      const checksumPayload = `${d.id}|${d.document_number}|${d.version}|${d.updated_at}`;
      const checksum = await generateIntegrityChecksum(checksumPayload);
      const payload = buildArchivePayload(d, archiveNumber, {
        archive_reason: `Automatic archive — document status: ${d.status}`,
        archive_category: inferArchiveCategory(d.status),
        retention_policy: `GMP Standard ${DEFAULT_RETENTION_YEARS}-Year Retention`,
        archive_location: 'Primary Archive Vault',
        retention_years: DEFAULT_RETENTION_YEARS,
      }, actor, checksum);

      const ref = await addDoc(collection(getFirebaseFirestore(), AM_COLLECTIONS.archives), payload);
      await audit(actor, 'ARCHIVE_INITIATED', ref.id, null, { auto: true, status: d.status });
      created++;
    } catch { /* skip */ }
  }
  return created;
}

export async function monitorRetentionPeriods(actor: ArchiveActor): Promise<{ expiring: number; completed: number }> {
  const records = await listAllArchiveRecords();
  const today = now().split('T')[0];
  let expiring = 0;
  let completed = 0;

  for (const rec of records) {
    if (!rec.retention_expiry_date || rec.archive_status === 'Destroyed') continue;
    if (rec.retention_expiry_date <= today && rec.archive_status === 'Archived' && !rec.legal_hold && !rec.regulatory_hold) {
      await updateDoc(doc(getFirebaseFirestore(), AM_COLLECTIONS.archives, rec.id), {
        archive_status: 'Retention Complete',
        updated_at: now(),
        updated_by: actor.id,
        updated_by_name: actor.name,
      });
      await notify('Retention Expiring', `${rec.document_number} retention period complete`, rec.id, ['document_controller']);
      completed++;
    } else if (rec.retention_expiry_date > today) {
      const days = Math.ceil((new Date(rec.retention_expiry_date).getTime() - Date.now()) / 86400000);
      if (days <= 90 && days > 0) expiring++;
    }
  }
  return { expiring, completed };
}

export async function processScheduledArchiveJobs(actor: ArchiveActor): Promise<{ synced: number; retention: { expiring: number; completed: number } }> {
  const synced = await syncAutoArchiveFromDocuments();
  const retention = await monitorRetentionPeriods(actor);
  return { synced, retention };
}

export async function fetchArchiveDashboardData(filters?: ArchiveFilters) {
  await processScheduledArchiveJobs({ id: 'system', name: 'System', role: 'system' });
  let records = await listAllArchiveRecords();
  if (filters) records = filterArchiveRecords(records, filters);
  return {
    records,
    metrics: computeArchiveKpis(records),
    charts: computeArchiveCharts(records),
  };
}

export async function getArchiveById(id: string): Promise<ArchiveRecord | null> {
  const snap = await getDoc(doc(getFirebaseFirestore(), AM_COLLECTIONS.archives, id));
  if (!snap.exists()) return null;
  return mapArchiveRaw({ id: snap.id, ...snap.data() });
}

export function exportArchiveCsv(records: ArchiveRecord[]) {
  downloadCsv('archive-records.csv',
    ['Archive #', 'Document', 'Version', 'Category', 'Status', 'Department', 'Archive Date', 'Retention Expiry'],
    records.map((r) => [
      r.archive_number, r.document_number, r.version, r.archive_category,
      r.archive_status, r.department, r.archive_date || '', r.retention_expiry_date || '',
    ]),
  );
}

export function exportArchiveExcel(records: ArchiveRecord[]) { exportArchiveCsv(records); }

export async function logArchiveDashboardViewed(actor: ArchiveActor) {
  await audit(actor, 'DASHBOARD_VIEWED', 'archive-dashboard', null, null);
}

export async function logArchiveExported(actor: ArchiveActor, format: string, count: number) {
  await audit(actor, 'EXPORT', 'archive-dashboard', null, { format, count });
}

export async function runScheduledArchiveJobs() {
  return processScheduledArchiveJobs({ id: 'scheduler', name: 'Scheduled Job', role: 'system' });
}
