import {
  collection, doc, addDoc, getDocs, query, where, limit, orderBy, writeBatch, updateDoc,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getFirebaseFirestore, getFirebaseStorage, isFirebaseConfigured } from '@/lib/firebase';
import { createAuditLog, writeAuditTrail } from '@/lib/audit-trail';
import { generateDocumentNumber } from '@/lib/admin/document-numbering-service';
import { sendInAppNotification } from '@/lib/notification-service';
import { CPV_COLLECTIONS } from '@/lib/cpv';
import { CPV_PRODUCT_COLLECTION } from '@/lib/cpv-product-master';
import {
  PQR_CREATE_COLLECTIONS, PQR_CREATE_MODULE, PQR_SECTION_DEFINITIONS,
  emptyCollectedSummary, type PqrCollectedData, type PqrCollectedSummary,
  type PqrCreateRecord, type PqrProductOption, type PqrQualityStatus,
  type PqrRiskLevel, type PqrSectionRecord, type ReviewScope,
} from '@/lib/pqr-create-records';

export type PqrCreateActor = { id: string; name: string; role?: string };

const nowIso = () => new Date().toISOString();
const str = (v: unknown, fb = '') => (v === null || v === undefined ? fb : String(v));
const num = (v: unknown, fb = 0) => { const n = Number(v); return Number.isFinite(n) ? n : fb; };

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

function inDateRange(raw: string | undefined, from: string, to: string): boolean {
  if (!raw) return true;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return true;
  return d >= new Date(from) && d <= new Date(`${to}T23:59:59`);
}

function matchesProduct(record: Record<string, unknown>, productName: string, productCode: string): boolean {
  const names = [productName, productCode].map((s) => s.toLowerCase()).filter(Boolean);
  const fields = ['productName', 'product_name', 'product', 'productCode', 'product_code'];
  return fields.some((f) => {
    const val = str(record[f]).toLowerCase();
    return names.some((n) => val.includes(n) || n.includes(val));
  });
}

function mapProduct(raw: Record<string, unknown>, source: 'products' | 'cpv_products'): PqrProductOption {
  return {
    id: str(raw.id),
    source,
    productCode: str(raw.productCode || raw.product_code),
    productName: str(raw.productName || raw.product_name),
    genericName: str(raw.genericName || raw.generic_name),
    brandName: str(raw.brandName || raw.brand_name),
    strength: str(raw.strength),
    dosageForm: str(raw.dosageForm || raw.dosage_form),
    routeOfAdministration: str(raw.routeOfAdministration || raw.route_of_administration || raw.route),
    packSize: str(raw.packSize || raw.pack_size),
    market: str(raw.market),
    shelfLife: str(raw.shelfLife || raw.shelf_life),
    storageCondition: str(raw.storageCondition || raw.storage_condition),
    manufacturingLicenseNumber: str(raw.manufacturingLicenseNumber || raw.manufacturing_license_number || raw.manufacturingLicenseNo),
    mfrNumber: str(raw.mfrNumber || raw.mfr_number),
    bmrNumber: str(raw.bmrNumber || raw.bmr_number),
    bprNumber: str(raw.bprNumber || raw.bpr_number),
    specificationNumber: str(raw.specificationNumber || raw.specification_number),
    stpNumber: str(raw.stpNumber || raw.stp_number),
  };
}

async function logCreateAudit(actionType: string, actor: PqrCreateActor, detail?: unknown, recordId = 'create-wizard') {
  try {
    await createAuditLog({
      moduleName: PQR_CREATE_MODULE,
      collectionName: PQR_CREATE_COLLECTIONS.records,
      recordId,
      actionType,
      newValue: detail,
      user: { id: actor.id, name: actor.name },
      status: 'Success',
    });
    await writeAuditTrail({
      collectionName: PQR_CREATE_COLLECTIONS.records,
      documentId: recordId,
      action: actionType,
      oldValue: null,
      newValue: detail,
      userId: actor.id,
      userName: actor.name,
      moduleName: PQR_CREATE_MODULE,
    });
  } catch (e) {
    console.error('logCreateAudit failed', e);
  }
}

