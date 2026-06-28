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
import type { WorkInstructionRecord, WiKpis, WiCharts, WiFilters, WiActor } from './wi-types';
import {
  mapDocumentToWi, mapWiMasterRaw, computeWiKpis, computeWiCharts,
  filterWiRecords, emptyWiKpis, emptyWiCharts,
} from './wi-records';
import type { WiCreateInput } from './wi-schemas';
import { validateWiEffective } from './wi-schemas';
import {
  WI_COLLECTIONS, DEPT_WI_PREFIX, incrementWiVersion, canReadEffectiveWiOnly,
} from './wi-types';

function now() { return new Date().toISOString(); }

async function audit(actor: WiActor, action: string, recordId: string, oldValue: unknown, newValue: unknown, reason = '') {
  await logAuditEvent({
    userId: actor.id, userName: actor.name, module: 'WI', recordId, action,
    oldValue: oldValue ? JSON.stringify(oldValue) : '',
    newValue: newValue ? JSON.stringify(newValue) : '',
    reason, ipAddress: 'client', device: typeof navigator !== 'undefined' ? navigator.userAgent : 'server',
    status: 'Success',
  });
}

async function notify(title: string, message: string, recordId: string, roles: string[]) {
  try {
    for (const role of roles) {
      await addDoc(collection(getFirebaseFirestore(), WI_COLLECTIONS.notifications), {
        title, message, module: 'WI', record_id: recordId, target_role: role,
        read: false, created_at: now(),
      });
    }
  } catch (e) { console.error('WI notification failed:', e); }
}

export async function generateWiNumber(department: string): Promise<string> {
  const deptPrefix = DEPT_WI_PREFIX[department] || 'WI';
  const year = new Date().getFullYear();
  const prefix = `WI-${deptPrefix}-${year}-`;
  try {
    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), WI_COLLECTIONS.master),
      where('wi_number', '>=', prefix),
      where('wi_number', '<=', `${prefix}\uf8ff`),
      orderBy('wi_number', 'desc'),
      limit(1),
    ));
    if (!snap.empty) {
      const last = snap.docs[0].data().wi_number as string;
      return `${prefix}${String(parseInt(last.split('-').pop() || '0', 10) + 1).padStart(4, '0')}`;
    }
  } catch {
    const all = await getDocs(collection(getFirebaseFirestore(), WI_COLLECTIONS.master));
    return `${prefix}${String(all.size + 1).padStart(4, '0')}`;
  }
  return `${prefix}0001`;
}

async function persistWi(record: Omit<WorkInstructionRecord, 'id'>, id?: string): Promise<string> {
  const ref = id
    ? doc(getFirebaseFirestore(), WI_COLLECTIONS.master, id)
    : doc(collection(getFirebaseFirestore(), WI_COLLECTIONS.master));
  await setDoc(ref, { ...record, updated_at: now() }, { merge: true });
  return ref.id;
}

export async function listWiMasterRecords(): Promise<WorkInstructionRecord[]> {
  try {
    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), WI_COLLECTIONS.master),
      orderBy('updated_at', 'desc'),
    ));
    return snap.docs.map((d) => mapWiMasterRaw({ id: d.id, ...d.data() }));
  } catch {
    const snap = await getDocs(collection(getFirebaseFirestore(), WI_COLLECTIONS.master));
    return snap.docs.map((d) => mapWiMasterRaw({ id: d.id, ...d.data() }))
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  }
}

async function loadWiFromDocuments(role?: string): Promise<WorkInstructionRecord[]> {
  const docs = await listDocuments({ document_type: 'STP' }, role);
  const results: WorkInstructionRecord[] = [];
  for (const d of docs) {
    let approvals;
    if (['under_review', 'pending_approval', 'returned_for_correction'].includes(d.status)) {
      try { approvals = await getApprovals(d.id); } catch { approvals = []; }
    }
    results.push(mapDocumentToWi(d, approvals));
  }
  return results;
}

