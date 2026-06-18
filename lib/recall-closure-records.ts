import { isCapaClosed } from '@/lib/capa-types';
import type { CapaRecord } from '@/lib/capa-types';
import { normalizeRole } from '@/lib/permissions';
import {
  calcPendingQuantity,
  getRecallRecoveryPercent,
  isRecallCritical,
  requiresClassIApproval,
  type RecallDistribution,
  type RecallRecord,
  type RecallRecovery,
  type RecallRegulatoryNotification,
} from '@/lib/recall-types';
import type { RecallClosureDraftInput } from '@/lib/recall-closure-schemas';

export const RECALL_CLOSURE_MODULE = 'Recall Closure';

export type RecallClosureActor = { id: string; name: string; role?: string; email?: string };

export interface RecallClosureChecklistItem {
  key: string;
  label: string;
  complete: boolean;
  required: boolean;
  warning?: string;
}

export interface RecallClosureReadiness {
  items: RecallClosureChecklistItem[];
  completeCount: number;
  totalRequired: number;
  percent: number;
  ready: boolean;
  blockers: string[];
}

export function buildClosureId(recallNumber: string): string {
  return `RCL/${recallNumber.replace(/\//g, '-')}`;
}

export function distributionListComplete(distributions: RecallDistribution[], recall: RecallRecord): boolean {
  if (distributions.length > 0) return true;
  return (recall.distributed_quantity ?? 0) > 0;
}

export function recoveryTrackingComplete(
  distributions: RecallDistribution[],
  recoveries: RecallRecovery[],
  recall: RecallRecord,
): boolean {
  if (recoveries.length > 0) return true;
  const distributed = distributions.reduce((s, d) => s + d.quantity_distributed, 0) || recall.distributed_quantity || 0;
  return distributed <= 0;
}

export function pendingQuantityJustified(
  recoveryPercent: number,
  justification?: string,
): boolean {
  if (recoveryPercent >= 100) return true;
  return Boolean(justification?.trim() && justification.trim().length >= 10);
}

export function regulatoryNotificationComplete(
  recall: RecallRecord,
  regulatory: RecallRegulatoryNotification | null,
): boolean {
  const required = recall.regulatory_notification_required || isRecallCritical(recall);
  if (!required) return true;
  if (!regulatory) return false;
  return ['Submitted', 'Acknowledged', 'Response Received', 'Closed'].includes(regulatory.notification_status);
}

export function authorityResponseComplete(
  recall: RecallRecord,
  regulatory: RecallRegulatoryNotification | null,
): boolean {
  const required = recall.regulatory_notification_required || isRecallCritical(recall);
  if (!required) return true;
  if (!regulatory) return false;
  if (!regulatory.authority_response?.trim()) {
    return regulatory.notification_status === 'Closed' || regulatory.notification_status === 'Acknowledged';
  }
  return Boolean(regulatory.response_date);
}

export function capaDecisionComplete(recall: RecallRecord): boolean {
  return recall.capa_required !== undefined;
}

export function capaLinkedComplete(recall: RecallRecord, capa: CapaRecord | null): boolean {
  if (!recall.capa_required) return true;
  return Boolean(recall.linked_capa_id || recall.linked_capa_number || capa);
}

export function capaClosedComplete(recall: RecallRecord, capa: CapaRecord | null): boolean {
  if (!recall.capa_required) return true;
  if (!capa) return false;
  return isCapaClosed(capa.capa_status);
}

export function effectivenessReviewComplete(recall: RecallRecord, capa: CapaRecord | null): boolean {
  if (!recall.capa_required || !capa) return !recall.capa_required;
  if (!capa.effectiveness_check_required) return true;
  return ['Effective', 'Partially Effective', 'N/A'].includes(capa.effectiveness_result || '');
}

export function headQaApprovalComplete(recall: RecallRecord): boolean {
  if (!requiresClassIApproval(recall.recall_classification)) return true;
  return recall.head_qa_approved === true;
}