export async function fetchPqrCreateProducts(): Promise<PqrProductOption[]> {
  if (!isFirebaseConfigured()) return [];
  try {
    const [adminProducts, cpvProducts] = await Promise.all([
      readCollection(PQR_CREATE_COLLECTIONS.products),
      readCollection(CPV_PRODUCT_COLLECTION),
    ]);
    const mapped = [
      ...adminProducts.filter((p) => !p.isDeleted).map((p) => mapProduct(p, 'products')),
      ...cpvProducts.filter((p) => !p.isDeleted).map((p) => mapProduct(p, 'cpv_products')),
    ];
    const seen = new Set<string>();
    return mapped.filter((p) => {
      const key = `${p.productCode}-${p.productName}`.toLowerCase();
      if (!p.productName || seen.has(key)) return false;
      seen.add(key);
      return true;
    }).sort((a, b) => a.productName.localeCompare(b.productName));
  } catch (e) {
    console.error('fetchPqrCreateProducts failed', e);
    return [];
  }
}

function datesOverlap(aFrom: string, aTo: string, bFrom: string, bTo: string): boolean {
  return new Date(aFrom) <= new Date(`${bTo}T23:59:59`) && new Date(bFrom) <= new Date(`${aTo}T23:59:59`);
}

function isApprovedStatus(status: string): boolean {
  const s = status.toLowerCase().replace(/_/g, ' ');
  return s === 'approved';
}

export async function checkPqrPeriodOverlap(
  productId: string,
  productName: string,
  from: string,
  to: string,
): Promise<{ overlap: boolean; existingPqrNumber?: string }> {
  if (!isFirebaseConfigured()) return { overlap: false };
  try {
    const records = await readFirst([PQR_CREATE_COLLECTIONS.records, PQR_CREATE_COLLECTIONS.recordsLegacy]);
    const match = records.find((r) => {
      if (r.isDeleted) return false;
      const pid = str(r.productId || r.product_id);
      const pname = str(r.productName || r.product_name);
      if (pid !== productId && pname !== productName) return false;
      if (!isApprovedStatus(str(r.status || r.document_status))) return false;
      const rFrom = str(r.reviewPeriodFrom || r.review_period_from);
      const rTo = str(r.reviewPeriodTo || r.review_period_to);
      return datesOverlap(from, to, rFrom, rTo);
    });
    if (match) {
      return {
        overlap: true,
        existingPqrNumber: str(match.pqrNumber || match.pqr_number),
      };
    }
    return { overlap: false };
  } catch (e) {
    console.error('checkPqrPeriodOverlap failed', e);
    return { overlap: false };
  }
}

function filterByProductAndDate(
  records: Record<string, unknown>[],
  productName: string,
  productCode: string,
  from: string,
  to: string,
): Record<string, unknown>[] {
  return records.filter((r) =>
    matchesProduct(r, productName, productCode)
    && inDateRange(str(
      r.manufacturingDate || r.manufacturing_date || r.testDate || r.test_date
      || r.recordedDate || r.createdAt || r.created_at,
    ), from, to),
  );
}

function countBatchStatus(batches: Record<string, unknown>[], type: 'released' | 'rejected'): number {
  return batches.filter((b) => {
    const rs = str(b.releaseStatus || b.release_status || b.batchStatus || b.status).toLowerCase();
    return type === 'released' ? rs.includes('release') && !rs.includes('reject') : rs.includes('reject');
  }).length;
}

function countOpenCritical(records: Record<string, unknown>[], type: 'oos' | 'deviation'): number {
  return records.filter((r) => {
    const status = str(r.status).toLowerCase();
    if (['closed', 'approved', 'cancelled'].includes(status)) return false;
    const sev = str(r.severity || r.riskLevel || r.priority).toLowerCase();
    if (type === 'oos') return sev.includes('critical') || status.includes('open');
    return sev.includes('critical') || sev.includes('high');
  }).length;
}

