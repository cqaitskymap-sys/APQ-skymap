import {
  addDoc, collection, doc, getDoc, getDocs, limit, orderBy, query, updateDoc, where,
} from 'firebase/firestore';
import { createAuditLog } from '@/lib/audit-trail';
import { getFirebaseFirestore, isFirebaseConfigured } from '@/lib/firebase';
import {
  buildImpactAssessmentId,
  canApproveCriticalCcImpact,
  CC_IMPACT_MODULE,
  computeCcImpactDashboardMetrics,
  computeOverallImpactRating,
  deriveImpactFlags,
  generateImpactRecommendations,
  isImpactYes,
  type CcImpactActor,
  type CcImpactFormInput,
  type CcImpactQaReviewInput,
  validateImpactRules,
} from '@/lib/cc-impact-records';
import {
  CC_COLLECTIONS,
  type CcImpactDashboardMetrics,
  type ChangeControlRecord,
  type ChangeImpactAssessment,
} from '@/lib/change-control-types';
import {
  getAuditLogsForChange,
  getChangeById,
  listChanges,
  updateChange,
} from '@/lib/change-control-service';

export type { CcImpactActor, CcImpactFormInput, CcImpactQaReviewInput };

const nowIso = () => new Date().toISOString();

async function audit(
  actor: CcImpactActor,
  actionType: string,
  changeId: string,
  detail?: string,
  recordId?: string,
) {
  try {
    await createAuditLog({
      moduleName: CC_IMPACT_MODULE,
      collectionName: CC_COLLECTIONS.impact,
      recordId: recordId || changeId,
      actionType,
      actionDescription: detail || actionType,
      reason: detail || '',
      user: { id: actor.id, name: actor.name, role: actor.role, department: actor.department },
      status: 'Success',
    });
  } catch (e) {
    console.error('cc impact audit', e);
  }
}

async function notify(
  title: string,
  message: string,
  changeId: string,
  opts?: { userId?: string; targetRole?: string },
) {
  if (!isFirebaseConfigured()) return;
  try {
    await addDoc(collection(getFirebaseFirestore(), CC_COLLECTIONS.notifications), {
      title, message, module: CC_IMPACT_MODULE, record_id: changeId,
      ...(opts?.userId ? { user_id: opts.userId } : {}),
      ...(opts?.targetRole ? { target_role: opts.targetRole } : {}),
      read: false, created_at: nowIso(),
    });
  } catch (e) {
    console.error('cc impact notify', e);
  }
}

function normalizeImpact(docId: string, data: Record<string, unknown>): ChangeImpactAssessment {
  const a = { id: docId, ...data } as ChangeImpactAssessment;
  return {
    ...a,
    product_impact: a.product_impact || a.quality_impact || 'No',
    document_impact: a.document_impact || a.documentation_impact || 'No',
    csv_impact: a.csv_impact || a.computerized_system_impact || 'No',
    patient_safety_impact: a.patient_safety_impact || a.safety_impact || 'No',
    quality_impact: a.quality_impact || 'No',
    process_impact: a.process_impact || 'No',
    equipment_impact: a.equipment_impact || 'No',
    utility_impact: a.utility_impact || 'No',
    facility_impact: a.facility_impact || 'No',
    training_impact: a.training_impact || 'No',
    validation_impact: a.validation_impact || 'No',
    regulatory_impact: a.regulatory_impact || 'No',
    stability_impact: a.stability_impact || 'No',
    market_impact: a.market_impact || 'No',
    business_impact: a.business_impact || 'No',
    supplier_impact: a.supplier_impact || 'No',
    environmental_impact: a.environmental_impact || 'No',
    data_integrity_impact: a.data_integrity_impact || 'No',
    safety_impact: a.safety_impact || a.patient_safety_impact || 'No',
    efficacy_impact: a.efficacy_impact || 'No',
    cleaning_impact: a.cleaning_impact || 'No',
    documentation_impact: a.documentation_impact || a.document_impact || 'No',
    computerized_system_impact: a.computerized_system_impact || a.csv_impact || 'No',
    status: a.status || 'Draft',
    is_deleted: a.is_deleted ?? false,
  };
}

