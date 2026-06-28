import {
  addDoc, collection, doc, getDoc, getDocs, limit, orderBy, query, setDoc, updateDoc, where,
} from 'firebase/firestore';
import { getFirebaseFirestore } from '@/lib/firebase';
import { logAuditEvent } from '@/lib/admin/admin-service';
import { downloadCsv } from '@/lib/export-utils';
import {
  listDocuments, getDocumentById, getApprovals, syncEffectiveDocuments,
  syncReviewDueNotifications, createDocument, submitForReview,
  createRevision, archiveDocument,
} from '@/lib/dms-service';
import type { DocumentRecord, DmsActor } from '@/lib/dms-types';
import type {
  SopMasterRecord, SopKpis, SopCharts, SopFilters, SopActor, SopStatus,
} from './sop-types';
import {
  mapDocumentToSop, mapSopMasterRaw, computeSopKpis, computeSopCharts,
  filterSopRecords, emptySopKpis, emptySopCharts,
} from './sop-records';
import type { SopCreateInput } from './sop-schemas';
import { validateSopEffective } from './sop-schemas';
import {
  SOP_COLLECTIONS, DEPT_SOP_PREFIX, incrementSopVersion, canReadEffectiveSopOnly,
} from './sop-types';

function now() { return new Date().toISOString(); }

async function audit(actor: SopActor, action: string, recordId: string, oldValue: unknown, newValue: unknown, reason = '') {
  await logAuditEvent({
    userId: actor.id, userName: actor.name, module: 'SOP', recordId, action,
    oldValue: oldValue ? JSON.stringify(oldValue) : '',
    newValue: newValue ? JSON.stringify(newValue) : '',
    reason, ipAddress: 'client', device: typeof navigator !== 'undefined' ? navigator.userAgent : 'server',
    status: 'Success',
  });
}

async function notify(title: string, message: string, recordId: string, roles: string[]) {
  try {
    for (const role of roles) {
      await addDoc(collection(getFirebaseFirestore(), SOP_COLLECTIONS.notifications), {
        title, message, module: 'SOP', record_id: recordId, target_role: role,
        read: false, created_at: now(),
      });
    }
  } catch (e) { console.error('SOP notification failed:', e); }
}

export async function generateSopNumber(department: string): Promise<string> {
  const deptPrefix = DEPT_SOP_PREFIX[department] || 'SOP';
  const year = new Date().getFullYear();
  const prefix = `SOP-${deptPrefix}-${year}-`;
  try {
    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), SOP_COLLECTIONS.master),
      where('sop_number', '>=', prefix),
      where('sop_number', '<=', `${prefix}\uf8ff`),
      orderBy('sop_number', 'desc'),
      limit(1),
    ));
    if (!snap.empty) {
      const last = snap.docs[0].data().sop_number as string;
      return `${prefix}${String(parseInt(last.split('-').pop() || '0', 10) + 1).padStart(4, '0')}`;
    }
  } catch {
    const all = await getDocs(collection(getFirebaseFirestore(), SOP_COLLECTIONS.master));
    return `${prefix}${String(all.size + 1).padStart(4, '0')}`;
  }
  return `${prefix}0001`;
}

async function syncToLegacySopManagement(record: SopMasterRecord): Promise<void> {
  try {
    await setDoc(doc(getFirebaseFirestore(), SOP_COLLECTIONS.legacy, record.id), {
      sop_number: record.sop_number,
      sop_title: record.sop_title,
      document_number: record.sop_number,
      title: record.sop_title,
      version: record.version,
      effective_version: record.version,
      department: record.department,
      status: record.status,
      updated_at: now(),
    }, { merge: true });
  } catch (e) { console.error('Legacy sop_management sync failed:', e); }
}

async function persistSopMaster(record: Omit<SopMasterRecord, 'id'>, id?: string): Promise<string> {
  const ref = id
    ? doc(getFirebaseFirestore(), SOP_COLLECTIONS.master, id)
    : doc(collection(getFirebaseFirestore(), SOP_COLLECTIONS.master));
  await setDoc(ref, { ...record, updated_at: now() }, { merge: true });
  return ref.id;
}

