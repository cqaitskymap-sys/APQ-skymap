import {
  calcPendingQuantity,
  calcRecoveryPercent,
  deriveRecoveryStatus,
  isFollowUpOverdue,
  isRecallCritical,
  RECALL_RECOVERY_TARGET_PERCENT,
  type RecallDistribution,
  type RecallMarketRecoveryRow,
  type RecallCustomerRecoveryRow,
  type RecallRecord,
  type RecallRecovery,
  type RecallRecoveryDashboardMetrics,
  type RecallRecoveryTrendPoint,
} from '@/lib/recall-types';
import { normalizeRole } from '@/lib/permissions';

export const RECALL_RECOVERY_MODULE = 'Recall Recovery & Distribution';

export type RecallRecoveryActor = {
  id: string;
  name: string;
  role: string;
};

export function buildDistributionId(year: number, seq: number): string {
  return `DIST/${year}/${String(seq).padStart(4, '0')}`;
}

export function buildRecoveryId(year: number, seq: number): string {
  return `RCV/${year}/${String(seq).padStart(4, '0')}`;
}

export function normalizeDistribution(row: RecallDistribution): RecallDistribution {
  const dispatch = row.dispatch_date || row.distribution_date || '';
  return {
    ...row,
    dispatch_date: dispatch,
    distribution_date: dispatch,
    contact_details: row.contact_details
      || [row.contact_person, row.contact_email, row.contact_phone].filter(Boolean).join(' | '),
    notification_sent: row.notification_sent ?? false,
    recovery_required: row.recovery_required ?? true,
  };
}

export function normalizeRecovery(row: RecallRecovery): RecallRecovery {
  const customer = row.customer_name || row.recovered_from || '';
  const distributed = row.distributed_quantity ?? 0;
  const recovered = row.quantity_recovered ?? 0;
  const pending = row.pending_quantity ?? calcPendingQuantity(distributed, recovered);
  const percent = row.recovery_percent ?? calcRecoveryPercent(distributed, recovered);
  return {
    ...row,
    customer_name: customer,
    recovered_from: row.recovered_from || customer,
    pending_quantity: pending,
    recovery_percent: percent,
    recovery_status: deriveRecoveryStatus(distributed, recovered, row.recovery_status),
  };
}

export function computeRecoveryDashboardMetrics(
  distributions: RecallDistribution[],
  recoveries: RecallRecovery[],
): RecallRecoveryDashboardMetrics {
  const dists = distributions.map(normalizeDistribution);
  const recs = recoveries.map(normalizeRecovery);

  const totalDistributed = dists.reduce((s, d) => s + (d.quantity_distributed || 0), 0);
  const totalRecovered = recs.reduce((s, r) => s + (r.quantity_recovered || 0), 0);
  const totalPending = Math.max(0, totalDistributed - totalRecovered);
  const averageRecoveryPercent = calcRecoveryPercent(totalDistributed, totalRecovered);

  const customersNotified = dists.filter((d) => d.notification_sent).length;
  const customersPendingResponse = dists.filter((d) => d.recovery_required && !d.notification_sent).length;
  const followUpsDue = recs.filter((r) => r.follow_up_required && r.follow_up_date).length;
  const overdueFollowUps = recs.filter((r) => r.follow_up_required && isFollowUpOverdue(r.follow_up_date)).length;

  return {
    totalDistributed,
    totalRecovered,
    totalPending,
    averageRecoveryPercent,
    customersNotified,
    customersPendingResponse,
    followUpsDue,
    overdueFollowUps,
  };
}

export function computeCustomerRecoveryRows(recoveries: RecallRecovery[]): RecallCustomerRecoveryRow[] {
  return recoveries.map(normalizeRecovery).map((r) => ({
    customer_name: r.customer_name,
    market_region: r.market_region,
    distributed_quantity: r.distributed_quantity,
    quantity_recovered: r.quantity_recovered,
    pending_quantity: r.pending_quantity,
    recovery_percent: r.recovery_percent,
    recovery_status: r.recovery_status,
    follow_up_required: r.follow_up_required ?? false,
    follow_up_date: r.follow_up_date,
  }));
}

