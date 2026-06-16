import {
  collection, doc, addDoc, getDoc, getDocs, updateDoc, query, where, limit, orderBy, writeBatch,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getFirebaseFirestore, getFirebaseStorage, isFirebaseConfigured } from '@/lib/firebase';
import { createAuditLog, writeAuditTrail } from '@/lib/audit-trail';
import { CPV_COLLECTIONS } from '@/lib/cpv';
import { CPV_BATCH_COLLECTION } from '@/lib/cpv-batch-registration';
import { PACKING_MATERIAL_LEGACY_COLLECTION, PACKING_MATERIAL_MONITORING_COLLECTION } from '@/lib/cpv-packing-material-monitoring';
import type { PqrOption } from '@/lib/pqr-batch-review-records';
import { fetchPqrOptions } from '@/lib/pqr-batch-review-service';
import {
  PQR_PACKAGING_REVIEW_COLLECTIONS, PQR_PACKAGING_REVIEW_MODULE,
  computePackagingCompliance, computePackagingSummary, generatePackagingNarrative,
  inferPackagingType, normalizePackagingCategory,
  type PackagingReviewFormData, type PqrPackagingReviewRecord,
} from '@/lib/pqr-packaging-review-records';

export type PqrPackagingReviewActor = { id: string; name: string; role?: string };

export { fetchPqrOptions };

const nowIso = () => new Date().toISOString();
const str = (v: unknown, fb = '') => (v === null || v === undefined ? fb : String(v));
const num = (v: unknown, fb = 0) => { const n = Number(v); return Number.isFinite(n) ? n : fb; };

