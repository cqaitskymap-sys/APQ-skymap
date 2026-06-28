import {
  addDoc, collection, doc, getDoc, getDocs, limit, orderBy, query, updateDoc, where,
} from 'firebase/firestore';
import { getFirebaseFirestore } from '@/lib/firebase';
import { logAuditEvent } from '@/lib/admin/admin-service';
import { downloadCsv } from '@/lib/export-utils';
import { listDocuments, getDocumentById } from '@/lib/dms-service';
import type { DocumentRecord } from '@/lib/dms-types';
import type {
  PeriodicReviewRecord, PeriodicReviewFilters, PeriodicReviewActor,
} from './periodic-review-types';
import {
  mapPeriodicReviewRaw, computePeriodicReviewKpis, computePeriodicReviewCharts,
  filterPeriodicReviewRecords,
} from './periodic-review-records';
import type { ScheduleReviewInput, CompleteReviewInput } from './periodic-review-schemas';
import {
  PRM_COLLECTIONS, DEFAULT_REVIEW_CHECKLIST, REMINDER_DAYS_BEFORE,
  TASK_GENERATION_DAYS_BEFORE, frequencyToMonths, addMonthsToDate,
} from './periodic-review-types';

function now() { return new Date().toISOString(); }
function todayStr() { return new Date().toISOString().split('T')[0]; }

function daysBetween(a: string, b: string): number {
  const ms = new Date(`${b}T12:00:00`).getTime() - new Date(`${a}T12:00:00`).getTime();
  return Math.round(ms / 86400000);
}

async function audit(actor: PeriodicReviewActor, action: string, recordId: string, oldValue: unknown, newValue: unknown, reason = '') {
  await logAuditEvent({
    userId: actor.id, userName: actor.name, module: 'Periodic Review Management', recordId, action,
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
      await addDoc(collection(db, PRM_COLLECTIONS.notifications), {
        title, message, module: 'Periodic Review Management', record_id: recordId,
        target_role: role, read: false, created_at: now(),
      });
    }
  } catch (e) { console.error('Periodic review notification failed:', e); }
}

export async function generateReviewNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `PR-${year}-`;
  try {
    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), PRM_COLLECTIONS.reviews),
      where('review_number', '>=', prefix),
      where('review_number', '<=', `${prefix}\uf8ff`),
      orderBy('review_number', 'desc'),
      limit(1),
    ));
    if (!snap.empty) {
      const last = snap.docs[0].data().review_number as string;
      return `${prefix}${String(parseInt(last.split('-').pop() || '0', 10) + 1).padStart(4, '0')}`;
    }
  } catch {
    const all = await getDocs(collection(getFirebaseFirestore(), PRM_COLLECTIONS.reviews));
    return `${prefix}${String(all.size + 1).padStart(4, '0')}`;
  }
  return `${prefix}0001`;
}

async function listAllPeriodicReviews(): Promise<PeriodicReviewRecord[]> {
  try {
    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), PRM_COLLECTIONS.reviews),
      orderBy('updated_at', 'desc'),
    ));
    return snap.docs.map((d) => mapPeriodicReviewRaw({ id: d.id, ...d.data() }));
  } catch {
    const snap = await getDocs(collection(getFirebaseFirestore(), PRM_COLLECTIONS.reviews));
    return snap.docs.map((d) => mapPeriodicReviewRaw({ id: d.id, ...d.data() }))
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  }
}

async function hasOpenReview(documentId: string): Promise<boolean> {
  const snap = await getDocs(query(
    collection(getFirebaseFirestore(), PRM_COLLECTIONS.reviews),
    where('document_id', '==', documentId),
    limit(10),
  ));
  return snap.docs.some((d) => !['Completed', 'Cancelled'].includes(d.data().status as string));
}

function deriveReviewStatus(dueDate: string, current: string): string {
  if (['Completed', 'Cancelled', 'In Progress', 'Awaiting QA', 'Awaiting Approval'].includes(current)) return current;
  const today = todayStr();
  if (dueDate < today) return 'Overdue';
  if (current === 'Scheduled' && daysBetween(today, dueDate) <= TASK_GENERATION_DAYS_BEFORE) return 'Pending';
  return current || 'Scheduled';
}

