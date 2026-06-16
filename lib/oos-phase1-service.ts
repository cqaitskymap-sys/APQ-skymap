import {
  collection, doc, addDoc, getDocs, updateDoc, query, where, limit, orderBy,
} from 'firebase/firestore';
import { createAuditLog } from '@/lib/audit-trail';
import {
  computePhase1AutoRules,
  resolveOosPhaseAfterPhase1Approval,
  resolveOosStatusAfterPhase1Approval,
  type Phase1Actor,
  type Phase1FormInput,
  type Phase1QaReviewInput,
} from '@/lib/oos-phase1-records';
import {
  OOS_COLLECTIONS,
  type OosAttachment,
  type OosPhase1,
  type OosRecord,
} from '@/lib/oos-types';
import {
  getAttachments,
  getAuditLogsForOos,
  getOosById,
  getPhase1,
  updateOosRecord,
  uploadAttachment,
} from '@/lib/oos-service';
import { getFirebaseFirestore, isFirebaseConfigured } from '@/lib/firebase';

export type { Phase1Actor, Phase1FormInput, Phase1QaReviewInput };

const nowIso = () => new Date().toISOString();
const today = () => new Date().toISOString().split('T')[0];

async function audit(actor: Phase1Actor, actionType: string, oosId: string, detail?: string) {
  try {
    await createAuditLog({
      moduleName: 'OOS Phase-I',
      collectionName: OOS_COLLECTIONS.phase1,
      recordId: oosId,
      actionType,
      actionDescription: detail || actionType,
      user: { id: actor.id, name: actor.name, role: actor.role || '' },
      status: 'Success',
    });
  } catch (e) {
    console.error('phase1 audit', e);
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
      console.error('phase1 notify', e);
    }
  }
}

export interface EquipmentOption {
  id: string;
  name: string;
  equipmentId: string;
  calibrationStatus?: string;
}

async function safeQuery(name: string, max = 200): Promise<Record<string, unknown>[]> {
  if (!isFirebaseConfigured()) return [];
  try {
    const snap = await getDocs(query(collection(getFirebaseFirestore(), name), limit(max)));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.error(`safeQuery ${name}`, e);
    return [];
  }
}

export async function fetchEquipmentOptions(): Promise<EquipmentOption[]> {
  const rows = await safeQuery('equipment_master');
  return rows.map((r) => ({
    id: String(r.id),
    name: String(r.equipmentName || r.equipment_name || r.name || r.id),
    equipmentId: String(r.equipmentId || r.equipment_id || r.assetTag || r.id),
    calibrationStatus: String(r.calibrationStatus || r.calibration_status || 'Valid'),
  })).filter((e) => e.name).sort((a, b) => a.name.localeCompare(b.name));
}

export async function listPhase1Queue(max = 100): Promise<(OosRecord & { phase1?: OosPhase1 | null })[]> {
  if (!isFirebaseConfigured()) return [];
  try {
    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), OOS_COLLECTIONS.records),
      orderBy('updated_at', 'desc'),
      limit(max),
    ));
    const records = snap.docs
      .map((d) => ({ id: d.id, ...d.data() } as OosRecord))
      .filter((r) => ['submitted', 'phase1_investigation', 'qa_review'].includes(r.status));

    return Promise.all(records.map(async (r) => ({
      ...r,
      phase1: await getPhase1(r.id),
    })));
  } catch (e) {
    console.error('listPhase1Queue', e);
    return [];
  }
}

export async function fetchPhase1PageData(oosId: string) {
  if (!isFirebaseConfigured()) return { error: 'Firebase is not configured.' };
  try {
    const [record, phase1, attachments, auditLogs] = await Promise.all([
      getOosById(oosId),
      getPhase1(oosId),
      getAttachments(oosId),
      getAuditLogsForOos(oosId),
    ]);
    if (!record) return { error: 'OOS record not found.' };
    return { record, phase1, attachments, auditLogs };
  } catch (e) {
    console.error('fetchPhase1PageData', e);
    return { error: e instanceof Error ? e.message : 'Failed to load Phase-I data' };
  }
}

