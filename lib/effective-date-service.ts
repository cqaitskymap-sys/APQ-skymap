import {
  addDoc, collection, doc, getDoc, getDocs, limit, orderBy, query, updateDoc, where,
} from 'firebase/firestore';
import { getFirebaseFirestore } from '@/lib/firebase';
import { logAuditEvent } from '@/lib/admin/admin-service';
import { downloadCsv } from '@/lib/export-utils';
import { listDocuments, getDocumentById, syncEffectiveDocuments } from '@/lib/dms-service';
import type { DocumentRecord } from '@/lib/dms-types';
import type { EffectiveDateRecord, EffectiveDateFilters, EffectiveDateActor } from './effective-date-types';
import {
  mapEffectiveDateRaw, computeEffectiveDateKpis, computeEffectiveDateCharts,
  filterEffectiveDateRecords,
} from './effective-date-records';
import type { ScheduleEffectiveDateInput, RollbackInput, OverrideActivationInput } from './effective-date-schemas';
import {
  EDM_COLLECTIONS, DEFAULT_ROLLBACK_WINDOW_HOURS, DEFAULT_TIME_ZONE,
} from './effective-date-types';

function now() { return new Date().toISOString(); }
function todayStr() { return new Date().toISOString().split('T')[0]; }

async function audit(actor: EffectiveDateActor, action: string, recordId: string, oldValue: unknown, newValue: unknown, reason = '') {
  await logAuditEvent({
    userId: actor.id, userName: actor.name, module: 'Effective Date Management', recordId, action,
    oldValue: oldValue ? JSON.stringify(oldValue) : '',
    newValue: newValue ? JSON.stringify(newValue) : '',
    reason, ipAddress: 'client', device: typeof navigator !== 'undefined' ? navigator.userAgent : 'server',
    status: 'Success',
  });
}

async function notify(title: string, message: string, recordId: string, roles: string[] = []) {
  try {
    const db = getFirebaseFirestore();
    for (const role of roles) {
      await addDoc(collection(db, EDM_COLLECTIONS.notifications), {
        title, message, module: 'Effective Date Management', record_id: recordId, target_role: role, read: false, created_at: now(),
      });
    }
  } catch (e) { console.error('Effective date notification failed:', e); }
}

export async function generateEffectiveDateId(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `EFF-${year}-`;
  try {
    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), EDM_COLLECTIONS.effectiveDates),
      where('effective_date_id', '>=', prefix),
      where('effective_date_id', '<=', `${prefix}\uf8ff`),
      orderBy('effective_date_id', 'desc'),
      limit(1),
    ));
    if (!snap.empty) {
      const last = snap.docs[0].data().effective_date_id as string;
      return `${prefix}${String(parseInt(last.split('-').pop() || '0', 10) + 1).padStart(4, '0')}`;
    }
  } catch {
    const all = await getDocs(collection(getFirebaseFirestore(), EDM_COLLECTIONS.effectiveDates));
    return `${prefix}${String(all.size + 1).padStart(4, '0')}`;
  }
  return `${prefix}0001`;
}

async function listAllEffectiveDateRecords(): Promise<EffectiveDateRecord[]> {
  try {
    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), EDM_COLLECTIONS.effectiveDates),
      orderBy('updated_at', 'desc'),
    ));
    return snap.docs.map((d) => mapEffectiveDateRaw({ id: d.id, ...d.data() }));
  } catch {
    const snap = await getDocs(collection(getFirebaseFirestore(), EDM_COLLECTIONS.effectiveDates));
    return snap.docs.map((d) => mapEffectiveDateRaw({ id: d.id, ...d.data() }))
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  }
}

export async function checkTrainingDependency(documentId: string): Promise<{ complete: boolean; status: string }> {
  try {
    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), EDM_COLLECTIONS.trainingAssignments),
      where('document_id', '==', documentId),
      limit(20),
    ));
    if (snap.empty) return { complete: true, status: 'Not Required' };
    const assignments = snap.docs.map((d) => d.data());
    const pending = assignments.filter((a) => !['Completed', 'Complete', 'completed'].includes(String(a.status)));
    if (pending.length) return { complete: false, status: 'Pending' };
    return { complete: true, status: 'Completed' };
  } catch {
    return { complete: true, status: 'Not Required' };
  }
}

