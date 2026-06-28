import {
  addDoc, collection, doc, getDoc, getDocs, limit, orderBy, query, setDoc, updateDoc, where,
} from 'firebase/firestore';
import { getFirebaseFirestore } from '@/lib/firebase';
import { logAuditEvent } from '@/lib/admin/admin-service';
import { downloadCsv } from '@/lib/export-utils';
import {
  listDocuments, getDocumentById, createRevision, syncEffectiveDocuments, submitForReview,
} from '@/lib/dms-service';
import type { DocumentRecord, DmsActor } from '@/lib/dms-types';
import type {
  DocumentVersionRecord, VersionControlFilters, VersionControlActor,
} from './document-version-control-types';
import {
  mapDocumentToVersion, mapVersionRaw, computeVersionKpis, computeVersionCharts,
  filterVersionRecords, emptyVersionKpis, emptyVersionCharts, buildVersionLineage,
} from './document-version-control-records';
import type { RevisionCreateInput, RollbackInput } from './document-version-control-schemas';
import { validateUniqueVersion } from './document-version-control-schemas';
import {
  VC_COLLECTIONS, incrementVersionNumber, canViewHistoricalOnly, parseVersionNumber,
} from './document-version-control-types';

function now() { return new Date().toISOString(); }

async function audit(actor: VersionControlActor, action: string, recordId: string, oldValue: unknown, newValue: unknown, reason = '') {
  await logAuditEvent({
    userId: actor.id, userName: actor.name, module: 'Version Control', recordId, action,
    oldValue: oldValue ? JSON.stringify(oldValue) : '',
    newValue: newValue ? JSON.stringify(newValue) : '',
    reason, ipAddress: 'client', device: typeof navigator !== 'undefined' ? navigator.userAgent : 'server',
    status: 'Success',
  });
}

async function notify(title: string, message: string, recordId: string, roles: string[]) {
  try {
    for (const role of roles) {
      await addDoc(collection(getFirebaseFirestore(), VC_COLLECTIONS.notifications), {
        title, message, module: 'Version Control', record_id: recordId, target_role: role, read: false, created_at: now(),
      });
    }
  } catch (e) { console.error('Version control notification failed:', e); }
}

async function loadVersionMetaMap(): Promise<Map<string, Record<string, unknown>>> {
  const map = new Map<string, Record<string, unknown>>();
  try {
    const snap = await getDocs(collection(getFirebaseFirestore(), VC_COLLECTIONS.versions));
    for (const d of snap.docs) {
      const data = d.data();
      const docId = (data.document_id as string) || d.id;
      map.set(docId, { id: d.id, ...data });
    }
  } catch { /* empty */ }
  return map;
}

async function persistVersionRecord(record: Omit<DocumentVersionRecord, 'id'>, documentId: string): Promise<string> {
  const ref = doc(getFirebaseFirestore(), VC_COLLECTIONS.versions, documentId);
  await setDoc(ref, {
    version_id: record.version_id,
    version_number: record.version_number,
    major_version: record.major_version,
    minor_version: record.minor_version,
    revision_number: record.revision_number,
    document_id: documentId,
    document_number: record.document_number,
    document_title: record.document_title,
    document_type: record.document_type,
    department: record.department,
    previous_version: record.previous_version,
    next_version: record.next_version,
    current_effective_version: record.current_effective_version,
    revision_type: record.revision_type,
    revision_reason: record.revision_reason,
    change_summary: record.change_summary,
    change_control_id: record.change_control_id,
    training_required: record.training_required,
    electronic_signature_required: record.electronic_signature_required,
    review_required: record.review_required,
    approval_required: record.approval_required,
    status: record.status,
    author: record.author,
    author_name: record.author_name,
    is_latest: record.is_latest,
    is_effective: record.is_effective,
    parent_document_id: record.parent_document_id,
    rollback_status: record.rollback_status,
    created_by: record.created_by,
    created_by_name: record.created_by_name,
    updated_by: record.updated_by,
    updated_by_name: record.updated_by_name,
    created_at: record.created_at,
    updated_at: now(),
  }, { merge: true });
  return ref.id;
}

