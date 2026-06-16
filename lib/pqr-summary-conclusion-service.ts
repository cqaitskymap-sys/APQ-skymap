import {
  collection, doc, addDoc, getDocs, updateDoc, query, where, limit, orderBy,
} from 'firebase/firestore';
import { getFirebaseFirestore, isFirebaseConfigured } from '@/lib/firebase';
import { createAuditLog, writeAuditTrail } from '@/lib/audit-trail';
import type { PqrOption } from '@/lib/pqr-batch-review-records';
import { fetchPqrOptions } from '@/lib/pqr-batch-review-service';
import { fetchBatchReviewRecords } from '@/lib/pqr-batch-review-service';
import { fetchMaterialReviewRecords } from '@/lib/pqr-material-review-service';
import { fetchPackagingReviewRecords } from '@/lib/pqr-packaging-review-service';
import { fetchEquipmentReviewRecords } from '@/lib/pqr-equipment-review-service';
import { fetchUtilityEnvReviewRecords } from '@/lib/pqr-utility-environmental-review-service';
import { fetchStabilityReviewRecords } from '@/lib/pqr-stability-review-service';
import {
  PQR_SUMMARY_CONCLUSION_COLLECTIONS,
  PQR_SUMMARY_CONCLUSION_MODULE,
  buildSummaryCharts,
  buildSummaryMetrics,
  determineOverallStatuses,
  generateRecommendations,
  generateSectionNarratives,
  type ConsolidatedReviewData,
  type PqrSummaryConclusionRecord,
  type SummaryApprovalFormData,
} from '@/lib/pqr-summary-conclusion-records';

export type PqrSummaryConclusionActor = { id: string; name: string; role?: string };

export { fetchPqrOptions };

const nowIso = () => new Date().toISOString();
const str = (v: unknown, fb = '') => (v === null || v === undefined ? fb : String(v));

