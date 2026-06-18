import {
  addDoc, collection, doc, getDocs, limit, query, updateDoc, where,
} from 'firebase/firestore';
import { createAuditLog } from '@/lib/audit-trail';
import { getFirebaseFirestore, isFirebaseConfigured } from '@/lib/firebase';
import {
  buildComplaintImpactSummary,
  COMPLAINT_IMPACT_MODULE,
  computeComplaintImpactAutoRules,
  computeRiskLevel,
  computeRiskScore,
  type ComplaintImpactActor,
  type ComplaintImpactFormInput,
} from '@/lib/complaint-impact-records';
import {
  COMPLAINT_COLLECTIONS,
  type ComplaintImpactAssessment,
  type ComplaintRecord,
} from '@/lib/complaint-types';
import {
  getAuditLogsForComplaint,
  getComplaintById,
  listComplaints,
  updateComplaint,
} from '@/lib/complaint-service';

export type { ComplaintImpactActor, ComplaintImpactFormInput };

const nowIso = () => new Date().toISOString();
const today = () => new Date().toISOString().split('T')[0];

async function audit(actor: ComplaintImpactActor, actionType: string, complaintId: string, detail?: string) {
  try {
    await createAuditLog({
      moduleName: COMPLAINT_IMPACT_MODULE,
      collectionName: COMPLAINT_COLLECTIONS.impactAssessments,
      recordId: complaintId,
      actionType,
      actionDescription: detail || actionType,
      user: { id: actor.id, name: actor.name, role: actor.role || '', department: actor.department },
      status: 'Success',
    });
  } catch (e) {
    console.error('complaint impact audit', e);
  }
}

async function notify(title: string, message: string, complaintId: string, roles: string[]) {
  if (!isFirebaseConfigured()) return;
  for (const role of roles) {
    try {
      await addDoc(collection(getFirebaseFirestore(), COMPLAINT_COLLECTIONS.notifications), {
        title, message, module: 'Complaint', record_id: complaintId, target_role: role, read: false, created_at: nowIso(),
      });
    } catch (e) {
      console.error('complaint impact notify', e);
    }
  }
}

function mapInputToAssessment(
  complaintId: string,
  record: ComplaintRecord,
  input: ComplaintImpactFormInput,
  actor: ComplaintImpactActor,
  status: string,
  existing?: ComplaintImpactAssessment | null,
): Omit<ComplaintImpactAssessment, 'id'> {
  const ts = nowIso();
  const auto = computeComplaintImpactAutoRules(input, record);
  const riskScore = computeRiskScore(input.severity, input.occurrence, input.detection);
  const riskLevel = computeRiskLevel(riskScore);
  const capaRequired = input.capa_required || auto.capaRequired;
  const recallRequired = input.recall_evaluation_required || auto.recallEvaluationRequired;

  return {
    impact_assessment_id: existing?.impact_assessment_id || existing?.id || `CIA-${record.complaint_number}`,
    complaint_id: complaintId,
    complaint_number: record.complaint_number,
    assessment_date: input.assessment_date || today(),
    assessed_by: actor.id,
    assessed_by_name: input.assessed_by_name || actor.name,
    product_name: record.product_name,
    batch_number: record.batch_number,
    complaint_category: String(record.complaint_category),
    product_quality_impact: input.product_quality_impact,
    patient_safety_impact: input.patient_safety_impact,
    regulatory_impact: input.regulatory_impact,
    market_impact: input.market_impact,
    batch_impact: input.batch_impact,
    other_batches_impacted: input.other_batches_impacted,
    impacted_batch_numbers: input.impacted_batch_numbers || '',
    distribution_impact: input.distribution_impact,
    distribution_notes: input.distribution_notes || '',
    recall_evaluation_required: recallRequired,
    recall_evaluation_reason: input.recall_evaluation_reason || '',
    capa_required: capaRequired,
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

async function syncComplaintFromImpact(
  complaintId: string,
  assessment: Omit<ComplaintImpactAssessment, 'id'>,
  actor: ComplaintImpactActor,
) {
  const summary = buildComplaintImpactSummary(assessment);
  const patch: Partial<ComplaintRecord> = {
    impact_assessment: summary || assessment.conclusion || assessment.impact_description,
    product_quality_impact: assessment.product_quality_impact === 'Yes',
    product_safety_impact: assessment.patient_safety_impact === 'Yes',
    regulatory_impact: assessment.regulatory_impact === 'Yes',
    market_impact: assessment.market_impact === 'Yes',
    capa_required: assessment.capa_required ?? false,
    recall_evaluation_required: assessment.recall_evaluation_required ?? false,
    recall_required: assessment.recall_evaluation_required ?? false,
    risk_level: assessment.risk_level,
    head_qa_approval_required: assessment.risk_level === 'Critical',
  };
  if (assessment.status === 'Approved') {
    if (assessment.recall_evaluation_required) patch.status = 'recall_evaluation';
    else if (assessment.capa_required) patch.status = 'capa_required';
  }
  await updateComplaint(complaintId, patch, { id: actor.id, name: actor.name, role: actor.role || '' }, true);
}

export async function getComplaintImpactAssessment(complaintId: string): Promise<ComplaintImpactAssessment | null> {
  if (!isFirebaseConfigured()) return null;
  try {
    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), COMPLAINT_COLLECTIONS.impactAssessments),
      where('complaint_id', '==', complaintId),
      limit(1),
    ));
    if (snap.empty) return null;
    return { id: snap.docs[0].id, ...snap.docs[0].data() } as ComplaintImpactAssessment;
  } catch (e) {
    console.error('getComplaintImpactAssessment', e);
    return null;
  }
}

