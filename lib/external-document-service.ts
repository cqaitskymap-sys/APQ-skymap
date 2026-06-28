import {
  addDoc, collection, doc, getDoc, getDocs, limit, orderBy, query, updateDoc, where,
} from 'firebase/firestore';
import { getFirebaseFirestore } from '@/lib/firebase';
import { logAuditEvent } from '@/lib/admin/admin-service';
import { downloadCsv } from '@/lib/export-utils';
import { getDocumentById } from '@/lib/dms-service';
import type {
  ExternalDocumentRecord, ExternalDocumentFilters, ExternalDocumentActor,
  ExternalDocumentReview, LinkedInternalDocument,
} from './external-document-types';
import {
  mapExternalDocumentRaw, mapReviewRaw, computeExternalKpis, computeExternalCharts,
  filterExternalDocuments, addMonthsToDate,
} from './external-document-records';
import type {
  RegisterExternalDocumentInput, ApproveExternalDocumentInput, LinkInternalDocumentInput,
  BulkReviewAssignInput, NewVersionInput,
} from './external-document-schemas';
import {
  EDM_COLLECTIONS, EDM_MODULE, frequencyToMonths,
  isSupplierDocument, isRegulatoryDocument, isStandardsDocument,
} from './external-document-types';

function now() { return new Date().toISOString(); }

async function audit(actor: ExternalDocumentActor, action: string, recordId: string, oldValue: unknown, newValue: unknown, reason = '') {
  await logAuditEvent({
    userId: actor.id, userName: actor.name, module: EDM_MODULE, recordId, action,
    oldValue: oldValue ? JSON.stringify(oldValue) : '',
    newValue: newValue ? JSON.stringify(newValue) : '',
    reason, ipAddress: 'client', device: typeof navigator !== 'undefined' ? navigator.userAgent : 'server',
    status: 'Success',
  });
}

async function notify(title: string, message: string, recordId: string, roles: string[] = []) {
  try {
    for (const role of roles) {
      await addDoc(collection(getFirebaseFirestore(), EDM_COLLECTIONS.notifications), {
        title, message, module: EDM_MODULE, record_id: recordId,
        target_role: role, read: false, created_at: now(),
      });
    }
  } catch (e) { console.error('EDM notification failed:', e); }
}

async function generateDocNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `EXT-${year}-`;
  try {
    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), EDM_COLLECTIONS.documents),
      where('document_number', '>=', prefix),
      where('document_number', '<=', `${prefix}\uf8ff`),
      orderBy('document_number', 'desc'),
      limit(1),
    ));
    if (!snap.empty) {
      const last = snap.docs[0].data().document_number as string;
      return `${prefix}${String(parseInt(last.split('-').pop() || '0', 10) + 1).padStart(4, '0')}`;
    }
  } catch {
    const all = await getDocs(collection(getFirebaseFirestore(), EDM_COLLECTIONS.documents));
    return `${prefix}${String(all.size + 1).padStart(4, '0')}`;
  }
  return `${prefix}0001`;
}

async function listAllExternalDocuments(): Promise<ExternalDocumentRecord[]> {
  try {
    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), EDM_COLLECTIONS.documents),
      orderBy('updated_at', 'desc'),
    ));
    return snap.docs.map((d) => mapExternalDocumentRaw({ id: d.id, ...d.data() }));
  } catch {
    const snap = await getDocs(collection(getFirebaseFirestore(), EDM_COLLECTIONS.documents));
    return snap.docs.map((d) => mapExternalDocumentRaw({ id: d.id, ...d.data() }))
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  }
}

async function listAllReviews(): Promise<ExternalDocumentReview[]> {
  try {
    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), EDM_COLLECTIONS.reviews),
      orderBy('created_at', 'desc'),
      limit(200),
    ));
    return snap.docs.map((d) => mapReviewRaw({ id: d.id, ...d.data() }));
  } catch {
    return [];
  }
}

