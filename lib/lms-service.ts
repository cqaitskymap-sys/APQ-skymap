import {
  addDoc, collection, doc, getDoc, getDocs, limit, orderBy, query, updateDoc, where,
  type QueryConstraint, type DocumentData,
} from 'firebase/firestore';
import { getFirebaseFirestore } from '@/lib/firebase';
import { logAuditEvent } from '@/lib/admin/admin-service';
import { downloadCsv } from '@/lib/export-utils';
import {
  LMS_COLLECTIONS, type LmsConnection, type LmsSyncJob, type IntegrationLog,
  type LmsCourse, type LmsUser, type LmsTrainingRecord, type TrainingCertificate,
  type LmsDashboardData, type LmsDashboardKpis, type LmsDashboardCharts,
  type LmsActor, type LmsFilters, calcNextSync, generateConnectionId, generateJobId,
  type LmsSyncEntity,
} from './lms-types';
import type { LmsConnectionInput } from './lms-schemas';
import { createLmsAdapter } from './lms-adapters/base-adapter';

function now() { return new Date().toISOString(); }

function db() { return getFirebaseFirestore(); }

function encodeCredential(value: string): string {
  if (!value) return '';
  try { return btoa(unescape(encodeURIComponent(value))); } catch { return value; }
}

function maskCredential(value: string): string {
  if (!value || value.length < 4) return '****';
  return `${value.slice(0, 2)}${'*'.repeat(Math.min(value.length - 4, 8))}${value.slice(-2)}`;
}