function buildPackagingReviewId(materialName: string, arNumber: string) {
  return `PPR-${materialName.slice(0, 8).toUpperCase().replace(/\s+/g, '-')}-${arNumber}-${Date.now().toString(36).toUpperCase()}`;
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

async function logPackagingAudit(actionType: string, actor: PqrPackagingReviewActor, detail?: unknown, recordId = 'packaging-review') {
  try {
    await createAuditLog({
      moduleName: PQR_PACKAGING_REVIEW_MODULE,
      collectionName: PQR_PACKAGING_REVIEW_COLLECTIONS.packagingReview,
      recordId,
      actionType,
      newValue: detail,
      user: { id: actor.id, name: actor.name },
      status: 'Success',
    });
    await writeAuditTrail({
      collectionName: PQR_PACKAGING_REVIEW_COLLECTIONS.packagingReview,
      documentId: recordId,
      action: actionType,
      oldValue: null,
      newValue: detail,
      userId: actor.id,
      userName: actor.name,
      moduleName: PQR_PACKAGING_REVIEW_MODULE,
    });
  } catch (e) {
    console.error('logPackagingAudit failed', e);
  }
}

async function resolveVendorAvl(supplierName: string, manufacturerName: string, vendors: Record<string, unknown>[], avl: Record<string, unknown>[]): Promise<string> {
  const name = supplierName || manufacturerName;
  const match = [...vendors, ...avl].find((v) => {
    const vn = str(v.vendorName || v.supplierName || v.manufacturerName || v.name);
    return vn.toLowerCase() === name.toLowerCase() || name.toLowerCase().includes(vn.toLowerCase());
  });
  if (!match) return 'Not Approved';
  const status = str(match.avlStatus || match.avl_status || match.status, 'Not Approved');
  if (status.toLowerCase().includes('approved') && !status.toLowerCase().includes('not')) return 'Approved';
  if (status.toLowerCase().includes('conditional')) return 'Conditional Approved';
  if (status.toLowerCase().includes('block')) return 'Blocked';
  return status || 'Not Approved';
}

function mapPackagingType(raw: Record<string, unknown>, category: string, materialName: string): string {
  const t = str(raw.packagingMaterialType || raw.materialType || raw.material_type || raw.packaging_type);
  if (t.includes('Primary')) return 'Primary Packaging Material';
  if (t.includes('Secondary')) return 'Secondary Packaging Material';
  if (t.includes('Tertiary')) return 'Tertiary Packaging Material';
  return inferPackagingType(category, materialName);
}

function isPackingWarehouseRecord(raw: Record<string, unknown>): boolean {
  const type = str(raw.materialType || raw.material_type || raw.category).toLowerCase();
  return type.includes('pack') || type.includes('packaging') || type.includes('label') || type.includes('carton');
}

function mapToPackagingRecord(
  raw: Record<string, unknown>,
  pqr: PqrOption,
  batchNumber: string,
  sourceType: 'packing_material_monitoring' | 'warehouse',
  vendorAvlStatus: string,
  actor: PqrPackagingReviewActor,
): Omit<PqrPackagingReviewRecord, 'id'> {
  const ts = nowIso();
  const materialName = str(raw.materialName || raw.material_name || raw.packagingMaterial);
  const category = normalizePackagingCategory(str(raw.packagingMaterialCategory || raw.materialCategory || raw.material_category || raw.category));
  const packagingMaterialType = mapPackagingType(raw, category, materialName);
  const issuedQuantity = num(raw.issuedQuantity || raw.issued_quantity || raw.issuedQty || raw.quantityIssued);
  const usedQuantity = num(raw.usedQuantity || raw.used_quantity || raw.usedQty || raw.quantityUsed);
  const rejectedQuantity = num(raw.rejectedQuantity || raw.rejected_quantity || raw.rejectedQty || raw.quantityRejected);
  const returnedQuantity = num(raw.returnedQuantity || raw.returned_quantity || raw.returnedQty || raw.quantityReturned);

  const partial: Partial<PqrPackagingReviewRecord> = {
    packagingReviewId: buildPackagingReviewId(materialName, str(raw.arNumber || raw.ar_number || raw.arNo || raw.arNo)),
    pqrId: pqr.id,
    pqrNumber: pqr.pqrNumber,
    product: pqr.productName,
    productCode: pqr.productCode,
    batchNumber: batchNumber || str(raw.batchNumber || raw.batch_number || raw.batchNo),
    packagingMaterialType,
    packagingMaterialCategory: category,
    materialCode: str(raw.materialCode || raw.material_code),
    materialName,
    manufacturerName: str(raw.manufacturerName || raw.manufacturer_name || raw.manufacturer),
    supplierName: str(raw.supplierName || raw.supplier_name || raw.vendorName || raw.vendor_name),
    vendorAvlStatus,
    grnNumber: str(raw.grnNumber || raw.grn_number || raw.grnNo),
    arNumber: str(raw.arNumber || raw.ar_number || raw.arNo),
    coaNumber: str(raw.coaNumber || raw.coa_number),
    materialLotNumber: str(raw.materialLotNumber || raw.lotNo || raw.lot_number || raw.lotNo),
    mfgDate: str(raw.mfgDate || raw.manufacturingDate || raw.manufacturing_date).slice(0, 10),
    expDate: str(raw.expDate || raw.expiryDate || raw.expiry_date).slice(0, 10),
    receivedQuantity: num(raw.receivedQuantity || raw.received_quantity || raw.receivedQty || raw.quantityReceived),
    issuedQuantity,
    usedQuantity,
    rejectedQuantity,
    returnedQuantity,
    unit: str(raw.unit || raw.uom, 'Nos'),
    qcStatus: str(raw.qcStatus || raw.qc_status || raw.status, 'Approved'),
    coaAvailable: str(raw.coaAvailable || raw.coa_available, 'Yes') === 'Yes' ? 'Yes' : 'No',
    specificationNumber: str(raw.specificationNumber || raw.specificationNo || raw.specification_number),
    stpNumber: str(raw.stpNumber || raw.stpNo || raw.stp_number),
    remarks: str(raw.remarks),
    sourceType,
    sourceId: str(raw.id),
    attachmentUrls: [],
    createdAt: ts,
    updatedAt: ts,
    createdBy: actor.id,
    updatedBy: actor.id,
    createdByName: actor.name,
    updatedByName: actor.name,
    isDeleted: false,
  };

  const computed = computePackagingCompliance(partial);
  return { ...partial, ...computed } as Omit<PqrPackagingReviewRecord, 'id'>;
}

export async function fetchPackagingReviewRecords(pqrId: string): Promise<PqrPackagingReviewRecord[]> {
  if (!isFirebaseConfigured()) return [];
  try {
    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), PQR_PACKAGING_REVIEW_COLLECTIONS.packagingReview),
      where('pqrId', '==', pqrId),
      where('isDeleted', '==', false),
    ));
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() } as PqrPackagingReviewRecord))
      .sort((a, b) => a.materialName.localeCompare(b.materialName));
  } catch {
    try {
      const snap = await getDocs(query(
        collection(getFirebaseFirestore(), PQR_PACKAGING_REVIEW_COLLECTIONS.packagingReview),
        where('pqrId', '==', pqrId),
      ));
      return snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as PqrPackagingReviewRecord))
        .filter((r) => !r.isDeleted)
        .sort((a, b) => a.materialName.localeCompare(b.materialName));
    } catch (e) {
      console.error('fetchPackagingReviewRecords failed', e);
      return [];
    }
  }
}