function buildSummaryId(pqrNumber: string) {
  return `PSUM-${pqrNumber.replace(/\s+/g, '-')}-${Date.now().toString(36).toUpperCase()}`;
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

function inPeriod(dateStr: string, from: string, to: string): boolean {
  const d = dateStr.slice(0, 10);
  if (!from || !to || !d) return true;
  return d >= from && d <= to;
}

function matchesProduct(raw: Record<string, unknown>, pqr: PqrOption): boolean {
  const code = str(raw.productCode || raw.product_code).toLowerCase();
  const name = str(raw.productName || raw.product_name || raw.product).toLowerCase();
  if (code && pqr.productCode && code === pqr.productCode.toLowerCase()) return true;
  if (name && pqr.productName && name === pqr.productName.toLowerCase()) return true;
  if (name && pqr.productName && pqr.productName.toLowerCase().includes(name)) return true;
  if (name && pqr.productName && name.includes(pqr.productName.toLowerCase())) return true;
  return !code && !name;
}

function filterByPqr(
  rows: Record<string, unknown>[],
  pqr: PqrOption,
): Record<string, unknown>[] {
  const from = pqr.reviewPeriodFrom?.slice(0, 10) || '';
  const to = pqr.reviewPeriodTo?.slice(0, 10) || '';
  return rows.filter((r) => {
    if (r.isDeleted) return false;
    const date = str(r.createdAt || r.created_at || r.reportedDate || r.date || r.reviewDate);
    if (!inPeriod(date, from, to)) return false;
    return matchesProduct(r, pqr);
  });
}

async function logSummaryAudit(
  actionType: string,
  actor: PqrSummaryConclusionActor,
  detail?: unknown,
  recordId = 'summary-conclusion',
) {
  try {
    await createAuditLog({
      moduleName: PQR_SUMMARY_CONCLUSION_MODULE,
      collectionName: PQR_SUMMARY_CONCLUSION_COLLECTIONS.summary,
      recordId,
      actionType,
      newValue: detail,
      user: { id: actor.id, name: actor.name },
      status: 'Success',
    });
    await writeAuditTrail({
      collectionName: PQR_SUMMARY_CONCLUSION_COLLECTIONS.summary,
      documentId: recordId,
      action: actionType,
      oldValue: null,
      newValue: detail,
      userId: actor.id,
      userName: actor.name,
      moduleName: PQR_SUMMARY_CONCLUSION_MODULE,
    });
  } catch (e) {
    console.error('logSummaryAudit failed', e);
  }
}

export async function consolidatePqrReviewData(pqr: PqrOption): Promise<ConsolidatedReviewData> {
  const [
    batches, materials, packaging, equipment, utilityEnv, stability,
    deviationsRaw, oosRaw, capaRaw, ccRaw, risksRaw, cpvRaw, capRaw, trendRaw, recallRaw,
  ] = await Promise.all([
    fetchBatchReviewRecords(pqr.id),
    fetchMaterialReviewRecords(pqr.id),
    fetchPackagingReviewRecords(pqr.id),
    fetchEquipmentReviewRecords(pqr.id),
    fetchUtilityEnvReviewRecords(pqr.id),
    fetchStabilityReviewRecords(pqr.id),
    readFirst([PQR_SUMMARY_CONCLUSION_COLLECTIONS.deviations, 'deviation']),
    readFirst([PQR_SUMMARY_CONCLUSION_COLLECTIONS.oosRecords, 'oos']),
    readFirst([PQR_SUMMARY_CONCLUSION_COLLECTIONS.capaRecords, 'capa']),
    readFirst([PQR_SUMMARY_CONCLUSION_COLLECTIONS.changeControls, 'change_control']),
    readFirst([PQR_SUMMARY_CONCLUSION_COLLECTIONS.riskAssessment, 'risk_assessment']),
    readFirst([PQR_SUMMARY_CONCLUSION_COLLECTIONS.cpvReviews, 'cpv_annual_review']),
    readFirst([PQR_SUMMARY_CONCLUSION_COLLECTIONS.processCapability, 'cpv_capability']),
    readFirst([PQR_SUMMARY_CONCLUSION_COLLECTIONS.trendAnalysis, 'cpv_trends']),
    readFirst([PQR_SUMMARY_CONCLUSION_COLLECTIONS.recalls, 'recall_records']),
  ]);

  return {
    batches,
    materials,
    packaging,
    equipment,
    utilityEnv,
    stability,
    deviations: filterByPqr(deviationsRaw, pqr),
    oos: filterByPqr(oosRaw, pqr),
    capa: filterByPqr(capaRaw, pqr),
    changeControls: filterByPqr(ccRaw, pqr),
    risks: filterByPqr(risksRaw, pqr),
    cpvReviews: filterByPqr(cpvRaw, pqr),
    capability: filterByPqr(capRaw, pqr),
    trends: filterByPqr(trendRaw, pqr),
    recalls: filterByPqr(recallRaw, pqr),
  };
}

export async function fetchSummaryConclusionRecord(pqrId: string): Promise<PqrSummaryConclusionRecord | null> {
  if (!isFirebaseConfigured()) return null;
  try {
    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), PQR_SUMMARY_CONCLUSION_COLLECTIONS.summary),
      where('pqrId', '==', pqrId),
      where('isDeleted', '==', false),
    ));
    if (snap.empty) return null;
    const docSnap = snap.docs.sort((a, b) =>
      str(b.data().updatedAt).localeCompare(str(a.data().updatedAt)),
    )[0];
    return { id: docSnap.id, ...docSnap.data() } as PqrSummaryConclusionRecord;
  } catch {
    try {
      const snap = await getDocs(query(
        collection(getFirebaseFirestore(), PQR_SUMMARY_CONCLUSION_COLLECTIONS.summary),
        where('pqrId', '==', pqrId),
      ));
      const active = snap.docs.filter((d) => !d.data().isDeleted);
      if (!active.length) return null;
      const docSnap = active.sort((a, b) =>
        str(b.data().updatedAt).localeCompare(str(a.data().updatedAt)),
      )[0];
      return { id: docSnap.id, ...docSnap.data() } as PqrSummaryConclusionRecord;
    } catch (e) {
      console.error('fetchSummaryConclusionRecord failed', e);
      return null;
    }
  }
}

