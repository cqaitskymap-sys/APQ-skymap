import {
  collection, doc, addDoc, getDoc, getDocs, updateDoc, query, where, limit, orderBy, writeBatch,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getFirebaseFirestore, getFirebaseStorage, isFirebaseConfigured } from '@/lib/firebase';
import { createAuditLog, writeAuditTrail } from '@/lib/audit-trail';
import { CPV_COLLECTIONS } from '@/lib/cpv';
import { CPV_BATCH_COLLECTION } from '@/lib/cpv-batch-registration';
import type { PqrOption } from '@/lib/pqr-batch-review-records';
import { fetchPqrOptions } from '@/lib/pqr-batch-review-service';
import {
  PQR_MATERIAL_REVIEW_COLLECTIONS, PQR_MATERIAL_REVIEW_MODULE,
  computeMaterialCompliance, computeMaterialSummary, generateMaterialNarrative,
  type MaterialReviewFormData, type PqrMaterialReviewRecord,
} from '@/lib/pqr-material-review-records';

export type PqrMaterialReviewActor = { id: string; name: string; role?: string };

export { fetchPqrOptions };

const nowIso = () => new Date().toISOString();
const str = (v: unknown, fb = '') => (v === null || v === undefined ? fb : String(v));
const num = (v: unknown, fb = 0) => { const n = Number(v); return Number.isFinite(n) ? n : fb; };

function buildMaterialReviewId(materialName: string, arNumber: string) {
  return `PMR-${materialName.slice(0, 8).toUpperCase().replace(/\s+/g, '-')}-${arNumber}-${Date.now().toString(36).toUpperCase()}`;
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

async function logMaterialAudit(actionType: string, actor: PqrMaterialReviewActor, detail?: unknown, recordId = 'material-review') {
  try {
    await createAuditLog({
      moduleName: PQR_MATERIAL_REVIEW_MODULE,
      collectionName: PQR_MATERIAL_REVIEW_COLLECTIONS.materialReview,
      recordId,
      actionType,
      newValue: detail,
      user: { id: actor.id, name: actor.name },
      status: 'Success',
    });
    await writeAuditTrail({
      collectionName: PQR_MATERIAL_REVIEW_COLLECTIONS.materialReview,
      documentId: recordId,
      action: actionType,
      oldValue: null,
      newValue: detail,
      userId: actor.id,
      userName: actor.name,
      moduleName: PQR_MATERIAL_REVIEW_MODULE,
    });
  } catch (e) {
    console.error('logMaterialAudit failed', e);
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

function mapToReviewRecord(
  raw: Record<string, unknown>,
  pqr: PqrOption,
  batchNumber: string,
  sourceType: 'raw_material_monitoring' | 'warehouse',
  vendorAvlStatus: string,
  actor: PqrMaterialReviewActor,
): Omit<PqrMaterialReviewRecord, 'id'> {
  const ts = nowIso();
  const partial: Partial<PqrMaterialReviewRecord> = {
    materialReviewId: buildMaterialReviewId(str(raw.materialName || raw.material_name), str(raw.arNumber || raw.ar_number || raw.arNo)),
    pqrId: pqr.id,
    pqrNumber: pqr.pqrNumber,
    product: pqr.productName,
    productCode: pqr.productCode,
    batchNumber: batchNumber || str(raw.batchNumber || raw.batch_number),
    materialType: str(raw.materialType || raw.material_type, 'Raw Material'),
    materialCode: str(raw.materialCode || raw.material_code),
    materialName: str(raw.materialName || raw.material_name),
    materialGrade: str(raw.materialGrade || raw.grade || raw.material_grade, 'IP'),
    manufacturerName: str(raw.manufacturerName || raw.manufacturer_name || raw.manufacturer),
    supplierName: str(raw.supplierName || raw.supplier_name || raw.vendorName || raw.vendor_name),
    vendorAvlStatus,
    grnNumber: str(raw.grnNumber || raw.grn_number || raw.grnNo),
    arNumber: str(raw.arNumber || raw.ar_number || raw.arNo),
    coaNumber: str(raw.coaNumber || raw.coa_number),
    materialLotNumber: str(raw.materialLotNumber || raw.lotNo || raw.lot_number || raw.lotNo),
    mfgDate: str(raw.mfgDate || raw.manufacturingDate || raw.manufacturing_date).slice(0, 10),
    expDate: str(raw.expDate || raw.expiryDate || raw.expiry_date).slice(0, 10),
    retestDate: str(raw.retestDate || raw.retest_date).slice(0, 10),
    receivedQuantity: num(raw.receivedQuantity || raw.received_quantity || raw.receivedQty),
    issuedQuantity: num(raw.issuedQuantity || raw.issued_quantity || raw.issuedQty),
    usedQuantity: num(raw.usedQuantity || raw.used_quantity || raw.usedQty || raw.consumed_quantity, 1),
    unit: str(raw.unit || raw.uom, 'Kg'),
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

  const compliance = computeMaterialCompliance(partial);
  return {
    ...partial,
    ...compliance,
  } as Omit<PqrMaterialReviewRecord, 'id'>;
}

export async function fetchMaterialReviewRecords(pqrId: string): Promise<PqrMaterialReviewRecord[]> {
  if (!isFirebaseConfigured()) return [];
  try {
    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), PQR_MATERIAL_REVIEW_COLLECTIONS.materialReview),
      where('pqrId', '==', pqrId),
      where('isDeleted', '==', false),
    ));
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() } as PqrMaterialReviewRecord))
      .sort((a, b) => a.materialName.localeCompare(b.materialName));
  } catch {
    try {
      const snap = await getDocs(query(
        collection(getFirebaseFirestore(), PQR_MATERIAL_REVIEW_COLLECTIONS.materialReview),
        where('pqrId', '==', pqrId),
      ));
      return snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as PqrMaterialReviewRecord))
        .filter((r) => !r.isDeleted)
        .sort((a, b) => a.materialName.localeCompare(b.materialName));
    } catch (e) {
      console.error('fetchMaterialReviewRecords failed', e);
      return [];
    }
  }
}

