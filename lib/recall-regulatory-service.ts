import {
  addDoc, collection, doc, getDoc, getDocs, limit, orderBy, query, updateDoc, where,
} from 'firebase/firestore';
import { createAuditLog } from '@/lib/audit-trail';
import { getFirebaseFirestore } from '@/lib/firebase';
import { getRecallById, listRecalls } from '@/lib/recall-service';
import type {
  RecallRegulatoryApprovalInput,
  RecallRegulatoryDetailsInput,
  RecallRegulatoryFollowUpInput,
  RecallRegulatoryResponseInput,
  RecallRegulatorySubmissionInput,
} from '@/lib/recall-regulatory-schemas';
import {
  applyRegulatoryOverdueCheck,
  buildRegulatoryNotificationId,
  canAdvanceToRegulatoryReview,
  deriveInitialApprovalStatus,
  deriveInitialNotificationStatus,
  isRegulatoryRecordReadOnly,
  mapRegulatoryTimeline,
  RECALL_REGULATORY_MODULE,
  requiresHeadQaApproval,
  type RecallRegulatoryActor,
} from '@/lib/recall-regulatory-records';
import {
  RECALL_COLLECTIONS,
  type RecallRecord,
  type RecallRegulatoryApproval,
  type RecallRegulatoryNotification,
} from '@/lib/recall-types';

export type { RecallRegulatoryActor };

const now = () => new Date().toISOString();
const today = () => new Date().toISOString().split('T')[0];

async function audit(
  actor: RecallRegulatoryActor,
  actionType: string,
  recallId: string,
  detail: string,
  recordId?: string,
  oldValue?: unknown,
  newValue?: unknown,
) {
  try {
    await createAuditLog({
      moduleName: RECALL_REGULATORY_MODULE,
      collectionName: RECALL_COLLECTIONS.regulatoryNotifications,
      recordId: recordId || recallId,
      actionType,
      actionDescription: detail,
      reason: detail,
      oldValue,
      newValue,
      user: { id: actor.id, name: actor.name, role: actor.role },
      status: 'Success',
    });
  } catch (e) {
    console.error('recall regulatory audit', e);
  }
}

async function notify(title: string, message: string, recallId: string, roles: string[]) {
  try {
    for (const role of roles) {
      await addDoc(collection(getFirebaseFirestore(), RECALL_COLLECTIONS.notifications), {
        title,
        message,
        module: RECALL_REGULATORY_MODULE,
        record_id: recallId,
        target_role: role,
        read: false,
        created_at: now(),
      });
    }
  } catch (e) {
    console.error('recall regulatory notify', e);
  }
}

async function generateRegulatoryNotificationId(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `RGN/${year}/`;
  try {
    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), RECALL_COLLECTIONS.regulatoryNotifications),
      where('regulatory_notification_id', '>=', prefix),
      where('regulatory_notification_id', '<=', `${prefix}\uf8ff`),
      orderBy('regulatory_notification_id', 'desc'),
      limit(1),
    ));
    if (!snap.empty) {
      const last = String(snap.docs[0].data().regulatory_notification_id || '');
      const seq = parseInt(last.split('/').pop() || '0', 10) + 1;
      return buildRegulatoryNotificationId(year, seq);
    }
  } catch {
    const snap = await getDocs(collection(getFirebaseFirestore(), RECALL_COLLECTIONS.regulatoryNotifications));
    return buildRegulatoryNotificationId(year, snap.size + 1);
  }
  return buildRegulatoryNotificationId(year, 1);
}

async function syncRecallRegulatoryFlags(
  recallId: string,
  patch: Partial<RecallRecord>,
  actor: RecallRegulatoryActor,
) {
  await updateDoc(doc(getFirebaseFirestore(), RECALL_COLLECTIONS.records, recallId), {
    ...patch,
    updated_by: actor.id,
    updated_by_name: actor.name,
    updated_at: now(),
  });
}

