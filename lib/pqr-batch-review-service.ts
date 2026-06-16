import {
  collection, doc, addDoc, getDocs, updateDoc, query, where, orderBy, limit, writeBatch,
} from 'firebase/firestore';
import { getFirebaseFirestore, isFirebaseConfigured } from '@/lib/firebase';
import { createAuditLog, writeAuditTrail } from '@/lib/audit-trail';
import { CPV_BATCH_COLLECTION } from '@/lib/cpv-batch-registration';
import {
  PQR_BATCH_REVIEW_COLLECTIONS, PQR_BATCH_REVIEW_MODULE,
  computeBatchSummary, generateBatchNarrative, buildBatchCharts,
  type BatchReviewFormData, type PqrBatchReviewRecord, type PqrBatchReviewSummary,
  type PqrOption,
} from '@/lib/pqr-batch-review-records';

export type PqrBatchReviewActor = { id: string; name: string; role?: string };

const nowIso = () => new Date().toISOString();
const str = (v: unknown, fb = '') => (v === null || v === undefined ? fb : String(v));
const num = (v: unknown, fb = 0) => { const n = Number(v); return Number.isFinite(n) ? n : fb; };

function buildBatchReviewId(batchNumber: string) {
  return `PBR-${batchNumber.toUpperCase().replace(/\s+/g, '-')}-${Date.now().toString(36).toUpperCase()}`;
}

