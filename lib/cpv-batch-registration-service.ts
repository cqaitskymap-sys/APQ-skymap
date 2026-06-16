import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import { getFirebaseFirestore, isFirebaseConfigured } from '@/lib/firebase';
import {
  createRecord,
  getRecord,
  getRecords,
  updateRecord,
  type DocumentActor,
} from '@/lib/firestore';
import { createAuditLog, writeAuditTrail } from '@/lib/audit-trail';
import { fetchBatches as fetchAdminBatches, normalizeBatch } from '@/lib/admin/batch-service';
import { fetchCpvProducts, fetchCpvProductById } from '@/lib/cpv-product-master-service';
import type { CpvProductRecord } from '@/lib/cpv-product-master';
import type { AdminBatch } from '@/lib/admin/schemas';
import {
  CPV_BATCH_COLLECTION,
  CPV_BATCH_MODULE,
  buildCpvBatchId,
  type CpvBatchFormData,
  type CpvBatchRecord,
} from '@/lib/cpv-batch-registration';

const MODULE_NAME = CPV_BATCH_MODULE;
const LEGACY_COLLECTION = 'batches';

export interface CpvBatchActor {
  id: string;
  name: string;
}

function actorContext(actor: CpvBatchActor) {
  return {
    moduleName: MODULE_NAME,
    actor: { id: actor.id, name: actor.name } as DocumentActor,
  };
}

async function logBatchAudit(
  actionType: string,
  recordId: string,
  actor: CpvBatchActor,
  oldValue?: unknown,
  newValue?: unknown,
  documentNumber?: string,
) {
  await createAuditLog({
    moduleName: MODULE_NAME,
    collectionName: CPV_BATCH_COLLECTION,
    recordId,
    documentNumber,
    actionType,
    oldValue,
    newValue,
    user: { id: actor.id, name: actor.name },
    status: 'Success',
  });

  await writeAuditTrail({
    collectionName: CPV_BATCH_COLLECTION,
    documentId: recordId,
    action: actionType,
    oldValue,
    newValue,
    userId: actor.id,
    userName: actor.name,
    moduleName: MODULE_NAME,
  });
}

function str(v: unknown, fallback = ''): string {
  if (v === null || v === undefined) return fallback;
  return String(v);
}

