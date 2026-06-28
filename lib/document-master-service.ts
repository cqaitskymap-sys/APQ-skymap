import { collection, doc, getDocs, limit, orderBy, query, updateDoc, where } from 'firebase/firestore';
import { getFirebaseFirestore } from '@/lib/firebase';
import { logAuditEvent, generateDocumentNumber } from '@/lib/admin/admin-service';
import { downloadCsv } from '@/lib/export-utils';
import {
  listDocuments,
  generateDmsDocumentNumber,
  getDocumentById,
  archiveDocument,
  syncEffectiveDocuments,
  syncReviewDueNotifications,
} from '@/lib/dms-service';
import { DMS_COLLECTIONS, DMS_DEPARTMENTS, type DocumentRecord } from '@/lib/dms-types';
import type { DocumentMasterCreateInput } from './document-master-schemas';
import {
  mapDocumentToMaster,
  filterDocumentMasterRecords,
  computeDocumentMasterKpis,
  computeDocumentMasterCharts,
  buildDocumentMasterTables,
  buildFilterOptions,
  type DocumentMasterData,
} from './document-master-records';
import {
  DOCUMENT_MASTER_MODULE,
  DOCUMENT_MASTER_COLLECTIONS,
  CATEGORY_PREFIX,
  canViewEffectiveOnly,
  mapMasterStatusToDms,
  type DocumentMasterActor,
  type DocumentMasterFilters,
  type DocumentMasterRecord,
} from './document-master-types';

export type { DocumentMasterData } from './document-master-records';
export type {
  DocumentMasterFilters,
  DocumentMasterRecord,
  DocumentMasterActor,
} from './document-master-types';

function now() { return new Date().toISOString(); }

async function audit(
  actor: DocumentMasterActor,
  action: string,
  recordId: string,
  oldValue: unknown,
  newValue: unknown,
  reason = '',
) {
  await logAuditEvent({
    userId: actor.id,
    userName: actor.name,
    module: DOCUMENT_MASTER_MODULE,
    recordId,
    action,
    oldValue: oldValue ? JSON.stringify(oldValue) : '',
    newValue: newValue ? JSON.stringify(newValue) : '',
    reason,
    ipAddress: 'client',
    device: typeof navigator !== 'undefined' ? navigator.userAgent : 'server',
    status: 'Success',
  });
}

async function isDocumentNumberUnique(number: string, excludeId?: string): Promise<boolean> {
  const snap = await getDocs(query(
    collection(getFirebaseFirestore(), DOCUMENT_MASTER_COLLECTIONS.documents),
    where('document_number', '==', number),
    limit(5),
  ));
  return snap.docs.every((d) => d.id === excludeId);
}

export async function generateDocumentMasterNumber(category: string): Promise<string> {
  const prefix = CATEGORY_PREFIX[category] || 'DOC';
  const adminNumber = await generateDocumentNumber(prefix);
  if (adminNumber) return adminNumber;

  const year = new Date().getFullYear();
  const docPrefix = `${prefix}-${year}-`;
  try {
    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), DOCUMENT_MASTER_COLLECTIONS.documents),
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
    const all = await getDocs(collection(getFirebaseFirestore(), DOCUMENT_MASTER_COLLECTIONS.documents));
    return `${docPrefix}${String(all.size + 1).padStart(4, '0')}`;
  }
  return `${docPrefix}0001`;
}

export async function loadDocumentMasterData(
  filters?: DocumentMasterFilters,
  actorRole?: string,
): Promise<DocumentMasterData> {
  await Promise.all([syncEffectiveDocuments(), syncReviewDueNotifications()]);

  const dmsFilters = {
    department: filters?.department,
    search: undefined as string | undefined,
  };

  const raw = await listDocuments(dmsFilters, actorRole);
  const allMapped = raw.map((r) => mapDocumentToMaster(r as DocumentRecord & Record<string, unknown>));
  let records = allMapped;

  if (actorRole && canViewEffectiveOnly(actorRole)) {
    records = records.filter((r) => r.document_status === 'Effective' && r.is_latest);
  } else {
    records = records.filter((r) => r.is_latest !== false);
  }

  const filtered = filterDocumentMasterRecords(records, filters);

  return {
    records: filtered,
    kpis: computeDocumentMasterKpis(filtered),
    charts: computeDocumentMasterCharts(filtered),
    tables: buildDocumentMasterTables(filtered),
    filterOptions: buildFilterOptions(records),
  };
}

export async function getDocumentMasterById(id: string): Promise<DocumentMasterRecord | null> {
  const raw = await getDocumentById(id);
  if (!raw) return null;
  return mapDocumentToMaster(raw as DocumentRecord & Record<string, unknown>);
}

