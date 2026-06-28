import {
  addDoc, collection, doc, getDoc, getDocs, limit, orderBy, query, updateDoc, where,
} from 'firebase/firestore';
import { getFirebaseFirestore } from '@/lib/firebase';
import { logAuditEvent } from '@/lib/admin/admin-service';
import { downloadCsv } from '@/lib/export-utils';
import { listDocuments, getDocumentById } from '@/lib/dms-service';
import type {
  RetentionPolicyRecord, RetentionScheduleRecord, DisposalRequestRecord,
  DisposalCertificateRecord, RetentionDisposalFilters, RetentionDisposalActor,
} from './retention-disposal-types';
import {
  mapPolicyRaw, mapScheduleRaw, mapDisposalRequestRaw, mapCertificateRaw,
  computeRetentionKpis, computeRetentionCharts, filterSchedules, filterDisposals,
  addRetentionPeriod,
} from './retention-disposal-records';
import type {
  CreateRetentionPolicyInput, CreateDisposalRequestInput, ApproveDisposalInput,
  ApplyHoldInput, ReleaseHoldInput, BulkAssignRetentionInput,
} from './retention-disposal-schemas';
import { RDM_COLLECTIONS, RDM_MODULE, RETENTION_WARNING_DAYS } from './retention-disposal-types';

function now() { return new Date().toISOString(); }

async function audit(actor: RetentionDisposalActor, action: string, recordId: string, oldValue: unknown, newValue: unknown, reason = '') {
  await logAuditEvent({
    userId: actor.id, userName: actor.name, module: RDM_MODULE, recordId, action,
    oldValue: oldValue ? JSON.stringify(oldValue) : '',
    newValue: newValue ? JSON.stringify(newValue) : '',
    reason, ipAddress: 'client', device: typeof navigator !== 'undefined' ? navigator.userAgent : 'server',
    status: 'Success',
  });
}

async function notify(title: string, message: string, recordId: string, roles: string[] = []) {
  try {
    for (const role of roles) {
      await addDoc(collection(getFirebaseFirestore(), RDM_COLLECTIONS.notifications), {
        title, message, module: RDM_MODULE, record_id: recordId,
        target_role: role, read: false, created_at: now(),
      });
    }
  } catch (e) { console.error('RDM notification failed:', e); }
}

async function generateNumber(prefix: string, field: string, collectionName: string): Promise<string> {
  const year = new Date().getFullYear();
  const fullPrefix = `${prefix}-${year}-`;
  try {
    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), collectionName),
      where(field, '>=', fullPrefix),
      where(field, '<=', `${fullPrefix}\uf8ff`),
      orderBy(field, 'desc'),
      limit(1),
    ));
    if (!snap.empty) {
      const last = snap.docs[0].data()[field] as string;
      return `${fullPrefix}${String(parseInt(last.split('-').pop() || '0', 10) + 1).padStart(4, '0')}`;
    }
  } catch {
    const all = await getDocs(collection(getFirebaseFirestore(), collectionName));
    return `${fullPrefix}${String(all.size + 1).padStart(4, '0')}`;
  }
  return `${fullPrefix}0001`;
}

function resolveTriggerDate(doc: Awaited<ReturnType<typeof getDocumentById>>, trigger: string): string {
  const today = now().split('T')[0];
  if (!doc) return today;
  switch (trigger) {
    case 'Effective Date': return doc.effective_date || today;
    case 'Approval Date': return doc.updated_at?.split('T')[0] || today;
    case 'Superseded Date': return doc.status === 'superseded' ? today : (doc.updated_at?.split('T')[0] || today);
    case 'Archive Date': return today;
    case 'Retirement Date': return doc.status === 'retired' ? today : today;
    default: return today;
  }
}

async function listPolicies(): Promise<RetentionPolicyRecord[]> {
  try {
    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), RDM_COLLECTIONS.policies),
      orderBy('updated_at', 'desc'),
    ));
    return snap.docs.map((d) => mapPolicyRaw({ id: d.id, ...d.data() }));
  } catch {
    const snap = await getDocs(collection(getFirebaseFirestore(), RDM_COLLECTIONS.policies));
    return snap.docs.map((d) => mapPolicyRaw({ id: d.id, ...d.data() }))
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  }
}

