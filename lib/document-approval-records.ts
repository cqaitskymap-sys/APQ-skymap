import type { DocumentApprovalRecord, ApprovalKpis, ApprovalCharts, ApprovalFilters } from './document-approval-types';
import { computeApprovalSlaStatus } from './document-approval-types';

function isLegacyRecord(raw: Record<string, unknown>): boolean {
  return Boolean(raw.stage) && !raw.approval_number;
}

export function mapApprovalRaw(raw: Record<string, unknown> & { id: string }): DocumentApprovalRecord | null {
  if (isLegacyRecord(raw)) return null;

  const dueDate = (raw.due_date as string) || '';
  const status = (raw.approval_status as string) || 'Pending Approval';
  return {
    id: raw.id,
    approval_id: (raw.approval_id as string) || raw.id,
    approval_number: (raw.approval_number as string) || `APR-LEGACY-${raw.id.slice(0, 6)}`,
    workflow_id: (raw.workflow_id as string) || null,
    document_id: (raw.document_id as string) || '',
    document_number: (raw.document_number as string) || '',
    document_title: (raw.document_title as string) || '',
    document_type: (raw.document_type as string) || '',
    version: (raw.version as string) || '',
    approval_type: (raw.approval_type as string) || 'Sequential',
    current_step: (raw.current_step as number) || 1,
    total_steps: (raw.total_steps as number) || 1,
    approver_id: (raw.approver_id as string) || '',
    approver_name: (raw.approver_name as string) || '',
    approver_role: (raw.approver_role as string) || '',
    department: (raw.department as string) || '',
    priority: (raw.priority as string) || 'Normal',
    due_date: dueDate,
    approval_date: (raw.approval_date as string) || null,
    approval_decision: (raw.approval_decision as string) || null,
    approval_status: status,
    approval_comments: (raw.approval_comments as string) || '',
    electronic_signature_required: Boolean(raw.electronic_signature_required),
    electronic_signature_status: (raw.electronic_signature_status as string) || 'Not Required',
    delegated_to: (raw.delegated_to as string) || null,
    delegated_to_name: (raw.delegated_to_name as string) || null,
    escalated: Boolean(raw.escalated),
    escalation_level: (raw.escalation_level as number) || 0,
    sla_status: (raw.sla_status as string) || computeApprovalSlaStatus(dueDate, status, raw.approval_date as string),
    step_id: (raw.step_id as string) || null,
    started_at: (raw.started_at as string) || null,
    module: (raw.module as string) || 'Document Approval',
    created_by: (raw.created_by as string) || '',
    created_by_name: (raw.created_by_name as string) || '',
    updated_by: (raw.updated_by as string) || '',
    updated_by_name: (raw.updated_by_name as string) || '',
    created_at: (raw.created_at as string) || '',
    updated_at: (raw.updated_at as string) || '',
  };
}

export function emptyApprovalKpis(): ApprovalKpis {
  return {
    pendingApprovals: 0, approvedToday: 0, rejectedToday: 0, returnedForRevision: 0,
    overdueApprovals: 0, averageApprovalTimeDays: 0, slaCompliancePct: 100,
    delegatedApprovals: 0, escalatedApprovals: 0,
  };
}

export function emptyApprovalCharts(): ApprovalCharts {
  return {
    statusDistribution: [], approvalTimeline: [], departmentApprovals: [],
    approverWorkload: [], averageApprovalDuration: [], slaComplianceTrend: [], escalationTrend: [],
  };
}

function todayStr() { return new Date().toISOString().split('T')[0]; }