export async function createDocumentMasterRecord(
  input: DocumentMasterCreateInput,
  actor: DocumentMasterActor,
): Promise<DocumentMasterRecord> {
  const documentNumber = await generateDocumentMasterNumber(input.document_category);
  if (!(await isDocumentNumberUnique(documentNumber))) {
    throw new Error('Document number already exists');
  }

  const timestamp = now();
  const record = {
    document_number: documentNumber,
    document_title: input.document_title,
    short_title: input.short_title || input.document_title.slice(0, 60),
    document_category: input.document_category,
    document_type: input.document_type || input.document_category,
    department: input.department,
    business_unit: input.business_unit || '',
    site: input.site || '',
    plant: input.plant || '',
    process: input.process || '',
    sub_process: input.sub_process || '',
    owner: actor.id,
    owner_name: input.owner_name,
    prepared_by: actor.id,
    prepared_by_name: input.author_name || input.owner_name,
    reviewed_by: '',
    reviewed_by_name: '',
    approved_by: '',
    approved_by_name: '',
    product_name: '',
    version: '1.0',
    major_version: 1,
    minor_version: 0,
    revision_number: 1,
    effective_date: input.effective_date || null,
    next_review_date: input.review_due_date || null,
    expiry_date: input.expiry_date || null,
    language: input.language || 'English',
    country: input.country || '',
    region: input.region || '',
    keywords: input.keywords || [],
    tags: input.tags || [],
    confidentiality: input.confidentiality || 'Internal',
    classification: input.classification || '',
    training_required: input.training_required ?? false,
    change_control_required: input.change_control_required ?? false,
    electronic_signature_required: input.electronic_signature_required ?? true,
    current_workflow: 'draft',
    linked_change_control: input.linked_change_control || null,
    change_control_ref: input.linked_change_control || '',
    change_control_id: input.linked_change_control || null,
    status: 'draft',
    is_latest: true,
    parent_document_id: null,
    supersedes_document_no: '',
    supersedes_document_id: null,
    reason_for_revision: '',
    remarks: '',
    linked_pqr_id: null,
    linked_cpv_id: null,
    created_by: actor.id,
    created_by_name: actor.name,
    updated_by: actor.id,
    updated_by_name: actor.name,
    created_at: timestamp,
    updated_at: timestamp,
  };

  const { addDoc } = await import('firebase/firestore');
  const refDoc = await addDoc(collection(getFirebaseFirestore(), DMS_COLLECTIONS.documents), record);
  await audit(actor, 'document created', refDoc.id, null, record);
  return mapDocumentToMaster({ id: refDoc.id, ...record } as DocumentRecord & Record<string, unknown>);
}

export async function bulkArchiveDocuments(
  documentIds: string[],
  reason: string,
  actor: DocumentMasterActor,
): Promise<number> {
  let count = 0;
  for (const id of documentIds) {
    try {
      const existing = await getDocumentById(id);
      if (!existing) continue;
      if (existing.status === 'obsolete') {
        await archiveDocument(id, { id: actor.id, name: actor.name, role: actor.role });
        await audit(actor, 'document archived', id, existing, { status: 'archived' }, reason);
        count++;
      } else if (existing.status === 'effective' || existing.status === 'approved') {
        await updateDoc(doc(getFirebaseFirestore(), DMS_COLLECTIONS.documents, id), {
          status: 'archived',
          updated_by: actor.id,
          updated_by_name: actor.name,
          updated_at: now(),
        });
        await audit(actor, 'document archived', id, existing, { status: 'archived' }, reason);
        count++;
      }
    } catch (e) {
      console.error(`Bulk archive failed for ${id}:`, e);
    }
  }
  return count;
}

export async function toggleDocumentFavorite(
  documentId: string,
  favorite: boolean,
  actor: DocumentMasterActor,
): Promise<void> {
  await updateDoc(doc(getFirebaseFirestore(), DMS_COLLECTIONS.documents, documentId), {
    is_favorite: favorite,
    updated_at: now(),
  });
  await audit(actor, favorite ? 'document favorited' : 'document unfavorited', documentId, null, { is_favorite: favorite });
}

export async function logDocumentMasterViewed(actor: DocumentMasterActor): Promise<void> {
  await audit(actor, 'document master viewed', 'dashboard', null, { module: DOCUMENT_MASTER_MODULE });
}

export async function logDocumentMasterExported(
  actor: DocumentMasterActor,
  format: 'csv' | 'excel' | 'print',
  count: number,
): Promise<void> {
  await audit(actor, 'document exported', 'bulk', null, { format, count });
}

export async function logDocumentViewed(
  documentId: string,
  actor: DocumentMasterActor,
): Promise<void> {
  await audit(actor, 'document viewed', documentId, null, { viewed_at: now() });
}

export function paginateRecords<T>(records: T[], page: number, pageSize: number): { rows: T[]; totalPages: number; total: number } {
  const total = records.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  return { rows: records.slice(start, start + pageSize), totalPages, total };
}

export function exportDocumentMasterCsv(records: DocumentMasterRecord[]): void {
  downloadCsv(
    `document-master-${new Date().toISOString().split('T')[0]}.csv`,
    [
      'Document Number', 'Title', 'Category', 'Department', 'Owner', 'Status',
      'Version', 'Effective Date', 'Review Due', 'Expiry Date', 'Language', 'Site', 'Plant',
    ],
    records.map((r) => [
      r.document_number,
      r.document_title,
      r.document_category,
      r.department,
      r.owner_name,
      r.document_status,
      r.version,
      r.effective_date || '',
      r.review_due_date || '',
      r.expiry_date || '',
      r.language,
      r.site,
      r.plant,
    ]),
  );
}

export function exportDocumentMasterExcel(records: DocumentMasterRecord[]): void {
  exportDocumentMasterCsv(records);
}

export function getDefaultDepartments(): string[] {
  return [...DMS_DEPARTMENTS];
}

export { generateDmsDocumentNumber, mapMasterStatusToDms };
