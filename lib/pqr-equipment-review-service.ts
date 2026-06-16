import {
  collection, doc, addDoc, getDoc, getDocs, updateDoc, query, where, limit, orderBy, writeBatch,
} from 'firebase/firestore';
import { getFirebaseFirestore, isFirebaseConfigured } from '@/lib/firebase';
import { createAuditLog, writeAuditTrail } from '@/lib/audit-trail';
import { EQUIPMENT_COLLECTIONS } from '@/lib/equipment-mgmt-types';
import type { PqrOption } from '@/lib/pqr-batch-review-records';
import { fetchPqrOptions } from '@/lib/pqr-batch-review-service';
import {
  PQR_EQUIPMENT_REVIEW_COLLECTIONS, PQR_EQUIPMENT_REVIEW_MODULE,
  computeEquipmentCompliance, computeEquipmentSummary, generateEquipmentNarrative,
  inferEquipmentType, mapCalibrationStatus, mapEquipmentCategory, mapPmStatus,
  type EquipmentReviewFormData, type PqrEquipmentReviewRecord,
} from '@/lib/pqr-equipment-review-records';

export type PqrEquipmentReviewActor = { id: string; name: string; role?: string };

export { fetchPqrOptions };

const nowIso = () => new Date().toISOString();
const str = (v: unknown, fb = '') => (v === null || v === undefined ? fb : String(v));
const num = (v: unknown, fb = 0) => { const n = Number(v); return Number.isFinite(n) ? n : fb; };

