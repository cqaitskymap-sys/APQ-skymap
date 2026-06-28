import {
  addDoc, collection, doc, getDoc, getDocs, limit, orderBy, query, updateDoc, where, writeBatch,
} from 'firebase/firestore';
import { getFirebaseFirestore } from '@/lib/firebase';
import { logAuditEvent } from '@/lib/admin/admin-service';
import { downloadCsv } from '@/lib/export-utils';
import { getDocumentById } from '@/lib/dms-service';
import type {
  DocumentAcknowledgementRecord, AcknowledgementKpis, AcknowledgementCharts,
  AcknowledgementFilters, AcknowledgementActor,
} from './document-acknowledgement-types';
import {
  mapAcknowledgementRaw, computeAckKpis, computeAckCharts,
  filterAckRecords, emptyAckKpis, emptyAckCharts,
} from './document-acknowledgement-records';
import type { AckAssignInput, AckSubmitInput } from './document-acknowledgement-schemas';
import { validateDocumentForAcknowledgement, validateAcknowledgementActor } from './document-acknowledgement-schemas';
import { ACK_COLLECTIONS, canViewOwnOnly } from './document-acknowledgement-types';

function now() { return new Date().toISOString(); }

function clientMeta() {
  return {
    ip_address: 'client',
    device_information: typeof navigator !== 'undefined' ? navigator.platform : 'server',
    browser_information: typeof navigator !== 'undefined' ? navigator.userAgent : 'server',
  };
}

async function audit(actor: AcknowledgementActor, action: string, recordId: string, oldValue: unknown, newValue: unknown, reason = '') {
  await logAuditEvent({
    userId: actor.id, userName: actor.name, module: 'Document Acknowledgement', recordId, action,
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
      await addDoc(collection(db, ACK_COLLECTIONS.notifications), {
        title, message, module: 'Document Acknowledgement', record_id: recordId, target_role: role, read: false, created_at: now(),
      });
    }
    for (const uid of userIds) {
      await addDoc(collection(db, ACK_COLLECTIONS.notifications), {
        title, message, module: 'Document Acknowledgement', record_id: recordId, target_user_id: uid, read: false, created_at: now(),
      });
    }
  } catch (e) { console.error('Acknowledgement notification failed:', e); }
}

export async function generateAcknowledgementNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `ACK-${year}-`;
  try {
    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), ACK_COLLECTIONS.acknowledgements),
      where('acknowledgement_number', '>=', prefix),
      where('acknowledgement_number', '<=', `${prefix}\uf8ff`),
      orderBy('acknowledgement_number', 'desc'),
      limit(1),
    ));
    if (!snap.empty) {
      const last = snap.docs[0].data().acknowledgement_number as string;
      return `${prefix}${String(parseInt(last.split('-').pop() || '0', 10) + 1).padStart(4, '0')}`;
    }
  } catch {
    const all = await getDocs(collection(getFirebaseFirestore(), ACK_COLLECTIONS.acknowledgements));
    return `${prefix}${String(all.size + 1).padStart(4, '0')}`;
  }
  return `${prefix}0001`;
}

