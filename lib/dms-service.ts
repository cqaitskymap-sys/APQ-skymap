import {
  addDoc, collection, doc, getDoc, getDocs, limit, orderBy, query, updateDoc, where,
  type QueryConstraint,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getFirebaseFirestore, getFirebaseStorage } from '@/lib/firebase';
import { logAuditEvent, generateDocumentNumber } from '@/lib/admin/admin-service';
import { downloadCsv } from '@/lib/export-utils';
import {
  DMS_COLLECTIONS, DOCUMENT_TYPE_PREFIX, type DocumentRecord, type DocumentRevision,
  type DocumentApproval, type DocumentDistribution, type DocumentTrainingLink,
  type DocumentAttachment, type DmsFilters, type DmsDashboardMetrics, type DmsActor,
  isReviewDue, canOnlyViewEffective,
} from './dms-types';
import type {
  DocumentCreateInput, DocumentUpdateInput, DocumentApprovalInput,
  DocumentRevisionInput, DistributionInput,
} from './dms-schemas';

function now() { return new Date().toISOString(); }

async function audit(actor: DmsActor, action: string, recordId: string, oldValue: unknown, newValue: unknown, reason = '') {
  await logAuditEvent({
    userId: actor.id, userName: actor.name, module: 'DMS', recordId, action,
    oldValue: oldValue ? JSON.stringify(oldValue) : '',
    newValue: newValue ? JSON.stringify(newValue) : '',
    reason, ipAddress: 'client', device: typeof navigator !== 'undefined' ? navigator.userAgent : 'server',
    status: 'Success',
  });
}

async function notify(title: string, message: string, recordId: string, roles: string[]) {
  try {
    for (const role of roles) {
      await addDoc(collection(getFirebaseFirestore(), DMS_COLLECTIONS.notifications), {
        title, message, module: 'DMS', record_id: recordId, target_role: role,
        read: false, created_at: now(),
      });
    }
  } catch (e) { console.error('Notification failed:', e); }
}

export async function generateDmsDocumentNumber(documentType: string): Promise<string> {
  const prefix = DOCUMENT_TYPE_PREFIX[documentType] || 'DOC';
  const adminNumber = await generateDocumentNumber(prefix);
  if (adminNumber) return adminNumber;

  const year = new Date().getFullYear();
  const docPrefix = `${prefix}-${year}-`;
  try {
    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), DMS_COLLECTIONS.documents),
      where('document_number', '>=', docPrefix),
      where('document_number', '<=', `${docPrefix}\uf8ff`),
      orderBy('document_number', 'desc'),
      limit(1),
    ));
    if (!snap.empty) {
      const last = snap.docs[0].data().document_number as string;
      return `${docPrefix}${String(parseInt(last.split('-').pop() || '0', 10) + 1).padStart(4, '0')}`;
    }
  } catch {
    const all = await getDocs(collection(getFirebaseFirestore(), DMS_COLLECTIONS.documents));
    return `${docPrefix}${String(all.size + 1).padStart(4, '0')}`;
  }
  return `${docPrefix}0001`;
}

async function isDocumentNumberUnique(number: string, excludeId?: string): Promise<boolean> {
  const snap = await getDocs(query(
    collection(getFirebaseFirestore(), DMS_COLLECTIONS.documents),
    where('document_number', '==', number),
    limit(5),
  ));
  return snap.docs.every((d) => d.id === excludeId);
}

export async function createDocument(input: DocumentCreateInput, actor: DmsActor): Promise<DocumentRecord> {
  const documentNumber = await generateDmsDocumentNumber(input.document_type);
  const timestamp = now();

  const record: Omit<DocumentRecord, 'id'> = {
    document_number: documentNumber,
    document_title: input.document_title,
    document_type: input.document_type,
    department: input.department,
    product_name: input.product_name || '',
    version: input.version,
    effective_date: input.effective_date || null,
    next_review_date: input.next_review_date || null,
    prepared_by: actor.id,
    prepared_by_name: input.prepared_by_name,
    reviewed_by: '',
    reviewed_by_name: '',
    approved_by: '',
    approved_by_name: '',
    status: 'draft',
    change_control_ref: input.change_control_ref || '',
    change_control_id: input.change_control_id || null,
    supersedes_document_no: input.supersedes_document_no || '',
    supersedes_document_id: input.supersedes_document_id || null,
    reason_for_revision: input.reason_for_revision || '',
    remarks: input.remarks || '',
    is_latest: true,
    parent_document_id: null,
    revision_number: 1,
    training_required: false,
    linked_pqr_id: input.linked_pqr_id || null,
    linked_cpv_id: input.linked_cpv_id || null,
    created_by: actor.id,
    created_by_name: actor.name,
    updated_by: actor.id,
    updated_by_name: actor.name,
    created_at: timestamp,
    updated_at: timestamp,
  };

  const refDoc = await addDoc(collection(getFirebaseFirestore(), DMS_COLLECTIONS.documents), record);
  await audit(actor, 'CREATE', refDoc.id, null, record);
  return { id: refDoc.id, ...record };
}

