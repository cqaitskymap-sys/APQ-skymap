import {
  collection, doc, addDoc, getDocs, updateDoc, query, where, limit, orderBy, writeBatch,
} from 'firebase/firestore';
import { getFirebaseFirestore, isFirebaseConfigured } from '@/lib/firebase';
import { createAuditLog, writeAuditTrail } from '@/lib/audit-trail';
import { fetchActiveMatrixForModule } from '@/lib/admin/approval-matrix-service';
import type { PqrOption } from '@/lib/pqr-batch-review-records';
import { fetchPqrOptions, fetchPqrById } from '@/lib/pqr-batch-review-service';
import { fetchSummaryConclusionRecord } from '@/lib/pqr-summary-conclusion-service';
import {
  PQR_APPROVAL_COLLECTIONS,
  PQR_APPROVAL_MODULE,
  DEFAULT_PQR_WORKFLOW_STEPS,
  getCurrentPendingStep,
  mapWorkflowStatusForStep,
  type PqrApprovalHistoryEntry,
  type PqrApprovalRecord,
  type PqrWorkflowStepDef,
} from '@/lib/pqr-approval-records';

export type PqrApprovalActor = { id: string; name: string; role?: string; email?: string };

export { fetchPqrOptions, fetchPqrById };

const nowIso = () => new Date().toISOString();
const str = (v: unknown, fb = '') => (v === null || v === undefined ? fb : String(v));

function buildApprovalId(pqrNumber: string, level: number) {
  return `PAP-${pqrNumber.replace(/\s+/g, '-')}-L${level}-${Date.now().toString(36).toUpperCase()}`;
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
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

async function logApprovalAudit(
  actionType: string,
  actor: PqrApprovalActor,
  detail?: unknown,
  recordId = 'pqr-approval',
) {
  try {
    await createAuditLog({
      moduleName: PQR_APPROVAL_MODULE,
      collectionName: PQR_APPROVAL_COLLECTIONS.approvals,
      recordId,
      actionType,
      newValue: detail,
      user: { id: actor.id, name: actor.name },
      status: 'Success',
    });
    await writeAuditTrail({
      collectionName: PQR_APPROVAL_COLLECTIONS.approvals,
      documentId: recordId,
      action: actionType,
      oldValue: null,
      newValue: detail,
      userId: actor.id,
      userName: actor.name,
      moduleName: PQR_APPROVAL_MODULE,
    });
  } catch (e) {
    console.error('logApprovalAudit failed', e);
  }
}

async function saveHistory(
  entry: Omit<PqrApprovalHistoryEntry, 'id'>,
  actor: PqrApprovalActor,
) {
  try {
    await addDoc(collection(getFirebaseFirestore(), PQR_APPROVAL_COLLECTIONS.approvalHistory), {
      ...entry,
      createdBy: actor.id,
      isDeleted: false,
    });
  } catch (e) {
    console.error('saveHistory failed', e);
  }
}

async function createNotification(
  userId: string,
  title: string,
  message: string,
  pqrId: string,
) {
  if (!isFirebaseConfigured() || !userId) return;
  try {
    await addDoc(collection(getFirebaseFirestore(), PQR_APPROVAL_COLLECTIONS.notifications), {
      userId,
      title,
      message,
      module: PQR_APPROVAL_MODULE,
      recordId: pqrId,
      read: false,
      createdAt: nowIso(),
      isDeleted: false,
    });
  } catch (e) {
    console.error('createNotification failed', e);
  }
}

async function updatePqrRecordStatus(
  pqrId: string,
  updates: Record<string, unknown>,
  actor: PqrApprovalActor,
) {
  if (!isFirebaseConfigured()) return;
  const ts = nowIso();
  const payload = { ...updates, updatedAt: ts, updatedBy: actor.id };
  for (const coll of [PQR_APPROVAL_COLLECTIONS.records, PQR_APPROVAL_COLLECTIONS.recordsLegacy]) {
    try {
      await updateDoc(doc(getFirebaseFirestore(), coll, pqrId), payload);
      return;
    } catch {
      // try next collection
    }
  }
}

async function lockPqrSections(pqrId: string, actor: PqrApprovalActor) {
  if (!isFirebaseConfigured()) return;
  try {
    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), PQR_APPROVAL_COLLECTIONS.sections),
      where('pqrId', '==', pqrId),
    ));
    const batch = writeBatch(getFirebaseFirestore());
    snap.docs.forEach((d) => {
      batch.update(d.ref, { status: 'Locked', updatedAt: nowIso(), updatedBy: actor.id });
    });
    await batch.commit();
  } catch (e) {
    console.error('lockPqrSections failed', e);
  }
}