function buildPayload(
  change: ChangeControlRecord,
  input: CcImpactFormInput,
  actor: CcImpactActor,
  existing?: ChangeImpactAssessment | null,
): Partial<ChangeImpactAssessment> {
  const flags = deriveImpactFlags(input);
  const recommendations = generateImpactRecommendations(input, change);
  const rating = input.overall_impact_rating || computeOverallImpactRating(input.impact_severity, input.impact_likelihood);
  const timestamp = nowIso();
  return {
    change_id: change.id,
    change_control_number: change.change_control_number,
    impact_assessment_id: existing?.impact_assessment_id || buildImpactAssessmentId(change.change_control_number),
    assessment_date: input.assessment_date,
    assessed_by: input.assessed_by,
    assessed_by_name: input.assessed_by_name || actor.name,
    department: input.department,
    product_impact: input.product_impact,
    process_impact: input.process_impact,
    equipment_impact: input.equipment_impact,
    utility_impact: input.utility_impact,
    facility_impact: input.facility_impact,
    document_impact: input.document_impact,
    documentation_impact: input.document_impact,
    training_impact: input.training_impact,
    validation_impact: input.validation_impact,
    csv_impact: input.csv_impact,
    computerized_system_impact: input.csv_impact,
    regulatory_impact: input.regulatory_impact,
    quality_impact: input.quality_impact,
    patient_safety_impact: input.patient_safety_impact,
    safety_impact: input.patient_safety_impact,
    efficacy_impact: input.quality_impact,
    stability_impact: input.stability_impact,
    market_impact: input.market_impact,
    business_impact: input.business_impact,
    supplier_impact: input.supplier_impact,
    environmental_impact: input.environmental_impact,
    data_integrity_impact: input.data_integrity_impact,
    cleaning_impact: input.facility_impact,
    impact_description: input.impact_description,
    scientific_justification: input.scientific_justification,
    recommended_actions: input.recommended_actions || recommendations.join('\n'),
    recommendations,
    ...flags,
    capa_required: change.capa_required || flags.capa_required,
    impact_severity: input.impact_severity,
    impact_likelihood: input.impact_likelihood,
    overall_impact_rating: rating,
    qa_comments: input.qa_comments || existing?.qa_comments || '',
    status: existing?.status || 'Draft',
    remarks: input.recommended_actions || existing?.remarks || '',
    assessed_at: existing?.assessed_at || timestamp,
    updated_at: timestamp,
    created_by: existing?.created_by || actor.id,
    updated_by: actor.id,
    is_deleted: false,
  };
}

export async function getCcImpactAssessment(changeId: string): Promise<ChangeImpactAssessment | null> {
  if (!isFirebaseConfigured()) return null;
  const snap = await getDocs(query(
    collection(getFirebaseFirestore(), CC_COLLECTIONS.impact),
    where('change_id', '==', changeId),
    limit(1),
  ));
  if (snap.empty) return null;
  const d = snap.docs[0];
  const data = d.data() as Record<string, unknown>;
  if (data.is_deleted) return null;
  return normalizeImpact(d.id, data);
}

export async function listCcImpactAssessments(max = 300) {
  if (!isFirebaseConfigured()) return { assessments: [] as (ChangeImpactAssessment & { change?: ChangeControlRecord | null })[] };
  const [snap, changes] = await Promise.all([
    getDocs(query(collection(getFirebaseFirestore(), CC_COLLECTIONS.impact), orderBy('updated_at', 'desc'), limit(max))),
    listChanges(),
  ]);
  const changeById = new Map(changes.map((c) => [c.id, c]));
  const assessments = snap.docs
    .map((d) => normalizeImpact(d.id, d.data() as Record<string, unknown>))
    .filter((a) => !a.is_deleted)
    .map((a) => ({ ...a, change: changeById.get(a.change_id) || null }));
  return { assessments };
}