function buildPhase1Payload(
  oosId: string,
  record: OosRecord,
  input: Phase1FormInput,
  actor: Phase1Actor,
  status: string,
  existing?: OosPhase1 | null,
): Omit<OosPhase1, 'id'> {
  const ts = nowIso();
  const auto = computePhase1AutoRules(input);
  return {
    phase1_id: existing?.phase1_id || existing?.id || `P1-${record.oos_number}`,
    oos_id: oosId,
    oos_number: record.oos_number,
    investigation_start_date: existing?.investigation_start_date || existing?.started_at?.slice(0, 10) || today(),
    investigation_due_date: existing?.investigation_due_date || record.target_closure_date || undefined,
    qc_investigator: input.qc_investigator || actor.name,
    qc_investigator_id: input.qc_investigator_id || actor.id,
    analyst_name: input.analyst_name || record.analyst_name || '',
    test_name: record.test_name,
    parameter_name: record.parameter_name,
    instrument_used: input.instrument_used,
    instrument_id: input.instrument_id,
    instrument_calibration_status: input.instrument_calibration_status,
    standard_used: input.standard_used,
    standard_lot_number: input.standard_lot_number,
    reagent_used: input.reagent_used,
    reagent_lot_number: input.reagent_lot_number,
    glassware_verified: input.glassware_verified ?? false,
    calculation_verified: input.calculation_verified ?? false,
    method_followed_correctly: input.method_followed_correctly ?? false,
    sample_preparation_verified: input.sample_preparation_verified ?? false,
    data_review_completed: input.data_review_completed ?? false,
    chromatogram_attached: input.chromatogram_attached ?? false,
    raw_data_attached: input.raw_data_attached ?? false,
    chromatogram_raw_data_reviewed: input.chromatogram_raw_data_reviewed ?? false,
    analyst_interview_completed: input.analyst_interview_completed ?? false,
    lab_error_observed: input.lab_error_observed ?? input.phase1_outcome === 'Laboratory Error',
    assignable_cause_identified: input.assignable_cause_identified ?? Boolean(input.root_cause_identified),
    investigation_findings: input.investigation_findings,
    root_cause_identified: input.root_cause_identified || input.root_cause || '',
    root_cause: input.root_cause || input.root_cause_identified || '',
    corrective_action: input.corrective_action || '',
    phase1_conclusion: input.phase1_conclusion,
    phase1_outcome: input.phase1_outcome || existing?.phase1_outcome || 'Inconclusive',
    status,
    phase2_recommended: auto.phase2Recommended,
    deviation_recommended: auto.deviationRecommended,
    investigator_id: existing?.investigator_id || record.assigned_to || actor.id,
    investigator_name: existing?.investigator_name || record.assigned_to_name || actor.name,
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

export async function startPhase1Investigation(oosId: string, actor: Phase1Actor): Promise<{ phase1?: OosPhase1; error?: string }> {
  const record = await getOosById(oosId);
  if (!record) return { error: 'OOS record not found' };

  const payload = buildPhase1Payload(oosId, record, {
    analyst_name: record.analyst_name || actor.name,
    instrument_used: record.instrument_used || '',
    instrument_calibration_status: 'Valid',
    standard_used: '',
    reagent_used: '',
    calculation_verified: false,
    investigation_findings: '',
    phase1_conclusion: '',
  }, actor, 'In Progress');

  try {
    const existing = await getPhase1(oosId);
    let phase1: OosPhase1;
    if (existing?.id) {
      await updateDoc(doc(getFirebaseFirestore(), OOS_COLLECTIONS.phase1, existing.id), payload);
      phase1 = { ...existing, ...payload, id: existing.id };
    } else {
      const ref = await addDoc(collection(getFirebaseFirestore(), OOS_COLLECTIONS.phase1), payload);
      phase1 = { id: ref.id, ...payload };
    }

    await updateOosRecord(oosId, { status: 'phase1_investigation', phase: 'phase1' }, { id: actor.id, name: actor.name, role: actor.role || '' }, { workflow: true });
    await audit(actor, 'Phase-I started', oosId, record.oos_number);
    return { phase1 };
  } catch (e) {
    console.error('startPhase1Investigation', e);
    return { error: e instanceof Error ? e.message : 'Failed to start Phase-I' };
  }
}

export async function savePhase1Draft(
  oosId: string,
  input: Phase1FormInput,
  actor: Phase1Actor,
): Promise<{ phase1?: OosPhase1; error?: string }> {
  const record = await getOosById(oosId);
  if (!record) return { error: 'OOS record not found' };

  const existing = await getPhase1(oosId);
  const status = existing?.status === 'QA Review' ? 'QA Review' : 'In Progress';
  const payload = buildPhase1Payload(oosId, record, input, actor, status, existing);

  try {
    let phase1: OosPhase1;
    if (existing?.id) {
      await updateDoc(doc(getFirebaseFirestore(), OOS_COLLECTIONS.phase1, existing.id), payload);
      phase1 = { ...existing, ...payload, id: existing.id };
    } else {
      const ref = await addDoc(collection(getFirebaseFirestore(), OOS_COLLECTIONS.phase1), payload);
      phase1 = { id: ref.id, ...payload };
    }

    if (record.status === 'submitted') {
      await updateOosRecord(oosId, { status: 'phase1_investigation', phase: 'phase1' }, { id: actor.id, name: actor.name, role: actor.role || '' }, { workflow: true });
    }

    await audit(actor, 'Phase-I draft saved', oosId, payload.phase1_outcome);
    return { phase1 };
  } catch (e) {
    console.error('savePhase1Draft', e);
    return { error: e instanceof Error ? e.message : 'Failed to save Phase-I draft' };
  }
}

export async function submitPhase1ToQa(
  oosId: string,
  input: Phase1FormInput,
  actor: Phase1Actor,
): Promise<{ phase1?: OosPhase1; error?: string }> {
  const auto = computePhase1AutoRules(input);
  if (!input.calculation_verified) return { error: 'Calculation verification is required before submission.' };
  if (!input.investigation_findings?.trim()) return { error: 'Investigation findings are required.' };
  if (!input.phase1_conclusion?.trim()) return { error: 'Phase-I conclusion is required.' };
  if (!input.phase1_outcome) return { error: 'Phase-I outcome is required before submission.' };
  if (auto.requireRootCause && !input.root_cause_identified?.trim() && !input.root_cause?.trim()) {
    return { error: 'Root cause is required when Laboratory Error is identified.' };
  }
  if (auto.requireCorrection && !input.corrective_action?.trim()) {
    return { error: 'Corrective action is required when Laboratory Error is identified.' };
  }

  const record = await getOosById(oosId);
  if (!record) return { error: 'OOS record not found' };

  const existing = await getPhase1(oosId);
  const payload = buildPhase1Payload(oosId, record, input, actor, 'QA Review', existing);
  payload.completed_at = nowIso();

  try {
    let phase1: OosPhase1;
    if (existing?.id) {
      await updateDoc(doc(getFirebaseFirestore(), OOS_COLLECTIONS.phase1, existing.id), payload);
      phase1 = { ...existing, ...payload, id: existing.id };
    } else {
      const ref = await addDoc(collection(getFirebaseFirestore(), OOS_COLLECTIONS.phase1), payload);
      phase1 = { id: ref.id, ...payload };
    }

    await updateOosRecord(oosId, {
      status: 'qa_review',
      phase: 'phase1',
      root_cause: payload.root_cause_identified || payload.root_cause || record.root_cause,
    }, { id: actor.id, name: actor.name, role: actor.role || '' }, { workflow: true });

    await notify('Phase-I Submitted for QA Review', `${record.oos_number} Phase-I investigation submitted by ${actor.name}`, oosId, ['qa_manager', 'qa']);
    if (auto.deviationRecommended) {
      await notify('Deviation Recommended', `${record.oos_number} — instrument calibration issue detected in Phase-I`, oosId, ['qa_manager']);
    }
    await audit(actor, 'Phase-I submitted to QA', oosId, input.phase1_outcome);
    return { phase1 };
  } catch (e) {
    console.error('submitPhase1ToQa', e);
    return { error: e instanceof Error ? e.message : 'Failed to submit Phase-I' };
  }
}

export async function reviewPhase1(
  oosId: string,
  review: Phase1QaReviewInput,
  actor: Phase1Actor,
): Promise<{ phase1?: OosPhase1; error?: string }> {
  const existing = await getPhase1(oosId);
  const record = await getOosById(oosId);
  if (!existing || !record) return { error: 'Phase-I record not found' };
  if (existing.status !== 'QA Review') return { error: 'Phase-I must be in QA Review before approval or rejection.' };

  const ts = nowIso();
  const status = review.decision === 'approved' ? 'Completed' : 'Rejected';

  try {
    await updateDoc(doc(getFirebaseFirestore(), OOS_COLLECTIONS.phase1, existing.id), {
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

    const phase1: OosPhase1 = {
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
      const nextStatus = resolveOosStatusAfterPhase1Approval(phase1);
      const nextPhase = resolveOosPhaseAfterPhase1Approval(phase1);
      await updateOosRecord(oosId, {
        status: nextStatus,
        phase: nextPhase,
        root_cause: phase1.root_cause_identified || phase1.root_cause || record.root_cause,
      }, { id: actor.id, name: actor.name, role: actor.role || '' }, { workflow: true });

      if (phase1.phase2_recommended) {
        await notify('Phase-II Recommended', `${record.oos_number} — proceed with Phase-II manufacturing investigation`, oosId, ['qa_manager', 'production_manager']);
      }
    } else {
      await updateOosRecord(oosId, { status: 'phase1_investigation', phase: 'phase1' }, { id: actor.id, name: actor.name, role: actor.role || '' }, { workflow: true });
      await notify('Phase-I Rejected', `${record.oos_number} Phase-I rejected — returned to QC for revision`, oosId, ['qc_manager', 'qc']);
    }

    await audit(actor, review.decision === 'approved' ? 'Phase-I approved' : 'Phase-I rejected', oosId, review.qa_review_comments);
    return { phase1 };
  } catch (e) {
    console.error('reviewPhase1', e);
    return { error: e instanceof Error ? e.message : 'Failed to review Phase-I' };
  }
}

export async function uploadPhase1Attachment(
  oosId: string,
  file: File,
  category: OosAttachment['category'],
  actor: Phase1Actor,
): Promise<{ attachment?: OosAttachment; error?: string }> {
  try {
    const attachment = await uploadAttachment(oosId, file, category, { id: actor.id, name: actor.name, role: actor.role || '' });
    await audit(actor, 'Phase-I attachment uploaded', oosId, file.name);
    return { attachment };
  } catch (e) {
    console.error('uploadPhase1Attachment', e);
    return { error: e instanceof Error ? e.message : 'Upload failed' };
  }
}

export async function logPhase1PageViewed(oosId: string, actor: Phase1Actor, oosNumber?: string) {
  await audit(actor, 'Phase-I page viewed', oosId, oosNumber);
}