async function listSchedules(): Promise<RetentionScheduleRecord[]> {
  try {
    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), RDM_COLLECTIONS.schedules),
      orderBy('updated_at', 'desc'),
    ));
    return snap.docs.map((d) => mapScheduleRaw({ id: d.id, ...d.data() }));
  } catch {
    const snap = await getDocs(collection(getFirebaseFirestore(), RDM_COLLECTIONS.schedules));
    return snap.docs.map((d) => mapScheduleRaw({ id: d.id, ...d.data() }))
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  }
}

async function listDisposals(): Promise<DisposalRequestRecord[]> {
  try {
    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), RDM_COLLECTIONS.disposalRequests),
      orderBy('updated_at', 'desc'),
    ));
    return snap.docs.map((d) => mapDisposalRequestRaw({ id: d.id, ...d.data() }));
  } catch {
    const snap = await getDocs(collection(getFirebaseFirestore(), RDM_COLLECTIONS.disposalRequests));
    return snap.docs.map((d) => mapDisposalRequestRaw({ id: d.id, ...d.data() }))
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  }
}

async function listCertificates(): Promise<DisposalCertificateRecord[]> {
  const snap = await getDocs(query(
    collection(getFirebaseFirestore(), RDM_COLLECTIONS.disposalCertificates),
    orderBy('created_at', 'desc'),
    limit(100),
  ));
  return snap.docs.map((d) => mapCertificateRaw({ id: d.id, ...d.data() }));
}

export async function createRetentionPolicy(input: CreateRetentionPolicyInput, actor: RetentionDisposalActor): Promise<RetentionPolicyRecord> {
  const policyNumber = await generateNumber('RP', 'policy_number', RDM_COLLECTIONS.policies);
  const timestamp = now();
  const payload = {
    retention_policy_id: policyNumber,
    policy_number: policyNumber,
    module: RDM_MODULE,
    ...input,
    owner: actor.id,
    status: 'Draft',
    created_by: actor.id,
    created_by_name: actor.name,
    updated_by: actor.id,
    updated_by_name: actor.name,
    created_at: timestamp,
    updated_at: timestamp,
  };
  const ref = await addDoc(collection(getFirebaseFirestore(), RDM_COLLECTIONS.policies), payload);
  await audit(actor, 'RETENTION_POLICY_CREATED', ref.id, null, payload);
  return mapPolicyRaw({ id: ref.id, ...payload });
}

export async function activateRetentionPolicy(policyId: string, actor: RetentionDisposalActor): Promise<void> {
  const snap = await getDoc(doc(getFirebaseFirestore(), RDM_COLLECTIONS.policies, policyId));
  if (!snap.exists()) throw new Error('Policy not found');
  await updateDoc(doc(getFirebaseFirestore(), RDM_COLLECTIONS.policies, policyId), {
    status: 'Active',
    updated_at: now(),
    updated_by: actor.id,
    updated_by_name: actor.name,
  });
  await audit(actor, 'RETENTION_POLICY_ACTIVATED', policyId, 'Draft', 'Active');
}

