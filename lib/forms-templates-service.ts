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
import type { DmsActor } from '@/lib/dms-types';
import type { FormTemplateRecord, FormKpis, FormCharts, FormFilters, FormActor } from './forms-templates-types';
import {
  mapDocumentToForm, mapFormMasterRaw, computeFormKpis, computeFormCharts,
  filterFormRecords, emptyFormKpis, emptyFormCharts,
} from './forms-templates-records';
import type { FormCreateInput } from './forms-templates-schemas';
import { validateFormEffective } from './forms-templates-schemas';
import {
  FT_COLLECTIONS, DEPT_FORM_PREFIX, FORM_TYPE_PREFIX, incrementFormVersion, canReadEffectiveFormsOnly,
} from './forms-templates-types';

function now() { return new Date().toISOString(); }

async function audit(actor: FormActor, action: string, recordId: string, oldValue: unknown, newValue: unknown, reason = '') {
  await logAuditEvent({
    userId: actor.id, userName: actor.name, module: 'Forms', recordId, action,
    oldValue: oldValue ? JSON.stringify(oldValue) : '',
    newValue: newValue ? JSON.stringify(newValue) : '',
    reason, ipAddress: 'client', device: typeof navigator !== 'undefined' ? navigator.userAgent : 'server',
    status: 'Success',
  });
}

async function notify(title: string, message: string, recordId: string, roles: string[]) {
  try {
    for (const role of roles) {
      await addDoc(collection(getFirebaseFirestore(), FT_COLLECTIONS.notifications), {
        title, message, module: 'Forms', record_id: recordId, target_role: role, read: false, created_at: now(),
      });
    }
  } catch (e) { console.error('Forms notification failed:', e); }
}

export async function generateFormNumber(department: string, formType: string): Promise<string> {
  const typePrefix = FORM_TYPE_PREFIX[formType] || 'FRM';
  const deptPrefix = DEPT_FORM_PREFIX[department] || 'GEN';
  const year = new Date().getFullYear();
  const prefix = `${typePrefix}-${deptPrefix}-${year}-`;
  try {
    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), FT_COLLECTIONS.master),
      where('form_number', '>=', prefix),
      where('form_number', '<=', `${prefix}\uf8ff`),
      orderBy('form_number', 'desc'),
      limit(1),
    ));
    if (!snap.empty) {
      const last = snap.docs[0].data().form_number as string;
      return `${prefix}${String(parseInt(last.split('-').pop() || '0', 10) + 1).padStart(4, '0')}`;
    }
  } catch {
    const all = await getDocs(collection(getFirebaseFirestore(), FT_COLLECTIONS.master));
    return `${prefix}${String(all.size + 1).padStart(4, '0')}`;
  }
  return `${prefix}0001`;
}

async function persistForm(record: Omit<FormTemplateRecord, 'id'>, id?: string): Promise<string> {
  const ref = id ? doc(getFirebaseFirestore(), FT_COLLECTIONS.master, id) : doc(collection(getFirebaseFirestore(), FT_COLLECTIONS.master));
  await setDoc(ref, { ...record, updated_at: now() }, { merge: true });
  return ref.id;
}

async function listFormMasterRecords(): Promise<FormTemplateRecord[]> {
  try {
    const snap = await getDocs(query(collection(getFirebaseFirestore(), FT_COLLECTIONS.master), orderBy('updated_at', 'desc')));
    return snap.docs.map((d) => mapFormMasterRaw({ id: d.id, ...d.data() }));
  } catch {
    const snap = await getDocs(collection(getFirebaseFirestore(), FT_COLLECTIONS.master));
    return snap.docs.map((d) => mapFormMasterRaw({ id: d.id, ...d.data() })).sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  }
}

async function loadFormsFromDocuments(role?: string): Promise<FormTemplateRecord[]> {
  const docs = await listDocuments({ document_type: 'Form' }, role);
  const results: FormTemplateRecord[] = [];
  for (const d of docs) {
    let approvals;
    if (['under_review', 'pending_approval', 'returned_for_correction'].includes(d.status)) {
      try { approvals = await getApprovals(d.id); } catch { approvals = []; }
    }
    results.push(mapDocumentToForm(d, approvals));
  }
  return results;
}

async function mergeFormSources(role?: string): Promise<FormTemplateRecord[]> {
  const [master, fromDocs] = await Promise.all([listFormMasterRecords(), loadFormsFromDocuments(role)]);
  const byNumber = new Map<string, FormTemplateRecord>();
  for (const r of fromDocs) byNumber.set(r.form_number, r);
  for (const r of master) {
    const ex = byNumber.get(r.form_number);
    byNumber.set(r.form_number, ex ? { ...ex, ...r, id: ex.id } : r);
  }
  return Array.from(byNumber.values()).filter((r) => r.is_latest !== false);
}