export async function fetchCcImpactPageData(changeId: string) {
  try {
    const [change, assessment, auditLogs] = await Promise.all([
      getChangeById(changeId),
      getCcImpactAssessment(changeId),
      getAuditLogsForChange(changeId),
    ]);
    if (!change) return { error: 'Change control not found' };
    return { change, assessment, auditLogs };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed to load impact assessment' };
  }
}

export async function fetchCcImpactListData() {
  try {
    const { assessments } = await listCcImpactAssessments();
    const changes = await listChanges();
    const metrics = computeCcImpactDashboardMetrics(assessments);
    const pending = changes.filter((c) =>
      ['submitted', 'under_qa_review', 'impact_assessment'].includes(c.status)
      && !assessments.some((a) => a.change_id === c.id),
    );
    return { assessments, changes, pending, metrics };
  } catch (e) {
    return {
      assessments: [] as (ChangeImpactAssessment & { change?: ChangeControlRecord | null })[],
      changes: [] as ChangeControlRecord[],
      pending: [] as ChangeControlRecord[],
      metrics: computeCcImpactDashboardMetrics([]),
      error: e instanceof Error ? e.message : 'Failed to load list',
    };
  }
}

async function syncChangeImpactFlags(change: ChangeControlRecord, input: CcImpactFormInput, actor: CcImpactActor) {
  await updateChange(change.id, {
    validation_impact: isImpactYes(input.validation_impact),
    csv_impact: isImpactYes(input.csv_impact) || isImpactYes(input.data_integrity_impact),
    training_impact: isImpactYes(input.training_impact),
    regulatory_impact: isImpactYes(input.regulatory_impact),
    stability_impact: isImpactYes(input.stability_impact),
    quality_impact: isImpactYes(input.quality_impact) || isImpactYes(input.product_impact),
    patient_safety_impact: isImpactYes(input.patient_safety_impact),
    market_impact: isImpactYes(input.market_impact),
    risk_assessment_required: ['High', 'Critical'].includes(input.overall_impact_rating),
  }, { id: actor.id, name: actor.name, role: actor.role || '' }, true);
}

async function sendMandatoryNotifications(changeId: string, input: CcImpactFormInput) {
  if (isImpactYes(input.validation_impact)) await notify('Validation Assessment Required', 'Validation impact identified.', changeId, { targetRole: 'qa' });
  if (isImpactYes(input.csv_impact) || isImpactYes(input.data_integrity_impact)) await notify('CSV Review Required', 'CSV/Data integrity impact identified.', changeId, { targetRole: 'it_csv' });
  if (isImpactYes(input.training_impact)) await notify('Training Plan Required', 'Training impact identified.', changeId, { targetRole: 'qa' });
  if (isImpactYes(input.regulatory_impact)) await notify('Regulatory Review Required', 'Regulatory impact identified.', changeId, { targetRole: 'regulatory' });
  if (isImpactYes(input.patient_safety_impact)) await notify('Patient Safety Impact', 'Head QA review required.', changeId, { targetRole: 'head_qa' });
  if (input.overall_impact_rating === 'Critical') await notify('Critical Impact Assessment', 'Head QA approval required.', changeId, { targetRole: 'head_qa' });
}

export async function saveCcImpactDraft(
  input: CcImpactFormInput,
  actor: CcImpactActor,
): Promise<{ assessment?: ChangeImpactAssessment; error?: string }> {
  if (!isFirebaseConfigured()) return { error: 'Firebase not configured' };
  const errors = validateImpactRules(input);
  if (errors.length) return { error: errors[0] };

  const change = await getChangeById(input.change_id);
  if (!change) return { error: 'Change control not found' };

  const existing = await getCcImpactAssessment(input.change_id);
  const payload = buildPayload(change, input, actor, existing);
  let refId = existing?.id;

  if (existing) {
    await updateDoc(doc(getFirebaseFirestore(), CC_COLLECTIONS.impact, existing.id), payload);
    await audit(actor, 'IMPACT_UPDATED', change.id, input.impact_description, existing.id);
  } else {
    const ref = await addDoc(collection(getFirebaseFirestore(), CC_COLLECTIONS.impact), { ...payload, created_at: nowIso() });
    refId = ref.id;
    await audit(actor, 'ASSESSMENT_CREATED', change.id, payload.impact_assessment_id, refId);
  }

  await audit(actor, 'RECOMMENDATION_GENERATED', change.id, (payload.recommendations || []).join('; '), refId);
  await syncChangeImpactFlags(change, input, actor);
  await updateChange(change.id, { status: 'impact_assessment' }, { id: actor.id, name: actor.name, role: actor.role || '' }, true);
  await sendMandatoryNotifications(change.id, input);

  return { assessment: { id: refId!, ...payload } as ChangeImpactAssessment };
}

