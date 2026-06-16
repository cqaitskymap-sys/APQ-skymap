import {
  collection, doc, addDoc, getDocs, updateDoc, query, limit, orderBy,
} from 'firebase/firestore';
import { createAuditLog } from '@/lib/audit-trail';
import {
  canStartPhase2,
  computePhase2AutoRules,
  resolveOosStatusAfterPhase2Approval,
  type Phase2Actor,
  type Phase2FormInput,
  type Phase2QaReviewInput,
} from '@/lib/oos-phase2-records';
import {
  OOS_COLLECTIONS,
  type OosCapaLink,
  type OosPhase1,
  type OosPhase2,
  type OosRecord,
} from '@/lib/oos-types';
import {
  createCapaFromOos,
  getAuditLogsForOos,
  getCapaLink,
  getImpactAssessment,
  getOosById,
  getPhase1,
  getPhase2,
  linkCapa,
  saveImpactAssessment,
  updateOosRecord,
} from '@/lib/oos-service';
import { getFirebaseFirestore, isFirebaseConfigured } from '@/lib/firebase';

export type { Phase2Actor, Phase2FormInput, Phase2QaReviewInput };

const nowIso = () => new Date().toISOString();
const today = () => new Date().toISOString().split('T')[0];

async function audit(actor: Phase2Actor, actionType: string, oosId: string, detail?: string) {
  try {
    await createAuditLog({
      moduleName: 'OOS Phase-II',
      collectionName: OOS_COLLECTIONS.phase2,
      recordId: oosId,
      actionType,
      actionDescription: detail || actionType,
      user: { id: actor.id, name: actor.name, role: actor.role || '' },
      status: 'Success',
    });
  } catch (e) {
    console.error('phase2 audit', e);
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
      console.error('phase2 notify', e);
    }
  }
}

function buildPhase2Payload(
  oosId: string,
  record: OosRecord,
  input: Phase2FormInput,
  actor: Phase2Actor,
  status: string,
  existing?: OosPhase2 | null,
): Omit<OosPhase2, 'id'> {
  const ts = nowIso();
  const auto = computePhase2AutoRules(input);
  const capaRequired = input.capa_required ?? auto.capaMandatory ?? auto.capaRecommended;

  return {
    phase2_id: existing?.phase2_id || existing?.id || `P2-${record.oos_number}`,
    oos_id: oosId,
    oos_number: record.oos_number,
    investigation_start_date: existing?.investigation_start_date || existing?.started_at?.slice(0, 10) || today(),
    investigation_due_date: existing?.investigation_due_date || record.target_closure_date || undefined,
    assigned_investigator: input.assigned_investigator || record.assigned_to_name || actor.name,
    assigned_investigator_id: input.assigned_investigator_id || record.assigned_to || actor.id,
    department: record.department,
    product_name: record.product_name,
    batch_number: record.batch_number,
    manufacturing_review: input.manufacturing_review || input.process_review || '',
    batch_record_review: input.batch_record_review,
    raw_material_review: input.raw_material_review,
    packing_material_review: input.packing_material_review,
    equipment_review: input.equipment_review,
    cleaning_review: input.cleaning_review,
    utility_review: input.utility_review,
    environmental_review: input.environmental_review,
    operator_review: input.operator_review,
    process_parameter_review: input.process_parameter_review,
    process_review: input.process_review || input.manufacturing_review || '',
    deviation_review: input.deviation_review || '',
    change_control_review: input.change_control_review || '',
    previous_batch_trend_review: input.previous_batch_trend_review,
    other_batch_impact_review: input.other_batch_impact_review,
    other_batches_impacted_list: input.other_batches_impacted_list,
    root_cause: input.root_cause || input.qa_justification || '',
    contributing_factors: input.contributing_factors,
    impact_assessment: input.impact_assessment,
    product_quality_impact: input.product_quality_impact,
    corrective_action: input.corrective_action || '',
    preventive_action: input.preventive_action || '',
    capa_required: capaRequired,
    linked_capa_number: input.linked_capa_number || record.linked_capa_number,
    conclusion: input.final_investigation_conclusion || input.conclusion || '',
    final_investigation_conclusion: input.final_investigation_conclusion || input.conclusion,
    phase2_outcome: input.phase2_outcome || existing?.phase2_outcome,
    qa_justification: input.qa_justification,
    status: capaRequired && status === 'Completed' ? 'CAPA Required' : status,
    investigator_id: existing?.investigator_id || actor.id,
    investigator_name: existing?.investigator_name || actor.name,
    started_at: existing?.started_at || ts,
    completed_at: existing?.completed_at || null,
    created_by: existing?.created_by || actor.id,
    created_by_name: existing?.created_by_name || actor.name,
    updated_by: actor.id,
    updated_by_name: actor.name,
    created_at: existing?.created_at || ts,
    updated_at: ts,
  };
}