function deriveActivationStatus(doc: DocumentRecord, trainingStatus: string, trainingRequired: boolean): string {
  if (doc.status === 'effective') return 'Activated';
  if (trainingRequired && trainingStatus === 'Pending') return 'Waiting For Training';
  const today = todayStr();
  if (doc.effective_date && doc.effective_date > today) return 'Scheduled';
  if (doc.status === 'approved' && doc.effective_date && doc.effective_date <= today) return 'Ready';
  if (doc.status === 'approved') return 'Pending';
  return 'Pending';
}

export async function syncActivationRecordsFromDocuments(): Promise<number> {
  const docs = await listDocuments();
  const approvedOrEffective = docs.filter((d) => ['approved', 'effective'].includes(d.status));
  const existing = await listAllEffectiveDateRecords();
  const byDocId = new Map(existing.map((e) => [e.document_id, e]));
  let created = 0;

  for (const d of approvedOrEffective) {
    if (!d.effective_date) continue;
    const training = await checkTrainingDependency(d.id);
    const trainingRequired = Boolean(d.training_required);
    const status = deriveActivationStatus(d, training.status, trainingRequired);

    if (byDocId.has(d.id)) {
      const rec = byDocId.get(d.id)!;
      const updates: Partial<EffectiveDateRecord> & { updated_at: string } = { updated_at: now() };
      if (rec.activation_status !== status) updates.activation_status = status;
      if (rec.training_completion_status !== training.status) updates.training_completion_status = training.status;
      if (d.status === 'effective' && !rec.activated_at) {
        updates.activated_at = now();
        updates.activation_status = 'Activated';
      }
      if (Object.keys(updates).length > 1) {
        await updateDoc(doc(getFirebaseFirestore(), EDM_COLLECTIONS.effectiveDates, rec.id), updates);
      }
      continue;
    }

    const effId = await generateEffectiveDateId();
    await addDoc(collection(getFirebaseFirestore(), EDM_COLLECTIONS.effectiveDates), {
      effective_date_id: effId,
      document_id: d.id, document_number: d.document_number, document_title: d.document_title,
      document_type: d.document_type, version: d.version,
      approval_date: d.updated_at?.split('T')[0] || null,
      effective_date: d.effective_date, activation_time: '00:00', time_zone: DEFAULT_TIME_ZONE,
      training_required: trainingRequired,
      training_completion_status: training.status,
      distribution_status: d.status === 'effective' ? 'Pending' : 'Not Started',
      superseded_version: d.supersedes_document_id || null,
      current_effective_version: d.version,
      activation_status: status,
      activation_method: 'Automatic',
      rollback_allowed: true,
      rollback_window_hours: DEFAULT_ROLLBACK_WINDOW_HOURS,
      reason: '', department: d.department,
      activated_at: d.status === 'effective' ? now() : null,
      created_by: d.created_by, created_by_name: d.created_by_name,
      updated_by: d.updated_by, updated_by_name: d.updated_by_name,
      created_at: now(), updated_at: now(),
    });
    created++;
  }
  return created;
}