export async function syncPeriodicFormReviews(): Promise<number> {
  const today = now().split('T')[0];
  const records = await mergeFormSources();
  let count = 0;
  for (const r of records) {
    if (r.status !== 'Effective' || !r.review_due_date || r.review_due_date > today) continue;
    const existing = await getDocs(query(
      collection(getFirebaseFirestore(), FT_COLLECTIONS.periodicReviews),
      where('form_id', '==', r.form_id), where('status', '==', 'pending'), limit(1),
    ));
    if (!existing.empty) continue;
    await addDoc(collection(getFirebaseFirestore(), FT_COLLECTIONS.periodicReviews), {
      form_id: r.form_id, form_number: r.form_number, due_date: r.review_due_date,
      status: 'pending', assigned_to: r.owner, assigned_to_name: r.owner_name, created_at: now(),
    });
    if (r.document_id) await updateDoc(doc(getFirebaseFirestore(), FT_COLLECTIONS.documents, r.document_id), { form_status: 'Periodic Review', updated_at: now() });
    await notify('Review Due', `${r.form_number} periodic review due`, r.id, ['qa_manager', 'head_qa']);
    count++;
  }
  return count;
}

export async function fetchFormsDashboardData(filters?: FormFilters, actor?: FormActor) {
  await Promise.all([syncEffectiveDocuments(), syncReviewDueNotifications(), syncPeriodicFormReviews()]);
  const role = actor?.role || '';
  let records = await mergeFormSources(canReadEffectiveFormsOnly(role) ? role : undefined);
  if (canReadEffectiveFormsOnly(role)) records = records.filter((r) => r.status === 'Effective');
  if (filters) records = filterFormRecords(records, filters);
  return { records, metrics: computeFormKpis(records), charts: computeFormCharts(records) };
}

export async function getFormById(id: string): Promise<FormTemplateRecord | null> {
  try {
    const snap = await getDoc(doc(getFirebaseFirestore(), FT_COLLECTIONS.master, id));
    if (snap.exists()) return mapFormMasterRaw({ id: snap.id, ...snap.data() });
  } catch { /* fall through */ }
  const docRecord = await getDocumentById(id);
  if (docRecord && (docRecord.document_type === 'Form' || docRecord.document_type === 'Other')) {
    return mapDocumentToForm(docRecord, await getApprovals(id));
  }
  return null;
}

export async function fetchSopLinkOptions(max = 50) {
  try {
    const { fetchSopOptionsForCapa } = await import('@/lib/sop-service');
    return (await fetchSopOptionsForCapa(max)).map((o) => ({ id: o.id, number: o.reference, title: o.title }));
  } catch { return []; }
}

export async function fetchWiLinkOptions(max = 50) {
  try {
    const snap = await getDocs(query(collection(getFirebaseFirestore(), FT_COLLECTIONS.workInstructions), limit(max)));
    return snap.docs.map((d) => ({ id: d.id, number: String(d.data().wi_number || d.id), title: String(d.data().wi_title || '') }));
  } catch { return []; }
}

