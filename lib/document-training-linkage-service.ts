import {
  addDoc, collection, doc, getDoc, getDocs, limit, orderBy, query, updateDoc, where,
} from 'firebase/firestore';
import { getFirebaseFirestore } from '@/lib/firebase';
import { logAuditEvent } from '@/lib/admin/admin-service';
import { downloadCsv } from '@/lib/export-utils';
import { listDocuments, getDocumentById } from '@/lib/dms-service';
import {
  listEmployees, createTrainingMaster, createAssignment, syncDmsTrainingLinks,
} from '@/lib/training-service';
import type { TmsActor } from '@/lib/training-types';
import type {
  DocumentTrainingLinkRecord, TrainingLinkageFilters, TrainingLinkageActor,
} from './document-training-linkage-types';
import {
  mapTrainingLinkRaw, computeTrainingLinkageKpis, computeTrainingLinkageCharts,
  filterTrainingLinkRecords,
} from './document-training-linkage-records';
import type { CreateTrainingLinkInput, RetrainingInput } from './document-training-linkage-schemas';
import {
  DTL_COLLECTIONS, DEFAULT_GRACE_PERIOD_DAYS, DEFAULT_PASSING_SCORE, REMINDER_DAYS,
} from './document-training-linkage-types';

function now() { return new Date().toISOString(); }
function todayStr() { return new Date().toISOString().split('T')[0]; }

function toTmsActor(actor: TrainingLinkageActor): TmsActor {
  return { id: actor.id, name: actor.name, role: actor.role };
}

async function audit(actor: TrainingLinkageActor, action: string, recordId: string, oldValue: unknown, newValue: unknown, reason = '') {
  await logAuditEvent({
    userId: actor.id, userName: actor.name, module: 'Document Training Linkage', recordId, action,
    oldValue: oldValue ? JSON.stringify(oldValue) : '',
    newValue: newValue ? JSON.stringify(newValue) : '',
    reason, ipAddress: 'client', device: typeof navigator !== 'undefined' ? navigator.userAgent : 'server',
    status: 'Success',
  });
}

async function notify(title: string, message: string, recordId: string, roles: string[] = [], userId?: string) {
  try {
    const db = getFirebaseFirestore();
    await addDoc(collection(db, DTL_COLLECTIONS.notifications), {
      title, message, module: 'Document Training Linkage', record_id: recordId,
      ...(userId ? { user_id: userId } : {}),
      ...(roles.length ? { target_roles: roles } : {}),
      read: false, created_at: now(),
    });
  } catch (e) { console.error('Training linkage notification failed:', e); }
}

export async function generateTrainingLinkId(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `DTL-${year}-`;
  try {
    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), DTL_COLLECTIONS.links),
      where('training_link_id', '>=', prefix),
      where('training_link_id', '<=', `${prefix}\uf8ff`),
      orderBy('training_link_id', 'desc'),
      limit(1),
    ));
    if (!snap.empty) {
      const last = snap.docs[0].data().training_link_id as string;
      return `${prefix}${String(parseInt(last.split('-').pop() || '0', 10) + 1).padStart(4, '0')}`;
    }
  } catch {
    const all = await getDocs(collection(getFirebaseFirestore(), DTL_COLLECTIONS.links));
    return `${prefix}${String(all.size + 1).padStart(4, '0')}`;
  }
  return `${prefix}0001`;
}

async function listAllTrainingLinks(): Promise<DocumentTrainingLinkRecord[]> {
  try {
    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), DTL_COLLECTIONS.links),
      orderBy('updated_at', 'desc'),
    ));
    return snap.docs.map((d) => mapTrainingLinkRaw({ id: d.id, ...d.data() }));
  } catch {
    const snap = await getDocs(collection(getFirebaseFirestore(), DTL_COLLECTIONS.links));
    return snap.docs.map((d) => mapTrainingLinkRaw({ id: d.id, ...d.data() }))
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  }
}

async function hasActiveLink(documentId: string, version?: string): Promise<boolean> {
  const snap = await getDocs(query(
    collection(getFirebaseFirestore(), DTL_COLLECTIONS.links),
    where('document_id', '==', documentId),
    limit(10),
  ));
  return snap.docs.some((d) => {
    const data = d.data();
    if (['Completed', 'Cancelled', 'Expired'].includes(data.status as string)) return false;
    if (version && data.version !== version) return false;
    return true;
  });
}