export function computeApprovalKpis(records: DocumentApprovalRecord[]): ApprovalKpis {
  const today = todayStr();
  const terminal = ['Approved', 'Rejected', 'Cancelled'];
  const completed = records.filter((r) => terminal.includes(r.approval_status) || r.approval_status === 'Returned');
  let totalDays = 0;
  let slaMet = 0;
  for (const r of completed) {
    if (r.started_at && r.approval_date) {
      const days = (new Date(r.approval_date).getTime() - new Date(r.started_at).getTime()) / 86400000;
      totalDays += days;
      if (r.due_date >= r.approval_date.split('T')[0]) slaMet++;
    }
  }
  return {
    pendingApprovals: records.filter((r) => r.approval_status === 'Pending Approval').length,
    approvedToday: records.filter((r) => r.approval_status === 'Approved' && r.approval_date?.startsWith(today)).length,
    rejectedToday: records.filter((r) => r.approval_status === 'Rejected' && r.approval_date?.startsWith(today)).length,
    returnedForRevision: records.filter((r) => r.approval_status === 'Returned' || r.approval_decision === 'Returned For Revision').length,
    overdueApprovals: records.filter((r) => r.sla_status === 'Overdue' && !terminal.includes(r.approval_status)).length,
    averageApprovalTimeDays: completed.length ? Math.round((totalDays / completed.length) * 10) / 10 : 0,
    slaCompliancePct: completed.length ? Math.round((slaMet / completed.length) * 100) : 100,
    delegatedApprovals: records.filter((r) => r.delegated_to).length,
    escalatedApprovals: records.filter((r) => r.escalated).length,
  };
}

export function computeApprovalCharts(records: DocumentApprovalRecord[]): ApprovalCharts {
  const byStatus = new Map<string, number>();
  const byMonth = new Map<string, number>();
  const avgByMonth = new Map<string, { total: number; count: number }>();
  const byDept = new Map<string, number>();
  const byApprover = new Map<string, number>();
  const slaByMonth = new Map<string, { met: number; total: number }>();
  const escByMonth = new Map<string, number>();

  for (const r of records) {
    byStatus.set(r.approval_status, (byStatus.get(r.approval_status) || 0) + 1);
    byDept.set(r.department || 'Unassigned', (byDept.get(r.department || 'Unassigned') || 0) + 1);
    if (['Pending Approval', 'In Progress'].includes(r.approval_status)) {
      byApprover.set(r.approver_name || 'Unassigned', (byApprover.get(r.approver_name || 'Unassigned') || 0) + 1);
    }
    if (r.approval_status === 'Approved' && r.approval_date) {
      const m = r.approval_date.slice(0, 7);
      byMonth.set(m, (byMonth.get(m) || 0) + 1);
      if (r.started_at) {
        const days = (new Date(r.approval_date).getTime() - new Date(r.started_at).getTime()) / 86400000;
        const a = avgByMonth.get(m) || { total: 0, count: 0 };
        a.total += days; a.count++;
        avgByMonth.set(m, a);
      }
      const sla = slaByMonth.get(m) || { met: 0, total: 0 };
      sla.total++;
      if (r.due_date >= r.approval_date.split('T')[0]) sla.met++;
      slaByMonth.set(m, sla);
    }
    if (r.escalated && r.updated_at) {
      const m = r.updated_at.slice(0, 7);
      escByMonth.set(m, (escByMonth.get(m) || 0) + 1);
    }
  }

  return {
    statusDistribution: Array.from(byStatus.entries()).map(([name, value]) => ({ name, value })),
    approvalTimeline: Array.from(byMonth.entries()).sort(([a], [b]) => a.localeCompare(b)).slice(-12).map(([month, count]) => ({ month, count })),
    departmentApprovals: Array.from(byDept.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value),
    approverWorkload: Array.from(byApprover.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 10),
    averageApprovalDuration: Array.from(avgByMonth.entries()).sort(([a], [b]) => a.localeCompare(b)).slice(-12).map(([month, v]) => ({ month, days: Math.round((v.total / v.count) * 10) / 10 })),
    slaComplianceTrend: Array.from(slaByMonth.entries()).sort(([a], [b]) => a.localeCompare(b)).slice(-12).map(([month, v]) => ({ month, pct: v.total ? Math.round((v.met / v.total) * 100) : 100 })),
    escalationTrend: Array.from(escByMonth.entries()).sort(([a], [b]) => a.localeCompare(b)).slice(-12).map(([month, count]) => ({ month, count })),
  };
}