export async function getDocumentById(id: string): Promise<DocumentRecord | null> {
  const snap = await getDoc(doc(getFirebaseFirestore(), DMS_COLLECTIONS.documents, id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as DocumentRecord;
}

export async function listDocuments(filters?: DmsFilters, actorRole?: string): Promise<DocumentRecord[]> {
  const constraints: QueryConstraint[] = [];
  if (filters?.status) constraints.push(where('status', '==', filters.status));
  if (filters?.document_type) constraints.push(where('document_type', '==', filters.document_type));
  if (filters?.department) constraints.push(where('department', '==', filters.department));
  if (filters?.effectiveOnly) constraints.push(where('status', '==', 'effective'));
  if (filters?.obsoleteOnly) constraints.push(where('status', '==', 'obsolete'));
  constraints.push(orderBy('updated_at', 'desc'));

  let records: DocumentRecord[];
  try {
    const snap = await getDocs(query(collection(getFirebaseFirestore(), DMS_COLLECTIONS.documents), ...constraints));
    records = snap.docs.map((d) => ({ id: d.id, ...d.data() } as DocumentRecord));
  } catch {
    const snap = await getDocs(collection(getFirebaseFirestore(), DMS_COLLECTIONS.documents));
    records = snap.docs.map((d) => ({ id: d.id, ...d.data() } as DocumentRecord));
  }

  if (actorRole && canOnlyViewEffective(actorRole)) {
    records = records.filter((r) => r.status === 'effective' && r.is_latest);
  } else if (!filters?.obsoleteOnly) {
    records = records.filter((r) => r.is_latest !== false);
  }

  if (filters?.reviewDue) {
    records = records.filter((r) => isReviewDue(r.next_review_date));
  }
  if (filters?.search) {
    const q = filters.search.toLowerCase();
    records = records.filter((r) =>
      r.document_number.toLowerCase().includes(q) ||
      r.document_title.toLowerCase().includes(q) ||
      r.product_name.toLowerCase().includes(q),
    );
  }
  return records;
}

export async function updateDocument(id: string, input: DocumentUpdateInput, actor: DmsActor): Promise<DocumentRecord> {
  const existing = await getDocumentById(id);
  if (!existing) throw new Error('Document not found');
  if (!['draft', 'returned_for_correction'].includes(existing.status)) {
    throw new Error('Document cannot be edited in current status');
  }

  const updates = {
    ...input,
    updated_by: actor.id,
    updated_by_name: actor.name,
    updated_at: now(),
  };
  await updateDoc(doc(getFirebaseFirestore(), DMS_COLLECTIONS.documents, id), updates);
  await audit(actor, 'EDIT', id, existing, { ...existing, ...updates });
  return { ...existing, ...updates } as DocumentRecord;
}

export async function uploadAttachment(
  documentId: string, file: File, actor: DmsActor,
): Promise<DocumentAttachment> {
  const path = `dms/${documentId}/${Date.now()}_${file.name}`;
  const storageRef = ref(getFirebaseStorage(), path);
  await uploadBytes(storageRef, file);
  const downloadUrl = await getDownloadURL(storageRef);

  const attachment: Omit<DocumentAttachment, 'id'> = {
    document_id: documentId,
    file_name: file.name,
    file_type: file.type,
    file_size: file.size,
    storage_path: path,
    download_url: downloadUrl,
    uploaded_by: actor.id,
    uploaded_by_name: actor.name,
    uploaded_at: now(),
  };

  const refDoc = await addDoc(collection(getFirebaseFirestore(), DMS_COLLECTIONS.attachments), attachment);
  await audit(actor, 'UPLOAD', documentId, null, { file_name: file.name });
  return { id: refDoc.id, ...attachment };
}

export async function getAttachments(documentId: string): Promise<DocumentAttachment[]> {
  try {
    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), DMS_COLLECTIONS.attachments),
      where('document_id', '==', documentId),
      orderBy('uploaded_at', 'desc'),
    ));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as DocumentAttachment));
  } catch {
    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), DMS_COLLECTIONS.attachments),
      where('document_id', '==', documentId),
    ));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as DocumentAttachment));
  }
}