async function resolveTargetEmployees(link: DocumentTrainingLinkRecord): Promise<Array<{ id: string; full_name: string; department: string; designation: string }>> {
  const employees = await listEmployees();
  switch (link.assignment_method) {
    case 'Manual':
      return employees.filter((e) => link.assigned_employees.includes(e.id) || link.assigned_employees.includes(e.employee_id || ''));
    case 'Department Based':
      return employees.filter((e) => e.department === link.department);
    case 'Role Based':
      return employees.filter((e) => link.employee_groups.includes(e.designation));
    case 'Site Based':
      return employees.filter((e) => (e as { site?: string }).site === link.site || !link.site);
    case 'Business Unit Based':
      return employees.filter((e) => (e as { business_unit?: string }).business_unit === link.business_unit || !link.business_unit);
    default:
      return employees.filter((e) => e.department === link.department);
  }
}

async function syncAssignmentCounts(linkId: string, documentId?: string): Promise<{ assignments: number; completed: number; overdue: number }> {
  try {
    let snap = await getDocs(query(
      collection(getFirebaseFirestore(), DTL_COLLECTIONS.assignments),
      where('source_ref', '==', linkId),
      limit(100),
    ));
    if (snap.empty && documentId) {
      const link = await getTrainingLinkById(linkId);
      if (link?.document_number) {
        snap = await getDocs(query(
          collection(getFirebaseFirestore(), DTL_COLLECTIONS.assignments),
          where('document_number', '==', link.document_number),
          limit(100),
        ));
      }
    }
    let completed = 0;
    let overdue = 0;
    const today = todayStr();
    for (const d of snap.docs) {
      const status = String(d.data().training_status || d.data().status || '');
      if (['completed', 'Completed'].includes(status)) completed++;
      else if (String(d.data().due_date || '') < today) overdue++;
    }
    return { assignments: snap.size, completed, overdue };
  } catch {
    const link = await getTrainingLinkById(linkId);
    return { assignments: link?.assignments_count || 0, completed: link?.completed_count || 0, overdue: link?.overdue_count || 0 };
  }
}

export async function syncTrainingLinksFromDocuments(): Promise<number> {
  const docs = await listDocuments();
  const effective = docs.filter((d) => d.status === 'effective' && d.training_required);
  let created = 0;

  for (const d of effective) {
    if (await hasActiveLink(d.id, d.version)) continue;

    const linkId = await generateTrainingLinkId();
    const dueDate = d.next_review_date || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];
    const timestamp = now();

    await addDoc(collection(getFirebaseFirestore(), DTL_COLLECTIONS.links), {
      training_link_id: linkId,
      document_id: d.id,
      document_number: d.document_number,
      document_title: d.document_title,
      document_type: d.document_type,
      version: d.version,
      department: d.department,
      site: '',
      business_unit: '',
      training_required: true,
      training_type: 'Read & Acknowledge',
      training_program: `Training: ${d.document_number} v${d.version}`,
      training_program_id: null,
      qualification_required: true,
      competency_level: 'Competent',
      employee_groups: [],
      assigned_employees: [],
      assignment_method: 'Department Based',
      training_due_date: dueDate,
      grace_period_days: DEFAULT_GRACE_PERIOD_DAYS,
      retraining_required: true,
      retraining_trigger: 'Major Revision',
      completion_requirement: 'Complete training and acknowledge document',
      assessment_required: true,
      passing_score: DEFAULT_PASSING_SCORE,
      electronic_signature_required: false,
      acknowledgement_required: true,
      status: 'Pending Assignment',
      assignments_count: 0,
      completed_count: 0,
      overdue_count: 0,
      created_by: 'system',
      created_by_name: 'System',
      updated_by: 'system',
      updated_by_name: 'System',
      created_at: timestamp,
      updated_at: timestamp,
    });
    created++;
  }
  return created;
}

