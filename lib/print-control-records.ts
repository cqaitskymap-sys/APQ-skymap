import type {
  PrintRequestRecord, PrintCopyRecord, PrintControlKpis, PrintControlCharts, PrintControlFilters,
} from './print-control-types';
import { isControlledPrintType } from './print-control-types';

function monthKey(d: string) { return d.slice(0, 7); }

export function mapPrintRequestRaw(raw: Record<string, unknown> & { id: string }): PrintRequestRecord {
  return {
    id: raw.id,
    print_request_id: (raw.print_request_id as string) || raw.id,
    print_number: (raw.print_number as string) || '',
    document_id: (raw.document_id as string) || '',
    document_number: (raw.document_number as string) || '',
    document_title: (raw.document_title as string) || '',
    document_type: (raw.document_type as string) || '',
    version: (raw.version as string) || '',
    print_reason: (raw.print_reason as string) || '',
    print_type: (raw.print_type as string) || 'Controlled Copy',
    print_status: (raw.print_status as string) || 'Draft',
    controlled_copy_number: (raw.controlled_copy_number as string) || '',
    total_copies: (raw.total_copies as number) || 0,
    issued_copies: (raw.issued_copies as number) || 0,
    returned_copies: (raw.returned_copies as number) || 0,
    destroyed_copies: (raw.destroyed_copies as number) || 0,
    print_location: (raw.print_location as string) || '',
    printer: (raw.printer as string) || '',
    department: (raw.department as string) || '',
    site: (raw.site as string) || '',
    requestor_id: (raw.requestor_id as string) || '',
    requestor_name: (raw.requestor_name as string) || '',
    approver_id: (raw.approver_id as string) || '',
    approver_name: (raw.approver_name as string) || '',
    issued_to: (raw.issued_to as string) || '',
    issued_to_name: (raw.issued_to_name as string) || '',
    issue_date: (raw.issue_date as string) || null,
    return_due_date: (raw.return_due_date as string) || null,
    return_date: (raw.return_date as string) || null,
    reconciliation_status: (raw.reconciliation_status as string) || 'Pending',
    destruction_status: (raw.destruction_status as string) || 'Pending',
    electronic_signature_required: Boolean(raw.electronic_signature_required),
    print_watermark: (raw.print_watermark as string) || '',
    barcode: (raw.barcode as string) || '',
    qr_code: (raw.qr_code as string) || '',
    created_by: (raw.created_by as string) || '',
    created_by_name: (raw.created_by_name as string) || '',
    updated_by: (raw.updated_by as string) || '',
    updated_by_name: (raw.updated_by_name as string) || '',
    created_at: (raw.created_at as string) || '',
    updated_at: (raw.updated_at as string) || '',
  };
}

export function mapPrintCopyRaw(raw: Record<string, unknown> & { id: string }): PrintCopyRecord {
  return {
    id: raw.id,
    copy_id: (raw.copy_id as string) || raw.id,
    controlled_copy_number: (raw.controlled_copy_number as string) || '',
    print_request_id: (raw.print_request_id as string) || '',
    print_number: (raw.print_number as string) || '',
    document_id: (raw.document_id as string) || '',
    document_number: (raw.document_number as string) || '',
    document_title: (raw.document_title as string) || '',
    version: (raw.version as string) || '',
    print_type: (raw.print_type as string) || '',
    copy_status: (raw.copy_status as string) || 'Printed',
    barcode: (raw.barcode as string) || '',
    qr_code: (raw.qr_code as string) || '',
    print_watermark: (raw.print_watermark as string) || '',
    issued_to: (raw.issued_to as string) || '',
    issued_to_name: (raw.issued_to_name as string) || '',
    issue_date: (raw.issue_date as string) || null,
    return_due_date: (raw.return_due_date as string) || null,
    return_date: (raw.return_date as string) || null,
    reconciliation_status: (raw.reconciliation_status as string) || 'Pending',
    destruction_status: (raw.destruction_status as string) || 'Pending',
    is_replacement: Boolean(raw.is_replacement),
    replaced_copy_id: (raw.replaced_copy_id as string) || null,
    department: (raw.department as string) || '',
    site: (raw.site as string) || '',
    print_location: (raw.print_location as string) || '',
    printer: (raw.printer as string) || '',
    created_at: (raw.created_at as string) || '',
    updated_at: (raw.updated_at as string) || '',
  };
}

export function emptyPrintKpis(): PrintControlKpis {
  return {
    printRequests: 0, controlledCopies: 0, issuedCopies: 0, returnedCopies: 0,
    outstandingCopies: 0, destroyedCopies: 0, pendingApprovals: 0, reconciliationPending: 0,
  };
}

export function emptyPrintCharts(): PrintControlCharts {
  return {
    printTrend: [], documentTypeDistribution: [], departmentPrinting: [],
    controlledVsUncontrolled: [], outstandingCopyTrend: [], destructionTrend: [],
  };
}

export function isOutstandingCopy(c: PrintCopyRecord): boolean {
  return c.copy_status === 'Issued' && !c.return_date;
}

export function computePrintKpis(requests: PrintRequestRecord[], copies: PrintCopyRecord[]): PrintControlKpis {
  return {
    printRequests: requests.length,
    controlledCopies: copies.filter((c) => isControlledPrintType(c.print_type)).length,
    issuedCopies: copies.filter((c) => c.copy_status === 'Issued').length,
    returnedCopies: copies.filter((c) => ['Returned', 'Reconciled'].includes(c.copy_status)).length,
    outstandingCopies: copies.filter(isOutstandingCopy).length,
    destroyedCopies: copies.filter((c) => c.copy_status === 'Destroyed').length,
    pendingApprovals: requests.filter((r) => r.print_status === 'Pending Approval').length,
    reconciliationPending: copies.filter((c) => c.reconciliation_status === 'Pending' && c.copy_status === 'Returned').length,
  };
}