export function getWebhookUrl(connectionId: string): string {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/api/lms/webhook/${connectionId}`;
  }
  return `/api/lms/webhook/${connectionId}`;
}

async function audit(actor: LmsActor, action: string, recordId: string, oldValue: unknown, newValue: unknown, reason = '') {
  await logAuditEvent({
    userId: actor.id, userName: actor.name, module: 'LMS Integration', recordId, action,
    oldValue: oldValue ? JSON.stringify(oldValue) : '',
    newValue: newValue ? JSON.stringify(newValue) : '',
    reason, ipAddress: 'client', device: typeof navigator !== 'undefined' ? navigator.userAgent : 'server',
    status: 'Success',
  });
  try {
    await addDoc(collection(db(), LMS_COLLECTIONS.auditTrail), {
      moduleName: 'LMS Integration',
      action,
      documentId: recordId,
      userId: actor.id,
      userName: actor.name,
      oldValue: oldValue ? JSON.stringify(oldValue) : null,
      newValue: newValue ? JSON.stringify(newValue) : null,
      reason,
      timestamp: now(),
      collectionName: 'lms_connections',
    });
  } catch { /* optional */ }
}

async function notifyFailure(title: string, message: string, recordId: string) {
  try {
    for (const role of ['admin', 'training_coordinator', 'qa_manager']) {
      await addDoc(collection(db(), LMS_COLLECTIONS.notifications), {
        title, message, module: 'LMS Integration', record_id: recordId, target_role: role,
        read: false, created_at: now(),
      });
    }
  } catch (e) { console.error('LMS notification failed:', e); }
}

export async function logIntegrationEvent(
  connectionId: string,
  level: IntegrationLog['level'],
  action: string,
  message: string,
  opts: { syncJobId?: string; entityType?: string; entityId?: string; details?: Record<string, unknown> } = {},
) {
  await addDoc(collection(db(), LMS_COLLECTIONS.integrationLogs), {
    connection_id: connectionId,
    sync_job_id: opts.syncJobId ?? null,
    level,
    action,
    message,
    entity_type: opts.entityType ?? '',
    entity_id: opts.entityId ?? null,
    details: opts.details ?? {},
    created_at: now(),
  });
}

function mapConnection(id: string, data: Record<string, unknown>): LmsConnection {
  return {
    id,
    connection_id: String(data.connection_id ?? id),
    connection_name: String(data.connection_name ?? ''),
    lms_name: String(data.lms_name ?? ''),
    base_url: String(data.base_url ?? ''),
    authentication_type: String(data.authentication_type ?? ''),
    client_id: String(data.client_id ?? ''),
    client_secret: maskCredential(String(data.client_secret ?? '')),
    api_key: maskCredential(String(data.api_key ?? '')),
    username: String(data.username ?? ''),
    encrypted_password: '********',
    webhook_url: String(data.webhook_url ?? getWebhookUrl(id)),
    webhook_secret: maskCredential(String(data.webhook_secret ?? '')),
    sync_mode: String(data.sync_mode ?? 'Manual'),
    sync_frequency: String(data.sync_frequency ?? 'On Demand'),
    sync_entities: (data.sync_entities as LmsSyncEntity[]) ?? [],
    field_mappings: (data.field_mappings as LmsConnection['field_mappings']) ?? [],
    last_sync: data.last_sync ? String(data.last_sync) : null,
    next_sync: data.next_sync ? String(data.next_sync) : null,
    status: String(data.status ?? 'Inactive'),
    created_by: String(data.created_by ?? ''),
    created_by_name: String(data.created_by_name ?? ''),
    updated_by: String(data.updated_by ?? ''),
    updated_by_name: String(data.updated_by_name ?? ''),
    created_at: String(data.created_at ?? ''),
    updated_at: String(data.updated_at ?? ''),
  };
}

export async function listConnections(): Promise<LmsConnection[]> {
  const snap = await getDocs(query(collection(db(), LMS_COLLECTIONS.connections), orderBy('created_at', 'desc')));
  return snap.docs.map((d) => mapConnection(d.id, d.data()));
}

export async function getConnection(id: string): Promise<LmsConnection | null> {
  const snap = await getDoc(doc(db(), LMS_COLLECTIONS.connections, id));
  if (!snap.exists()) return null;
  return mapConnection(snap.id, snap.data());
}

export async function createConnection(input: LmsConnectionInput, actor: LmsActor): Promise<string> {
  const ts = now();
  const connectionId = generateConnectionId();
  const payload = {
    connection_id: connectionId,
    connection_name: input.connection_name,
    lms_name: input.lms_name,
    base_url: input.base_url,
    authentication_type: input.authentication_type,
    client_id: input.client_id ?? '',
    client_secret: encodeCredential(input.client_secret ?? ''),
    api_key: encodeCredential(input.api_key ?? ''),
    username: input.username ?? '',
    encrypted_password: encodeCredential(input.password ?? ''),
    webhook_url: '',
    webhook_secret: encodeCredential(input.webhook_secret ?? ''),
    sync_mode: input.sync_mode,
    sync_frequency: input.sync_frequency,
    sync_entities: input.sync_entities,
    field_mappings: [],
    last_sync: null,
    next_sync: calcNextSync(input.sync_frequency),
    status: 'Inactive',
    created_by: actor.id,
    created_by_name: actor.name,
    updated_by: actor.id,
    updated_by_name: actor.name,
    created_at: ts,
    updated_at: ts,
  };
  const ref = await addDoc(collection(db(), LMS_COLLECTIONS.connections), payload);
  await updateDoc(ref, { webhook_url: getWebhookUrl(ref.id) });
  await audit(actor, 'connection created', ref.id, null, { connection_name: input.connection_name, lms_name: input.lms_name });
  return ref.id;
}

export async function updateConnection(id: string, input: Partial<LmsConnectionInput>, actor: LmsActor): Promise<void> {
  const existing = await getConnection(id);
  if (!existing) throw new Error('Connection not found');
  const updates: Record<string, unknown> = {
    updated_by: actor.id,
    updated_by_name: actor.name,
    updated_at: now(),
  };
  if (input.connection_name) updates.connection_name = input.connection_name;
  if (input.base_url) updates.base_url = input.base_url;
  if (input.lms_name) updates.lms_name = input.lms_name;
  if (input.authentication_type) updates.authentication_type = input.authentication_type;
  if (input.client_id != null) updates.client_id = input.client_id;
  if (input.client_secret) updates.client_secret = encodeCredential(input.client_secret);
  if (input.api_key) updates.api_key = encodeCredential(input.api_key);
  if (input.username != null) updates.username = input.username;
  if (input.password) updates.encrypted_password = encodeCredential(input.password);
  if (input.sync_mode) updates.sync_mode = input.sync_mode;
  if (input.sync_frequency) {
    updates.sync_frequency = input.sync_frequency;
    updates.next_sync = calcNextSync(input.sync_frequency);
  }
  if (input.sync_entities) updates.sync_entities = input.sync_entities;
  await updateDoc(doc(db(), LMS_COLLECTIONS.connections, id), updates as DocumentData);
  await audit(actor, 'connection updated', id, existing, updates);
}

export async function testConnection(id: string, actor: LmsActor): Promise<{ success: boolean; message: string }> {
  const conn = await getConnectionRaw(id);
  if (!conn) return { success: false, message: 'Connection not found' };
  await updateDoc(doc(db(), LMS_COLLECTIONS.connections, id), { status: 'Testing', updated_at: now() });
  const adapter = createLmsAdapter(conn);
  const result = await adapter.testConnection();
  await updateDoc(doc(db(), LMS_COLLECTIONS.connections, id), {
    status: result.success ? 'Active' : 'Error',
    updated_at: now(),
  });
  await audit(actor, 'connection tested', id, null, result);
  await logIntegrationEvent(id, result.success ? 'info' : 'error', 'connection_test', result.message);
  return result;
}

async function getConnectionRaw(id: string): Promise<LmsConnection | null> {
  const snap = await getDoc(doc(db(), LMS_COLLECTIONS.connections, id));
  if (!snap.exists()) return null;
  const data = snap.data();
  return {
    ...mapConnection(snap.id, data),
    client_secret: String(data.client_secret ?? ''),
    api_key: String(data.api_key ?? ''),
    encrypted_password: String(data.encrypted_password ?? ''),
    webhook_secret: String(data.webhook_secret ?? ''),
  };
}

export async function listSyncJobs(filters?: LmsFilters, max = 50): Promise<LmsSyncJob[]> {
  const constraints: QueryConstraint[] = [orderBy('started_at', 'desc'), limit(max)];
  if (filters?.connectionId) constraints.unshift(where('connection_id', '==', filters.connectionId));
  if (filters?.status) constraints.unshift(where('status', '==', filters.status));
  const snap = await getDocs(query(collection(db(), LMS_COLLECTIONS.syncJobs), ...constraints));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as LmsSyncJob));
}

export async function listIntegrationLogs(filters?: LmsFilters, max = 100): Promise<IntegrationLog[]> {
  const constraints: QueryConstraint[] = [orderBy('created_at', 'desc'), limit(max)];
  if (filters?.connectionId) constraints.unshift(where('connection_id', '==', filters.connectionId));
  const snap = await getDocs(query(collection(db(), LMS_COLLECTIONS.integrationLogs), ...constraints));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as IntegrationLog));
}

export async function listCourses(connectionId?: string): Promise<LmsCourse[]> {
  const constraints: QueryConstraint[] = [orderBy('imported_at', 'desc'), limit(100)];
  if (connectionId) constraints.unshift(where('connection_id', '==', connectionId));
  const snap = await getDocs(query(collection(db(), LMS_COLLECTIONS.courses), ...constraints));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as LmsCourse));
}

export async function listLmsUsers(connectionId?: string): Promise<LmsUser[]> {
  const constraints: QueryConstraint[] = [orderBy('imported_at', 'desc'), limit(100)];
  if (connectionId) constraints.unshift(where('connection_id', '==', connectionId));
  const snap = await getDocs(query(collection(db(), LMS_COLLECTIONS.users), ...constraints));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as LmsUser));
}

export async function listCertificates(connectionId?: string): Promise<TrainingCertificate[]> {
  const constraints: QueryConstraint[] = [orderBy('imported_at', 'desc'), limit(100)];
  if (connectionId) constraints.unshift(where('connection_id', '==', connectionId));
  const snap = await getDocs(query(collection(db(), LMS_COLLECTIONS.certificates), ...constraints));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as TrainingCertificate));
}

export async function createSyncJob(connectionId: string, connectionName: string, entities: string[], actor: LmsActor, mode = 'Manual'): Promise<string> {
  const jobId = generateJobId();
  const ref = await addDoc(collection(db(), LMS_COLLECTIONS.syncJobs), {
    job_id: jobId,
    connection_id: connectionId,
    connection_name: connectionName,
    sync_mode: mode,
    status: 'Pending',
    entities,
    started_at: now(),
    completed_at: null,
    duration_ms: null,
    records_processed: 0,
    records_imported: 0,
    records_updated: 0,
    records_skipped: 0,
    records_failed: 0,
    error_message: null,
    retry_count: 0,
    max_retries: 3,
    triggered_by: actor.id,
    triggered_by_name: actor.name,
  });
  await audit(actor, 'sync started', ref.id, null, { connectionId, jobId });
  return ref.id;
}

export async function updateSyncJob(jobDocId: string, updates: Partial<LmsSyncJob>): Promise<void> {
  await updateDoc(doc(db(), LMS_COLLECTIONS.syncJobs, jobDocId), updates as DocumentData);
}

export async function notifySyncFailure(jobDocId: string, connectionName: string, error: string) {
  await notifyFailure('LMS Sync Failed', `${connectionName}: ${error}`, jobDocId);
}

function computeKpis(
  connections: LmsConnection[],
  jobs: LmsSyncJob[],
  courses: LmsCourse[],
  users: LmsUser[],
  certificates: TrainingCertificate[],
): LmsDashboardKpis {
  const today = new Date().toISOString().slice(0, 10);
  const failed = jobs.filter((j) => j.status === 'Failed');
  const pending = jobs.filter((j) => j.status === 'Pending' || j.status === 'Running');
  const todayJobs = jobs.filter((j) => j.started_at?.startsWith(today));
  const completedJobs = jobs.filter((j) => j.duration_ms != null);
  const avgDuration = completedJobs.length
    ? Math.round(completedJobs.reduce((s, j) => s + (j.duration_ms ?? 0), 0) / completedJobs.length)
    : 0;
  const assignmentsSynced = jobs.reduce((s, j) => s + (j.records_imported ?? 0), 0);

  return {
    connectedLms: connections.filter((c) => c.status === 'Active').length,
    coursesImported: courses.length,
    usersSynced: users.length,
    assignmentsSynced,
    certificatesImported: certificates.length,
    failedSyncs: failed.length,
    pendingSyncJobs: pending.length,
    todaysSyncJobs: todayJobs.length,
    averageSyncDurationMs: avgDuration,
  };
}

function computeCharts(jobs: LmsSyncJob[], courses: LmsCourse[], users: LmsUser[], certificates: TrainingCertificate[], logs: IntegrationLog[]): LmsDashboardCharts {
  const last7: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    last7.push(d.toISOString().slice(0, 10));
  }

  const dailySyncTrend = last7.map((date) => {
    const dayJobs = jobs.filter((j) => j.started_at?.startsWith(date));
    return {
      date: date.slice(5),
      count: dayJobs.length,
      success: dayJobs.filter((j) => j.status === 'Completed').length,
      failed: dayJobs.filter((j) => j.status === 'Failed').length,
    };
  });

  const completed = jobs.filter((j) => j.status === 'Completed').length;
  const failed = jobs.filter((j) => j.status === 'Failed').length;
  const partial = jobs.filter((j) => j.status === 'Partial Success').length;
  const syncSuccessRate = [
    { name: 'Completed', value: completed },
    { name: 'Failed', value: failed },
    { name: 'Partial', value: partial },
  ].filter((d) => d.value > 0);

  const trendByDate = (items: { imported_at?: string }[]) =>
    last7.map((date) => ({ date: date.slice(5), count: items.filter((i) => i.imported_at?.startsWith(date)).length }));

  const errorLogs = logs.filter((l) => l.level === 'error');
  const errorMap = new Map<string, number>();
  errorLogs.forEach((l) => errorMap.set(l.action, (errorMap.get(l.action) ?? 0) + 1));
  const errorDistribution = Array.from(errorMap.entries()).map(([name, value]) => ({ name, value }));

  return {
    dailySyncTrend,
    syncSuccessRate: syncSuccessRate.length ? syncSuccessRate : [{ name: 'No Data', value: 1 }],
    courseImportTrend: trendByDate(courses),
    certificateImportTrend: trendByDate(certificates),
    userSyncTrend: trendByDate(users),
    errorDistribution: errorDistribution.length ? errorDistribution : [{ name: 'None', value: 0 }],
  };
}

export async function fetchLmsDashboard(filters?: LmsFilters): Promise<LmsDashboardData> {
  const [connections, jobs, courses, users, certificates, logs] = await Promise.all([
    listConnections(),
    listSyncJobs(filters, 100),
    listCourses(filters?.connectionId),
    listLmsUsers(filters?.connectionId),
    listCertificates(filters?.connectionId),
    listIntegrationLogs(filters, 200),
  ]);

  let filteredJobs = jobs;
  let filteredLogs = logs;
  if (filters?.search) {
    const q = filters.search.toLowerCase();
    filteredJobs = jobs.filter((j) =>
      j.connection_name?.toLowerCase().includes(q) || j.job_id?.toLowerCase().includes(q));
    filteredLogs = logs.filter((l) => l.message?.toLowerCase().includes(q) || l.action?.toLowerCase().includes(q));
  }

  return {
    kpis: computeKpis(connections, jobs, courses, users, certificates),
    charts: computeCharts(jobs, courses, users, certificates, logs),
    connections,
    recentSyncJobs: filteredJobs.slice(0, 20),
    failedSyncJobs: filteredJobs.filter((j) => j.status === 'Failed').slice(0, 10),
    courses: courses.slice(0, 50),
    certificates: certificates.slice(0, 50),
    logs: filteredLogs.slice(0, 50),
  };
}

export async function exportIntegrationLogs(logs: IntegrationLog[]): Promise<void> {
  const headers = ['Date', 'Level', 'Action', 'Message', 'Connection', 'Entity'];
  const rows = logs.map((l) => [
    l.created_at,
    l.level,
    l.action,
    l.message,
    l.connection_id,
    l.entity_type,
  ]);
  downloadCsv('lms-integration-logs.csv', headers, rows);
}

export async function processDueScheduledSyncs(actor: LmsActor): Promise<number> {
  const connections = await listConnections();
  const due = connections.filter((c) =>
    c.status === 'Active'
    && c.sync_mode === 'Scheduled'
    && c.next_sync
    && new Date(c.next_sync) <= new Date());
  for (const conn of due) {
    const { runLmsSync } = await import('./lms-sync-service');
    await runLmsSync(conn.id, actor, 'Scheduled');
  }
  return due.length;
}

export { getConnectionRaw };
