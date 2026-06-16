import {
  addDoc, collection, getDocs, limit, orderBy, query, where,
} from 'firebase/firestore';
import { ref, uploadString } from 'firebase/storage';
import { getFirebaseFirestore, isFirebaseConfigured, getFirebaseStorage } from '@/lib/firebase';
import { createRecord, getRecord, getRecords, updateRecord, type DocumentActor } from '@/lib/firestore';
import { createAuditLog, writeAuditTrail } from '@/lib/audit-trail';
import { listCpvRecords } from '@/lib/cpv-service';
import { CPV_COLLECTIONS, CppRecord, CqaRecord, RiskRecord } from '@/lib/cpv';
import { fetchStabilityResults } from '@/lib/cpv-stability-monitoring-service';
import { fetchHoldTimeRecords } from '@/lib/cpv-hold-time-monitoring-service';
import { fetchProcessCapabilityRecords } from '@/lib/cpv-process-capability-service';
import { fetchTrendAnalysisRecords } from '@/lib/cpv-trend-analysis-service';
import { fetchSpcRecords } from '@/lib/cpv-spc-service';
import { fetchRawMaterialRecords } from '@/lib/cpv-raw-material-monitoring-service';
import { fetchPackingMaterialRecords } from '@/lib/cpv-packing-material-monitoring-service';
import { fetchUtilityRecords } from '@/lib/cpv-utility-monitoring-service';
import { fetchEnvironmentalRecords } from '@/lib/cpv-environmental-monitoring-service';
import { fetchYieldRecords } from '@/lib/cpv-yield-monitoring-service';
import { fetchRiskAssessmentRecords } from '@/lib/cpv-risk-assessment-service';
import { fetchCpvBatches } from '@/lib/cpv-batch-registration-service';
import {
  AnnualCpvDocument,
  AnnualCpvSignature,
  AnnualCpvSnapshot,
  AnnualCpvWorkflowStatus,
  DEFAULT_ANNUAL_CPV_SIGNATURES,
  buildAnnualCpvSnapshot,
  generateAnnualCpvNumber,
} from '@/lib/cpv-annual-review';
import {
  CPV_REVIEW_APPROVALS_COLLECTION,
  CPV_REVIEW_COLLECTION,
  CPV_REVIEW_LEGACY,
  CPV_REVIEW_MODULE,
  CPV_REVIEW_SECTIONS_COLLECTION,
  REPORT_SECTION_KEYS,
  REPORT_SECTION_LABELS,
  buildCpvReviewId,
  generateCpvReviewNumber,
  type CpvAnnualReviewRecord,
  type CpvReviewApprovalRecord,
  type CpvReviewFormData,
  type CpvReviewSectionRecord,
  type CpvReviewStatus,
} from '@/lib/cpv-annual-review-records';

export type AnnualReviewActor = { id: string; name: string; role?: string };

function actorCtx(actor: AnnualReviewActor) {
  return { moduleName: CPV_REVIEW_MODULE, actor: { id: actor.id, name: actor.name } as DocumentActor };
}

async function logReviewAudit(
  actionType: string,
  recordId: string,
  actor: AnnualReviewActor,
  oldVal?: unknown,
  newVal?: unknown,
  docNo?: string,
) {
  try {
    await createAuditLog({
      moduleName: CPV_REVIEW_MODULE,
      collectionName: CPV_REVIEW_COLLECTION,
      recordId,
      documentNumber: docNo,
      actionType,
      oldValue: oldVal,
      newValue: newVal,
      user: { id: actor.id, name: actor.name },
      status: 'Success',
    });
    await writeAuditTrail({
      collectionName: CPV_REVIEW_COLLECTION,
      documentId: recordId,
      action: actionType,
      oldValue: oldVal,
      newValue: newVal,
      userId: actor.id,
      userName: actor.name,
      moduleName: CPV_REVIEW_MODULE,
    });
  } catch (e) {
    console.error('logReviewAudit failed', e);
  }
}