export function filterApprovalRecords(records: DocumentApprovalRecord[], filters: ApprovalFilters): DocumentApprovalRecord[] {
  let result = [...records];
  const today = todayStr();
  if (filters.status) result = result.filter((r) => r.approval_status === filters.status);
  if (filters.department) result = result.filter((r) => r.department === filters.department);
  if (filters.document_type) result = result.filter((r) => r.document_type === filters.document_type);
  if (filters.approver_id) result = result.filter((r) => r.approver_id === filters.approver_id || r.delegated_to === filters.approver_id);
  if (filters.approval_type) result = result.filter((r) => r.approval_type === filters.approval_type);
  if (filters.overdue) result = result.filter((r) => r.sla_status === 'Overdue');
  if (filters.delegated) result = result.filter((r) => Boolean(r.delegated_to));
  if (filters.escalated) result = result.filter((r) => r.escalated);
  if (filters.in_progress) result = result.filter((r) => r.approval_status === 'In Progress');
  if (filters.approved_today) result = result.filter((r) => r.approval_status === 'Approved' && r.approval_date?.startsWith(today));
  if (filters.rejected_today) result = result.filter((r) => r.approval_status === 'Rejected' && r.approval_date?.startsWith(today));
  if (filters.returned) result = result.filter((r) => r.approval_status === 'Returned');
  if (filters.search) {
    const q = filters.search.toLowerCase();
    result = result.filter((r) =>
      r.approval_number.toLowerCase().includes(q) ||
      r.document_number.toLowerCase().includes(q) ||
      r.document_title.toLowerCase().includes(q) ||
      r.approver_name.toLowerCase().includes(q),
    );
  }
  return result;
}

export function getPendingApprovals(records: DocumentApprovalRecord[]) {
  return records.filter((r) => ['Pending Approval', 'In Progress'].includes(r.approval_status));
}

export function getOverdueApprovals(records: DocumentApprovalRecord[]) {
  return records.filter((r) => r.sla_status === 'Overdue' && !['Approved', 'Rejected', 'Cancelled'].includes(r.approval_status));
}

export function getRecentlyApproved(records: DocumentApprovalRecord[]) {
  return records.filter((r) => r.approval_status === 'Approved')
    .sort((a, b) => (b.approval_date || b.updated_at).localeCompare(a.approval_date || a.updated_at)).slice(0, 20);
}

export function getReturnedDocuments(records: DocumentApprovalRecord[]) {
  return records.filter((r) => r.approval_status === 'Returned' || r.approval_decision === 'Returned For Revision');
}

export function getDelegatedApprovals(records: DocumentApprovalRecord[]) {
  return records.filter((r) => Boolean(r.delegated_to));
}

export function getEscalatedApprovals(records: DocumentApprovalRecord[]) {
  return records.filter((r) => r.escalated);
}

export function getApproverQueue(records: DocumentApprovalRecord[], approverId?: string) {
  return records.filter((r) =>
    ['Pending Approval', 'In Progress'].includes(r.approval_status) &&
    (!approverId || r.approver_id === approverId || r.delegated_to === approverId),
  );
}

export function getApprovalHistory(records: DocumentApprovalRecord[]) {
  return [...records].sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}

export const APPROVAL_KPI_FILTER_MAP: Record<string, Partial<ApprovalFilters>> = {
  pending: { status: 'Pending Approval' },
  in_progress: { in_progress: true },
  approved_today: { approved_today: true },
  rejected_today: { rejected_today: true },
  returned: { returned: true },
  overdue: { overdue: true },
  delegated: { delegated: true },
  escalated: { escalated: true },
};