export async function listComplaintImpactAssessments(max = 100): Promise<(ComplaintRecord & { impact?: ComplaintImpactAssessment | null })[]> {
  if (!isFirebaseConfigured()) return [];
  try {
    const records = (await listComplaints())
      .filter((r) => r.status !== 'draft' && r.status !== 'rejected');
    const withImpact = await Promise.all(records.slice(0, max).map(async (r) => ({
      ...r,
      impact: await getComplaintImpactAssessment(r.id),
    })));
    return withImpact;
  } catch (e) {
    console.error('listComplaintImpactAssessments', e);
    return [];
  }
}

export async function fetchComplaintImpactPageData(complaintId: string) {
  if (!isFirebaseConfigured()) return { error: 'Firebase is not configured.' };
  try {
    const [record, impact, auditLogs] = await Promise.all([
      getComplaintById(complaintId),
      getComplaintImpactAssessment(complaintId),
      getAuditLogsForComplaint(complaintId),
    ]);
    if (!record) return { error: 'Complaint not found.' };
    return { record, impact, auditLogs };
  } catch (e) {
    console.error('fetchComplaintImpactPageData', e);
    return { error: e instanceof Error ? e.message : 'Failed to load impact assessment' };
  }
}

function existingStatus(existing: ComplaintImpactAssessment | null): string {
  if (!existing) return 'In Progress';
  if (['Approved', 'Submitted', 'QA Review'].includes(existing.status || '')) return existing.status || 'In Progress';
  return 'In Progress';
}