async function readFirstAvailable(candidates: string[], max = 500): Promise<Record<string, unknown>[]> {
  if (!isFirebaseConfigured()) return [];
  for (const name of candidates) {
    try {
      const snap = await getDocs(query(collection(getFirebaseFirestore(), name), orderBy('createdAt', 'desc'), limit(max)));
      if (!snap.empty) return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch {
      try {
        const snap = await getDocs(query(collection(getFirebaseFirestore(), name), limit(max)));
        if (!snap.empty) return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      } catch { /* try next */ }
    }
  }
  return [];
}

function str(v: unknown, fb = ''): string {
  if (v === null || v === undefined) return fb;
  return String(v);
}

function num(v: unknown, fb = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fb;
}

function mapLegacyStatus(status: string): CpvReviewStatus {
  const map: Record<string, CpvReviewStatus> = {
    draft: 'Draft',
    under_review: 'Under Review',
    approved: 'Approved',
    archived: 'Archived',
  };
  return map[status] || (status as CpvReviewStatus) || 'Draft';
}

function buildSectionsFromSnapshot(reviewId: string, snap: AnnualCpvSnapshot): CpvReviewSectionRecord[] {
  const sectionData: Record<string, { summary: string; content?: string }> = {
    executiveSummary: { summary: snap.executiveSummary, content: snap.executiveSummary },
    productBatchSummary: { summary: snap.batches.summary, content: snap.batches.summary },
    cppReview: { summary: snap.cpp.summary },
    cqaReview: { summary: snap.cqa.summary },
    rawMaterialReview: { summary: snap.rawMaterial.summary },
    packingMaterialReview: { summary: snap.packingMaterial.summary },
    utilityReview: { summary: snap.utility.summary },
    environmentalReview: { summary: snap.environmental.summary },
    yieldReview: { summary: snap.yield.summary },
    stabilityReview: { summary: snap.stability.summary },
    holdTimeReview: { summary: snap.holdTime.summary },
    processCapabilityReview: { summary: snap.processCapability.summary },
    trendAnalysisReview: { summary: snap.trendAnalysis.summary },
    spcReview: { summary: snap.spc.summary },
    riskAssessmentSummary: { summary: snap.risk.summary },
    deviationReview: { summary: snap.deviations.summary },
    oosReview: { summary: snap.oos.summary },
    capaReview: { summary: snap.capa.summary },
    changeControlReview: { summary: snap.changeControl.summary },
    recommendations: { summary: snap.recommendations, content: snap.recommendations },
    finalConclusion: { summary: snap.conclusion, content: snap.conclusion },
    approvalPage: { summary: 'Electronic signatures and approval page.' },
  };

  return REPORT_SECTION_KEYS.map((key) => ({
    cpvReviewId: reviewId,
    sectionKey: key,
    sectionTitle: REPORT_SECTION_LABELS[key],
    content: sectionData[key]?.content || sectionData[key]?.summary || '',
    summary: sectionData[key]?.summary || '',
  }));
}

export function normalizeCpvReviewRecord(raw: Record<string, unknown>): CpvAnnualReviewRecord {
  const snap = (raw.snapshot || {}) as AnnualCpvSnapshot;
  const metrics = snap.metrics || {
    totalBatchesReviewed: num(raw.totalBatchesReviewed, snap.batches?.total),
    releasedBatches: num(snap.batches?.released),
    rejectedBatches: num(snap.batches?.rejected),
    holdBatches: 0,
    cppCompliancePct: snap.cpp?.total ? ((snap.cpp.complies || 0) / snap.cpp.total) * 100 : 100,
    cqaCompliancePct: snap.cqa?.total ? ((snap.cqa.complies || 0) / snap.cqa.total) * 100 : 100,
    yieldAverage: num(snap.yield?.averageYield),
    ootCount: num(snap.trend?.oot),
    oosCount: num(snap.trend?.oos),
    deviationCount: num(snap.deviations?.total),
    capaCount: num(snap.capa?.total),
    openRiskCount: 0,
    highRiskCount: num(snap.risk?.high),
    criticalOpenRiskCount: num(snap.risk?.critical),
    criticalOosOpen: 0,
    repeatedOot: false,
    sterilityEndotoxinFailure: false,
    averageCp: num(snap.capability?.averageCpk),
    averageCpk: num(raw.averageCpk, snap.capability?.averageCpk),
    averagePp: num(snap.capability?.averagePpk),
    averagePpk: num(raw.averagePpk, snap.capability?.averagePpk),
  };

  return {
    id: str(raw.id),
    cpvReviewId: str(raw.cpvReviewId || raw.cpv_review_id, buildCpvReviewId(str(raw.productCode))),
    cpvReviewNumber: str(raw.cpvReviewNumber || raw.cpv_review_number || raw.documentNumber, 'CPV/DRAFT/0001'),
    productName: str(raw.productName || raw.product_name, snap.productFilter || 'All Products'),
    productCode: str(raw.productCode || raw.product_code),
    genericName: str(raw.genericName || raw.generic_name),
    strength: str(raw.strength),
    dosageForm: str(raw.dosageForm || raw.dosage_form),
    reviewPeriodFrom: str(raw.reviewPeriodFrom || raw.review_period_from, `${raw.reviewYear || snap.reviewYear}-01-01`),
    reviewPeriodTo: str(raw.reviewPeriodTo || raw.review_period_to, `${raw.reviewYear || snap.reviewYear}-12-31`),
    reviewYear: num(raw.reviewYear || snap.reviewYear, new Date().getFullYear()),
    totalBatchesReviewed: num(raw.totalBatchesReviewed, metrics.totalBatchesReviewed),
    totalCppParametersReviewed: num(raw.totalCppParametersReviewed, snap.cpp?.total),
    totalCqaParametersReviewed: num(raw.totalCqaParametersReviewed, snap.cqa?.total),
    totalDeviations: num(raw.totalDeviations, snap.deviations?.total),
    totalOos: num(raw.totalOos, snap.oos?.total),
    totalCapa: num(raw.totalCapa, snap.capa?.total),
    totalChangeControls: num(raw.totalChangeControls, snap.changeControl?.total),
    averageCpk: num(raw.averageCpk, metrics.averageCpk),
    averagePpk: num(raw.averagePpk, metrics.averagePpk),
    overallProcessStatus: (str(raw.overallProcessStatus || snap.overallProcessStatus, 'Under Control With Monitoring') as CpvAnnualReviewRecord['overallProcessStatus']),
    overallRiskLevel: (str(raw.overallRiskLevel || snap.overallRiskLevel, 'Medium') as CpvAnnualReviewRecord['overallRiskLevel']),
    executiveSummary: str(raw.executiveSummary, snap.executiveSummary),
    conclusion: str(raw.conclusion, snap.conclusion),
    recommendations: str(raw.recommendations, snap.recommendations),
    preparedBy: str(raw.preparedBy),
    reviewedBy: str(raw.reviewedBy),
    approvedBy: str(raw.approvedBy),
    reviewStatus: mapLegacyStatus(str(raw.reviewStatus || raw.status, 'Draft')),
    metrics,
    snapshot: snap as unknown as Record<string, unknown>,
    sections: Array.isArray(raw.sections) ? raw.sections as CpvReviewSectionRecord[] : [],
    signatures: (Array.isArray(raw.signatures) ? raw.signatures : DEFAULT_ANNUAL_CPV_SIGNATURES) as CpvReviewApprovalRecord[],
    createdAt: str(raw.createdAt),
    updatedAt: str(raw.updatedAt),
    createdBy: str(raw.createdBy),
    updatedBy: str(raw.updatedBy),
    createdByName: str(raw.createdByName),
    updatedByName: str(raw.updatedByName),
    isDeleted: Boolean(raw.isDeleted),
  };
}

export function toAnnualCpvDocument(record: CpvAnnualReviewRecord): AnnualCpvDocument {
  return {
    id: record.id,
    documentNumber: record.cpvReviewNumber,
    reviewYear: record.reviewYear,
    productName: record.productName,
    status: record.reviewStatus.toLowerCase().replace(/\s+/g, '_') as AnnualCpvWorkflowStatus,
    conclusion: record.conclusion,
    recommendations: record.recommendations,
    preparedBy: record.preparedBy,
    preparedById: record.createdBy,
    signatures: record.signatures as unknown as AnnualCpvSignature[],
    snapshot: record.snapshot as unknown as AnnualCpvSnapshot,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    version: 1,
  };
}

export async function loadAnnualReviewSourceData(
  year: number,
  productFilter = 'all',
  reviewPeriodFrom?: string,
  reviewPeriodTo?: string,
  productCode = '',
) {
  if (!isFirebaseConfigured()) {
    const emptySnap = buildAnnualCpvSnapshot({
      year, productFilter, productCode, reviewPeriodFrom, reviewPeriodTo,
      cpp: [], cqa: [], risks: [], deviations: [], oos: [], capa: [],
      changeControl: [], batches: [], equipment: [],
    });
    return { snapshot: emptySnap, raw: {} };
  }

  try {
    const [
      cpp, cqa, risks, riskAssessment, deviations, oos, capa, changeControl,
      cpvBatches, equipmentRaw, stabilityResults, holdTimeResults,
      capabilityResults, trendAnalysisResults, spcResults,
      rawMaterialResults, packingMaterialResults, utilityResults,
      environmentalResults, yieldResults,
    ] = await Promise.all([
      listCpvRecords<CppRecord>(CPV_COLLECTIONS.cpp, 1000),
      listCpvRecords<CqaRecord>(CPV_COLLECTIONS.cqa, 1000),
      listCpvRecords<RiskRecord>(CPV_COLLECTIONS.risk, 500),
      fetchRiskAssessmentRecords(500),
      readFirstAvailable(['deviations']),
      readFirstAvailable(['oos_records', 'oos']),
      readFirstAvailable(['capa_records', 'capa']),
      readFirstAvailable(['change_controls', 'change_control']),
      fetchCpvBatches().catch(() => readFirstAvailable(['cpv_batches', 'batches', 'pqr_batches'])),
      readFirstAvailable(['equipment', 'equipment_qualification', 'equipment_records']),
      fetchStabilityResults(1000),
      fetchHoldTimeRecords(1000),
      fetchProcessCapabilityRecords(500),
      fetchTrendAnalysisRecords(500),
      fetchSpcRecords(500),
      fetchRawMaterialRecords(500),
      fetchPackingMaterialRecords(500),
      fetchUtilityRecords(500),
      fetchEnvironmentalRecords(500),
      fetchYieldRecords(500),
    ]);

    const batches = (Array.isArray(cpvBatches) ? cpvBatches : []).map((b) =>
      typeof b === 'object' && b !== null ? b as Record<string, unknown> : {},
    );

    const snapshot = buildAnnualCpvSnapshot({
      year,
      productFilter,
      productCode,
      reviewPeriodFrom,
      reviewPeriodTo,
      cpp,
      cqa,
      risks,
      riskAssessment: riskAssessment as unknown as Record<string, unknown>[],
      deviations,
      oos,
      capa,
      changeControl,
      batches,
      equipment: equipmentRaw,
      stability: stabilityResults as unknown as Record<string, unknown>[],
      holdTime: holdTimeResults as unknown as Record<string, unknown>[],
      processCapability: capabilityResults as unknown as Record<string, unknown>[],
      trendAnalysis: trendAnalysisResults as unknown as Record<string, unknown>[],
      spc: spcResults as unknown as Record<string, unknown>[],
      rawMaterial: rawMaterialResults as unknown as Record<string, unknown>[],
      packingMaterial: packingMaterialResults as unknown as Record<string, unknown>[],
      utility: utilityResults as unknown as Record<string, unknown>[],
      environmental: environmentalResults as unknown as Record<string, unknown>[],
      yield: yieldResults as unknown as Record<string, unknown>[],
    });

    return {
      snapshot,
      raw: {
        cpp, cqa, risks, riskAssessment, deviations, oos, capa, changeControl,
        batches, equipment: equipmentRaw, stability: stabilityResults,
        holdTime: holdTimeResults, processCapability: capabilityResults,
        trendAnalysis: trendAnalysisResults, spc: spcResults,
        rawMaterial: rawMaterialResults, packingMaterial: packingMaterialResults,
        utility: utilityResults, environmental: environmentalResults, yield: yieldResults,
      },
    };
  } catch (e) {
    console.error('loadAnnualReviewSourceData failed', e);
    throw e;
  }
}

export async function fetchCpvReviewRecords(max = 100): Promise<CpvAnnualReviewRecord[]> {
  if (!isFirebaseConfigured()) return [];
  try {
    let rows: CpvAnnualReviewRecord[] = [];
    try {
      rows = await getRecords<CpvAnnualReviewRecord>(CPV_REVIEW_COLLECTION, [orderBy('createdAt', 'desc'), limit(max)]);
    } catch {
      rows = await getRecords<CpvAnnualReviewRecord>(CPV_REVIEW_COLLECTION, [limit(max)]);
    }
    if (rows.length) return rows.map((r) => normalizeCpvReviewRecord(r as unknown as Record<string, unknown>));
    for (const legacy of CPV_REVIEW_LEGACY) {
      try {
        const legacyRows = await getRecords<Record<string, unknown>>(legacy, [limit(max)]);
        if (legacyRows.length) return legacyRows.map(normalizeCpvReviewRecord);
      } catch { /* continue */ }
    }
    return [];
  } catch (e) {
    console.error('fetchCpvReviewRecords failed', e);
    return [];
  }
}

export async function fetchCpvReviewById(id: string): Promise<CpvAnnualReviewRecord | null> {
  if (!isFirebaseConfigured()) return null;
  try {
    const record = await getRecord<CpvAnnualReviewRecord>(CPV_REVIEW_COLLECTION, id);
    if (record) return normalizeCpvReviewRecord(record as unknown as Record<string, unknown>);
    for (const legacy of CPV_REVIEW_LEGACY) {
      const legacyRecord = await getRecord<Record<string, unknown>>(legacy, id);
      if (legacyRecord) return normalizeCpvReviewRecord(legacyRecord);
    }
    return null;
  } catch (e) {
    console.error('fetchCpvReviewById failed', e);
    return null;
  }
}

export async function fetchCpvReviewSections(reviewId: string): Promise<CpvReviewSectionRecord[]> {
  if (!isFirebaseConfigured()) return [];
  try {
    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), CPV_REVIEW_SECTIONS_COLLECTION),
      where('cpvReviewId', '==', reviewId),
      limit(50),
    ));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as CpvReviewSectionRecord));
  } catch (e) {
    console.error('fetchCpvReviewSections failed', e);
    return [];
  }
}

