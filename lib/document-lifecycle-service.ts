import {
  addDoc, collection, doc, getDocs, limit, orderBy, query, updateDoc, where,
} from 'firebase/firestore';
import { getFirebaseFirestore } from '@/lib/firebase';
import { logAuditEvent } from '@/lib/admin/admin-service';
import { downloadCsv } from '@/lib/export-utils';
import {
  listDocuments, getDocumentById, getApprovals, syncEffectiveDocuments,
  syncReviewDueNotifications, createDocument, submitForReview,
  createRevision, archiveDocument, getRevisions,
} from '@/lib/dms-service';
import type { DocumentRecord, DmsActor } from '@/lib/dms-types';
import type {
  DocumentLifecycleRecord, DocumentLifecycleKpis, DocumentLifecycleCharts,
  DocumentLifecycleFilters, DocumentLifecycleActor, LifecycleStage, LifecycleEvent,
} from './document-lifecycle-types';
import {
  mapDocumentToLifecycle, computeLifecycleKpis, computeLifecycleCharts,
  filterLifecycleRecords, emptyLifecycleKpis, emptyLifecycleCharts,
} from './document-lifecycle-records';
import { validateEffectiveTransition } from './document-lifecycle-schemas';
import { DLM_COLLECTIONS, incrementVersion, canReadEffectiveOnly } from './document-lifecycle-types';

function now() { return new Date().toISOString(); }

async function audit(
  actor: DocumentLifecycleActor, action: string, recordId: string,
  oldValue: unknown, newValue: unknown, reason = '',
) {
  await logAuditEvent({
    userId: actor.id, userName: actor.name, module: 'DLM', recordId, action,
    oldValue: oldValue ? JSON.stringify(oldValue) : '',
    newValue: newValue ? JSON.stringify(newValue) : '',
    reason, ipAddress: 'client', device: typeof navigator !== 'undefined' ? navigator.userAgent : 'server',
    status: 'Success',
  });
}

async function notify(title: string, message: string, recordId: string, roles: string[]) {
  try {
    for (const role of roles) {
      await addDoc(collection(getFirebaseFirestore(), DLM_COLLECTIONS.notifications), {
        title, message, module: 'DLM', record_id: recordId, target_role: role,
        read: false, created_at: now(),
      });
    }
  } catch (e) { console.error('DLM notification failed:', e); }
}

export async function logLifecycleEvent(
  documentId: string,
  lifecycleId: string,
  fromStage: LifecycleStage | null,
  toStage: LifecycleStage,
  actor: DocumentLifecycleActor,
  comments = '',
): Promise<LifecycleEvent> {
  const entry = {
    lifecycle_id: lifecycleId,
    document_id: documentId,
    from_stage: fromStage,
    to_stage: toStage,
    actor_id: actor.id,
    actor_name: actor.name,
    comments,
    created_at: now(),
  };
  const ref = await addDoc(collection(getFirebaseFirestore(), DLM_COLLECTIONS.lifecycle), entry);
  return { id: ref.id, ...entry };
}

export async function getLifecycleEvents(documentId: string): Promise<LifecycleEvent[]> {
  try {
    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), DLM_COLLECTIONS.lifecycle),
      where('document_id', '==', documentId),
      orderBy('created_at', 'asc'),
    ));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as LifecycleEvent));
  } catch {
    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), DLM_COLLECTIONS.lifecycle),
      where('document_id', '==', documentId),
    ));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as LifecycleEvent))
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
  }
}

async function enrichWithApprovals(docs: DocumentRecord[]): Promise<DocumentLifecycleRecord[]> {
  const results: DocumentLifecycleRecord[] = [];
  for (const doc of docs) {
    let approvals;
    if (['under_review', 'pending_approval', 'returned_for_correction'].includes(doc.status)) {
      try { approvals = await getApprovals(doc.id); } catch { approvals = []; }
    }
    results.push(mapDocumentToLifecycle(doc, approvals));
  }
  return results;
}

