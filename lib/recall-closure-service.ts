import {
  addDoc, collection, doc, getDoc, getDocs, limit, query, updateDoc, where,
} from 'firebase/firestore';
import { createAuditLog } from '@/lib/audit-trail';
import { getCapaById } from '@/lib/capa-service';
import { getFirebaseFirestore } from '@/lib/firebase';
import type { RecallClosureDraftInput, RecallClosureFormInput, RecallReopenInput } from '@/lib/recall-closure-schemas';
import {
  buildClosureId,
  computeRecallClosureReadiness,
  mapRecallClosureAuditAction,
  RECALL_CLOSURE_MODULE,
  type RecallClosureActor,
  type RecallClosureReadiness,
} from '@/lib/recall-closure-records';
import { getRegulatoryNotificationByRecallId } from '@/lib/recall-regulatory-service';
import { getRecallDistributions, getRecallRecoveries } from '@/lib/recall-recovery-service';
import { getRecallById, listRecalls } from '@/lib/recall-service';
import {
  calcPendingQuantity,
  getRecallRecoveryPercent,
  requiresClassIApproval,
  type RecallClosure,
  type RecallClosureTimelineEntry,
  type RecallRecord,
  RECALL_COLLECTIONS,
} from '@/lib/recall-types';

export type { RecallClosureActor, RecallClosureReadiness };

const now = () => new Date().toISOString();
const today = () => new Date().toISOString().split('T')[0];

async function audit(
  actor: RecallClosureActor,
  actionType: string,
  recallId: string,
  detail: string,
  oldValue?: unknown,
  newValue?: unknown,
) {
  try {
    await createAuditLog({
      moduleName: RECALL_CLOSURE_MODULE,
      collectionName: RECALL_COLLECTIONS.closure,
      recordId: recallId,
      actionType,
      actionDescription: detail,
      reason: detail,
      oldValue,
      newValue,
      user: { id: actor.id, name: actor.name, role: actor.role },
      status: 'Success',
    });
  } catch (e) {
    console.error('recall closure audit', e);
  }
}

async function notify(title: string, message: string, recallId: string, roles: string[]) {
  try {
    for (const role of roles) {
      await addDoc(collection(getFirebaseFirestore(), RECALL_COLLECTIONS.notifications), {
        title, message, module: RECALL_CLOSURE_MODULE, record_id: recallId, target_role: role, read: false, created_at: now(),
      });
    }
  } catch (e) {
    console.error('recall closure notify', e);
  }
}

export async function getRecallClosure(recallId: string): Promise<RecallClosure | null> {
  const snap = await getDocs(query(
    collection(getFirebaseFirestore(), RECALL_COLLECTIONS.closure),
    where('recall_id', '==', recallId),
    limit(1),
  ));
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() } as RecallClosure;
}

async function buildClosureContext(recallId: string) {
  const recall = await getRecallById(recallId);
  if (!recall) return null;

  const [distributions, recoveries, regulatory, capa] = await Promise.all([
    getRecallDistributions(recallId),
    getRecallRecoveries(recallId),
    getRegulatoryNotificationByRecallId(recallId),
    recall.linked_capa_id ? getCapaById(recall.linked_capa_id) : Promise.resolve(null),
  ]);

  const distributed = distributions.reduce((s, d) => s + d.quantity_distributed, 0) || recall.distributed_quantity || 0;
  const recovered = recoveries.reduce((s, r) => s + r.quantity_recovered, 0) || recall.recovered_quantity || 0;
  const recoveryPercent = getRecallRecoveryPercent({ ...recall, distributed_quantity: distributed, recovered_quantity: recovered });
  const pendingQty = calcPendingQuantity(distributed, recovered);

  return { recall, distributions, recoveries, regulatory, capa, distributed, recovered, recoveryPercent, pendingQty };
}