export async function processScheduledActivations(actor: EffectiveDateActor): Promise<{ activated: number; delayed: number }> {
  await syncActivationRecordsFromDocuments();
  const records = await listAllEffectiveDateRecords();
  const today = todayStr();
  let activated = 0;
  let delayed = 0;

  for (const r of records) {
    if (r.activation_status === 'Activated') continue;
    if (!['Scheduled', 'Ready', 'Waiting For Training'].includes(r.activation_status)) continue;
    if (r.effective_date > today) continue;

    if (r.training_required && r.training_completion_status !== 'Completed') {
      if (r.activation_status !== 'Waiting For Training') {
        await updateDoc(doc(getFirebaseFirestore(), EDM_COLLECTIONS.effectiveDates, r.id), {
          activation_status: 'Waiting For Training', updated_at: now(),
        });
        await notify('Training Blocking Activation', `${r.document_number} awaiting training`, r.id, ['qa_manager', 'head_qa']);
        await audit(actor, 'TRAINING_DEPENDENCY_CHECKED', r.id, r.activation_status, 'Waiting For Training');
      }
      delayed++;
      continue;
    }

    const docRecord = await getDocumentById(r.document_id);
    if (!docRecord || docRecord.status !== 'approved') continue;
    if (docRecord.approved_by && r.approval_date && r.effective_date < r.approval_date) {
      await updateDoc(doc(getFirebaseFirestore(), EDM_COLLECTIONS.effectiveDates, r.id), {
        activation_status: 'Delayed', reason: 'Effective date precedes approval date', updated_at: now(),
      });
      await notify('Activation Delayed', `${r.document_number} — invalid effective date`, r.id, ['qa_manager']);
      delayed++;
      continue;
    }

    await updateDoc(doc(getFirebaseFirestore(), EDM_COLLECTIONS.documents, r.document_id), {
      status: 'effective', updated_at: now(), lifecycle_stage: 'Effective',
    });

    await updateDoc(doc(getFirebaseFirestore(), EDM_COLLECTIONS.effectiveDates, r.id), {
      activation_status: 'Activated', activated_at: now(), distribution_status: 'Pending', updated_at: now(),
    });

    await notify('Document Activated', `${r.document_number} v${r.version} is now effective`, r.id, ['qa_manager', 'production_manager']);
    await audit(actor, 'ACTIVATION_COMPLETED', r.id, 'Scheduled', 'Activated');
    activated++;
  }

  await syncEffectiveDocuments();
  return { activated, delayed };
}

export async function scheduleEffectiveDate(input: ScheduleEffectiveDateInput, actor: EffectiveDateActor): Promise<EffectiveDateRecord> {
  const docRecord = await getDocumentById(input.document_id);
  if (!docRecord) throw new Error('Document not found');
  if (docRecord.status !== 'approved') throw new Error('Only approved documents can be scheduled');
  if (input.version !== docRecord.version) throw new Error('Version mismatch');

  const approvalDate = docRecord.updated_at?.split('T')[0] || todayStr();
  if (input.effective_date < approvalDate) {
    throw new Error('Effective date cannot precede approval date');
  }

  const existing = await getDocs(query(
    collection(getFirebaseFirestore(), EDM_COLLECTIONS.effectiveDates),
    where('document_id', '==', input.document_id),
    limit(5),
  ));
  const open = existing.docs.find((d) => !['Activated', 'Cancelled', 'Rolled Back'].includes(d.data().activation_status as string));
  if (open) throw new Error('Document already has an open activation schedule');

  const effId = await generateEffectiveDateId();
  const timestamp = now();
  const training = await checkTrainingDependency(input.document_id);
  const payload = {
    effective_date_id: effId,
    document_id: docRecord.id, document_number: docRecord.document_number,
    document_title: docRecord.document_title, document_type: docRecord.document_type,
    version: input.version, approval_date: approvalDate,
    effective_date: input.effective_date, activation_time: input.activation_time,
    time_zone: input.time_zone || DEFAULT_TIME_ZONE,
    training_required: input.training_required,
    training_completion_status: input.training_required ? training.status : 'Not Required',
    distribution_status: 'Not Started',
    superseded_version: docRecord.supersedes_document_id || null,
    current_effective_version: input.version,
    activation_status: input.effective_date > todayStr() ? 'Scheduled' : 'Ready',
    activation_method: input.activation_method,
    rollback_allowed: true, rollback_window_hours: DEFAULT_ROLLBACK_WINDOW_HOURS,
    reason: input.reason, department: docRecord.department,
    activated_at: null, rolled_back_at: null,
    created_by: actor.id, created_by_name: actor.name,
    updated_by: actor.id, updated_by_name: actor.name,
    created_at: timestamp, updated_at: timestamp,
  };

  await updateDoc(doc(getFirebaseFirestore(), EDM_COLLECTIONS.documents, input.document_id), {
    effective_date: input.effective_date, updated_at: timestamp,
    updated_by: actor.id, updated_by_name: actor.name,
  });

  const ref = await addDoc(collection(getFirebaseFirestore(), EDM_COLLECTIONS.effectiveDates), payload);
  await notify('Effective Date Scheduled', `${docRecord.document_number} effective ${input.effective_date}`, ref.id, ['qa_manager']);
  await audit(actor, 'EFFECTIVE_DATE_SCHEDULED', ref.id, null, payload);
  return { id: ref.id, ...payload };
}