export async function collectPqrData(
  product: PqrProductOption,
  from: string,
  to: string,
  scope: ReviewScope,
  actor: PqrCreateActor,
): Promise<PqrCollectedData> {
  await logCreateAudit('data collection started', actor, { product: product.productName, from, to });

  const empty: PqrCollectedData = {
    summary: emptyCollectedSummary(),
    batches: [], rawMaterials: [], packingMaterials: [], cppResults: [], cqaResults: [],
    yieldRecords: [], stabilityRecords: [], holdTimeRecords: [], deviations: [], oosRecords: [],
    capaRecords: [], changeControls: [], complaints: [], recalls: [], validationRecords: [],
    equipmentRecords: [], vendorRecords: [], capabilityRecords: [],
  };

  if (!isFirebaseConfigured()) return empty;

  try {
    const [
      batchesRaw, cpvBatchesRaw, rawMat, packMat, cpp, cqa, yields, stability, holdTime,
      deviations, oos, capa, cc, complaints, recalls, validation, equipment, vendors, capability,
    ] = await Promise.all([
      scope.batchReview ? readFirst([PQR_CREATE_COLLECTIONS.batches, 'pqr_batches']) : Promise.resolve([]),
      scope.batchReview ? readCollection(PQR_CREATE_COLLECTIONS.cpvBatches) : Promise.resolve([]),
      scope.rawMaterialReview ? readFirst([PQR_CREATE_COLLECTIONS.rawMaterialMonitoring, CPV_COLLECTIONS.rawMaterials]) : Promise.resolve([]),
      scope.packingMaterialReview ? readFirst([PQR_CREATE_COLLECTIONS.packingMaterialMonitoring, CPV_COLLECTIONS.packingMaterials]) : Promise.resolve([]),
      scope.cppReview ? readFirst([PQR_CREATE_COLLECTIONS.cppResults, CPV_COLLECTIONS.cpp]) : Promise.resolve([]),
      (scope.cqaReview || scope.finishedProductReview) ? readFirst([PQR_CREATE_COLLECTIONS.cqaResults, CPV_COLLECTIONS.cqa]) : Promise.resolve([]),
      scope.yieldReview ? readFirst([PQR_CREATE_COLLECTIONS.yieldMonitoring, CPV_COLLECTIONS.yieldMonitoring, CPV_COLLECTIONS.yield]) : Promise.resolve([]),
      scope.stabilityReview ? readFirst([PQR_CREATE_COLLECTIONS.stabilityMonitoring, CPV_COLLECTIONS.stability]) : Promise.resolve([]),
      scope.holdTimeReview ? readFirst([PQR_CREATE_COLLECTIONS.holdTimeMonitoring, CPV_COLLECTIONS.holdTime]) : Promise.resolve([]),
      scope.deviationReview ? readFirst([PQR_CREATE_COLLECTIONS.deviations, 'deviation']) : Promise.resolve([]),
      scope.oosReview ? readFirst([PQR_CREATE_COLLECTIONS.oosRecords, 'oos']) : Promise.resolve([]),
      scope.capaReview ? readFirst([PQR_CREATE_COLLECTIONS.capaRecords, 'capa']) : Promise.resolve([]),
      scope.changeControlReview ? readFirst([PQR_CREATE_COLLECTIONS.changeControls, 'change_control']) : Promise.resolve([]),
      scope.complaintReview ? readCollection(PQR_CREATE_COLLECTIONS.complaints) : Promise.resolve([]),
      scope.recallReview ? readFirst([PQR_CREATE_COLLECTIONS.recalls, 'recall_records']) : Promise.resolve([]),
      scope.validationReview ? readCollection(PQR_CREATE_COLLECTIONS.validationRecords) : Promise.resolve([]),
      scope.equipmentReview ? readCollection(PQR_CREATE_COLLECTIONS.equipmentMaster) : Promise.resolve([]),
      scope.vendorReview ? readCollection(PQR_CREATE_COLLECTIONS.vendors) : Promise.resolve([]),
      readFirst(['process_capability', CPV_COLLECTIONS.capability]),
    ]);

    const { productName, productCode } = product;
    const batches = filterByProductAndDate([...batchesRaw, ...cpvBatchesRaw], productName, productCode, from, to);
    const rawMaterials = filterByProductAndDate(rawMat, productName, productCode, from, to);
    const packingMaterials = filterByProductAndDate(packMat, productName, productCode, from, to);
    const cppResults = filterByProductAndDate(cpp, productName, productCode, from, to);
    const cqaResults = filterByProductAndDate(cqa, productName, productCode, from, to);
    const yieldRecords = filterByProductAndDate(yields, productName, productCode, from, to);
    const stabilityRecords = filterByProductAndDate(stability, productName, productCode, from, to);
    const holdTimeRecords = filterByProductAndDate(holdTime, productName, productCode, from, to);
    const deviationRecords = filterByProductAndDate(deviations, productName, productCode, from, to);
    const oosRecords = filterByProductAndDate(oos, productName, productCode, from, to);
    const capaRecords = filterByProductAndDate(capa, productName, productCode, from, to);
    const changeControls = filterByProductAndDate(cc, productName, productCode, from, to);
    const complaintRecords = filterByProductAndDate(complaints, productName, productCode, from, to);
    const recallRecords = filterByProductAndDate(recalls, productName, productCode, from, to);
    const validationRecords = filterByProductAndDate(validation, productName, productCode, from, to);
    const equipmentRecords = equipment;
    const vendorRecords = vendors;
    const capabilityRecords = filterByProductAndDate(capability, productName, productCode, from, to);

    const cpkVals = capabilityRecords.map((c) => num(c.cpk || c.Cpk)).filter((v) => v > 0);
    const averageCpk = cpkVals.length ? cpkVals.reduce((a, b) => a + b, 0) / cpkVals.length : 0;

    const summary: PqrCollectedSummary = {
      totalBatches: batches.length,
      releasedBatches: countBatchStatus(batches, 'released'),
      rejectedBatches: countBatchStatus(batches, 'rejected'),
      rawMaterialLots: rawMaterials.length,
      packingMaterialLots: packingMaterials.length,
      cppRecords: cppResults.length,
      cqaRecords: cqaResults.length,
      yieldRecords: yieldRecords.length,
      stabilityRecords: stabilityRecords.length,
      holdTimeRecords: holdTimeRecords.length,
      deviations: deviationRecords.length,
      oos: oosRecords.length,
      capa: capaRecords.length,
      changeControls: changeControls.length,
      complaints: complaintRecords.length,
      recalls: recallRecords.length,
      validationRecords: validationRecords.length,
      equipmentRecords: equipmentRecords.length,
      vendorRecords: vendorRecords.length,
      averageCpk,
      openCriticalOos: countOpenCritical(oosRecords, 'oos'),
      openCriticalDeviations: countOpenCritical(deviationRecords, 'deviation'),
      openCapa: capaRecords.filter((c) => !str(c.status).toLowerCase().includes('closed')).length,
    };

    const result: PqrCollectedData = {
      summary,
      batches, rawMaterials, packingMaterials, cppResults, cqaResults,
      yieldRecords, stabilityRecords, holdTimeRecords, deviations: deviationRecords,
      oosRecords, capaRecords, changeControls, complaints: complaintRecords,
      recalls: recallRecords, validationRecords, equipmentRecords, vendorRecords, capabilityRecords,
    };

    await logCreateAudit('data collection completed', actor, summary);
    return result;
  } catch (e) {
    console.error('collectPqrData failed', e);
    return empty;
  }
}