function buildDefaultForm(closure: RecallClosure | null, ctx: NonNullable<Awaited<ReturnType<typeof buildClosureContext>>>): RecallClosureDraftInput {
  return {
    pending_quantity_justification: closure?.pending_quantity_justification || '',
    customer_communication_completed: closure?.customer_communication_completed ?? false,
    product_disposal_completed: closure?.product_disposal_completed ?? false,
    qa_closure_comments: closure?.qa_closure_comments || '',
    head_qa_comments: closure?.head_qa_comments || '',
    final_recall_conclusion: closure?.final_recall_conclusion || ctx.recall.reason_for_recall || '',
  };
}

function mapReadinessToClosureFields(
  ctx: NonNullable<Awaited<ReturnType<typeof buildClosureContext>>>,
  readiness: RecallClosureReadiness,
  form: RecallClosureDraftInput,
  actor: RecallClosureActor,
  existing?: RecallClosure | null,
): Omit<RecallClosure, 'id'> {
  return {
    closure_id: existing?.closure_id || buildClosureId(ctx.recall.recall_number),
    recall_id: ctx.recall.id,
    recall_number: ctx.recall.recall_number,
    closure_date: existing?.closure_date || null,
    closed_by: existing?.closed_by || '',
    closed_by_name: existing?.closed_by_name || '',
    recovery_completed: readiness.items.find((i) => i.key === 'recovery')?.complete ?? false,
    final_recovery_percent: ctx.recoveryPercent,
    pending_quantity: ctx.pendingQty,
    pending_quantity_justification: form.pending_quantity_justification || '',
    regulatory_notification_completed: readiness.items.find((i) => i.key === 'regulatory')?.complete ?? false,
    authority_response_completed: readiness.items.find((i) => i.key === 'authority_response')?.complete ?? false,
    capa_required: ctx.recall.capa_required,
    capa_linked: readiness.items.find((i) => i.key === 'capa_linked')?.complete ?? false,
    capa_completed: readiness.items.find((i) => i.key === 'capa_closed')?.complete ?? false,
    effectiveness_review_completed: readiness.items.find((i) => i.key === 'effectiveness')?.complete ?? false,
    customer_communication_completed: form.customer_communication_completed,
    product_disposal_completed: form.product_disposal_completed,
    final_recall_conclusion: form.final_recall_conclusion || '',
    qa_closure_comments: form.qa_closure_comments || '',
    head_qa_comments: form.head_qa_comments || '',
    closure_status: readiness.ready ? 'Ready For Closure' : 'Pending',
    e_signature_required: true,
    signed_by: existing?.signed_by || '',
    signed_by_name: existing?.signed_by_name || '',
    signed_date: existing?.signed_date || null,
    readiness_percent: readiness.percent,
    created_at: existing?.created_at || now(),
    updated_at: now(),
    created_by: existing?.created_by || actor.id,
    created_by_name: existing?.created_by_name || actor.name,
    updated_by: actor.id,
    updated_by_name: actor.name,
  };
}

