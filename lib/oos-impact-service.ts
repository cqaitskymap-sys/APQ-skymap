import {
  collection, doc, addDoc, getDocs, updateDoc, query, limit, orderBy,
} from 'firebase/firestore';
import { createAuditLog } from '@/lib/audit-trail';
import { getFirebaseFirestore, isFirebaseConfigured } from '@/lib/firebase';
import {
  computeOosImpactAutoRules,
  computeRiskLevel,
  computeRiskScore,
  type OosImpactActor,
  type OosImpactFormInput,
} from '@/lib/oos-impact-records';
import {
  OOS_COLLECTIONS,
  type OosImpactAssessment,
  type OosRecord,
} from '@/lib/oos-types';
import {
  getAuditLogsForOos,
  getImpactAssessment,
  getOosById,
  updateOosRecord,
} from '@/lib/oos-service';

export type { OosImpactActor, OosImpactFormInput };

const nowIso = () => new Date().toISOString();
const today = () => new Date().toISOString().split('T')[0];

async function audit(actor: OosImpactActor, actionType: string, oosId: string, detail?: string) {
  try {
    await createAuditLog({
      moduleName: 'OOS Impact Assessment',
      collectionName: OOS_COLLECTIONS.impactAssessments,
      recordId: oosId,
      actionType,
      actionDescription: detail || actionType,
      user: { id: actor.id, name: actor.name, role: actor.role || '' },
      status: 'Success',
    });
  } catch (e) {
    console.error('oos impact audit', e);
  }
}

async function notify(title: string, message: string, oosId: string, roles: string[]) {
  if (!isFirebaseConfigured()) return;
  for (const role of roles) {
    try {
      await addDoc(collection(getFirebaseFirestore(), OOS_COLLECTIONS.notifications), {
        title, message, module: 'OOS', record_id: oosId, target_role: role, read: false, created_at: nowIso(),
      });
    } catch (e) {
      console.error('oos impact notify', e);
    }
  }
}

function buildImpactText(value: string, details?: string): string {
  if (details?.trim()) return `${value}: ${details.trim()}`;
  return value;
}

function mapInputToAssessment(
  oosId: string,
  record: OosRecord,
  input: OosImpactFormInput,
  actor: OosImpactActor,
  status: string,
  existing?: OosImpactAssessment | null,
): Omit<OosImpactAssessment, 'id'> {
  const ts = nowIso();
  const auto = computeOosImpactAutoRules(input, record);
  const riskScore = computeRiskScore(input.severity, input.occurrence, input.detection);
  const riskLevel = computeRiskLevel(riskScore);
  const capaRequired = input.capa_required || auto.capaRequired;
  const recallRequired = input.recall_evaluation_required || auto.recallEvaluationRequired;

  return {
    impact_assessment_id: existing?.impact_assessment_id || existing?.id || `IA-${record.oos_number}`,
    oos_id: oosId,
    oos_number: record.oos_number,
    product: record.product_name,
    batch_number: record.batch_number,
    test_name: record.test_name,
    parameter_name: record.parameter_name,
    assessment_date: input.assessment_date || today(),
    assessed_by: actor.id,
    assessed_by_name: input.assessed_by_name || actor.name,
    product_quality_impact: input.product_quality_impact,
    product_impact: buildImpactText(input.product_quality_impact, input.impact_description),
    batch_impact: input.batch_impact,
    patient_safety_impact: input.patient_safety_impact,
    regulatory_impact: input.regulatory_impact,
    market_impact: input.market_impact,
    stability_impact: input.stability_impact,
    validation_impact: input.validation_impact,
    other_batches_impacted: input.other_batches_impacted,
    impacted_batch_numbers: input.impacted_batch_numbers || '',
    recall_evaluation_required: recallRequired,
    recall_evaluation_reason: input.recall_evaluation_reason || '',
    recall_required: recallRequired,
    capa_required: capaRequired,
    deviation_required: input.deviation_required || auto.deviationRecommended,
    severity: input.severity,
    occurrence: input.occurrence,
    detection: input.detection,
    risk_score: riskScore,
    risk_level: riskLevel,
    impact_description: input.impact_description || '',
    scientific_justification: input.scientific_justification || '',
    conclusion: input.conclusion || '',
    qa_comments: input.qa_comments || existing?.qa_comments || '',
    status,
    assessed_at: existing?.assessed_at || ts,
    created_by: existing?.created_by || actor.id,
    created_by_name: existing?.created_by_name || actor.name,
    updated_by: actor.id,
    updated_by_name: actor.name,
    created_at: existing?.created_at || ts,
    updated_at: ts,
  };
}