export async function activateManually(recordId: string, actor: EffectiveDateActor, override?: OverrideActivationInput): Promise<void> {
  const rec = await getEffectiveDateById(recordId);
  if (!rec) throw new Error('Record not found');
  if (rec.training_required && rec.training_completion_status !== 'Completed' && !override) {
    throw new Error('Training incomplete — QA override required');
  }
  if (override) await audit(actor, 'ACTIVATION_OVERRIDE', recordId, rec.activation_status, 'Ready', override.reason);

  await updateDoc(doc(getFirebaseFirestore(), EDM_COLLECTIONS.documents, rec.document_id), {
    status: 'effective', lifecycle_stage: 'Effective', updated_at: now(),
    updated_by: actor.id, updated_by_name: actor.name,
  });
  await updateDoc(doc(getFirebaseFirestore(), EDM_COLLECTIONS.effectiveDates, recordId), {
    activation_status: 'Activated', activation_method: 'Manual',
    activated_at: now(), distribution_status: 'Pending', updated_at: now(),
    updated_by: actor.id, updated_by_name: actor.name,
  });
  await syncEffectiveDocuments();
  await notify('Document Activated', `${rec.document_number} manually activated`, recordId, ['qa_manager']);
  await audit(actor, 'ACTIVATION_COMPLETED', recordId, rec.activation_status, 'Activated');
}

export async function rollbackActivation(recordId: string, input: RollbackInput, actor: EffectiveDateActor): Promise<void> {
  const rec = await getEffectiveDateById(recordId);
  if (!rec) throw new Error('Record not found');
  if (!rec.rollback_allowed) throw new Error('Rollback not allowed for this record');
  if (rec.activation_status !== 'Activated') throw new Error('Only activated documents can be rolled back');
  if (rec.activated_at) {
    const hours = (Date.now() - new Date(rec.activated_at).getTime()) / 3600000;
    if (hours > rec.rollback_window_hours) throw new Error(`Rollback window expired (${rec.rollback_window_hours}h)`);
  }

  await updateDoc(doc(getFirebaseFirestore(), EDM_COLLECTIONS.documents, rec.document_id), {
    status: 'approved', lifecycle_stage: 'Approved', updated_at: now(),
    updated_by: actor.id, updated_by_name: actor.name,
  });
  await updateDoc(doc(getFirebaseFirestore(), EDM_COLLECTIONS.effectiveDates, recordId), {
    activation_status: 'Rolled Back', rolled_back_at: now(), reason: input.reason, updated_at: now(),
    updated_by: actor.id, updated_by_name: actor.name,
  });
  await notify('Rollback Completed', `${rec.document_number} rolled back`, recordId, ['qa_manager', 'head_qa']);
  await audit(actor, 'ROLLBACK_COMPLETED', recordId, 'Activated', 'Rolled Back', input.reason);
}

export async function cancelActivation(recordId: string, reason: string, actor: EffectiveDateActor): Promise<void> {
  const rec = await getEffectiveDateById(recordId);
  if (!rec) throw new Error('Record not found');
  if (rec.activation_status === 'Activated') throw new Error('Cannot cancel activated record');
  await updateDoc(doc(getFirebaseFirestore(), EDM_COLLECTIONS.effectiveDates, recordId), {
    activation_status: 'Cancelled', reason, updated_at: now(),
    updated_by: actor.id, updated_by_name: actor.name,
  });
  await audit(actor, 'ACTIVATION_CANCELLED', recordId, rec.activation_status, 'Cancelled', reason);
}