function buildEquipmentReviewId(equipmentId: string) {
  return `PER-${equipmentId}-${Date.now().toString(36).toUpperCase()}`;
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

async function logEquipmentAudit(actionType: string, actor: PqrEquipmentReviewActor, detail?: unknown, recordId = 'equipment-review') {
  try {
    await createAuditLog({
      moduleName: PQR_EQUIPMENT_REVIEW_MODULE,
      collectionName: PQR_EQUIPMENT_REVIEW_COLLECTIONS.equipmentReview,
      recordId,
      actionType,
      newValue: detail,
      user: { id: actor.id, name: actor.name },
      status: 'Success',
    });
    await writeAuditTrail({
      collectionName: PQR_EQUIPMENT_REVIEW_COLLECTIONS.equipmentReview,
      documentId: recordId,
      action: actionType,
      oldValue: null,
      newValue: detail,
      userId: actor.id,
      userName: actor.name,
      moduleName: PQR_EQUIPMENT_REVIEW_MODULE,
    });
  } catch (e) {
    console.error('logEquipmentAudit failed', e);
  }
}

function inPeriod(dateStr: string, from: string, to: string): boolean {
  const d = dateStr.slice(0, 10);
  if (!from || !to || !d) return true;
  return d >= from && d <= to;
}

function deriveQualification(
  eq: Record<string, unknown>,
  validations: Record<string, unknown>[],
  qualifications: Record<string, unknown>[],
): { status: string; iq: string; oq: string; pq: string } {
  const eqId = str(eq.equipment_id || eq.equipmentId || eq.id);
  const docId = str(eq.id);
  const related = [...validations, ...qualifications].filter((v) =>
    str(v.equipment_id || v.equipmentId || v.equipment_doc_id) === eqId
    || str(v.equipment_doc_id || v.equipmentDocId) === docId,
  );
  if (!related.length) {
    if (eq.qualification_required === false) return { status: 'Qualified', iq: 'N/A', oq: 'N/A', pq: 'N/A' };
    return { status: 'Qualification Due', iq: 'Pending', oq: 'Pending', pq: 'Pending' };
  }
  const iq = related.find((v) => str(v.validationType || v.type).toUpperCase().includes('IQ'));
  const oq = related.find((v) => str(v.validationType || v.type).toUpperCase().includes('OQ'));
  const pq = related.find((v) => str(v.validationType || v.type).toUpperCase().includes('PQ'));
  const iqStatus = str(iq?.status || iq?.validationStatus, 'Pending');
  const oqStatus = str(oq?.status || oq?.validationStatus, 'Pending');
  const pqStatus = str(pq?.status || pq?.validationStatus, 'Pending');
  const allApproved = [iqStatus, oqStatus, pqStatus].every((s) =>
    s.toLowerCase().includes('approved') || s.toLowerCase().includes('complete') || s === 'N/A',
  );
  const anyApproved = [iqStatus, oqStatus, pqStatus].some((s) =>
    s.toLowerCase().includes('approved') || s.toLowerCase().includes('complete'),
  );
  let status = 'Not Qualified';
  if (allApproved) status = 'Qualified';
  else if (anyApproved) status = 'Partially Qualified';
  else if (related.some((v) => str(v.status).toLowerCase().includes('due'))) status = 'Qualification Due';
  return { status, iq: iqStatus, oq: oqStatus, pq: pqStatus };
}

function countLinked(
  equipmentId: string,
  docId: string,
  records: Record<string, unknown>[],
  from: string,
  to: string,
): number {
  return records.filter((r) => {
    const eid = str(r.equipment_id || r.equipmentId || r.equipment_doc_id || r.equipmentDocId);
    if (eid !== equipmentId && eid !== docId) return false;
    const date = str(r.createdAt || r.created_at || r.reportedDate || r.date || r.breakdown_date).slice(0, 10);
    return inPeriod(date, from, to);
  }).length;
}

function mapToEquipmentReviewRecord(
  eq: Record<string, unknown>,
  pqr: PqrOption,
  context: {
    calibrations: Record<string, unknown>[];
    pms: Record<string, unknown>[];
    breakdowns: Record<string, unknown>[];
    validations: Record<string, unknown>[];
    qualifications: Record<string, unknown>[];
    deviations: Record<string, unknown>[];
    capas: Record<string, unknown>[];
    changeControls: Record<string, unknown>[];
    from: string;
    to: string;
  },
  actor: PqrEquipmentReviewActor,
): Omit<PqrEquipmentReviewRecord, 'id'> {
  const ts = nowIso();
  const eqId = str(eq.equipment_id || eq.equipmentId);
  const docId = str(eq.id);
  const category = mapEquipmentCategory(str(eq.equipment_type || eq.equipmentType || eq.category));
  const eqName = str(eq.equipment_name || eq.equipmentName || eq.name);

  const latestCal = context.calibrations
    .filter((c) => str(c.equipment_doc_id || c.equipment_id) === docId || str(c.equipment_id) === eqId)
    .sort((a, b) => str(b.calibration_date || b.calibrationDate).localeCompare(str(a.calibration_date || a.calibrationDate)))[0];
  const latestPm = context.pms
    .filter((p) => str(p.equipment_doc_id || p.equipment_id) === docId || str(p.equipment_id) === eqId)
    .sort((a, b) => str(b.pm_date || b.pmDate).localeCompare(str(a.pm_date || a.pmDate)))[0];

  const eqBreakdowns = context.breakdowns.filter((b) => {
    const match = str(b.equipment_doc_id || b.equipment_id) === docId || str(b.equipment_id) === eqId;
    if (!match) return false;
    return inPeriod(str(b.breakdown_date || b.breakdownDate), context.from, context.to);
  });

  const qual = deriveQualification(eq, context.validations, context.qualifications);
  const calStatus = mapCalibrationStatus(str(eq.calibration_status || latestCal?.calibration_status, 'Not Calibrated'));
  const pmStatus = mapPmStatus(str(eq.pm_status || latestPm?.pm_status, 'Not Applicable'));

  const criticalBd = eqBreakdowns.some((b) =>
    b.impact_on_product_quality === true || b.impactOnProductQuality === true
    || str(b.severity).toLowerCase() === 'critical',
  );
  const linkedDeviations = countLinked(eqId, docId, context.deviations, context.from, context.to);
  const linkedCapa = countLinked(eqId, docId, context.capas, context.from, context.to);
  const linkedCc = countLinked(eqId, docId, context.changeControls, context.from, context.to);

  const partial: Partial<PqrEquipmentReviewRecord> = {
    equipmentReviewId: buildEquipmentReviewId(eqId || docId),
    pqrId: pqr.id,
    pqrNumber: pqr.pqrNumber,
    product: pqr.productName,
    productCode: pqr.productCode,
    equipmentId: eqId,
    equipmentCode: eqId,
    equipmentName: eqName,
    equipmentCategory: category,
    equipmentType: inferEquipmentType(eqName, category),
    department: str(eq.department),
    area: str(eq.area_room_no || eq.area || eq.location),
    modelNumber: str(eq.model || eq.modelNumber),
    serialNumber: str(eq.serial_no || eq.serialNumber),
    manufacturer: str(eq.make || eq.manufacturer),
    installationDate: str(eq.installation_date || eq.installationDate).slice(0, 10),
    qualificationStatus: qual.status,
    iqStatus: qual.iq,
    oqStatus: qual.oq,
    pqStatus: qual.pq,
    calibrationStatus: calStatus,
    lastCalibrationDate: str(latestCal?.calibration_date || latestCal?.calibrationDate || eq.last_calibration_date).slice(0, 10),
    nextCalibrationDate: str(latestCal?.calibration_due_date || latestCal?.calibrationDueDate || eq.calibration_due_date).slice(0, 10),
    pmStatus,
    lastPmDate: str(latestPm?.pm_date || latestPm?.pmDate).slice(0, 10),
    nextPmDate: str(latestPm?.next_pm_due_date || latestPm?.nextPmDueDate || eq.pm_due_date).slice(0, 10),
    breakdownCount: eqBreakdowns.length,
    downtimeHours: eqBreakdowns.reduce((s, b) => s + num(b.downtime_hours || b.downtimeHours), 0),
    linkedDeviations,
    linkedCapa,
    linkedChangeControls: linkedCc,
    impactOnProduct: criticalBd ? 'Critical product impact' : eqBreakdowns.length ? 'Minor impact' : 'None',
    remarks: str(eq.remarks),
    sourceType: 'equipment_master',
    sourceId: docId,
    createdAt: ts,
    updatedAt: ts,
    createdBy: actor.id,
    updatedBy: actor.id,
    createdByName: actor.name,
    updatedByName: actor.name,
    isDeleted: false,
  };

  const computed = computeEquipmentCompliance(partial);
  return { ...partial, ...computed } as Omit<PqrEquipmentReviewRecord, 'id'>;
}

export async function fetchEquipmentReviewRecords(pqrId: string): Promise<PqrEquipmentReviewRecord[]> {
  if (!isFirebaseConfigured()) return [];
  try {
    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), PQR_EQUIPMENT_REVIEW_COLLECTIONS.equipmentReview),
      where('pqrId', '==', pqrId),
      where('isDeleted', '==', false),
    ));
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() } as PqrEquipmentReviewRecord))
      .sort((a, b) => a.equipmentName.localeCompare(b.equipmentName));
  } catch {
    try {
      const snap = await getDocs(query(
        collection(getFirebaseFirestore(), PQR_EQUIPMENT_REVIEW_COLLECTIONS.equipmentReview),
        where('pqrId', '==', pqrId),
      ));
      return snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as PqrEquipmentReviewRecord))
        .filter((r) => !r.isDeleted)
        .sort((a, b) => a.equipmentName.localeCompare(b.equipmentName));
    } catch (e) {
      console.error('fetchEquipmentReviewRecords failed', e);
      return [];
    }
  }
}