export async function fetchLifecycleDashboardData(
  filters?: DocumentLifecycleFilters,
  actor?: DocumentLifecycleActor,
): Promise<{
  records: DocumentLifecycleRecord[];
  metrics: DocumentLifecycleKpis;
  charts: DocumentLifecycleCharts;
}> {
  await Promise.all([syncEffectiveDocuments(), syncReviewDueNotifications(), syncPeriodicReviewTasks()]);

  const role = actor?.role || '';
  const dmsFilters: import('./dms-types').DmsFilters = {};
  if (canReadEffectiveOnly(role)) dmsFilters.effectiveOnly = true;

  const docs = await listDocuments(dmsFilters, role);
  let records = await enrichWithApprovals(docs);

  if (filters) records = filterLifecycleRecords(records, filters);

  return {
    records,
    metrics: computeLifecycleKpis(records),
    charts: computeLifecycleCharts(records),
  };
}

export async function getLifecycleRecord(documentId: string): Promise<DocumentLifecycleRecord | null> {
  const doc = await getDocumentById(documentId);
  if (!doc) return null;
  const approvals = await getApprovals(documentId);
  return mapDocumentToLifecycle(doc, approvals);
}

export async function transitionLifecycleStage(
  documentId: string,
  toStage: LifecycleStage,
  actor: DocumentLifecycleActor,
  options?: { comments?: string; effective_date?: string; review_due_date?: string },
): Promise<DocumentLifecycleRecord> {
  const existing = await getDocumentById(documentId);
  if (!existing) throw new Error('Document not found');

  const current = mapDocumentToLifecycle(existing, await getApprovals(documentId));
  const validationError = validateEffectiveTransition(toStage, options?.effective_date || existing.effective_date, existing.status);
  if (validationError) throw new Error(validationError);

  const dmsActor: DmsActor = { id: actor.id, name: actor.name, role: actor.role };

  switch (toStage) {
    case 'Author Review':
    case 'Department Review':
      if (existing.status === 'draft' || existing.status === 'returned_for_correction') {
        await submitForReview(documentId, dmsActor, options?.comments);
      }
      break;
    case 'Pending Approval':
      break;
    case 'Approved':
      break;
    case 'Effective':
      if (existing.status !== 'approved' && existing.status !== 'effective') {
        throw new Error('Only approved documents can become Effective');
      }
      if (!options?.effective_date && !existing.effective_date) {
        throw new Error('Effective date is mandatory before Effective status');
      }
      await updateDoc(doc(getFirebaseFirestore(), DLM_COLLECTIONS.documents, documentId), {
        status: existing.effective_date && existing.effective_date <= now().split('T')[0] ? 'effective' : 'approved',
        effective_date: options?.effective_date || existing.effective_date,
        updated_by: actor.id,
        updated_by_name: actor.name,
        updated_at: now(),
        lifecycle_stage: toStage,
      });
      await syncEffectiveDocuments();
      break;
    case 'Archived':
      await archiveDocument(documentId, dmsActor);
      break;
    case 'Retired':
      await updateDoc(doc(getFirebaseFirestore(), DLM_COLLECTIONS.documents, documentId), {
        status: 'retired',
        lifecycle_stage: 'Retired',
        updated_by: actor.id,
        updated_by_name: actor.name,
        updated_at: now(),
      });
      break;
    case 'Revision Required':
      await createReviewTask(documentId, current, actor);
      break;
    default:
      await updateDoc(doc(getFirebaseFirestore(), DLM_COLLECTIONS.documents, documentId), {
        lifecycle_stage: toStage,
        updated_by: actor.id,
        updated_by_name: actor.name,
        updated_at: now(),
      });
  }

  await logLifecycleEvent(documentId, current.lifecycle_id, current.current_stage, toStage, actor, options?.comments);
  await audit(actor, 'STAGE_CHANGED', documentId, current.current_stage, toStage, options?.comments);

  const stageNotifications: Record<string, { title: string; message: string; roles: string[] }> = {
    'Pending Approval': { title: 'Approval Pending', message: `${existing.document_number} awaiting approval`, roles: ['head_qa', 'qa_manager'] },
    Effective: { title: 'Effective Today', message: `${existing.document_number} is now effective`, roles: ['qa_manager'] },
    'Revision Required': { title: 'Revision Required', message: `${existing.document_number} requires revision`, roles: ['qa_manager', 'head_qa'] },
    Archived: { title: 'Archive Reminder', message: `${existing.document_number} has been archived`, roles: ['qa_manager'] },
  };
  const n = stageNotifications[toStage];
  if (n) await notify(n.title, n.message, documentId, n.roles);

  const updated = await getDocumentById(documentId);
  return mapDocumentToLifecycle(updated!, await getApprovals(documentId));
}