export async function getRegulatoryNotificationByRecallId(
  recallId: string,
): Promise<RecallRegulatoryNotification | null> {
  const snap = await getDocs(query(
    collection(getFirebaseFirestore(), RECALL_COLLECTIONS.regulatoryNotifications),
    where('recall_id', '==', recallId),
    limit(1),
  ));
  if (snap.empty) return null;
  const row = { id: snap.docs[0].id, ...snap.docs[0].data() } as RecallRegulatoryNotification;
  return applyRegulatoryOverdueCheck(row);
}

export async function getOrCreateRegulatoryNotification(
  recallId: string,
  actor: RecallRegulatoryActor,
): Promise<RecallRegulatoryNotification> {
  const existing = await getRegulatoryNotificationByRecallId(recallId);
  if (existing) return existing;

  const recall = await getRecallById(recallId);
  if (!recall) throw new Error('Recall not found');

  const timestamp = now();
  const notificationRequired = recall.recall_classification === 'Class I' || recall.regulatory_notification_required;
  const regulatoryNotificationId = await generateRegulatoryNotificationId();

  const payload: Omit<RecallRegulatoryNotification, 'id'> = {
    regulatory_notification_id: regulatoryNotificationId,
    recall_id: recallId,
    recall_number: recall.recall_number,
    product_name: recall.product_name,
    batch_number: recall.batch_number,
    recall_classification: recall.recall_classification,
    market_region: recall.market_region,
    regulatory_authority: recall.regulatory_authority || '',
    notification_required: notificationRequired,
    notification_due_date: recall.notification_due_date || null,
    notification_date: null,
    notification_status: deriveInitialNotificationStatus(recall),
    submitted_by: '',
    submitted_by_name: '',
    submission_reference_number: '',
    submission_document: '',
    authority_response: '',
    response_date: null,
    follow_up_required: false,
    follow_up_due_date: null,
    regulatory_comments: '',
    qa_comments: '',
    head_qa_comments: '',
    approval_status: deriveInitialApprovalStatus(recall),
    e_signature_required: true,
    signed_by: '',
    signed_by_name: '',
    signed_date: null,
    created_at: timestamp,
    updated_at: timestamp,
    created_by: actor.id,
    created_by_name: actor.name,
    updated_by: actor.id,
    updated_by_name: actor.name,
  };

  const ref = await addDoc(collection(getFirebaseFirestore(), RECALL_COLLECTIONS.regulatoryNotifications), payload);
  await audit(actor, 'REGULATORY_CREATED', recallId, `Regulatory notification ${regulatoryNotificationId} created`, ref.id, null, payload);

  if (recall.recall_classification === 'Class I') {
    await notify(
      'Class I Regulatory Notification Required',
      `Mandatory regulatory notification for recall ${recall.recall_number}`,
      recallId,
      ['regulatory_affairs', 'head_qa', 'qa'],
    );
  }

  return applyRegulatoryOverdueCheck({ id: ref.id, ...payload });
}

export async function getRegulatoryApprovals(recallId: string): Promise<RecallRegulatoryApproval[]> {
  const snap = await getDocs(query(
    collection(getFirebaseFirestore(), RECALL_COLLECTIONS.approvals),
    where('recall_id', '==', recallId),
  ));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as RecallRegulatoryApproval));
}

export async function getRegulatoryAuditLogs(recallId: string): Promise<Record<string, unknown>[]> {
  try {
    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), 'audit_trail'),
      where('recordId', '==', recallId),
      limit(200),
    ));
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() } as Record<string, unknown>))
      .filter((log) => String(log.moduleName || '').includes('Recall'));
  } catch {
    return [];
  }
}

export async function fetchRecallRegulatoryPageData(recallId: string, actor: RecallRegulatoryActor) {
  const recall = await getRecallById(recallId);
  if (!recall) return null;

  const notification = await getOrCreateRegulatoryNotification(recallId, actor);
  const [approvals, auditLogs] = await Promise.all([
    getRegulatoryApprovals(recallId),
    getRegulatoryAuditLogs(recallId),
  ]);

  const checked = applyRegulatoryOverdueCheck(notification);
  if (checked.notification_status !== notification.notification_status) {
    await updateDoc(doc(getFirebaseFirestore(), RECALL_COLLECTIONS.regulatoryNotifications, notification.id), {
      notification_status: checked.notification_status,
      updated_at: now(),
    });
  }

  return {
    recall,
    notification: checked,
    approvals,
    auditLogs,
    timeline: mapRegulatoryTimeline(checked, approvals, auditLogs),
    readOnly: isRegulatoryRecordReadOnly(checked),
  };
}