async function mergeVersionSources(role?: string): Promise<DocumentVersionRecord[]> {
  const docs = await listDocuments(undefined, role);
  const metaMap = await loadVersionMetaMap();

  const effectiveByNumber = new Map<string, string>();
  for (const d of docs) {
    if (d.status === 'effective') effectiveByNumber.set(d.document_number, d.version);
  }

  const records = docs.map((d) => {
    const meta = metaMap.get(d.id);
    const effectiveVersion = effectiveByNumber.get(d.document_number) || null;
    if (meta?.previous_version) {
      return mapDocumentToVersion(d, meta, effectiveVersion);
    }
    if (d.parent_document_id) {
      const parent = docs.find((x) => x.id === d.parent_document_id);
      const prevMeta = parent ? { previous_version: parent.version, revision_type: meta?.revision_type } : meta;
      return mapDocumentToVersion(d, prevMeta, effectiveVersion);
    }
    return mapDocumentToVersion(d, meta, effectiveVersion);
  });

  for (const r of records) {
    if (!metaMap.has(r.document_id)) {
      await persistVersionRecord(r, r.document_id);
    }
  }

  return records.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}

export async function fetchVersionControlDashboardData(filters?: VersionControlFilters, actor?: VersionControlActor) {
  await syncEffectiveDocuments();
  const role = actor?.role || '';
  let records = await mergeVersionSources(canViewHistoricalOnly(role) ? role : undefined);
  if (canViewHistoricalOnly(role)) {
    records = records.filter((r) => r.is_effective || r.status === 'Effective' || r.status === 'Superseded' || r.status === 'Archived');
  }
  if (filters) records = filterVersionRecords(records, filters);
  return { records, metrics: computeVersionKpis(records), charts: computeVersionCharts(records) };
}

export async function getVersionById(id: string): Promise<DocumentVersionRecord | null> {
  const docRecord = await getDocumentById(id);
  if (!docRecord) {
    const snap = await getDoc(doc(getFirebaseFirestore(), VC_COLLECTIONS.versions, id));
    if (snap.exists()) return mapVersionRaw({ id: snap.id, ...snap.data() });
    return null;
  }
  const metaSnap = await getDoc(doc(getFirebaseFirestore(), VC_COLLECTIONS.versions, id));
  const meta = metaSnap.exists() ? metaSnap.data() : undefined;
  return mapDocumentToVersion(docRecord, meta);
}

export async function getVersionLineage(documentNumber: string): Promise<DocumentVersionRecord[]> {
  const records = await mergeVersionSources();
  return buildVersionLineage(records, documentNumber);
}