export async function assignRetentionSchedule(
  documentId: string,
  policyId: string,
  actor: RetentionDisposalActor,
): Promise<RetentionScheduleRecord> {
  const docRecord = await getDocumentById(documentId);
  if (!docRecord) throw new Error('Document not found');
  const policySnap = await getDoc(doc(getFirebaseFirestore(), RDM_COLLECTIONS.policies, policyId));
  if (!policySnap.exists()) throw new Error('Retention policy not found');
  const policy = mapPolicyRaw({ id: policySnap.id, ...policySnap.data() });

  const existing = await getDocs(query(
    collection(getFirebaseFirestore(), RDM_COLLECTIONS.schedules),
    where('document_id', '==', documentId),
    limit(10),
  ));
  if (existing.docs.some((d) => !['Disposed'].includes(String(d.data().retention_status || '')))) {
    throw new Error('Document already has an active retention schedule');
  }

  const scheduleNumber = await generateNumber('RS', 'schedule_number', RDM_COLLECTIONS.schedules);
  const triggerDate = resolveTriggerDate(docRecord, policy.retention_trigger);
  const expiryDate = addRetentionPeriod(triggerDate, policy.retention_period, policy.retention_unit);
  const timestamp = now();

  const payload = {
    schedule_id: scheduleNumber,
    schedule_number: scheduleNumber,
    module: RDM_MODULE,
    document_id: docRecord.id,
    document_number: docRecord.document_number,
    document_title: docRecord.document_title,
    document_type: docRecord.document_type,
    department: docRecord.department,
    policy_id: policyId,
    policy_number: policy.policy_number,
    policy_name: policy.policy_name,
    retention_trigger: policy.retention_trigger,
    trigger_date: triggerDate,
    retention_expiry_date: expiryDate,
    retention_status: 'Active',
    archive_id: null,
    legal_hold: false,
    regulatory_hold: false,
    disposal_request_id: null,
    created_at: timestamp,
    updated_at: timestamp,
  };

  const ref = await addDoc(collection(getFirebaseFirestore(), RDM_COLLECTIONS.schedules), payload);
  await addDoc(collection(getFirebaseFirestore(), RDM_COLLECTIONS.events), {
    schedule_id: ref.id,
    event_type: 'schedule_generated',
    document_id: documentId,
    created_at: timestamp,
  });
  await audit(actor, 'RETENTION_SCHEDULE_GENERATED', ref.id, null, payload);
  return mapScheduleRaw({ id: ref.id, ...payload });
}

export async function bulkAssignRetention(input: BulkAssignRetentionInput, actor: RetentionDisposalActor): Promise<number> {
  let count = 0;
  for (const docId of input.document_ids) {
    try {
      await assignRetentionSchedule(docId, input.policy_id, actor);
      count++;
    } catch { /* skip */ }
  }
  return count;
}

export async function createDisposalRequest(input: CreateDisposalRequestInput, actor: RetentionDisposalActor): Promise<DisposalRequestRecord> {
  const scheduleSnap = await getDoc(doc(getFirebaseFirestore(), RDM_COLLECTIONS.schedules, input.schedule_id));
  if (!scheduleSnap.exists()) throw new Error('Retention schedule not found');
  const schedule = mapScheduleRaw({ id: scheduleSnap.id, ...scheduleSnap.data() });

  if (schedule.legal_hold || schedule.regulatory_hold) {
    throw new Error('Cannot dispose record under legal or regulatory hold');
  }
  if (schedule.retention_status === 'Legal Hold' || schedule.retention_status === 'Regulatory Hold') {
    throw new Error('Record is on hold — disposal blocked');
  }
  const today = now().split('T')[0];
  if (schedule.retention_expiry_date && schedule.retention_expiry_date > today) {
    throw new Error('Retention period has not expired');
  }

  const requestNumber = await generateNumber('DR', 'request_number', RDM_COLLECTIONS.disposalRequests);
  const timestamp = now();
  const payload = {
    request_id: requestNumber,
    request_number: requestNumber,
    module: RDM_MODULE,
    schedule_id: input.schedule_id,
    document_id: schedule.document_id,
    document_number: schedule.document_number,
    document_title: schedule.document_title,
    disposal_method: input.disposal_method,
    disposal_reason: input.disposal_reason,
    status: 'Pending Approval',
    requested_by: actor.id,
    requested_by_name: actor.name,
    approved_by: '',
    approved_by_name: '',
    electronic_signature_required: input.electronic_signature_required,
    certificate_id: null,
    created_at: timestamp,
    updated_at: timestamp,
  };

  const ref = await addDoc(collection(getFirebaseFirestore(), RDM_COLLECTIONS.disposalRequests), payload);
  await updateDoc(doc(getFirebaseFirestore(), RDM_COLLECTIONS.schedules, input.schedule_id), {
    disposal_request_id: ref.id,
    updated_at: timestamp,
  });
  await audit(actor, 'DISPOSAL_REQUESTED', ref.id, null, payload);
  await notify('Disposal Approval Required', `${schedule.document_number} disposal pending approval`, ref.id, ['head_qa']);
  return mapDisposalRequestRaw({ id: ref.id, ...payload });
}