async function readCollection(name: string, max = 500): Promise<Record<string, unknown>[]> {
  if (!isFirebaseConfigured()) return [];
  try {
    const snap = await getDocs(query(collection(getFirebaseFirestore(), name), orderBy('createdAt', 'desc'), limit(max)));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch {
    try {
      const snap = await getDocs(query(collection(getFirebaseFirestore(), name), limit(max)));
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch (e) {
      console.error(`readCollection ${name}`, e);
      return [];
    }
  }
}

async function readFirst(names: string[], max = 500): Promise<Record<string, unknown>[]> {
  for (const name of names) {
    const rows = await readCollection(name, max);
    if (rows.length) return rows;
  }
  return [];
}

async function logBatchReviewAudit(
  actionType: string,
  actor: PqrBatchReviewActor,
  detail?: unknown,
  recordId = 'batch-review',
) {
  try {
    await createAuditLog({
      moduleName: PQR_BATCH_REVIEW_MODULE,
      collectionName: PQR_BATCH_REVIEW_COLLECTIONS.batchReview,
      recordId,
      actionType,
      newValue: detail,
      user: { id: actor.id, name: actor.name },
      status: 'Success',
    });
    await writeAuditTrail({
      collectionName: PQR_BATCH_REVIEW_COLLECTIONS.batchReview,
      documentId: recordId,
      action: actionType,
      oldValue: null,
      newValue: detail,
      userId: actor.id,
      userName: actor.name,
      moduleName: PQR_BATCH_REVIEW_MODULE,
    });
  } catch (e) {
    console.error('logBatchReviewAudit failed', e);
  }
}

function inPeriod(dateStr: string, from: string, to: string): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return false;
  return d >= new Date(from) && d <= new Date(`${to}T23:59:59`);
}

function matchesProductCode(record: Record<string, unknown>, productCode: string, productName: string): boolean {
  const code = str(record.productCode || record.product_code).toLowerCase();
  const name = str(record.productName || record.product_name || record.product).toLowerCase();
  const qCode = productCode.toLowerCase();
  const qName = productName.toLowerCase();
  if (code && qCode && code === qCode) return true;
  if (name && qName && (name.includes(qName) || qName.includes(name))) return true;
  return false;
}

function normalizeBatchStatus(raw: string): string {
  const s = raw.toLowerCase();
  if (s.includes('release')) return 'Released';
  if (s.includes('reject')) return 'Rejected';
  if (s.includes('hold')) return 'Hold';
  if (s.includes('rework')) return 'Reworked';
  if (s.includes('reprocess')) return 'Reprocessed';
  if (s.includes('cancel')) return 'Cancelled';
  if (s.includes('qc')) return 'Under QC Testing';
  if (s.includes('qa')) return 'Under QA Review';
  if (s.includes('manufactur') || s.includes('planned') || s.includes('active')) return 'Manufactured';
  return raw || 'Manufactured';
}

function normalizeReleaseStatus(raw: string): string {
  const s = raw.toLowerCase();
  if (s.includes('release') && !s.includes('reject')) return 'Released';
  if (s.includes('reject')) return 'Rejected';
  if (s.includes('hold')) return 'On Hold';
  if (s.includes('pending')) return 'Pending';
  if (s.includes('n/a') || s.includes('not applicable')) return 'Not Applicable';
  return raw || 'Pending';
}

function mapPqrOption(raw: Record<string, unknown>): PqrOption {
  return {
    id: str(raw.id),
    pqrNumber: str(raw.pqrNumber || raw.pqr_number),
    productName: str(raw.productName || raw.product_name),
    productCode: str(raw.productCode || raw.product_code),
    genericName: str(raw.genericName || raw.generic_name),
    strength: str(raw.strength),
    dosageForm: str(raw.dosageForm || raw.dosage_form),
    reviewPeriodFrom: str(raw.reviewPeriodFrom || raw.review_period_from),
    reviewPeriodTo: str(raw.reviewPeriodTo || raw.review_period_to),
  };
}

function mapMasterToReview(
  raw: Record<string, unknown>,
  pqr: PqrOption,
  sourceType: 'batch_master' | 'cpv_batch',
  linked: { deviations: number; oos: number; capa: number },
  actor: PqrBatchReviewActor,
): Omit<PqrBatchReviewRecord, 'id'> {
  const ts = nowIso();
  const batchNumber = str(raw.batchNumber || raw.batch_number || raw.batchNo);
  const batchStatus = normalizeBatchStatus(str(raw.batchStatus || raw.batch_status || raw.status));
  const releaseStatus = normalizeReleaseStatus(str(raw.releaseStatus || raw.release_status));
  return {
    batchReviewId: buildBatchReviewId(batchNumber),
    pqrId: pqr.id,
    pqrNumber: pqr.pqrNumber,
    product: pqr.productName,
    productCode: pqr.productCode,
    genericName: pqr.genericName || str(raw.genericName || raw.generic_name),
    strength: pqr.strength || str(raw.strength),
    dosageForm: pqr.dosageForm || str(raw.dosageForm || raw.dosage_form),
    reviewPeriodFrom: pqr.reviewPeriodFrom,
    reviewPeriodTo: pqr.reviewPeriodTo,
    batchNumber,
    semiFinishedBatchNumber: str(raw.semiFinishedBatchNumber || raw.semi_finished_batch_number),
    finishedProductBatchNumber: str(raw.finishedProductBatchNumber || raw.finished_product_batch_number),
    packingBatchNumber: str(raw.packingBatchNumber || raw.packing_batch_number),
    manufacturingDate: str(raw.manufacturingDate || raw.manufacturing_date || raw.mfg_date).slice(0, 10),
    expiryDate: str(raw.expiryDate || raw.expiry_date || raw.exp_date).slice(0, 10),
    batchSize: num(raw.batchSize ?? raw.batch_size, 0),
    batchSizeUnit: str(raw.batchSizeUnit || raw.batch_size_unit || raw.unit, 'Vials'),
    manufacturedFor: str(raw.manufacturedFor || raw.manufactured_for),
    customerName: str(raw.customerName || raw.customer_name),
    market: str(raw.market || pqr.productName),
    batchStatus,
    releaseStatus,
    releaseDate: str(raw.releaseDate || raw.qaReleaseDate || raw.qa_release_date).slice(0, 10),
    qaReleasedBy: str(raw.qaReleasedBy || raw.qa_released_by),
    rejectionReason: batchStatus === 'Rejected' ? str(raw.statusChangeReason || raw.rejectionReason) : '',
    holdReason: batchStatus === 'Hold' ? str(raw.statusChangeReason || raw.holdReason) : '',
    reworkRequired: batchStatus === 'Reworked' || str(raw.reworkRequired).toLowerCase() === 'true',
    reprocessRequired: batchStatus === 'Reprocessed' || str(raw.reprocessRequired).toLowerCase() === 'true',
    linkedDeviationCount: linked.deviations,
    linkedOosCount: linked.oos,
    linkedCapaCount: linked.capa,
    remarks: str(raw.remarks),
    sourceType,
    sourceId: str(raw.id),
    createdAt: ts,
    updatedAt: ts,
    createdBy: actor.id,
    updatedBy: actor.id,
    createdByName: actor.name,
    updatedByName: actor.name,
    isDeleted: false,
  };
}

async function countLinked(batchNumber: string, productName: string): Promise<{ deviations: number; oos: number; capa: number }> {
  const [deviations, oos, capa] = await Promise.all([
    readFirst([PQR_BATCH_REVIEW_COLLECTIONS.deviations, 'deviation'], 200),
    readFirst([PQR_BATCH_REVIEW_COLLECTIONS.oosRecords, 'oos'], 200),
    readFirst([PQR_BATCH_REVIEW_COLLECTIONS.capaRecords, 'capa'], 200),
  ]);
  const match = (rows: Record<string, unknown>[]) => rows.filter((r) => {
    const bn = str(r.batchNumber || r.batch_number || r.batchNo).toLowerCase();
    return bn && bn === batchNumber.toLowerCase();
  }).length;
  return {
    deviations: match(deviations),
    oos: match(oos),
    capa: match(capa),
  };
}

export async function fetchPqrOptions(): Promise<PqrOption[]> {
  if (!isFirebaseConfigured()) return [];
  try {
    const rows = await readFirst([PQR_BATCH_REVIEW_COLLECTIONS.records, PQR_BATCH_REVIEW_COLLECTIONS.recordsLegacy]);
    return rows
      .filter((r) => !r.isDeleted)
      .map(mapPqrOption)
      .filter((p) => p.pqrNumber && p.productName)
      .sort((a, b) => b.pqrNumber.localeCompare(a.pqrNumber));
  } catch (e) {
    console.error('fetchPqrOptions failed', e);
    return [];
  }
}

export async function fetchPqrById(pqrId: string): Promise<PqrOption | null> {
  const options = await fetchPqrOptions();
  return options.find((p) => p.id === pqrId) || null;
}

export async function fetchBatchReviewRecords(pqrId: string): Promise<PqrBatchReviewRecord[]> {
  if (!isFirebaseConfigured()) return [];
  try {
    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), PQR_BATCH_REVIEW_COLLECTIONS.batchReview),
      where('pqrId', '==', pqrId),
      where('isDeleted', '==', false),
    ));
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() } as PqrBatchReviewRecord))
      .sort((a, b) => a.manufacturingDate.localeCompare(b.manufacturingDate));
  } catch {
    try {
      const snap = await getDocs(query(
        collection(getFirebaseFirestore(), PQR_BATCH_REVIEW_COLLECTIONS.batchReview),
        where('pqrId', '==', pqrId),
      ));
      return snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as PqrBatchReviewRecord))
        .filter((r) => !r.isDeleted)
        .sort((a, b) => a.manufacturingDate.localeCompare(b.manufacturingDate));
    } catch (e) {
      console.error('fetchBatchReviewRecords failed', e);
      return [];
    }
  }
}