export async function createDocumentRevision(input: RevisionCreateInput, actor: VersionControlActor): Promise<DocumentVersionRecord> {
  const parent = await getDocumentById(input.document_id);
  if (!parent) throw new Error('Document not found');
  if (!['effective', 'approved'].includes(parent.status)) {
    throw new Error('Only effective or approved documents can be revised');
  }

  const newVersion = incrementVersionNumber(parent.version, input.revision_type);
  const siblings = await getDocs(query(
    collection(getFirebaseFirestore(), VC_COLLECTIONS.documents),
    where('document_number', '==', parent.document_number),
  ));
  const existingVersions = siblings.docs.map((d) => (d.data() as DocumentRecord).version);
  const uniqueError = validateUniqueVersion(existingVersions, newVersion);
  if (uniqueError) throw new Error(uniqueError);

  const isMajor = input.revision_type === 'Major' || input.revision_type === 'Emergency';
  const trainingRequired = input.training_required ?? isMajor;

  const dmsActor: DmsActor = { id: actor.id, name: actor.name, role: actor.role };
  const revised = await createRevision(input.document_id, {
    version: newVersion,
    reason_for_revision: input.revision_reason,
    effective_date: input.effective_date || null,
    next_review_date: input.next_review_date || null,
    change_control_ref: input.change_control_id || parent.change_control_ref,
    change_control_id: input.change_control_id || null,
    supersedes_document_no: parent.document_number,
    remarks: input.change_summary,
  }, dmsActor);

  const vp = parseVersionNumber(newVersion);
  const versionRecord: Omit<DocumentVersionRecord, 'id'> = {
    version_id: revised.id,
    version_number: newVersion,
    major_version: vp.major,
    minor_version: vp.minor,
    revision_number: revised.revision_number,
    document_id: revised.id,
    document_number: revised.document_number,
    document_title: revised.document_title,
    document_type: revised.document_type,
    department: revised.department,
    previous_version: parent.version,
    next_version: null,
    current_effective_version: null,
    revision_type: input.revision_type,
    revision_reason: input.revision_reason,
    change_summary: input.change_summary,
    change_control_id: input.change_control_id || null,
    training_required: trainingRequired,
    electronic_signature_required: input.electronic_signature_required,
    review_required: input.review_required,
    approval_required: input.approval_required,
    status: 'Draft',
    author: actor.id,
    author_name: actor.name,
    reviewer: '', reviewer_name: '', approver: '', approver_name: '',
    is_latest: true,
    is_effective: false,
    parent_document_id: input.document_id,
    rollback_status: null,
    created_at: now(),
    updated_at: now(),
    created_by: actor.id,
    created_by_name: actor.name,
    updated_by: actor.id,
    updated_by_name: actor.name,
  };

  await persistVersionRecord(versionRecord, revised.id);

  await updateDoc(doc(getFirebaseFirestore(), VC_COLLECTIONS.versions, input.document_id), {
    next_version: newVersion,
    is_latest: false,
    status: parent.status === 'effective' ? 'Superseded' : mapDocumentToVersion(parent).status,
    updated_at: now(),
  });

  if (trainingRequired) {
    await addDoc(collection(getFirebaseFirestore(), VC_COLLECTIONS.trainingAssignments), {
      document_id: revised.id, document_number: revised.document_number,
      document_title: revised.document_title, document_version: newVersion,
      training_title: `Retraining: ${revised.document_title} v${newVersion}`,
      status: 'pending', created_at: now(),
    });
    await notify('Retraining Required', `${revised.document_number} v${newVersion} — training required`, revised.id, ['training_coordinator', 'qa_manager']);
  }

  await notify('New Revision Created', `${revised.document_number} v${newVersion} created`, revised.id, ['qa_manager']);
  if (input.review_required) await notify('Review Required', `${revised.document_number} v${newVersion} requires review`, revised.id, ['qa_manager', 'head_qa']);
  await audit(actor, 'VERSION_CREATED', revised.id, parent.version, newVersion, input.revision_reason);

  return { id: revised.id, ...versionRecord };
}

export async function submitRevisionForReview(versionId: string, actor: VersionControlActor, comments = '') {
  const record = await getVersionById(versionId);
  if (!record) throw new Error('Version not found');
  await submitForReview(versionId, { id: actor.id, name: actor.name, role: actor.role }, comments);
  await updateDoc(doc(getFirebaseFirestore(), VC_COLLECTIONS.versions, versionId), {
    status: 'Under Review', updated_at: now(), updated_by: actor.id, updated_by_name: actor.name,
  });
  await notify('Approval Pending', `${record.document_number} v${record.version_number} submitted for review`, versionId, ['qa_manager']);
  await audit(actor, 'REVISION_SUBMITTED', versionId, 'Draft', 'Under Review', comments);
  return getVersionById(versionId);
}