export async function listPhase2Queue(max = 100): Promise<(OosRecord & { phase1?: OosPhase1 | null; phase2?: OosPhase2 | null })[]> {
  if (!isFirebaseConfigured()) return [];
  try {
    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), OOS_COLLECTIONS.records),
      orderBy('updated_at', 'desc'),
      limit(max),
    ));
    const records = snap.docs
      .map((d) => ({ id: d.id, ...d.data() } as OosRecord))
      .filter((r) => ['phase2_investigation', 'final_qa_review', 'capa_required', 'qa_review'].includes(r.status));

    return Promise.all(records.map(async (r) => ({
      ...r,
      phase1: await getPhase1(r.id),
      phase2: await getPhase2(r.id),
    })));
  } catch (e) {
    console.error('listPhase2Queue', e);
    return [];
  }
}

export async function fetchPhase2PageData(oosId: string) {
  if (!isFirebaseConfigured()) return { error: 'Firebase is not configured.' };
  try {
    const [record, phase1, phase2, impact, capa, auditLogs] = await Promise.all([
      getOosById(oosId),
      getPhase1(oosId),
      getPhase2(oosId),
      getImpactAssessment(oosId),
      getCapaLink(oosId),
      getAuditLogsForOos(oosId),
    ]);
    if (!record) return { error: 'OOS record not found.' };
    if (!canStartPhase2(phase1) && !phase2) {
      return {
        error: 'Phase-II is only available after Phase-I outcome is No Laboratory Error or Inconclusive with QA approval.',
        record, phase1, phase2, impact, capa, auditLogs,
      };
    }
    return { record, phase1, phase2, impact, capa, auditLogs };
  } catch (e) {
    console.error('fetchPhase2PageData', e);
    return { error: e instanceof Error ? e.message : 'Failed to load Phase-II data' };
  }
}

export async function startPhase2Investigation(oosId: string, actor: Phase2Actor): Promise<{ phase2?: OosPhase2; error?: string }> {
  const [record, phase1] = await Promise.all([getOosById(oosId), getPhase1(oosId)]);
  if (!record) return { error: 'OOS record not found' };
  if (!canStartPhase2(phase1)) return { error: 'Phase-I must be completed with outcome No Laboratory Error or Inconclusive before starting Phase-II.' };

  const payload = buildPhase2Payload(oosId, record, {
    assigned_investigator: record.assigned_to_name || actor.name,
    batch_record_review: '',
    raw_material_review: '',
    equipment_review: '',
    environmental_review: '',
    operator_review: '',
    impact_assessment: '',
  }, actor, 'In Progress');

  try {
    const existing = await getPhase2(oosId);
    let phase2: OosPhase2;
    if (existing?.id) {
      await updateDoc(doc(getFirebaseFirestore(), OOS_COLLECTIONS.phase2, existing.id), payload);
      phase2 = { ...existing, ...payload, id: existing.id };
    } else {
      const ref = await addDoc(collection(getFirebaseFirestore(), OOS_COLLECTIONS.phase2), payload);
      phase2 = { id: ref.id, ...payload };
    }

    await updateOosRecord(oosId, { status: 'phase2_investigation', phase: 'phase2' }, { id: actor.id, name: actor.name, role: actor.role || '' }, { workflow: true });
    await audit(actor, 'Phase-II started', oosId, record.oos_number);
    await notify('Phase-II Started', `${record.oos_number} manufacturing investigation initiated`, oosId, ['qa_manager', 'production_manager']);
    return { phase2 };
  } catch (e) {
    console.error('startPhase2Investigation', e);
    return { error: e instanceof Error ? e.message : 'Failed to start Phase-II' };
  }
}