export async function resolveWorkflowSteps(pqr: PqrOption): Promise<PqrWorkflowStepDef[]> {
  try {
    const matrix = await fetchActiveMatrixForModule('PQR') || await fetchActiveMatrixForModule('Product Quality Review');
    if (matrix) {
      return [
        { level: 1, approvalType: 'Prepared By', approverRole: (matrix.preparedByRole || 'qa_executive').toLowerCase().replace(/\s+/g, '_'), stepName: 'Prepared By', designation: matrix.preparedByRole || 'QA Executive', dueDays: 7, eSignatureRequired: matrix.eSignatureRequired !== false, commentRequired: false },
        { level: 2, approvalType: 'Reviewed By', approverRole: (matrix.reviewedByRole || 'qa_manager').toLowerCase().replace(/\s+/g, '_'), stepName: 'QA Review', designation: matrix.reviewedByRole || 'QA Manager', dueDays: 7, eSignatureRequired: matrix.eSignatureRequired !== false, commentRequired: matrix.approvalCommentRequired !== false },
        { level: 3, approvalType: 'Reviewed By', approverRole: 'qc_manager', stepName: 'QC Review', designation: 'QC Manager', dueDays: 7, eSignatureRequired: matrix.eSignatureRequired !== false, commentRequired: true },
        { level: 4, approvalType: 'Reviewed By', approverRole: 'production_manager', stepName: 'Production Review', designation: 'Production Manager', dueDays: 7, eSignatureRequired: matrix.eSignatureRequired !== false, commentRequired: true },
        { level: 5, approvalType: 'Reviewed By', approverRole: 'warehouse_manager', stepName: 'Warehouse Review', designation: 'Warehouse Manager', dueDays: 7, eSignatureRequired: matrix.eSignatureRequired !== false, commentRequired: true },
        { level: 6, approvalType: 'Reviewed By', approverRole: 'engineering', stepName: 'Engineering Review', designation: 'Engineering Manager', dueDays: 7, eSignatureRequired: matrix.eSignatureRequired !== false, commentRequired: true },
        { level: 7, approvalType: 'Final Approved By', approverRole: (matrix.finalApproverRole || 'head_qa').toLowerCase().replace(/\s+/g, '_'), stepName: 'Head QA Approval', designation: matrix.finalApproverRole || 'Head QA', dueDays: 10, eSignatureRequired: matrix.eSignatureRequired !== false, commentRequired: true },
      ];
    }
  } catch (e) {
    console.error('resolveWorkflowSteps matrix failed', e);
  }
  return DEFAULT_PQR_WORKFLOW_STEPS;
}

export async function validatePqrForSubmission(pqrId: string): Promise<{ valid: boolean; errors: string[] }> {
  const errors: string[] = [];
  if (!isFirebaseConfigured()) return { valid: false, errors: ['Firebase is not configured.'] };

  try {
    const sectionsSnap = await getDocs(query(
      collection(getFirebaseFirestore(), PQR_APPROVAL_COLLECTIONS.sections),
      where('pqrId', '==', pqrId),
      where('isDeleted', '==', false),
    ));
    const sections = sectionsSnap.docs.map((d) => d.data());
    const requiredKeys = ['batch_manufacturing', 'summary_conclusion'];
    requiredKeys.forEach((key) => {
      const found = sections.some((s) => s.sectionKey === key && s.included !== false);
      if (!found) errors.push(`Required section missing: ${key.replace(/_/g, ' ')}`);
    });

    const summary = await fetchSummaryConclusionRecord(pqrId);
    if (!summary?.executiveSummary?.trim()) errors.push('Executive Summary is required before submission.');
    if (!summary?.finalConclusion?.trim()) errors.push('Final Conclusion is required before submission.');

    const existing = await fetchApprovalRecords(pqrId);
    const inProgress = existing.some((a) =>
      !a.isDeleted && ['Pending', 'In Review', 'Escalated'].includes(a.approvalStatus)
      && a.workflowStatus !== 'Rejected' && a.workflowStatus !== 'Sent Back',
    );
    if (inProgress && existing.some((a) => a.workflowStatus === 'Approved')) {
      errors.push('PQR is already approved.');
    }
  } catch (e) {
    errors.push((e as Error).message);
  }

  return { valid: errors.length === 0, errors };
}