export async function initiateRollback(input: RollbackInput, actor: VersionControlActor): Promise<DocumentVersionRecord> {
  const target = await getVersionById(input.target_version_id);
  if (!target) throw new Error('Target version not found');

  const current = (await mergeVersionSources()).find(
    (r) => r.document_number === target.document_number && r.is_latest,
  );
  if (!current) throw new Error('No current version found');

  await updateDoc(doc(getFirebaseFirestore(), VC_COLLECTIONS.versions, current.document_id), {
    rollback_status: 'initiated',
    updated_at: now(),
  });
  await audit(actor, 'ROLLBACK_INITIATED', current.document_id, current.version_number, target.version_number, input.reason);
  await notify('Rollback Initiated', `${target.document_number} rollback to v${target.version_number} initiated`, current.document_id, ['head_qa', 'qa_manager']);

  if (!input.approval_required) {
    return completeRollback(current.document_id, target, actor, input.reason);
  }

  await updateDoc(doc(getFirebaseFirestore(), VC_COLLECTIONS.versions, current.document_id), {
    rollback_status: 'pending_approval',
  });
  return (await getVersionById(current.document_id))!;
}

export async function approveRollback(versionId: string, actor: VersionControlActor): Promise<DocumentVersionRecord> {
  const record = await getVersionById(versionId);
  if (!record || record.rollback_status !== 'pending_approval') throw new Error('No pending rollback');
  const lineage = await getVersionLineage(record.document_number);
  const target = lineage.find((r) => r.rollback_status === null && r.version_number !== record.version_number);
  if (!target) throw new Error('Rollback target not found');
  await audit(actor, 'ROLLBACK_APPROVED', versionId, record.version_number, target.version_number);
  return completeRollback(versionId, target, actor, 'Rollback approved');
}

async function completeRollback(
  currentId: string, target: DocumentVersionRecord, actor: VersionControlActor, reason: string,
): Promise<DocumentVersionRecord> {
  const revision = await createDocumentRevision({
    document_id: currentId,
    revision_type: 'Emergency',
    revision_reason: `Rollback to v${target.version_number}: ${reason}`,
    change_summary: `Emergency rollback from current version to v${target.version_number}`,
    training_required: true,
    review_required: true,
    approval_required: true,
    electronic_signature_required: true,
  }, actor);

  await updateDoc(doc(getFirebaseFirestore(), VC_COLLECTIONS.versions, currentId), {
    rollback_status: 'completed', updated_at: now(),
  });
  await notify('Rollback Completed', `${target.document_number} rollback completed`, revision.document_id, ['qa_manager']);
  await audit(actor, 'ROLLBACK_COMPLETED', revision.document_id, currentId, target.version_number, reason);
  return revision;
}

export function compareVersions(a: DocumentVersionRecord, b: DocumentVersionRecord) {
  return {
    from: { version: a.version_number, summary: a.change_summary, reason: a.revision_reason, status: a.status },
    to: { version: b.version_number, summary: b.change_summary, reason: b.revision_reason, status: b.status },
    diff: `Changes from v${a.version_number} to v${b.version_number}:\n- ${b.change_summary || 'No summary recorded'}\n(Diff viewer placeholder — full text comparison available in production)`,
  };
}

export function exportVersionsCsv(records: DocumentVersionRecord[]) {
  downloadCsv('document-versions.csv',
    ['Document Number', 'Title', 'Version', 'Revision Type', 'Status', 'Author', 'Department', 'Created'],
    records.map((r) => [r.document_number, r.document_title, r.version_number, r.revision_type, r.status, r.author_name, r.department, r.created_at]),
  );
}

export function exportVersionsExcel(records: DocumentVersionRecord[]) { exportVersionsCsv(records); }

export async function logVersionDashboardViewed(actor: VersionControlActor) {
  await audit(actor, 'DASHBOARD_VIEWED', 'version-dashboard', null, null);
}

export async function logVersionExported(actor: VersionControlActor, format: string, count: number) {
  await audit(actor, 'EXPORTED', 'version-dashboard', null, { format, count });
}
