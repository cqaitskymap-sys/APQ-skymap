import {
  addDoc, collection, doc, getDocs, limit, query, updateDoc, where,
} from 'firebase/firestore';
import { createAuditLog } from '@/lib/audit-trail';
import { getFirebaseFirestore, isFirebaseConfigured } from '@/lib/firebase';
import {
  COMPLAINT_INVESTIGATION_MODULE,
  computeComplaintInvestigationAutoRules,
  type ComplaintInvestigationActor,
} from '@/lib/complaint-investigation-records';
import type { ComplaintInvestigationInput, ComplaintInvestigationQaReviewInput } from '@/lib/complaint-schemas';
import {
  COMPLAINT_COLLECTIONS,
  type ComplaintInvestigation,
  type ComplaintRecord,
} from '@/lib/complaint-types';
import {
  createCapaFromComplaint,
  getAttachments,
  getAuditLogsForComplaint,
  getComplaintById,
  listComplaints,
  updateComplaint,
  uploadAttachment,
} from '@/lib/complaint-service';

export type { ComplaintInvestigationActor };

const nowIso = () => new Date().toISOString();
const today = () => new Date().toISOString().split('T')[0];

async function audit(actor: ComplaintInvestigationActor, actionType: string, complaintId: string, detail?: string) {
  try {
    await createAuditLog({
      moduleName: COMPLAINT_INVESTIGATION_MODULE,
      collectionName: COMPLAINT_COLLECTIONS.investigations,
      recordId: complaintId,
      actionType,
      actionDescription: detail || actionType,
      user: { id: actor.id, name: actor.name, role: actor.role, department: actor.department },
      status: 'Success',
    });
  } catch (e) {
    console.error('complaint investigation audit', e);
  }
}

async function notify(title: string, message: string, complaintId: string, roles: string[]) {
  if (!isFirebaseConfigured()) return;
  try {
    for (const role of roles) {
      await addDoc(collection(getFirebaseFirestore(), COMPLAINT_COLLECTIONS.notifications), {
        title, message, module: 'Complaint', record_id: complaintId, target_role: role, read: false, created_at: nowIso(),
      });
    }
  } catch (e) {
    console.error('complaint investigation notify', e);
  }
}

export async function getComplaintInvestigationRecord(complaintId: string): Promise<ComplaintInvestigation | null> {
  if (!isFirebaseConfigured()) return null;
  try {
    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), COMPLAINT_COLLECTIONS.investigations),
      where('complaint_id', '==', complaintId),
      limit(1),
    ));
    if (snap.empty) return null;
    return { id: snap.docs[0].id, ...snap.docs[0].data() } as ComplaintInvestigation;
  } catch (e) {
    console.error('getComplaintInvestigationRecord', e);
    return null;
  }
}

export async function listOpenComplaintInvestigations(max = 100): Promise<(ComplaintRecord & { investigation?: ComplaintInvestigation | null })[]> {
  if (!isFirebaseConfigured()) return [];
  try {
    const records = (await listComplaints())
      .filter((r) => ['received', 'under_investigation', 'qa_review', 'capa_required', 'recall_evaluation', 'overdue'].includes(r.status));
    const withInv = await Promise.all(records.slice(0, max).map(async (r) => ({
      ...r,
      investigation: await getComplaintInvestigationRecord(r.id),
    })));
    return withInv;
  } catch (e) {
    console.error('listOpenComplaintInvestigations', e);
    return [];
  }
}

export async function fetchComplaintInvestigationPageData(complaintId: string) {
  if (!isFirebaseConfigured()) return { error: 'Firebase is not configured.' };
  try {
    const [record, investigation, attachments, auditLogs] = await Promise.all([
      getComplaintById(complaintId),
      getComplaintInvestigationRecord(complaintId),
      getAttachments(complaintId),
      getAuditLogsForComplaint(complaintId),
    ]);
    if (!record) return { error: 'Complaint not found.' };
    return { record, investigation, attachments, auditLogs };
  } catch (e) {
    console.error('fetchComplaintInvestigationPageData', e);
    return { error: e instanceof Error ? e.message : 'Failed to load investigation data' };
  }
}