export async function pullEquipmentData(
  pqr: PqrOption,
  actor: PqrEquipmentReviewActor,
): Promise<{ created: number; skipped: number; error?: string }> {
  if (!isFirebaseConfigured()) return { created: 0, skipped: 0, error: 'Firebase is not configured.' };

  try {
    await logEquipmentAudit('pull equipment data', actor, { pqrId: pqr.id }, pqr.id);

    const from = pqr.reviewPeriodFrom?.slice(0, 10) || '';
    const to = pqr.reviewPeriodTo?.slice(0, 10) || '';

    const [existing, equipment, calibrations, pms, breakdowns, validations, qualifications, deviations, capas, changeControls, utility] = await Promise.all([
      fetchEquipmentReviewRecords(pqr.id),
      readFirst([PQR_EQUIPMENT_REVIEW_COLLECTIONS.equipmentMaster, EQUIPMENT_COLLECTIONS.master]),
      readFirst([PQR_EQUIPMENT_REVIEW_COLLECTIONS.calibrationRecords, PQR_EQUIPMENT_REVIEW_COLLECTIONS.equipmentCalibration, 'calibration_records']),
      readFirst([PQR_EQUIPMENT_REVIEW_COLLECTIONS.pmRecords, PQR_EQUIPMENT_REVIEW_COLLECTIONS.preventiveMaintenance, 'pm_records']),
      readFirst([PQR_EQUIPMENT_REVIEW_COLLECTIONS.breakdownRecords, EQUIPMENT_COLLECTIONS.breakdown]),
      readFirst([PQR_EQUIPMENT_REVIEW_COLLECTIONS.validationRecords, 'validation']),
      readFirst([PQR_EQUIPMENT_REVIEW_COLLECTIONS.equipmentQualification]),
      readFirst([PQR_EQUIPMENT_REVIEW_COLLECTIONS.deviations, 'deviation']),
      readFirst([PQR_EQUIPMENT_REVIEW_COLLECTIONS.capaRecords, 'capa']),
      readFirst([PQR_EQUIPMENT_REVIEW_COLLECTIONS.changeControls, 'change_control']),
      readFirst([PQR_EQUIPMENT_REVIEW_COLLECTIONS.utilityEquipment]),
    ]);

    const allEquipment = [...equipment, ...utility];
    const existingIds = new Set(existing.map((r) => r.equipmentId.toLowerCase()));
    const context = { calibrations, pms, breakdowns, validations, qualifications, deviations, capas, changeControls: changeControls, from, to };

    let created = 0;
    let skipped = 0;
    const batch = writeBatch(getFirebaseFirestore());

    for (const eq of allEquipment) {
      const eqId = str(eq.equipment_id || eq.equipmentId || eq.id);
      if (!eqId || existingIds.has(eqId.toLowerCase())) {
        skipped += 1;
        continue;
      }
      const status = str(eq.equipment_status || eq.status, 'Active');
      if (status === 'Retired') { skipped += 1; continue; }

      const record = mapToEquipmentReviewRecord(eq, pqr, context, actor);
      const refDoc = doc(collection(getFirebaseFirestore(), PQR_EQUIPMENT_REVIEW_COLLECTIONS.equipmentReview));
      batch.set(refDoc, record);
      existingIds.add(eqId.toLowerCase());
      created += 1;
    }

    if (created > 0) await batch.commit();
    await logEquipmentAudit('compliance recalculated', actor, { created, skipped }, pqr.id);
    await logEquipmentAudit('risk calculation', actor, { created }, pqr.id);
    return { created, skipped };
  } catch (e) {
    console.error('pullEquipmentData failed', e);
    return { created: 0, skipped: 0, error: (e as Error).message };
  }
}