function stepToRecord(
  step: PqrWorkflowStepDef,
  pqr: PqrOption,
  actor: PqrApprovalActor,
  isFirst: boolean,
): Omit<PqrApprovalRecord, 'id'> {
  const ts = nowIso();
  return {
    approvalId: buildApprovalId(pqr.pqrNumber, step.level),
    pqrId: pqr.id,
    pqrNumber: pqr.pqrNumber,
    product: pqr.productName,
    productCode: pqr.productCode,
    reviewPeriodFrom: pqr.reviewPeriodFrom?.slice(0, 10) || '',
    reviewPeriodTo: pqr.reviewPeriodTo?.slice(0, 10) || '',
    currentWorkflowStep: step.stepName,
    currentApproverRole: step.approverRole,
    currentApproverUser: isFirst ? actor.id : '',
    approvalLevel: step.level,
    approvalType: step.approvalType,
    approvalStatus: isFirst ? 'In Review' : 'Pending',
    approvalComments: '',
    rejectionReason: '',
    sendBackReason: '',
    eSignatureRequired: step.eSignatureRequired,
    eSignatureStatus: isFirst ? 'Required' : 'Not Required',
    signedBy: '',
    signedDate: '',
    dueDate: addDays(ts, step.dueDays),
    completedDate: '',
    escalationStatus: 'None',
    priority: step.level >= 7 ? 'High' : 'Normal',
    remarks: '',
    workflowStatus: isFirst ? mapWorkflowStatusForStep(step) : 'Under Review',
    createdAt: ts,
    updatedAt: ts,
    createdBy: actor.id,
    updatedBy: actor.id,
    createdByName: actor.name,
    updatedByName: actor.name,
    isDeleted: false,
  };
}

export async function fetchApprovalRecords(pqrId: string): Promise<PqrApprovalRecord[]> {
  if (!isFirebaseConfigured()) return [];
  try {
    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), PQR_APPROVAL_COLLECTIONS.approvals),
      where('pqrId', '==', pqrId),
      where('isDeleted', '==', false),
    ));
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() } as PqrApprovalRecord))
      .sort((a, b) => a.approvalLevel - b.approvalLevel);
  } catch {
    try {
      const snap = await getDocs(query(
        collection(getFirebaseFirestore(), PQR_APPROVAL_COLLECTIONS.approvals),
        where('pqrId', '==', pqrId),
      ));
      return snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as PqrApprovalRecord))
        .filter((r) => !r.isDeleted)
        .sort((a, b) => a.approvalLevel - b.approvalLevel);
    } catch (e) {
      console.error('fetchApprovalRecords failed', e);
      return [];
    }
  }
}

export async function fetchAllApprovalRecords(): Promise<PqrApprovalRecord[]> {
  if (!isFirebaseConfigured()) return [];
  try {
    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), PQR_APPROVAL_COLLECTIONS.approvals),
      where('isDeleted', '==', false),
      orderBy('updatedAt', 'desc'),
      limit(500),
    ));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as PqrApprovalRecord));
  } catch {
    const rows = await readCollection(PQR_APPROVAL_COLLECTIONS.approvals);
    return rows.filter((r) => !r.isDeleted).map((r) => r as unknown as PqrApprovalRecord);
  }
}