export async function saveComplaintImpactDraft(
  complaintId: string,
  input: ComplaintImpactFormInput,
  actor: ComplaintImpactActor,
): Promise<{ impact?: ComplaintImpactAssessment; error?: string }> {
  const record = await getComplaintById(complaintId);
  if (!record) return { error: 'Complaint not found' };

  const auto = computeComplaintImpactAutoRules(input, record);
  const payload = mapInputToAssessment(complaintId, record, {
    ...input,
    capa_required: input.capa_required || auto.capaRequired,
    recall_evaluation_required: input.recall_evaluation_required || auto.recallEvaluationRequired,
  }, actor, existingStatus(await getComplaintImpactAssessment(complaintId)));

  try {
    const existing = await getComplaintImpactAssessment(complaintId);
    let result: ComplaintImpactAssessment;
    if (existing?.id) {
      await updateDoc(doc(getFirebaseFirestore(), COMPLAINT_COLLECTIONS.impactAssessments, existing.id), payload);
      result = { ...existing, ...payload, id: existing.id };
      await audit(actor, 'Impact Assessment Updated', complaintId, `Risk ${payload.risk_score}/${payload.risk_level}`);
    } else {
      const ref = await addDoc(collection(getFirebaseFirestore(), COMPLAINT_COLLECTIONS.impactAssessments), payload);
      result = { id: ref.id, ...payload };
      await audit(actor, 'Impact Assessment Created', complaintId, record.complaint_number);
    }
    await audit(actor, 'Risk Calculation Updated', complaintId, `Score ${payload.risk_score} (${payload.risk_level})`);
    await syncComplaintFromImpact(complaintId, payload, actor);
    return { impact: result };
  } catch (e) {
    console.error('saveComplaintImpactDraft', e);
    return { error: e instanceof Error ? e.message : 'Failed to save draft' };
  }
}

function impactYes(value?: string): boolean {
  return value === 'Yes';
}

export async function submitComplaintImpactAssessment(
  complaintId: string,
  input: ComplaintImpactFormInput,
  actor: ComplaintImpactActor,
): Promise<{ impact?: ComplaintImpactAssessment; error?: string }> {
  if (!complaintId) return { error: 'Complaint ID is required.' };
  if (!input.assessment_date) return { error: 'Assessment date is required.' };
  if (!input.assessed_by_name?.trim()) return { error: 'Assessed by is required.' };
  if (!input.conclusion?.trim() || input.conclusion.trim().length < 10) {
    return { error: 'Impact conclusion is required.' };
  }
  if (!input.scientific_justification?.trim() || input.scientific_justification.trim().length < 10) {
    return { error: 'Scientific justification is required.' };
  }

  const record = await getComplaintById(complaintId);
  if (!record) return { error: 'Complaint not found' };

  const auto = computeComplaintImpactAutoRules(input, record);
  if (input.other_batches_impacted === 'Yes' && !input.impacted_batch_numbers?.trim()) {
    return { error: 'Impacted batch numbers are required when other batches are impacted.' };
  }
  if (impactYes(input.market_impact) && !input.recall_evaluation_reason?.trim()) {
    return { error: 'Recall evaluation reason is required when market impact is Yes.' };
  }
  if (auto.capaRequired) input.capa_required = true;
  if (auto.recallEvaluationRequired) input.recall_evaluation_required = true;

  const draft = await saveComplaintImpactDraft(complaintId, input, actor);
  if (draft.error || !draft.impact) return draft;

  try {
    const ts = nowIso();
    const payload = {
      status: 'QA Review',
      updated_at: ts,
      updated_by: actor.id,
      updated_by_name: actor.name,
    };
    await updateDoc(doc(getFirebaseFirestore(), COMPLAINT_COLLECTIONS.impactAssessments, draft.impact.id), payload);
    await syncComplaintFromImpact(complaintId, { ...draft.impact, ...payload }, actor);
    await audit(actor, 'Impact Assessment Submitted', complaintId, input.conclusion?.slice(0, 120));
    await notify('Complaint Impact Assessment Submitted', `${record.complaint_number} impact assessment submitted for QA review`, complaintId, ['qa_manager', 'qa']);

    if (auto.notifyHeadQa) {
      await notify('Patient Safety Impact — Complaint', `Patient safety impact identified on ${record.complaint_number}`, complaintId, ['head_qa']);
      await audit(actor, 'Head QA Notified — Patient Safety', complaintId, record.complaint_number);
    }
    if (auto.notifyRegulatory) {
      await notify('Regulatory Impact — Complaint', `Regulatory impact identified on ${record.complaint_number}`, complaintId, ['regulatory_affairs']);
      await audit(actor, 'Regulatory Affairs Notified', complaintId, record.complaint_number);
    }
    if (auto.recallEvaluationRequired) {
      await audit(actor, 'Recall Evaluation Recommended', complaintId, input.recall_evaluation_reason || 'Market impact Yes');
    }

    return { impact: { ...draft.impact, ...payload } };
  } catch (e) {
    console.error('submitComplaintImpactAssessment', e);
    return { error: e instanceof Error ? e.message : 'Failed to submit impact assessment' };
  }
}