async function syncOosFromImpact(oosId: string, assessment: Omit<OosImpactAssessment, 'id'>, actor: OosImpactActor) {
  await updateOosRecord(oosId, {
    capa_required: assessment.capa_required ?? false,
    batch_release_blocked: assessment.batch_impact === 'Yes' || assessment.batch_impact?.toLowerCase().includes('yes'),
  }, { id: actor.id, name: actor.name, role: actor.role || '' }, { workflow: false });
}

export async function listOosImpactAssessments(max = 100): Promise<(OosRecord & { impact?: OosImpactAssessment | null })[]> {
  if (!isFirebaseConfigured()) return [];
  try {
    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), OOS_COLLECTIONS.records),
      orderBy('updated_at', 'desc'),
      limit(max),
    ));
    const records = snap.docs
      .map((d) => ({ id: d.id, ...d.data() } as OosRecord))
      .filter((r) => r.result_status === 'OOS' && r.status !== 'draft');

    return Promise.all(records.map(async (r) => ({
      ...r,
      impact: await getImpactAssessment(r.id),
    })));
  } catch (e) {
    console.error('listOosImpactAssessments', e);
    return [];
  }
}

export async function fetchOosImpactPageData(oosId: string) {
  if (!isFirebaseConfigured()) return { error: 'Firebase is not configured.' };
  try {
    const [record, impact, auditLogs] = await Promise.all([
      getOosById(oosId),
      getImpactAssessment(oosId),
      getAuditLogsForOos(oosId),
    ]);
    if (!record) return { error: 'OOS record not found.' };
    return { record, impact, auditLogs };
  } catch (e) {
    console.error('fetchOosImpactPageData', e);
    return { error: e instanceof Error ? e.message : 'Failed to load impact assessment' };
  }
}

export async function saveOosImpactDraft(
  oosId: string,
  input: OosImpactFormInput,
  actor: OosImpactActor,
): Promise<{ impact?: OosImpactAssessment; error?: string }> {
  const record = await getOosById(oosId);
  if (!record) return { error: 'OOS record not found' };

  const auto = computeOosImpactAutoRules(input, record);
  const payload = mapInputToAssessment(oosId, record, {
    ...input,
    capa_required: input.capa_required || auto.capaRequired,
    recall_evaluation_required: input.recall_evaluation_required || auto.recallEvaluationRequired,
    deviation_required: input.deviation_required || auto.deviationRecommended,
  }, actor, existingStatus(await getImpactAssessment(oosId)));

  try {
    const existing = await getImpactAssessment(oosId);
    let result: OosImpactAssessment;
    if (existing?.id) {
      await updateDoc(doc(getFirebaseFirestore(), OOS_COLLECTIONS.impactAssessments, existing.id), payload);
      result = { ...existing, ...payload, id: existing.id };
      await audit(actor, 'Impact Assessment Updated', oosId, `Risk ${payload.risk_score}/${payload.risk_level}`);
    } else {
      const ref = await addDoc(collection(getFirebaseFirestore(), OOS_COLLECTIONS.impactAssessments), payload);
      result = { id: ref.id, ...payload };
      await audit(actor, 'Impact Assessment Created', oosId, record.oos_number);
    }
    await audit(actor, 'Risk Calculation Updated', oosId, `Score ${payload.risk_score} (${payload.risk_level})`);
    await syncOosFromImpact(oosId, payload, actor);
    return { impact: result };
  } catch (e) {
    console.error('saveOosImpactDraft', e);
    return { error: e instanceof Error ? e.message : 'Failed to save draft' };
  }
}