export async function fetchApprovalHistory(pqrId?: string): Promise<PqrApprovalHistoryEntry[]> {
  if (!isFirebaseConfigured()) return [];
  try {
    const q = pqrId
      ? query(collection(getFirebaseFirestore(), PQR_APPROVAL_COLLECTIONS.approvalHistory), where('pqrId', '==', pqrId), where('isDeleted', '==', false))
      : query(collection(getFirebaseFirestore(), PQR_APPROVAL_COLLECTIONS.approvalHistory), where('isDeleted', '==', false), orderBy('createdAt', 'desc'), limit(500));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as PqrApprovalHistoryEntry));
  } catch {
    const rows = await readCollection(PQR_APPROVAL_COLLECTIONS.approvalHistory);
    return rows
      .filter((r) => !r.isDeleted && (!pqrId || r.pqrId === pqrId))
      .map((r) => r as unknown as PqrApprovalHistoryEntry);
  }
}

export async function submitPqrForApproval(
  pqr: PqrOption,
  actor: PqrApprovalActor,
): Promise<{ error?: string; created?: number }> {
  if (!isFirebaseConfigured()) return { error: 'Firebase is not configured.' };

  const validation = await validatePqrForSubmission(pqr.id);
  if (!validation.valid) return { error: validation.errors.join(' ') };

  try {
    await logApprovalAudit('PQR submitted', actor, { pqrId: pqr.id }, pqr.id);

    const existing = await fetchApprovalRecords(pqr.id);
    if (existing.length) {
      const batch = writeBatch(getFirebaseFirestore());
      existing.forEach((r) => {
        if (r.id) batch.update(doc(getFirebaseFirestore(), PQR_APPROVAL_COLLECTIONS.approvals, r.id), { isDeleted: true, updatedAt: nowIso() });
      });
      await batch.commit();
    }

    const steps = await resolveWorkflowSteps(pqr);
    const batch = writeBatch(getFirebaseFirestore());
    let created = 0;
    steps.forEach((step, i) => {
      const record = stepToRecord(step, pqr, actor, i === 0);
      batch.set(doc(collection(getFirebaseFirestore(), PQR_APPROVAL_COLLECTIONS.approvals)), record);
      created += 1;
    });
    await batch.commit();

    await updatePqrRecordStatus(pqr.id, {
      status: 'Under Review',
      workflowStatus: 'Under Review',
      currentWorkflowStep: steps[0]?.stepName,
      submittedAt: nowIso(),
      submittedBy: actor.id,
      locked: false,
    }, actor);

    await saveHistory({
      pqrId: pqr.id,
      pqrNumber: pqr.pqrNumber,
      approvalId: buildApprovalId(pqr.pqrNumber, 0),
      action: 'PQR submitted',
      approvalType: 'Prepared By',
      userId: actor.id,
      userName: actor.name,
      userRole: actor.role || '',
      comments: 'Submitted for approval workflow',
      eSignatureStatus: 'N/A',
      createdAt: nowIso(),
      createdBy: actor.id,
      isDeleted: false,
    }, actor);

    await createNotification('', 'PQR Submitted for Review', `${pqr.pqrNumber} submitted for approval`, pqr.id);
    return { created };
  } catch (e) {
    console.error('submitPqrForApproval failed', e);
    return { error: (e as Error).message };
  }
}