export async function listSopMasterRecords(): Promise<SopMasterRecord[]> {
  try {
    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), SOP_COLLECTIONS.master),
      orderBy('updated_at', 'desc'),
    ));
    return snap.docs.map((d) => mapSopMasterRaw({ id: d.id, ...d.data() }));
  } catch {
    const snap = await getDocs(collection(getFirebaseFirestore(), SOP_COLLECTIONS.master));
    return snap.docs.map((d) => mapSopMasterRaw({ id: d.id, ...d.data() }))
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  }
}

async function loadSopRecordsFromDocuments(role?: string): Promise<SopMasterRecord[]> {
  const docs = await listDocuments({ document_type: 'SOP' }, role);
  const results: SopMasterRecord[] = [];
  for (const d of docs) {
    let approvals;
    if (['under_review', 'pending_approval', 'returned_for_correction'].includes(d.status)) {
      try { approvals = await getApprovals(d.id); } catch { approvals = []; }
    }
    results.push(mapDocumentToSop(d, approvals));
  }
  return results;
}

async function mergeSopSources(role?: string): Promise<SopMasterRecord[]> {
  const [masterRecords, docRecords] = await Promise.all([
    listSopMasterRecords(),
    loadSopRecordsFromDocuments(role),
  ]);
  const byNumber = new Map<string, SopMasterRecord>();
  for (const r of docRecords) byNumber.set(r.sop_number, r);
  for (const r of masterRecords) {
    const existing = byNumber.get(r.sop_number);
    byNumber.set(r.sop_number, existing ? { ...existing, ...r, id: existing.id } : r);
  }
  return Array.from(byNumber.values()).filter((r) => r.is_latest !== false);
}

export async function syncPeriodicSopReviews(): Promise<number> {
  const today = now().split('T')[0];
  const records = await mergeSopSources();
  let count = 0;
  for (const r of records) {
    if (r.status !== 'Effective' || !r.review_due_date || r.review_due_date > today) continue;
    const existing = await getDocs(query(
      collection(getFirebaseFirestore(), SOP_COLLECTIONS.periodicReviews),
      where('sop_id', '==', r.sop_id),
      where('status', '==', 'pending'),
      limit(1),
    ));
    if (!existing.empty) continue;
    await addDoc(collection(getFirebaseFirestore(), SOP_COLLECTIONS.periodicReviews), {
      sop_id: r.sop_id, sop_number: r.sop_number, due_date: r.review_due_date,
      status: 'pending', assigned_to: r.owner, assigned_to_name: r.owner_name, created_at: now(),
    });
    if (r.document_id) {
      await updateDoc(doc(getFirebaseFirestore(), SOP_COLLECTIONS.documents, r.document_id), {
        sop_status: 'Periodic Review', updated_at: now(),
      });
    }
    await notify('Review Due', `${r.sop_number} periodic review due`, r.id, ['qa_manager', 'head_qa']);
    count++;
  }
  return count;
}

export async function syncSopTrainingStatus(): Promise<number> {
  let count = 0;
  try {
    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), SOP_COLLECTIONS.trainingLinks),
      where('status', '==', 'pending'),
    ));
    for (const d of snap.docs) {
      const data = d.data();
      const sopId = data.sop_id as string;
      if (!sopId) continue;
      const masterSnap = await getDocs(query(
        collection(getFirebaseFirestore(), SOP_COLLECTIONS.master),
        where('sop_id', '==', sopId),
        limit(1),
      ));
      if (!masterSnap.empty) {
        await updateDoc(masterSnap.docs[0].ref, { training_pending: true, updated_at: now() });
        count++;
      }
    }
  } catch { /* optional */ }
  return count;
}

export async function fetchSopDashboardData(
  filters?: SopFilters,
  actor?: SopActor,
): Promise<{ records: SopMasterRecord[]; metrics: SopKpis; charts: SopCharts }> {
  await Promise.all([
    syncEffectiveDocuments(), syncReviewDueNotifications(),
    syncPeriodicSopReviews(), syncSopTrainingStatus(),
  ]);

  const role = actor?.role || '';
  let records = await mergeSopSources(canReadEffectiveSopOnly(role) ? role : undefined);

  if (canReadEffectiveSopOnly(role)) {
    records = records.filter((r) => r.status === 'Effective');
  }

  if (filters) records = filterSopRecords(records, filters);

  return {
    records,
    metrics: computeSopKpis(records),
    charts: computeSopCharts(records),
  };
}