function existingStatus(existing: OosImpactAssessment | null): string {
  if (!existing) return 'In Progress';
  if (['Approved', 'Submitted', 'QA Review'].includes(existing.status || '')) return existing.status || 'In Progress';
  return 'In Progress';
}

export async function submitOosImpactAssessment(
  oosId: string,
  input: OosImpactFormInput,
  actor: OosImpactActor,
): Promise<{ impact?: OosImpactAssessment; error?: string }> {
  if (!input.assessment_date) return { error: 'Assessment date is required.' };
  if (!input.assessed_by_name?.trim()) return { error: 'Assessed by is required.' };
  if (!input.conclusion?.trim() || input.conclusion.trim().length < 10) {
    return { error: 'Impact conclusion is required.' };
  }
  if (!input.scientific_justification?.trim() || input.scientific_justification.trim().length < 10) {
    return { error: 'Scientific justification is required.' };
  }

  const auto = computeOosImpactAutoRules(input, await getOosById(oosId));
  if (input.other_batches_impacted === 'Yes' && !input.impacted_batch_numbers?.trim()) {
    return { error: 'Impacted batch numbers are required when other batches are impacted.' };
  }
  if (impactYes(input.market_impact) && !input.recall_evaluation_reason?.trim()) {
    return { error: 'Recall evaluation reason is required when market impact is Yes.' };
  }
  if (auto.capaRequired) input.capa_required = true;
  if (auto.recallEvaluationRequired) input.recall_evaluation_required = true;

  const draft = await saveOosImpactDraft(oosId, input, actor);
  if (draft.error || !draft.impact) return draft;

  const record = await getOosById(oosId);
  if (!record) return { error: 'OOS record not found' };

  try {
    const ts = nowIso();
    const payload = {
      status: 'QA Review',
      updated_at: ts,
      updated_by: actor.id,
      updated_by_name: actor.name,
    };
    await updateDoc(doc(getFirebaseFirestore(), OOS_COLLECTIONS.impactAssessments, draft.impact.id), payload);
    await syncOosFromImpact(oosId, { ...draft.impact, ...payload }, actor);
    await audit(actor, 'Impact Assessment Submitted', oosId, input.conclusion?.slice(0, 120));
    await notify('OOS Impact Assessment Submitted', `${record.oos_number} impact assessment submitted for QA review`, oosId, ['qa_manager', 'qa']);

    if (auto.notifyHeadQa) {
      await notify('Patient Safety Impact — OOS', `Patient safety impact identified on ${record.oos_number}`, oosId, ['head_qa']);
      await audit(actor, 'Head QA Notified — Patient Safety', oosId, record.oos_number);
    }
    if (auto.recallEvaluationRequired) {
      await audit(actor, 'Recall Evaluation Recommended', oosId, input.recall_evaluation_reason || 'Market impact Yes');
    }

    return { impact: { ...draft.impact, ...payload } };
  } catch (e) {
    console.error('submitOosImpactAssessment', e);
    return { error: e instanceof Error ? e.message : 'Failed to submit impact assessment' };
  }
}

function impactYes(value?: string): boolean {
  return value === 'Yes';
}