async function syncSpecializedCollection(doc: ExternalDocumentRecord, docId: string): Promise<void> {
  const payload = {
    external_document_id: docId,
    document_number: doc.document_number,
    title: doc.title,
    source_organization: doc.source_organization,
    status: doc.status,
    updated_at: doc.updated_at,
  };
  if (isSupplierDocument(doc)) {
    await addDoc(collection(getFirebaseFirestore(), EDM_COLLECTIONS.supplierDocs), payload);
  }
  if (isRegulatoryDocument(doc)) {
    await addDoc(collection(getFirebaseFirestore(), EDM_COLLECTIONS.regulatoryDocs), payload);
  }
  if (isStandardsDocument(doc)) {
    await addDoc(collection(getFirebaseFirestore(), EDM_COLLECTIONS.standardsDocs), payload);
  }
}

export async function registerExternalDocument(input: RegisterExternalDocumentInput, actor: ExternalDocumentActor): Promise<ExternalDocumentRecord> {
  const docNumber = await generateDocNumber();
  const timestamp = now();
  const today = timestamp.split('T')[0];
  const nextReview = addMonthsToDate(today, frequencyToMonths(input.review_frequency));

  const payload = {
    external_document_id: docNumber,
    document_number: docNumber,
    module: EDM_MODULE,
    external_reference_number: input.external_reference_number,
    title: input.title,
    short_title: input.short_title || input.title.slice(0, 50),
    document_type: input.document_type,
    document_category: input.document_category,
    source_organization: input.source_organization,
    source_contact: input.source_contact,
    source_url: input.source_url,
    issuing_authority: input.issuing_authority,
    publication_date: input.publication_date,
    revision_number: input.revision_number,
    revision_date: input.revision_date || today,
    current_version: input.revision_number,
    language: input.language,
    country_region: input.country_region,
    department_owner: input.department_owner,
    business_unit: input.business_unit,
    site: input.site,
    risk_classification: input.risk_classification,
    criticality: input.criticality,
    review_frequency: input.review_frequency,
    next_review_date: nextReview,
    status: 'Draft',
    approval_required: input.approval_required,
    distribution_required: input.distribution_required,
    training_required: input.training_required,
    linked_internal_documents: [],
    supplier: input.supplier,
    manufacturer: input.manufacturer,
    effective_date: input.effective_date,
    expiry_date: input.expiry_date,
    electronic_signature_required: input.electronic_signature_required,
    revision_available: false,
    owner_id: actor.id,
    owner_name: input.owner_name,
    created_by: actor.id,
    created_by_name: actor.name,
    updated_by: actor.id,
    updated_by_name: actor.name,
    created_at: timestamp,
    updated_at: timestamp,
  };

  const ref = await addDoc(collection(getFirebaseFirestore(), EDM_COLLECTIONS.documents), payload);

  await addDoc(collection(getFirebaseFirestore(), EDM_COLLECTIONS.versions), {
    version_id: `${docNumber}-v${input.revision_number}`,
    document_id: ref.id,
    revision_number: input.revision_number,
    revision_date: input.revision_date || today,
    change_summary: 'Initial registration',
    created_by: actor.id,
    created_by_name: actor.name,
    created_at: timestamp,
  });

  await addDoc(collection(getFirebaseFirestore(), EDM_COLLECTIONS.sources), {
    organization: input.source_organization,
    contact: input.source_contact,
    url: input.source_url,
    document_id: ref.id,
    created_at: timestamp,
  });

  const record = mapExternalDocumentRaw({ id: ref.id, ...payload });
  await syncSpecializedCollection(record, ref.id);
  await audit(actor, 'EXTERNAL_DOCUMENT_REGISTERED', ref.id, null, payload);
  await notify('Document Added', `${input.title} registered as ${docNumber}`, ref.id, ['document_controller']);
  return record;
}

export async function submitForReview(documentId: string, actor: ExternalDocumentActor): Promise<void> {
  const rec = await getExternalDocumentById(documentId);
  if (!rec) throw new Error('Document not found');
  if (!rec.title || !rec.source_organization) throw new Error('Title and source organization are required');

  await updateDoc(doc(getFirebaseFirestore(), EDM_COLLECTIONS.documents, documentId), {
    status: 'Pending Review',
    updated_at: now(),
    updated_by: actor.id,
    updated_by_name: actor.name,
  });
  await audit(actor, 'REVIEW_ASSIGNED', documentId, rec.status, 'Pending Review');
  await notify('Review Due', `${rec.document_number} submitted for review`, documentId, ['qa_manager']);
}