export async function savePhase2Draft(
  oosId: string,
  input: Phase2FormInput,
  actor: Phase2Actor,
): Promise<{ phase2?: OosPhase2; error?: string }> {
  const record = await getOosById(oosId);
  if (!record) return { error: 'OOS record not found' };

  const existing = await getPhase2(oosId);
  const status = existing?.status === 'QA Review' ? 'QA Review' : 'In Progress';
  const payload = buildPhase2Payload(oosId, record, input, actor, status, existing);

  try {
    let phase2: OosPhase2;
    if (existing?.id) {
      await updateDoc(doc(getFirebaseFirestore(), OOS_COLLECTIONS.phase2, existing.id), payload);
      phase2 = { ...existing, ...payload, id: existing.id };
    } else {
      const ref = await addDoc(collection(getFirebaseFirestore(), OOS_COLLECTIONS.phase2), payload);
      phase2 = { id: ref.id, ...payload };
    }

    if (record.status !== 'phase2_investigation') {
      await updateOosRecord(oosId, { status: 'phase2_investigation', phase: 'phase2' }, { id: actor.id, name: actor.name, role: actor.role || '' }, { workflow: true });
    }

    await audit(actor, 'Phase-II draft saved', oosId, payload.phase2_outcome);
    return { phase2 };
  } catch (e) {
    console.error('savePhase2Draft', e);
    return { error: e instanceof Error ? e.message : 'Failed to save Phase-II draft' };
  }
}

export async function submitPhase2ToQa(
  oosId: string,
  input: Phase2FormInput,
  actor: Phase2Actor,
): Promise<{ phase2?: OosPhase2; error?: string }> {
  const auto = computePhase2AutoRules(input);
  if (!input.manufacturing_review?.trim() && !input.process_review?.trim()) {
    return { error: 'Manufacturing review is required.' };
  }
  if (!input.batch_record_review?.trim()) return { error: 'Batch record review is required.' };
  if (!input.impact_assessment?.trim()) return { error: 'Impact assessment is required.' };
  if (!input.final_investigation_conclusion?.trim() && !input.conclusion?.trim()) {
    return { error: 'Final investigation conclusion is required.' };
  }
  if (!input.phase2_outcome) return { error: 'Phase-II outcome is required.' };
  if (!input.root_cause?.trim() && input.phase2_outcome !== 'No Assignable Cause' && !input.qa_justification?.trim()) {
    return { error: 'Root cause or QA justification is required.' };
  }
  if (auto.requireQaJustification && !input.qa_justification?.trim()) {
    return { error: 'QA justification is required when no assignable cause is identified.' };
  }
  if (auto.requireBatchList && !input.other_batches_impacted_list?.trim()) {
    return { error: 'Impacted batch list is required when other batches are impacted.' };
  }
  if (auto.capaMandatory) input.capa_required = true;

  const record = await getOosById(oosId);
  if (!record) return { error: 'OOS record not found' };

  const existing = await getPhase2(oosId);
  const payload = buildPhase2Payload(oosId, record, input, actor, 'QA Review', existing);
  payload.completed_at = nowIso();

  try {
    let phase2: OosPhase2;
    if (existing?.id) {
      await updateDoc(doc(getFirebaseFirestore(), OOS_COLLECTIONS.phase2, existing.id), payload);
      phase2 = { ...existing, ...payload, id: existing.id };
    } else {
      const ref = await addDoc(collection(getFirebaseFirestore(), OOS_COLLECTIONS.phase2), payload);
      phase2 = { id: ref.id, ...payload };
    }

    await updateOosRecord(oosId, {
      status: 'qa_review',
      phase: 'phase2',
      root_cause: payload.root_cause,
      capa_required: payload.capa_required,
    }, { id: actor.id, name: actor.name, role: actor.role || '' }, { workflow: true });

    if (input.product_quality_impact === 'Yes') {
      await saveImpactAssessment(oosId, {
        product_impact: 'Yes — product quality impacted',
        batch_impact: input.other_batch_impact_review || record.batch_number,
        market_impact: '',
        patient_safety_impact: 'To be assessed',
        regulatory_impact: 'To be assessed',
        other_batches_impacted: input.other_batches_impacted_list || '',
        recall_required: false,
        assessed_by: actor.id,
        assessed_by_name: actor.name,
        assessed_at: nowIso(),
      }, { id: actor.id, name: actor.name, role: actor.role || '' });
    }

    await notify('Phase-II Submitted for QA Review', `${record.oos_number} Phase-II submitted by ${actor.name}`, oosId, ['qa_manager', 'qa', 'head_qa']);
    await audit(actor, 'Phase-II submitted to QA', oosId, input.phase2_outcome);
    return { phase2 };
  } catch (e) {
    console.error('submitPhase2ToQa', e);
    return { error: e instanceof Error ? e.message : 'Failed to submit Phase-II' };
  }
}