async function getBatchNumbersForPqr(pqr: PqrOption): Promise<string[]> {
  const batchReview = await getDocs(query(
    collection(getFirebaseFirestore(), PQR_PACKAGING_REVIEW_COLLECTIONS.batchReview),
    where('pqrId', '==', pqr.id),
    where('isDeleted', '==', false),
  )).catch(() => null);

  let numbers: string[] = [];
  if (batchReview && !batchReview.empty) {
    numbers = batchReview.docs.map((d) => str(d.data().batchNumber));
  } else {
    const [batches, cpvBatches] = await Promise.all([
      readFirst([PQR_PACKAGING_REVIEW_COLLECTIONS.batches]),
      readCollection(CPV_BATCH_COLLECTION),
    ]);
    numbers = [...batches, ...cpvBatches]
      .filter((b) => str(b.productCode || b.product_code).toLowerCase() === pqr.productCode.toLowerCase())
      .map((b) => str(b.batchNumber || b.batch_number));
  }
  return Array.from(new Set(numbers.filter(Boolean)));
}

export async function pullPackagingData(
  pqr: PqrOption,
  actor: PqrPackagingReviewActor,
): Promise<{ created: number; skipped: number; error?: string }> {
  if (!isFirebaseConfigured()) return { created: 0, skipped: 0, error: 'Firebase is not configured.' };

  try {
    await logPackagingAudit('pull packaging data', actor, { pqrId: pqr.id }, pqr.id);

    const [batchNumbers, existing, packingMonitoring, warehouse, vendors, avl] = await Promise.all([
      getBatchNumbersForPqr(pqr),
      fetchPackagingReviewRecords(pqr.id),
      readFirst([PACKING_MATERIAL_MONITORING_COLLECTION, PACKING_MATERIAL_LEGACY_COLLECTION, CPV_COLLECTIONS.packingMaterials]),
      readFirst([PQR_PACKAGING_REVIEW_COLLECTIONS.warehouseMaterials]),
      readCollection(PQR_PACKAGING_REVIEW_COLLECTIONS.vendors),
      readFirst([PQR_PACKAGING_REVIEW_COLLECTIONS.approvedVendorList, 'vendor_avl']),
    ]);

    const existingAr = new Set(existing.map((r) => `${r.arNumber}|${r.materialName}`.toLowerCase()));
    const batchSet = new Set(batchNumbers.map((b) => b.toLowerCase()));
    const candidates: Array<{ raw: Record<string, unknown>; batchNumber: string; source: 'packing_material_monitoring' | 'warehouse' }> = [];

    packingMonitoring.forEach((raw) => {
      const bn = str(raw.batchNumber || raw.batch_number || raw.batchNo);
      if (batchSet.size && !batchSet.has(bn.toLowerCase())) return;
      candidates.push({ raw, batchNumber: bn, source: 'packing_material_monitoring' });
    });

    warehouse.filter(isPackingWarehouseRecord).forEach((raw) => {
      const bn = str(raw.batchNumber || raw.batch_number || raw.batchNo);
      if (batchSet.size && bn && !batchSet.has(bn.toLowerCase())) return;
      const productMatch = str(raw.productCode || raw.product_code).toLowerCase() === pqr.productCode.toLowerCase()
        || str(raw.productName || raw.product_name).toLowerCase().includes(pqr.productName.toLowerCase());
      if (!productMatch && batchSet.size) return;
      candidates.push({ raw, batchNumber: bn, source: 'warehouse' });
    });

    let created = 0;
    let skipped = 0;
    const batch = writeBatch(getFirebaseFirestore());

    for (const { raw, batchNumber, source } of candidates) {
      const ar = str(raw.arNumber || raw.ar_number || raw.arNo);
      const matName = str(raw.materialName || raw.material_name || raw.packagingMaterial);
      const key = `${ar}|${matName}`.toLowerCase();
      if (!ar || existingAr.has(key)) {
        skipped += 1;
        continue;
      }
      const supplier = str(raw.supplierName || raw.supplier_name || raw.vendorName);
      const manufacturer = str(raw.manufacturerName || raw.manufacturer_name || raw.manufacturer);
      const avlStatus = await resolveVendorAvl(supplier, manufacturer, vendors, avl);
      const record = mapToPackagingRecord(raw, pqr, batchNumber, source, avlStatus, actor);
      const refDoc = doc(collection(getFirebaseFirestore(), PQR_PACKAGING_REVIEW_COLLECTIONS.packagingReview));
      batch.set(refDoc, record);
      existingAr.add(key);
      created += 1;
    }

    if (created > 0) await batch.commit();
    await logPackagingAudit('vendor AVL checked', actor, { created, skipped }, pqr.id);
    await logPackagingAudit('reconciliation recalculated', actor, { created }, pqr.id);
    return { created, skipped };
  } catch (e) {
    console.error('pullPackagingData failed', e);
    return { created: 0, skipped: 0, error: (e as Error).message };
  }
}