export async function syncReviewRecordsFromDocuments(): Promise<number> {
  const docs = await listDocuments();
  const effective = docs.filter((d) => d.status === 'effective');
  let created = 0;

  for (const d of effective) {
    if (!d.next_review_date) continue;
    if (await hasOpenReview(d.id)) continue;

    const reviewNumber = await generateReviewNumber();
    const timestamp = now();
    const dueDate = d.next_review_date;
    const scheduledDate = addMonthsToDate(dueDate, -1);
    const status = deriveReviewStatus(dueDate, 'Scheduled');

    await addDoc(collection(getFirebaseFirestore(), PRM_COLLECTIONS.reviews), {
      review_id: reviewNumber,
      review_number: reviewNumber,
      document_id: d.id,
      document_number: d.document_number,
      document_title: d.document_title,
      document_type: d.document_type,
      current_version: d.version,
      department: d.department,
      business_unit: '',
      site: '',
      owner: d.prepared_by || d.created_by,
      owner_name: d.prepared_by_name || d.created_by_name,
      reviewer_id: d.prepared_by || '',
      reviewer_name: d.prepared_by_name || '',
      qa_reviewer_id: d.approved_by || '',
      qa_reviewer_name: d.approved_by_name || '',
      review_frequency: 'Annual',
      review_cycle: 1,
      review_trigger: 'Scheduled',
      scheduled_date: scheduledDate,
      due_date: dueDate,
      started_date: null,
      completed_date: null,
      decision: null,
      status,
      outcome: '',
      revision_required: false,
      change_control_required: false,
      risk_assessment_required: false,
      capa_required: false,
      training_impact: false,
      electronic_signature_required: false,
      review_checklist: DEFAULT_REVIEW_CHECKLIST,
      review_comments: '',
      attachments: [],
      priority: 'Normal',
      linked_change_control_id: null,
      linked_capa_id: null,
      linked_risk_assessment_id: null,
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

export async function processScheduledReviewTasks(actor: PeriodicReviewActor): Promise<{
  generated: number; reminders: number; escalated: number; overdue: number;
}> {
  await syncReviewRecordsFromDocuments();
  const records = await listAllPeriodicReviews();
  const today = todayStr();
  let generated = 0;
  let reminders = 0;
  let escalated = 0;
  let overdue = 0;

  for (const r of records) {
    if (['Completed', 'Cancelled'].includes(r.status)) continue;

    const daysUntilDue = daysBetween(today, r.due_date);

    if (r.due_date < today && r.status !== 'Overdue') {
      await updateDoc(doc(getFirebaseFirestore(), PRM_COLLECTIONS.reviews, r.id), {
        status: 'Overdue', updated_at: now(),
      });
      await notify('Review Overdue', `${r.document_number} review overdue since ${r.due_date}`, r.id, ['qa_manager', 'head_qa']);
      await audit(actor, 'REVIEW_OVERDUE', r.id, r.status, 'Overdue');
      overdue++;
      escalated++;
      continue;
    }

    if (r.status === 'Scheduled' && daysUntilDue <= TASK_GENERATION_DAYS_BEFORE && daysUntilDue >= 0) {
      await updateDoc(doc(getFirebaseFirestore(), PRM_COLLECTIONS.reviews, r.id), {
        status: 'Pending', updated_at: now(),
      });
      await notify('Review Scheduled', `${r.document_number} periodic review due ${r.due_date}`, r.id, ['qa_manager']);
      await audit(actor, 'REVIEW_ASSIGNED', r.id, 'Scheduled', 'Pending');
      generated++;
    }

    if (REMINDER_DAYS_BEFORE.includes(daysUntilDue) && daysUntilDue >= 0) {
      await notify('Review Reminder', `${r.document_number} review due in ${daysUntilDue} day(s)`, r.id, ['qa_manager', 'head_qa']);
      reminders++;
    }

    if (r.status === 'Overdue') escalated++;
  }

  return { generated, reminders, escalated, overdue };
}

export async function schedulePeriodicReview(input: ScheduleReviewInput, actor: PeriodicReviewActor): Promise<PeriodicReviewRecord> {
  const docRecord = await getDocumentById(input.document_id);
  if (!docRecord) throw new Error('Document not found');
  if (docRecord.status !== 'effective') throw new Error('Only effective documents can be scheduled for periodic review');
  if (await hasOpenReview(input.document_id)) throw new Error('Document already has an open periodic review');

  const reviewNumber = await generateReviewNumber();
  const timestamp = now();
  const scheduledDate = input.scheduled_date || todayStr();
  const payload = {
    review_id: reviewNumber,
    review_number: reviewNumber,
    document_id: docRecord.id,
    document_number: docRecord.document_number,
    document_title: docRecord.document_title,
    document_type: docRecord.document_type,
    current_version: docRecord.version,
    department: docRecord.department,
    business_unit: '',
    site: '',
    owner: docRecord.prepared_by || actor.id,
    owner_name: docRecord.prepared_by_name || actor.name,
    reviewer_id: input.reviewer_id,
    reviewer_name: input.reviewer_name,
    qa_reviewer_id: input.qa_reviewer_id || '',
    qa_reviewer_name: input.qa_reviewer_name || '',
    review_frequency: input.review_frequency,
    review_cycle: 1,
    review_trigger: input.review_trigger,
    scheduled_date: scheduledDate,
    due_date: input.due_date,
    started_date: null,
    completed_date: null,
    decision: null,
    status: deriveReviewStatus(input.due_date, 'Scheduled'),
    outcome: '',
    revision_required: false,
    change_control_required: false,
    risk_assessment_required: false,
    capa_required: false,
    training_impact: false,
    electronic_signature_required: false,
    review_checklist: DEFAULT_REVIEW_CHECKLIST,
    review_comments: input.review_comments || '',
    attachments: [],
    priority: input.priority,
    linked_change_control_id: null,
    linked_capa_id: null,
    linked_risk_assessment_id: null,
    created_by: actor.id,
    created_by_name: actor.name,
    updated_by: actor.id,
    updated_by_name: actor.name,
    created_at: timestamp,
    updated_at: timestamp,
  };

  await updateDoc(doc(getFirebaseFirestore(), PRM_COLLECTIONS.documents, input.document_id), {
    next_review_date: input.due_date,
    updated_at: timestamp,
    updated_by: actor.id,
    updated_by_name: actor.name,
  });

  const ref = await addDoc(collection(getFirebaseFirestore(), PRM_COLLECTIONS.reviews), payload);
  await addDoc(collection(getFirebaseFirestore(), PRM_COLLECTIONS.schedules), {
    review_id: ref.id, document_id: input.document_id, frequency: input.review_frequency,
    due_date: input.due_date, created_at: timestamp,
  });
  await notify('Review Scheduled', `${docRecord.document_number} review scheduled for ${input.due_date}`, ref.id, ['qa_manager']);
  await audit(actor, 'REVIEW_SCHEDULED', ref.id, null, payload);
  return { id: ref.id, ...payload };
}

export async function startPeriodicReview(reviewId: string, actor: PeriodicReviewActor): Promise<void> {
  const rec = await getPeriodicReviewById(reviewId);
  if (!rec) throw new Error('Review not found');
  if (['Completed', 'Cancelled'].includes(rec.status)) throw new Error('Review is closed');
  await updateDoc(doc(getFirebaseFirestore(), PRM_COLLECTIONS.reviews, reviewId), {
    status: 'In Progress', started_date: now(), updated_at: now(),
    updated_by: actor.id, updated_by_name: actor.name,
  });
  await audit(actor, 'REVIEW_STARTED', reviewId, rec.status, 'In Progress');
}

async function createLinkedChangeControl(rec: PeriodicReviewRecord, actor: PeriodicReviewActor): Promise<string> {
  const year = new Date().getFullYear();
  const ccNumber = `CC/${year}/PR-${rec.review_number}`;
  const timestamp = now();
  const ref = await addDoc(collection(getFirebaseFirestore(), PRM_COLLECTIONS.changeControls), {
    change_control_number: ccNumber,
    change_title: `Document revision — ${rec.document_number}`,
    change_description: `Change control from periodic review ${rec.review_number}`,
    change_date: todayStr(),
    department: rec.department,
    initiated_by: actor.id,
    initiated_by_name: actor.name,
    change_type: 'Document Change',
    change_category: rec.decision === 'Major Revision' ? 'Major' : 'Minor',
    change_priority: 'Medium',
    temporary_permanent: 'Permanent',
    affected_documents: rec.document_number,
    status: 'draft',
    periodic_review_id: rec.id,
    source_module: 'Periodic Review Management',
    created_at: timestamp,
    updated_at: timestamp,
  });
  await audit(actor, 'CHANGE_CONTROL_CREATED', rec.id, null, { change_control_id: ref.id });
  await notify('Change Control Created', `CC linked to review ${rec.review_number}`, ref.id, ['qa_manager']);
  return ref.id;
}

async function createLinkedCapa(rec: PeriodicReviewRecord, actor: PeriodicReviewActor): Promise<string> {
  const year = new Date().getFullYear();
  const capaNumber = `CAPA/${year}/PR-${rec.review_number}`;
  const timestamp = now();
  const ref = await addDoc(collection(getFirebaseFirestore(), PRM_COLLECTIONS.capa), {
    capa_number: capaNumber,
    capa_date: todayStr(),
    capa_source: 'Periodic Review',
    source_reference_number: rec.review_number,
    department: rec.department,
    capa_title: `CAPA from periodic review — ${rec.document_number}`,
    problem_description: rec.outcome || rec.review_comments,
    capa_status: 'draft',
    periodic_review_id: rec.id,
    created_at: timestamp,
    updated_at: timestamp,
  });
  await audit(actor, 'CAPA_CREATED', rec.id, null, { capa_id: ref.id });
  await notify('CAPA Created', `CAPA linked to review ${rec.review_number}`, ref.id, ['qa_manager', 'head_qa']);
  return ref.id;
}

async function createLinkedRiskAssessment(rec: PeriodicReviewRecord, actor: PeriodicReviewActor): Promise<string> {
  const timestamp = now();
  const ref = await addDoc(collection(getFirebaseFirestore(), PRM_COLLECTIONS.riskAssessments), {
    title: `Risk assessment — ${rec.document_number}`,
    source: 'Periodic Review',
    source_reference: rec.review_number,
    document_id: rec.document_id,
    status: 'draft',
    periodic_review_id: rec.id,
    created_at: timestamp,
    updated_at: timestamp,
  });
  await audit(actor, 'RISK_ASSESSMENT_CREATED', rec.id, null, { risk_assessment_id: ref.id });
  await notify('Risk Assessment Created', `Risk assessment linked to ${rec.review_number}`, ref.id, ['qa_manager']);
  return ref.id;
}

export async function completePeriodicReview(
  reviewId: string,
  input: CompleteReviewInput,
  actor: PeriodicReviewActor,
): Promise<void> {
  const rec = await getPeriodicReviewById(reviewId);
  if (!rec) throw new Error('Review not found');
  if (!['In Progress', 'Awaiting QA', 'Pending', 'Overdue'].includes(rec.status)) {
    throw new Error('Review cannot be completed in current status');
  }

  const timestamp = now();
  const updates: Record<string, unknown> = {
    decision: input.decision,
    outcome: input.outcome,
    review_comments: input.review_comments,
    review_checklist: input.review_checklist,
    revision_required: input.revision_required,
    change_control_required: input.change_control_required,
    risk_assessment_required: input.risk_assessment_required,
    capa_required: input.capa_required,
    training_impact: input.training_impact,
    status: 'Completed',
    completed_date: timestamp,
    updated_at: timestamp,
    updated_by: actor.id,
    updated_by_name: actor.name,
  };

  if (input.change_control_required) {
    updates.linked_change_control_id = await createLinkedChangeControl({ ...rec, decision: input.decision, outcome: input.outcome }, actor);
  }
  if (input.capa_required) {
    updates.linked_capa_id = await createLinkedCapa({ ...rec, outcome: input.outcome, review_comments: input.review_comments }, actor);
  }
  if (input.risk_assessment_required) {
    updates.linked_risk_assessment_id = await createLinkedRiskAssessment(rec, actor);
  }

  await updateDoc(doc(getFirebaseFirestore(), PRM_COLLECTIONS.reviews, reviewId), updates as Record<string, string | boolean | null | PeriodicReviewRecord['review_checklist']>);

  await addDoc(collection(getFirebaseFirestore(), PRM_COLLECTIONS.decisions), {
    review_id: reviewId,
    review_number: rec.review_number,
    document_id: rec.document_id,
    decision: input.decision,
    outcome: input.outcome,
    recorded_by: actor.id,
    recorded_by_name: actor.name,
    created_at: timestamp,
  });

  const docRecord = await getDocumentById(rec.document_id);
  if (docRecord) {
    const nextDue = addMonthsToDate(rec.due_date, frequencyToMonths(rec.review_frequency));
    await updateDoc(doc(getFirebaseFirestore(), PRM_COLLECTIONS.documents, rec.document_id), {
      next_review_date: nextDue,
      updated_at: timestamp,
      updated_by: actor.id,
      updated_by_name: actor.name,
      ...(input.decision === 'Retire Document' ? { status: 'obsolete' } : {}),
      ...(input.training_impact || input.decision === 'Major Revision' ? { training_required: true } : {}),
    });
    if (input.training_impact || input.decision === 'Major Revision') {
      await audit(actor, 'TRAINING_IMPACT_ASSESSED', reviewId, null, { training_impact: true });
      await notify('Revision Required', `${rec.document_number} — training impact from periodic review`, reviewId, ['training_coordinator']);
    }
  }

  if (input.electronic_signature_required && input.signature_meaning) {
    await audit(actor, 'ELECTRONIC_SIGNATURE_COMPLETED', reviewId, null, { meaning: input.signature_meaning });
  }

  await notify('Review Completed', `${rec.document_number} periodic review completed — ${input.decision}`, reviewId, ['qa_manager']);
  await audit(actor, 'REVIEW_COMPLETED', reviewId, rec.status, 'Completed', input.decision);
  await audit(actor, 'DECISION_RECORDED', reviewId, null, input);
}

export async function submitForQaReview(reviewId: string, actor: PeriodicReviewActor): Promise<void> {
  const rec = await getPeriodicReviewById(reviewId);
  if (!rec) throw new Error('Review not found');
  await updateDoc(doc(getFirebaseFirestore(), PRM_COLLECTIONS.reviews, reviewId), {
    status: 'Awaiting QA', updated_at: now(),
    updated_by: actor.id, updated_by_name: actor.name,
  });
  await notify('Review Due', `${rec.document_number} awaiting QA review`, reviewId, ['qa_manager', 'head_qa']);
}

export async function cancelPeriodicReview(reviewId: string, reason: string, actor: PeriodicReviewActor): Promise<void> {
  const rec = await getPeriodicReviewById(reviewId);
  if (!rec) throw new Error('Review not found');
  if (rec.status === 'Completed') throw new Error('Cannot cancel completed review');
  await updateDoc(doc(getFirebaseFirestore(), PRM_COLLECTIONS.reviews, reviewId), {
    status: 'Cancelled', review_comments: reason, updated_at: now(),
    updated_by: actor.id, updated_by_name: actor.name,
  });
  await audit(actor, 'REVIEW_CANCELLED', reviewId, rec.status, 'Cancelled', reason);
}

export async function bulkScheduleReviews(reviewIds: string[], dueDate: string, actor: PeriodicReviewActor): Promise<number> {
  let count = 0;
  for (const id of reviewIds) {
    const rec = await getPeriodicReviewById(id);
    if (!rec || ['Completed', 'Cancelled'].includes(rec.status)) continue;
    try {
      await updateDoc(doc(getFirebaseFirestore(), PRM_COLLECTIONS.reviews, id), {
        due_date: dueDate,
        scheduled_date: todayStr(),
        status: deriveReviewStatus(dueDate, 'Scheduled'),
        updated_at: now(),
        updated_by: actor.id,
        updated_by_name: actor.name,
      });
      await updateDoc(doc(getFirebaseFirestore(), PRM_COLLECTIONS.documents, rec.document_id), {
        next_review_date: dueDate, updated_at: now(),
      });
      count++;
    } catch { /* skip */ }
  }
  await audit(actor, 'BULK_SCHEDULE', reviewIds.join(','), null, { dueDate, count });
  return count;
}

export async function fetchPeriodicReviewDashboardData(filters?: PeriodicReviewFilters) {
  await processScheduledReviewTasks({ id: 'system', name: 'System', role: 'system' });
  let records = await listAllPeriodicReviews();
  if (filters) records = filterPeriodicReviewRecords(records, filters);
  return {
    records,
    metrics: computePeriodicReviewKpis(records),
    charts: computePeriodicReviewCharts(records),
  };
}

export async function getPeriodicReviewById(id: string): Promise<PeriodicReviewRecord | null> {
  const snap = await getDoc(doc(getFirebaseFirestore(), PRM_COLLECTIONS.reviews, id));
  if (!snap.exists()) return null;
  return mapPeriodicReviewRaw({ id: snap.id, ...snap.data() });
}

export function exportPeriodicReviewsCsv(records: PeriodicReviewRecord[]) {
  downloadCsv('periodic-reviews.csv',
    ['Review #', 'Document', 'Version', 'Due Date', 'Status', 'Decision', 'Frequency', 'Reviewer'],
    records.map((r) => [
      r.review_number, r.document_number, r.current_version, r.due_date,
      r.status, r.decision || '', r.review_frequency, r.reviewer_name,
    ]),
  );
}

export function exportPeriodicReviewsExcel(records: PeriodicReviewRecord[]) { exportPeriodicReviewsCsv(records); }

export async function logPeriodicReviewDashboardViewed(actor: PeriodicReviewActor) {
  await audit(actor, 'DASHBOARD_VIEWED', 'periodic-review-dashboard', null, null);
}

export async function logPeriodicReviewExported(actor: PeriodicReviewActor, format: string, count: number) {
  await audit(actor, 'PERIODIC_REVIEW_EXPORTED', 'periodic-review-dashboard', null, { format, count });
}

/** Server-side entry point for cron / Cloud Functions */
export async function runScheduledPeriodicReviewJobs(): Promise<{
  generated: number; reminders: number; escalated: number; overdue: number;
}> {
  return processScheduledReviewTasks({ id: 'scheduler', name: 'Scheduled Job', role: 'system' });
}