export async function checkDuplicateBatch(pqrId: string, batchNumber: string, excludeId?: string): Promise<boolean> {
  const records = await fetchBatchReviewRecords(pqrId);
  return records.some((r) =>
    r.batchNumber.toLowerCase() === batchNumber.toLowerCase() && r.id !== excludeId,
  );
}

export async function pullBatchesFromMaster(
  pqr: PqrOption,
  actor: PqrBatchReviewActor,
): Promise<{ created: number; skipped: number; error?: string }> {
  if (!isFirebaseConfigured()) return { created: 0, skipped: 0, error: 'Firebase is not configured.' };

  try {
    await logBatchReviewAudit('pull batches from master', actor, { pqrId: pqr.id }, pqr.id);

    const [adminBatches, cpvBatches, existing] = await Promise.all([
      readFirst([PQR_BATCH_REVIEW_COLLECTIONS.batches]),
      readCollection(CPV_BATCH_COLLECTION),
      fetchBatchReviewRecords(pqr.id),
    ]);

    const existingNumbers = new Set(existing.map((r) => r.batchNumber.toLowerCase()));
    const from = pqr.reviewPeriodFrom;
    const to = pqr.reviewPeriodTo;

    const candidates: Array<{ raw: Record<string, unknown>; source: 'batch_master' | 'cpv_batch' }> = [];

    adminBatches.forEach((raw) => {
      if (raw.isDeleted) return;
      if (!matchesProductCode(raw, pqr.productCode, pqr.productName)) return;
      const mfg = str(raw.manufacturingDate || raw.manufacturing_date);
      const rel = str(raw.releaseDate || raw.qaReleaseDate || raw.qa_release_date);
      if (!inPeriod(mfg, from, to) && !inPeriod(rel, from, to)) return;
      const bn = str(raw.batchNumber || raw.batch_number).toLowerCase();
      if (existingNumbers.has(bn)) return;
      candidates.push({ raw, source: 'batch_master' as const });
    });

    cpvBatches.forEach((raw) => {
      if (raw.isDeleted) return;
      if (!matchesProductCode(raw, pqr.productCode, pqr.productName)) return;
      const mfg = str(raw.manufacturingDate || raw.manufacturing_date);
      const rel = str(raw.releaseDate || raw.qaReleaseDate || raw.qa_release_date);
      if (!inPeriod(mfg, from, to) && !inPeriod(rel, from, to)) return;
      const bn = str(raw.batchNumber || raw.batch_number).toLowerCase();
      if (existingNumbers.has(bn)) return;
      candidates.push({ raw, source: 'cpv_batch' as const });
    });

    let created = 0;
    let skipped = 0;
    const batch = writeBatch(getFirebaseFirestore());

    for (const { raw, source } of candidates) {
      const batchNumber = str(raw.batchNumber || raw.batch_number);
      if (existingNumbers.has(batchNumber.toLowerCase())) {
        skipped += 1;
        continue;
      }
      const linked = await countLinked(batchNumber, pqr.productName);
      const record = mapMasterToReview(raw, pqr, source, linked, actor);
      const ref = doc(collection(getFirebaseFirestore(), PQR_BATCH_REVIEW_COLLECTIONS.batchReview));
      batch.set(ref, record);
      existingNumbers.add(batchNumber.toLowerCase());
      created += 1;
    }

    if (created > 0) await batch.commit();
    await logBatchReviewAudit('pull batches from master completed', actor, { created, skipped }, pqr.id);
    return { created, skipped };
  } catch (e) {
    console.error('pullBatchesFromMaster failed', e);
    return { created: 0, skipped: 0, error: (e as Error).message };
  }
}