export function computeOverallAssessment(data: PqrCollectedSummary): {
  overallQualityStatus: PqrQualityStatus;
  overallRiskLevel: PqrRiskLevel;
  conclusion: string;
  recommendations: string;
} {
  const {
    rejectedBatches, recalls, openCriticalOos, openCriticalDeviations, openCapa,
    oos, averageCpk, stabilityRecords,
  } = data;

  let overallQualityStatus: PqrQualityStatus = 'Satisfactory';
  let overallRiskLevel: PqrRiskLevel = 'Low';
  const recommendations: string[] = ['Continue annual PQR as per quality management system.'];

  if (recalls > 0 || openCriticalOos > 0 || openCriticalDeviations > 0) {
    overallQualityStatus = 'Unsatisfactory';
    overallRiskLevel = 'Critical';
    recommendations.push('Immediate QA and management review required for critical quality events.');
  } else if (oos > 2 || openCapa > 3 || rejectedBatches > 0) {
    overallQualityStatus = 'Satisfactory With Observation';
    overallRiskLevel = 'Medium';
    recommendations.push('Monitor CAPA effectiveness and OOS trending during the next review cycle.');
  } else if (averageCpk > 0 && averageCpk < 1.33) {
    overallQualityStatus = 'Needs Improvement';
    overallRiskLevel = 'Medium';
    recommendations.push('Review process capability and implement improvement actions.');
  }

  const stabilityOk = stabilityRecords === 0 || stabilityRecords > 0;
  const conclusionParts = [
    rejectedBatches === 0 && recalls === 0
      ? 'All batches manufactured during the review period were released and no batch was rejected.'
      : `${rejectedBatches} batch(es) rejected during the review period; remediation documented.`,
    openCriticalOos === 0 && oos === 0
      ? 'No OOS was observed during the review period.'
      : `${oos} OOS investigation(s) recorded during the review period.`,
    openCriticalDeviations === 0 && data.deviations === 0
      ? 'No incident or deviation was reported during the review period.'
      : `${data.deviations} deviation(s) recorded; ${openCriticalDeviations} critical open.`,
    stabilityOk
      ? 'Stability data reviewed during the period indicates that the product remains within approved specification.'
      : 'Stability program requires continued monitoring.',
    averageCpk >= 1.33
      ? 'Based on the reviewed data, the process is considered to be in a state of control.'
      : 'Process capability requires review against predefined acceptance criteria.',
  ];

  return {
    overallQualityStatus,
    overallRiskLevel,
    conclusion: conclusionParts.join(' '),
    recommendations: recommendations.join(' '),
  };
}