export async function submitCcImpactForReview(changeId: string, actor: CcImpactActor) {
  const assessment = await getCcImpactAssessment(changeId);
  if (!assessment) return { error: 'Save impact assessment first' };
  await updateDoc(doc(getFirebaseFirestore(), CC_COLLECTIONS.impact, assessment.id), {
    status: 'Under Review', updated_at: nowIso(), updated_by: actor.id,
  });
  await audit(actor, 'IMPACT_SUBMITTED', changeId, 'Submitted for review', assessment.id);
  return { ok: true };
}

export async function submitCcImpactQaReview(
  changeId: string,
  input: CcImpactQaReviewInput,
  actor: CcImpactActor,
): Promise<{ assessment?: ChangeImpactAssessment; error?: string }> {
  const assessment = await getCcImpactAssessment(changeId);
  if (!assessment) return { error: 'Impact assessment not found' };

  if (input.decision === 'approved' && assessment.overall_impact_rating === 'Critical' && !canApproveCriticalCcImpact(actor.role)) {
    await updateDoc(doc(getFirebaseFirestore(), CC_COLLECTIONS.impact, assessment.id), {
      status: 'QA Review', qa_comments: input.qa_comments, updated_at: nowIso(), updated_by: actor.id,
    });
    await notify('Head QA Approval Required', 'Critical impact assessment requires Head QA approval.', changeId, { targetRole: 'head_qa' });
    return { error: 'Head QA approval required for Critical impact assessments.' };
  }

  const status = input.decision === 'approved' ? 'Approved' : 'Rejected';
  const updates: Partial<ChangeImpactAssessment> = {
    status,
    qa_comments: input.qa_comments,
    head_qa_comments: input.head_qa_comments,
    updated_at: nowIso(),
    updated_by: actor.id,
  };
  await updateDoc(doc(getFirebaseFirestore(), CC_COLLECTIONS.impact, assessment.id), updates);
  await audit(actor, input.decision === 'approved' ? 'ASSESSMENT_APPROVED' : 'ASSESSMENT_REJECTED', changeId, input.qa_comments, assessment.id);
  await audit(actor, 'QA_REVIEW_COMPLETED', changeId, input.qa_comments, assessment.id);
  await notify('Impact Assessment QA Review', `Assessment ${input.decision}.`, changeId, { userId: assessment.assessed_by });

  if (input.decision === 'approved') {
    const change = await getChangeById(changeId);
    if (change) {
      const nextStatus = change.risk_assessment_required ? 'risk_assessment' : 'under_qa_review';
      await updateChange(changeId, { status: nextStatus }, { id: actor.id, name: actor.name, role: actor.role || '' }, true);
      try {
        const { createAutoImplementationTasks } = await import('@/lib/change-control-service');
        await createAutoImplementationTasks(change, { id: actor.id, name: actor.name, role: actor.role || '' });
      } catch {
        // non-blocking
      }
    }
  }

  return { assessment: { ...assessment, ...updates } };
}

export async function getLegacyImpactAssessment(changeId: string): Promise<ChangeImpactAssessment | null> {
  return getCcImpactAssessment(changeId);
}

export { computeCcImpactDashboardMetrics };

export type { CcImpactDashboardMetrics };