export async function listRecallsForRegulatoryNotification(): Promise<RecallRecord[]> {
  const records = await listRecalls();
  return records.filter((r) =>
    !['draft', 'cancelled', 'closed'].includes(r.recall_status)
    && (r.regulatory_notification_required || r.recall_classification === 'Class I'));
}

async function saveApprovalRecord(
  recallId: string,
  notificationId: string,
  approvalType: RecallRegulatoryApproval['approval_type'],
  decision: 'approved' | 'rejected',
  comments: string,
  actor: RecallRegulatoryActor,
  eSignature = '',
) {
  const timestamp = now();
  await addDoc(collection(getFirebaseFirestore(), RECALL_COLLECTIONS.approvals), {
    recall_id: recallId,
    regulatory_notification_id: notificationId,
    approval_type: approvalType,
    decision,
    comments,
    e_signature: eSignature,
    e_signature_status: eSignature ? 'Signed' : 'Not Signed',
    approved_by: actor.id,
    approved_by_name: actor.name,
    approved_at: timestamp,
    created_at: timestamp,
  });
}

export async function updateRegulatoryNotificationDetails(
  recallId: string,
  input: RecallRegulatoryDetailsInput,
  actor: RecallRegulatoryActor,
): Promise<RecallRegulatoryNotification> {
  const notification = await getOrCreateRegulatoryNotification(recallId, actor);
  if (isRegulatoryRecordReadOnly(notification)) throw new Error('Closed regulatory notification is read-only');

  const recall = await getRecallById(recallId);
  if (!recall) throw new Error('Recall not found');

  const notificationRequired = recall.recall_classification === 'Class I' ? true : input.notification_required;
  const payload = {
    regulatory_authority: input.regulatory_authority || '',
    notification_required: notificationRequired,
    notification_due_date: input.notification_due_date || null,
    market_region: input.market_region || recall.market_region,
    qa_comments: input.qa_comments || '',
    notification_status: notificationRequired ? (notification.notification_status === 'Not Required' ? 'Pending' : notification.notification_status) : 'Not Required',
    approval_status: notificationRequired ? 'Under QA Review' : notification.approval_status,
    updated_by: actor.id,
    updated_by_name: actor.name,
    updated_at: now(),
  };

  await updateDoc(doc(getFirebaseFirestore(), RECALL_COLLECTIONS.regulatoryNotifications, notification.id), payload);
  await syncRecallRegulatoryFlags(recallId, {
    regulatory_authority: payload.regulatory_authority,
    regulatory_notification_required: notificationRequired,
    notification_due_date: payload.notification_due_date,
    notification_status: payload.notification_status,
  }, actor);
  await audit(actor, 'REGULATORY_UPDATED', recallId, 'Regulatory notification details updated', notification.id, notification, payload);

  return applyRegulatoryOverdueCheck({ ...notification, ...payload });
}