export async function reviewComplaintImpactAssessment(
  complaintId: string,
  decision: 'approved' | 'rejected',
  qaComments: string,
  actor: ComplaintImpactActor,
): Promise<{ impact?: ComplaintImpactAssessment; error?: string }> {
  if (decision === 'rejected' && !qaComments.trim()) return { error: 'QA comments required for rejection.' };

  const impact = await getComplaintImpactAssessment(complaintId);
  const record = await getComplaintById(complaintId);
  if (!impact || !record) return { error: 'Impact assessment not found.' };
  if (impact.status !== 'QA Review') return { error: 'Impact assessment must be in QA Review before approval or rejection.' };

  if (impact.risk_level === 'Critical' && decision === 'approved') {
    const { canApproveCriticalComplaintImpact } = await import('@/lib/complaint-impact-records');
    if (!canApproveCriticalComplaintImpact(actor.role, impact.risk_level)) {
      return { error: 'Critical impact assessments require Head QA approval.' };
    }
  }

  const ts = nowIso();
  const status = decision === 'approved' ? 'Approved' : 'Rejected';

  try {
    await updateDoc(doc(getFirebaseFirestore(), COMPLAINT_COLLECTIONS.impactAssessments, impact.id), {
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

    const updated: ComplaintImpactAssessment = {
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
      await syncComplaintFromImpact(complaintId, updated, actor);
      if (updated.capa_required) {
        await notify('CAPA Required from Impact Assessment', `${record.complaint_number} — CAPA mandatory based on impact`, complaintId, ['qa_manager', 'head_qa']);
      }
      if (updated.recall_evaluation_required) {
        await notify('Recall Evaluation Required', `${record.complaint_number} — recall evaluation required based on market impact`, complaintId, ['qa_manager', 'head_qa', 'regulatory_affairs']);
      }
    }

    await audit(actor, decision === 'approved' ? 'Impact Assessment Approved' : 'Impact Assessment Rejected', complaintId, qaComments);
    return { impact: updated };
  } catch (e) {
    console.error('reviewComplaintImpactAssessment', e);
    return { error: e instanceof Error ? e.message : 'Failed to review impact assessment' };
  }
}

export function mapComplaintImpactToFormInput(
  impact: ComplaintImpactAssessment | null,
  record: ComplaintRecord,
  actorName: string,
): ComplaintImpactFormInput {
  return {
    assessment_date: impact?.assessment_date || today(),
    assessed_by_name: impact?.assessed_by_name || actorName,
    product_quality_impact: normalizeLegacyImpact(impact?.product_quality_impact),
    patient_safety_impact: normalizeLegacyImpact(impact?.patient_safety_impact),
    regulatory_impact: normalizeLegacyImpact(impact?.regulatory_impact),
    market_impact: normalizeLegacyImpact(impact?.market_impact) || 'Not Applicable',
    batch_impact: normalizeLegacyImpact(impact?.batch_impact) || 'No',
    distribution_impact: normalizeLegacyImpact(impact?.distribution_impact) || 'Not Applicable',
    distribution_notes: impact?.distribution_notes || '',
    other_batches_impacted: impact?.other_batches_impacted === 'Yes' ? 'Yes' : 'No',
    impacted_batch_numbers: impact?.impacted_batch_numbers || '',
    impact_description: impact?.impact_description || '',
    scientific_justification: impact?.scientific_justification || '',
    severity: impact?.severity ?? 3,
    occurrence: impact?.occurrence ?? 3,
    detection: impact?.detection ?? 3,
    capa_required: impact?.capa_required ?? false,
    recall_evaluation_required: impact?.recall_evaluation_required ?? false,
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

export async function logComplaintImpactPageViewed(complaintId: string, actor: ComplaintImpactActor, complaintNumber?: string) {
  await audit(actor, 'Impact Assessment page viewed', complaintId, complaintNumber);
}