export async function reviewPhase2(
  oosId: string,
  review: Phase2QaReviewInput,
  actor: Phase2Actor,
): Promise<{ phase2?: OosPhase2; error?: string }> {
  const existing = await getPhase2(oosId);
  const record = await getOosById(oosId);
  if (!existing || !record) return { error: 'Phase-II record not found' };
  if (existing.status !== 'QA Review') return { error: 'Phase-II must be in QA Review before approval or rejection.' };

  const ts = nowIso();
  const status = review.decision === 'approved'
    ? (existing.capa_required ? 'CAPA Required' : 'Completed')
    : 'Rejected';

  try {
    await updateDoc(doc(getFirebaseFirestore(), OOS_COLLECTIONS.phase2, existing.id), {
      status,
      qa_decision: review.decision,
      qa_review_comments: review.qa_review_comments,
      qa_reviewer_id: actor.id,
      qa_reviewer_name: actor.name,
      qa_reviewed_at: ts,
      updated_at: ts,
      updated_by: actor.id,
      updated_by_name: actor.name,
      completed_at: review.decision === 'approved' ? ts : existing.completed_at,
    });

    const phase2: OosPhase2 = {
      ...existing,
      status,
      qa_decision: review.decision,
      qa_review_comments: review.qa_review_comments,
      qa_reviewer_id: actor.id,
      qa_reviewer_name: actor.name,
      qa_reviewed_at: ts,
      updated_at: ts,
    };

    if (review.decision === 'approved') {
      const nextStatus = resolveOosStatusAfterPhase2Approval(phase2);
      await updateOosRecord(oosId, {
        status: nextStatus,
        phase: 'phase2',
        root_cause: phase2.root_cause,
        capa_required: phase2.capa_required,
      }, { id: actor.id, name: actor.name, role: actor.role || '' }, { workflow: true });

      if (phase2.capa_required) {
        await notify('CAPA Required', `${record.oos_number} — CAPA required from Phase-II investigation`, oosId, ['qa_manager', 'head_qa']);
      }
    } else {
      await updateOosRecord(oosId, { status: 'phase2_investigation', phase: 'phase2' }, { id: actor.id, name: actor.name, role: actor.role || '' }, { workflow: true });
      await notify('Phase-II Rejected', `${record.oos_number} Phase-II rejected — returned for revision`, oosId, ['production_manager', 'qc_manager']);
    }

    await audit(actor, review.decision === 'approved' ? 'Phase-II approved' : 'Phase-II rejected', oosId, review.qa_review_comments);
    return { phase2 };
  } catch (e) {
    console.error('reviewPhase2', e);
    return { error: e instanceof Error ? e.message : 'Failed to review Phase-II' };
  }
}

export async function linkCapaToPhase2(
  oosId: string,
  capaNumber: string,
  actor: Phase2Actor,
): Promise<{ capa?: OosCapaLink; error?: string }> {
  try {
    const record = await getOosById(oosId);
    if (!record) return { error: 'OOS not found' };
    const capa = await linkCapa(oosId, capaNumber, null, 'open', record.target_closure_date, '', { id: actor.id, name: actor.name, role: actor.role || '' });
    const phase2 = await getPhase2(oosId);
    if (phase2?.id) {
      await updateDoc(doc(getFirebaseFirestore(), OOS_COLLECTIONS.phase2, phase2.id), {
        linked_capa_number: capaNumber,
        capa_required: true,
        updated_at: nowIso(),
      });
    }
    await audit(actor, 'CAPA linked to Phase-II', oosId, capaNumber);
    return { capa };
  } catch (e) {
    console.error('linkCapaToPhase2', e);
    return { error: e instanceof Error ? e.message : 'Failed to link CAPA' };
  }
}

export async function createCapaDraftFromPhase2(oosId: string, actor: Phase2Actor): Promise<{ capaNumber?: string; error?: string }> {
  try {
    const result = await createCapaFromOos(oosId, { id: actor.id, name: actor.name, role: actor.role || '' });
    const phase2 = await getPhase2(oosId);
    if (phase2?.id) {
      await updateDoc(doc(getFirebaseFirestore(), OOS_COLLECTIONS.phase2, phase2.id), {
        linked_capa_number: result.capaNumber,
        capa_required: true,
        status: 'CAPA Required',
        updated_at: nowIso(),
      });
    }
    await audit(actor, 'CAPA draft created from Phase-II', oosId, result.capaNumber);
    return { capaNumber: result.capaNumber };
  } catch (e) {
    console.error('createCapaDraftFromPhase2', e);
    return { error: e instanceof Error ? e.message : 'Failed to create CAPA' };
  }
}

export async function logPhase2PageViewed(oosId: string, actor: Phase2Actor, oosNumber?: string) {
  await audit(actor, 'Phase-II page viewed', oosId, oosNumber);
}