export async function approveDisposalRequest(requestId: string, input: ApproveDisposalInput, actor: RetentionDisposalActor): Promise<void> {
  const snap = await getDoc(doc(getFirebaseFirestore(), RDM_COLLECTIONS.disposalRequests, requestId));
  if (!snap.exists()) throw new Error('Disposal request not found');
  const req = mapDisposalRequestRaw({ id: snap.id, ...snap.data() });
  if (req.status !== 'Pending Approval') throw new Error('Request is not pending approval');
  if (req.electronic_signature_required && !input.signature_meaning?.trim()) {
    throw new Error('Electronic signature required for disposal approval');
  }

  const scheduleSnap = await getDoc(doc(getFirebaseFirestore(), RDM_COLLECTIONS.schedules, req.schedule_id));
  if (scheduleSnap.exists()) {
    const schedule = mapScheduleRaw({ id: scheduleSnap.id, ...scheduleSnap.data() });
    if (schedule.legal_hold || schedule.regulatory_hold) {
      throw new Error('Cannot approve disposal while hold is active');
    }
  }

  await updateDoc(doc(getFirebaseFirestore(), RDM_COLLECTIONS.disposalRequests, requestId), {
    status: 'Approved',
    approved_by: actor.id,
    approved_by_name: actor.name,
    updated_at: now(),
  });

  await addDoc(collection(getFirebaseFirestore(), RDM_COLLECTIONS.disposalApprovals), {
    disposal_request_id: requestId,
    approved_by: actor.id,
    approved_by_name: actor.name,
    comments: input.comments || '',
    created_at: now(),
  });

  if (input.signature_meaning) {
    await audit(actor, 'ELECTRONIC_SIGNATURE_COMPLETED', requestId, null, { meaning: input.signature_meaning });
  }
  await audit(actor, 'DISPOSAL_APPROVED', requestId, 'Pending Approval', 'Approved', input.comments);
}

export async function completeDisposal(requestId: string, actor: RetentionDisposalActor): Promise<DisposalCertificateRecord> {
  const snap = await getDoc(doc(getFirebaseFirestore(), RDM_COLLECTIONS.disposalRequests, requestId));
  if (!snap.exists()) throw new Error('Disposal request not found');
  const req = mapDisposalRequestRaw({ id: snap.id, ...snap.data() });
  if (req.status !== 'Approved') throw new Error('Disposal must be approved first');

  const certificateNumber = await generateNumber('DC', 'certificate_number', RDM_COLLECTIONS.disposalCertificates);
  const timestamp = now();
  const today = timestamp.split('T')[0];

  const certPayload = {
    certificate_id: certificateNumber,
    certificate_number: certificateNumber,
    disposal_request_id: requestId,
    document_number: req.document_number,
    document_title: req.document_title,
    disposal_method: req.disposal_method,
    disposed_by: actor.id,
    disposed_by_name: actor.name,
    disposal_date: today,
    witness: '',
    witness_name: '',
    created_at: timestamp,
  };

  const certRef = await addDoc(collection(getFirebaseFirestore(), RDM_COLLECTIONS.disposalCertificates), certPayload);

  await updateDoc(doc(getFirebaseFirestore(), RDM_COLLECTIONS.disposalRequests, requestId), {
    status: 'Completed',
    certificate_id: certRef.id,
    updated_at: timestamp,
  });

  await updateDoc(doc(getFirebaseFirestore(), RDM_COLLECTIONS.schedules, req.schedule_id), {
    retention_status: 'Disposed',
    updated_at: timestamp,
  });

  await audit(actor, 'RECORD_DISPOSED', requestId, 'Approved', 'Completed');
  await audit(actor, 'DISPOSAL_CERTIFICATE_GENERATED', certRef.id, null, certPayload);
  await notify('Disposal Completed', `${req.document_number} disposed — certificate ${certificateNumber}`, certRef.id, ['document_controller']);
  return mapCertificateRaw({ id: certRef.id, ...certPayload });
}