export async function fetchCpvReviewAuditTrail(reviewId: string) {
  if (!isFirebaseConfigured()) return [];
  try {
    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), 'audit_trail'),
      where('documentId', '==', reviewId),
      orderBy('createdAt', 'desc'),
      limit(50),
    ));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch {
    try {
      const snap = await getDocs(query(collection(getFirebaseFirestore(), 'audit_trail'), limit(100)));
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
        .filter((r: Record<string, unknown>) => String(r.documentId || r.recordId) === reviewId);
    } catch (e) {
      console.error('fetchCpvReviewAuditTrail failed', e);
      return [];
    }
  }
}

async function saveReviewSections(reviewId: string, sections: CpvReviewSectionRecord[], actor: AnnualReviewActor) {
  for (const section of sections) {
    try {
      await addDoc(collection(getFirebaseFirestore(), CPV_REVIEW_SECTIONS_COLLECTION), {
        ...section,
        cpvReviewId: reviewId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: actor.id,
        updatedBy: actor.id,
        isDeleted: false,
      });
    } catch (e) {
      console.error('saveReviewSections failed', e);
    }
  }
}

export async function createCpvReview(
  form: CpvReviewFormData,
  snapshot: AnnualCpvSnapshot,
  actor: AnnualReviewActor,
  existingCount = 0,
): Promise<{ result: CpvAnnualReviewRecord | null; error: string | null }> {
  if (!isFirebaseConfigured()) return { result: null, error: 'Firebase is not configured.' };
  if (snapshot.batches.total < 1 && snapshot.metrics.totalBatchesReviewed < 1) {
    return { result: null, error: 'At least one batch is required for review.' };
  }
  try {
    const year = new Date(form.reviewPeriodTo).getFullYear();
    const cpvReviewNumber = generateCpvReviewNumber(year, existingCount);
    const cpvReviewId = buildCpvReviewId(form.productCode || form.productName);
    const sections = buildSectionsFromSnapshot(cpvReviewId, snapshot);

    const payload = {
      cpvReviewId,
      cpvReviewNumber,
      productName: form.productName,
      productCode: form.productCode,
      genericName: form.genericName,
      strength: form.strength,
      dosageForm: form.dosageForm,
      reviewPeriodFrom: form.reviewPeriodFrom,
      reviewPeriodTo: form.reviewPeriodTo,
      reviewYear: year,
      totalBatchesReviewed: snapshot.metrics.totalBatchesReviewed,
      totalCppParametersReviewed: snapshot.cpp.total,
      totalCqaParametersReviewed: snapshot.cqa.total,
      totalDeviations: snapshot.deviations.total,
      totalOos: snapshot.oos.total,
      totalCapa: snapshot.capa.total,
      totalChangeControls: snapshot.changeControl.total,
      averageCpk: snapshot.metrics.averageCpk,
      averagePpk: snapshot.metrics.averagePpk,
      overallProcessStatus: snapshot.overallProcessStatus,
      overallRiskLevel: snapshot.overallRiskLevel,
      executiveSummary: form.executiveSummary || snapshot.executiveSummary,
      conclusion: form.conclusion || snapshot.conclusion,
      recommendations: form.recommendations || snapshot.recommendations,
      preparedBy: actor.name,
      reviewedBy: '',
      approvedBy: '',
      reviewStatus: 'Generated' as const,
      metrics: snapshot.metrics,
      snapshot,
      sections,
      signatures: DEFAULT_ANNUAL_CPV_SIGNATURES.map((s, i) => ({
        ...s,
        name: i === 0 ? actor.name : '',
        signatureText: i === 0 ? actor.name : '',
        signedAt: i === 0 ? new Date().toISOString() : null,
        userId: i === 0 ? actor.id : undefined,
      })),
      createdByName: actor.name,
      updatedByName: actor.name,
    };

    const created = await createRecord(
      CPV_REVIEW_COLLECTION,
      payload as unknown as Omit<CpvAnnualReviewRecord, 'id' | 'createdAt' | 'updatedAt' | 'isDeleted'>,
      actorCtx(actor),
    );
    const result = normalizeCpvReviewRecord(created as unknown as Record<string, unknown>);
    await saveReviewSections(result.id, sections, actor);
    await logReviewAudit('create CPV review', result.id, actor, null, result, result.cpvReviewNumber);
    await logReviewAudit('collect data', result.id, actor, null, snapshot.metrics, result.cpvReviewNumber);
    await logReviewAudit('generate review sections', result.id, actor, null, sections.length, result.cpvReviewNumber);
    return { result, error: null };
  } catch (e) {
    console.error('createCpvReview failed', e);
    return { result: null, error: 'Failed to create CPV review.' };
  }
}