function sectionNarrative(
  key: string,
  product: PqrProductOption,
  from: string,
  to: string,
  data: PqrCollectedData,
): string {
  const s = data.summary;
  const narratives: Record<string, string> = {
    cover_page: `Product Quality Review for ${product.productName} (${product.productCode}) covering ${from} to ${to}.`,
    product_details: `${product.productName} is a ${product.dosageForm} containing ${product.genericName} ${product.strength}. Market: ${product.market || 'N/A'}. Shelf life: ${product.shelfLife || 'N/A'}.`,
    review_objective: 'To evaluate accumulated data for the product manufactured during the review period and confirm continued validation of manufacturing process and quality systems.',
    scope: 'Review covers batch manufacturing, materials, in-process and finished product quality, deviations, OOS, CAPA, change controls, stability, validation, equipment, complaints and recalls.',
    batch_manufacturing: s.totalBatches
      ? `${s.totalBatches} batch(es) manufactured; ${s.releasedBatches} released; ${s.rejectedBatches} rejected.`
      : 'No batch manufacturing records found for the selected review period.',
    raw_material: s.rawMaterialLots
      ? `${s.rawMaterialLots} raw material lot(s) reviewed; all within approved specifications.`
      : 'Raw material review data not available for the selected period.',
    packing_material: s.packingMaterialLots
      ? `${s.packingMaterialLots} packing material lot(s) reviewed during the period.`
      : 'Packing material review data not available for the selected period.',
    cpp_review: s.cppRecords
      ? `${s.cppRecords} CPP record(s) reviewed; critical process parameters monitored per validated ranges.`
      : 'CPP monitoring maintained per approved CPV plan.',
    in_process_cqa: s.cqaRecords
      ? `${s.cqaRecords} in-process CQA result(s) reviewed.`
      : 'In-process CQA monitoring maintained per approved specifications.',
    finished_product: s.cqaRecords
      ? 'Finished product specification results reviewed and found within approved limits where data available.'
      : 'Finished product testing maintained per approved specifications.',
    trend_analysis: 'Trend analysis performed for critical quality attributes during the review period.',
    yield_review: s.yieldRecords
      ? `Stage-wise yield remained within predefined acceptance criteria (${s.yieldRecords} record(s) reviewed).`
      : 'Yield data not available for the selected period.',
    batch_failure: s.rejectedBatches
      ? `${s.rejectedBatches} batch(es) rejected; root cause and disposition documented.`
      : 'No batch failure or rejection recorded during the review period.',
    rework_reprocess: 'Rework and reprocess events reviewed; none identified or all appropriately documented.',
    mfg_testing_procedure: 'Manufacturing and testing procedures reviewed; current approved versions in effect.',
    deviation_review: s.deviations
      ? `${s.deviations} deviation(s) recorded during the review period.`
      : 'No incident or deviation was reported during the review period.',
    oos_review: s.oos
      ? `${s.oos} OOS investigation(s) during the review period.`
      : 'No OOS was observed during the review period.',
    capa_review: s.capa
      ? `${s.capa} CAPA record(s) linked to product quality events.`
      : 'No open CAPA requiring escalation during the review period.',
    change_control: s.changeControls
      ? `${s.changeControls} change control record(s) reviewed.`
      : 'No significant change controls impacting product quality during the period.',
    stability_review: s.stabilityRecords
      ? 'Stability data reviewed during the period indicates that the product remains within approved specification.'
      : 'Stability program maintained per approved protocol.',
    validation_review: s.validationRecords
      ? `${s.validationRecords} validation record(s) reviewed; qualification status current.`
      : 'Validation and qualification status reviewed; systems within approved state.',
    equipment_review: s.equipmentRecords
      ? `${s.equipmentRecords} equipment record(s) reviewed for qualification status.`
      : 'Equipment qualification status reviewed; all critical equipment within qualification validity.',
    complaint_review: s.complaints
      ? `${s.complaints} market complaint(s) received during the review period.`
      : 'No market complaints received during the review period.',
    recall_review: s.recalls
      ? `${s.recalls} recall event(s) reviewed.`
      : 'No product recall or returned goods event during the review period.',
    technical_agreement: 'Technical agreements with contract manufacturers and suppliers reviewed.',
    supply_chain: 'Supply chain traceability reviewed for API, excipients and packaging components.',
    cqa_review: s.cqaRecords
      ? `${s.cqaRecords} CQA record(s) reviewed for continued process verification.`
      : 'CQA monitoring maintained per CPV requirements.',
    summary: `Annual PQR summary for ${product.productName}: ${s.totalBatches} batches, ${s.deviations} deviations, ${s.oos} OOS, ${s.capa} CAPA.`,
    conclusion: computeOverallAssessment(s).conclusion,
    revision_history: 'Revision 00 — Initial annual PQR generated from integrated QMS and CPV data.',
    approval_page: 'Prepared, reviewed and approved signatures captured on final submission.',
  };
  return narratives[key] || 'Section content to be reviewed by QA.';
}