export async function approveExternalDocument(documentId: string, input: ApproveExternalDocumentInput, actor: ExternalDocumentActor): Promise<void> {
  const rec = await getExternalDocumentById(documentId);
  if (!rec) throw new Error('Document not found');
  if (rec.electronic_signature_required && !input.signature_meaning?.trim()) {
    throw new Error('Electronic signature required for approval');
  }

  const timestamp = now();
  const today = timestamp.split('T')[0];
  await updateDoc(doc(getFirebaseFirestore(), EDM_COLLECTIONS.documents, documentId), {
    status: 'Approved for Use',
    effective_date: rec.effective_date || today,
    updated_at: timestamp,
    updated_by: actor.id,
    updated_by_name: actor.name,
  });

  if (input.signature_meaning) {
    await audit(actor, 'ELECTRONIC_SIGNATURE_COMPLETED', documentId, null, { meaning: input.signature_meaning });
  }
  await audit(actor, 'DOCUMENT_APPROVED', documentId, 'Pending Review', 'Approved for Use', input.comments);
  await notify('Document Approved', `${rec.document_number} approved for use`, documentId, ['document_controller']);
}

export async function completeReview(reviewId: string, outcome: string, actor: ExternalDocumentActor): Promise<void> {
  const snap = await getDoc(doc(getFirebaseFirestore(), EDM_COLLECTIONS.reviews, reviewId));
  if (!snap.exists()) throw new Error('Review not found');
  const review = mapReviewRaw({ id: snap.id, ...snap.data() });
  const timestamp = now();

  await updateDoc(doc(getFirebaseFirestore(), EDM_COLLECTIONS.reviews, reviewId), {
    review_status: 'Completed',
    review_outcome: outcome,
    completed_at: timestamp,
  });

  const docRec = await getExternalDocumentById(review.document_id);
  if (docRec) {
    const nextReview = addMonthsToDate(timestamp.split('T')[0], frequencyToMonths(docRec.review_frequency));
    await updateDoc(doc(getFirebaseFirestore(), EDM_COLLECTIONS.documents, review.document_id), {
      status: ['Approved for Use', 'Effective'].includes(docRec.status) ? docRec.status : 'Effective',
      next_review_date: nextReview,
      updated_at: timestamp,
      updated_by: actor.id,
      updated_by_name: actor.name,
    });
  }
  await audit(actor, 'REVIEW_COMPLETED', reviewId, 'Pending', outcome);
}

export async function bulkAssignReview(input: BulkReviewAssignInput, actor: ExternalDocumentActor): Promise<number> {
  let count = 0;
  const timestamp = now();
  for (const docId of input.document_ids) {
    const rec = await getExternalDocumentById(docId);
    if (!rec) continue;
    const reviewId = `REV-${rec.document_number}-${Date.now()}`;
    await addDoc(collection(getFirebaseFirestore(), EDM_COLLECTIONS.reviews), {
      review_id: reviewId,
      document_id: docId,
      document_number: rec.document_number,
      reviewer_id: input.reviewer_id,
      reviewer_name: input.reviewer_name,
      review_due_date: input.review_due_date,
      review_status: 'Pending',
      review_outcome: null,
      completed_at: null,
      created_at: timestamp,
    });
    await updateDoc(doc(getFirebaseFirestore(), EDM_COLLECTIONS.documents, docId), {
      status: 'Pending Review',
      updated_at: timestamp,
    });
    await audit(actor, 'REVIEW_ASSIGNED', docId, null, { reviewer: input.reviewer_name });
    count++;
  }
  return count;
}