export async function submitRegulatoryNotification(
  recallId: string,
  input: RecallRegulatorySubmissionInput,
  actor: RecallRegulatoryActor,
): Promise<RecallRegulatoryNotification> {
  const notification = await getOrCreateRegulatoryNotification(recallId, actor);
  if (isRegulatoryRecordReadOnly(notification)) throw new Error('Closed regulatory notification is read-only');
  if (!notification.notification_required) throw new Error('Regulatory notification is not required for this recall');

  const payload = {
    notification_date: input.notification_date,
    submission_reference_number: input.submission_reference_number,
    submission_document: input.submission_document || '',
    regulatory_comments: input.regulatory_comments || '',
    notification_status: 'Submitted',
    approval_status: 'Regulatory Review',
    submitted_by: actor.id,
    submitted_by_name: actor.name,
    updated_by: actor.id,
    updated_by_name: actor.name,
    updated_at: now(),
  };

  await updateDoc(doc(getFirebaseFirestore(), RECALL_COLLECTIONS.regulatoryNotifications, notification.id), payload);
  await syncRecallRegulatoryFlags(recallId, {
    regulatory_notified: true,
    recall_status: 'regulatory_notified',
    notification_status: 'Submitted',
  }, actor);
  await audit(actor, 'REGULATORY_SUBMITTED', recallId, `Submitted to ${notification.regulatory_authority}`, notification.id, notification, payload);
  await notify('Regulatory Submission Recorded', `Recall ${notification.recall_number} submitted to authority`, recallId, ['head_qa', 'qa']);

  return applyRegulatoryOverdueCheck({ ...notification, ...payload });
}

export async function recordRegulatoryAuthorityResponse(
  recallId: string,
  input: RecallRegulatoryResponseInput,
  actor: RecallRegulatoryActor,
): Promise<RecallRegulatoryNotification> {
  const notification = await getOrCreateRegulatoryNotification(recallId, actor);
  if (isRegulatoryRecordReadOnly(notification)) throw new Error('Closed regulatory notification is read-only');

  const payload = {
    authority_response: input.authority_response,
    response_date: input.response_date,
    notification_status: input.notification_status || 'Response Received',
    approval_status: canAdvanceToRegulatoryReview(notification) ? 'Head QA Approval' : notification.approval_status,
    updated_by: actor.id,
    updated_by_name: actor.name,
    updated_at: now(),
  };

  await updateDoc(doc(getFirebaseFirestore(), RECALL_COLLECTIONS.regulatoryNotifications, notification.id), payload);
  await audit(actor, 'REGULATORY_RESPONSE', recallId, 'Authority response recorded', notification.id, notification, payload);

  return applyRegulatoryOverdueCheck({ ...notification, ...payload });
}

export async function updateRegulatoryFollowUp(
  recallId: string,
  input: RecallRegulatoryFollowUpInput,
  actor: RecallRegulatoryActor,
): Promise<RecallRegulatoryNotification> {
  const notification = await getOrCreateRegulatoryNotification(recallId, actor);
  if (isRegulatoryRecordReadOnly(notification)) throw new Error('Closed regulatory notification is read-only');

  const payload = {
    follow_up_required: input.follow_up_required,
    follow_up_due_date: input.follow_up_due_date || null,
    regulatory_comments: input.regulatory_comments || notification.regulatory_comments,
    notification_status: input.follow_up_required ? 'Follow Up Required' : notification.notification_status,
    updated_by: actor.id,
    updated_by_name: actor.name,
    updated_at: now(),
  };

  await updateDoc(doc(getFirebaseFirestore(), RECALL_COLLECTIONS.regulatoryNotifications, notification.id), payload);
  await audit(actor, 'REGULATORY_FOLLOW_UP', recallId, 'Follow up tracking updated', notification.id, notification, payload);

  if (input.follow_up_required && input.follow_up_due_date && input.follow_up_due_date < today()) {
    await notify('Regulatory Follow-Up Overdue', `Follow-up overdue for recall ${notification.recall_number}`, recallId, ['regulatory_affairs', 'head_qa']);
  }

  return applyRegulatoryOverdueCheck({ ...notification, ...payload });
}

export async function submitRegulatoryQaReview(
  recallId: string,
  qaComments: string,
  actor: RecallRegulatoryActor,
): Promise<RecallRegulatoryNotification> {
  if (!qaComments.trim() || qaComments.trim().length < 5) throw new Error('QA comments are required for approval');

  const notification = await getOrCreateRegulatoryNotification(recallId, actor);
  if (isRegulatoryRecordReadOnly(notification)) throw new Error('Closed regulatory notification is read-only');

  const payload = {
    qa_comments: qaComments,
    approval_status: 'Regulatory Review',
    updated_by: actor.id,
    updated_by_name: actor.name,
    updated_at: now(),
  };

  await updateDoc(doc(getFirebaseFirestore(), RECALL_COLLECTIONS.regulatoryNotifications, notification.id), payload);
  await saveApprovalRecord(recallId, notification.id, 'qa_review', 'approved', qaComments, actor);
  await audit(actor, 'REGULATORY_QA_REVIEW', recallId, 'QA review completed', notification.id, notification, payload);

  return applyRegulatoryOverdueCheck({ ...notification, ...payload });
}