export async function getSopById(id: string): Promise<SopMasterRecord | null> {
  try {
    const snap = await getDoc(doc(getFirebaseFirestore(), SOP_COLLECTIONS.master, id));
    if (snap.exists()) return mapSopMasterRaw({ id: snap.id, ...snap.data() });
  } catch { /* fall through */ }
  const docRecord = await getDocumentById(id);
  if (docRecord && docRecord.document_type === 'SOP') {
    const approvals = await getApprovals(id);
    return mapDocumentToSop(docRecord, approvals);
  }
  return null;
}

export async function createSop(input: SopCreateInput, actor: SopActor): Promise<SopMasterRecord> {
  const sopNumber = await generateSopNumber(input.department);
  const dmsActor: DmsActor = { id: actor.id, name: actor.name, role: actor.role };
  const timestamp = now();
  const versionParts = input.version.split('.');

  const created = await createDocument({
    document_title: input.sop_title,
    document_type: 'SOP',
    department: input.department,
    version: input.version,
    prepared_by_name: input.author_name || input.owner_name,
    effective_date: input.effective_date || null,
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

  await updateDoc(doc(getFirebaseFirestore(), SOP_COLLECTIONS.documents, created.id), {
    document_number: sopNumber,
    document_category: 'SOP',
    category: input.category,
    sop_status: 'Draft',
    training_required: input.training_required,
    training_before_effective: input.training_before_effective,
    owner: actor.id,
    owner_name: input.owner_name,
    approver_name: input.approver_name,
  });

  const sopRecord: Omit<SopMasterRecord, 'id'> = {
    sop_id: `SOP-${sopNumber}`,
    sop_number: sopNumber,
    sop_title: input.sop_title,
    short_title: input.short_title || input.sop_title.slice(0, 60),
    department: input.department,
    business_unit: input.business_unit || '',
    site: input.site || '',
    area: input.area || '',
    category: input.category,
    process: input.process || '',
    sub_process: input.sub_process || '',
    owner: actor.id,
    owner_name: input.owner_name,
    author: actor.id,
    author_name: input.author_name || input.owner_name,
    reviewer: '',
    reviewer_name: '',
    approver: '',
    approver_name: input.approver_name,
    version: input.version,
    major_version: parseInt(versionParts[0] || '1', 10),
    minor_version: parseInt(versionParts[1] || '0', 10),
    status: 'Draft',
    current_workflow: 'draft',
    effective_date: input.effective_date || null,
    review_due_date: input.review_due_date,
    superseded_date: null,
    archive_date: null,
    retention_period: null,
    training_required: input.training_required,
    training_before_effective: input.training_before_effective,
    electronic_signature_required: input.electronic_signature_required,
    linked_change_control: input.linked_change_control || null,
    linked_risk_assessment: null,
    linked_capa: null,
    linked_validation: null,
    linked_forms: [],
    linked_work_instructions: [],
    linked_templates: [],
    keywords: input.keywords || [],
    confidentiality: input.confidentiality,
    language: input.language,
    document_id: created.id,
    is_latest: true,
    is_favorite: false,
    training_pending: false,
    training_completion_pct: 0,
    created_by: actor.id,
    created_by_name: actor.name,
    updated_by: actor.id,
    updated_by_name: actor.name,
    created_at: timestamp,
    updated_at: timestamp,
  };

  const masterId = await persistSopMaster(sopRecord, created.id);
  const result = { id: masterId, ...sopRecord };
  await syncToLegacySopManagement(result);
  await audit(actor, 'SOP_CREATED', masterId, null, result);
  await notify('SOP Created', `${sopNumber} created`, masterId, ['qa_manager']);
  return result;
}

export async function submitSopForReview(sopId: string, actor: SopActor, comments = ''): Promise<SopMasterRecord> {
  const sop = await getSopById(sopId);
  if (!sop?.document_id) throw new Error('SOP not found');
  const dmsActor: DmsActor = { id: actor.id, name: actor.name, role: actor.role };
  await submitForReview(sop.document_id, dmsActor, comments);
  await updateDoc(doc(getFirebaseFirestore(), SOP_COLLECTIONS.master, sopId), {
    status: 'Department Review', current_workflow: 'under_review', updated_at: now(),
  });
  await addDoc(collection(getFirebaseFirestore(), SOP_COLLECTIONS.reviews), {
    sop_id: sop.sop_id, sop_number: sop.sop_number, review_type: 'department',
    status: 'in_progress', reviewer_id: actor.id, reviewer_name: actor.name, created_at: now(),
  });
  await audit(actor, 'REVIEW_STARTED', sopId, sop.status, 'Department Review', comments);
  await notify('Approval Pending', `${sop.sop_number} submitted for review`, sopId, ['qa_manager', 'head_qa']);
  return (await getSopById(sopId))!;
}

export async function makeSopEffective(sopId: string, actor: SopActor): Promise<SopMasterRecord> {
  const sop = await getSopById(sopId);
  if (!sop) throw new Error('SOP not found');
  const err = validateSopEffective(
    sop.effective_date, sop.review_due_date, sop.status,
    sop.training_before_effective, sop.training_completion_pct >= 100,
  );
  if (err) throw new Error(err);

  if (sop.document_id) {
    await updateDoc(doc(getFirebaseFirestore(), SOP_COLLECTIONS.documents, sop.document_id), {
      status: 'effective', sop_status: 'Effective', updated_at: now(),
    });
    await ensureOnlyOneEffectiveSop(sop.sop_number, sop.document_id);
  }
  await updateDoc(doc(getFirebaseFirestore(), SOP_COLLECTIONS.master, sopId), {
    status: 'Effective', current_workflow: 'effective', updated_at: now(),
  });
  await syncToLegacySopManagement({ ...sop, status: 'Effective' });
  await audit(actor, 'EFFECTIVE', sopId, sop.status, 'Effective');
  await notify('Effective Today', `${sop.sop_number} is now effective`, sopId, ['qa_manager']);
  return (await getSopById(sopId))!;
}

async function ensureOnlyOneEffectiveSop(sopNumber: string, effectiveDocId: string) {
  const snap = await getDocs(query(
    collection(getFirebaseFirestore(), SOP_COLLECTIONS.documents),
    where('document_number', '==', sopNumber),
    where('status', '==', 'effective'),
  ));
  for (const d of snap.docs) {
    if (d.id !== effectiveDocId) {
      await updateDoc(d.ref, { status: 'obsolete', is_latest: false, sop_status: 'Superseded', updated_at: now() });
    }
  }
}

export async function createSopRevision(
  sopId: string, reason: string, isMajor: boolean, actor: SopActor,
): Promise<SopMasterRecord> {
  const sop = await getSopById(sopId);
  if (!sop?.document_id) throw new Error('SOP not found');
  const newVersion = incrementSopVersion(sop.version, isMajor);
  const dmsActor: DmsActor = { id: actor.id, name: actor.name, role: actor.role };

  const revised = await createRevision(sop.document_id, {
    version: newVersion,
    reason_for_revision: reason,
    effective_date: null,
    next_review_date: sop.review_due_date,
    change_control_ref: sop.linked_change_control || '',
    change_control_id: null,
    supersedes_document_no: sop.sop_number,
    remarks: '',
  }, dmsActor);

  await addDoc(collection(getFirebaseFirestore(), SOP_COLLECTIONS.versions), {
    sop_id: sop.sop_id, sop_number: sop.sop_number, version: sop.version,
    major_version: sop.major_version, minor_version: sop.minor_version,
    reason, status: 'Superseded', created_by: actor.id, created_by_name: actor.name, created_at: now(),
  });

  const trainingRequired = isMajor || sop.training_required;
  if (trainingRequired) {
    await addDoc(collection(getFirebaseFirestore(), SOP_COLLECTIONS.trainingLinks), {
      sop_id: sop.sop_id, sop_number: sop.sop_number, document_id: revised.id,
      training_title: `SOP Training: ${sop.sop_title} v${newVersion}`,
      target_department: sop.department, status: 'pending', due_date: sop.review_due_date, created_at: now(),
    });
    await notify('Training Assigned', `${sop.sop_number} v${newVersion} — training required`, revised.id, ['training_coordinator', 'qa_manager']);
  }

  await updateDoc(doc(getFirebaseFirestore(), SOP_COLLECTIONS.master, sopId), {
    status: 'Superseded', superseded_date: now().split('T')[0], is_latest: false, updated_at: now(),
  });

  const newSop = mapDocumentToSop(revised);
  await persistSopMaster(newSop, revised.id);
  await syncToLegacySopManagement(newSop);
  await audit(actor, 'REVISED', revised.id, sop, newSop, reason);
  return newSop;
}

export async function toggleSopFavorite(sopId: string, actor: SopActor): Promise<boolean> {
  const sop = await getSopById(sopId);
  if (!sop) throw new Error('SOP not found');
  const next = !sop.is_favorite;
  await updateDoc(doc(getFirebaseFirestore(), SOP_COLLECTIONS.master, sopId), { is_favorite: next, updated_at: now() });
  if (sop.document_id) {
    await updateDoc(doc(getFirebaseFirestore(), SOP_COLLECTIONS.documents, sop.document_id), { is_favorite: next });
  }
  await audit(actor, next ? 'BOOKMARK' : 'UNBOOKMARK', sopId, sop.is_favorite, next);
  return next;
}

export async function bulkSopAction(
  sopIds: string[], action: 'archive' | 'retire' | 'schedule_review', reason: string, actor: SopActor,
): Promise<number> {
  let count = 0;
  const dmsActor: DmsActor = { id: actor.id, name: actor.name, role: actor.role };
  for (const id of sopIds) {
    try {
      const sop = await getSopById(id);
      if (!sop) continue;
      if (action === 'archive' && sop.document_id) {
        if (sop.current_workflow === 'obsolete') await archiveDocument(sop.document_id, dmsActor);
        await updateDoc(doc(getFirebaseFirestore(), SOP_COLLECTIONS.master, id), {
          status: 'Archived', archive_date: now().split('T')[0], updated_at: now(),
        });
        await addDoc(collection(getFirebaseFirestore(), SOP_COLLECTIONS.archive), {
          sop_id: sop.sop_id, archived_by: actor.id, reason, archived_at: now(),
        });
      } else if (action === 'retire') {
        await updateDoc(doc(getFirebaseFirestore(), SOP_COLLECTIONS.master, id), { status: 'Retired', updated_at: now() });
        if (sop.document_id) await updateDoc(doc(getFirebaseFirestore(), SOP_COLLECTIONS.documents, sop.document_id), { status: 'retired' });
      } else {
        await addDoc(collection(getFirebaseFirestore(), SOP_COLLECTIONS.periodicReviews), {
          sop_id: sop.sop_id, due_date: sop.review_due_date, status: 'pending', created_at: now(),
        });
      }
      count++;
    } catch (e) { console.error(`Bulk SOP action failed for ${id}:`, e); }
  }
  await audit(actor, 'BULK_ACTION', sopIds.join(','), null, { action, count }, reason);
  return count;
}

export function exportSopCsv(records: SopMasterRecord[]) {
  downloadCsv(
    `sop-management-${now().split('T')[0]}.csv`,
    ['SOP Number', 'Title', 'Department', 'Category', 'Version', 'Status', 'Owner', 'Effective Date', 'Review Due', 'Training Required'],
    records.map((r) => [
      r.sop_number, r.sop_title, r.department, r.category, r.version, r.status,
      r.owner_name, r.effective_date || '', r.review_due_date || '', r.training_required ? 'Yes' : 'No',
    ]),
  );
}

export function exportSopExcel(records: SopMasterRecord[]) {
  exportSopCsv(records);
}

export async function logSopDashboardViewed(actor: SopActor) {
  await audit(actor, 'DASHBOARD_VIEWED', 'sop-dashboard', null, null);
}

export async function logSopExported(actor: SopActor, format: string, count: number) {
  await audit(actor, 'EXPORT', 'sop-dashboard', null, { format, count });
}

export async function fetchSopOptionsForCapa(max = 50): Promise<{ id: string; reference: string; title: string }[]> {
  const records = await mergeSopSources();
  return records.slice(0, max).map((r) => ({
    id: r.id, reference: r.sop_number, title: r.sop_title,
  }));
}

export { emptySopKpis, emptySopCharts, filterSopRecords, mapDocumentToSop };
