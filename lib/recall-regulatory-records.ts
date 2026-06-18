import {
  isRegulatoryMandatory,
  isRegulatoryNotificationClosed,
  type RecallRecord,
  type RecallRegulatoryApproval,
  type RecallRegulatoryNotification,
  type RecallRegulatoryTimelineEntry,
} from '@/lib/recall-types';
import { normalizeRole } from '@/lib/permissions';

export const RECALL_REGULATORY_MODULE = 'Recall Regulatory Notification';

export type RecallRegulatoryActor = {
  id: string;
  name: string;
  role: string;
  email?: string;
};

export function buildRegulatoryNotificationId(year: number, seq: number): string {
  return `RGN/${year}/${String(seq).padStart(4, '0')}`;
}

export function applyRegulatoryOverdueCheck(
  notification: RecallRegulatoryNotification,
): RecallRegulatoryNotification {
  if (isRegulatoryNotificationClosed(notification.notification_status)) return notification;
  const submittedStatuses = ['Submitted', 'Acknowledged', 'Response Received', 'Closed'];
  if (submittedStatuses.includes(notification.notification_status)) return notification;
  if (!notification.notification_required || !notification.notification_due_date) return notification;
  const today = new Date().toISOString().split('T')[0];
  if (notification.notification_due_date < today && notification.notification_status === 'Pending') {
    return { ...notification, notification_status: 'Overdue' };
  }
  return notification;
}

export function deriveInitialNotificationStatus(recall: RecallRecord): string {
  if (recall.recall_classification === 'Class I') return 'Pending';
  if (recall.regulatory_notification_required) return 'Pending';
  return 'Not Required';
}

export function deriveInitialApprovalStatus(recall: RecallRecord): string {
  if (!recall.regulatory_notification_required && recall.recall_classification !== 'Class I') return 'Draft';
  return 'Under QA Review';
}

export function isRegulatoryRecordReadOnly(notification: RecallRegulatoryNotification): boolean {
  return notification.notification_status === 'Closed' || notification.approval_status === 'Closed';
}

export function requiresHeadQaApproval(recall: RecallRecord, notification: RecallRegulatoryNotification): boolean {
  return recall.recall_classification === 'Class I' || notification.notification_required;
}

export function canAdvanceToRegulatoryReview(notification: RecallRegulatoryNotification): boolean {
  return ['Submitted', 'Acknowledged', 'Response Received', 'Follow Up Required'].includes(notification.notification_status);
}

export function mapRegulatoryTimeline(
  notification: RecallRegulatoryNotification,
  approvals: RecallRegulatoryApproval[],
  auditLogs: Record<string, unknown>[],
): RecallRegulatoryTimelineEntry[] {
  const entries: RecallRegulatoryTimelineEntry[] = [
    {
      date: notification.created_at,
      title: 'Regulatory notification created',
      description: `${notification.regulatory_notification_id} for recall ${notification.recall_number}`,
      user: notification.created_by_name,
      status: notification.notification_status,
    },
  ];

  if (notification.notification_date) {
    entries.push({
      date: notification.notification_date,
      title: 'Submitted to authority',
      description: notification.submission_reference_number || 'Regulatory submission recorded',
      user: notification.submitted_by_name,
      status: 'Submitted',
    });
  }

  if (notification.response_date) {
    entries.push({
      date: notification.response_date,
      title: 'Authority response received',
      description: notification.authority_response.slice(0, 120),
      user: notification.updated_by_name,
      status: 'Response Received',
    });
  }

  for (const a of approvals) {
    entries.push({
      date: a.approved_at || a.created_at,
      title: `${a.approval_type.replace(/_/g, ' ')} ${a.decision}`,
      description: a.comments,
      user: a.approved_by_name,
      status: a.decision,
    });
  }

  for (const log of auditLogs) {
    entries.push({
      date: String(log.timestamp || log.dateTime || log.created_at || ''),
      title: String(log.actionType || log.action || 'Audit'),
      description: String(log.actionDescription || log.reason || ''),
      user: String(log.userName || (log.user as { name?: string } | undefined)?.name || ''),
    });
  }

  return entries
    .filter((e) => e.date)
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function mapRegulatoryAuditAction(action: string): string {
  const map: Record<string, string> = {
    REGULATORY_CREATED: 'Notification Created',
    REGULATORY_UPDATED: 'Notification Updated',
    REGULATORY_SUBMITTED: 'Authority Submission',
    REGULATORY_RESPONSE: 'Authority Response',
    REGULATORY_FOLLOW_UP: 'Follow Up Created',
    REGULATORY_QA_REVIEW: 'QA Review',
    REGULATORY_APPROVED: 'Approved',
    REGULATORY_REJECTED: 'Rejected',
    REGULATORY_CLOSED: 'Closed',
    REGULATORY_ESIGN: 'E-Signature Applied',
  };
  return map[action] || action;
}

export function canViewRecallRegulatoryModule(role?: string | null): boolean {
  const r = normalizeRole(role);
  return ['super_admin', 'admin', 'head_qa', 'qa_manager', 'qa', 'qa_executive', 'regulatory_affairs', 'auditor', 'viewer'].includes(r);
}

export function canEditRegulatoryDetails(role?: string | null, readOnly = false): boolean {
  if (readOnly) return false;
  const r = normalizeRole(role);
  return ['super_admin', 'admin', 'head_qa', 'qa_manager', 'qa', 'qa_executive'].includes(r);
}

export function canEditRegulatorySubmission(role?: string | null, readOnly = false): boolean {
  if (readOnly) return false;
  const r = normalizeRole(role);
  return ['super_admin', 'admin', 'regulatory_affairs', 'head_qa'].includes(r);
}

export function canPerformHeadQaRegulatoryApproval(role?: string | null, readOnly = false): boolean {
  if (readOnly) return false;
  const r = normalizeRole(role);
  return ['super_admin', 'admin', 'head_qa'].includes(r);
}

export function enforceMandatoryRegulatoryRules(recall: RecallRecord, notificationRequired: boolean): {
  notificationRequired: boolean;
  message?: string;
} {
  if (recall.recall_classification === 'Class I') {
    return { notificationRequired: true, message: 'Class I recall requires mandatory regulatory notification.' };
  }
  return { notificationRequired: isRegulatoryMandatory(recall.recall_classification, notificationRequired) };
}