export async function addDocumentVersion(documentId: string, input: NewVersionInput, actor: ExternalDocumentActor): Promise<void> {
  const rec = await getExternalDocumentById(documentId);
  if (!rec) throw new Error('Document not found');
  const timestamp = now();

  await addDoc(collection(getFirebaseFirestore(), EDM_COLLECTIONS.versions), {
    version_id: `${rec.document_number}-v${input.revision_number}`,
    document_id: documentId,
    revision_number: input.revision_number,
    revision_date: input.revision_date,
    change_summary: input.change_summary,
    created_by: actor.id,
    created_by_name: actor.name,
    created_at: timestamp,
  });

  await updateDoc(doc(getFirebaseFirestore(), EDM_COLLECTIONS.documents, documentId), {
    revision_number: input.revision_number,
    revision_date: input.revision_date,
    current_version: input.revision_number,
    revision_available: false,
    status: rec.status === 'Effective' ? 'Pending Review' : rec.status,
    updated_at: timestamp,
    updated_by: actor.id,
    updated_by_name: actor.name,
  });
  await audit(actor, 'REVISION_DETECTED', documentId, rec.revision_number, input.revision_number, input.change_summary);
  await notify('Revision Available', `${rec.document_number} updated to v${input.revision_number}`, documentId, ['document_controller']);
}

export async function linkInternalDocument(input: LinkInternalDocumentInput, actor: ExternalDocumentActor): Promise<void> {
  const ext = await getExternalDocumentById(input.external_document_id);
  if (!ext) throw new Error('External document not found');
  const internal = await getDocumentById(input.internal_document_id);
  if (!internal) throw new Error('Internal document not found');

  const link: LinkedInternalDocument = {
    id: `${input.external_document_id}-${input.internal_document_id}`,
    internal_document_id: internal.id,
    internal_document_number: internal.document_number,
    internal_document_title: internal.document_title,
    link_type: input.link_type,
    linked_at: now(),
  };

  const links = [...ext.linked_internal_documents.filter((l) => l.internal_document_id !== internal.id), link];
  await updateDoc(doc(getFirebaseFirestore(), EDM_COLLECTIONS.documents, input.external_document_id), {
    linked_internal_documents: links,
    updated_at: now(),
    updated_by: actor.id,
    updated_by_name: actor.name,
  });

  await addDoc(collection(getFirebaseFirestore(), EDM_COLLECTIONS.linkedInternal), {
    external_document_id: input.external_document_id,
    internal_document_id: internal.id,
    internal_document_number: internal.document_number,
    link_type: input.link_type,
    created_at: now(),
  });
  await audit(actor, 'DOCUMENT_LINKED', input.external_document_id, null, link);
}

export async function markObsolete(documentId: string, actor: ExternalDocumentActor): Promise<void> {
  const rec = await getExternalDocumentById(documentId);
  if (!rec) throw new Error('Document not found');
  await updateDoc(doc(getFirebaseFirestore(), EDM_COLLECTIONS.documents, documentId), {
    status: 'Obsolete',
    updated_at: now(),
    updated_by: actor.id,
    updated_by_name: actor.name,
  });
  await audit(actor, 'DOCUMENT_ARCHIVED', documentId, rec.status, 'Obsolete');
  await notify('Document Superseded', `${rec.document_number} marked obsolete`, documentId, ['document_controller']);
}

export async function monitorReviewDueDates(actor: ExternalDocumentActor): Promise<{ due: number; expired: number }> {
  const docs = await listAllExternalDocuments();
  const today = now().split('T')[0];
  let due = 0;
  let expired = 0;

  for (const d of docs) {
    if (!d.next_review_date || ['Obsolete', 'Archived', 'Superseded'].includes(d.status)) continue;
    const days = Math.ceil((new Date(`${d.next_review_date}T12:00:00`).getTime() - Date.now()) / 86400000);
    if (days > 0 && days <= 30) {
      due++;
      await notify('Review Due', `${d.document_number} review due ${d.next_review_date}`, d.id, ['document_controller']);
    }
    if (d.expiry_date && d.expiry_date <= today && d.status !== 'Expired') {
      await updateDoc(doc(getFirebaseFirestore(), EDM_COLLECTIONS.documents, d.id), {
        status: 'Expired',
        updated_at: now(),
      });
      expired++;
      await notify('Document Expiring', `${d.document_number} has expired`, d.id, ['document_controller']);
    }
  }
  return { due, expired };
}

