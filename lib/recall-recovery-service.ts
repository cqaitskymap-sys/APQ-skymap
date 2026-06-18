import {
  addDoc, collection, doc, getDoc, getDocs, limit, orderBy, query, updateDoc, where,
} from 'firebase/firestore';
import { createAuditLog } from '@/lib/audit-trail';
import { getFirebaseFirestore } from '@/lib/firebase';
import { downloadCsv } from '@/lib/export-utils';
import {
  buildDistributionId,
  buildRecoveryId,
  computeCustomerRecoveryRows,
  computeMarketRecoveryRows,
  computeRecoveryDashboardMetrics,
  computeRecoveryTrend,
  normalizeDistribution,
  normalizeRecovery,
  RECALL_RECOVERY_MODULE,
  resolveRecallStatusAfterRecovery,
  shouldNotifyClassIPending,
  type RecallRecoveryActor,
} from '@/lib/recall-recovery-records';
import { getRecallById, listRecalls } from '@/lib/recall-service';
import type { DistributionInput, RecoveryTrackingInput } from '@/lib/recall-schemas';
import {
  RECALL_COLLECTIONS,
  calcRecoveryPercent,
  calcPendingQuantity,
  deriveRecoveryStatus,
  isFollowUpOverdue,
  type RecallDistribution,
  type RecallRecord,
  type RecallRecovery,
} from '@/lib/recall-types';

export type { RecallRecoveryActor };

const now = () => new Date().toISOString();
const today = () => new Date().toISOString().split('T')[0];

async function audit(
  actor: RecallRecoveryActor,
  actionType: string,
  recallId: string,
  detail: string,
  recordId?: string,
  oldValue?: unknown,
  newValue?: unknown,
) {
  try {
    await createAuditLog({
      moduleName: RECALL_RECOVERY_MODULE,
      collectionName: RECALL_COLLECTIONS.recovery,
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
    console.error('recall recovery audit', e);
  }
}

async function notify(title: string, message: string, recallId: string, roles: string[]) {
  try {
    for (const role of roles) {
      await addDoc(collection(getFirebaseFirestore(), RECALL_COLLECTIONS.notifications), {
        title,
        message,
        module: RECALL_RECOVERY_MODULE,
        record_id: recallId,
        target_role: role,
        read: false,
        created_at: now(),
      });
    }
  } catch (e) {
    console.error('recall recovery notify', e);
  }
}

async function generateDistributionId(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `DIST/${year}/`;
  try {
    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), RECALL_COLLECTIONS.distribution),
      where('distribution_id', '>=', prefix),
      where('distribution_id', '<=', `${prefix}\uf8ff`),
      orderBy('distribution_id', 'desc'),
      limit(1),
    ));
    if (!snap.empty) {
      const last = String(snap.docs[0].data().distribution_id || '');
      const seq = parseInt(last.split('/').pop() || '0', 10) + 1;
      return buildDistributionId(year, seq);
    }
  } catch {
    const snap = await getDocs(collection(getFirebaseFirestore(), RECALL_COLLECTIONS.distribution));
    return buildDistributionId(year, snap.size + 1);
  }
  return buildDistributionId(year, 1);
}

async function generateRecoveryId(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `RCV/${year}/`;
  try {
    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), RECALL_COLLECTIONS.recovery),
      where('recovery_id', '>=', prefix),
      where('recovery_id', '<=', `${prefix}\uf8ff`),
      orderBy('recovery_id', 'desc'),
      limit(1),
    ));
    if (!snap.empty) {
      const last = String(snap.docs[0].data().recovery_id || '');
      const seq = parseInt(last.split('/').pop() || '0', 10) + 1;
      return buildRecoveryId(year, seq);
    }
  } catch {
    const snap = await getDocs(collection(getFirebaseFirestore(), RECALL_COLLECTIONS.recovery));
    return buildRecoveryId(year, snap.size + 1);
  }
  return buildRecoveryId(year, 1);
}

async function syncRecallTotals(recallId: string, actor: RecallRecoveryActor): Promise<RecallRecord | null> {
  const recall = await getRecallById(recallId);
  if (!recall) return null;

  const [distributions, recoveries] = await Promise.all([
    getRecallDistributions(recallId),
    getRecallRecoveries(recallId),
  ]);

  const totalDistributed = distributions.reduce((s, d) => s + d.quantity_distributed, 0);
  const totalRecovered = recoveries.reduce((s, r) => s + r.quantity_recovered, 0);
  const recoveryPercent = calcRecoveryPercent(totalDistributed, totalRecovered);
  const recallStatus = resolveRecallStatusAfterRecovery(recall, recoveryPercent);

  const payload = {
    distributed_quantity: totalDistributed,
    recovered_quantity: totalRecovered,
    recovery_percent: recoveryPercent,
    recall_status: recallStatus,
    updated_by: actor.id,
    updated_by_name: actor.name,
    updated_at: now(),
  };

  await updateDoc(doc(getFirebaseFirestore(), RECALL_COLLECTIONS.records, recallId), payload);
  return { ...recall, ...payload } as RecallRecord;
}