export async function updateCpvReview(
  id: string,
  updates: Partial<CpvReviewFormData & Pick<CpvAnnualReviewRecord, 'reviewStatus' | 'conclusion' | 'recommendations' | 'executiveSummary' | 'sections'>>,
  actor: AnnualReviewActor,
  existing: CpvAnnualReviewRecord,
): Promise<{ result: CpvAnnualReviewRecord | null; error: string | null }> {
  try {
    const payload = { ...updates, updatedByName: actor.name };
    const updated = await updateRecord(CPV_REVIEW_COLLECTION, id, payload as Partial<CpvAnnualReviewRecord>, actorCtx(actor));
    if (!updated) return { result: null, error: 'Not found.' };
    const result = normalizeCpvReviewRecord(updated as unknown as Record<string, unknown>);
    await logReviewAudit('edit section', id, actor, existing, result, result.cpvReviewNumber);
    return { result, error: null };
  } catch (e) {
    console.error('updateCpvReview failed', e);
    return { result: null, error: 'Update failed.' };
  }
}

export async function submitCpvReviewForApproval(
  id: string,
  actor: AnnualReviewActor,
  existing: CpvAnnualReviewRecord,
): Promise<{ error: string | null }> {
  if (!existing.executiveSummary?.trim()) {
    return { error: 'Executive summary is required before submission.' };
  }
  try {
    await updateRecord(CPV_REVIEW_COLLECTION, id, {
      reviewStatus: 'Under Review',
      reviewedBy: actor.name,
      updatedByName: actor.name,
    }, actorCtx(actor));
    await logReviewAudit('submit for review', id, actor, existing.reviewStatus, 'Under Review', existing.cpvReviewNumber);
    return { error: null };
  } catch (e) {
    console.error('submitCpvReviewForApproval failed', e);
    return { error: 'Submission failed.' };
  }
}