export async function createEquipmentReviewRecord(
  pqr: PqrOption,
  data: EquipmentReviewFormData,
  actor: PqrEquipmentReviewActor,
): Promise<{ id?: string; error?: string }> {
  if (!isFirebaseConfigured()) return { error: 'Firebase is not configured.' };
  const existing = await fetchEquipmentReviewRecords(pqr.id);
  if (existing.some((r) => r.equipmentId.toLowerCase() === data.equipmentId.toLowerCase())) {
    return { error: 'Equipment already reviewed under this PQR.' };
  }

  try {
    const computed = computeEquipmentCompliance(data);
    const ts = nowIso();
    const record: Omit<PqrEquipmentReviewRecord, 'id'> = {
      equipmentReviewId: buildEquipmentReviewId(data.equipmentId),
      pqrId: pqr.id,
      pqrNumber: pqr.pqrNumber,
      product: data.product,
      productCode: data.productCode,
      equipmentId: data.equipmentId,
      equipmentCode: data.equipmentCode || data.equipmentId,
      equipmentName: data.equipmentName,
      equipmentCategory: data.equipmentCategory,
      equipmentType: data.equipmentType,
      department: data.department,
      area: data.area,
      modelNumber: data.modelNumber,
      serialNumber: data.serialNumber,
      manufacturer: data.manufacturer,
      installationDate: data.installationDate,
      qualificationStatus: data.qualificationStatus,
      iqStatus: data.iqStatus,
      oqStatus: data.oqStatus,
      pqStatus: data.pqStatus,
      calibrationStatus: data.calibrationStatus,
      lastCalibrationDate: data.lastCalibrationDate,
      nextCalibrationDate: data.nextCalibrationDate,
      pmStatus: data.pmStatus,
      lastPmDate: data.lastPmDate,
      nextPmDate: data.nextPmDate,
      breakdownCount: data.breakdownCount,
      downtimeHours: data.downtimeHours,
      linkedDeviations: data.linkedDeviations,
      linkedCapa: data.linkedCapa,
      linkedChangeControls: data.linkedChangeControls,
      impactOnProduct: data.impactOnProduct,
      complianceStatus: computed.complianceStatus,
      complianceReasons: computed.complianceReasons,
      riskLevel: computed.riskLevel,
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

    const docRef = await addDoc(collection(getFirebaseFirestore(), PQR_EQUIPMENT_REVIEW_COLLECTIONS.equipmentReview), record);
    await logEquipmentAudit('create equipment review', actor, { equipmentId: data.equipmentId }, docRef.id);
    return { id: docRef.id };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function updateEquipmentReviewRecord(
  id: string,
  pqr: PqrOption,
  data: EquipmentReviewFormData,
  actor: PqrEquipmentReviewActor,
): Promise<{ error?: string }> {
  if (!isFirebaseConfigured()) return { error: 'Firebase is not configured.' };

  try {
    const computed = computeEquipmentCompliance(data);
    await updateDoc(doc(getFirebaseFirestore(), PQR_EQUIPMENT_REVIEW_COLLECTIONS.equipmentReview, id), {
      ...data,
      equipmentCode: data.equipmentCode || data.equipmentId,
      complianceStatus: computed.complianceStatus,
      complianceReasons: computed.complianceReasons,
      riskLevel: computed.riskLevel,
      updatedAt: nowIso(),
      updatedBy: actor.id,
      updatedByName: actor.name,
    });
    await logEquipmentAudit('edit equipment review', actor, { id, equipmentId: data.equipmentId }, id);
    await logEquipmentAudit('compliance recalculated', actor, computed, id);
    return {};
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function softDeleteEquipmentReviewRecord(id: string, actor: PqrEquipmentReviewActor): Promise<{ error?: string }> {
  if (!isFirebaseConfigured()) return { error: 'Firebase is not configured.' };
  try {
    await updateDoc(doc(getFirebaseFirestore(), PQR_EQUIPMENT_REVIEW_COLLECTIONS.equipmentReview, id), {
      isDeleted: true,
      updatedAt: nowIso(),
      updatedBy: actor.id,
    });
    await logEquipmentAudit('delete equipment review', actor, { id }, id);
    return {};
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function saveEquipmentSectionToPqr(
  pqrId: string,
  narrative: string,
  records: PqrEquipmentReviewRecord[],
  actor: PqrEquipmentReviewActor,
): Promise<{ error?: string }> {
  if (!isFirebaseConfigured()) return { error: 'Firebase is not configured.' };
  try {
    const summary = computeEquipmentSummary(records);
    const ts = nowIso();
    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), PQR_EQUIPMENT_REVIEW_COLLECTIONS.sections),
      where('pqrId', '==', pqrId),
      where('sectionKey', '==', 'equipment_review'),
    ));

    const payload = {
      pqrId,
      sectionKey: 'equipment_review',
      sectionType: 'Equipment Review',
      sectionOrder: 22,
      sectionTitle: 'Equipment / Utility Qualification Review',
      narrative,
      dataSummary: JSON.stringify(summary),
      included: true,
      status: 'Draft',
      updatedAt: ts,
      updatedBy: actor.id,
    };

    if (snap.empty) {
      await addDoc(collection(getFirebaseFirestore(), PQR_EQUIPMENT_REVIEW_COLLECTIONS.sections), {
        ...payload,
        createdAt: ts,
        createdBy: actor.id,
        isDeleted: false,
      });
    } else {
      await updateDoc(snap.docs[0].ref, payload);
    }

    await logEquipmentAudit('section saved to PQR', actor, { pqrId }, pqrId);
    return {};
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export function getEquipmentReviewNarrative(records: PqrEquipmentReviewRecord[]): string {
  return generateEquipmentNarrative(computeEquipmentSummary(records), records);
}

export { computeEquipmentSummary, generateEquipmentNarrative, buildEquipmentCharts } from '@/lib/pqr-equipment-review-records';

export async function logEquipmentReviewView(actor: PqrEquipmentReviewActor) {
  await logEquipmentAudit('equipment review viewed', actor);
}

export async function logEquipmentReviewExport(actor: PqrEquipmentReviewActor) {
  await logEquipmentAudit('export review', actor);
}

export async function logEquipmentNarrativeEdit(actor: PqrEquipmentReviewActor, pqrId: string) {
  await logEquipmentAudit('narrative edited', actor, { pqrId }, pqrId);
}

export async function recalculateAllEquipmentCompliance(pqrId: string, actor: PqrEquipmentReviewActor): Promise<void> {
  const records = await fetchEquipmentReviewRecords(pqrId);
  for (const r of records) {
    if (!r.id) continue;
    const computed = computeEquipmentCompliance(r);
    await updateDoc(doc(getFirebaseFirestore(), PQR_EQUIPMENT_REVIEW_COLLECTIONS.equipmentReview, r.id), {
      complianceStatus: computed.complianceStatus,
      complianceReasons: computed.complianceReasons,
      riskLevel: computed.riskLevel,
      updatedAt: nowIso(),
      updatedBy: actor.id,
    });
  }
  await logEquipmentAudit('compliance recalculated', actor, { count: records.length }, pqrId);
  await logEquipmentAudit('risk calculation', actor, { count: records.length }, pqrId);
}