export async function submitForReview(documentId: string, actor: DmsActor, comments = ''): Promise<DocumentRecord> {
  const existing = await getDocumentById(documentId);
  if (!existing) throw new Error('Document not found');
  if (!['draft', 'returned_for_correction'].includes(existing.status)) {
    throw new Error('Document cannot be submitted in current status');
  }

  const attachments = await getAttachments(documentId);
  if (attachments.length === 0) throw new Error('Attachment required before submission');

  const updates = {
    status: 'under_review',
    updated_by: actor.id,
    updated_by_name: actor.name,
    updated_at: now(),
  };
  await updateDoc(doc(getFirebaseFirestore(), DMS_COLLECTIONS.documents, documentId), updates);

  await addDoc(collection(getFirebaseFirestore(), DMS_COLLECTIONS.approvals), {
    document_id: documentId,
    stage: 'department_review',
    reviewer_id: actor.id,
    reviewer_name: actor.name,
    decision: 'pending',
    comments,
    signed_at: null,
    created_at: now(),
  });

  await audit(actor, 'SUBMIT_REVIEW', documentId, existing, updates, comments);
  await notify('Document Submitted', `${existing.document_number} submitted for review`, documentId, ['qa_manager', 'head_qa']);
  return { ...existing, ...updates };
}

export async function processApproval(
  documentId: string, input: DocumentApprovalInput, actor: DmsActor,
): Promise<DocumentRecord> {
  const existing = await getDocumentById(documentId);
  if (!existing) throw new Error('Document not found');

  const attachments = await getAttachments(documentId);
  if (input.decision === 'approved' && attachments.length === 0) {
    throw new Error('Attachment required before approval');
  }

  const approvalEntry = {
    document_id: documentId,
    stage: input.stage,
    reviewer_id: actor.id,
    reviewer_name: actor.name,
    decision: input.decision,
    comments: input.comments,
    signed_at: now(),
    created_at: now(),
  };
  await addDoc(collection(getFirebaseFirestore(), DMS_COLLECTIONS.approvals), approvalEntry);

  let newStatus = existing.status;
  const updates: Partial<DocumentRecord> = {
    updated_by: actor.id,
    updated_by_name: actor.name,
    updated_at: now(),
  };

  if (input.decision === 'returned' || input.decision === 'rejected') {
    newStatus = 'returned_for_correction';
    updates.reviewed_by = actor.id;
    updates.reviewed_by_name = actor.name;
  } else if (input.decision === 'approved') {
    if (input.stage === 'department_review') {
      updates.reviewed_by = actor.id;
      updates.reviewed_by_name = actor.name;
      await addDoc(collection(getFirebaseFirestore(), DMS_COLLECTIONS.approvals), {
        document_id: documentId, stage: 'qa_review', reviewer_id: '', reviewer_name: '',
        decision: 'pending', comments: '', signed_at: null, created_at: now(),
      });
    } else if (input.stage === 'qa_review') {
      await addDoc(collection(getFirebaseFirestore(), DMS_COLLECTIONS.approvals), {
        document_id: documentId, stage: 'head_qa_approval', reviewer_id: '', reviewer_name: '',
        decision: 'pending', comments: '', signed_at: null, created_at: now(),
      });
    } else if (input.stage === 'head_qa_approval') {
      if (!existing.effective_date) throw new Error('Effective date required before final approval');
      newStatus = 'approved';
      updates.approved_by = actor.id;
      updates.approved_by_name = actor.name;
    }
  }

  updates.status = newStatus;
  await updateDoc(doc(getFirebaseFirestore(), DMS_COLLECTIONS.documents, documentId), updates);
  await audit(actor, input.decision === 'rejected' ? 'REJECTION' : 'APPROVAL', documentId, existing, updates, input.comments);

  if (newStatus === 'approved') {
    await syncEffectiveDocuments();
  }

  return { ...existing, ...updates } as DocumentRecord;
}