async function activateNextStep(
  pqrId: string,
  approvals: PqrApprovalRecord[],
  actor: PqrApprovalActor,
): Promise<PqrApprovalRecord | null> {
  const next = approvals
    .filter((a) => !a.isDeleted && a.approvalStatus === 'Pending')
    .sort((a, b) => a.approvalLevel - b.approvalLevel)[0];

  if (!next?.id) return null;

  const ts = nowIso();
  await updateDoc(doc(getFirebaseFirestore(), PQR_APPROVAL_COLLECTIONS.approvals, next.id), {
    approvalStatus: 'In Review',
    eSignatureStatus: next.eSignatureRequired ? 'Required' : 'Not Required',
    workflowStatus: mapWorkflowStatusForStep({
      level: next.approvalLevel,
      approvalType: next.approvalType as PqrWorkflowStepDef['approvalType'],
      approverRole: next.currentApproverRole,
      stepName: next.currentWorkflowStep,
      designation: next.currentWorkflowStep,
      dueDays: 7,
      eSignatureRequired: next.eSignatureRequired,
      commentRequired: true,
    }),
    updatedAt: ts,
    updatedBy: actor.id,
  });

  await updatePqrRecordStatus(pqrId, {
    workflowStatus: mapWorkflowStatusForStep({
      level: next.approvalLevel,
      approvalType: next.approvalType as PqrWorkflowStepDef['approvalType'],
      approverRole: next.currentApproverRole,
      stepName: next.currentWorkflowStep,
      designation: next.currentWorkflowStep,
      dueDays: 7,
      eSignatureRequired: next.eSignatureRequired,
      commentRequired: true,
    }),
    currentWorkflowStep: next.currentWorkflowStep,
  }, actor);

  await createNotification('', 'PQR Pending Your Approval', `${next.pqrNumber} — ${next.currentWorkflowStep}`, pqrId);
  return { ...next, approvalStatus: 'In Review' };
}