export async function reviewOosImpactAssessment(
  oosId: string,
  decision: 'approved' | 'rejected',
  qaComments: string,
  actor: OosImpactActor,
): Promise<{ impact?: OosImpactAssessment; error?: string }> {
  if (decision === 'rejected' && !qaComments.trim()) return { error: 'QA comments required for rejection.' };

  const impact = await getImpactAssessment(oosId);
  const record = await getOosById(oosId);
  if (!impact || !record) return { error: 'Impact assessment not found.' };
  if (impact.status !== 'QA Review') return { error: 'Impact assessment must be in QA Review before approval or rejection.' };

  if (impact.risk_level === 'Critical' && decision === 'approved') {
    const { canApproveCriticalOosImpact } = await import('@/lib/oos-impact-records');
    if (!canApproveCriticalOosImpact(actor.role, impact.risk_level)) {
      return { error: 'Critical impact assessments require Head QA approval.' };
    }
  }

  const ts = nowIso();
  const status = decision === 'approved' ? 'Approved' : 'Rejected';

  try {
    await updateDoc(doc(getFirebaseFirestore(), OOS_COLLECTIONS.impactAssessments, impact.id), {
      status,
      qa_decision: decision,
      qa_comments: qaComments,
      qa_reviewer_id: actor.id,
      qa_reviewer_name: actor.name,
      qa_reviewed_at: ts,
      updated_at: ts,
      updated_by: actor.id,
      updated_by_name: actor.name,
    });

    const updated: OosImpactAssessment = {
      ...impact,
      status,
      qa_decision: decision,
      qa_comments: qaComments,
      qa_reviewer_id: actor.id,
      qa_reviewer_name: actor.name,
      qa_reviewed_at: ts,
      updated_at: ts,
    };

    if (decision === 'approved') {
      await syncOosFromImpact(oosId, updated, actor);
      if (updated.capa_required) {
        await notify('CAPA Required from Impact Assessment', `${record.oos_number} — CAPA mandatory based on impact`, oosId, ['qa_manager', 'head_qa']);
      }
    }

    await audit(actor, decision === 'approved' ? 'Impact Assessment Approved' : 'Impact Assessment Rejected', oosId, qaComments);
    return { impact: updated };
  } catch (e) {
    console.error('reviewOosImpactAssessment', e);
    return { error: e instanceof Error ? e.message : 'Failed to review impact assessment' };
  }
}

export function mapOosImpactToFormInput(
  impact: OosImpactAssessment | null,
  record: OosRecord,
  actorName: string,
): OosImpactFormInput {
  return {
    assessment_date: impact?.assessment_date || today(),
    assessed_by_name: impact?.assessed_by_name || actorName,
    product_quality_impact: impact?.product_quality_impact || normalizeLegacyImpact(impact?.product_impact),
    batch_impact: normalizeLegacyImpact(impact?.batch_impact) || 'No',
    patient_safety_impact: normalizeLegacyImpact(impact?.patient_safety_impact) || 'No',
    regulatory_impact: normalizeLegacyImpact(impact?.regulatory_impact) || 'No',
    market_impact: normalizeLegacyImpact(impact?.market_impact) || 'Not Applicable',
    stability_impact: impact?.stability_impact || 'Not Applicable',
    validation_impact: impact?.validation_impact || 'Not Applicable',
    other_batches_impacted: impact?.other_batches_impacted === 'Yes' ? 'Yes' : 'No',
    impacted_batch_numbers: impact?.impacted_batch_numbers || '',
    impact_description: impact?.impact_description || impact?.product_impact || '',
    scientific_justification: impact?.scientific_justification || '',
    severity: impact?.severity ?? 3,
    occurrence: impact?.occurrence ?? 3,
    detection: impact?.detection ?? 3,
    capa_required: impact?.capa_required ?? false,
    deviation_required: impact?.deviation_required ?? false,
    recall_evaluation_required: impact?.recall_evaluation_required ?? impact?.recall_required ?? false,
    recall_evaluation_reason: impact?.recall_evaluation_reason || '',
    conclusion: impact?.conclusion || '',
    qa_comments: impact?.qa_comments || '',
  };
}

function normalizeLegacyImpact(value?: string): string {
  if (!value?.trim()) return 'No';
  const v = value.trim();
  if (['Yes', 'No', 'Under Evaluation', 'Not Applicable'].includes(v)) return v;
  if (/yes|impact|significant|fail/i.test(v)) return 'Yes';
  if (/under evaluation|pending/i.test(v)) return 'Under Evaluation';
  if (/not applicable|n\/a/i.test(v)) return 'Not Applicable';
  return 'No';
}

export async function logOosImpactPageViewed(oosId: string, actor: OosImpactActor, oosNumber?: string) {
  await audit(actor, 'Impact Assessment page viewed', oosId, oosNumber);
}