export async function submitHeadQaRegulatoryApproval(
  recallId: string,
  input: RecallRegulatoryApprovalInput,
  actor: RecallRegulatoryActor,
): Promise<RecallRegulatoryNotification> {
  if (!input.qa_comments.trim() || input.qa_comments.trim().length < 5) {
    throw new Error('QA comments are required for approval');
  }

  const notification = await getOrCreateRegulatoryNotification(recallId, actor);
  const recall = await getRecallById(recallId);
  if (!recall || !notification) throw new Error('Recall not found');
  if (isRegulatoryRecordReadOnly(notification)) throw new Error('Closed regulatory notification is read-only');

  if (requiresHeadQaApproval(recall, notification) && input.decision === 'approved') {
    if (notification.e_signature_required && !input.e_signature?.trim()) {
      throw new Error('E-signature is required for final approval');
    }
  }

  const approved = input.decision === 'approved';
  const notificationPayload = {
    qa_comments: input.qa_comments,
    head_qa_comments: input.head_qa_comments || '',
    approval_status: approved ? 'Approved' : 'Rejected',
    notification_status: approved ? 'Closed' : notification.notification_status,
    signed_by: approved ? actor.id : '',
    signed_by_name: approved ? actor.name : '',
    signed_date: approved ? today() : null,
    updated_by: actor.id,
    updated_by_name: actor.name,
    updated_at: now(),
  };

  await updateDoc(doc(getFirebaseFirestore(), RECALL_COLLECTIONS.regulatoryNotifications, notification.id), notificationPayload);
  await saveApprovalRecord(
    recallId,
    notification.id,
    'head_qa',
    approved ? 'approved' : 'rejected',
    input.head_qa_comments || input.qa_comments,
    actor,
    input.e_signature || '',
  );

  if (approved && input.e_signature) {
    try {
      await addDoc(collection(getFirebaseFirestore(), 'esign_records'), {
        module: RECALL_REGULATORY_MODULE,
        record_id: recallId,
        document_number: notification.regulatory_notification_id,
        signed_by: actor.id,
        signed_by_name: actor.name,
        signature: input.e_signature,
        signed_at: now(),
      });
    } catch (e) {
      console.error('recall regulatory esign', e);
    }
    await audit(actor, 'REGULATORY_ESIGN', recallId, 'E-signature applied for regulatory approval', notification.id);
  }

  await syncRecallRegulatoryFlags(recallId, {
    head_qa_approved: approved,
    regulatory_approved: approved,
    recall_status: approved ? 'regulatory_notified' : recall.recall_status,
  }, actor);

  await audit(
    actor,
    approved ? 'REGULATORY_APPROVED' : 'REGULATORY_REJECTED',
    recallId,
    approved ? 'Head QA regulatory approval granted' : 'Head QA regulatory approval rejected',
    notification.id,
    notification,
    notificationPayload,
  );

  if (approved) {
    await audit(actor, 'REGULATORY_CLOSED', recallId, 'Regulatory notification closed', notification.id);
    await notify('Regulatory Notification Closed', `Recall ${notification.recall_number} regulatory workflow completed`, recallId, ['qa', 'regulatory_affairs']);
  }

  return applyRegulatoryOverdueCheck({ ...notification, ...notificationPayload });
}

export async function logRegulatoryEsignResult(
  recallId: string,
  actor: RecallRegulatoryActor,
  eSignature: string,
) {
  await audit(actor, 'REGULATORY_ESIGN', recallId, 'E-signature captured via modal', recallId, null, { eSignature });
}