async function runAutoRules(
  recall: RecallRecord,
  recoveries: RecallRecovery[],
  actor: RecallRecoveryActor,
) {
  const overdue = recoveries.filter((r) => r.follow_up_required && isFollowUpOverdue(r.follow_up_date));
  if (overdue.length > 0) {
    await notify(
      'Recall Follow-Up Overdue',
      `${overdue.length} follow-up(s) overdue for recall ${recall.recall_number}`,
      recall.id,
      ['qa', 'warehouse', 'head_qa'],
    );
  }

  if (shouldNotifyClassIPending(recall, recoveries)) {
    await notify(
      'Class I Recovery Pending',
      `Class I recall ${recall.recall_number} has pending customer recovery`,
      recall.id,
      ['head_qa', 'regulatory_affairs'],
    );
  }
}

export async function getRecallDistributions(recallId: string): Promise<RecallDistribution[]> {
  const snap = await getDocs(query(
    collection(getFirebaseFirestore(), RECALL_COLLECTIONS.distribution),
    where('recall_id', '==', recallId),
  ));
  return snap.docs.map((d) => normalizeDistribution({ id: d.id, ...d.data() } as RecallDistribution));
}

export async function getRecallRecoveries(recallId: string): Promise<RecallRecovery[]> {
  const snap = await getDocs(query(
    collection(getFirebaseFirestore(), RECALL_COLLECTIONS.recovery),
    where('recall_id', '==', recallId),
  ));
  return snap.docs.map((d) => normalizeRecovery({ id: d.id, ...d.data() } as RecallRecovery));
}

export async function getRecallRecoveryAuditLogs(recallId: string): Promise<Record<string, unknown>[]> {
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
    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), RECALL_COLLECTIONS.auditLogs),
      where('recordId', '==', recallId),
      limit(100),
    ));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Record<string, unknown>));
  }
}

export async function fetchRecallRecoveryPageData(recallId: string) {
  const recall = await getRecallById(recallId);
  if (!recall) return null;

  const [distributions, recoveries, auditLogs] = await Promise.all([
    getRecallDistributions(recallId),
    getRecallRecoveries(recallId),
    getRecallRecoveryAuditLogs(recallId),
  ]);

  return {
    recall,
    distributions,
    recoveries,
    auditLogs,
    metrics: computeRecoveryDashboardMetrics(distributions, recoveries),
    customerRows: computeCustomerRecoveryRows(recoveries),
    marketRows: computeMarketRecoveryRows(recoveries),
    trend: computeRecoveryTrend(recoveries),
  };
}

export async function listRecallsForRecoveryTracking(): Promise<RecallRecord[]> {
  const records = await listRecalls();
  return records.filter((r) => !['draft', 'cancelled'].includes(r.recall_status));
}

export async function addRecallDistributionRecord(
  recallId: string,
  input: DistributionInput,
  actor: RecallRecoveryActor,
): Promise<RecallDistribution> {
  const recall = await getRecallById(recallId);
  if (!recall) throw new Error('Recall not found');

  const timestamp = now();
  const distributionId = await generateDistributionId();
  const payload: Omit<RecallDistribution, 'id'> = {
    distribution_id: distributionId,
    recall_id: recallId,
    recall_number: recall.recall_number,
    product_name: recall.product_name,
    batch_number: recall.batch_number,
    customer_name: input.customer_name,
    market_region: input.market_region,
    invoice_number: input.invoice_number || '',
    dispatch_date: input.dispatch_date,
    distribution_date: input.distribution_date,
    quantity_distributed: input.quantity_distributed,
    unit: input.unit || 'Units',
    contact_person: input.contact_person || '',
    contact_email: input.contact_email || '',
    contact_phone: input.contact_phone || '',
    contact_details: input.contact_details || '',
    notification_sent: input.notification_sent ?? false,
    notification_date: input.notification_date || null,
    recovery_required: input.recovery_required ?? true,
    remarks: input.remarks || '',
    created_by: actor.id,
    created_by_name: actor.name,
    created_at: timestamp,
    updated_at: timestamp,
  };

  const ref = await addDoc(collection(getFirebaseFirestore(), RECALL_COLLECTIONS.distribution), payload);
  await syncRecallTotals(recallId, actor);

  if (input.notification_sent) {
    await audit(actor, 'CUSTOMER_NOTIFIED', recallId, `Customer ${input.customer_name} notified`, ref.id, null, payload);
  } else {
    await audit(actor, 'DISTRIBUTION_ADDED', recallId, `Distribution ${distributionId} added for ${input.customer_name}`, ref.id, null, payload);
  }

  return { id: ref.id, ...payload };
}

