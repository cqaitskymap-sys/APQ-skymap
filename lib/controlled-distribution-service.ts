import {
  addDoc, collection, doc, getDoc, getDocs, limit, orderBy, query, setDoc, updateDoc, where, writeBatch,
} from 'firebase/firestore';
import { getFirebaseFirestore } from '@/lib/firebase';
import { logAuditEvent } from '@/lib/admin/admin-service';
import { downloadCsv } from '@/lib/export-utils';
import { getDocumentById, listDocuments } from '@/lib/dms-service';
import type { DocumentRecord } from '@/lib/dms-types';
import type {
  ControlledDistributionRecord, DistributionKpis, DistributionCharts, DistributionFilters, DistributionActor,
} from './controlled-distribution-types';
import {
  mapDistributionRaw, computeDistributionKpis, computeDistributionCharts,
  filterDistributionRecords, emptyDistributionKpis, emptyDistributionCharts,
} from './controlled-distribution-records';
import type { DistributionCreateInput, DistributionBulkInput } from './controlled-distribution-schemas';
import { validateDocumentForDistribution } from './controlled-distribution-schemas';
import { CD_COLLECTIONS, canViewAssignedOnly } from './controlled-distribution-types';

function now() { return new Date().toISOString(); }

async function audit(actor: DistributionActor, action: string, recordId: string, oldValue: unknown, newValue: unknown, reason = '') {
  await logAuditEvent({
    userId: actor.id, userName: actor.name, module: 'Document Distribution', recordId, action,
    oldValue: oldValue ? JSON.stringify(oldValue) : '',
    newValue: newValue ? JSON.stringify(newValue) : '',
    reason, ipAddress: 'client', device: typeof navigator !== 'undefined' ? navigator.userAgent : 'server',
    status: 'Success',
  });
}

async function notify(title: string, message: string, recordId: string, roles: string[], userIds: string[] = []) {
  try {
    const db = getFirebaseFirestore();
    for (const role of roles) {
      await addDoc(collection(db, CD_COLLECTIONS.notifications), {
        title, message, module: 'Document Distribution', record_id: recordId, target_role: role, read: false, created_at: now(),
      });
    }
    for (const uid of userIds) {
      await addDoc(collection(db, CD_COLLECTIONS.notifications), {
        title, message, module: 'Document Distribution', record_id: recordId, target_user_id: uid, read: false, created_at: now(),
      });
    }
  } catch (e) { console.error('Distribution notification failed:', e); }
}

export async function generateDistributionNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `DIST-${year}-`;
  try {
    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), CD_COLLECTIONS.distribution),
      where('distribution_number', '>=', prefix),
      where('distribution_number', '<=', `${prefix}\uf8ff`),
      orderBy('distribution_number', 'desc'),
      limit(1),
    ));
    if (!snap.empty) {
      const last = snap.docs[0].data().distribution_number as string;
      return `${prefix}${String(parseInt(last.split('-').pop() || '0', 10) + 1).padStart(4, '0')}`;
    }
  } catch {
    const all = await getDocs(collection(getFirebaseFirestore(), CD_COLLECTIONS.distribution));
    return `${prefix}${String(all.size + 1).padStart(4, '0')}`;
  }
  return `${prefix}0001`;
}