export async function syncEffectiveDocuments(): Promise<number> {
  const today = new Date().toISOString().split('T')[0];
  const snap = await getDocs(query(
    collection(getFirebaseFirestore(), DMS_COLLECTIONS.documents),
    where('status', '==', 'approved'),
  ));
  let count = 0;

  for (const d of snap.docs) {
    const data = d.data() as DocumentRecord;
    if (data.effective_date && data.effective_date <= today) {
      await updateDoc(d.ref, { status: 'effective', updated_at: now() });
      await audit(
        { id: 'system', name: 'System', role: 'system' },
        'EFFECTIVE', d.id, data, { status: 'effective' },
      );

      if (data.supersedes_document_id) {
        await obsoletePreviousRevision(data.supersedes_document_id, d.id);
      }
      if (data.parent_document_id) {
        await obsoletePreviousRevision(data.parent_document_id, d.id);
      }
      count++;
    }
  }
  return count;
}

async function obsoletePreviousRevision(oldDocId: string, newDocId: string) {
  const oldDoc = await getDocumentById(oldDocId);
  if (!oldDoc || oldDoc.status === 'obsolete') return;

  await updateDoc(doc(getFirebaseFirestore(), DMS_COLLECTIONS.documents, oldDocId), {
    status: 'obsolete', is_latest: false, updated_at: now(),
  });
  await audit(
    { id: 'system', name: 'System', role: 'system' },
    'OBSOLETE', oldDocId, oldDoc, { status: 'obsolete', superseded_by: newDocId },
  );
}

export async function createRevision(
  parentId: string, input: DocumentRevisionInput, actor: DmsActor,
): Promise<DocumentRecord> {
  const parent = await getDocumentById(parentId);
  if (!parent) throw new Error('Parent document not found');
  if (!['effective', 'approved', 'obsolete'].includes(parent.status)) {
    throw new Error('Only effective or approved documents can be revised');
  }

  const unique = await isDocumentNumberUnique(parent.document_number);
  if (!unique) throw new Error('Document number conflict');

  await addDoc(collection(getFirebaseFirestore(), DMS_COLLECTIONS.revisions), {
    document_id: parentId,
    document_number: parent.document_number,
    version: parent.version,
    revision_number: parent.revision_number,
    reason_for_revision: input.reason_for_revision,
    effective_date: parent.effective_date,
    status: parent.status,
    created_by: actor.id,
    created_by_name: actor.name,
    created_at: now(),
  });

  await updateDoc(doc(getFirebaseFirestore(), DMS_COLLECTIONS.documents, parentId), { is_latest: false, updated_at: now() });

  const timestamp = now();
  const newRevision = parent.revision_number + 1;
  const record: Omit<DocumentRecord, 'id'> = {
    document_number: parent.document_number,
    document_title: parent.document_title,
    document_type: parent.document_type,
    department: parent.department,
    product_name: parent.product_name,
    version: input.version,
    effective_date: input.effective_date || null,
    next_review_date: input.next_review_date || null,
    prepared_by: actor.id,
    prepared_by_name: actor.name,
    reviewed_by: '',
    reviewed_by_name: '',
    approved_by: '',
    approved_by_name: '',
    status: 'draft',
    change_control_ref: input.change_control_ref || parent.change_control_ref,
    change_control_id: input.change_control_id || parent.change_control_id,
    supersedes_document_no: parent.document_number,
    supersedes_document_id: parentId,
    reason_for_revision: input.reason_for_revision,
    remarks: input.remarks || '',
    is_latest: true,
    parent_document_id: parentId,
    revision_number: newRevision,
    training_required: true,
    linked_pqr_id: parent.linked_pqr_id,
    linked_cpv_id: parent.linked_cpv_id,
    created_by: actor.id,
    created_by_name: actor.name,
    updated_by: actor.id,
    updated_by_name: actor.name,
    created_at: timestamp,
    updated_at: timestamp,
  };

  const refDoc = await addDoc(collection(getFirebaseFirestore(), DMS_COLLECTIONS.documents), record);
  await audit(actor, 'REVISION', refDoc.id, parent, record, input.reason_for_revision);
  await createTrainingRequirement(refDoc.id, { ...record, id: refDoc.id });
  await notify('Document Revised', `${parent.document_number} rev ${input.version} created — training required`, refDoc.id, ['qa_manager', 'head_qa']);
  return { id: refDoc.id, ...record };
}