export async function assignTrainingForLink(linkId: string, actor: TrainingLinkageActor): Promise<number> {
  const link = await getTrainingLinkById(linkId);
  if (!link) throw new Error('Training link not found');

  const tmsActor = toTmsActor(actor);
  let masterId = link.training_program_id;

  if (!masterId) {
    const master = await createTrainingMaster({
      training_title: link.training_program || `Training: ${link.document_number}`,
      training_type: 'SOP Training',
      department: link.department,
      category: link.retraining_required ? 'Retraining' : 'Initial',
      training_duration: '',
      training_material: link.document_title,
      trainer_name: 'Training Administrator',
      assessment_required: link.assessment_required,
      passing_percentage: link.passing_score,
      retraining_frequency: 'On Revision',
      status: 'Active',
      linked_document_id: link.document_id,
    }, tmsActor);
    masterId = master.id;
    await updateDoc(doc(getFirebaseFirestore(), DTL_COLLECTIONS.links, linkId), {
      training_program_id: masterId, updated_at: now(),
    });
  }

  const employees = await resolveTargetEmployees(link);
  if (!employees.length) throw new Error('No employees matched assignment criteria');

  let count = 0;
  for (const emp of employees) {
    await createAssignment({
      training_master_id: masterId!,
      employee_id: emp.id,
      employee_name: emp.full_name,
      department: emp.department,
      designation: emp.designation,
      assigned_date: todayStr(),
      due_date: link.training_due_date,
      trainer_name: 'Training Administrator',
    }, tmsActor, { source: 'document_training_link', sourceRef: linkId });
    count++;
    await notify('Training Assigned', `${link.document_number} training assigned`, linkId, [], emp.id);
  }

  const counts = { assignments_count: count, completed_count: 0, overdue_count: 0 };
  await updateDoc(doc(getFirebaseFirestore(), DTL_COLLECTIONS.links, linkId), {
    status: 'Assigned',
    assigned_employees: employees.map((e) => e.id),
    ...counts,
    updated_at: now(),
    updated_by: actor.id,
    updated_by_name: actor.name,
  });

  await audit(actor, 'TRAINING_ASSIGNED', linkId, link.status, 'Assigned', `${count} employees`);
  return count;
}

export async function processScheduledTrainingJobs(actor: TrainingLinkageActor): Promise<{
  synced: number; assigned: number; reminders: number; overdue: number;
}> {
  const synced = await syncTrainingLinksFromDocuments();
  const links = await listAllTrainingLinks();
  let assigned = 0;
  let reminders = 0;
  let overdue = 0;
  const today = todayStr();

  for (const link of links) {
    if (link.status === 'Pending Assignment' && link.assignment_method === 'Automatic') {
      try {
        const count = await assignTrainingForLink(link.id, actor);
        assigned += count;
      } catch { /* skip */ }
    }

    if (['Assigned', 'In Progress'].includes(link.status) && link.training_due_date < today) {
      await updateDoc(doc(getFirebaseFirestore(), DTL_COLLECTIONS.links, link.id), {
        status: 'Overdue', overdue_count: Math.max(link.overdue_count, 1), updated_at: now(),
      });
      await notify('Training Overdue', `${link.document_number} training overdue`, link.id, ['training_coordinator', 'qa_manager']);
      await audit(actor, 'TRAINING_OVERDUE', link.id, link.status, 'Overdue');
      overdue++;
    }

    const daysUntil = Math.round((new Date(`${link.training_due_date}T12:00:00`).getTime() - Date.now()) / 86400000);
    if (REMINDER_DAYS.includes(daysUntil) && !['Completed', 'Cancelled'].includes(link.status)) {
      await notify('Training Reminder', `${link.document_number} due in ${daysUntil} day(s)`, link.id, ['training_coordinator']);
      reminders++;
    }

    const counts = await syncAssignmentCounts(link.id, link.document_id);
    if (counts.completed === counts.assignments && counts.assignments > 0 && link.status !== 'Completed') {
      await updateDoc(doc(getFirebaseFirestore(), DTL_COLLECTIONS.links, link.id), {
        status: 'Completed', completed_count: counts.completed, updated_at: now(),
      });
      await audit(actor, 'TRAINING_COMPLETED', link.id, link.status, 'Completed');
      await notify('Training Completed', `${link.document_number} training completed`, link.id, ['qa_manager']);
    } else if (counts.assignments > 0) {
      await updateDoc(doc(getFirebaseFirestore(), DTL_COLLECTIONS.links, link.id), {
        assignments_count: counts.assignments,
        completed_count: counts.completed,
        overdue_count: counts.overdue,
        status: counts.completed > 0 ? 'In Progress' : link.status,
        updated_at: now(),
      });
    }
  }

  await syncDmsTrainingLinks(toTmsActor(actor)).catch(() => {});
  return { synced, assigned, reminders, overdue };
}