async function listAllDistributions(): Promise<ControlledDistributionRecord[]> {
  try {
    const snap = await getDocs(query(collection(getFirebaseFirestore(), CD_COLLECTIONS.distribution), orderBy('created_at', 'desc')));
    return snap.docs.map((d) => mapDistributionRaw({ id: d.id, ...d.data() }));
  } catch {
    const snap = await getDocs(collection(getFirebaseFirestore(), CD_COLLECTIONS.distribution));
    return snap.docs.map((d) => mapDistributionRaw({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  }
}

export async function fetchEffectiveDocumentOptions(): Promise<Array<{ id: string; number: string; title: string; type: string; version: string }>> {
  const docs = await listDocuments({ effectiveOnly: true });
  return docs
    .filter((d) => d.status === 'effective' && d.is_latest !== false)
    .map((d) => ({ id: d.id, number: d.document_number, title: d.document_title, type: d.document_type, version: d.version }));
}

async function withdrawObsoleteForDocument(documentId: string, documentNumber: string, newVersion: string, actor: DistributionActor) {
  const snap = await getDocs(query(
    collection(getFirebaseFirestore(), CD_COLLECTIONS.distribution),
    where('document_id', '==', documentId),
  ));
  const batch = writeBatch(getFirebaseFirestore());
  let count = 0;
  for (const d of snap.docs) {
    const data = d.data();
    if (data.status === 'Withdrawn' || data.status === 'Cancelled') continue;
    if (data.document_version && data.document_version !== newVersion) {
      batch.update(d.ref, {
        status: 'Withdrawn',
        withdrawn_at: now(),
        withdrawn_reason: `Superseded by version ${newVersion}`,
        is_immutable: true,
        updated_at: now(),
        updated_by: actor.id,
        updated_by_name: actor.name,
      });
      count++;
    }
  }
  if (count > 0) {
    await batch.commit();
    await notify('Distribution Withdrawn', `${documentNumber} — obsolete version distributions withdrawn`, documentId, ['qa_manager'], []);
    await audit(actor, 'DISTRIBUTION_WITHDRAWN', documentId, null, { count, newVersion }, 'Auto-withdraw obsolete versions');
  }
  return count;
}

async function createAcknowledgementTasks(record: Omit<ControlledDistributionRecord, 'id'>, distId: string) {
  if (!record.acknowledgement_required) return 0;
  const recipients = record.assigned_users.length ? record.assigned_users : ['dept-pending'];
  return recipients.length;
}

async function assignTraining(record: Omit<ControlledDistributionRecord, 'id'>, distId: string, actor: DistributionActor) {
  if (!record.training_required) return;
  try {
    await addDoc(collection(getFirebaseFirestore(), CD_COLLECTIONS.trainingAssignments), {
      document_id: record.document_id,
      document_number: record.document_number,
      document_title: record.document_title,
      document_version: record.document_version,
      distribution_id: distId,
      training_title: `Document Training: ${record.document_title} v${record.document_version}`,
      target_departments: record.assigned_departments.length ? record.assigned_departments : [record.department].filter(Boolean),
      target_roles: record.assigned_roles,
      status: 'pending',
      due_date: record.expiry_date || null,
      created_by: actor.id,
      created_by_name: actor.name,
      created_at: now(),
    });
    await notify('Training Assigned', `Training assigned for ${record.document_number} v${record.document_version}`, distId, ['training_coordinator'], record.assigned_users);
    await audit(actor, 'TRAINING_ASSIGNED', distId, null, record.document_number);
  } catch (e) { console.error('Training assignment failed:', e); }
}

function buildDistributionPayload(
  input: DistributionCreateInput,
  doc: DocumentRecord,
  distNumber: string,
  actor: DistributionActor,
  status: string,
): Omit<ControlledDistributionRecord, 'id'> {
  const timestamp = now();
  const pendingAck = input.acknowledgement_required
    ? Math.max(input.assigned_users.length, input.assigned_departments.length, input.assigned_roles.length, 1)
    : 0;
  return {
    distribution_id: distNumber,
    distribution_number: distNumber,
    document_id: doc.id,
    document_number: doc.document_number,
    document_title: doc.document_title,
    document_type: doc.document_type,
    document_version: input.document_version,
    distribution_type: input.distribution_type,
    distribution_group: input.distribution_group || '',
    department: input.department || doc.department,
    site: input.site || '',
    plant: input.plant || '',
    assigned_users: input.assigned_users,
    assigned_user_names: input.assigned_user_names,
    assigned_roles: input.assigned_roles,
    assigned_departments: input.assigned_departments.length ? input.assigned_departments : (input.department ? [input.department] : []),
    distribution_date: input.schedule_later ? null : (input.distribution_date || timestamp.split('T')[0]),
    effective_date: input.effective_date,
    expiry_date: input.expiry_date || null,
    acknowledgement_required: input.acknowledgement_required,
    training_required: input.training_required,
    read_confirmation_required: input.read_confirmation_required,
    status,
    reason: input.reason,
    pending_acknowledgements: pendingAck,
    pending_training: input.training_required ? pendingAck : 0,
    pending_read_confirmations: input.read_confirmation_required ? pendingAck : 0,
    withdrawn_at: null,
    withdrawn_reason: null,
    is_immutable: status !== 'Draft' && status !== 'Scheduled',
    created_by: actor.id,
    created_by_name: actor.name,
    updated_by: actor.id,
    updated_by_name: actor.name,
    created_at: timestamp,
    updated_at: timestamp,
  };
}

export async function createDistribution(input: DistributionCreateInput, actor: DistributionActor): Promise<ControlledDistributionRecord> {
  const doc = await getDocumentById(input.document_id);
  if (!doc) throw new Error('Document not found');
  const validationError = validateDocumentForDistribution(doc.status, doc.is_latest !== false, doc.version, input.document_version);
  if (validationError) throw new Error(validationError);

  await withdrawObsoleteForDocument(doc.id, doc.document_number, input.document_version, actor);

  const distNumber = await generateDistributionNumber();
  const status = input.schedule_later ? 'Scheduled' : (input.acknowledgement_required ? 'Pending Acknowledgement' : 'Distributed');
  const payload = buildDistributionPayload(input, doc, distNumber, actor, status);

  const ref = await addDoc(collection(getFirebaseFirestore(), CD_COLLECTIONS.distribution), payload);
  const result: ControlledDistributionRecord = { id: ref.id, ...payload };

  if (payload.acknowledgement_required) {
    await createAcknowledgementTasks(payload, ref.id);
    await audit(actor, 'ACKNOWLEDGEMENT_CREATED', ref.id, null, { pending: payload.pending_acknowledgements });
  }
  if (payload.training_required) await assignTraining(payload, ref.id, actor);

  const notifyRoles = Array.from(new Set([...input.assigned_roles, 'qa_manager']));
  await notify('New Document Distributed', `${doc.document_number} v${input.document_version} distributed`, ref.id, notifyRoles, input.assigned_users);
  await audit(actor, 'DISTRIBUTION_CREATED', ref.id, null, result);
  return result;
}

export async function bulkDistribute(input: DistributionBulkInput, actor: DistributionActor): Promise<number> {
  let count = 0;
  for (const docId of input.document_ids) {
    const doc = await getDocumentById(docId);
    if (!doc || doc.status !== 'effective' || !doc.is_latest) continue;
    await createDistribution({
      document_id: docId,
      document_version: doc.version,
      distribution_type: input.distribution_type,
      assigned_departments: input.assigned_departments,
      assigned_roles: input.assigned_roles,
      assigned_users: [],
      assigned_user_names: [],
      effective_date: input.effective_date,
      acknowledgement_required: input.acknowledgement_required,
      training_required: input.training_required,
      read_confirmation_required: false,
      reason: input.reason,
      schedule_later: false,
    }, actor);
    count++;
  }
  await audit(actor, 'BULK_DISTRIBUTION', 'bulk', null, { count, document_ids: input.document_ids });
  return count;
}

export async function withdrawDistribution(id: string, reason: string, actor: DistributionActor): Promise<ControlledDistributionRecord> {
  const record = await getDistributionById(id);
  if (!record) throw new Error('Distribution not found');
  if (record.is_immutable && record.status === 'Completed') throw new Error('Completed distribution history is immutable');

  const updates = {
    status: 'Withdrawn',
    withdrawn_at: now(),
    withdrawn_reason: reason,
    is_immutable: true,
    updated_at: now(),
    updated_by: actor.id,
    updated_by_name: actor.name,
  };
  await updateDoc(doc(getFirebaseFirestore(), CD_COLLECTIONS.distribution, id), updates);
  await notify('Distribution Withdrawn', `${record.document_number} distribution withdrawn`, id, record.assigned_roles, record.assigned_users);
  await audit(actor, 'DISTRIBUTION_WITHDRAWN', id, record.status, 'Withdrawn', reason);
  return { ...record, ...updates };
}

export async function syncExpiredDistributions(): Promise<number> {
  const today = now().split('T')[0];
  const records = await listAllDistributions();
  let count = 0;
  for (const r of records) {
    if (r.expiry_date && r.expiry_date < today && !['Expired', 'Cancelled', 'Withdrawn'].includes(r.status)) {
      await updateDoc(doc(getFirebaseFirestore(), CD_COLLECTIONS.distribution, r.id), { status: 'Expired', is_immutable: true, updated_at: now() });
      await notify('Distribution Expiring', `${r.document_number} distribution expired`, r.id, ['qa_manager'], []);
      count++;
    }
  }
  return count;
}

export async function fetchDistributionDashboardData(filters?: DistributionFilters, actor?: DistributionActor) {
  await syncExpiredDistributions();
  let records = await listAllDistributions();
  const role = actor?.role || '';
  if (canViewAssignedOnly(role) && actor?.department) {
    records = records.filter((r) =>
      r.assigned_departments.includes(actor.department!) ||
      r.department === actor.department ||
      r.assigned_users.includes(actor.id),
    );
  }
  if (filters) records = filterDistributionRecords(records, filters);
  return { records, metrics: computeDistributionKpis(records), charts: computeDistributionCharts(records) };
}

export async function getDistributionById(id: string): Promise<ControlledDistributionRecord | null> {
  const snap = await getDoc(doc(getFirebaseFirestore(), CD_COLLECTIONS.distribution, id));
  if (!snap.exists()) return null;
  return mapDistributionRaw({ id: snap.id, ...snap.data() });
}

export async function fetchDistributionGroups(): Promise<Array<{ id: string; name: string; departments: string[] }>> {
  try {
    const snap = await getDocs(collection(getFirebaseFirestore(), CD_COLLECTIONS.groups));
    return snap.docs.map((d) => ({ id: d.id, name: (d.data().name as string) || d.id, departments: (d.data().departments as string[]) || [] }));
  } catch { return []; }
}

export function exportDistributionCsv(records: ControlledDistributionRecord[]) {
  downloadCsv('controlled-distributions.csv',
    ['Distribution Number', 'Document Number', 'Title', 'Type', 'Version', 'Distribution Type', 'Department', 'Status', 'Distribution Date', 'Effective Date', 'Expiry Date'],
    records.map((r) => [r.distribution_number, r.document_number, r.document_title, r.document_type, r.document_version, r.distribution_type, r.department, r.status, r.distribution_date, r.effective_date, r.expiry_date]),
  );
}

export function exportDistributionExcel(records: ControlledDistributionRecord[]) { exportDistributionCsv(records); }

export async function logDistributionDashboardViewed(actor: DistributionActor) {
  await audit(actor, 'DASHBOARD_VIEWED', 'distribution-dashboard', null, null);
}

export async function logDistributionExported(actor: DistributionActor, format: string, count: number) {
  await audit(actor, 'DISTRIBUTION_EXPORTED', 'distribution-dashboard', null, { format, count });
}