async function getBatchNumbersForPqr(pqr: PqrOption): Promise<string[]> {
  const batchReview = await getDocs(query(
    collection(getFirebaseFirestore(), PQR_MATERIAL_REVIEW_COLLECTIONS.batchReview),
    where('pqrId', '==', pqr.id),
    where('isDeleted', '==', false),
  )).catch(() => null);

  let numbers: string[] = [];
  if (batchReview && !batchReview.empty) {
    numbers = batchReview.docs.map((d) => str(d.data().batchNumber));
  } else {
    const [batches, cpvBatches] = await Promise.all([
      readFirst([PQR_MATERIAL_REVIEW_COLLECTIONS.batches]),
      readCollection(CPV_BATCH_COLLECTION),
    ]);
    numbers = [...batches, ...cpvBatches]
      .filter((b) => {
        const code = str(b.productCode || b.product_code).toLowerCase();
        return code === pqr.productCode.toLowerCase();
      })
      .map((b) => str(b.batchNumber || b.batch_number));
  }
  return Array.from(new Set(numbers.filter(Boolean)));
}

export async function pullMaterialData(
  pqr: PqrOption,
  actor: PqrMaterialReviewActor,
): Promise<{ created: number; skipped: number; error?: string }> {
  if (!isFirebaseConfigured()) return { created: 0, skipped: 0, error: 'Firebase is not configured.' };

  try {
    await logMaterialAudit('pull material data', actor, { pqrId: pqr.id }, pqr.id);

    const [batchNumbers, existing, rawMonitoring, warehouse, vendors, avl] = await Promise.all([
      getBatchNumbersForPqr(pqr),
      fetchMaterialReviewRecords(pqr.id),
      readFirst([PQR_MATERIAL_REVIEW_COLLECTIONS.rawMaterialMonitoring, CPV_COLLECTIONS.rawMaterials]),
      readFirst([PQR_MATERIAL_REVIEW_COLLECTIONS.warehouseMaterials]),
      readCollection(PQR_MATERIAL_REVIEW_COLLECTIONS.vendors),
      readFirst([PQR_MATERIAL_REVIEW_COLLECTIONS.approvedVendorList, 'vendor_avl']),
    ]);

    const existingAr = new Set(existing.map((r) => `${r.arNumber}|${r.materialName}`.toLowerCase()));
    const batchSet = new Set(batchNumbers.map((b) => b.toLowerCase()));
    const candidates: Array<{ raw: Record<string, unknown>; batchNumber: string; source: 'raw_material_monitoring' | 'warehouse' }> = [];

    rawMonitoring.forEach((raw) => {
      const bn = str(raw.batchNumber || raw.batch_number || raw.batchNo);
      if (batchSet.size && !batchSet.has(bn.toLowerCase())) return;
      candidates.push({ raw, batchNumber: bn, source: 'raw_material_monitoring' });
    });

    warehouse.forEach((raw) => {
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
      const matName = str(raw.materialName || raw.material_name);
      const key = `${ar}|${matName}`.toLowerCase();
      if (!ar || existingAr.has(key)) {
        skipped += 1;
        continue;
      }
      const supplier = str(raw.supplierName || raw.supplier_name || raw.vendorName);
      const manufacturer = str(raw.manufacturerName || raw.manufacturer_name || raw.manufacturer);
      const avlStatus = await resolveVendorAvl(supplier, manufacturer, vendors, avl);
      const record = mapToReviewRecord(raw, pqr, batchNumber, source, avlStatus, actor);
      const refDoc = doc(collection(getFirebaseFirestore(), PQR_MATERIAL_REVIEW_COLLECTIONS.materialReview));
      batch.set(refDoc, record);
      existingAr.add(key);
      created += 1;
    }

    if (created > 0) await batch.commit();
    await logMaterialAudit('vendor AVL checked', actor, { created, skipped }, pqr.id);
    return { created, skipped };
  } catch (e) {
    console.error('pullMaterialData failed', e);
    return { created: 0, skipped: 0, error: (e as Error).message };
  }
}

export async function checkDuplicateAr(pqrId: string, arNumber: string, materialName: string, excludeId?: string): Promise<boolean> {
  const records = await fetchMaterialReviewRecords(pqrId);
  return records.some((r) =>
    r.arNumber.toLowerCase() === arNumber.toLowerCase()
    && r.materialName.toLowerCase() === materialName.toLowerCase()
    && r.id !== excludeId,
  );
}

export async function createMaterialReviewRecord(
  pqr: PqrOption,
  data: MaterialReviewFormData,
  actor: PqrMaterialReviewActor,
): Promise<{ id?: string; error?: string }> {
  if (!isFirebaseConfigured()) return { error: 'Firebase is not configured.' };
  if (await checkDuplicateAr(pqr.id, data.arNumber, data.materialName)) {
    return { error: 'Duplicate AR Number for this material under the same PQR.' };
  }

  try {
    const compliance = computeMaterialCompliance({
      ...data,
      vendorAvlStatus: data.vendorAvlStatus,
    });
    const ts = nowIso();
    const record: Omit<PqrMaterialReviewRecord, 'id'> = {
      materialReviewId: buildMaterialReviewId(data.materialName, data.arNumber),
      pqrId: pqr.id,
      pqrNumber: pqr.pqrNumber,
      product: data.product,
      productCode: data.productCode,
      batchNumber: data.batchNumber,
      materialType: data.materialType,
      materialCode: data.materialCode,
      materialName: data.materialName,
      materialGrade: data.materialGrade,
      manufacturerName: data.manufacturerName,
      supplierName: data.supplierName,
      vendorAvlStatus: data.vendorAvlStatus,
      grnNumber: data.grnNumber,
      arNumber: data.arNumber,
      coaNumber: data.coaNumber,
      materialLotNumber: data.materialLotNumber,
      mfgDate: data.mfgDate,
      expDate: data.expDate,
      retestDate: data.retestDate,
      receivedQuantity: data.receivedQuantity,
      issuedQuantity: data.issuedQuantity,
      usedQuantity: data.usedQuantity,
      unit: data.unit,
      qcStatus: data.qcStatus,
      coaAvailable: data.coaAvailable,
      specificationNumber: data.specificationNumber,
      stpNumber: data.stpNumber,
      complianceStatus: compliance.complianceStatus,
      complianceReasons: compliance.complianceReasons,
      riskLevel: compliance.riskLevel,
      remarks: data.remarks,
      sourceType: 'manual',
      attachmentUrls: [],
      createdAt: ts,
      updatedAt: ts,
      createdBy: actor.id,
      updatedBy: actor.id,
      createdByName: actor.name,
      updatedByName: actor.name,
      isDeleted: false,
    };

    const docRef = await addDoc(collection(getFirebaseFirestore(), PQR_MATERIAL_REVIEW_COLLECTIONS.materialReview), record);
    await logMaterialAudit('create material review record', actor, { arNumber: data.arNumber }, docRef.id);
    await logMaterialAudit('compliance recalculated', actor, compliance, docRef.id);
    return { id: docRef.id };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function updateMaterialReviewRecord(
  id: string,
  pqr: PqrOption,
  data: MaterialReviewFormData,
  actor: PqrMaterialReviewActor,
): Promise<{ error?: string }> {
  if (!isFirebaseConfigured()) return { error: 'Firebase is not configured.' };
  if (await checkDuplicateAr(pqr.id, data.arNumber, data.materialName, id)) {
    return { error: 'Duplicate AR Number for this material under the same PQR.' };
  }

  try {
    const compliance = computeMaterialCompliance({ ...data, vendorAvlStatus: data.vendorAvlStatus });
    await updateDoc(doc(getFirebaseFirestore(), PQR_MATERIAL_REVIEW_COLLECTIONS.materialReview, id), {
      ...data,
      complianceStatus: compliance.complianceStatus,
      complianceReasons: compliance.complianceReasons,
      riskLevel: compliance.riskLevel,
      updatedAt: nowIso(),
      updatedBy: actor.id,
      updatedByName: actor.name,
    });
    await logMaterialAudit('edit material review record', actor, { id, arNumber: data.arNumber }, id);
    await logMaterialAudit('compliance recalculated', actor, compliance, id);
    return {};
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function softDeleteMaterialReviewRecord(id: string, actor: PqrMaterialReviewActor): Promise<{ error?: string }> {
  if (!isFirebaseConfigured()) return { error: 'Firebase is not configured.' };
  try {
    await updateDoc(doc(getFirebaseFirestore(), PQR_MATERIAL_REVIEW_COLLECTIONS.materialReview, id), {
      isDeleted: true,
      updatedAt: nowIso(),
      updatedBy: actor.id,
    });
    await logMaterialAudit('delete/soft delete material record', actor, { id }, id);
    return {};
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function saveMaterialSectionToPqr(
  pqrId: string,
  narrative: string,
  records: PqrMaterialReviewRecord[],
  actor: PqrMaterialReviewActor,
): Promise<{ error?: string }> {
  if (!isFirebaseConfigured()) return { error: 'Firebase is not configured.' };
  try {
    const summary = computeMaterialSummary(records);
    const ts = nowIso();
    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), PQR_MATERIAL_REVIEW_COLLECTIONS.sections),
      where('pqrId', '==', pqrId),
      where('sectionKey', '==', 'raw_material'),
    ));

    const payload = {
      pqrId,
      sectionKey: 'raw_material',
      sectionType: 'Material Review',
      sectionOrder: 6,
      sectionTitle: 'API / Raw Material Review',
      narrative,
      dataSummary: JSON.stringify(summary),
      included: true,
      status: 'Draft',
      updatedAt: ts,
      updatedBy: actor.id,
    };

    if (snap.empty) {
      await addDoc(collection(getFirebaseFirestore(), PQR_MATERIAL_REVIEW_COLLECTIONS.sections), {
        ...payload,
        createdAt: ts,
        createdBy: actor.id,
        isDeleted: false,
      });
    } else {
      await updateDoc(snap.docs[0].ref, payload);
    }

    await logMaterialAudit('section saved to PQR', actor, { pqrId }, pqrId);
    return {};
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function uploadMaterialAttachment(
  pqrId: string,
  recordId: string,
  file: File,
  actor: PqrMaterialReviewActor,
): Promise<{ url?: string; error?: string }> {
  if (!isFirebaseConfigured()) return { error: 'Firebase is not configured.' };
  try {
    const path = `pqr/${pqrId}/material-review/${recordId}/${Date.now()}_${file.name}`;
    const storageRef = ref(getFirebaseStorage(), path);
    await uploadBytes(storageRef, file);
    const url = await getDownloadURL(storageRef);

    const docRef = doc(getFirebaseFirestore(), PQR_MATERIAL_REVIEW_COLLECTIONS.materialReview, recordId);
    const snap = await getDoc(docRef);
    const existing = (snap.data()?.attachmentUrls as string[] | undefined) || [];
    await updateDoc(docRef, {
      attachmentUrls: [...existing, url],
      updatedAt: nowIso(),
      updatedBy: actor.id,
    });

    await logMaterialAudit('attachment uploaded', actor, { recordId, fileName: file.name }, recordId);
    return { url };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export function getMaterialReviewNarrative(records: PqrMaterialReviewRecord[]): string {
  return generateMaterialNarrative(computeMaterialSummary(records), records);
}

export { computeMaterialSummary, generateMaterialNarrative, buildMaterialCharts, buildVendorAvlRows } from '@/lib/pqr-material-review-records';

export async function logMaterialReviewView(actor: PqrMaterialReviewActor) {
  await logMaterialAudit('material review viewed', actor);
}

export async function logMaterialReviewExport(actor: PqrMaterialReviewActor, type: 'excel' | 'import') {
  await logMaterialAudit(type === 'excel' ? 'export material review' : 'import material list', actor);
}

export async function logMaterialNarrativeEdit(actor: PqrMaterialReviewActor, pqrId: string) {
  await logMaterialAudit('narrative edited', actor, { pqrId }, pqrId);
}

function isMaterialRelatedRecord(
  raw: Record<string, unknown>,
  batchNumbers: string[],
  materialNames: string[],
): boolean {
  const batchSet = new Set(batchNumbers.map((b) => b.toLowerCase()).filter(Boolean));
  const materialSet = new Set(materialNames.map((m) => m.toLowerCase()).filter(Boolean));
  const category = str(raw.category || raw.deviationType || raw.type || raw.oosType || raw.module).toLowerCase();
  const materialName = str(raw.materialName || raw.material_name || raw.rawMaterial || raw.itemName).toLowerCase();
  const batchNumber = str(raw.batchNumber || raw.batch_number || raw.batchNo).toLowerCase();
  const relatesByCategory = category.includes('material') || category.includes('raw') || category.includes('api');
  const relatesByMaterial = materialName.length > 0 && (
    materialSet.has(materialName) || Array.from(materialSet).some((m) => materialName.includes(m) || m.includes(materialName))
  );
  const relatesByBatch = batchNumber.length > 0 && batchSet.has(batchNumber);
  return relatesByCategory || relatesByMaterial || relatesByBatch;
}

export async function fetchMaterialQualityMetrics(
  pqr: PqrOption,
  records: PqrMaterialReviewRecord[],
): Promise<{ materialOosCount: number; materialDeviationCount: number }> {
  if (!isFirebaseConfigured()) return { materialOosCount: 0, materialDeviationCount: 0 };

  try {
    const batchNumbers = Array.from(new Set(records.map((r) => r.batchNumber).filter(Boolean)));
    const materialNames = Array.from(new Set(records.map((r) => r.materialName).filter(Boolean)));
    const [deviations, oosRecords] = await Promise.all([
      readFirst([PQR_MATERIAL_REVIEW_COLLECTIONS.deviations, 'deviation']),
      readFirst([PQR_MATERIAL_REVIEW_COLLECTIONS.oosRecords, 'oos']),
    ]);

    const from = pqr.reviewPeriodFrom?.slice(0, 10) || '';
    const to = pqr.reviewPeriodTo?.slice(0, 10) || '';
    const inPeriod = (raw: Record<string, unknown>) => {
      const date = str(raw.createdAt || raw.created_at || raw.reportedDate || raw.reported_date || raw.date).slice(0, 10);
      if (!from || !to || !date) return true;
      return date >= from && date <= to;
    };

    const materialOosCount = oosRecords.filter((r) =>
      inPeriod(r) && isMaterialRelatedRecord(r, batchNumbers, materialNames),
    ).length;
    const materialDeviationCount = deviations.filter((r) =>
      inPeriod(r) && isMaterialRelatedRecord(r, batchNumbers, materialNames),
    ).length;

    return { materialOosCount, materialDeviationCount };
  } catch (e) {
    console.error('fetchMaterialQualityMetrics failed', e);
    return { materialOosCount: 0, materialDeviationCount: 0 };
  }
}

export async function recalculateAllCompliance(pqrId: string, actor: PqrMaterialReviewActor): Promise<void> {
  const records = await fetchMaterialReviewRecords(pqrId);
  for (const r of records) {
    if (!r.id) continue;
    const compliance = computeMaterialCompliance(r);
    await updateDoc(doc(getFirebaseFirestore(), PQR_MATERIAL_REVIEW_COLLECTIONS.materialReview, r.id), {
      complianceStatus: compliance.complianceStatus,
      complianceReasons: compliance.complianceReasons,
      riskLevel: compliance.riskLevel,
      updatedAt: nowIso(),
      updatedBy: actor.id,
    });
  }
  await logMaterialAudit('compliance recalculated', actor, { count: records.length }, pqrId);
}