export function computeMarketRecoveryRows(recoveries: RecallRecovery[]): RecallMarketRecoveryRow[] {
  const map = new Map<string, RecallMarketRecoveryRow>();
  for (const r of recoveries.map(normalizeRecovery)) {
    const key = r.market_region || 'Unknown';
    const existing = map.get(key) || {
      market_region: key,
      distributed_quantity: 0,
      quantity_recovered: 0,
      pending_quantity: 0,
      recovery_percent: 0,
      customer_count: 0,
    };
    existing.distributed_quantity += r.distributed_quantity;
    existing.quantity_recovered += r.quantity_recovered;
    existing.pending_quantity += r.pending_quantity;
    existing.customer_count += 1;
    map.set(key, existing);
  }
  return Array.from(map.values()).map((row) => ({
    ...row,
    recovery_percent: calcRecoveryPercent(row.distributed_quantity, row.quantity_recovered),
  }));
}

export function computeRecoveryTrend(recoveries: RecallRecovery[]): RecallRecoveryTrendPoint[] {
  const byMonth = new Map<string, { recovered: number; pending: number }>();
  for (const r of recoveries.map(normalizeRecovery)) {
    const month = (r.recovery_date || r.created_at || '').slice(0, 7);
    if (!month) continue;
    const cur = byMonth.get(month) || { recovered: 0, pending: 0 };
    cur.recovered += r.quantity_recovered;
    cur.pending += r.pending_quantity;
    byMonth.set(month, cur);
  }
  return Array.from(byMonth.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, v]) => ({
      name,
      recovered: v.recovered,
      pending: v.pending,
      percent: calcRecoveryPercent(v.recovered + v.pending, v.recovered),
    }));
}

export function shouldKeepRecoveryInProgress(
  recall: RecallRecord,
  averagePercent: number,
): boolean {
  if (averagePercent >= RECALL_RECOVERY_TARGET_PERCENT) return false;
  return ['initiated', 'in_progress', 'regulatory_notified', 'recovery_in_progress', 'completed'].includes(recall.recall_status);
}

export function resolveRecallStatusAfterRecovery(
  recall: RecallRecord,
  averagePercent: number,
  closureJustification?: string,
): string {
  if (averagePercent >= RECALL_RECOVERY_TARGET_PERCENT) {
    return recall.recall_status === 'closed' ? 'closed' : 'completed';
  }
  if (closureJustification?.trim() && averagePercent > 0) {
    return 'completed';
  }
  if (shouldKeepRecoveryInProgress(recall, averagePercent)) {
    return 'recovery_in_progress';
  }
  return recall.recall_status;
}

export function shouldNotifyClassIPending(recall: RecallRecord, recoveries: RecallRecovery[]): boolean {
  if (!isRecallCritical(recall)) return false;
  return recoveries.some((r) => {
    const n = normalizeRecovery(r);
    return n.pending_quantity > 0 && !['Not Recoverable', 'Closed', 'Recovered'].includes(String(n.recovery_status));
  });
}

export function mapRecoveryAuditAction(action: string): string {
  const map: Record<string, string> = {
    DISTRIBUTION_ADDED: 'Distribution Added',
    DISTRIBUTION_UPDATED: 'Distribution Updated',
    RECOVERY_UPDATED: 'Recovery Updated',
    RECOVERY_CREATED: 'Recovery Created',
    FOLLOW_UP_CREATED: 'Follow Up Created',
    CUSTOMER_NOTIFIED: 'Customer Notified',
    RECOVERY_CLOSED: 'Recovery Closed',
    EXPORT_REPORT: 'Export Report',
  };
  return map[action] || action;
}

export function canViewRecallRecoveryModule(role?: string | null): boolean {
  const r = normalizeRole(role);
  return [
    'super_admin', 'admin', 'head_qa', 'qa_manager', 'qa', 'qa_executive',
    'regulatory_affairs', 'warehouse', 'warehouse_manager', 'auditor', 'viewer',
  ].includes(r);
}

export function canAddDistributionRecord(role?: string | null): boolean {
  const r = normalizeRole(role);
  return ['super_admin', 'admin', 'warehouse', 'warehouse_manager'].includes(r);
}

export function canUpdateRecoveryRecord(role?: string | null): boolean {
  const r = normalizeRole(role);
  return ['super_admin', 'admin', 'warehouse', 'warehouse_manager', 'qa', 'qa_manager'].includes(r);
}

export function isRecoveryModuleReadOnly(role?: string | null): boolean {
  return normalizeRole(role) === 'auditor';
}