export async function approveCpvReview(
  id: string,
  actor: AnnualReviewActor,
  existing: CpvAnnualReviewRecord,
  signature: { signatureText: string; meaning: string; reason: string },
): Promise<{ error: string | null }> {
  if (!existing.conclusion?.trim()) {
    return { error: 'Conclusion is required before approval.' };
  }
  try {
    const signatures = (existing.signatures || DEFAULT_ANNUAL_CPV_SIGNATURES).map((s) =>
      s.role === 'approved'
        ? { ...s, name: actor.name, signatureText: signature.signatureText, meaning: signature.meaning, reason: signature.reason, signedAt: new Date().toISOString(), userId: actor.id }
        : s,
    );
    await updateRecord(CPV_REVIEW_COLLECTION, id, {
      reviewStatus: 'Approved',
      approvedBy: actor.name,
      signatures,
      updatedByName: actor.name,
    }, actorCtx(actor));
    await addDoc(collection(getFirebaseFirestore(), CPV_REVIEW_APPROVALS_COLLECTION), {
      cpvReviewId: id,
      role: 'approved',
      name: actor.name,
      signatureText: signature.signatureText,
      meaning: signature.meaning,
      reason: signature.reason,
      signedAt: new Date().toISOString(),
      userId: actor.id,
      status: 'Approved',
      createdAt: new Date().toISOString(),
      createdBy: actor.id,
      isDeleted: false,
    });
    await logReviewAudit('approve', id, actor, existing.reviewStatus, 'Approved', existing.cpvReviewNumber);
    await logReviewAudit('e-signature', id, actor, null, signature, existing.cpvReviewNumber);
    return { error: null };
  } catch (e) {
    console.error('approveCpvReview failed', e);
    return { error: 'Approval failed.' };
  }
}