async function createReviewTask(
  documentId: string,
  record: DocumentLifecycleRecord,
  actor: DocumentLifecycleActor,
) {
  await addDoc(collection(getFirebaseFirestore(), DLM_COLLECTIONS.reviews), {
    document_id: documentId,
    document_number: record.document_number,
    lifecycle_id: record.lifecycle_id,
    review_type: 'periodic',
    due_date: record.review_due_date,
    status: 'pending',
    assigned_to: record.current_owner,
    assigned_to_name: record.current_owner_name,
    created_by: actor.id,
    created_by_name: actor.name,
    created_at: now(),
  });
  await notify(
    'Review Due',
    `${record.document_number} periodic review due ${record.review_due_date || 'soon'}`,
    documentId,
    ['qa_manager', 'head_qa'],
  );
}

export async function syncPeriodicReviewTasks(): Promise<number> {
  const snap = await getDocs(query(
    collection(getFirebaseFirestore(), DLM_COLLECTIONS.documents),
    where('status', '==', 'effective'),
  ));
  let count = 0;
  const today = now().split('T')[0];

  for (const d of snap.docs) {
    const data = d.data() as DocumentRecord;
    if (!data.next_review_date || data.next_review_date > today) continue;

    const existingReviews = await getDocs(query(
      collection(getFirebaseFirestore(), DLM_COLLECTIONS.reviews),
      where('document_id', '==', d.id),
      where('status', '==', 'pending'),
      limit(1),
    ));
    if (!existingReviews.empty) continue;

    await addDoc(collection(getFirebaseFirestore(), DLM_COLLECTIONS.reviews), {
      document_id: d.id,
      document_number: data.document_number,
      lifecycle_id: `DLM-${data.document_number}`,
      review_type: 'periodic',
      due_date: data.next_review_date,
      status: 'pending',
      assigned_to: data.prepared_by,
      assigned_to_name: data.prepared_by_name,
      created_at: now(),
    });

    await updateDoc(d.ref, { lifecycle_stage: 'Revision Required', updated_at: now() });
    count++;
  }
  return count;
}

export async function createLifecycleRevision(
  parentId: string,
  reason: string,
  isMajor: boolean,
  actor: DocumentLifecycleActor,
  effectiveDate?: string,
): Promise<DocumentLifecycleRecord> {
  const parent = await getDocumentById(parentId);
  if (!parent) throw new Error('Parent document not found');
  if (!['effective', 'approved'].includes(parent.status)) {
    throw new Error('Only effective or approved documents can be revised');
  }

  const newVersion = incrementVersion(parent.version, isMajor);
  const dmsActor: DmsActor = { id: actor.id, name: actor.name, role: actor.role };

  const revised = await createRevision(parentId, {
    version: newVersion,
    reason_for_revision: reason,
    effective_date: effectiveDate || null,
    next_review_date: parent.next_review_date,
    change_control_ref: parent.change_control_ref,
    change_control_id: parent.change_control_id,
    supersedes_document_no: parent.document_number,
    remarks: '',
  }, dmsActor);

  if (!isMajor) {
    await updateDoc(doc(getFirebaseFirestore(), DLM_COLLECTIONS.documents, revised.id), {
      training_required: false,
    });
  }

  await logLifecycleEvent(parentId, `DLM-${parent.document_number}`, 'Effective', 'Superseded', actor, reason);
  await audit(actor, 'REVISED', revised.id, parent, revised, reason);

  if (isMajor || revised.training_required) {
    await notify(
      'Training Required',
      `${revised.document_number} v${newVersion} — training assignment required`,
      revised.id,
      ['qa_manager', 'training_coordinator'],
    );
  }

  return mapDocumentToLifecycle(revised);
}