async function createTrainingRequirement(documentId: string, doc: DocumentRecord) {
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 30);
  await addDoc(collection(getFirebaseFirestore(), DMS_COLLECTIONS.trainingLinks), {
    document_id: documentId,
    document_number: doc.document_number,
    document_title: doc.document_title,
    training_title: `Training: ${doc.document_title} (${doc.version})`,
    target_department: doc.department,
    status: 'pending',
    due_date: dueDate.toISOString().split('T')[0],
    created_at: now(),
  });
}

export async function getRevisions(documentId: string): Promise<DocumentRevision[]> {
  const docRecord = await getDocumentById(documentId);
  const rootId = docRecord?.parent_document_id || documentId;

  try {
    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), DMS_COLLECTIONS.revisions),
      where('document_id', '==', rootId),
      orderBy('created_at', 'desc'),
    ));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as DocumentRevision));
  } catch {
    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), DMS_COLLECTIONS.revisions),
      where('document_id', '==', rootId),
    ));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as DocumentRevision));
  }
}

export async function getApprovals(documentId: string): Promise<DocumentApproval[]> {
  try {
    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), DMS_COLLECTIONS.approvals),
      where('document_id', '==', documentId),
      orderBy('created_at', 'asc'),
    ));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as DocumentApproval));
  } catch {
    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), DMS_COLLECTIONS.approvals),
      where('document_id', '==', documentId),
    ));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as DocumentApproval));
  }
}

export async function getDistribution(documentId: string): Promise<DocumentDistribution[]> {
  try {
    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), DMS_COLLECTIONS.distribution),
      where('document_id', '==', documentId),
      orderBy('distributed_at', 'desc'),
    ));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as DocumentDistribution));
  } catch {
    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), DMS_COLLECTIONS.distribution),
      where('document_id', '==', documentId),
    ));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as DocumentDistribution));
  }
}

export async function addDistribution(documentId: string, input: DistributionInput, actor: DmsActor): Promise<DocumentDistribution> {
  const entry: Omit<DocumentDistribution, 'id'> = {
    document_id: documentId,
    department: input.department,
    user_id: actor.id,
    user_name: input.user_name,
    distributed_at: now(),
    acknowledged: false,
    acknowledged_at: null,
  };
  const refDoc = await addDoc(collection(getFirebaseFirestore(), DMS_COLLECTIONS.distribution), entry);
  await audit(actor, 'DISTRIBUTE', documentId, null, entry);
  return { id: refDoc.id, ...entry };
}

export async function getTrainingLinks(documentId: string): Promise<DocumentTrainingLink[]> {
  try {
    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), DMS_COLLECTIONS.trainingLinks),
      where('document_id', '==', documentId),
      orderBy('created_at', 'desc'),
    ));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as DocumentTrainingLink));
  } catch {
    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), DMS_COLLECTIONS.trainingLinks),
      where('document_id', '==', documentId),
    ));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as DocumentTrainingLink));
  }
}

export async function getAuditLogsForDocument(documentId: string): Promise<Record<string, unknown>[]> {
  try {
    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), DMS_COLLECTIONS.auditLogs),
      where('recordId', '==', documentId),
      where('module', '==', 'DMS'),
      orderBy('dateTime', 'desc'),
      limit(100),
    ));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch {
    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), DMS_COLLECTIONS.auditLogs),
      where('recordId', '==', documentId),
      limit(100),
    ));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }
}

export async function trackDownload(documentId: string, fileName: string, actor: DmsActor) {
  await audit(actor, 'DOWNLOAD', documentId, null, { file_name: fileName });
}

export async function trackPrint(documentId: string, actor: DmsActor) {
  await audit(actor, 'PRINT', documentId, null, { action: 'print' });
}