function buildInvestigationPayload(
  complaintId: string,
  record: ComplaintRecord,
  input: ComplaintInvestigationInput,
  actor: ComplaintInvestigationActor,
  status: string,
  existing?: ComplaintInvestigation | null,
): Omit<ComplaintInvestigation, 'id'> {
  const ts = nowIso();
  const auto = computeComplaintInvestigationAutoRules(input, record);
  const rootCause = input.root_cause_method === 'No Assignable Cause'
    ? input.qa_justification || 'No assignable cause'
    : input.root_cause || '';

  return {
    complaint_id: complaintId,
    complaint_number: record.complaint_number,
    investigation_start_date: existing?.investigation_start_date || input.investigation_start_date || today(),
    investigation_due_date: input.investigation_due_date || record.due_date || '',
    assigned_investigator: record.assigned_to || actor.id,
    assigned_investigator_name: record.assigned_to_name || actor.name,
    department: 'QA',
    product_name: record.product_name,
    batch_number: record.batch_number,
    customer_complaint_summary: input.customer_complaint_summary || record.complaint_description,
    retain_sample_available: input.retain_sample_available,
    complaint_sample_received: input.complaint_sample_received,
    sample_condition: input.sample_condition,
    batch_record_review: input.batch_record_review,
    qc_result_review: input.qc_result_review,
    stability_data_review: input.stability_data_review,
    manufacturing_process_review: input.manufacturing_process_review,
    packaging_review: input.packaging_review,
    distribution_review: input.distribution_review,
    previous_complaint_review: input.previous_complaint_review,
    root_cause_method: input.root_cause_method,
    investigation_summary: input.investigation_summary,
    findings: input.findings,
    root_cause: rootCause,
    impact_assessment: input.impact_assessment,
    sample_analysis: input.sample_analysis || input.sample_condition,
    batch_review: input.batch_review || input.batch_record_review,
    conclusion: input.conclusion,
    capa_required: input.capa_required || auto.capaRequired,
    recall_evaluation_required: input.recall_evaluation_required || auto.recallEvaluationRequired,
    qa_justification: input.qa_justification,
    investigation_status: status,
    investigated_by: existing?.investigated_by || actor.id,
    investigated_by_name: existing?.investigated_by_name || actor.name,
    investigated_at: ts,
    created_by: existing?.created_by || actor.id,
    created_by_name: existing?.created_by_name || actor.name,
    updated_by: actor.id,
    updated_by_name: actor.name,
    created_at: existing?.created_at || ts,
    updated_at: ts,
  };
}

async function syncComplaintFromInvestigation(
  complaintId: string,
  payload: Omit<ComplaintInvestigation, 'id'>,
  actor: ComplaintInvestigationActor,
  complaintStatus: string,
) {
  await updateComplaint(complaintId, {
    status: complaintStatus,
    root_cause: payload.root_cause,
    impact_assessment: payload.impact_assessment,
    capa_required: payload.capa_required,
    recall_evaluation_required: payload.recall_evaluation_required,
  }, { id: actor.id, name: actor.name, role: actor.role || 'qa' }, true);
}