async function listAllAcknowledgements(): Promise<DocumentAcknowledgementRecord[]> {
  try {
    const snap = await getDocs(query(collection(getFirebaseFirestore(), ACK_COLLECTIONS.acknowledgements), orderBy('updated_at', 'desc')));
    return snap.docs.map((d) => mapAcknowledgementRaw({ id: d.id, ...d.data() }));
  } catch {
    const snap = await getDocs(collection(getFirebaseFirestore(), ACK_COLLECTIONS.acknowledgements));
    return snap.docs.map((d) => mapAcknowledgementRaw({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''));
  }
}

async function findDuplicate(documentId: string, employeeId: string, version: string): Promise<boolean> {
  const snap = await getDocs(query(
    collection(getFirebaseFirestore(), ACK_COLLECTIONS.acknowledgements),
    where('document_id', '==', documentId),
    where('employee_id', '==', employeeId),
  ));
  return snap.docs.some((d) => {
    const data = d.data();
    return data.document_version === version && !['Cancelled', 'Expired'].includes(data.acknowledgement_status as string);
  });
}

export async function syncFromDistributions(): Promise<number> {
  const distSnap = await getDocs(query(
    collection(getFirebaseFirestore(), ACK_COLLECTIONS.distribution),
    where('acknowledgement_required', '==', true),
  ));
  let created = 0;
  const today = now().split('T')[0];
  for (const d of distSnap.docs) {
    const dist = d.data();
    if (!['Distributed', 'Pending Acknowledgement'].includes(dist.status as string)) continue;
    const users = (dist.assigned_users as string[]) || [];
    const names = (dist.assigned_user_names as string[]) || [];
    if (!users.length) {
      const depts = (dist.assigned_departments as string[]) || [dist.department].filter(Boolean);
      for (const dept of depts) {
        const ackNum = await generateAcknowledgementNumber();
        const dup = await findDuplicate(dist.document_id as string, `dept-${dept}`, dist.document_version as string);
        if (dup) continue;
        await addDoc(collection(getFirebaseFirestore(), ACK_COLLECTIONS.acknowledgements), {
          acknowledgement_id: ackNum, acknowledgement_number: ackNum,
          document_id: dist.document_id, document_number: dist.document_number,
          document_title: dist.document_title, document_version: dist.document_version,
          document_type: dist.document_type, distribution_id: d.id,
          employee_id: `dept-${dept}`, employee_name: `${dept} (Department)`, department: dept,
          role: '', assigned_date: today, due_date: dist.expiry_date || null,
          acknowledgement_status: 'Pending', completion_status: 'Incomplete',
          electronic_signature_required: Boolean(dist.read_confirmation_required),
          electronic_signature_status: 'pending', training_required: Boolean(dist.training_required),
          training_pending: Boolean(dist.training_required),
          created_by: dist.created_by, created_by_name: dist.created_by_name,
          updated_by: dist.created_by, updated_by_name: dist.created_by_name,
          created_at: now(), updated_at: now(),
        });
        created++;
      }
      continue;
    }
    for (let i = 0; i < users.length; i++) {
      const uid = users[i];
      const dup = await findDuplicate(dist.document_id as string, uid, dist.document_version as string);
      if (dup) continue;
      const ackNum = await generateAcknowledgementNumber();
      await addDoc(collection(getFirebaseFirestore(), ACK_COLLECTIONS.acknowledgements), {
        acknowledgement_id: ackNum, acknowledgement_number: ackNum,
        document_id: dist.document_id, document_number: dist.document_number,
        document_title: dist.document_title, document_version: dist.document_version,
        document_type: dist.document_type, distribution_id: d.id,
        employee_id: uid, employee_name: names[i] || uid, department: dist.department || '',
        role: ((dist.assigned_roles as string[]) || [])[0] || '',
        assigned_date: today, due_date: dist.expiry_date || null,
        acknowledgement_status: 'Pending', completion_status: 'Incomplete',
        electronic_signature_required: Boolean(dist.read_confirmation_required),
        electronic_signature_status: 'pending', training_required: Boolean(dist.training_required),
        training_pending: Boolean(dist.training_required),
        created_by: dist.created_by, created_by_name: dist.created_by_name,
        updated_by: dist.created_by, updated_by_name: dist.created_by_name,
        created_at: now(), updated_at: now(),
      });
      await notify('Document Assigned', `${dist.document_number} assigned for acknowledgement`, ackNum, [], [uid]);
      created++;
    }
  }
  return created;
}

export async function closeSupersededAcknowledgements(): Promise<number> {
  const records = await listAllAcknowledgements();
  let count = 0;
  const batch = writeBatch(getFirebaseFirestore());
  for (const r of records) {
    if (['Acknowledged', 'Cancelled', 'Expired'].includes(r.acknowledgement_status)) continue;
    const docRecord = await getDocumentById(r.document_id);
    if (!docRecord || docRecord.status !== 'effective' || !docRecord.is_latest || docRecord.version !== r.document_version) {
      batch.update(doc(getFirebaseFirestore(), ACK_COLLECTIONS.acknowledgements, r.id), {
        acknowledgement_status: 'Cancelled',
        completion_status: 'Incomplete',
        comments: 'Auto-closed: document superseded',
        updated_at: now(),
      });
      count++;
    }
  }
  if (count > 0) await batch.commit();
  return count;
}

export async function syncOverdueAcknowledgements(): Promise<number> {
  const today = now().split('T')[0];
  const records = await listAllAcknowledgements();
  let count = 0;
  for (const r of records) {
    if (!r.due_date || r.due_date >= today) continue;
    if (['Acknowledged', 'Overdue', 'Expired', 'Cancelled'].includes(r.acknowledgement_status)) continue;
    await updateDoc(doc(getFirebaseFirestore(), ACK_COLLECTIONS.acknowledgements, r.id), {
      acknowledgement_status: 'Overdue', updated_at: now(),
    });
    await notify('Overdue Reminder', `${r.document_number} acknowledgement overdue`, r.id, ['qa_manager', 'head_qa', 'production_manager'], [r.employee_id]);
    await audit({ id: 'system', name: 'System', role: 'system' }, 'OVERDUE', r.id, r.acknowledgement_status, 'Overdue');
    count++;
  }
  return count;
}

export async function createAcknowledgementAssignment(input: AckAssignInput, actor: AcknowledgementActor): Promise<DocumentAcknowledgementRecord> {
  const docRecord = await getDocumentById(input.document_id);
  if (!docRecord) throw new Error('Document not found');
  const validationError = validateDocumentForAcknowledgement(docRecord.status, docRecord.is_latest !== false);
  if (validationError) throw new Error(validationError);
  if (input.document_version !== docRecord.version) throw new Error('Document version mismatch');

  const isDup = await findDuplicate(input.document_id, input.employee_id, input.document_version);
  if (isDup) throw new Error('Acknowledgement already exists for this employee and document version');

  const ackNum = await generateAcknowledgementNumber();
  const timestamp = now();
  const payload = {
    acknowledgement_id: ackNum, acknowledgement_number: ackNum,
    document_id: docRecord.id, document_number: docRecord.document_number,
    document_title: docRecord.document_title, document_version: input.document_version,
    document_type: docRecord.document_type, distribution_id: input.distribution_id || null,
    employee_id: input.employee_id, employee_name: input.employee_name,
    department: input.department, role: input.role,
    assigned_date: timestamp.split('T')[0], due_date: input.due_date || null,
    viewed_date: null, read_confirmation_date: null, acknowledgement_date: null,
    electronic_signature_required: input.electronic_signature_required,
    electronic_signature_status: input.electronic_signature_required ? 'pending' : 'not_required',
    acknowledgement_status: 'Pending', completion_status: 'Incomplete',
    training_required: input.training_required, training_pending: input.training_required,
    comments: '', ...clientMeta(),
    created_by: actor.id, created_by_name: actor.name,
    updated_by: actor.id, updated_by_name: actor.name,
    created_at: timestamp, updated_at: timestamp,
  };

  const ref = await addDoc(collection(getFirebaseFirestore(), ACK_COLLECTIONS.acknowledgements), payload);
  await notify('Document Assigned', `${docRecord.document_number} assigned for acknowledgement`, ref.id, [], [input.employee_id]);
  await audit(actor, 'ACKNOWLEDGEMENT_CREATED', ref.id, null, payload);
  return { id: ref.id, ...payload };
}

export async function recordDocumentView(id: string, actor: AcknowledgementActor): Promise<DocumentAcknowledgementRecord> {
  const record = await getAcknowledgementById(id);
  if (!record) throw new Error('Acknowledgement not found');
  const actorError = validateAcknowledgementActor(record.employee_id, actor.id, actor.role);
  if (actorError) throw new Error(actorError);

  const updates = {
    viewed_date: now(),
    acknowledgement_status: record.acknowledgement_status === 'Pending' ? 'Viewed' : record.acknowledgement_status,
    ...clientMeta(), updated_at: now(), updated_by: actor.id, updated_by_name: actor.name,
  };
  await updateDoc(doc(getFirebaseFirestore(), ACK_COLLECTIONS.acknowledgements, id), updates);
  await addDoc(collection(getFirebaseFirestore(), ACK_COLLECTIONS.readConfirmations), {
    acknowledgement_id: id, document_id: record.document_id, employee_id: actor.id,
    event_type: 'view', event_date: now(), ...clientMeta(),
  });
  await audit(actor, 'DOCUMENT_VIEWED', id, record.acknowledgement_status, 'Viewed');
  return { ...record, ...updates, acknowledgement_status: updates.acknowledgement_status as string };
}

export async function recordReadConfirmation(id: string, comments: string, actor: AcknowledgementActor): Promise<DocumentAcknowledgementRecord> {
  const record = await getAcknowledgementById(id);
  if (!record) throw new Error('Acknowledgement not found');
  const actorError = validateAcknowledgementActor(record.employee_id, actor.id, actor.role);
  if (actorError) throw new Error(actorError);

  const timestamp = now();
  const updates = {
    read_confirmation_date: timestamp,
    acknowledgement_status: 'Read Confirmed',
    comments: comments || record.comments,
    ...clientMeta(), updated_at: timestamp, updated_by: actor.id, updated_by_name: actor.name,
  };
  await updateDoc(doc(getFirebaseFirestore(), ACK_COLLECTIONS.acknowledgements, id), updates);
  await addDoc(collection(getFirebaseFirestore(), ACK_COLLECTIONS.readConfirmations), {
    acknowledgement_id: id, document_id: record.document_id, employee_id: actor.id,
    event_type: 'read_confirmed', event_date: timestamp, comments, ...clientMeta(),
  });
  await audit(actor, 'READ_CONFIRMED', id, record.acknowledgement_status, 'Read Confirmed');
  return { ...record, ...updates, acknowledgement_status: 'Read Confirmed' };
}

async function assignTrainingAfterAck(record: DocumentAcknowledgementRecord, actor: AcknowledgementActor) {
  if (!record.training_required) return;
  await addDoc(collection(getFirebaseFirestore(), ACK_COLLECTIONS.trainingAssignments), {
    document_id: record.document_id, document_number: record.document_number,
    document_title: record.document_title, document_version: record.document_version,
    acknowledgement_id: record.id, employee_id: record.employee_id, employee_name: record.employee_name,
    training_title: `Post-Ack Training: ${record.document_title} v${record.document_version}`,
    status: 'pending', created_at: now(),
  });
  await updateDoc(doc(getFirebaseFirestore(), ACK_COLLECTIONS.acknowledgements, record.id), { training_pending: true, updated_at: now() });
  await notify('Training Assigned', `Training assigned after acknowledgement of ${record.document_number}`, record.id, ['training_coordinator'], [record.employee_id]);
  await audit(actor, 'TRAINING_ASSIGNED', record.id, null, record.document_number);
}

export async function acknowledgeDocument(id: string, input: AckSubmitInput, actor: AcknowledgementActor): Promise<DocumentAcknowledgementRecord> {
  const record = await getAcknowledgementById(id);
  if (!record) throw new Error('Acknowledgement not found');
  const actorError = validateAcknowledgementActor(record.employee_id, actor.id, actor.role);
  if (actorError) throw new Error(actorError);
  if (record.acknowledgement_status === 'Acknowledged') throw new Error('Acknowledgement cannot be duplicated');

  const docRecord = await getDocumentById(record.document_id);
  if (!docRecord || docRecord.status !== 'effective') throw new Error('Only Effective documents can be acknowledged');

  if (record.electronic_signature_required && !input.electronic_signature?.trim()) {
    throw new Error('Electronic signature is required');
  }

  const timestamp = now();
  const updates = {
    acknowledgement_date: timestamp,
    acknowledgement_status: 'Acknowledged',
    completion_status: 'Completed',
    electronic_signature_status: record.electronic_signature_required ? 'signed' : 'not_required',
    comments: input.comments || record.comments,
    ...clientMeta(), updated_at: timestamp, updated_by: actor.id, updated_by_name: actor.name,
  };
  await updateDoc(doc(getFirebaseFirestore(), ACK_COLLECTIONS.acknowledgements, id), updates);
  if (record.electronic_signature_required) {
    await audit(actor, 'ELECTRONIC_SIGNATURE_APPLIED', id, 'pending', 'signed');
  }
  await audit(actor, 'ACKNOWLEDGED', id, record.acknowledgement_status, 'Acknowledged', input.comments);
  await notify('Acknowledgement Completed', `${record.document_number} acknowledged by ${record.employee_name}`, id, ['qa_manager'], []);
  const result = { ...record, ...updates, acknowledgement_status: 'Acknowledged' as const, completion_status: 'Completed' as const };
  if (record.training_required) await assignTrainingAfterAck(result, actor);
  return result;
}

export async function sendBulkReminders(ids: string[], actor: AcknowledgementActor): Promise<number> {
  let count = 0;
  for (const id of ids) {
    const record = await getAcknowledgementById(id);
    if (!record || record.completion_status === 'Completed') continue;
    await notify('Acknowledgement Reminder', `Reminder: acknowledge ${record.document_number}`, id, [], [record.employee_id]);
    await audit(actor, 'REMINDER_SENT', id, null, record.employee_name);
    count++;
  }
  return count;
}

export async function escalateOverdue(actor: AcknowledgementActor): Promise<number> {
  const overdue = (await listAllAcknowledgements()).filter((r) => r.acknowledgement_status === 'Overdue');
  for (const r of overdue) {
    await notify('Escalation', `Escalated: ${r.document_number} overdue for ${r.employee_name}`, r.id, ['head_qa', 'qa_manager'], [r.employee_id]);
    await audit(actor, 'ESCALATED', r.id, 'Overdue', 'Escalated');
  }
  return overdue.length;
}

export async function fetchAcknowledgementDashboardData(filters?: AcknowledgementFilters, actor?: AcknowledgementActor) {
  await Promise.all([syncFromDistributions(), closeSupersededAcknowledgements(), syncOverdueAcknowledgements()]);
  let records = await listAllAcknowledgements();
  const role = actor?.role || '';
  if (canViewOwnOnly(role) && actor?.id) {
    records = records.filter((r) => r.employee_id === actor.id || r.employee_id === `dept-${actor.department}`);
  } else if (role.includes('manager') && actor?.department && !['super_admin', 'admin', 'head_qa', 'qa_manager'].includes(role)) {
    records = records.filter((r) => r.department === actor.department);
  }
  if (filters) records = filterAckRecords(records, filters);
  return { records, metrics: computeAckKpis(records), charts: computeAckCharts(records) };
}

export async function getAcknowledgementById(id: string): Promise<DocumentAcknowledgementRecord | null> {
  const snap = await getDoc(doc(getFirebaseFirestore(), ACK_COLLECTIONS.acknowledgements, id));
  if (!snap.exists()) return null;
  return mapAcknowledgementRaw({ id: snap.id, ...snap.data() });
}

export function exportAcknowledgementsCsv(records: DocumentAcknowledgementRecord[]) {
  downloadCsv('document-acknowledgements.csv',
    ['Ack Number', 'Document Number', 'Title', 'Version', 'Employee', 'Department', 'Status', 'Due Date', 'Ack Date'],
    records.map((r) => [r.acknowledgement_number, r.document_number, r.document_title, r.document_version, r.employee_name, r.department, r.acknowledgement_status, r.due_date, r.acknowledgement_date]),
  );
}

export function exportAcknowledgementsExcel(records: DocumentAcknowledgementRecord[]) { exportAcknowledgementsCsv(records); }

export async function logAckDashboardViewed(actor: AcknowledgementActor) {
  await audit(actor, 'DASHBOARD_VIEWED', 'ack-dashboard', null, null);
}

export async function logAckExported(actor: AcknowledgementActor, format: string, count: number) {
  await audit(actor, 'EXPORTED', 'ack-dashboard', null, { format, count });
}