export async function createTrainingLink(input: CreateTrainingLinkInput, actor: TrainingLinkageActor): Promise<DocumentTrainingLinkRecord> {
  const docRecord = await getDocumentById(input.document_id);
  if (!docRecord) throw new Error('Document not found');
  if (docRecord.status !== 'effective') throw new Error('Only effective documents can be linked to training');

  const linkId = await generateTrainingLinkId();
  const timestamp = now();
  const payload = {
    training_link_id: linkId,
    document_id: docRecord.id,
    document_number: docRecord.document_number,
    document_title: docRecord.document_title,
    document_type: docRecord.document_type,
    version: docRecord.version,
    department: input.department || docRecord.department,
    site: input.site,
    business_unit: input.business_unit,
    training_required: true,
    training_type: input.training_type,
    training_program: input.training_program,
    training_program_id: null,
    qualification_required: input.qualification_required,
    competency_level: input.competency_level,
    employee_groups: input.employee_groups,
    assigned_employees: input.assigned_employees,
    assignment_method: input.assignment_method,
    training_due_date: input.training_due_date,
    grace_period_days: input.grace_period_days,
    retraining_required: input.retraining_required,
    retraining_trigger: input.retraining_trigger,
    completion_requirement: 'Complete training per SOP',
    assessment_required: input.assessment_required,
    passing_score: input.passing_score,
    electronic_signature_required: input.electronic_signature_required,
    acknowledgement_required: input.acknowledgement_required,
    status: 'Pending Assignment',
    assignments_count: 0,
    completed_count: 0,
    overdue_count: 0,
    created_by: actor.id,
    created_by_name: actor.name,
    updated_by: actor.id,
    updated_by_name: actor.name,
    created_at: timestamp,
    updated_at: timestamp,
  };

  const ref = await addDoc(collection(getFirebaseFirestore(), DTL_COLLECTIONS.links), payload);
  await updateDoc(doc(getFirebaseFirestore(), DTL_COLLECTIONS.documents, input.document_id), {
    training_required: true, updated_at: timestamp,
  });
  await notify('Training Linked', `${docRecord.document_number} linked to training program`, ref.id, ['training_coordinator']);
  await audit(actor, 'TRAINING_LINKED', ref.id, null, payload);
  return { id: ref.id, ...payload };
}

export async function createRetrainingForLink(input: RetrainingInput, actor: TrainingLinkageActor): Promise<DocumentTrainingLinkRecord> {
  const parent = await getTrainingLinkById(input.link_id);
  if (!parent) throw new Error('Training link not found');

  const linkId = await generateTrainingLinkId();
  const timestamp = now();
  const payload = {
    training_link_id: linkId,
    document_id: parent.document_id,
    document_number: parent.document_number,
    document_title: parent.document_title,
    document_type: parent.document_type,
    version: parent.version,
    department: parent.department,
    site: parent.site,
    business_unit: parent.business_unit,
    training_required: true,
    training_type: parent.training_type,
    training_program: `${parent.training_program} (Retraining)`,
    training_program_id: null,
    qualification_required: parent.qualification_required,
    competency_level: parent.competency_level,
    employee_groups: parent.employee_groups,
    assigned_employees: parent.assigned_employees,
    assignment_method: parent.assignment_method,
    training_due_date: input.due_date,
    grace_period_days: parent.grace_period_days,
    retraining_required: true,
    retraining_trigger: input.trigger,
    completion_requirement: input.reason,
    assessment_required: parent.assessment_required,
    passing_score: parent.passing_score,
    electronic_signature_required: parent.electronic_signature_required,
    acknowledgement_required: parent.acknowledgement_required,
    status: 'Pending Assignment',
    assignments_count: 0,
    completed_count: 0,
    overdue_count: 0,
    parent_link_id: input.link_id,
    created_by: actor.id,
    created_by_name: actor.name,
    updated_by: actor.id,
    updated_by_name: actor.name,
    created_at: timestamp,
    updated_at: timestamp,
  };

  const ref = await addDoc(collection(getFirebaseFirestore(), DTL_COLLECTIONS.links), payload);
  await notify('Retraining Assigned', `${parent.document_number} retraining — ${input.trigger}`, ref.id, ['training_coordinator']);
  await audit(actor, 'RETRAINING_ASSIGNED', ref.id, null, { parent_id: input.link_id, trigger: input.trigger });
  return mapTrainingLinkRaw({ id: ref.id, ...payload });
}