export async function applyHold(input: ApplyHoldInput, actor: RetentionDisposalActor): Promise<void> {
  const collectionName = input.hold_type === 'legal' ? RDM_COLLECTIONS.legalHolds : RDM_COLLECTIONS.regulatoryHolds;
  const timestamp = now();
  const holdRef = await addDoc(collection(getFirebaseFirestore(), collectionName), {
    schedule_id: input.schedule_id,
    document_id: input.document_id,
    reason: input.reason,
    status: 'Active',
    applied_by: actor.id,
    applied_by_name: actor.name,
    created_at: timestamp,
  });

  const updates: Record<string, string | boolean> = {
    updated_at: timestamp,
    retention_status: input.hold_type === 'legal' ? 'Legal Hold' : 'Regulatory Hold',
  };
  if (input.hold_type === 'legal') updates.legal_hold = true;
  else updates.regulatory_hold = true;

  await updateDoc(doc(getFirebaseFirestore(), RDM_COLLECTIONS.schedules, input.schedule_id), updates);
  const action = input.hold_type === 'legal' ? 'LEGAL_HOLD_APPLIED' : 'REGULATORY_HOLD_APPLIED';
  await audit(actor, action, holdRef.id, null, { reason: input.reason, schedule_id: input.schedule_id });
  await notify(`${input.hold_type === 'legal' ? 'Legal' : 'Regulatory'} Hold Applied`, input.document_id, holdRef.id, ['head_qa']);
}

export async function releaseHold(input: ReleaseHoldInput, actor: RetentionDisposalActor): Promise<void> {
  const collectionName = input.hold_type === 'legal' ? RDM_COLLECTIONS.legalHolds : RDM_COLLECTIONS.regulatoryHolds;
  const holdSnap = await getDoc(doc(getFirebaseFirestore(), collectionName, input.hold_id));
  if (!holdSnap.exists()) throw new Error('Hold record not found');
  const hold = holdSnap.data();
  const scheduleId = hold.schedule_id as string;

  await updateDoc(doc(getFirebaseFirestore(), collectionName, input.hold_id), {
    status: 'Released',
    released_by: actor.id,
    released_at: now(),
    release_reason: input.reason,
  });

  const updates: Record<string, string | boolean> = {
    updated_at: now(),
    retention_status: 'Active',
  };
  if (input.hold_type === 'legal') updates.legal_hold = false;
  else updates.regulatory_hold = false;

  await updateDoc(doc(getFirebaseFirestore(), RDM_COLLECTIONS.schedules, scheduleId), updates);
  const action = input.hold_type === 'legal' ? 'LEGAL_HOLD_RELEASED' : 'REGULATORY_HOLD_RELEASED';
  await audit(actor, action, input.hold_id, 'Active', 'Released', input.reason);
}

export async function syncRetentionSchedulesFromDocuments(): Promise<number> {
  const policies = (await listPolicies()).filter((p) => p.status === 'Active');
  if (!policies.length) return 0;
  const docs = await listDocuments();
  const schedules = await listSchedules();
  const scheduledDocIds = new Set(schedules.map((s) => s.document_id));
  const actor: RetentionDisposalActor = { id: 'system', name: 'System', role: 'system' };
  let created = 0;

  for (const d of docs.filter((doc) => ['archived', 'obsolete', 'retired', 'superseded', 'effective'].includes(doc.status))) {
    if (scheduledDocIds.has(d.id)) continue;
    const policy = policies.find((p) =>
      (!p.document_type || p.document_type === d.document_type) &&
      (!p.department || p.department === d.department),
    ) || policies[0];
    try {
      await assignRetentionSchedule(d.id, policy.id, actor);
      created++;
    } catch { /* skip */ }
  }
  return created;
}

export async function monitorRetentionExpiry(actor: RetentionDisposalActor): Promise<{ expiring: number; expired: number }> {
  const schedules = await listSchedules();
  const today = now().split('T')[0];
  let expiring = 0;
  let expired = 0;

  for (const s of schedules) {
    if (!s.retention_expiry_date || s.retention_status === 'Disposed') continue;
    if (s.legal_hold || s.regulatory_hold) continue;

    const days = Math.ceil((new Date(`${s.retention_expiry_date}T12:00:00`).getTime() - Date.now()) / 86400000);
    if (days > 0 && days <= RETENTION_WARNING_DAYS) {
      expiring++;
      await notify('Retention Expiring', `${s.document_number} retention expires ${s.retention_expiry_date}`, s.id, ['document_controller']);
    }
    if (s.retention_expiry_date <= today && s.retention_status === 'Active') {
      await updateDoc(doc(getFirebaseFirestore(), RDM_COLLECTIONS.schedules, s.id), {
        retention_status: 'Expired',
        updated_at: now(),
      });
      expired++;
    }
  }
  return { expiring, expired };
}