export async function createForm(input: FormCreateInput, actor: FormActor): Promise<FormTemplateRecord> {
  const formNumber = await generateFormNumber(input.department, input.form_type);
  const dmsActor: DmsActor = { id: actor.id, name: actor.name, role: actor.role };
  const timestamp = now();
  const vp = input.version.split('.');

  const created = await createDocument({
    document_title: input.form_title, document_type: 'Form', department: input.department,
    version: input.version, prepared_by_name: input.author_name || input.owner_name,
    effective_date: input.effective_date, next_review_date: input.review_due_date,
    product_name: '', change_control_ref: input.linked_change_control || '', change_control_id: null,
    supersedes_document_no: '', supersedes_document_id: null, reason_for_revision: '', remarks: '',
    linked_pqr_id: null, linked_cpv_id: null,
  }, dmsActor);

  await updateDoc(doc(getFirebaseFirestore(), FT_COLLECTIONS.documents, created.id), {
    document_number: formNumber, document_category: input.form_type, form_type: input.form_type,
    form_status: 'Draft', category: input.category, related_sop: input.related_sop || '',
    related_sop_id: input.related_sop_id || null, related_wi: input.related_wi || '',
    related_wi_id: input.related_wi_id || null, owner: actor.id, owner_name: input.owner_name,
    approver_name: input.approver_name, training_required: input.training_required,
  });

  const formRecord: Omit<FormTemplateRecord, 'id'> = {
    form_id: `FRM-${formNumber}`, form_number: formNumber, form_title: input.form_title,
    short_title: input.short_title || input.form_title.slice(0, 60), form_type: input.form_type,
    category: input.category, department: input.department, business_unit: input.business_unit || '',
    site: input.site || '', owner: actor.id, owner_name: input.owner_name,
    author: actor.id, author_name: input.author_name || input.owner_name,
    reviewer: '', reviewer_name: '', approver: '', approver_name: input.approver_name,
    related_sop: input.related_sop || '', related_sop_id: input.related_sop_id || null,
    related_wi: input.related_wi || '', related_wi_id: input.related_wi_id || null,
    linked_change_control: input.linked_change_control || null,
    version: input.version, major_version: parseInt(vp[0] || '1', 10), minor_version: parseInt(vp[1] || '0', 10),
    status: 'Draft', workflow_status: 'draft', effective_date: input.effective_date,
    review_due_date: input.review_due_date, superseded_date: null, archive_date: null, retention_period: null,
    training_required: input.training_required, electronic_signature_required: input.electronic_signature_required,
    attachment_url: null, keywords: input.keywords || [], language: input.language, confidentiality: input.confidentiality,
    document_id: created.id, is_latest: true, is_favorite: false, training_pending: false, training_completion_pct: 0,
    created_by: actor.id, created_by_name: actor.name, updated_by: actor.id, updated_by_name: actor.name,
    created_at: timestamp, updated_at: timestamp,
  };

  const masterId = await persistForm(formRecord, created.id);
  const result = { id: masterId, ...formRecord };
  await audit(actor, 'FORM_CREATED', masterId, null, result);
  await notify('Form Created', `${formNumber} created`, masterId, ['qa_manager']);
  return result;
}

export async function submitFormForReview(formId: string, actor: FormActor, comments = '') {
  const form = await getFormById(formId);
  if (!form?.document_id) throw new Error('Form not found');
  await submitForReview(form.document_id, { id: actor.id, name: actor.name, role: actor.role }, comments);
  await updateDoc(doc(getFirebaseFirestore(), FT_COLLECTIONS.master, formId), { status: 'Department Review', workflow_status: 'under_review', updated_at: now() });
  await addDoc(collection(getFirebaseFirestore(), FT_COLLECTIONS.reviews), { form_id: form.form_id, form_number: form.form_number, review_type: 'department', status: 'in_progress', reviewer_id: actor.id, reviewer_name: actor.name, created_at: now() });
  await audit(actor, 'REVIEW_STARTED', formId, form.status, 'Department Review', comments);
  await notify('Approval Pending', `${form.form_number} submitted for review`, formId, ['qa_manager', 'head_qa']);
  return (await getFormById(formId))!;
}

export async function makeFormEffective(formId: string, actor: FormActor) {
  const form = await getFormById(formId);
  if (!form) throw new Error('Form not found');
  const err = validateFormEffective(form.effective_date, form.review_due_date, form.status);
  if (err) throw new Error(err);
  if (form.document_id) {
    await updateDoc(doc(getFirebaseFirestore(), FT_COLLECTIONS.documents, form.document_id), { status: 'effective', form_status: 'Effective', updated_at: now() });
    await ensureOnlyOneEffectiveForm(form.form_number, form.document_id);
  }
  await updateDoc(doc(getFirebaseFirestore(), FT_COLLECTIONS.master, formId), { status: 'Effective', workflow_status: 'effective', updated_at: now() });
  await audit(actor, 'EFFECTIVE', formId, form.status, 'Effective');
  await notify('Effective Today', `${form.form_number} is now effective`, formId, ['qa_manager']);
  return (await getFormById(formId))!;
}

async function ensureOnlyOneEffectiveForm(formNumber: string, effectiveDocId: string) {
  const snap = await getDocs(query(collection(getFirebaseFirestore(), FT_COLLECTIONS.documents), where('document_number', '==', formNumber), where('status', '==', 'effective')));
  for (const d of snap.docs) {
    if (d.id !== effectiveDocId) await updateDoc(d.ref, { status: 'obsolete', is_latest: false, form_status: 'Superseded', updated_at: now() });
  }
}