export async function bulkAssignTrainingLinks(linkIds: string[], actor: TrainingLinkageActor): Promise<number> {
  let count = 0;
  for (const id of linkIds) {
    try {
      await assignTrainingForLink(id, actor);
      count++;
    } catch { /* skip */ }
  }
  return count;
}

export async function bulkSendReminders(linkIds: string[], actor: TrainingLinkageActor): Promise<number> {
  let count = 0;
  for (const id of linkIds) {
    const link = await getTrainingLinkById(id);
    if (!link || link.status === 'Completed') continue;
    await notify('Training Reminder', `${link.document_number} training due ${link.training_due_date}`, id, ['training_coordinator']);
    count++;
  }
  await audit(actor, 'BULK_REMINDER', linkIds.join(','), null, { count });
  return count;
}

export async function fetchTrainingLinkageDashboardData(filters?: TrainingLinkageFilters) {
  await processScheduledTrainingJobs({ id: 'system', name: 'System', role: 'system' });
  let records = await listAllTrainingLinks();
  if (filters) records = filterTrainingLinkRecords(records, filters);
  return {
    records,
    metrics: computeTrainingLinkageKpis(records),
    charts: computeTrainingLinkageCharts(records),
  };
}

export async function getTrainingLinkById(id: string): Promise<DocumentTrainingLinkRecord | null> {
  const snap = await getDoc(doc(getFirebaseFirestore(), DTL_COLLECTIONS.links, id));
  if (!snap.exists()) return null;
  return mapTrainingLinkRaw({ id: snap.id, ...snap.data() });
}

export async function createRetrainingForMajorRevision(documentId: string, newVersion: string, actor: TrainingLinkageActor): Promise<number> {
  const snap = await getDocs(query(
    collection(getFirebaseFirestore(), DTL_COLLECTIONS.links),
    where('document_id', '==', documentId),
    limit(5),
  ));
  let count = 0;
  for (const d of snap.docs) {
    const data = mapTrainingLinkRaw({ id: d.id, ...d.data() });
    if (!data.retraining_required) continue;
    const isMajor = !newVersion.includes('.') || parseInt(newVersion.split('.')[1] || '0', 10) === 0;
    if (data.retraining_trigger === 'Major Revision' && !isMajor) continue;
    if (data.retraining_trigger === 'Minor Revision' && isMajor) continue;

    const dueDate = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];
    await createRetrainingForLink({
      link_id: data.id,
      trigger: isMajor ? 'Major Revision' : 'Minor Revision',
      due_date: dueDate,
      reason: `Document revised to v${newVersion}`,
    }, actor);
    count++;
  }
  return count;
}

export function exportTrainingLinksCsv(records: DocumentTrainingLinkRecord[]) {
  downloadCsv('document-training-links.csv',
    ['Link ID', 'Document', 'Version', 'Type', 'Due Date', 'Status', 'Assignments', 'Completed'],
    records.map((r) => [
      r.training_link_id, r.document_number, r.version, r.training_type,
      r.training_due_date, r.status, r.assignments_count, r.completed_count,
    ]),
  );
}

export function exportTrainingLinksExcel(records: DocumentTrainingLinkRecord[]) { exportTrainingLinksCsv(records); }

export async function logTrainingLinkageDashboardViewed(actor: TrainingLinkageActor) {
  await audit(actor, 'DASHBOARD_VIEWED', 'training-linkage-dashboard', null, null);
}

export async function logTrainingLinkageExported(actor: TrainingLinkageActor, format: string, count: number) {
  await audit(actor, 'TRAINING_LINKAGE_EXPORTED', 'training-linkage-dashboard', null, { format, count });
}

export async function runScheduledTrainingLinkageJobs() {
  return processScheduledTrainingJobs({ id: 'scheduler', name: 'Scheduled Job', role: 'system' });
}