export async function checkDuplicatePackagingAr(
  pqrId: string, arNumber: string, materialName: string, excludeId?: string,
): Promise<boolean> {
  const records = await fetchPackagingReviewRecords(pqrId);
  return records.some((r) =>
    r.arNumber.toLowerCase() === arNumber.toLowerCase()
    && r.materialName.toLowerCase() === materialName.toLowerCase()
    && r.id !== excludeId,
  );
}

function formToRecordFields(
  pqr: PqrOption,
  data: PackagingReviewFormData,
  existingRecords: PqrPackagingReviewRecord[],
): Omit<PqrPackagingReviewRecord, 'id' | 'packagingReviewId' | 'createdAt' | 'createdBy' | 'createdByName' | 'isDeleted'> {
  const computed = computePackagingCompliance({ ...data, vendorAvlStatus: data.vendorAvlStatus }, existingRecords);
  return {
    pqrId: pqr.id,
    pqrNumber: pqr.pqrNumber,
    product: data.product,
    productCode: data.productCode,
    batchNumber: data.batchNumber,
    packagingMaterialType: data.packagingMaterialType,
    packagingMaterialCategory: data.packagingMaterialCategory,
    materialCode: data.materialCode,
    materialName: data.materialName,
    manufacturerName: data.manufacturerName,
    supplierName: data.supplierName,
    vendorAvlStatus: data.vendorAvlStatus,
    grnNumber: data.grnNumber,
    arNumber: data.arNumber,
    coaNumber: data.coaNumber,
    materialLotNumber: data.materialLotNumber,
    mfgDate: data.mfgDate,
    expDate: data.expDate,
    receivedQuantity: data.receivedQuantity,
    issuedQuantity: data.issuedQuantity,
    usedQuantity: data.usedQuantity,
    rejectedQuantity: data.rejectedQuantity,
    returnedQuantity: data.returnedQuantity,
    balanceQuantity: computed.balanceQuantity,
    unit: data.unit,
    qcStatus: data.qcStatus,
    coaAvailable: data.coaAvailable,
    specificationNumber: data.specificationNumber,
    stpNumber: data.stpNumber,
    reconciliationStatus: computed.reconciliationStatus,
    complianceStatus: computed.complianceStatus,
    complianceReasons: computed.complianceReasons,
    riskLevel: computed.riskLevel,
    remarks: data.remarks,
    sourceType: 'manual',
    attachmentUrls: [],
    updatedAt: nowIso(),
    updatedBy: '',
    updatedByName: '',
  };
}