export function buildPqrSections(
  pqrId: string,
  product: PqrProductOption,
  from: string,
  to: string,
  data: PqrCollectedData,
  actor: PqrCreateActor,
): PqrSectionRecord[] {
  const ts = nowIso();
  return PQR_SECTION_DEFINITIONS.map((def) => ({
    pqrId,
    sectionKey: def.key,
    sectionOrder: def.order,
    sectionTitle: def.title,
    narrative: sectionNarrative(def.key, product, from, to, data),
    dataSummary: '',
    included: true,
    status: 'Draft' as const,
    createdAt: ts,
    updatedAt: ts,
    createdBy: actor.id,
    updatedBy: actor.id,
    isDeleted: false,
  }));
}

export async function generateAnnualPqrNumber(productCode: string, year: number): Promise<string> {
  try {
    const result = await generateDocumentNumber('PQR', 'Annual PQR', {
      productCode,
      date: new Date(year, 0, 1),
      increment: true,
    });
    if (result.number) return result.number;
  } catch (e) {
    console.error('generateDocumentNumber fallback', e);
  }

  const records = await readFirst([PQR_CREATE_COLLECTIONS.records, PQR_CREATE_COLLECTIONS.recordsLegacy]);
  const yearRecords = records.filter((r) =>
    num(r.reviewYear || r.pqr_year) === year
    && str(r.productCode || r.product_code) === productCode,
  );
  const seq = String(yearRecords.length + 1).padStart(4, '0');
  return `PQR/${productCode || 'PRD'}/${seq}/${year}`;
}

const defaultApprovals = [
  { approval_type: 'prepared', designation: 'Executive QA', name: '', status: 'Pending' },
  { approval_type: 'reviewed', designation: 'Manager QA', name: '', status: 'Pending' },
  { approval_type: 'reviewed', designation: 'Manager QC', name: '', status: 'Pending' },
  { approval_type: 'reviewed', designation: 'Manager Production', name: '', status: 'Pending' },
  { approval_type: 'approved', designation: 'Head QA', name: '', status: 'Pending' },
];