async function mergeWiSources(role?: string): Promise<WorkInstructionRecord[]> {
  const [masterRecords, docRecords] = await Promise.all([
    listWiMasterRecords(),
    loadWiFromDocuments(role),
  ]);
  const byNumber = new Map<string, WorkInstructionRecord>();
  for (const r of docRecords) byNumber.set(r.wi_number, r);
  for (const r of masterRecords) {
    const existing = byNumber.get(r.wi_number);
    byNumber.set(r.wi_number, existing ? { ...existing, ...r, id: existing.id } : r);
  }
  return Array.from(byNumber.values()).filter((r) => r.is_latest !== false);
}

export async function syncPeriodicWiReviews(): Promise<number> {
  const today = now().split('T')[0];
  const records = await mergeWiSources();
  let count = 0;
  for (const r of records) {
    if (r.status !== 'Effective' || !r.review_due_date || r.review_due_date > today) continue;
    const existing = await getDocs(query(
      collection(getFirebaseFirestore(), WI_COLLECTIONS.periodicReviews),
      where('wi_id', '==', r.wi_id),
      where('status', '==', 'pending'),
      limit(1),
    ));
    if (!existing.empty) continue;
    await addDoc(collection(getFirebaseFirestore(), WI_COLLECTIONS.periodicReviews), {
      wi_id: r.wi_id, wi_number: r.wi_number, due_date: r.review_due_date,
      status: 'pending', assigned_to: r.owner, assigned_to_name: r.owner_name, created_at: now(),
    });
    if (r.document_id) {
      await updateDoc(doc(getFirebaseFirestore(), WI_COLLECTIONS.documents, r.document_id), {
        wi_status: 'Periodic Review', updated_at: now(),
      });
    }
    await notify('Review Due', `${r.wi_number} periodic review due`, r.id, ['qa_manager', 'head_qa']);
    count++;
  }
  return count;
}

export async function syncWiTrainingStatus(): Promise<number> {
  let count = 0;
  try {
    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), WI_COLLECTIONS.trainingLinks),
      where('status', '==', 'pending'),
    ));
    for (const d of snap.docs) {
      const wiId = d.data().wi_id as string;
      if (!wiId) continue;
      const masterSnap = await getDocs(query(
        collection(getFirebaseFirestore(), WI_COLLECTIONS.master),
        where('wi_id', '==', wiId),
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

export async function fetchWiDashboardData(
  filters?: WiFilters,
  actor?: WiActor,
): Promise<{ records: WorkInstructionRecord[]; metrics: WiKpis; charts: WiCharts }> {
  await Promise.all([
    syncEffectiveDocuments(), syncReviewDueNotifications(),
    syncPeriodicWiReviews(), syncWiTrainingStatus(),
  ]);

  const role = actor?.role || '';
  let records = await mergeWiSources(canReadEffectiveWiOnly(role) ? role : undefined);
  if (canReadEffectiveWiOnly(role)) records = records.filter((r) => r.status === 'Effective');
  if (filters) records = filterWiRecords(records, filters);

  return { records, metrics: computeWiKpis(records), charts: computeWiCharts(records) };
}

export async function getWiById(id: string): Promise<WorkInstructionRecord | null> {
  try {
    const snap = await getDoc(doc(getFirebaseFirestore(), WI_COLLECTIONS.master, id));
    if (snap.exists()) return mapWiMasterRaw({ id: snap.id, ...snap.data() });
  } catch { /* fall through */ }
  const docRecord = await getDocumentById(id);
  if (docRecord && docRecord.document_type === 'STP') {
    return mapDocumentToWi(docRecord, await getApprovals(id));
  }
  return null;
}

export async function fetchEquipmentOptions(max = 50): Promise<{ id: string; name: string }[]> {
  try {
    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), 'equipment_master'),
      limit(max),
    ));
    return snap.docs.map((d) => ({
      id: d.id,
      name: String(d.data().equipment_name || d.data().name || d.data().equipment_id || d.id),
    }));
  } catch { return []; }
}