export async function createPackagingReviewRecord(
  pqr: PqrOption,
  data: PackagingReviewFormData,
  actor: PqrPackagingReviewActor,
): Promise<{ id?: string; error?: string }> {
  if (!isFirebaseConfigured()) return { error: 'Firebase is not configured.' };
  if (await checkDuplicatePackagingAr(pqr.id, data.arNumber, data.materialName)) {
    return { error: 'Duplicate AR Number for this packaging material under the same PQR.' };
  }

  try {
    const existing = await fetchPackagingReviewRecords(pqr.id);
    const ts = nowIso();
    const fields = formToRecordFields(pqr, data, existing);
    const record: Omit<PqrPackagingReviewRecord, 'id'> = {
      packagingReviewId: buildPackagingReviewId(data.materialName, data.arNumber),
      ...fields,
      createdAt: ts,
      updatedAt: ts,
      createdBy: actor.id,
      updatedBy: actor.id,
      createdByName: actor.name,
      updatedByName: actor.name,
      isDeleted: false,
    };

    const docRef = await addDoc(collection(getFirebaseFirestore(), PQR_PACKAGING_REVIEW_COLLECTIONS.packagingReview), record);
    await logPackagingAudit('create packaging review record', actor, { arNumber: data.arNumber }, docRef.id);
    await logPackagingAudit('compliance recalculated', actor, { complianceStatus: record.complianceStatus }, docRef.id);
    await logPackagingAudit('reconciliation recalculated', actor, { reconciliationStatus: record.reconciliationStatus }, docRef.id);
    return { id: docRef.id };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function updatePackagingReviewRecord(
  id: string,
  pqr: PqrOption,
  data: PackagingReviewFormData,
  actor: PqrPackagingReviewActor,
): Promise<{ error?: string }> {
  if (!isFirebaseConfigured()) return { error: 'Firebase is not configured.' };
  if (await checkDuplicatePackagingAr(pqr.id, data.arNumber, data.materialName, id)) {
    return { error: 'Duplicate AR Number for this packaging material under the same PQR.' };
  }

  try {
    const existing = await fetchPackagingReviewRecords(pqr.id);
    const fields = formToRecordFields(pqr, data, existing);
    await updateDoc(doc(getFirebaseFirestore(), PQR_PACKAGING_REVIEW_COLLECTIONS.packagingReview, id), {
      ...fields,
      updatedBy: actor.id,
      updatedByName: actor.name,
    });
    await logPackagingAudit('edit packaging review record', actor, { id, arNumber: data.arNumber }, id);
    await logPackagingAudit('compliance recalculated', actor, { complianceStatus: fields.complianceStatus }, id);
    await logPackagingAudit('reconciliation recalculated', actor, { reconciliationStatus: fields.reconciliationStatus }, id);
    return {};
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function softDeletePackagingReviewRecord(id: string, actor: PqrPackagingReviewActor): Promise<{ error?: string }> {
  if (!isFirebaseConfigured()) return { error: 'Firebase is not configured.' };
  try {
    await updateDoc(doc(getFirebaseFirestore(), PQR_PACKAGING_REVIEW_COLLECTIONS.packagingReview, id), {
      isDeleted: true,
      updatedAt: nowIso(),
      updatedBy: actor.id,
    });
    await logPackagingAudit('delete/soft delete packaging record', actor, { id }, id);
    return {};
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function savePackagingSectionToPqr(
  pqrId: string,
  narrative: string,
  records: PqrPackagingReviewRecord[],
  actor: PqrPackagingReviewActor,
): Promise<{ error?: string }> {
  if (!isFirebaseConfigured()) return { error: 'Firebase is not configured.' };
  try {
    const summary = computePackagingSummary(records);
    const ts = nowIso();
    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), PQR_PACKAGING_REVIEW_COLLECTIONS.sections),
      where('pqrId', '==', pqrId),
      where('sectionKey', '==', 'packing_material'),
    ));

    const payload = {
      pqrId,
      sectionKey: 'packing_material',
      sectionType: 'Packaging Review',
      sectionOrder: 7,
      sectionTitle: 'Packing Material Review',
      narrative,
      dataSummary: JSON.stringify(summary),
      included: true,
      status: 'Draft',
      updatedAt: ts,
      updatedBy: actor.id,
    };

    if (snap.empty) {
      await addDoc(collection(getFirebaseFirestore(), PQR_PACKAGING_REVIEW_COLLECTIONS.sections), {
        ...payload,
        createdAt: ts,
        createdBy: actor.id,
        isDeleted: false,
      });
    } else {
      await updateDoc(snap.docs[0].ref, payload);
    }

    await logPackagingAudit('section saved to PQR', actor, { pqrId }, pqrId);
    return {};
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function uploadPackagingAttachment(
  pqrId: string,
  recordId: string,
  file: File,
  actor: PqrPackagingReviewActor,
): Promise<{ url?: string; error?: string }> {
  if (!isFirebaseConfigured()) return { error: 'Firebase is not configured.' };
  try {
    const path = `pqr/${pqrId}/packaging-review/${recordId}/${Date.now()}_${file.name}`;
    const storageRef = ref(getFirebaseStorage(), path);
    await uploadBytes(storageRef, file);
    const url = await getDownloadURL(storageRef);

    const docRef = doc(getFirebaseFirestore(), PQR_PACKAGING_REVIEW_COLLECTIONS.packagingReview, recordId);
    const snap = await getDoc(docRef);
    const existing = (snap.data()?.attachmentUrls as string[] | undefined) || [];
    await updateDoc(docRef, {
      attachmentUrls: [...existing, url],
      updatedAt: nowIso(),
      updatedBy: actor.id,
    });

    await logPackagingAudit('attachment uploaded', actor, { recordId, fileName: file.name }, recordId);
    return { url };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export function getPackagingReviewNarrative(records: PqrPackagingReviewRecord[]): string {
  return generatePackagingNarrative(computePackagingSummary(records), records);
}

export { computePackagingSummary, generatePackagingNarrative, buildPackagingCharts, buildPackagingVendorAvlRows } from '@/lib/pqr-packaging-review-records';

export async function logPackagingReviewView(actor: PqrPackagingReviewActor) {
  await logPackagingAudit('packaging review viewed', actor);
}

export async function logPackagingReviewExport(actor: PqrPackagingReviewActor, type: 'excel' | 'import') {
  await logPackagingAudit(type === 'excel' ? 'export packaging review' : 'import packaging list', actor);
}

export async function logPackagingNarrativeEdit(actor: PqrPackagingReviewActor, pqrId: string) {
  await logPackagingAudit('narrative edited', actor, { pqrId }, pqrId);
}

function isPackagingRelatedRecord(
  raw: Record<string, unknown>,
  batchNumbers: string[],
  materialNames: string[],
): boolean {
  const batchSet = new Set(batchNumbers.map((b) => b.toLowerCase()).filter(Boolean));
  const materialSet = new Set(materialNames.map((m) => m.toLowerCase()).filter(Boolean));
  const category = str(raw.category || raw.deviationType || raw.type || raw.module || raw.source).toLowerCase();
  const materialName = str(raw.materialName || raw.material_name || raw.itemName).toLowerCase();
  const batchNumber = str(raw.batchNumber || raw.batch_number || raw.batchNo).toLowerCase();
  const relatesByCategory = category.includes('pack') || category.includes('label') || category.includes('carton');
  const relatesByMaterial = materialName.length > 0 && (
    materialSet.has(materialName) || Array.from(materialSet).some((m) => materialName.includes(m) || m.includes(materialName))
  );
  const relatesByBatch = batchNumber.length > 0 && batchSet.has(batchNumber);
  return relatesByCategory || relatesByMaterial || relatesByBatch;
}

export async function fetchPackagingQualityMetrics(
  pqr: PqrOption,
  records: PqrPackagingReviewRecord[],
): Promise<{ packagingDeviationCount: number; packagingCapaCount: number }> {
  if (!isFirebaseConfigured()) return { packagingDeviationCount: 0, packagingCapaCount: 0 };

  try {
    const batchNumbers = Array.from(new Set(records.map((r) => r.batchNumber).filter(Boolean)));
    const materialNames = Array.from(new Set(records.map((r) => r.materialName).filter(Boolean)));
    const [deviations, capaRecords] = await Promise.all([
      readFirst([PQR_PACKAGING_REVIEW_COLLECTIONS.deviations, 'deviation']),
      readFirst([PQR_PACKAGING_REVIEW_COLLECTIONS.capaRecords, 'capa']),
    ]);

    const from = pqr.reviewPeriodFrom?.slice(0, 10) || '';
    const to = pqr.reviewPeriodTo?.slice(0, 10) || '';
    const inPeriod = (raw: Record<string, unknown>) => {
      const date = str(raw.createdAt || raw.created_at || raw.reportedDate || raw.reported_date || raw.date).slice(0, 10);
      if (!from || !to || !date) return true;
      return date >= from && date <= to;
    };

    const packagingDeviationCount = deviations.filter((r) =>
      inPeriod(r) && isPackagingRelatedRecord(r, batchNumbers, materialNames),
    ).length;
    const packagingCapaCount = capaRecords.filter((r) =>
      inPeriod(r) && isPackagingRelatedRecord(r, batchNumbers, materialNames),
    ).length;

    return { packagingDeviationCount, packagingCapaCount };
  } catch (e) {
    console.error('fetchPackagingQualityMetrics failed', e);
    return { packagingDeviationCount: 0, packagingCapaCount: 0 };
  }
}

export async function recalculateAllPackagingCompliance(pqrId: string, actor: PqrPackagingReviewActor): Promise<void> {
  const records = await fetchPackagingReviewRecords(pqrId);
  for (const r of records) {
    if (!r.id) continue;
    const computed = computePackagingCompliance(r, records);
    await updateDoc(doc(getFirebaseFirestore(), PQR_PACKAGING_REVIEW_COLLECTIONS.packagingReview, r.id), {
      complianceStatus: computed.complianceStatus,
      complianceReasons: computed.complianceReasons,
      riskLevel: computed.riskLevel,
      balanceQuantity: computed.balanceQuantity,
      reconciliationStatus: computed.reconciliationStatus,
      updatedAt: nowIso(),
      updatedBy: actor.id,
    });
  }
  await logPackagingAudit('compliance recalculated', actor, { count: records.length }, pqrId);
  await logPackagingAudit('reconciliation recalculated', actor, { count: records.length }, pqrId);
}