export async function markCustomerNotified(
  recallId: string,
  distributionId: string,
  actor: RecallRecoveryActor,
  notificationDate?: string,
): Promise<RecallDistribution> {
  const ref = doc(getFirebaseFirestore(), RECALL_COLLECTIONS.distribution, distributionId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Distribution record not found');

  const payload = {
    notification_sent: true,
    notification_date: notificationDate || today(),
    updated_at: now(),
  };
  await updateDoc(ref, payload);
  await audit(actor, 'CUSTOMER_NOTIFIED', recallId, 'Customer notification recorded', distributionId, snap.data(), payload);
  return normalizeDistribution({ id: snap.id, ...snap.data(), ...payload } as RecallDistribution);
}

export async function upsertRecallRecoveryRecord(
  recallId: string,
  input: RecoveryTrackingInput,
  actor: RecallRecoveryActor,
  existingId?: string,
): Promise<RecallRecovery> {
  const recall = await getRecallById(recallId);
  if (!recall) throw new Error('Recall not found');

  const pending = calcPendingQuantity(input.distributed_quantity, input.quantity_recovered);
  const recoveryPercent = calcRecoveryPercent(input.distributed_quantity, input.quantity_recovered);
  const recoveryStatus = deriveRecoveryStatus(
    input.distributed_quantity,
    input.quantity_recovered,
    input.recovery_status,
  );

  const timestamp = now();
  const base = {
    recall_id: recallId,
    recall_number: recall.recall_number,
    distribution_id: input.distribution_id || null,
    customer_name: input.customer_name,
    market_region: input.market_region,
    distributed_quantity: input.distributed_quantity,
    quantity_recovered: input.quantity_recovered,
    pending_quantity: pending,
    recovery_percent: recoveryPercent,
    recovery_date: input.recovery_date || today(),
    recovered_by: actor.id,
    recovered_by_name: input.recovered_by_name || actor.name,
    recovery_status: recoveryStatus,
    reason_for_pending: input.reason_for_pending || '',
    follow_up_required: input.follow_up_required ?? false,
    follow_up_date: input.follow_up_date || null,
    remarks: input.remarks || '',
    recovered_from: input.customer_name,
    recorded_by: actor.id,
    recorded_by_name: actor.name,
    updated_at: timestamp,
  };

  let record: RecallRecovery;
  if (existingId) {
    const ref = doc(getFirebaseFirestore(), RECALL_COLLECTIONS.recovery, existingId);
    const prev = await getDoc(ref);
    if (!prev.exists()) throw new Error('Recovery record not found');
    await updateDoc(ref, base);
    record = normalizeRecovery({ id: existingId, ...prev.data(), ...base } as RecallRecovery);
    await audit(actor, 'RECOVERY_UPDATED', recallId, `Recovery updated for ${input.customer_name}`, existingId, prev.data(), base);
  } else {
    const recoveryId = await generateRecoveryId();
    const payload = { ...base, recovery_id: recoveryId, created_at: timestamp };
    const ref = await addDoc(collection(getFirebaseFirestore(), RECALL_COLLECTIONS.recovery), payload);
    record = normalizeRecovery({ id: ref.id, ...payload });
    const action = input.follow_up_required ? 'FOLLOW_UP_CREATED' : 'RECOVERY_CREATED';
    await audit(actor, action, recallId, `Recovery ${recoveryId} for ${input.customer_name}`, ref.id, null, payload);
  }

  const updatedRecall = await syncRecallTotals(recallId, actor);
  const recoveries = await getRecallRecoveries(recallId);
  if (updatedRecall) await runAutoRules(updatedRecall, recoveries, actor);

  return record;
}

export async function closeRecoveryRecord(
  recallId: string,
  recoveryId: string,
  actor: RecallRecoveryActor,
  remarks?: string,
): Promise<RecallRecovery> {
  const ref = doc(getFirebaseFirestore(), RECALL_COLLECTIONS.recovery, recoveryId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Recovery record not found');

  const payload = {
    recovery_status: 'Closed',
    remarks: remarks || snap.data().remarks || '',
    updated_at: now(),
  };
  await updateDoc(ref, payload);
  await audit(actor, 'RECOVERY_CLOSED', recallId, `Recovery closed for ${snap.data().customer_name || snap.data().recovered_from}`, recoveryId, snap.data(), payload);
  await syncRecallTotals(recallId, actor);
  return normalizeRecovery({ id: snap.id, ...snap.data(), ...payload } as RecallRecovery);
}

export function exportRecoveryReportPlaceholder(
  recall: RecallRecord,
  recoveries: RecallRecovery[],
) {
  downloadCsv(
    `recall-recovery-${recall.recall_number.replace(/\//g, '-')}.csv`,
    ['Customer', 'Market', 'Distributed', 'Recovered', 'Pending', 'Recovery %', 'Status', 'Follow Up'],
    recoveries.map((r) => {
      const n = normalizeRecovery(r);
      return [
        n.customer_name,
        n.market_region,
        String(n.distributed_quantity),
        String(n.quantity_recovered),
        String(n.pending_quantity),
        String(n.recovery_percent),
        n.recovery_status,
        n.follow_up_required ? (n.follow_up_date || 'Yes') : 'No',
      ];
    }),
  );
}

export async function exportRecoveryReport(
  recallId: string,
  actor: RecallRecoveryActor,
): Promise<void> {
  const data = await fetchRecallRecoveryPageData(recallId);
  if (!data) throw new Error('Recall not found');
  exportRecoveryReportPlaceholder(data.recall, data.recoveries);
  await audit(actor, 'EXPORT_REPORT', recallId, `Recovery report exported for ${data.recall.recall_number}`);
}