export async function createAnnualPqrDraft(input: {
  product: PqrProductOption;
  reviewPeriodFrom: string;
  reviewPeriodTo: string;
  reviewYear: number;
  pqrFrequency: PqrCreateRecord['pqrFrequency'];
  dueDate: string;
  pqrOwner: string;
  reviewScope: ReviewScope;
  collectedData: PqrCollectedData;
  pqrNumber?: string;
  qaOverride?: boolean;
  actor: PqrCreateActor;
}): Promise<{ pqrId: string; pqrNumber: string; sections: PqrSectionRecord[]; error?: string }> {
  if (!isFirebaseConfigured()) {
    return { pqrId: '', pqrNumber: '', sections: [], error: 'Firebase is not configured.' };
  }

  const { product, actor } = input;
  const assessment = computeOverallAssessment(input.collectedData.summary);
  const pqrNumber = input.pqrNumber || await generateAnnualPqrNumber(product.productCode, input.reviewYear);
  const ts = nowIso();
  const pqrIdValue = `PQR-${Date.now().toString(36).toUpperCase()}`;

  const record: PqrCreateRecord = {
    pqrId: pqrIdValue,
    pqrNumber,
    pqrTitle: `Annual Product Quality Review — ${product.productName} (${input.reviewYear})`,
    productId: product.id,
    productCode: product.productCode,
    productName: product.productName,
    genericName: product.genericName,
    brandName: product.brandName,
    strength: product.strength,
    dosageForm: product.dosageForm,
    routeOfAdministration: product.routeOfAdministration,
    packSize: product.packSize,
    market: product.market,
    shelfLife: product.shelfLife,
    storageCondition: product.storageCondition,
    manufacturingLicenseNumber: product.manufacturingLicenseNumber,
    mfrNumber: product.mfrNumber,
    bmrNumber: product.bmrNumber,
    bprNumber: product.bprNumber,
    specificationNumber: product.specificationNumber,
    stpNumber: product.stpNumber,
    reviewPeriodFrom: input.reviewPeriodFrom,
    reviewPeriodTo: input.reviewPeriodTo,
    reviewYear: input.reviewYear,
    pqrFrequency: input.pqrFrequency,
    pqrOwner: input.pqrOwner || actor.name,
    preparedBy: actor.name,
    reviewedBy: '',
    approvedBy: '',
    dueDate: input.dueDate,
    status: 'Generated',
    overallQualityStatus: assessment.overallQualityStatus,
    overallRiskLevel: assessment.overallRiskLevel,
    executiveSummary: `Annual PQR for ${product.productName} covering ${input.reviewPeriodFrom} to ${input.reviewPeriodTo}. ${input.collectedData.summary.totalBatches} batches reviewed.`,
    conclusion: assessment.conclusion,
    recommendations: assessment.recommendations,
    remarks: '',
    reviewScope: input.reviewScope,
    collectedSummary: input.collectedData.summary,
    qaOverride: input.qaOverride || false,
    createdAt: ts,
    updatedAt: ts,
    createdBy: actor.id,
    updatedBy: actor.id,
    createdByName: actor.name,
    updatedByName: actor.name,
    isDeleted: false,
  };

  try {
    const docRef = await addDoc(collection(getFirebaseFirestore(), PQR_CREATE_COLLECTIONS.records), record);
    const sections = buildPqrSections(docRef.id, product, input.reviewPeriodFrom, input.reviewPeriodTo, input.collectedData, actor);
    const batch = writeBatch(getFirebaseFirestore());

    sections.forEach((section) => {
      const ref = doc(collection(getFirebaseFirestore(), PQR_CREATE_COLLECTIONS.sections));
      batch.set(ref, { ...section, pqrId: docRef.id });
    });

    defaultApprovals.forEach((a) => {
      const ref = doc(collection(getFirebaseFirestore(), PQR_CREATE_COLLECTIONS.approvals));
      batch.set(ref, {
        ...a,
        pqr_id: docRef.id,
        pqrId: docRef.id,
        name: a.approval_type === 'prepared' ? actor.name : '',
        signature_url: '',
        signature_text: '',
        approval_date: null,
        remarks: '',
        createdAt: ts,
        createdBy: actor.id,
        isDeleted: false,
      });
    });

    await batch.commit();
    await logCreateAudit('PQR sections generated', actor, { pqrId: docRef.id, pqrNumber, sectionCount: sections.length }, docRef.id);
    await logCreateAudit('create PQR draft', actor, { pqrId: docRef.id, pqrNumber }, docRef.id);

    return { pqrId: docRef.id, pqrNumber, sections };
  } catch (e) {
    console.error('createAnnualPqrDraft failed', e);
    return { pqrId: '', pqrNumber: '', sections: [], error: (e as Error).message || 'Failed to create PQR draft' };
  }
}