export async function generateReviewTasks(actor: ExternalDocumentActor): Promise<number> {
  const docs = await listAllExternalDocuments();
  const reviews = await listAllReviews();
  const pendingDocIds = new Set(reviews.filter((r) => r.review_status === 'Pending').map((r) => r.document_id));
  let created = 0;
  const timestamp = now();
  const dueDate = addMonthsToDate(timestamp.split('T')[0], 1);

  for (const d of docs) {
    if (!d.next_review_date || pendingDocIds.has(d.id)) continue;
    const days = Math.ceil((new Date(`${d.next_review_date}T12:00:00`).getTime() - Date.now()) / 86400000);
    if (days > 30 || days < 0) continue;
    await addDoc(collection(getFirebaseFirestore(), EDM_COLLECTIONS.reviews), {
      review_id: `REV-${d.document_number}-${Date.now()}`,
      document_id: d.id,
      document_number: d.document_number,
      reviewer_id: d.owner_id,
      reviewer_name: d.owner_name,
      review_due_date: d.next_review_date,
      review_status: 'Pending',
      created_at: timestamp,
    });
    created++;
  }
  return created;
}

export async function processScheduledExternalDocJobs(actor: ExternalDocumentActor) {
  const review = await monitorReviewDueDates(actor);
  const tasks = await generateReviewTasks(actor);
  return { review, tasks };
}

export async function fetchExternalDocumentDashboardData(filters?: ExternalDocumentFilters) {
  await processScheduledExternalDocJobs({ id: 'system', name: 'System', role: 'system' });
  let records = await listAllExternalDocuments();
  const reviews = await listAllReviews();
  if (filters) records = filterExternalDocuments(records, filters);

  if (filters?.department_only) {
    // already applied in filterExternalDocuments
  }

  return {
    records,
    reviews,
    metrics: computeExternalKpis(records, reviews),
    charts: computeExternalCharts(records, reviews),
  };
}

export async function getExternalDocumentById(id: string): Promise<ExternalDocumentRecord | null> {
  const snap = await getDoc(doc(getFirebaseFirestore(), EDM_COLLECTIONS.documents, id));
  if (!snap.exists()) return null;
  return mapExternalDocumentRaw({ id: snap.id, ...snap.data() });
}

export async function getDocumentVersions(documentId: string) {
  const snap = await getDocs(query(
    collection(getFirebaseFirestore(), EDM_COLLECTIONS.versions),
    where('document_id', '==', documentId),
    limit(50),
  ));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export function exportExternalDocumentsCsv(records: ExternalDocumentRecord[]) {
  downloadCsv('external-documents.csv',
    ['Document #', 'Title', 'Type', 'Category', 'Source', 'Status', 'Next Review', 'Department'],
    records.map((r) => [
      r.document_number, r.title, r.document_type, r.document_category,
      r.source_organization, r.status, r.next_review_date || '', r.department_owner,
    ]),
  );
}

export function exportExternalDocumentsExcel(records: ExternalDocumentRecord[]) {
  exportExternalDocumentsCsv(records);
}

export async function logExternalDashboardViewed(actor: ExternalDocumentActor) {
  await audit(actor, 'DASHBOARD_VIEWED', 'external-document-dashboard', null, null);
}

export async function logExternalExported(actor: ExternalDocumentActor, format: string, count: number) {
  await audit(actor, 'EXPORT', 'external-document-dashboard', null, { format, count });
}

export async function runScheduledExternalDocumentJobs() {
  return processScheduledExternalDocJobs({ id: 'scheduler', name: 'Scheduled Job', role: 'system' });
}

export async function bulkImportDocuments(inputs: RegisterExternalDocumentInput[], actor: ExternalDocumentActor): Promise<number> {
  let count = 0;
  for (const input of inputs) {
    try {
      await registerExternalDocument(input, actor);
      count++;
    } catch { /* skip */ }
  }
  return count;
}