export async function createBatchReviewRecord(
  pqr: PqrOption,
  data: BatchReviewFormData,
  actor: PqrBatchReviewActor,
): Promise<{ id?: string; error?: string }> {
  if (!isFirebaseConfigured()) return { error: 'Firebase is not configured.' };

  const dup = await checkDuplicateBatch(pqr.id, data.batchNumber);
  if (dup) return { error: 'Duplicate batch number under this PQR is not allowed.' };

  try {
    const linked = await countLinked(data.batchNumber, pqr.productName);
    const ts = nowIso();
    const record: Omit<PqrBatchReviewRecord, 'id'> = {
      batchReviewId: buildBatchReviewId(data.batchNumber),
      pqrId: pqr.id,
      pqrNumber: pqr.pqrNumber,
      product: data.product,
      productCode: data.productCode,
      genericName: data.genericName,
      strength: data.strength,
      dosageForm: data.dosageForm,
      reviewPeriodFrom: pqr.reviewPeriodFrom,
      reviewPeriodTo: pqr.reviewPeriodTo,
      batchNumber: data.batchNumber,
      semiFinishedBatchNumber: data.semiFinishedBatchNumber,
      finishedProductBatchNumber: data.finishedProductBatchNumber,
      packingBatchNumber: data.packingBatchNumber,
      manufacturingDate: data.manufacturingDate,
      expiryDate: data.expiryDate,
      batchSize: data.batchSize,
      batchSizeUnit: data.batchSizeUnit,
      manufacturedFor: data.manufacturedFor,
      customerName: data.customerName,
      market: data.market,
      batchStatus: data.batchStatus,
      releaseStatus: data.releaseStatus,
      releaseDate: data.releaseDate,
      qaReleasedBy: data.qaReleasedBy,
      rejectionReason: data.rejectionReason,
      holdReason: data.holdReason,
      reworkRequired: data.reworkRequired,
      reprocessRequired: data.reprocessRequired,
      linkedDeviationCount: linked.deviations,
      linkedOosCount: linked.oos,
      linkedCapaCount: linked.capa,
      remarks: data.remarks,
      sourceType: 'manual',
      createdAt: ts,
      updatedAt: ts,
      createdBy: actor.id,
      updatedBy: actor.id,
      createdByName: actor.name,
      updatedByName: actor.name,
      isDeleted: false,
    };

    const docRef = await addDoc(collection(getFirebaseFirestore(), PQR_BATCH_REVIEW_COLLECTIONS.batchReview), record);
    await logBatchReviewAudit('create batch review record', actor, { batchNumber: data.batchNumber }, docRef.id);
    return { id: docRef.id };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function updateBatchReviewRecord(
  id: string,
  pqr: PqrOption,
  data: BatchReviewFormData,
  actor: PqrBatchReviewActor,
): Promise<{ error?: string }> {
  if (!isFirebaseConfigured()) return { error: 'Firebase is not configured.' };

  const dup = await checkDuplicateBatch(pqr.id, data.batchNumber, id);
  if (dup) return { error: 'Duplicate batch number under this PQR is not allowed.' };

  try {
    const linked = await countLinked(data.batchNumber, pqr.productName);
    await updateDoc(doc(getFirebaseFirestore(), PQR_BATCH_REVIEW_COLLECTIONS.batchReview, id), {
      ...data,
      linkedDeviationCount: linked.deviations,
      linkedOosCount: linked.oos,
      linkedCapaCount: linked.capa,
      updatedAt: nowIso(),
      updatedBy: actor.id,
      updatedByName: actor.name,
    });
    await logBatchReviewAudit('edit batch review record', actor, { id, batchNumber: data.batchNumber }, id);
    return {};
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function softDeleteBatchReviewRecord(
  id: string,
  actor: PqrBatchReviewActor,
): Promise<{ error?: string }> {
  if (!isFirebaseConfigured()) return { error: 'Firebase is not configured.' };
  try {
    await updateDoc(doc(getFirebaseFirestore(), PQR_BATCH_REVIEW_COLLECTIONS.batchReview, id), {
      isDeleted: true,
      updatedAt: nowIso(),
      updatedBy: actor.id,
      updatedByName: actor.name,
    });
    await logBatchReviewAudit('delete/soft delete batch record', actor, { id }, id);
    return {};
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function saveBatchSectionToPqr(
  pqrId: string,
  narrative: string,
  records: PqrBatchReviewRecord[],
  actor: PqrBatchReviewActor,
): Promise<{ error?: string }> {
  if (!isFirebaseConfigured()) return { error: 'Firebase is not configured.' };
  try {
    const summary = computeBatchSummary(records);
    const ts = nowIso();

    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), PQR_BATCH_REVIEW_COLLECTIONS.sections),
      where('pqrId', '==', pqrId),
      where('sectionKey', '==', 'batch_manufacturing'),
    ));

    if (snap.empty) {
      await addDoc(collection(getFirebaseFirestore(), PQR_BATCH_REVIEW_COLLECTIONS.sections), {
        pqrId,
        sectionKey: 'batch_manufacturing',
        sectionType: 'Batch Review',
        sectionOrder: 5,
        sectionTitle: 'Batch Manufacturing Details',
        narrative,
        dataSummary: JSON.stringify(summary),
        included: true,
        status: 'Draft',
        createdAt: ts,
        updatedAt: ts,
        createdBy: actor.id,
        updatedBy: actor.id,
        isDeleted: false,
      });
    } else {
      await updateDoc(snap.docs[0].ref, {
        narrative,
        dataSummary: JSON.stringify(summary),
        sectionType: 'Batch Review',
        updatedAt: ts,
        updatedBy: actor.id,
      });
    }

    await logBatchReviewAudit('section saved to PQR', actor, { pqrId, narrativeLength: narrative.length }, pqrId);
    return {};
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export function getBatchReviewSummary(records: PqrBatchReviewRecord[]): PqrBatchReviewSummary {
  const summary = computeBatchSummary(records);
  return summary;
}

export function getBatchReviewNarrative(records: PqrBatchReviewRecord[]): string {
  return generateBatchNarrative(computeBatchSummary(records));
}

export { buildBatchCharts, computeBatchSummary, generateBatchNarrative };

export async function logBatchReviewView(actor: PqrBatchReviewActor) {
  await logBatchReviewAudit('batch review viewed', actor);
}

export async function logBatchReviewExport(actor: PqrBatchReviewActor, type: 'excel' | 'import') {
  await logBatchReviewAudit(type === 'excel' ? 'export batch review' : 'import batch list', actor);
}

export async function logBatchReviewNarrativeEdit(actor: PqrBatchReviewActor, pqrId: string) {
  await logBatchReviewAudit('narrative edited', actor, { pqrId }, pqrId);
}

export async function logBatchReviewSummaryRecalc(actor: PqrBatchReviewActor, pqrId: string) {
  await logBatchReviewAudit('summary recalculated', actor, { pqrId }, pqrId);
}