export async function fetchRecallClosurePageData(recallId: string, formOverride?: Partial<RecallClosureDraftInput>) {
  try {
    const ctx = await buildClosureContext(recallId);
    if (!ctx) return { error: 'Recall not found' };

    const closure = await getRecallClosure(recallId);
    const formDefaults = { ...buildDefaultForm(closure, ctx), ...formOverride };
    const readiness = computeRecallClosureReadiness({
      recall: ctx.recall,
      distributions: ctx.distributions,
      recoveries: ctx.recoveries,
      regulatory: ctx.regulatory,
      capa: ctx.capa,
      form: formDefaults,
    });

    const auditSnap = await getDocs(query(
      collection(getFirebaseFirestore(), 'audit_trail'),
      where('recordId', '==', recallId),
      limit(100),
    ));
    const auditLogs = auditSnap.docs
      .map((d) => ({ id: d.id, ...d.data() } as Record<string, unknown>))
      .filter((l) => String(l.moduleName || '').includes('Recall'));

    const timeline: RecallClosureTimelineEntry[] = [
      ...(closure ? [{ date: closure.created_at, title: 'Closure checklist initialized', description: closure.closure_id, user: closure.created_by_name }] : []),
      ...auditLogs.map((l) => ({
        date: String(l.timestamp || l.dateTime || ''),
        title: mapRecallClosureAuditAction(String(l.actionType || '')),
        description: String(l.actionDescription || l.reason || ''),
        user: String(l.userName || (l.user as { name?: string } | undefined)?.name || ''),
      })),
    ].filter((e) => e.date).sort((a, b) => b.date.localeCompare(a.date));

    return {
      record: ctx.recall,
      closure,
      readiness,
      formDefaults,
      distributions: ctx.distributions,
      recoveries: ctx.recoveries,
      regulatory: ctx.regulatory,
      capa: ctx.capa,
      recoverySummary: {
        distributed: ctx.distributed,
        recovered: ctx.recovered,
        pending: ctx.pendingQty,
        percent: ctx.recoveryPercent,
      },
      timeline,
      auditLogs,
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed to load closure data' };
  }
}

export async function fetchRecallClosureDashboardData() {
  const recalls = await listRecalls();
  const active = recalls.filter((r) => !['draft', 'cancelled'].includes(r.recall_status));
  const withClosure = await Promise.all(active.map(async (r) => ({
    ...r,
    closure: await getRecallClosure(r.id),
  })));
  return {
    all: withClosure,
    ready: withClosure.filter((r) => r.closure?.closure_status === 'Ready For Closure'),
    qaReview: withClosure.filter((r) => r.closure?.closure_status === 'QA Review'),
    closed: withClosure.filter((r) => r.recall_status === 'closed' || r.closure?.closure_status === 'Closed'),
  };
}

export async function saveRecallClosureDraft(
  recallId: string,
  form: RecallClosureDraftInput,
  actor: RecallClosureActor,
): Promise<{ closure?: RecallClosure; error?: string }> {
  try {
    const ctx = await buildClosureContext(recallId);
    if (!ctx) return { error: 'Recall not found' };

    const existing = await getRecallClosure(recallId);
    const readiness = computeRecallClosureReadiness({
      recall: ctx.recall,
      distributions: ctx.distributions,
      recoveries: ctx.recoveries,
      regulatory: ctx.regulatory,
      capa: ctx.capa,
      form,
    });
    const payload = mapReadinessToClosureFields(ctx, readiness, form, actor, existing);

    let result: RecallClosure;
    if (existing) {
      await updateDoc(doc(getFirebaseFirestore(), RECALL_COLLECTIONS.closure, existing.id), payload);
      result = { ...existing, ...payload };
    } else {
      const ref = await addDoc(collection(getFirebaseFirestore(), RECALL_COLLECTIONS.closure), payload);
      result = { id: ref.id, ...payload };
      await audit(actor, 'CLOSURE_CHECKLIST_GENERATED', recallId, `Closure checklist ${payload.closure_id} generated`);
    }

    await audit(actor, 'CLOSURE_READINESS_CHECKED', recallId, `Readiness ${readiness.percent}%`, existing, readiness);
    return { closure: result };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed to save closure draft' };
  }
}

export async function submitRecallClosureForQaReview(
  recallId: string,
  form: RecallClosureFormInput,
  actor: RecallClosureActor,
): Promise<{ error?: string }> {
  const draft = await saveRecallClosureDraft(recallId, form, actor);
  if (draft.error || !draft.closure) return { error: draft.error || 'Failed to save' };

  const ctx = await buildClosureContext(recallId);
  if (!ctx) return { error: 'Recall not found' };

  const readiness = computeRecallClosureReadiness({
    recall: ctx.recall,
    distributions: ctx.distributions,
    recoveries: ctx.recoveries,
    regulatory: ctx.regulatory,
    capa: ctx.capa,
    form,
  });

  if (ctx.recoveryPercent < 100 && !form.pending_quantity_justification?.trim()) {
    return { error: 'Pending quantity justification is required when recovery is below 100%' };
  }
  if (!readiness.ready) return { error: `Not ready for closure: ${readiness.blockers.join('; ')}` };

  const status = requiresClassIApproval(ctx.recall.recall_classification) ? 'Head QA Review' : 'QA Review';
  await updateDoc(doc(getFirebaseFirestore(), RECALL_COLLECTIONS.closure, draft.closure.id), {
    closure_status: status,
    qa_closure_comments: form.qa_closure_comments,
    final_recall_conclusion: form.final_recall_conclusion,
    updated_at: now(),
    updated_by: actor.id,
    updated_by_name: actor.name,
  });

  await audit(actor, 'RECOVERY_SUMMARY_REVIEWED', recallId, `Recovery ${ctx.recoveryPercent}% reviewed`);
  await audit(actor, 'REGULATORY_SUMMARY_REVIEWED', recallId, 'Regulatory summary reviewed');
  await audit(actor, 'CAPA_SUMMARY_REVIEWED', recallId, 'CAPA summary reviewed');
  await notify('Recall Closure QA Review', `Recall ${ctx.recall.recall_number} submitted for closure review`, recallId, ['head_qa', 'qa']);

  return {};
}

export async function closeRecallWithClosure(
  recallId: string,
  form: RecallClosureFormInput,
  eSignature: string,
  actor: RecallClosureActor,
): Promise<{ error?: string }> {
  if (!form.qa_closure_comments?.trim()) return { error: 'QA closure comments are required' };
  if (!form.final_recall_conclusion?.trim()) return { error: 'Final recall conclusion is required' };

  const ctx = await buildClosureContext(recallId);
  if (!ctx) return { error: 'Recall not found' };

  if (requiresClassIApproval(ctx.recall.recall_classification) && !ctx.recall.head_qa_approved) {
    return { error: 'Class I recall requires Head QA approval before closure' };
  }

  const draft = await saveRecallClosureDraft(recallId, form, actor);
  if (draft.error || !draft.closure) return { error: draft.error || 'Failed to save' };

  const readiness = computeRecallClosureReadiness({
    recall: ctx.recall,
    distributions: ctx.distributions,
    recoveries: ctx.recoveries,
    regulatory: ctx.regulatory,
    capa: ctx.capa,
    form,
  });

  if (ctx.recoveryPercent < 100 && !form.pending_quantity_justification?.trim()) {
    return { error: 'Pending quantity justification is required when recovery is below 100%' };
  }
  if (!readiness.ready) return { error: `Not ready for closure: ${readiness.blockers.join('; ')}` };

  const eSignRequired = draft.closure.e_signature_required !== false;
  if (eSignRequired && !eSignature.trim()) return { error: 'E-signature is required for closure' };

  const closurePayload = {
    closure_date: today(),
    closed_by: actor.id,
    closed_by_name: actor.name,
    closure_status: 'Closed',
    qa_closure_comments: form.qa_closure_comments,
    head_qa_comments: form.head_qa_comments || '',
    final_recall_conclusion: form.final_recall_conclusion,
    pending_quantity_justification: form.pending_quantity_justification || '',
    signed_by: actor.id,
    signed_by_name: actor.name,
    signed_date: today(),
    final_recovery_percent: ctx.recoveryPercent,
    updated_at: now(),
    updated_by: actor.id,
    updated_by_name: actor.name,
  };

  await updateDoc(doc(getFirebaseFirestore(), RECALL_COLLECTIONS.closure, draft.closure.id), closurePayload);

  await updateDoc(doc(getFirebaseFirestore(), RECALL_COLLECTIONS.records, recallId), {
    recall_status: 'closed',
    recovery_percent: ctx.recoveryPercent,
    recovered_quantity: ctx.recovered,
    distributed_quantity: ctx.distributed,
    qa_remarks: form.qa_closure_comments,
    updated_by: actor.id,
    updated_by_name: actor.name,
    updated_at: now(),
  });

  if (eSignature) {
    try {
      await addDoc(collection(getFirebaseFirestore(), 'esign_records'), {
        module: RECALL_CLOSURE_MODULE,
        record_id: recallId,
        document_number: draft.closure.closure_id,
        signed_by: actor.id,
        signed_by_name: actor.name,
        signature: eSignature,
        signed_at: now(),
      });
      await audit(actor, 'ESIGN_SUCCESS', recallId, 'E-signature applied for recall closure');
    } catch (e) {
      await audit(actor, 'ESIGN_FAILED', recallId, e instanceof Error ? e.message : 'E-signature failed');
    }
  }

  await audit(actor, 'RECALL_CLOSED', recallId, `Recall ${ctx.recall.recall_number} closed`, draft.closure, closurePayload);
  await notify('Recall Closed', `Recall ${ctx.recall.recall_number} has been closed`, recallId, ['qa', 'head_qa', 'regulatory_affairs']);

  return {};
}

export async function rejectRecallClosure(
  recallId: string,
  reason: string,
  actor: RecallClosureActor,
): Promise<{ error?: string }> {
  const closure = await getRecallClosure(recallId);
  if (!closure) return { error: 'Closure record not found' };

  await updateDoc(doc(getFirebaseFirestore(), RECALL_COLLECTIONS.closure, closure.id), {
    closure_status: 'Rejected',
    qa_closure_comments: reason,
    updated_at: now(),
    updated_by: actor.id,
    updated_by_name: actor.name,
  });

  await audit(actor, 'CLOSURE_REJECTED', recallId, reason);
  return {};
}

export async function reopenRecallClosure(
  recallId: string,
  input: RecallReopenInput,
  actor: RecallClosureActor,
): Promise<{ error?: string }> {
  if (!input.reopen_reason?.trim()) return { error: 'Reopen reason is required' };
  if (!input.e_signature?.trim()) return { error: 'E-signature is required to reopen recall' };

  const closure = await getRecallClosure(recallId);
  const recall = await getRecallById(recallId);
  if (!recall) return { error: 'Recall not found' };

  if (closure) {
    await updateDoc(doc(getFirebaseFirestore(), RECALL_COLLECTIONS.closure, closure.id), {
      closure_status: 'Reopened',
      closure_date: null,
      updated_at: now(),
      updated_by: actor.id,
      updated_by_name: actor.name,
    });
  }

  await updateDoc(doc(getFirebaseFirestore(), RECALL_COLLECTIONS.records, recallId), {
    recall_status: 'recovery_in_progress',
    updated_by: actor.id,
    updated_by_name: actor.name,
    updated_at: now(),
  });

  try {
    await addDoc(collection(getFirebaseFirestore(), 'esign_records'), {
      module: RECALL_CLOSURE_MODULE,
      record_id: recallId,
      action: 'Reopen',
      signed_by: actor.id,
      signed_by_name: actor.name,
      signature: input.e_signature,
      reason: input.reopen_reason,
      signed_at: now(),
    });
  } catch { /* optional */ }

  await audit(actor, 'RECALL_REOPENED', recallId, input.reopen_reason);
  await notify('Recall Reopened', `Recall ${recall.recall_number} reopened: ${input.reopen_reason}`, recallId, ['head_qa', 'qa']);

  return {};
}

export async function logRecallClosureEsignResult(
  recallId: string,
  actor: RecallClosureActor,
  success: boolean,
  detail?: string,
) {
  await audit(actor, success ? 'ESIGN_SUCCESS' : 'ESIGN_FAILED', recallId, detail || 'E-signature attempt');
}