export async function fetchProductionLineOptions(max = 50): Promise<{ id: string; name: string }[]> {
  try {
    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), WI_COLLECTIONS.productionLines),
      limit(max),
    ));
    return snap.docs.map((d) => ({
      id: d.id,
      name: String(d.data().line_name || d.data().name || d.id),
    }));
  } catch { return []; }
}

export async function fetchSopLinkOptions(max = 50): Promise<{ id: string; number: string; title: string }[]> {
  try {
    const { fetchSopOptionsForCapa } = await import('@/lib/sop-service');
    const options = await fetchSopOptionsForCapa(max);
    return options.map((o) => ({ id: o.id, number: o.reference, title: o.title }));
  } catch { return []; }
}

export async function createWi(input: WiCreateInput, actor: WiActor): Promise<WorkInstructionRecord> {
  const wiNumber = await generateWiNumber(input.department);
  const dmsActor: DmsActor = { id: actor.id, name: actor.name, role: actor.role };
  const timestamp = now();
  const versionParts = input.version.split('.');

  const created = await createDocument({
    document_title: input.wi_title,
    document_type: 'STP',
    department: input.department,
    version: input.version,
    prepared_by_name: input.author_name || input.owner_name,
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

  await updateDoc(doc(getFirebaseFirestore(), WI_COLLECTIONS.documents, created.id), {
    document_number: wiNumber,
    document_category: 'Work Instruction',
    wi_status: 'Draft',
    category: input.category,
    equipment: input.equipment || '',
    equipment_id: input.equipment_id || null,
    production_line: input.production_line || '',
    production_line_id: input.production_line_id || null,
    related_sop: input.related_sop || '',
    related_sop_id: input.related_sop_id || null,
    owner: actor.id,
    owner_name: input.owner_name,
    approver_name: input.approver_name,
    training_required: input.training_required,
  });

  const wiRecord: Omit<WorkInstructionRecord, 'id'> = {
    wi_id: `WI-${wiNumber}`,
    wi_number: wiNumber,
    wi_title: input.wi_title,
    short_title: input.short_title || input.wi_title.slice(0, 60),
    department: input.department,
    business_unit: input.business_unit || '',
    site: input.site || '',
    area: input.area || '',
    equipment: input.equipment || '',
    equipment_id: input.equipment_id || null,
    production_line: input.production_line || '',
    production_line_id: input.production_line_id || null,
    related_sop: input.related_sop || '',
    related_sop_id: input.related_sop_id || null,
    category: input.category,
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
    workflow_status: 'draft',
    effective_date: input.effective_date,
    review_due_date: input.review_due_date,
    superseded_date: null,
    archive_date: null,
    retention_period: null,
    training_required: input.training_required,
    electronic_signature_required: input.electronic_signature_required,
    linked_change_control: input.linked_change_control || null,
    linked_capa: null,
    linked_risk_assessment: null,
    linked_validation: null,
    linked_forms: [],
    keywords: input.keywords || [],
    language: input.language,
    confidentiality: input.confidentiality,
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

  const masterId = await persistWi(wiRecord, created.id);
  const result = { id: masterId, ...wiRecord };
  await audit(actor, 'WI_CREATED', masterId, null, result);
  await notify('WI Created', `${wiNumber} created`, masterId, ['qa_manager']);
  return result;
}

export async function submitWiForReview(wiId: string, actor: WiActor, comments = ''): Promise<WorkInstructionRecord> {
  const wi = await getWiById(wiId);
  if (!wi?.document_id) throw new Error('Work instruction not found');
  const dmsActor: DmsActor = { id: actor.id, name: actor.name, role: actor.role };
  await submitForReview(wi.document_id, dmsActor, comments);
  await updateDoc(doc(getFirebaseFirestore(), WI_COLLECTIONS.master, wiId), {
    status: 'Department Review', workflow_status: 'under_review', updated_at: now(),
  });
  await addDoc(collection(getFirebaseFirestore(), WI_COLLECTIONS.reviews), {
    wi_id: wi.wi_id, wi_number: wi.wi_number, review_type: 'department',
    status: 'in_progress', reviewer_id: actor.id, reviewer_name: actor.name, created_at: now(),
  });
  await audit(actor, 'REVIEW_STARTED', wiId, wi.status, 'Department Review', comments);
  await notify('Approval Pending', `${wi.wi_number} submitted for review`, wiId, ['qa_manager', 'head_qa']);
  return (await getWiById(wiId))!;
}

export async function makeWiEffective(wiId: string, actor: WiActor): Promise<WorkInstructionRecord> {
  const wi = await getWiById(wiId);
  if (!wi) throw new Error('Work instruction not found');
  const err = validateWiEffective(wi.effective_date, wi.review_due_date, wi.status, wi.status === 'Approved');
  if (err) throw new Error(err);

  if (wi.document_id) {
    await updateDoc(doc(getFirebaseFirestore(), WI_COLLECTIONS.documents, wi.document_id), {
      status: 'effective', wi_status: 'Effective', updated_at: now(),
    });
    await ensureOnlyOneEffectiveWi(wi.wi_number, wi.document_id);
  }
  await updateDoc(doc(getFirebaseFirestore(), WI_COLLECTIONS.master, wiId), {
    status: 'Effective', workflow_status: 'effective', updated_at: now(),
  });
  await audit(actor, 'EFFECTIVE', wiId, wi.status, 'Effective');
  await notify('Effective Today', `${wi.wi_number} is now effective`, wiId, ['qa_manager']);
  return (await getWiById(wiId))!;
}

async function ensureOnlyOneEffectiveWi(wiNumber: string, effectiveDocId: string) {
  const snap = await getDocs(query(
    collection(getFirebaseFirestore(), WI_COLLECTIONS.documents),
    where('document_number', '==', wiNumber),
    where('status', '==', 'effective'),
  ));
  for (const d of snap.docs) {
    if (d.id !== effectiveDocId) {
      await updateDoc(d.ref, { status: 'obsolete', is_latest: false, wi_status: 'Superseded', updated_at: now() });
    }
  }
}

export async function createWiRevision(
  wiId: string, reason: string, isMajor: boolean, actor: WiActor,
): Promise<WorkInstructionRecord> {
  const wi = await getWiById(wiId);
  if (!wi?.document_id) throw new Error('Work instruction not found');
  const newVersion = incrementWiVersion(wi.version, isMajor);
  const dmsActor: DmsActor = { id: actor.id, name: actor.name, role: actor.role };

  const revised = await createRevision(wi.document_id, {
    version: newVersion,
    reason_for_revision: reason,
    effective_date: wi.effective_date,
    next_review_date: wi.review_due_date,
    change_control_ref: wi.linked_change_control || '',
    change_control_id: null,
    supersedes_document_no: wi.wi_number,
    remarks: '',
  }, dmsActor);

  await addDoc(collection(getFirebaseFirestore(), WI_COLLECTIONS.versions), {
    wi_id: wi.wi_id, wi_number: wi.wi_number, version: wi.version,
    major_version: wi.major_version, minor_version: wi.minor_version,
    reason, status: 'Superseded', created_by: actor.id, created_by_name: actor.name, created_at: now(),
  });

  if (isMajor || wi.training_required) {
    await addDoc(collection(getFirebaseFirestore(), WI_COLLECTIONS.trainingLinks), {
      wi_id: wi.wi_id, wi_number: wi.wi_number, document_id: revised.id,
      training_title: `WI Training: ${wi.wi_title} v${newVersion}`,
      target_department: wi.department, status: 'pending', due_date: wi.review_due_date, created_at: now(),
    });
    await notify('Training Assigned', `${wi.wi_number} v${newVersion} — training required`, revised.id, ['training_coordinator']);
  }

  await updateDoc(doc(getFirebaseFirestore(), WI_COLLECTIONS.master, wiId), {
    status: 'Superseded', superseded_date: now().split('T')[0], is_latest: false, updated_at: now(),
  });

  const newWi = mapDocumentToWi(revised);
  await persistWi(newWi, revised.id);
  await audit(actor, 'REVISED', revised.id, wi, newWi, reason);
  return newWi;
}

export async function toggleWiFavorite(wiId: string, actor: WiActor): Promise<boolean> {
  const wi = await getWiById(wiId);
  if (!wi) throw new Error('Work instruction not found');
  const next = !wi.is_favorite;
  await updateDoc(doc(getFirebaseFirestore(), WI_COLLECTIONS.master, wiId), { is_favorite: next, updated_at: now() });
  if (wi.document_id) await updateDoc(doc(getFirebaseFirestore(), WI_COLLECTIONS.documents, wi.document_id), { is_favorite: next });
  await audit(actor, next ? 'BOOKMARK' : 'UNBOOKMARK', wiId, wi.is_favorite, next);
  return next;
}

export async function bulkWiAction(
  wiIds: string[], action: 'archive' | 'retire' | 'schedule_review', reason: string, actor: WiActor,
): Promise<number> {
  let count = 0;
  const dmsActor: DmsActor = { id: actor.id, name: actor.name, role: actor.role };
  for (const id of wiIds) {
    try {
      const wi = await getWiById(id);
      if (!wi) continue;
      if (action === 'archive' && wi.document_id) {
        if (wi.workflow_status === 'obsolete') await archiveDocument(wi.document_id, dmsActor);
        await updateDoc(doc(getFirebaseFirestore(), WI_COLLECTIONS.master, id), {
          status: 'Archived', archive_date: now().split('T')[0], updated_at: now(),
        });
        await addDoc(collection(getFirebaseFirestore(), WI_COLLECTIONS.archive), {
          wi_id: wi.wi_id, archived_by: actor.id, reason, archived_at: now(),
        });
      } else if (action === 'retire') {
        await updateDoc(doc(getFirebaseFirestore(), WI_COLLECTIONS.master, id), { status: 'Retired', updated_at: now() });
        if (wi.document_id) await updateDoc(doc(getFirebaseFirestore(), WI_COLLECTIONS.documents, wi.document_id), { status: 'retired' });
      } else {
        await addDoc(collection(getFirebaseFirestore(), WI_COLLECTIONS.periodicReviews), {
          wi_id: wi.wi_id, due_date: wi.review_due_date, status: 'pending', created_at: now(),
        });
      }
      count++;
    } catch (e) { console.error(`Bulk WI action failed for ${id}:`, e); }
  }
  await audit(actor, 'BULK_ACTION', wiIds.join(','), null, { action, count }, reason);
  return count;
}

export function exportWiCsv(records: WorkInstructionRecord[]) {
  downloadCsv(
    `work-instructions-${now().split('T')[0]}.csv`,
    ['WI Number', 'Title', 'Department', 'Category', 'Equipment', 'Related SOP', 'Version', 'Status', 'Owner', 'Effective', 'Review Due'],
    records.map((r) => [
      r.wi_number, r.wi_title, r.department, r.category, r.equipment, r.related_sop,
      r.version, r.status, r.owner_name, r.effective_date || '', r.review_due_date || '',
    ]),
  );
}

export function exportWiExcel(records: WorkInstructionRecord[]) { exportWiCsv(records); }

export async function logWiDashboardViewed(actor: WiActor) {
  await audit(actor, 'DASHBOARD_VIEWED', 'wi-dashboard', null, null);
}

export async function logWiExported(actor: WiActor, format: string, count: number) {
  await audit(actor, 'EXPORTED', 'wi-dashboard', null, { format, count });
}

export { emptyWiKpis, emptyWiCharts, filterWiRecords, mapDocumentToWi };