export async function autoCreateDisposalRequests(actor: RetentionDisposalActor): Promise<number> {
  const schedules = await listSchedules();
  const disposals = await listDisposals();
  const pendingScheduleIds = new Set(disposals.filter((d) => d.status !== 'Completed').map((d) => d.schedule_id));
  let created = 0;

  for (const s of schedules.filter((x) => x.retention_status === 'Expired' && !x.legal_hold && !x.regulatory_hold)) {
    if (pendingScheduleIds.has(s.id)) continue;
    try {
      const policySnap = await getDoc(doc(getFirebaseFirestore(), RDM_COLLECTIONS.policies, s.policy_id));
      const disposalMethod = policySnap.exists()
        ? (policySnap.data().disposal_method as string) || 'Secure Digital Deletion'
        : 'Secure Digital Deletion';
      await createDisposalRequest({
        schedule_id: s.id,
        disposal_method: disposalMethod as CreateDisposalRequestInput['disposal_method'],
        disposal_reason: 'Automatic disposal request — retention period expired',
        electronic_signature_required: true,
      }, actor);
      created++;
    } catch { /* skip */ }
  }
  return created;
}

export async function processScheduledRetentionJobs(actor: RetentionDisposalActor) {
  const synced = await syncRetentionSchedulesFromDocuments();
  const retention = await monitorRetentionExpiry(actor);
  const disposals = await autoCreateDisposalRequests(actor);
  return { synced, retention, disposals };
}

export async function fetchRetentionDisposalDashboardData(filters?: RetentionDisposalFilters) {
  await processScheduledRetentionJobs({ id: 'system', name: 'System', role: 'system' });
  const policies = await listPolicies();
  let schedules = await listSchedules();
  let disposals = await listDisposals();
  const certificates = await listCertificates();

  if (filters) {
    schedules = filterSchedules(schedules, filters);
    disposals = filterDisposals(disposals, filters);
  }

  return {
    policies,
    schedules,
    disposals,
    certificates,
    metrics: computeRetentionKpis(policies, schedules, disposals),
    charts: computeRetentionCharts(schedules, disposals),
  };
}

export function exportRetentionCsv(schedules: RetentionScheduleRecord[], disposals: DisposalRequestRecord[]) {
  downloadCsv('retention-schedules.csv',
    ['Schedule #', 'Document', 'Policy', 'Expiry', 'Status', 'Department'],
    schedules.map((s) => [
      s.schedule_number, s.document_number, s.policy_number,
      s.retention_expiry_date || 'Permanent', s.retention_status, s.department,
    ]),
  );
}

export function exportRetentionExcel(schedules: RetentionScheduleRecord[], disposals: DisposalRequestRecord[]) {
  exportRetentionCsv(schedules, disposals);
}

export async function logRetentionDashboardViewed(actor: RetentionDisposalActor) {
  await audit(actor, 'DASHBOARD_VIEWED', 'retention-disposal-dashboard', null, null);
}

export async function logRetentionExported(actor: RetentionDisposalActor, format: string, count: number) {
  await audit(actor, 'EXPORT', 'retention-disposal-dashboard', null, { format, count });
}

export async function runScheduledRetentionJobs() {
  return processScheduledRetentionJobs({ id: 'scheduler', name: 'Scheduled Job', role: 'system' });
}

export async function getScheduleById(id: string): Promise<RetentionScheduleRecord | null> {
  const snap = await getDoc(doc(getFirebaseFirestore(), RDM_COLLECTIONS.schedules, id));
  if (!snap.exists()) return null;
  return mapScheduleRaw({ id: snap.id, ...snap.data() });
}

export async function getPolicyById(id: string): Promise<RetentionPolicyRecord | null> {
  const snap = await getDoc(doc(getFirebaseFirestore(), RDM_COLLECTIONS.policies, id));
  if (!snap.exists()) return null;
  return mapPolicyRaw({ id: snap.id, ...snap.data() });
}