export async function startComplaintInvestigation(
  complaintId: string,
  actor: ComplaintInvestigationActor,
): Promise<{ investigation?: ComplaintInvestigation; error?: string }> {
  const record = await getComplaintById(complaintId);
  if (!record) return { error: 'Complaint not found' };

  const payload = buildInvestigationPayload(complaintId, record, {
    investigation_start_date: today(),
    investigation_due_date: record.due_date || '',
    customer_complaint_summary: record.complaint_description,
    retain_sample_available: record.retain_sample_required ? 'Yes' : 'No',
    complaint_sample_received: record.sample_received ? 'Yes' : 'No',
    sample_condition: '',
    batch_record_review: '',
    qc_result_review: '',
    stability_data_review: '',
    manufacturing_process_review: '',
    packaging_review: '',
    distribution_review: '',
    previous_complaint_review: '',
    root_cause_method: '5 Why',
    investigation_summary: 'Investigation initiated',
    findings: '',
    root_cause: '',
    impact_assessment: record.impact_assessment || 'Under investigation',
    sample_analysis: '',
    batch_review: '',
    conclusion: '',
    capa_required: false,
    recall_evaluation_required: false,
    qa_justification: '',
  }, actor, 'In Progress');

  try {
    const existing = await getComplaintInvestigationRecord(complaintId);
    let result: ComplaintInvestigation;
    if (existing) {
      await updateDoc(doc(getFirebaseFirestore(), COMPLAINT_COLLECTIONS.investigations, existing.id), payload);
      result = { ...existing, ...payload, id: existing.id };
    } else {
      const ref = await addDoc(collection(getFirebaseFirestore(), COMPLAINT_COLLECTIONS.investigations), payload);
      result = { id: ref.id, ...payload };
    }
    await syncComplaintFromInvestigation(complaintId, payload, actor, 'under_investigation');
    await audit(actor, 'Investigation Started', complaintId, record.complaint_number);
    await notify('Investigation Started', `Complaint ${record.complaint_number} investigation started`, complaintId, ['qa']);
    return { investigation: result };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed to start investigation' };
  }
}

export async function saveComplaintInvestigationDraft(
  complaintId: string,
  input: ComplaintInvestigationInput,
  actor: ComplaintInvestigationActor,
): Promise<{ investigation?: ComplaintInvestigation; error?: string }> {
  const record = await getComplaintById(complaintId);
  if (!record) return { error: 'Complaint not found' };

  const auto = computeComplaintInvestigationAutoRules(input, record);
  if (auto.warnings.some((w) => w.includes('sample condition'))) {
    return { error: 'Sample condition is required when complaint sample was received.' };
  }

  const status = auto.recallEvaluationRequired
    ? 'Recall Evaluation'
    : auto.capaRequired || input.capa_required
      ? 'CAPA Required'
      : 'In Progress';

  const payload = buildInvestigationPayload(
    complaintId,
    record,
    { ...input, capa_required: input.capa_required || auto.capaRequired, recall_evaluation_required: input.recall_evaluation_required || auto.recallEvaluationRequired },
    actor,
    status,
  );

  try {
    const existing = await getComplaintInvestigationRecord(complaintId);
    let result: ComplaintInvestigation;
    if (existing) {
      await updateDoc(doc(getFirebaseFirestore(), COMPLAINT_COLLECTIONS.investigations, existing.id), payload);
      result = { ...existing, ...payload, id: existing.id };
      await audit(actor, 'Investigation Edited', complaintId);
    } else {
      const ref = await addDoc(collection(getFirebaseFirestore(), COMPLAINT_COLLECTIONS.investigations), payload);
      result = { id: ref.id, ...payload };
      await audit(actor, 'Investigation Draft Created', complaintId);
    }

    const complaintStatus = status === 'Recall Evaluation'
      ? 'recall_evaluation'
      : status === 'CAPA Required'
        ? 'capa_required'
        : 'under_investigation';
    await syncComplaintFromInvestigation(complaintId, payload, actor, complaintStatus);

    if (payload.root_cause_method) await audit(actor, 'RCA Updated', complaintId, payload.root_cause_method);
    return { investigation: result };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed to save investigation' };
  }
}