export async function bulkActivate(recordIds: string[], actor: EffectiveDateActor): Promise<number> {
  let count = 0;
  for (const id of recordIds) {
    try {
      await activateManually(id, actor);
      count++;
    } catch { /* skip */ }
  }
  return count;
}

export async function rescheduleEffectiveDate(recordId: string, effectiveDate: string, actor: EffectiveDateActor): Promise<void> {
  const rec = await getEffectiveDateById(recordId);
  if (!rec) throw new Error('Record not found');
  if (['Activated', 'Cancelled', 'Rolled Back'].includes(rec.activation_status)) {
    throw new Error('Cannot reschedule closed activation');
  }
  const approvalDate = rec.approval_date || todayStr();
  if (effectiveDate < approvalDate) throw new Error('Effective date cannot precede approval date');

  const status = effectiveDate > todayStr() ? 'Scheduled' : 'Ready';
  const timestamp = now();
  await updateDoc(doc(getFirebaseFirestore(), EDM_COLLECTIONS.documents, rec.document_id), {
    effective_date: effectiveDate, updated_at: timestamp,
    updated_by: actor.id, updated_by_name: actor.name,
  });
  await updateDoc(doc(getFirebaseFirestore(), EDM_COLLECTIONS.effectiveDates, recordId), {
    effective_date: effectiveDate, activation_status: status,
    activation_method: 'Scheduled', reason: 'Bulk reschedule', updated_at: timestamp,
    updated_by: actor.id, updated_by_name: actor.name,
  });
  await audit(actor, 'EFFECTIVE_DATE_RESCHEDULED', recordId, rec.effective_date, effectiveDate);
}

export async function bulkSchedule(recordIds: string[], effectiveDate: string, actor: EffectiveDateActor): Promise<number> {
  let count = 0;
  for (const id of recordIds) {
    try {
      await rescheduleEffectiveDate(id, effectiveDate, actor);
      count++;
    } catch { /* skip */ }
  }
  return count;
}

export async function fetchEffectiveDateDashboardData(filters?: EffectiveDateFilters) {
  await syncActivationRecordsFromDocuments();
  await processScheduledActivations({ id: 'system', name: 'System', role: 'system' });
  let records = await listAllEffectiveDateRecords();
  if (filters) records = filterEffectiveDateRecords(records, filters);
  return { records, metrics: computeEffectiveDateKpis(records), charts: computeEffectiveDateCharts(records) };
}

export async function getEffectiveDateById(id: string): Promise<EffectiveDateRecord | null> {
  const snap = await getDoc(doc(getFirebaseFirestore(), EDM_COLLECTIONS.effectiveDates, id));
  if (!snap.exists()) return null;
  return mapEffectiveDateRaw({ id: snap.id, ...snap.data() });
}

export function exportEffectiveDatesCsv(records: EffectiveDateRecord[]) {
  downloadCsv('effective-dates.csv',
    ['ID', 'Document', 'Version', 'Effective Date', 'Status', 'Training', 'Distribution', 'Method'],
    records.map((r) => [
      r.effective_date_id, r.document_number, r.version, r.effective_date,
      r.activation_status, r.training_completion_status, r.distribution_status, r.activation_method,
    ]),
  );
}

export function exportEffectiveDatesExcel(records: EffectiveDateRecord[]) { exportEffectiveDatesCsv(records); }

export async function logEffectiveDateDashboardViewed(actor: EffectiveDateActor) {
  await audit(actor, 'DASHBOARD_VIEWED', 'effective-date-dashboard', null, null);
}

export async function logEffectiveDateExported(actor: EffectiveDateActor, format: string, count: number) {
  await audit(actor, 'EFFECTIVE_DATE_EXPORTED', 'effective-date-dashboard', null, { format, count });
}

/** Server-side entry point for cron / Cloud Functions */
export async function runScheduledEffectiveDateActivation(): Promise<{ activated: number; delayed: number }> {
  return processScheduledActivations({ id: 'scheduler', name: 'Scheduled Job', role: 'system' });
}