export async function rejectCpvReview(id: string, actor: AnnualReviewActor, existing: CpvAnnualReviewRecord) {
  try {
    await updateRecord(CPV_REVIEW_COLLECTION, id, { reviewStatus: 'Rejected', updatedByName: actor.name }, actorCtx(actor));
    await logReviewAudit('reject', id, actor, existing.reviewStatus, 'Rejected', existing.cpvReviewNumber);
    return { error: null };
  } catch (e) {
    console.error('rejectCpvReview failed', e);
    return { error: 'Reject failed.' };
  }
}

export async function archiveCpvReview(id: string, actor: AnnualReviewActor, existing: CpvAnnualReviewRecord) {
  try {
    await updateRecord(CPV_REVIEW_COLLECTION, id, { reviewStatus: 'Archived', updatedByName: actor.name }, actorCtx(actor));
    await logReviewAudit('archive', id, actor, existing.reviewStatus, 'Archived', existing.cpvReviewNumber);
    return { error: null };
  } catch (e) {
    console.error('archiveCpvReview failed', e);
    return { error: 'Archive failed.' };
  }
}

export async function uploadCpvReviewPdfPlaceholder(reviewId: string, reviewNumber: string, htmlContent: string) {
  if (!isFirebaseConfigured()) return null;
  try {
    const path = `cpv-reviews/${reviewId}/${reviewNumber.replace(/\//g, '-')}.html`;
    const fileRef = ref(getFirebaseStorage(), path);
    await uploadString(fileRef, htmlContent, 'raw', { contentType: 'text/html' });
    return path;
  } catch (e) {
    console.error('uploadCpvReviewPdfPlaceholder failed', e);
    return null;
  }
}