export async function createFormRevision(formId: string, reason: string, isMajor: boolean, actor: FormActor) {
  const form = await getFormById(formId);
  if (!form?.document_id) throw new Error('Form not found');
  const newVersion = incrementFormVersion(form.version, isMajor);
  const revised = await createRevision(form.document_id, {
    version: newVersion, reason_for_revision: reason, effective_date: form.effective_date,
    next_review_date: form.review_due_date, change_control_ref: form.linked_change_control || '',
    change_control_id: null, supersedes_document_no: form.form_number, remarks: '',
  }, { id: actor.id, name: actor.name, role: actor.role });

  await addDoc(collection(getFirebaseFirestore(), FT_COLLECTIONS.versions), {
    form_id: form.form_id, form_number: form.form_number, version: form.version, reason, status: 'Superseded',
    created_by: actor.id, created_by_name: actor.name, created_at: now(),
  });

  if ((isMajor || form.training_required) && form.training_required) {
    await addDoc(collection(getFirebaseFirestore(), FT_COLLECTIONS.distribution), {
      form_id: form.form_id, form_number: form.form_number, document_id: revised.id,
      training_title: `Form Training: ${form.form_title} v${newVersion}`, status: 'pending', created_at: now(),
    });
    await notify('Training Assigned', `${form.form_number} v${newVersion} — training required`, revised.id, ['training_coordinator']);
  }

  await updateDoc(doc(getFirebaseFirestore(), FT_COLLECTIONS.master, formId), { status: 'Superseded', superseded_date: now().split('T')[0], is_latest: false, updated_at: now() });
  const newForm = mapDocumentToForm(revised);
  await persistForm(newForm, revised.id);
  await audit(actor, 'REVISED', revised.id, form, newForm, reason);
  return newForm;
}

export async function toggleFormFavorite(formId: string, actor: FormActor) {
  const form = await getFormById(formId);
  if (!form) throw new Error('Form not found');
  const next = !form.is_favorite;
  await updateDoc(doc(getFirebaseFirestore(), FT_COLLECTIONS.master, formId), { is_favorite: next, updated_at: now() });
  if (form.document_id) await updateDoc(doc(getFirebaseFirestore(), FT_COLLECTIONS.documents, form.document_id), { is_favorite: next });
  await audit(actor, next ? 'BOOKMARK' : 'UNBOOKMARK', formId, form.is_favorite, next);
  return next;
}

export async function bulkFormAction(formIds: string[], action: 'archive' | 'retire' | 'schedule_review', reason: string, actor: FormActor) {
  let count = 0;
  const dmsActor: DmsActor = { id: actor.id, name: actor.name, role: actor.role };
  for (const id of formIds) {
    try {
      const form = await getFormById(id);
      if (!form) continue;
      if (action === 'archive') {
        if (form.workflow_status === 'obsolete' && form.document_id) await archiveDocument(form.document_id, dmsActor);
        await updateDoc(doc(getFirebaseFirestore(), FT_COLLECTIONS.master, id), { status: 'Archived', archive_date: now().split('T')[0], updated_at: now() });
        await addDoc(collection(getFirebaseFirestore(), FT_COLLECTIONS.archive), { form_id: form.form_id, archived_by: actor.id, reason, archived_at: now() });
      } else if (action === 'retire') {
        await updateDoc(doc(getFirebaseFirestore(), FT_COLLECTIONS.master, id), { status: 'Retired', updated_at: now() });
        if (form.document_id) await updateDoc(doc(getFirebaseFirestore(), FT_COLLECTIONS.documents, form.document_id), { status: 'retired' });
      } else {
        await addDoc(collection(getFirebaseFirestore(), FT_COLLECTIONS.periodicReviews), { form_id: form.form_id, due_date: form.review_due_date, status: 'pending', created_at: now() });
      }
      count++;
    } catch (e) { console.error(`Bulk form action failed for ${id}:`, e); }
  }
  await audit(actor, 'BULK_ACTION', formIds.join(','), null, { action, count }, reason);
  return count;
}

export function exportFormsCsv(records: FormTemplateRecord[]) {
  downloadCsv(
    `forms-templates-${now().split('T')[0]}.csv`,
    ['Form Number', 'Title', 'Type', 'Category', 'Department', 'Version', 'Status', 'Related SOP', 'Related WI', 'Effective', 'Review Due'],
    records.map((r) => [r.form_number, r.form_title, r.form_type, r.category, r.department, r.version, r.status, r.related_sop, r.related_wi, r.effective_date || '', r.review_due_date || '']),
  );
}

export function exportFormsExcel(records: FormTemplateRecord[]) { exportFormsCsv(records); }

export async function logFormsDashboardViewed(actor: FormActor) { await audit(actor, 'DASHBOARD_VIEWED', 'forms-dashboard', null, null); }
export async function logFormsExported(actor: FormActor, format: string, count: number) { await audit(actor, 'EXPORTED', 'forms-dashboard', null, { format, count }); }

export { emptyFormKpis, emptyFormCharts, filterFormRecords, mapDocumentToForm };