export function computeRecallClosureReadiness(input: {
  recall: RecallRecord;
  distributions: RecallDistribution[];
  recoveries: RecallRecovery[];
  regulatory: RecallRegulatoryNotification | null;
  capa: CapaRecord | null;
  form?: Partial<RecallClosureDraftInput>;
}): RecallClosureReadiness {
  const { recall, distributions, recoveries, regulatory, capa, form } = input;
  const distributed = distributions.reduce((s, d) => s + d.quantity_distributed, 0) || recall.distributed_quantity || 0;
  const recovered = recoveries.reduce((s, r) => s + r.quantity_recovered, 0) || recall.recovered_quantity || 0;
  const recoveryPercent = getRecallRecoveryPercent({ ...recall, distributed_quantity: distributed, recovered_quantity: recovered });
  const pendingQty = calcPendingQuantity(distributed, recovered);
  const disposalRequired = pendingQty > 0 || recoveryPercent < 100;

  const items: RecallClosureChecklistItem[] = [
    { key: 'distribution', label: 'Distribution list completed', complete: distributionListComplete(distributions, recall), required: true },
    { key: 'recovery', label: 'Recovery tracking completed', complete: recoveryTrackingComplete(distributions, recoveries, recall), required: true },
    { key: 'recovery_review', label: 'Recovery percentage reviewed', complete: distributed > 0 || recall.recovery_percent != null, required: true },
    {
      key: 'pending_justification',
      label: 'Pending quantity justified',
      complete: pendingQuantityJustified(recoveryPercent, form?.pending_quantity_justification),
      required: recoveryPercent < 100,
      warning: recoveryPercent < 100 ? 'Justification required when recovery is below 100%' : undefined,
    },
    {
      key: 'regulatory',
      label: 'Regulatory notification completed if required',
      complete: regulatoryNotificationComplete(recall, regulatory),
      required: recall.regulatory_notification_required || isRecallCritical(recall),
    },
    {
      key: 'authority_response',
      label: 'Authority response reviewed if applicable',
      complete: authorityResponseComplete(recall, regulatory),
      required: recall.regulatory_notification_required || isRecallCritical(recall),
    },
    { key: 'capa_decision', label: 'CAPA decision completed', complete: capaDecisionComplete(recall), required: true },
    { key: 'capa_linked', label: 'Mandatory CAPA linked', complete: capaLinkedComplete(recall, capa), required: recall.capa_required },
    { key: 'capa_closed', label: 'Mandatory CAPA closed', complete: capaClosedComplete(recall, capa), required: recall.capa_required },
    { key: 'effectiveness', label: 'Effectiveness review completed', complete: effectivenessReviewComplete(recall, capa), required: recall.capa_required },
    {
      key: 'disposal',
      label: 'Disposal documentation completed if applicable',
      complete: !disposalRequired || (form?.product_disposal_completed ?? false),
      required: disposalRequired,
    },
    {
      key: 'customer_comm',
      label: 'Customer / distributor communication completed',
      complete: form?.customer_communication_completed ?? false,
      required: true,
    },
    { key: 'qa_approval', label: 'QA approval completed', complete: Boolean(form?.qa_closure_comments?.trim()), required: true },
    {
      key: 'head_qa',
      label: 'Head QA approval completed for Class I / critical recall',
      complete: headQaApprovalComplete(recall),
      required: requiresClassIApproval(recall.recall_classification),
    },
  ];

  const required = items.filter((i) => i.required);
  const completeCount = required.filter((i) => i.complete).length;
  const blockers = required.filter((i) => !i.complete).map((i) => i.label);
  const percent = required.length ? Math.round((completeCount / required.length) * 100) : 0;

  return {
    items,
    completeCount,
    totalRequired: required.length,
    percent,
    ready: blockers.length === 0,
    blockers,
  };
}

export function recallClosureStatusColor(status?: string): string {
  const map: Record<string, string> = {
    Pending: 'bg-slate-100 text-slate-700 border-slate-200',
    'Ready For Closure': 'bg-blue-100 text-blue-800 border-blue-200',
    'QA Review': 'bg-amber-100 text-amber-800 border-amber-200',
    'Head QA Review': 'bg-indigo-100 text-indigo-800 border-indigo-200',
    Closed: 'bg-green-100 text-green-800 border-green-200',
    Rejected: 'bg-red-100 text-red-800 border-red-200',
    Reopened: 'bg-purple-100 text-purple-800 border-purple-200',
  };
  return map[status || 'Pending'] || map.Pending;
}

export function mapRecallClosureAuditAction(action: string): string {
  const map: Record<string, string> = {
    CLOSURE_CHECKLIST_GENERATED: 'Closure Checklist Generated',
    CLOSURE_READINESS_CHECKED: 'Closure Readiness Checked',
    RECOVERY_SUMMARY_REVIEWED: 'Recovery Summary Reviewed',
    REGULATORY_SUMMARY_REVIEWED: 'Regulatory Summary Reviewed',
    CAPA_SUMMARY_REVIEWED: 'CAPA Summary Reviewed',
    RECALL_CLOSED: 'Recall Closed',
    RECALL_REOPENED: 'Recall Reopened',
    ESIGN_SUCCESS: 'E-Signature Success',
    ESIGN_FAILED: 'E-Signature Failed',
    CLOSURE_REJECTED: 'Closure Rejected',
  };
  return map[action] || action;
}

export function canViewRecallClosureModule(role?: string | null): boolean {
  const r = normalizeRole(role);
  return ['super_admin', 'admin', 'head_qa', 'qa_manager', 'qa', 'qa_executive', 'regulatory_affairs', 'warehouse', 'warehouse_manager', 'auditor', 'viewer'].includes(r);
}

export function canReviewRecallClosureModule(role?: string | null): boolean {
  const r = normalizeRole(role);
  return ['super_admin', 'admin', 'head_qa', 'qa_manager', 'qa', 'qa_executive'].includes(r);
}

export function canCloseRecallClosureModule(role?: string | null, classification?: string): boolean {
  const r = normalizeRole(role);
  if (['super_admin', 'admin'].includes(r)) return true;
  if (classification === 'Class I') return r === 'head_qa';
  return ['head_qa', 'qa_manager', 'qa'].includes(r);
}

export function canReopenRecallClosureModule(role?: string | null): boolean {
  return ['super_admin', 'admin', 'head_qa'].includes(normalizeRole(role));
}