export async function generateSummaryConclusion(
  pqr: PqrOption,
  actor: PqrSummaryConclusionActor,
): Promise<{ record?: PqrSummaryConclusionRecord; error?: string }> {
  if (!isFirebaseConfigured()) return { error: 'Firebase is not configured.' };

  try {
    await logSummaryAudit('summary generated', actor, { pqrId: pqr.id }, pqr.id);

    const data = await consolidatePqrReviewData(pqr);
    const metrics = buildSummaryMetrics(data);
    await logSummaryAudit('quality score calculated', actor, { score: metrics.qualityScore }, pqr.id);

    const statuses = determineOverallStatuses(metrics);
    const recommendations = generateRecommendations(metrics, data);
    await logSummaryAudit('recommendation generated', actor, { count: recommendations.split('\n').length }, pqr.id);
    await logSummaryAudit('conclusion generated', actor, statuses, pqr.id);

    const narratives = generateSectionNarratives(metrics, data);
    const ts = nowIso();
    const reviewYear = pqr.reviewPeriodTo?.slice(0, 4) || new Date().getFullYear().toString();
    const existing = await fetchSummaryConclusionRecord(pqr.id);

    const payload: Omit<PqrSummaryConclusionRecord, 'id'> = {
      summaryId: existing?.summaryId || buildSummaryId(pqr.pqrNumber),
      pqrId: pqr.id,
      pqrNumber: pqr.pqrNumber,
      product: pqr.productName,
      productCode: pqr.productCode,
      reviewYear,
      reviewPeriodFrom: pqr.reviewPeriodFrom?.slice(0, 10) || '',
      reviewPeriodTo: pqr.reviewPeriodTo?.slice(0, 10) || '',
      ...narratives,
      overallQualityStatus: statuses.overallQualityStatus,
      overallProcessStatus: statuses.overallProcessStatus,
      overallRiskLevel: statuses.overallRiskLevel,
      finalConclusion: statuses.finalConclusion,
      recommendations,
      preparedBy: existing?.preparedBy || actor.name,
      reviewedBy: existing?.reviewedBy || '',
      approvedBy: existing?.approvedBy || '',
      approvalDate: existing?.approvalDate || '',
      reviewerComments: existing?.reviewerComments || '',
      qaComments: existing?.qaComments || '',
      headQaComments: existing?.headQaComments || '',
      finalApprovalComments: existing?.finalApprovalComments || '',
      eSignatureApplied: existing?.eSignatureApplied || false,
      eSignatureMeaning: existing?.eSignatureMeaning || '',
      metrics,
      status: existing?.status === 'Approved' ? 'Approved' : 'Generated',
      createdAt: existing?.createdAt || ts,
      updatedAt: ts,
      createdBy: existing?.createdBy || actor.id,
      updatedBy: actor.id,
      createdByName: existing?.createdByName || actor.name,
      updatedByName: actor.name,
      isDeleted: false,
    };

    if (existing?.id) {
      await updateDoc(doc(getFirebaseFirestore(), PQR_SUMMARY_CONCLUSION_COLLECTIONS.summary, existing.id), payload);
      await saveSummarySectionToPqr(pqr.id, payload, actor);
      return { record: { id: existing.id, ...payload } };
    }

    const docRef = await addDoc(collection(getFirebaseFirestore(), PQR_SUMMARY_CONCLUSION_COLLECTIONS.summary), payload);
    await saveSummarySectionToPqr(pqr.id, payload, actor);
    return { record: { id: docRef.id, ...payload } };
  } catch (e) {
    console.error('generateSummaryConclusion failed', e);
    return { error: (e as Error).message };
  }
}