export async function bulkLifecycleAction(
  documentIds: string[],
  action: 'archive' | 'retire' | 'schedule_review',
  reason: string,
  actor: DocumentLifecycleActor,
): Promise<number> {
  let count = 0;
  for (const id of documentIds) {
    try {
      if (action === 'archive') {
        await transitionLifecycleStage(id, 'Archived', actor, { comments: reason });
      } else if (action === 'retire') {
        await transitionLifecycleStage(id, 'Retired', actor, { comments: reason });
      } else {
        const record = await getLifecycleRecord(id);
        if (record) await createReviewTask(id, record, actor);
      }
      count++;
    } catch (e) {
      console.error(`Bulk action failed for ${id}:`, e);
    }
  }
  await audit(actor, 'BULK_ACTION', documentIds.join(','), null, { action, count }, reason);
  return count;
}

export async function getVersionHistory(documentId: string) {
  const docRecord = await getDocumentById(documentId);
  if (!docRecord) return [];

  const rootId = docRecord.parent_document_id || documentId;
  const revisions = await getRevisions(rootId);

  const chain: DocumentRecord[] = [];
  let current = docRecord;
  chain.push(current);

  while (current.parent_document_id) {
    const parent = await getDocumentById(current.parent_document_id);
    if (!parent) break;
    chain.push(parent);
    current = parent;
  }

  return { revisions, chain: chain.reverse() };
}

export function exportLifecycleCsv(records: DocumentLifecycleRecord[]) {
  downloadCsv(
    `document-lifecycle-${now().split('T')[0]}.csv`,
    [
      'Lifecycle ID', 'Document Number', 'Title', 'Version', 'Stage', 'Owner',
      'Department', 'Effective Date', 'Review Due', 'Workflow Status', 'Updated At',
    ],
    records.map((r) => [
      r.lifecycle_id, r.document_number, r.document_title, r.current_version,
      r.current_stage, r.current_owner_name, r.department,
      r.effective_date || '', r.review_due_date || '', r.workflow_status, r.updated_at,
    ]),
  );
}

export async function logLifecycleDashboardViewed(actor: DocumentLifecycleActor) {
  await audit(actor, 'DASHBOARD_VIEWED', 'lifecycle-dashboard', null, null);
}

export async function logLifecycleDashboardRefreshed(actor: DocumentLifecycleActor, count: number) {
  await audit(actor, 'DASHBOARD_REFRESHED', 'lifecycle-dashboard', null, { count });
}

export async function logLifecycleExported(actor: DocumentLifecycleActor, format: string, count: number) {
  await audit(actor, 'EXPORT', 'lifecycle-dashboard', null, { format, count });
}

export async function createLifecycleDocument(
  input: import('./document-lifecycle-schemas').LifecycleCreateInput,
  actor: DocumentLifecycleActor,
): Promise<DocumentLifecycleRecord> {
  const dmsActor: DmsActor = { id: actor.id, name: actor.name, role: actor.role };
  const created = await createDocument({
    document_title: input.document_title,
    document_type: input.document_type as import('./dms-types').DocumentType,
    department: input.department,
    version: input.version,
    prepared_by_name: input.owner_name,
    effective_date: input.effective_date,
    next_review_date: input.review_due_date,
    product_name: '',
    change_control_ref: input.linked_change_control || '',
    change_control_id: null,
    supersedes_document_no: '',
    supersedes_document_id: null,
    reason_for_revision: '',
    remarks: '',
    linked_pqr_id: null,
    linked_cpv_id: null,
  }, dmsActor);

  await updateDoc(doc(getFirebaseFirestore(), DLM_COLLECTIONS.documents, created.id), {
    lifecycle_id: `DLM-${created.document_number}`,
    lifecycle_stage: input.current_stage || 'Draft',
    owner: actor.id,
    owner_name: input.owner_name,
    training_required: input.training_required,
    major_version: parseInt(input.version.split('.')[0] || '1', 10),
    minor_version: parseInt(input.version.split('.')[1] || '0', 10),
  });

  await logLifecycleEvent(created.id, `DLM-${created.document_number}`, null, 'Draft', actor);
  await audit(actor, 'DOCUMENT_CREATED', created.id, null, created);

  const updated = await getDocumentById(created.id);
  return mapDocumentToLifecycle(updated!);
}

function parseVersion(v: string) {
  const parts = v.split('.');
  return { major: parseInt(parts[0] || '1', 10), minor: parseInt(parts[1] || '0', 10) };
}

export { emptyLifecycleKpis, emptyLifecycleCharts, filterLifecycleRecords, mapDocumentToLifecycle };