function num(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeCpvBatch(raw: Record<string, unknown>): CpvBatchRecord {
  const batchNumber = str(raw.batchNumber || raw.batch_number || raw.batchNo);
  return {
    id: str(raw.id),
    cpvBatchId: str(raw.cpvBatchId || raw.cpv_batch_id, buildCpvBatchId(batchNumber)),
    cpvProductId: str(raw.cpvProductId || raw.cpv_product_id || raw.productId),
    batchNumber,
    productCode: str(raw.productCode || raw.product_code),
    productName: str(raw.productName || raw.product_name),
    genericName: str(raw.genericName || raw.generic_name),
    strength: str(raw.strength),
    dosageForm: str(raw.dosageForm || raw.dosage_form),
    packSize: str(raw.packSize || raw.pack_size),
    market: str(raw.market),
    batchSize: num(raw.batchSize ?? raw.batch_size, 0),
    batchSizeUnit: (str(raw.batchSizeUnit || raw.batch_size_unit || raw.unit, 'Vials') as CpvBatchRecord['batchSizeUnit']),
    manufacturingDate: str(raw.manufacturingDate || raw.manufacturing_date),
    expiryDate: str(raw.expiryDate || raw.expiry_date),
    manufacturingSite: str(raw.manufacturingSite || raw.manufacturing_site || raw.site),
    manufacturingLine: str(raw.manufacturingLine || raw.manufacturing_line || raw.lineNumber),
    shift: str(raw.shift, 'A'),
    mfrNumber: str(raw.mfrNumber || raw.mfr_number),
    bmrNumber: str(raw.bmrNumber || raw.bmr_number),
    bprNumber: str(raw.bprNumber || raw.bpr_number),
    semiFinishedBatchNumber: str(raw.semiFinishedBatchNumber || raw.semi_finished_batch_number),
    finishedProductBatchNumber: str(raw.finishedProductBatchNumber || raw.finished_product_batch_number),
    packingBatchNumber: str(raw.packingBatchNumber || raw.packing_batch_number),
    manufacturedFor: str(raw.manufacturedFor || raw.manufactured_for),
    customerName: str(raw.customerName || raw.customer_name),
    cpvReviewPeriod: (str(raw.cpvReviewPeriod || raw.cpv_review_period, 'Yearly') as CpvBatchRecord['cpvReviewPeriod']),
    batchStatus: (str(raw.batchStatus || raw.batch_status || raw.status, 'Planned') as CpvBatchRecord['batchStatus']),
    releaseStatus: (str(raw.releaseStatus || raw.release_status, 'Pending') as CpvBatchRecord['releaseStatus']),
    qaReleaseDate: str(raw.qaReleaseDate || raw.qa_release_date || raw.releaseDate),
    qaReleasedBy: str(raw.qaReleasedBy || raw.qa_released_by),
    statusChangeReason: str(raw.statusChangeReason || raw.status_change_reason || raw.reason),
    remarks: str(raw.remarks),
    specificationNumber: str(raw.specificationNumber || raw.specification_number),
    stpNumber: str(raw.stpNumber || raw.stp_number),
    createdAt: str(raw.createdAt || raw.created_at),
    updatedAt: str(raw.updatedAt || raw.updated_at),
    createdBy: str(raw.createdBy || raw.created_by),
    updatedBy: str(raw.updatedBy || raw.updated_by),
    createdByName: str(raw.createdByName || raw.created_by_name),
    updatedByName: str(raw.updatedByName || raw.updated_by_name),
    isDeleted: Boolean(raw.isDeleted),
    status: str(raw.status || raw.batchStatus),
  };
}

export function cpvProductToBatchAutofill(product: CpvProductRecord): Partial<CpvBatchFormData> {
  return {
    cpvProductId: product.id,
    productCode: product.productCode,
    productName: product.productName,
    genericName: product.genericName || '',
    strength: product.strength || '',
    dosageForm: product.dosageForm || '',
    packSize: product.packSize || '',
    market: product.market || '',
    batchSize: Number(product.standardBatchSize) || undefined,
    mfrNumber: product.mfrNumber || '',
    bmrNumber: product.bmrNumber || '',
    bprNumber: product.bprNumber || '',
    cpvReviewPeriod: product.cpvReviewFrequency,
  };
}

export function adminBatchToCpvForm(batch: AdminBatch, cpvProductId = ''): Partial<CpvBatchFormData> {
  const b = normalizeBatch(batch);
  return {
    cpvProductId,
    batchNumber: b.batchNumber,
    productCode: b.productCode,
    productName: b.productName,
    genericName: b.genericName || '',
    strength: b.strength || '',
    dosageForm: b.dosageForm || '',
    market: b.market || '',
    batchSize: Number(b.batchSize) || undefined,
    batchSizeUnit: (b.batchSizeUnit || 'Vials') as CpvBatchFormData['batchSizeUnit'],
    manufacturingDate: b.manufacturingDate || '',
    expiryDate: b.expiryDate || '',
    manufacturingSite: b.manufacturingSite || '',
    manufacturingLine: b.manufacturingLine || '',
    shift: b.shift || 'A',
    mfrNumber: b.mfrNumber || '',
    bmrNumber: b.bmrNumber || '',
    bprNumber: b.bprNumber || '',
    semiFinishedBatchNumber: b.semiFinishedBatchNumber || '',
    finishedProductBatchNumber: b.finishedProductBatchNumber || '',
    packingBatchNumber: b.packingBatchNumber || '',
    manufacturedFor: b.manufacturedFor || '',
    customerName: b.customerName || '',
    batchStatus: (b.batchStatus || 'Planned') as CpvBatchFormData['batchStatus'],
    releaseStatus: (b.releaseStatus || 'Pending') as CpvBatchFormData['releaseStatus'],
    qaReleaseDate: b.releaseDate || '',
    qaReleasedBy: b.qaReleasedBy || '',
    remarks: b.remarks || '',
  };
}

async function syncToBatchesCollection(record: CpvBatchRecord, cpvBatchDocId: string) {
  if (!isFirebaseConfigured()) return;
  try {
    await createRecord(
      LEGACY_COLLECTION,
      {
        batch_number: record.batchNumber,
        batchNumber: record.batchNumber,
        product_name: record.productName,
        productName: record.productName,
        product_code: record.productCode,
        productCode: record.productCode,
        manufacturing_date: record.manufacturingDate,
        manufacturingDate: record.manufacturingDate,
        expiry_date: record.expiryDate,
        expiryDate: record.expiryDate,
        batch_size: String(record.batchSize),
        batchSize: String(record.batchSize),
        market: record.market,
        shift: record.shift,
        manufacturing_line: record.manufacturingLine,
        status: record.batchStatus,
        release_status: record.releaseStatus,
        source: 'cpv',
        cpv_batch_id: cpvBatchDocId,
        cpvBatchId: record.cpvBatchId,
      },
      { moduleName: MODULE_NAME, actor: { id: 'system', name: 'CPV Sync' } },
    );
  } catch (e) {
    console.warn('CPV batch sync to batches collection failed', e);
  }
}

export async function fetchCpvBatches(): Promise<CpvBatchRecord[]> {
  if (!isFirebaseConfigured()) return [];
  try {
    const primary = await getRecords<CpvBatchRecord>(CPV_BATCH_COLLECTION);
    const normalized = primary.map((r) => normalizeCpvBatch(r as unknown as Record<string, unknown>));
    if (normalized.length) return normalized;

    const snap = await getDocs(query(collection(getFirebaseFirestore(), LEGACY_COLLECTION), limit(500)));
    return snap.docs
      .map((d) => normalizeCpvBatch({ id: d.id, ...d.data() }))
      .filter((b) => b.batchNumber);
  } catch (e) {
    console.error('fetchCpvBatches failed', e);
    return [];
  }
}

export async function fetchCpvBatchById(id: string): Promise<CpvBatchRecord | null> {
  if (!isFirebaseConfigured()) return null;
  try {
    const record = await getRecord<CpvBatchRecord>(CPV_BATCH_COLLECTION, id);
    if (!record) {
      const all = await fetchCpvBatches();
      return all.find((b) => b.id === id) ?? null;
    }
    return normalizeCpvBatch(record as unknown as Record<string, unknown>);
  } catch (e) {
    console.error('fetchCpvBatchById failed', e);
    return null;
  }
}

export async function isDuplicateBatchNumber(batchNumber: string, excludeId?: string): Promise<boolean> {
  const batches = await fetchCpvBatches();
  return batches.some((b) => {
    if (excludeId && b.id === excludeId) return false;
    return b.batchNumber.toLowerCase() === batchNumber.toLowerCase();
  });
}

export async function fetchAdminBatchesForImport(): Promise<AdminBatch[]> {
  try {
    return await fetchAdminBatches();
  } catch {
    return [];
  }
}

export async function fetchActiveCpvProductsForBatch(): Promise<CpvProductRecord[]> {
  const products = await fetchCpvProducts();
  return products.filter((p) => p.cpvStatus === 'Active' || p.cpvStatus === 'Under Review');
}

async function safeQuery(name: string, max = 100): Promise<Record<string, unknown>[]> {
  if (!isFirebaseConfigured()) return [];
  try {
    const snap = await getDocs(query(collection(getFirebaseFirestore(), name), orderBy('createdAt', 'desc'), limit(max)));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch {
    try {
      const snap = await getDocs(query(collection(getFirebaseFirestore(), name), limit(max)));
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch {
      return [];
    }
  }
}

export async function fetchBatchCppResults(batch: CpvBatchRecord): Promise<Record<string, unknown>[]> {
  const nums = [batch.batchNumber, batch.finishedProductBatchNumber].filter(Boolean);
  const cols = ['cpp_results', 'cpv_cpp'];
  const merged: Record<string, unknown>[] = [];
  for (const col of cols) {
    const rows = await safeQuery(col, 200);
    merged.push(...rows.filter((r) => nums.includes(str(r.batchNo || r.batch_no || r.batch_number))));
  }
  return merged.slice(0, 100);
}

export async function fetchBatchCqaResults(batch: CpvBatchRecord): Promise<Record<string, unknown>[]> {
  const nums = [batch.batchNumber, batch.finishedProductBatchNumber].filter(Boolean);
  const cols = ['cqa_results', 'cpv_cqa'];
  const merged: Record<string, unknown>[] = [];
  for (const col of cols) {
    const rows = await safeQuery(col, 200);
    merged.push(...rows.filter((r) => nums.includes(str(r.batchNo || r.batch_no || r.batch_number))));
  }
  return merged.slice(0, 100);
}

export async function fetchBatchYieldResults(batch: CpvBatchRecord): Promise<Record<string, unknown>[]> {
  const rows = await safeQuery('yield_monitoring', 100);
  return rows.filter((r) => str(r.batchNo || r.batch_no) === batch.batchNumber);
}

export async function fetchBatchStabilityLinks(batch: CpvBatchRecord): Promise<Record<string, unknown>[]> {
  const cols = ['stability_studies', 'cpv_stability_studies'];
  const merged: Record<string, unknown>[] = [];
  for (const col of cols) {
    const rows = await safeQuery(col, 50);
    merged.push(...rows.filter((r) => str(r.batchNo || r.batch_number) === batch.batchNumber));
  }
  return merged;
}

export async function fetchBatchRiskSummary(batch: CpvBatchRecord): Promise<Record<string, unknown>[]> {
  const rows = await safeQuery('risk_assessment', 50);
  return rows.filter((r) => str(r.batchNo || r.batch_no) === batch.batchNumber);
}

export async function fetchBatchAuditTrail(recordId: string): Promise<Record<string, unknown>[]> {
  if (!isFirebaseConfigured()) return [];
  try {
    const snap = await getDocs(query(collection(getFirebaseFirestore(), 'audit_trail'), where('documentId', '==', recordId), limit(50)));
    if (!snap.empty) return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const snap2 = await getDocs(query(collection(getFirebaseFirestore(), 'audit_trail'), where('recordId', '==', recordId), limit(50)));
    return snap2.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch {
    const all = await safeQuery('audit_trail', 100);
    return all.filter((r) => str(r.documentId || r.recordId) === recordId);
  }
}

export async function createCpvBatch(
  data: CpvBatchFormData,
  actor: CpvBatchActor,
): Promise<{ batch: CpvBatchRecord | null; error: string | null }> {
  if (!isFirebaseConfigured()) return { batch: null, error: 'Firebase is not configured.' };
  try {
    if (await isDuplicateBatchNumber(data.batchNumber)) {
      return { batch: null, error: 'A batch with this number already exists.' };
    }
    const product = await fetchCpvProductById(data.cpvProductId);
    if (product && product.cpvStatus === 'Inactive') {
      return { batch: null, error: 'Selected CPV product is inactive. Batch registration is not allowed.' };
    }
    const payload = {
      ...data,
      cpvBatchId: buildCpvBatchId(data.batchNumber),
      status: data.batchStatus,
      createdByName: actor.name,
      updatedByName: actor.name,
      specificationNumber: product?.specificationNumber || '',
      stpNumber: product?.stpNumber || '',
      batch_number: data.batchNumber,
      product_name: data.productName,
      product_code: data.productCode,
    };
    const created = await createRecord(
      CPV_BATCH_COLLECTION,
      payload as Omit<CpvBatchRecord, 'id' | 'createdAt' | 'updatedAt' | 'isDeleted'>,
      actorContext(actor),
    );
    const batch = normalizeCpvBatch(created as unknown as Record<string, unknown>);
    await syncToBatchesCollection(batch, batch.id);
    await logBatchAudit('create CPV batch', batch.id, actor, null, batch, batch.cpvBatchId);
    return { batch, error: null };
  } catch (e) {
    console.error('createCpvBatch failed', e);
    return { batch: null, error: 'Failed to create CPV batch.' };
  }
}

export async function updateCpvBatch(
  id: string,
  data: Partial<CpvBatchFormData>,
  actor: CpvBatchActor,
  existing: CpvBatchRecord,
): Promise<{ batch: CpvBatchRecord | null; error: string | null }> {
  if (!isFirebaseConfigured()) return { batch: null, error: 'Firebase is not configured.' };
  try {
    if (existing.batchStatus === 'Released' && (
      data.batchNumber || data.productName || data.manufacturingDate || data.expiryDate || data.batchSize
    )) {
      return { batch: null, error: 'Released batches cannot modify critical fields.' };
    }
    if (data.batchNumber && await isDuplicateBatchNumber(data.batchNumber, id)) {
      return { batch: null, error: 'A batch with this number already exists.' };
    }
    const updates = {
      ...data,
      status: data.batchStatus ?? existing.batchStatus,
      updatedByName: actor.name,
      ...(data.batchNumber && { batch_number: data.batchNumber }),
      ...(data.productName && { product_name: data.productName }),
    };
    const updated = await updateRecord(
      CPV_BATCH_COLLECTION,
      id,
      updates as Partial<CpvBatchRecord>,
      actorContext(actor),
    );
    if (!updated) return { batch: null, error: 'Batch not found.' };
    const batch = normalizeCpvBatch(updated as unknown as Record<string, unknown>);
    await logBatchAudit('edit CPV batch', id, actor, existing, batch, batch.cpvBatchId);
    return { batch, error: null };
  } catch (e) {
    console.error('updateCpvBatch failed', e);
    return { batch: null, error: 'Failed to update CPV batch.' };
  }
}

export async function changeCpvBatchStatus(
  id: string,
  batchStatus: CpvBatchRecord['batchStatus'],
  actor: CpvBatchActor,
  existing: CpvBatchRecord,
  reason?: string,
  releaseStatus?: CpvBatchRecord['releaseStatus'],
): Promise<{ batch: CpvBatchRecord | null; error: string | null }> {
  const updates: Partial<CpvBatchFormData> = {
    batchStatus,
    statusChangeReason: reason || existing.statusChangeReason,
  };
  if (releaseStatus) updates.releaseStatus = releaseStatus;
  if (batchStatus === 'Released') {
    updates.qaReleaseDate = new Date().toISOString().split('T')[0];
    updates.qaReleasedBy = actor.name;
    updates.releaseStatus = 'Released';
  }
  if (batchStatus === 'Rejected') updates.releaseStatus = 'Rejected';
  if (batchStatus === 'Hold') updates.releaseStatus = 'On Hold';

  const actionMap: Record<string, string> = {
    Released: 'release batch',
    Rejected: 'reject batch',
    Hold: 'hold batch',
  };
  const result = await updateCpvBatch(id, updates, actor, existing);
  if (result.batch) {
    await logBatchAudit(
      actionMap[batchStatus] || 'status change',
      id,
      actor,
      existing.batchStatus,
      batchStatus,
      existing.cpvBatchId,
    );
  }
  return result;
}

export async function importCpvBatchFromAdmin(
  adminBatchId: string,
  cpvProductId: string,
  actor: CpvBatchActor,
): Promise<{ batch: CpvBatchRecord | null; error: string | null }> {
  const adminBatches = await fetchAdminBatchesForImport();
  const adminBatch = adminBatches.find((b) => b.id === adminBatchId);
  if (!adminBatch) return { batch: null, error: 'Admin batch not found.' };

  const partial = adminBatchToCpvForm(adminBatch, cpvProductId);
  const data = {
    ...partial,
    cpvProductId,
    batchNumber: partial.batchNumber || '',
    productCode: partial.productCode || '',
    productName: partial.productName || '',
    batchSize: partial.batchSize || 1,
    manufacturingDate: partial.manufacturingDate || new Date().toISOString().split('T')[0],
    expiryDate: partial.expiryDate || '',
    manufacturingSite: partial.manufacturingSite || 'Site 1',
    batchStatus: 'Planned' as const,
    releaseStatus: 'Pending' as const,
    cpvReviewPeriod: 'Yearly' as const,
    batchSizeUnit: partial.batchSizeUnit || 'Vials',
    shift: partial.shift || 'A',
    statusChangeReason: '',
    qaReleaseDate: '',
    qaReleasedBy: '',
    remarks: partial.remarks || '',
  } as CpvBatchFormData;

  const result = await createCpvBatch(data, actor);
  if (result.batch) {
    await logBatchAudit('import batch', result.batch.id, actor, null, { adminBatchId }, result.batch.cpvBatchId);
  }
  return result;
}

export async function logCpvBatchExport(actor: CpvBatchActor, count: number): Promise<void> {
  await logBatchAudit('export batch list', 'export', actor, null, { count });
}

export async function logQaOverride(actor: CpvBatchActor, batchId: string, detail: string): Promise<void> {
  await logBatchAudit('QA override', batchId, actor, null, detail);
}

/** For CPP/CQA batch dropdowns */
export async function listCpvBatchesForDropdown(): Promise<Array<{ id: string; batch_number: string; product_name: string }>> {
  const batches = await fetchCpvBatches();
  return batches
    .filter((b) => b.batchStatus !== 'Cancelled' && b.batchStatus !== 'Rejected')
    .map((b) => ({
      id: b.id,
      batch_number: b.batchNumber,
      product_name: b.productName,
    }));
}