export async function updateSummaryConclusionFields(
  id: string,
  fields: Partial<PqrSummaryConclusionRecord>,
  actor: PqrSummaryConclusionActor,
): Promise<{ error?: string }> {
  if (!isFirebaseConfigured()) return { error: 'Firebase is not configured.' };
  try {
    await updateDoc(doc(getFirebaseFirestore(), PQR_SUMMARY_CONCLUSION_COLLECTIONS.summary, id), {
      ...fields,
      updatedAt: nowIso(),
      updatedBy: actor.id,
      updatedByName: actor.name,
    });
    await logSummaryAudit('summary updated', actor, { id }, id);
    return {};
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function submitSummaryForReview(
  id: string,
  data: SummaryApprovalFormData,
  actor: PqrSummaryConclusionActor,
): Promise<{ error?: string }> {
  if (!isFirebaseConfigured()) return { error: 'Firebase is not configured.' };
  try {
    await updateDoc(doc(getFirebaseFirestore(), PQR_SUMMARY_CONCLUSION_COLLECTIONS.summary, id), {
      ...data,
      status: 'Under Review',
      preparedBy: actor.name,
      updatedAt: nowIso(),
      updatedBy: actor.id,
    });
    await logSummaryAudit('review submitted', actor, { id }, id);
    return {};
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function approveSummaryConclusion(
  id: string,
  data: SummaryApprovalFormData,
  actor: PqrSummaryConclusionActor,
  eSignature?: { meaning: string },
): Promise<{ error?: string }> {
  if (!isFirebaseConfigured()) return { error: 'Firebase is not configured.' };
  try {
    const ts = nowIso();
    await updateDoc(doc(getFirebaseFirestore(), PQR_SUMMARY_CONCLUSION_COLLECTIONS.summary, id), {
      ...data,
      status: 'Approved',
      approvalDate: ts.slice(0, 10),
      eSignatureApplied: Boolean(eSignature),
      eSignatureMeaning: eSignature?.meaning || 'Approved By',
      updatedAt: ts,
      updatedBy: actor.id,
    });
    await logSummaryAudit('approved', actor, { id }, id);
    if (eSignature) await logSummaryAudit('e-signature applied', actor, eSignature, id);
    return {};
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function rejectSummaryConclusion(
  id: string,
  comments: string,
  actor: PqrSummaryConclusionActor,
): Promise<{ error?: string }> {
  if (!isFirebaseConfigured()) return { error: 'Firebase is not configured.' };
  try {
    await updateDoc(doc(getFirebaseFirestore(), PQR_SUMMARY_CONCLUSION_COLLECTIONS.summary, id), {
      status: 'Rejected',
      finalApprovalComments: comments,
      updatedAt: nowIso(),
      updatedBy: actor.id,
    });
    await logSummaryAudit('rejected', actor, { id, comments }, id);
    return {};
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function archiveSummaryConclusion(
  id: string,
  actor: PqrSummaryConclusionActor,
): Promise<{ error?: string }> {
  if (!isFirebaseConfigured()) return { error: 'Firebase is not configured.' };
  try {
    await updateDoc(doc(getFirebaseFirestore(), PQR_SUMMARY_CONCLUSION_COLLECTIONS.summary, id), {
      status: 'Archived',
      updatedAt: nowIso(),
      updatedBy: actor.id,
    });
    await logSummaryAudit('archived', actor, { id }, id);
    return {};
  } catch (e) {
    return { error: (e as Error).message };
  }
}

async function saveSummarySectionToPqr(
  pqrId: string,
  record: Omit<PqrSummaryConclusionRecord, 'id'>,
  actor: PqrSummaryConclusionActor,
): Promise<void> {
  try {
    const ts = nowIso();
    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), PQR_SUMMARY_CONCLUSION_COLLECTIONS.sections),
      where('pqrId', '==', pqrId),
      where('sectionKey', '==', 'summary_conclusion'),
    ));
    const payload = {
      pqrId,
      sectionKey: 'summary_conclusion',
      sectionType: 'Summary & Conclusion',
      sectionOrder: 30,
      sectionTitle: 'Summary & Conclusion',
      narrative: record.finalConclusion,
      dataSummary: JSON.stringify(record.metrics),
      included: true,
      status: record.status,
      updatedAt: ts,
      updatedBy: actor.id,
    };
    if (snap.empty) {
      await addDoc(collection(getFirebaseFirestore(), PQR_SUMMARY_CONCLUSION_COLLECTIONS.sections), {
        ...payload, createdAt: ts, createdBy: actor.id, isDeleted: false,
      });
    } else {
      await updateDoc(snap.docs[0].ref, payload);
    }
  } catch (e) {
    console.error('saveSummarySectionToPqr failed', e);
  }
}

export {
  buildSummaryCharts,
  buildSummaryMetrics,
  determineOverallStatuses,
  generateRecommendations,
} from '@/lib/pqr-summary-conclusion-records';

export async function logSummaryConclusionView(actor: PqrSummaryConclusionActor) {
  await logSummaryAudit('summary conclusion viewed', actor);
}

export async function logSummaryExportPdf(actor: PqrSummaryConclusionActor) {
  await logSummaryAudit('export PDF', actor);
}

export async function logSummaryExportExcel(actor: PqrSummaryConclusionActor) {
  await logSummaryAudit('export Excel', actor);
}

export async function logSummaryNarrativeEdit(actor: PqrSummaryConclusionActor, pqrId: string) {
  await logSummaryAudit('narrative edited', actor, { pqrId }, pqrId);
}