export async function fetchPqrSections(pqrId: string): Promise<PqrSectionRecord[]> {
  if (!isFirebaseConfigured()) return [];
  try {
    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), PQR_CREATE_COLLECTIONS.sections),
      where('pqrId', '==', pqrId),
    ));
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() } as PqrSectionRecord))
      .filter((s) => !s.isDeleted)
      .sort((a, b) => a.sectionOrder - b.sectionOrder);
  } catch (e) {
    console.error('fetchPqrSections failed', e);
    return [];
  }
}

export async function updatePqrSectionNarrative(
  sectionId: string,
  narrative: string,
  actor: PqrCreateActor,
): Promise<{ error?: string }> {
  if (!isFirebaseConfigured()) return { error: 'Firebase is not configured.' };
  try {
    await updateDoc(doc(getFirebaseFirestore(), PQR_CREATE_COLLECTIONS.sections, sectionId), {
      narrative,
      updatedAt: nowIso(),
      updatedBy: actor.id,
    });
    await logCreateAudit('section edited', actor, { sectionId }, sectionId);
    return {};
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function savePqrDraft(
  pqrId: string,
  updates: Partial<Pick<PqrCreateRecord, 'executiveSummary' | 'conclusion' | 'recommendations' | 'remarks' | 'status'>>,
  actor: PqrCreateActor,
): Promise<{ error?: string }> {
  if (!isFirebaseConfigured()) return { error: 'Firebase is not configured.' };
  try {
    await updateDoc(doc(getFirebaseFirestore(), PQR_CREATE_COLLECTIONS.records, pqrId), {
      ...updates,
      updatedAt: nowIso(),
      updatedBy: actor.id,
      updatedByName: actor.name,
    });
    await logCreateAudit('save draft', actor, updates, pqrId);
    return {};
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function submitPqrForReview(pqrId: string, actor: PqrCreateActor): Promise<{ error?: string }> {
  if (!isFirebaseConfigured()) return { error: 'Firebase is not configured.' };
  try {
    await updateDoc(doc(getFirebaseFirestore(), PQR_CREATE_COLLECTIONS.records, pqrId), {
      status: 'Under Review',
      updatedAt: nowIso(),
      updatedBy: actor.id,
      updatedByName: actor.name,
    });
    await logCreateAudit('submit for review', actor, { pqrId }, pqrId);
    await sendInAppNotification({
      userId: actor.id,
      moduleName: 'PQR',
      eventName: 'PQR Submitted for Review',
      recordId: pqrId,
      title: 'PQR submitted for review',
      message: 'Annual PQR has been submitted and awaits QA review.',
      type: 'approval',
      recipientRole: 'qa_manager',
      actionLink: `/pqr/${pqrId}`,
    });
    return {};
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function uploadPqrAttachment(
  pqrId: string,
  file: File,
  actor: PqrCreateActor,
): Promise<{ url?: string; error?: string }> {
  if (!isFirebaseConfigured()) return { error: 'Firebase is not configured.' };
  try {
    const path = `pqr/${pqrId}/attachments/${Date.now()}_${file.name}`;
    const storageRef = ref(getFirebaseStorage(), path);
    await uploadBytes(storageRef, file);
    const url = await getDownloadURL(storageRef);
    await logCreateAudit('attachment uploaded', actor, { pqrId, fileName: file.name, path }, pqrId);
    return { url };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function logPqrCreateView(actor: PqrCreateActor) {
  await logCreateAudit('create wizard viewed', actor);
}

export async function logPqrCreateProductSelected(actor: PqrCreateActor, product: PqrProductOption) {
  await logCreateAudit('product selected', actor, { productId: product.id, productName: product.productName });
}

export async function logPqrCreatePeriodSelected(actor: PqrCreateActor, from: string, to: string) {
  await logCreateAudit('review period selected', actor, { from, to });
}

export async function logPqrCreateExport(actor: PqrCreateActor, type: 'pdf' | 'excel') {
  await logCreateAudit(type === 'pdf' ? 'PDF export clicked' : 'Excel export clicked', actor);
}

export async function logPqrCreateOverride(actor: PqrCreateActor, reason: string) {
  await logCreateAudit('QA override', actor, { reason });
}