export async function submitComplaintInvestigationForQaReview(
  complaintId: string,
  input: ComplaintInvestigationInput,
  actor: ComplaintInvestigationActor,
): Promise<{ investigation?: ComplaintInvestigation; error?: string }> {
  const record = await getComplaintById(complaintId);
  if (!record) return { error: 'Complaint not found' };

  const auto = computeComplaintInvestigationAutoRules(input, record);
  if (auto.warnings.some((w) => w.includes('sample condition'))) {
    return { error: 'Sample condition is required when complaint sample was received.' };
  }
  if (auto.warnings.some((w) => w.includes('QA justification'))) {
    return { error: 'QA justification is required for no assignable cause.' };
  }
  if (!input.root_cause?.trim() && input.root_cause_method !== 'No Assignable Cause') {
    return { error: 'Root cause is required before submitting for QA review' };
  }
  if (!input.conclusion?.trim()) {
    return { error: 'Final investigation conclusion is required before submitting for QA review' };
  }

  const draft = await saveComplaintInvestigationDraft(complaintId, input, actor);
  if (draft.error || !draft.investigation) return draft;

  try {
    const payload = {
      investigation_status: 'QA Review',
      updated_at: nowIso(),
      updated_by: actor.id,
      updated_by_name: actor.name,
    };
    await updateDoc(doc(getFirebaseFirestore(), COMPLAINT_COLLECTIONS.investigations, draft.investigation.id), payload);
    await syncComplaintFromInvestigation(complaintId, draft.investigation, actor, 'qa_review');
    await audit(actor, 'Investigation Submitted for QA Review', complaintId);
    await notify('Complaint Investigation QA Review', `${record.complaint_number} submitted for QA review`, complaintId, ['qa_manager', 'head_qa']);
    if (auto.notifyHeadQa) {
      await notify('Critical Complaint Investigation', `${record.complaint_number} requires Head QA review`, complaintId, ['head_qa']);
    }
    return { investigation: { ...draft.investigation, ...payload } };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Submit failed' };
  }
}

export async function reviewComplaintInvestigation(
  complaintId: string,
  input: ComplaintInvestigationQaReviewInput,
  actor: ComplaintInvestigationActor,
  record: ComplaintRecord,
): Promise<{ investigation?: ComplaintInvestigation; error?: string }> {
  if (input.decision === 'rejected' && !input.qa_comments.trim()) {
    return { error: 'QA comments are required for rejection' };
  }

  const inv = await getComplaintInvestigationRecord(complaintId);
  if (!inv) return { error: 'Investigation record not found' };

  const status = input.decision === 'approved'
    ? (inv.recall_evaluation_required ? 'Recall Evaluation' : inv.capa_required ? 'CAPA Required' : 'Completed')
    : 'Rejected';

  try {
    const payload = {
      investigation_status: status,
      qa_review_comments: input.qa_comments,
      reviewed_by_qa: actor.id,
      reviewed_by_qa_name: actor.name,
      qa_review_date: nowIso(),
      updated_at: nowIso(),
      updated_by: actor.id,
      updated_by_name: actor.name,
    };
    await updateDoc(doc(getFirebaseFirestore(), COMPLAINT_COLLECTIONS.investigations, inv.id), payload);

    const complaintStatus = input.decision === 'approved'
      ? (inv.recall_evaluation_required ? 'recall_evaluation' : inv.capa_required ? 'capa_required' : 'qa_review')
      : 'rejected';
    await syncComplaintFromInvestigation(complaintId, { ...inv, ...payload }, actor, complaintStatus);

    await audit(actor, input.decision === 'approved' ? 'Investigation QA Approved' : 'Investigation QA Rejected', complaintId, input.qa_comments);

    if (input.decision === 'approved' && inv.capa_required && !record.linked_capa_id) {
      try {
        await createCapaFromComplaint(complaintId, { id: actor.id, name: actor.name, role: actor.role || 'qa' });
      } catch (e) {
        console.error('createCapaFromComplaint on approve', e);
      }
    }

    return { investigation: { ...inv, ...payload } };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'QA review failed' };
  }
}

export async function saveInvestigation(
  complaintId: string,
  data: ComplaintInvestigationInput,
  actor: ComplaintInvestigationActor,
): Promise<ComplaintInvestigation> {
  const result = await saveComplaintInvestigationDraft(complaintId, data, actor);
  if (result.error || !result.investigation) throw new Error(result.error || 'Failed to save investigation');
  return result.investigation;
}

export { uploadAttachment, getAttachments, getAuditLogsForComplaint, createCapaFromComplaint };