export function computePrintCharts(requests: PrintRequestRecord[], copies: PrintCopyRecord[]): PrintControlCharts {
  const printByMonth = new Map<string, number>();
  const byType = new Map<string, number>();
  const byDept = new Map<string, number>();
  const controlled = copies.filter((c) => isControlledPrintType(c.print_type)).length;
  const uncontrolled = copies.length - controlled;
  const outstandingByMonth = new Map<string, number>();
  const destructionByMonth = new Map<string, number>();

  for (const r of requests) {
    byType.set(r.document_type || 'Unknown', (byType.get(r.document_type || 'Unknown') || 0) + 1);
    byDept.set(r.department || 'Unknown', (byDept.get(r.department || 'Unknown') || 0) + 1);
    if (r.created_at) printByMonth.set(monthKey(r.created_at), (printByMonth.get(monthKey(r.created_at)) || 0) + 1);
  }
  for (const c of copies) {
    if (isOutstandingCopy(c) && c.issue_date) {
      outstandingByMonth.set(monthKey(c.issue_date), (outstandingByMonth.get(monthKey(c.issue_date)) || 0) + 1);
    }
    if (c.copy_status === 'Destroyed' && c.updated_at) {
      destructionByMonth.set(monthKey(c.updated_at), (destructionByMonth.get(monthKey(c.updated_at)) || 0) + 1);
    }
  }

  const toSorted = (m: Map<string, number>) =>
    Array.from(m.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([month, count]) => ({ month, count }));

  return {
    printTrend: toSorted(printByMonth),
    documentTypeDistribution: Array.from(byType.entries()).map(([name, value]) => ({ name, value })),
    departmentPrinting: Array.from(byDept.entries()).map(([name, value]) => ({ name, value })),
    controlledVsUncontrolled: [
      { name: 'Controlled', value: controlled },
      { name: 'Uncontrolled', value: uncontrolled },
    ],
    outstandingCopyTrend: toSorted(outstandingByMonth),
    destructionTrend: toSorted(destructionByMonth),
  };
}

export function filterPrintRequests(requests: PrintRequestRecord[], filters: PrintControlFilters): PrintRequestRecord[] {
  let result = [...requests];
  if (filters.search) {
    const q = filters.search.toLowerCase();
    result = result.filter((r) =>
      r.print_number.toLowerCase().includes(q) || r.document_number.toLowerCase().includes(q) ||
      r.document_title.toLowerCase().includes(q),
    );
  }
  if (filters.status) result = result.filter((r) => r.print_status === filters.status);
  if (filters.department) result = result.filter((r) => r.department === filters.department);
  if (filters.document_type) result = result.filter((r) => r.document_type === filters.document_type);
  if (filters.print_type) result = result.filter((r) => r.print_type === filters.print_type);
  if (filters.pending_approval) result = result.filter((r) => r.print_status === 'Pending Approval');
  if (filters.department_only) result = result.filter((r) => r.department === filters.department_only);
  return result;
}

export function filterPrintCopies(copies: PrintCopyRecord[], filters: PrintControlFilters): PrintCopyRecord[] {
  let result = [...copies];
  if (filters.outstanding) result = result.filter(isOutstandingCopy);
  if (filters.pending_return) result = result.filter((c) => c.copy_status === 'Issued' && c.return_due_date);
  if (filters.reconciliation) result = result.filter((c) => c.reconciliation_status === 'Pending' && c.copy_status === 'Returned');
  if (filters.destroyed) result = result.filter((c) => c.copy_status === 'Destroyed');
  if (filters.replacement) result = result.filter((c) => c.is_replacement);
  if (filters.department_only) result = result.filter((c) => c.department === filters.department_only);
  return result;
}

export const PCM_KPI_FILTER_MAP: Record<string, PrintControlFilters> = {
  requests: {},
  controlled: { print_type: 'Controlled Copy' },
  issued: { outstanding: true },
  returned: { status: 'Returned' },
  outstanding: { outstanding: true },
  destroyed: { destroyed: true },
  approval: { pending_approval: true },
  reconciliation: { reconciliation: true },
};

export function getRecentRequests(requests: PrintRequestRecord[]): PrintRequestRecord[] {
  return [...requests].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 50);
}
export function getPendingApprovals(requests: PrintRequestRecord[]): PrintRequestRecord[] {
  return requests.filter((r) => r.print_status === 'Pending Approval');
}
export function getOutstandingCopies(copies: PrintCopyRecord[]): PrintCopyRecord[] {
  return copies.filter(isOutstandingCopy);
}
export function getPendingReturns(copies: PrintCopyRecord[]): PrintCopyRecord[] {
  return copies.filter((c) => c.copy_status === 'Issued');
}
export function getPendingReconciliation(copies: PrintCopyRecord[]): PrintCopyRecord[] {
  return copies.filter((c) => c.reconciliation_status === 'Pending' && c.copy_status === 'Returned');
}
export function getDestroyedCopies(copies: PrintCopyRecord[]): PrintCopyRecord[] {
  return copies.filter((c) => c.copy_status === 'Destroyed');
}
export function getReplacementCopies(copies: PrintCopyRecord[]): PrintCopyRecord[] {
  return copies.filter((c) => c.is_replacement);
}