export async function logCpvReviewExport(actor: AnnualReviewActor, type: 'PDF' | 'Excel', reviewId: string, reviewNumber: string) {
  await logReviewAudit(`export ${type}`, reviewId, actor, null, type, reviewNumber);
}

/* Legacy compatibility exports */
export async function listAnnualCpvDocuments(): Promise<AnnualCpvDocument[]> {
  const records = await fetchCpvReviewRecords();
  return records.map(toAnnualCpvDocument);
}

export async function getAnnualCpvDocumentsByYear(year: number): Promise<AnnualCpvDocument[]> {
  const docs = await listAnnualCpvDocuments();
  return docs.filter((d) => d.reviewYear === year);
}

export async function saveAnnualCpvDraft(
  input: {
    reviewYear: number;
    productName?: string;
    snapshot: AnnualCpvSnapshot;
    conclusion?: string;
    recommendations?: string;
    existingId?: string;
  },
  actor: { id?: string; name?: string; role?: string },
): Promise<AnnualCpvDocument> {
  const actorFull: AnnualReviewActor = { id: actor.id || 'system', name: actor.name || 'System', role: actor.role };
  if (input.existingId) {
    const existing = await fetchCpvReviewById(input.existingId);
    if (existing) {
      const { result } = await updateCpvReview(input.existingId, {
        conclusion: input.conclusion || input.snapshot.conclusion,
        recommendations: input.recommendations || input.snapshot.recommendations,
        executiveSummary: input.snapshot.executiveSummary,
      }, actorFull, existing);
      return toAnnualCpvDocument(result || existing);
    }
  }
  const existing = await fetchCpvReviewRecords();
  const yearCount = existing.filter((r) => r.reviewYear === input.reviewYear).length;
  const { result, error } = await createCpvReview({
    productName: input.productName || 'All Products',
    productCode: '',
    genericName: '',
    strength: '',
    dosageForm: '',
    reviewPeriodFrom: `${input.reviewYear}-01-01`,
    reviewPeriodTo: `${input.reviewYear}-12-31`,
    executiveSummary: input.snapshot.executiveSummary,
    conclusion: input.conclusion || input.snapshot.conclusion,
    recommendations: input.recommendations || input.snapshot.recommendations,
  }, input.snapshot, actorFull, yearCount);
  if (error || !result) throw new Error(error || 'Save failed');
  return toAnnualCpvDocument(result);
}