export async function completeApprovalStep(
  approvalId: string,
  pqrId: string,
  comments: string,
  actor: PqrApprovalActor,
  esignApplied = false,
): Promise<{ error?: string; completed?: boolean }> {
  if (!isFirebaseConfigured()) return { error: 'Firebase is not configured.' };

  try {
    const approvals = await fetchApprovalRecords(pqrId);
    const current = approvals.find((a) => a.id === approvalId || a.approvalId === approvalId);
    if (!current?.id) return { error: 'Approval record not found.' };
    if (!['In Review', 'Escalated'].includes(current.approvalStatus)) {
      return { error: 'This approval step is not active.' };
    }

    const ts = nowIso();
    await updateDoc(doc(getFirebaseFirestore(), PQR_APPROVAL_COLLECTIONS.approvals, current.id), {
      approvalStatus: 'Approved',
      approvalComments: comments,
      eSignatureStatus: esignApplied ? 'Signed' : (current.eSignatureRequired ? 'Signed' : 'N/A'),
      signedBy: actor.name,
      signedDate: ts.slice(0, 10),
      completedDate: ts,
      currentApproverUser: actor.id,
      updatedAt: ts,
      updatedBy: actor.id,
    });

    await saveHistory({
      pqrId,
      pqrNumber: current.pqrNumber,
      approvalId: current.approvalId,
      action: 'approval completed',
      approvalType: current.approvalType,
      userId: actor.id,
      userName: actor.name,
      userRole: actor.role || '',
      comments,
      eSignatureStatus: esignApplied ? 'Signed' : 'N/A',
      createdAt: ts,
      createdBy: actor.id,
      isDeleted: false,
    }, actor);

    await logApprovalAudit('approval completed', actor, { approvalId: current.approvalId }, current.id);

    const pending = approvals.filter((a) =>
      !a.isDeleted && a.id !== current.id && ['Pending', 'In Review', 'Escalated'].includes(a.approvalStatus),
    );

    if (pending.length === 0 || current.approvalType === 'Final Approved By') {
      await updatePqrRecordStatus(pqrId, {
        status: 'Approved',
        workflowStatus: 'Approved',
        approvedAt: ts,
        approvedBy: actor.id,
        locked: true,
      }, actor);
      await lockPqrSections(pqrId, actor);
      await logApprovalAudit('final approval', actor, { pqrId }, pqrId);
      await logApprovalAudit('PQR locked', actor, { pqrId }, pqrId);
      return { completed: true };
    }

    await activateNextStep(pqrId, approvals, actor);
    return { completed: false };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function rejectPqrApproval(
  approvalId: string,
  pqrId: string,
  reason: string,
  actor: PqrApprovalActor,
  esignApplied = false,
): Promise<{ error?: string }> {
  if (!isFirebaseConfigured()) return { error: 'Firebase is not configured.' };
  if (!reason.trim()) return { error: 'Rejection reason is required.' };

  try {
    const approvals = await fetchApprovalRecords(pqrId);
    const current = approvals.find((a) => a.id === approvalId || a.approvalId === approvalId);
    if (!current?.id) return { error: 'Approval record not found.' };

    const ts = nowIso();
    await updateDoc(doc(getFirebaseFirestore(), PQR_APPROVAL_COLLECTIONS.approvals, current.id), {
      approvalStatus: 'Rejected',
      rejectionReason: reason,
      eSignatureStatus: esignApplied ? 'Signed' : 'N/A',
      signedBy: actor.name,
      signedDate: ts.slice(0, 10),
      completedDate: ts,
      workflowStatus: 'Rejected',
      updatedAt: ts,
      updatedBy: actor.id,
    });

    const batch = writeBatch(getFirebaseFirestore());
    approvals.filter((a) => a.id && a.id !== current.id && a.approvalStatus === 'Pending').forEach((a) => {
      batch.update(doc(getFirebaseFirestore(), PQR_APPROVAL_COLLECTIONS.approvals, a.id!), {
        approvalStatus: 'Cancelled',
        workflowStatus: 'Rejected',
        updatedAt: ts,
      });
    });
    await batch.commit();

    await updatePqrRecordStatus(pqrId, { status: 'Rejected', workflowStatus: 'Rejected', locked: false }, actor);

    await saveHistory({
      pqrId, pqrNumber: current.pqrNumber, approvalId: current.approvalId,
      action: 'rejection', approvalType: 'Rejected By',
      userId: actor.id, userName: actor.name, userRole: actor.role || '',
      comments: reason, eSignatureStatus: esignApplied ? 'Signed' : 'N/A',
      createdAt: ts, createdBy: actor.id, isDeleted: false,
    }, actor);

    await logApprovalAudit('rejection', actor, { reason }, current.id);
    await createNotification(current.createdBy, 'PQR Rejected', `${current.pqrNumber} was rejected: ${reason}`, pqrId);
    return {};
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function sendBackPqrApproval(
  approvalId: string,
  pqrId: string,
  reason: string,
  actor: PqrApprovalActor,
): Promise<{ error?: string }> {
  if (!isFirebaseConfigured()) return { error: 'Firebase is not configured.' };
  if (!reason.trim()) return { error: 'Send back reason is required.' };

  try {
    const approvals = await fetchApprovalRecords(pqrId);
    const current = approvals.find((a) => a.id === approvalId || a.approvalId === approvalId);
    if (!current?.id) return { error: 'Approval record not found.' };

    const ts = nowIso();
    await updateDoc(doc(getFirebaseFirestore(), PQR_APPROVAL_COLLECTIONS.approvals, current.id), {
      approvalStatus: 'Sent Back',
      sendBackReason: reason,
      workflowStatus: 'Sent Back',
      updatedAt: ts,
      updatedBy: actor.id,
    });

    await updatePqrRecordStatus(pqrId, { status: 'Draft', workflowStatus: 'Sent Back', locked: false }, actor);

    await saveHistory({
      pqrId, pqrNumber: current.pqrNumber, approvalId: current.approvalId,
      action: 'send back', approvalType: 'Sent Back By',
      userId: actor.id, userName: actor.name, userRole: actor.role || '',
      comments: reason, eSignatureStatus: 'N/A',
      createdAt: ts, createdBy: actor.id, isDeleted: false,
    }, actor);

    await logApprovalAudit('send back', actor, { reason }, current.id);
    await createNotification(current.createdBy, 'PQR Sent Back', `${current.pqrNumber} sent back: ${reason}`, pqrId);
    return {};
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function escalateApproval(
  approvalId: string,
  pqrId: string,
  actor: PqrApprovalActor,
): Promise<{ error?: string }> {
  if (!isFirebaseConfigured()) return { error: 'Firebase is not configured.' };
  try {
    const approvals = await fetchApprovalRecords(pqrId);
    const current = approvals.find((a) => a.id === approvalId || a.approvalId === approvalId);
    if (!current?.id) return { error: 'Approval record not found.' };

    await updateDoc(doc(getFirebaseFirestore(), PQR_APPROVAL_COLLECTIONS.approvals, current.id), {
      approvalStatus: 'Escalated',
      escalationStatus: 'Escalated',
      priority: 'Critical',
      updatedAt: nowIso(),
      updatedBy: actor.id,
    });

    await logApprovalAudit('escalation', actor, { approvalId }, current.id);
    await createNotification('', 'Overdue PQR Approval', `${current.pqrNumber} approval escalated`, pqrId);
    return {};
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function reassignApprover(
  approvalId: string,
  pqrId: string,
  newUserId: string,
  newUserName: string,
  actor: PqrApprovalActor,
): Promise<{ error?: string }> {
  if (!isFirebaseConfigured()) return { error: 'Firebase is not configured.' };
  try {
    const approvals = await fetchApprovalRecords(pqrId);
    const current = approvals.find((a) => a.id === approvalId || a.approvalId === approvalId);
    if (!current?.id) return { error: 'Approval record not found.' };

    await updateDoc(doc(getFirebaseFirestore(), PQR_APPROVAL_COLLECTIONS.approvals, current.id), {
      currentApproverUser: newUserId,
      remarks: `Reassigned to ${newUserName}`,
      updatedAt: nowIso(),
      updatedBy: actor.id,
    });

    await logApprovalAudit('reassignment', actor, { newUserId, newUserName }, current.id);
    await createNotification(newUserId, 'PQR Approval Reassigned', `${current.pqrNumber} assigned to you`, pqrId);
    return {};
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function archiveApprovedPqr(
  pqrId: string,
  actor: PqrApprovalActor,
): Promise<{ error?: string }> {
  if (!isFirebaseConfigured()) return { error: 'Firebase is not configured.' };
  try {
    await updatePqrRecordStatus(pqrId, { status: 'Archived', workflowStatus: 'Archived', archivedAt: nowIso() }, actor);
    const approvals = await fetchApprovalRecords(pqrId);
    const batch = writeBatch(getFirebaseFirestore());
    approvals.forEach((a) => {
      if (a.id) batch.update(doc(getFirebaseFirestore(), PQR_APPROVAL_COLLECTIONS.approvals, a.id), { workflowStatus: 'Archived', updatedAt: nowIso() });
    });
    await batch.commit();
    await logApprovalAudit('PQR archived', actor, { pqrId }, pqrId);
    return {};
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function reopenApprovedPqr(
  pqrId: string,
  reason: string,
  actor: PqrApprovalActor,
): Promise<{ error?: string }> {
  if (!isFirebaseConfigured()) return { error: 'Firebase is not configured.' };
  if (!reason.trim()) return { error: 'Reason is required.' };

  try {
    await updatePqrRecordStatus(pqrId, { status: 'Under Review', workflowStatus: 'Under Review', locked: false, reopenedAt: nowIso(), reopenReason: reason }, actor);
    await logApprovalAudit('PQR reopened', actor, { reason }, pqrId);
    await saveHistory({
      pqrId, pqrNumber: '', approvalId: '',
      action: 'PQR reopened', approvalType: 'Reviewed By',
      userId: actor.id, userName: actor.name, userRole: actor.role || '',
      comments: reason, eSignatureStatus: 'Signed',
      createdAt: nowIso(), createdBy: actor.id, isDeleted: false,
    }, actor);
    return {};
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export {
  computeDashboardCounts,
  daysPending,
  getCurrentPendingStep,
  canViewPqrApproval,
  canSubmitPqrApproval,
  canActOnApproval,
  canReopenApprovedPqr,
  canReassignApproval,
} from '@/lib/pqr-approval-records';

export async function logPqrApprovalView(actor: PqrApprovalActor) {
  await logApprovalAudit('PQR approval viewed', actor);
}

export async function logEsignSuccess(actor: PqrApprovalActor, approvalId: string) {
  await logApprovalAudit('e-signature success', actor, { approvalId }, approvalId);
}

export async function logEsignFailed(actor: PqrApprovalActor, approvalId: string, error: string) {
  await logApprovalAudit('e-signature failed', actor, { approvalId, error }, approvalId);
}