export async function syncReviewDueNotifications(): Promise<number> {
  const snap = await getDocs(query(
    collection(getFirebaseFirestore(), DMS_COLLECTIONS.documents),
    where('status', '==', 'effective'),
  ));
  let count = 0;
  for (const d of snap.docs) {
    const data = d.data() as DocumentRecord;
    if (isReviewDue(data.next_review_date, 30)) {
      await notify(
        'Document Review Due',
        `${data.document_number} review due by ${data.next_review_date}`,
        d.id,
        ['qa_manager', 'head_qa'],
      );
      count++;
    }
  }
  return count;
}

export async function listChangeControlsForLink(): Promise<{ id: string; number: string; title: string }[]> {
  try {
    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), DMS_COLLECTIONS.changeControls),
      orderBy('updated_at', 'desc'),
      limit(50,
    )));
    return snap.docs.map((d) => ({
      id: d.id,
      number: d.data().change_control_number as string,
      title: d.data().change_title as string,
    }));
  } catch {
    return [];
  }
}

export function computeDashboardMetrics(records: DocumentRecord[]): DmsDashboardMetrics {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  return {
    total: records.length,
    draft: records.filter((r) => r.status === 'draft').length,
    underReview: records.filter((r) => r.status === 'under_review').length,
    effective: records.filter((r) => r.status === 'effective').length,
    obsolete: records.filter((r) => r.status === 'obsolete').length,
    reviewDue: records.filter((r) => r.status === 'effective' && isReviewDue(r.next_review_date)).length,
    recentRevisions: records.filter((r) => new Date(r.created_at) >= thirtyDaysAgo && r.revision_number > 1).length,
    trainingPending: 0,
  };
}

export async function computeTrainingPending(): Promise<number> {
  try {
    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), DMS_COLLECTIONS.trainingLinks),
      where('status', '==', 'pending'),
    ));
    return snap.size;
  } catch {
    return 0;
  }
}

export function dmsChartData(records: DocumentRecord[]) {
  const byDept: Record<string, number> = {};
  const byType: Record<string, number> = {};
  const monthlyRevisions: Record<string, number> = {};
  const reviewDueTrend: Record<string, number> = {};

  for (const r of records) {
    byDept[r.department] = (byDept[r.department] || 0) + 1;
    byType[r.document_type] = (byType[r.document_type] || 0) + 1;

    const month = r.created_at.slice(0, 7);
    if (r.revision_number > 1) monthlyRevisions[month] = (monthlyRevisions[month] || 0) + 1;

    if (r.next_review_date && isReviewDue(r.next_review_date, 90)) {
      const rm = r.next_review_date.slice(0, 7);
      reviewDueTrend[rm] = (reviewDueTrend[rm] || 0) + 1;
    }
  }

  const toChart = (obj: Record<string, number>) =>
    Object.entries(obj).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

  return {
    byDepartment: toChart(byDept),
    byType: toChart(byType),
    monthlyRevisions: Object.entries(monthlyRevisions).sort().map(([month, count]) => ({ month, count })),
    reviewDueTrend: Object.entries(reviewDueTrend).sort().map(([month, count]) => ({ month, count })),
  };
}

export async function exportDocumentsCsv(records: DocumentRecord[]) {
  downloadCsv(
    `dms-documents-${new Date().toISOString().split('T')[0]}.csv`,
    ['Document Number', 'Title', 'Type', 'Department', 'Version', 'Status', 'Effective Date', 'Next Review', 'Prepared By'],
    records.map((r) => [
      r.document_number, r.document_title, r.document_type, r.department, r.version,
      r.status, r.effective_date || '', r.next_review_date || '', r.prepared_by_name,
    ]),
  );
}

export async function archiveDocument(documentId: string, actor: DmsActor): Promise<DocumentRecord> {
  const existing = await getDocumentById(documentId);
  if (!existing) throw new Error('Document not found');
  if (existing.status !== 'obsolete') throw new Error('Only obsolete documents can be archived');

  const updates = { status: 'archived', updated_by: actor.id, updated_by_name: actor.name, updated_at: now() };
  await updateDoc(doc(getFirebaseFirestore(), DMS_COLLECTIONS.documents, documentId), updates);
  await audit(actor, 'ARCHIVE', documentId, existing, updates);
  return { ...existing, ...updates } as DocumentRecord;
}