export async function updateAnnualCpvWorkflow(
  documentId: string,
  status: AnnualCpvWorkflowStatus,
  updates?: Partial<Pick<AnnualCpvDocument, 'conclusion' | 'recommendations' | 'snapshot'>>,
) {
  const statusMap: Partial<Record<AnnualCpvWorkflowStatus, CpvReviewStatus>> = {
    draft: 'Draft',
    under_review: 'Under Review',
    approved: 'Approved',
    archived: 'Archived',
    generated: 'Generated',
    rejected: 'Rejected',
  };
  await updateRecord(CPV_REVIEW_COLLECTION, documentId, {
    reviewStatus: statusMap[status] || 'Draft',
    status,
    ...updates,
  }, { moduleName: CPV_REVIEW_MODULE, actor: { id: 'system', name: 'System' } });
}

export async function signAnnualCpv(
  documentId: string,
  role: AnnualCpvSignature['role'],
  payload: { name: string; signatureText: string; meaning: string; reason: string; userId?: string },
) {
  const existing = await fetchCpvReviewById(documentId);
  if (!existing) throw new Error('Document not found');
  const actor: AnnualReviewActor = { id: payload.userId || 'system', name: payload.name };
  if (role === 'approved') {
    const { error } = await approveCpvReview(documentId, actor, existing, payload);
    if (error) throw new Error(error);
    return;
  }
  const signatures = (existing.signatures || DEFAULT_ANNUAL_CPV_SIGNATURES).map((s) =>
    s.role === role
      ? { ...s, name: payload.name, signatureText: payload.signatureText, meaning: payload.meaning, reason: payload.reason, userId: payload.userId, signedAt: new Date().toISOString() }
      : s,
  );
  await updateRecord(CPV_REVIEW_COLLECTION, documentId, {
    signatures,
    reviewStatus: role === 'reviewed' ? 'Under Review' : existing.reviewStatus,
    reviewedBy: role === 'reviewed' ? payload.name : existing.reviewedBy,
  }, actorCtx(actor));
  await logReviewAudit('review', documentId, actor, existing.reviewStatus, role, existing.cpvReviewNumber);
}

export async function archiveAnnualCpv(documentId: string) {
  const existing = await fetchCpvReviewById(documentId);
  if (!existing) throw new Error('Document not found');
  await archiveCpvReview(documentId, { id: 'system', name: 'System' }, existing);
}

export { generateAnnualCpvNumber, generateCpvReviewNumber };
