import { collection, doc, getDocs, setDoc } from 'firebase/firestore';
import { getBlob, ref, uploadBytes } from 'firebase/storage';
import { writeAuditTrail, createAuditLog } from '@/lib/audit-trail';
import { sendInAppNotification } from '@/lib/notification-service';
import {
  getAdminRecords, createAdminRecord, updateAdminRecord, logAuditEvent,
} from './admin-service';
import {
  ADMIN_COLLECTIONS, BACKUP_SCOPE_COLLECTIONS, BACKUP_EXPORT_COLLECTIONS, BACKUP_STATUSES,
} from './constants';
import { requestServerRestore } from './backup-cloud-function-placeholder';
import type {
  BackupHistory, BackupFormData, BackupSettings, RestoreHistory, RestoreRequestFormData,
} from './schemas';
import { getFirebaseFirestore, getFirebaseStorage, isFirebaseConfigured } from '@/lib/firebase';

export interface BackupAuditMeta {
  userId: string;
  userName: string;
}

const PROTECTED_RESTORE_COLLECTIONS = ['audit_trail', 'audit_logs', 'esign_records'];

async function logBackupAudit(
  action: string,
  recordId: string,
  meta: BackupAuditMeta,
  oldValue: unknown,
  newValue: unknown,
  reason = '',
) {
  await logAuditEvent({
    userId: meta.userId,
    userName: meta.userName,
    module: 'Backup',
    recordId,
    action,
    oldValue: typeof oldValue === 'string' ? oldValue : JSON.stringify(oldValue ?? ''),
    newValue: typeof newValue === 'string' ? newValue : JSON.stringify(newValue ?? ''),
    reason,
    ipAddress: typeof window !== 'undefined' ? 'client' : 'server',
    device: typeof navigator !== 'undefined' ? navigator.userAgent : 'browser',
    status: 'Success',
  });

  await writeAuditTrail({
    collectionName: ADMIN_COLLECTIONS.backupHistory,
    documentId: recordId,
    action,
    oldValue,
    newValue,
    userId: meta.userId,
    userName: meta.userName,
    moduleName: 'Backup',
  });

  await createAuditLog({
    moduleName: 'Backup',
    collectionName: ADMIN_COLLECTIONS.backupHistory,
    recordId,
    actionType: action,
    actionDescription: action,
    reason: reason,
    user: { id: meta.userId, name: meta.userName },
    status: 'Success',
  });
}

export function buildBackupNumber(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `BK-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${Date.now().toString(36).slice(-6).toUpperCase()}`;
}

export function buildRestoreId(): string {
  return `RST-${Date.now().toString(36).toUpperCase()}`;
}

export function buildBackupId(): string {
  return `BKP-${Date.now()}`;
}

function normalizeBackupStatus(status?: string): BackupHistory['backupStatus'] {
  if (status === 'Success') return 'Completed';
  const values = BACKUP_STATUSES as readonly string[];
  if (status && values.includes(status)) {
    return status as BackupHistory['backupStatus'];
  }
  return 'Pending';
}

export function normalizeBackup(record: BackupHistory): BackupHistory {
  const dateTime = record.backupDateTime || record.backupDate || record.createdAt || '';
  return {
    ...record,
    backupNumber: record.backupNumber || record.backupId || '',
    backupDateTime: dateTime,
    backupDate: dateTime,
    backupStatus: normalizeBackupStatus(record.backupStatus),
    backupType: (record.backupType as BackupHistory['backupType']) || 'Manual Backup',
    backupScope: (record.backupScope as BackupHistory['backupScope']) || 'Full System',
    storageLocation: record.storageLocation || record.filePath || '',
    filePath: record.storageLocation || record.filePath || '',
    collectionsIncluded: record.collectionsIncluded || [],
    checksum: record.checksum || '',
    restorePointCreated: record.restorePointCreated ?? false,
  };
}

export function resolveCollectionsForScope(
  scope: string,
  selectedCollections: string[] = [],
): string[] {
  if (scope === 'Selected Collections') return selectedCollections;
  const mapped = BACKUP_SCOPE_COLLECTIONS[scope];
  if (mapped && mapped.length > 0) return [...mapped];
  return [...BACKUP_EXPORT_COLLECTIONS];
}

export async function computeChecksum(data: string): Promise<string> {
  if (typeof window !== 'undefined' && window.crypto?.subtle) {
    const buf = await window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(data));
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  return `len-${data.length}`;
}

export async function exportCollection(colName: string): Promise<{ name: string; records: unknown[]; count: number }> {
  const snap = await getDocs(collection(getFirebaseFirestore(), colName));
  const records = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return { name: colName, records, count: records.length };
}

async function notifyAdmins(
  title: string,
  message: string,
  recordId: string,
  eventName: string,
  priority = 'High',
) {
  try {
    const users = await getAdminRecords<{ id?: string; role?: string; uid?: string }>(ADMIN_COLLECTIONS.users);
    const admins = users.filter((u) =>
      ['super_admin', 'admin'].includes(String(u.role || '').toLowerCase()),
    );
    for (const admin of admins.slice(0, 5)) {
      const uid = admin.uid || admin.id;
      if (!uid) continue;
      await sendInAppNotification({
        userId: uid,
        moduleName: 'Admin',
        eventName,
        recordId,
        title,
        message,
        priority,
        actionLink: '/admin/backup',
      });
    }
  } catch {
    /* notification failure should not block backup */
  }
}

export async function fetchBackupHistory(): Promise<BackupHistory[]> {
  try {
    const records = await getAdminRecords<BackupHistory>(ADMIN_COLLECTIONS.backupHistory);
    return records.filter((r) => !r.isDeleted).map(normalizeBackup);
  } catch {
    return [];
  }
}

export async function fetchBackupById(id: string): Promise<BackupHistory | null> {
  const all = await fetchBackupHistory();
  return all.find((b) => b.id === id) ?? null;
}

export async function fetchRestoreHistory(): Promise<RestoreHistory[]> {
  try {
    return await getAdminRecords<RestoreHistory>(ADMIN_COLLECTIONS.restoreHistory);
  } catch {
    return [];
  }
}

export async function fetchBackupSettings(): Promise<BackupSettings | null> {
  try {
    const records = await getAdminRecords<BackupSettings>(ADMIN_COLLECTIONS.backupSettings);
    return records[0] ?? null;
  } catch {
    return null;
  }
}

export function getBackupSummary(backups: BackupHistory[], restores: RestoreHistory[], settings: BackupSettings | null) {
  const successful = backups.filter((b) =>
    b.backupStatus === 'Completed' || b.backupStatus === 'Verified',
  );
  const failed = backups.filter((b) => b.backupStatus === 'Failed');
  const last = backups.sort((a, b) =>
    String(b.backupDateTime).localeCompare(String(a.backupDateTime)),
  )[0];
  const restoreRequests = restores.filter((r) => r.restoreStatus === 'Requested');
  const completedRestores = restores.filter((r) => r.restoreStatus === 'Completed');
  const storageBytes = backups.reduce((sum, b) => sum + Number(b.fileSizeBytes || 0), 0);

  return {
    totalBackups: backups.length,
    successfulBackups: successful.length,
    failedBackups: failed.length,
    lastBackupStatus: last?.backupStatus || 'None',
    lastBackupDate: last?.backupDateTime || '',
    nextBackupDue: settings?.nextBackupDate || last?.nextBackupDue || '',
    restoreRequests: restoreRequests.length,
    completedRestores: completedRestores.length,
    storageUsed: formatBytes(storageBytes),
    storageBytes,
  };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function getBackupChartsData(backups: BackupHistory[], restores: RestoreHistory[]) {
  const successByMonth = new Map<string, { success: number; failed: number }>();
  backups.forEach((b) => {
    const month = b.backupDateTime?.slice(0, 7) || 'unknown';
    const entry = successByMonth.get(month) || { success: 0, failed: 0 };
    if (b.backupStatus === 'Completed' || b.backupStatus === 'Verified') entry.success += 1;
    if (b.backupStatus === 'Failed') entry.failed += 1;
    successByMonth.set(month, entry);
  });

  const typeDist = new Map<string, number>();
  backups.forEach((b) => {
    const t = b.backupType || 'Manual Backup';
    typeDist.set(t, (typeDist.get(t) || 0) + 1);
  });

  const restoreByMonth = new Map<string, number>();
  restores.forEach((r) => {
    const month = r.restoreDateTime?.slice(0, 7) || 'unknown';
    restoreByMonth.set(month, (restoreByMonth.get(month) || 0) + 1);
  });

  const sizeByMonth = new Map<string, number>();
  backups.forEach((b) => {
    const month = b.backupDateTime?.slice(0, 7) || 'unknown';
    sizeByMonth.set(month, (sizeByMonth.get(month) || 0) + Number(b.fileSizeBytes || 0));
  });

  return {
    successTrend: Array.from(successByMonth.entries()).map(([month, v]) => ({
      month, success: v.success, failed: v.failed,
    })),
    typeDistribution: Array.from(typeDist.entries()).map(([name, value]) => ({ name, value })),
    restoreTrend: Array.from(restoreByMonth.entries()).map(([month, count]) => ({ month, count })),
    sizeTrend: Array.from(sizeByMonth.entries()).map(([month, bytes]) => ({
      month, size: Math.round(bytes / 1024),
    })),
  };
}

export async function createBackup(
  form: BackupFormData,
  meta: BackupAuditMeta,
  onProgress?: (pct: number, label: string) => void,
): Promise<{ backup: BackupHistory | null; error?: string }> {
  if (!isFirebaseConfigured()) return { backup: null, error: 'Firebase is not configured' };

  const backupId = buildBackupId();
  const collections = resolveCollectionsForScope(form.backupScope, form.selectedCollections);
  if (collections.length === 0) {
    return { backup: null, error: 'Select at least one collection for this backup scope' };
  }
  const fileName = `${form.backupNumber || backupId}.json`;

  const pendingRecord: Omit<BackupHistory, 'id'> = {
    backupId,
    backupNumber: form.backupNumber,
    backupType: form.backupType,
    backupScope: form.backupScope,
    backupDateTime: new Date().toISOString(),
    backupStatus: 'In Progress',
    fileName,
    fileSize: '',
    fileSizeBytes: 0,
    storageLocation: '',
    filePath: '',
    collectionsIncluded: collections,
    recordsCount: 0,
    backupFrequency: form.backupFrequency,
    nextBackupDue: '',
    restorePointCreated: false,
    checksum: '',
    remarks: form.remarks,
    status: 'Active',
    createdBy: meta.userId,
    updatedBy: meta.userId,
  };

  const created = await createAdminRecord<BackupHistory>(
    ADMIN_COLLECTIONS.backupHistory,
    pendingRecord,
    { userId: meta.userId, userName: meta.userName, module: 'Backup', action: 'Backup Created' },
  );

  await logBackupAudit('manual backup created', backupId, meta, null, pendingRecord);

  try {
    onProgress?.(5, 'Starting export...');
    const exportData: Record<string, unknown[]> = {};
    let totalRecords = 0;

    for (let i = 0; i < collections.length; i++) {
      const col = collections[i];
      onProgress?.(5 + Math.round((i / collections.length) * 70), `Exporting ${col}...`);
      const result = await exportCollection(col);
      exportData[result.name] = result.records;
      totalRecords += result.count;
    }

    const json = JSON.stringify({
      meta: {
        backupId,
        backupNumber: form.backupNumber,
        backupType: form.backupType,
        backupScope: form.backupScope,
        exportedAt: new Date().toISOString(),
        collections,
        recordsCount: totalRecords,
      },
      data: exportData,
    }, null, 2);

    onProgress?.(80, 'Computing checksum...');
    const checksum = await computeChecksum(json);
    const blob = new Blob([json], { type: 'application/json' });
    const storagePath = `backups/${backupId}/${fileName}`;

    onProgress?.(85, 'Uploading to storage...');
    const storageRef = ref(getFirebaseStorage(), storagePath);
    await uploadBytes(storageRef, blob);

    const updates: Partial<BackupHistory> = {
      backupStatus: 'Completed',
      fileSize: formatBytes(blob.size),
      fileSizeBytes: blob.size,
      storageLocation: storagePath,
      filePath: storagePath,
      recordsCount: totalRecords,
      checksum,
      restorePointCreated: true,
      updatedBy: meta.userId,
    };

    const updated = await updateAdminRecord<BackupHistory>(
      ADMIN_COLLECTIONS.backupHistory,
      created.id!,
      updates,
      { userId: meta.userId, userName: meta.userName, module: 'Backup' },
    );

    await createAdminRecord(
      ADMIN_COLLECTIONS.backupRestore,
      { ...pendingRecord, ...updates, restorePoint: backupId, restoreHistory: '' },
      { userId: meta.userId, userName: meta.userName, module: 'Backup', action: 'Backup Completed' },
    );

    await logBackupAudit('backup completed', backupId, meta, pendingRecord, updates);
    await notifyAdmins(
      'Backup Completed',
      `Backup ${form.backupNumber} completed successfully (${totalRecords} records).`,
      backupId,
      'Backup Completed',
      'Medium',
    );

    onProgress?.(100, 'Complete');
    return { backup: updated ? normalizeBackup({ ...created, ...updates }) : null };
  } catch (e) {
    const errMsg = (e as Error).message;
    await updateAdminRecord<BackupHistory>(
      ADMIN_COLLECTIONS.backupHistory,
      created.id!,
      { backupStatus: 'Failed', remarks: errMsg, updatedBy: meta.userId },
      { userId: meta.userId, userName: meta.userName, module: 'Backup' },
    );
    await logBackupAudit('backup failed', backupId, meta, null, { error: errMsg });
    await notifyAdmins('Backup Failed', `Backup ${form.backupNumber} failed: ${errMsg}`, backupId, 'Backup Failed', 'Critical');
    return { backup: null, error: errMsg };
  }
}

export async function createPreRestoreBackup(meta: BackupAuditMeta): Promise<BackupHistory | null> {
  const result = await createBackup({
    backupNumber: buildBackupNumber(),
    backupType: 'Pre-Restore Backup',
    backupScope: 'Full System',
    selectedCollections: [],
    backupFrequency: 'Manual Only',
    remarks: 'Automatic pre-restore safety backup',
  }, meta);
  return result.backup;
}

export async function downloadBackup(backup: BackupHistory): Promise<{ success: boolean; error?: string }> {
  if (!backup.storageLocation && !backup.filePath) {
    return { success: false, error: 'No storage location for this backup' };
  }
  try {
    const path = backup.storageLocation || backup.filePath;
    const blob = await getBlob(ref(getFirebaseStorage(), path));
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = backup.fileName || `${backup.backupNumber}.json`;
    a.click();
    URL.revokeObjectURL(url);
    return { success: true };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

export async function verifyBackup(
  backup: BackupHistory,
  meta: BackupAuditMeta,
): Promise<{ verified: boolean; error?: string }> {
  if (!backup.checksum) return { verified: false, error: 'No checksum stored for this backup' };
  try {
    const path = backup.storageLocation || backup.filePath;
    const blob = await getBlob(ref(getFirebaseStorage(), path));
    const text = await blob.text();
    const hash = await computeChecksum(text);
    const verified = hash === backup.checksum;
    await logBackupAudit(
      verified ? 'backup verified' : 'backup verification failed',
      backup.backupId,
      meta,
      { checksum: backup.checksum },
      { computed: hash, verified },
    );
    if (verified) {
      await updateAdminRecord<BackupHistory>(
        ADMIN_COLLECTIONS.backupHistory,
        backup.id!,
        { backupStatus: 'Verified', updatedBy: meta.userId },
        { userId: meta.userId, userName: meta.userName, module: 'Backup' },
      );
    }
    return { verified, error: verified ? undefined : 'Checksum mismatch' };
  } catch (e) {
    return { verified: false, error: (e as Error).message };
  }
}

export async function requestRestore(
  form: RestoreRequestFormData,
  meta: BackupAuditMeta,
): Promise<{ restore: RestoreHistory | null; error?: string }> {
  const backup = (await fetchBackupHistory()).find((b) => b.backupId === form.backupId || b.id === form.backupId);
  if (!backup) return { restore: null, error: 'Backup not found' };

  const restoreId = buildRestoreId();
  const collections = form.restoreType === 'Selected Collection Restore'
    ? form.selectedCollections
    : resolveCollectionsForScope(backup.backupScope, backup.collectionsIncluded);

  const record: Omit<RestoreHistory, 'id'> = {
    restoreId,
    backupId: backup.backupId,
    restoreDateTime: new Date().toISOString(),
    restoreType: form.restoreType,
    restoredBy: meta.userId,
    restoreStatus: 'Requested',
    collectionsRestored: collections,
    recordsRestored: 0,
    reasonForRestore: form.reasonForRestore,
    approvalRequired: true,
    approvedBy: '',
    approvedAt: '',
    preRestoreBackupId: '',
    remarks: form.remarks,
    status: 'Active',
    createdBy: meta.userId,
    updatedBy: meta.userId,
  };

  const created = await createAdminRecord<RestoreHistory>(
    ADMIN_COLLECTIONS.restoreHistory,
    record,
    { userId: meta.userId, userName: meta.userName, module: 'Backup', action: 'Restore Requested' },
  );

  await logBackupAudit('restore requested', restoreId, meta, null, record, form.reasonForRestore);
  await notifyAdmins(
    'Restore Requested',
    `Restore request ${restoreId} for backup ${backup.backupNumber} requires Super Admin approval.`,
    restoreId,
    'Restore Requested',
    'Critical',
  );

  return { restore: created };
}

export async function approveRestore(
  restore: RestoreHistory,
  meta: BackupAuditMeta,
): Promise<{ success: boolean; error?: string }> {
  if (restore.restoreStatus !== 'Requested') {
    return { success: false, error: 'Only requested restores can be approved' };
  }

  await updateAdminRecord<RestoreHistory>(
    ADMIN_COLLECTIONS.restoreHistory,
    restore.id!,
    {
      restoreStatus: 'Approved',
      approvedBy: meta.userId,
      approvedAt: new Date().toISOString(),
      updatedBy: meta.userId,
    },
    { userId: meta.userId, userName: meta.userName, module: 'Backup' },
  );

  await logBackupAudit('restore approved', restore.restoreId, meta, restore, { approved: true });
  await notifyAdmins(
    'Restore Approved',
    `Restore ${restore.restoreId} has been approved and will proceed.`,
    restore.restoreId,
    'Restore Approved',
    'High',
  );

  const result = await executeRestore({ ...restore, restoreStatus: 'Approved', approvedBy: meta.userId }, meta);
  return result;
}

export async function rejectRestore(
  restore: RestoreHistory,
  meta: BackupAuditMeta,
  reason: string,
): Promise<void> {
  await updateAdminRecord<RestoreHistory>(
    ADMIN_COLLECTIONS.restoreHistory,
    restore.id!,
    { restoreStatus: 'Cancelled', remarks: reason, updatedBy: meta.userId },
    { userId: meta.userId, userName: meta.userName, module: 'Backup' },
  );
  await logBackupAudit('restore rejected', restore.restoreId, meta, restore, { cancelled: true }, reason);
}

async function executeRestore(
  restore: RestoreHistory,
  meta: BackupAuditMeta,
): Promise<{ success: boolean; error?: string }> {
  await updateAdminRecord<RestoreHistory>(
    ADMIN_COLLECTIONS.restoreHistory,
    restore.id!,
    { restoreStatus: 'In Progress', updatedBy: meta.userId },
    { userId: meta.userId, userName: meta.userName, module: 'Backup' },
  );
  await logBackupAudit('restore started', restore.restoreId, meta, null, restore);

  const preBackup = await createPreRestoreBackup(meta);
  if (preBackup) {
    await updateAdminRecord<RestoreHistory>(
      ADMIN_COLLECTIONS.restoreHistory,
      restore.id!,
      { preRestoreBackupId: preBackup.backupId, updatedBy: meta.userId },
      { userId: meta.userId, userName: meta.userName, module: 'Backup' },
    );
  }

  const backup = (await fetchBackupHistory()).find((b) => b.backupId === restore.backupId);
  if (!backup?.storageLocation && !backup?.filePath) {
    const serverMsg = await requestServerRestore({
      restoreId: restore.restoreId,
      backupId: restore.backupId,
      storagePath: '',
      collections: restore.collectionsRestored,
      requestedBy: meta.userId,
    });
    await updateAdminRecord<RestoreHistory>(
      ADMIN_COLLECTIONS.restoreHistory,
      restore.id!,
      { restoreStatus: 'Failed', remarks: serverMsg.message, updatedBy: meta.userId },
      { userId: meta.userId, userName: meta.userName, module: 'Backup' },
    );
    return { success: false, error: serverMsg.message };
  }

  try {
    const path = backup.storageLocation || backup.filePath;
    const blob = await getBlob(ref(getFirebaseStorage(), path));
    const payload = JSON.parse(await blob.text()) as { data?: Record<string, unknown[]> };
    const collections = restore.collectionsRestored.filter((c) => !PROTECTED_RESTORE_COLLECTIONS.includes(c));
    let restored = 0;

    for (const col of collections) {
      const records = payload.data?.[col] || [];
      restored += await restoreCollection(col, records);
    }

    await updateAdminRecord<RestoreHistory>(
      ADMIN_COLLECTIONS.restoreHistory,
      restore.id!,
      {
        restoreStatus: 'Completed',
        recordsRestored: restored,
        updatedBy: meta.userId,
      },
      { userId: meta.userId, userName: meta.userName, module: 'Backup' },
    );

    await updateAdminRecord<BackupHistory>(
      ADMIN_COLLECTIONS.backupHistory,
      backup.id!,
      { backupStatus: 'Restored', updatedBy: meta.userId },
      { userId: meta.userId, userName: meta.userName, module: 'Backup' },
    );

    await logBackupAudit('restore completed', restore.restoreId, meta, null, { recordsRestored: restored });
    await notifyAdmins(
      'Restore Completed',
      `Restore ${restore.restoreId} completed (${restored} records). Audit trail was not modified.`,
      restore.restoreId,
      'Restore Completed',
      'High',
    );

    return { success: true };
  } catch (e) {
    const errMsg = (e as Error).message;
    await updateAdminRecord<RestoreHistory>(
      ADMIN_COLLECTIONS.restoreHistory,
      restore.id!,
      { restoreStatus: 'Failed', remarks: errMsg, updatedBy: meta.userId },
      { userId: meta.userId, userName: meta.userName, module: 'Backup' },
    );
    await logBackupAudit('restore failed', restore.restoreId, meta, null, { error: errMsg });
    await notifyAdmins('Restore Failed', `Restore ${restore.restoreId} failed: ${errMsg}`, restore.restoreId, 'Restore Failed', 'Critical');
    return { success: false, error: errMsg };
  }
}

export async function restoreCollection(colName: string, records: unknown[]): Promise<number> {
  if (PROTECTED_RESTORE_COLLECTIONS.includes(colName)) return 0;
  let count = 0;
  for (const rec of records) {
    const row = rec as { id?: string };
    if (!row.id) continue;
    const { id, ...data } = row;
    await setDoc(doc(getFirebaseFirestore(), colName, id), { ...data, restoredAt: new Date().toISOString() }, { merge: true });
    count += 1;
  }
  return count;
}

export async function updateBackupSettings(
  settings: Partial<BackupSettings>,
  meta: BackupAuditMeta,
): Promise<BackupSettings | null> {
  const existing = await fetchBackupSettings();
  if (existing?.id) {
    const updated = await updateAdminRecord<BackupSettings>(
      ADMIN_COLLECTIONS.backupSettings,
      existing.id,
      { ...settings, updatedBy: meta.userId },
      { userId: meta.userId, userName: meta.userName, module: 'Backup' },
    );
    await logBackupAudit('scheduled backup configured', existing.id!, meta, existing, settings);
    return updated;
  }

  const created = await createAdminRecord<BackupSettings>(
    ADMIN_COLLECTIONS.backupSettings,
    {
      autoBackupEnabled: settings.autoBackupEnabled ?? false,
      backupFrequency: settings.backupFrequency ?? 'Weekly',
      backupTime: settings.backupTime ?? '02:00',
      backupScope: settings.backupScope ?? 'Full System',
      retentionPeriodDays: settings.retentionPeriodDays ?? 90,
      notifyAdminOnSuccess: settings.notifyAdminOnSuccess ?? true,
      notifyAdminOnFailure: settings.notifyAdminOnFailure ?? true,
      lastBackupDate: '',
      nextBackupDate: settings.nextBackupDate ?? '',
      status: 'Active',
      createdBy: meta.userId,
      updatedBy: meta.userId,
    },
    { userId: meta.userId, userName: meta.userName, module: 'Backup', action: 'Backup Settings Created' },
  );
  await logBackupAudit('backup settings changed', created.id || '', meta, null, settings);
  return created;
}

export function exportBackupHistoryCsv(backups: BackupHistory[]): string {
  const BOM = '\uFEFF';
  const headers = [
    'Backup Number', 'Backup ID', 'Type', 'Scope', 'Date Time', 'Status',
    'File Name', 'File Size', 'Records', 'Checksum', 'Created By',
  ];
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const rows = backups.map((b) => [
    b.backupNumber, b.backupId, b.backupType, b.backupScope, b.backupDateTime,
    b.backupStatus, b.fileName, b.fileSize, String(b.recordsCount), b.checksum, b.createdBy,
  ].map((c) => escape(String(c ?? ''))).join(','));
  return BOM + [headers.join(','), ...rows].join('\n');
}

export function exportRestoreHistoryCsv(restores: RestoreHistory[]): string {
  const BOM = '\uFEFF';
  const headers = [
    'Restore ID', 'Backup ID', 'Date Time', 'Type', 'Status', 'Restored By',
    'Records Restored', 'Reason', 'Approved By', 'Pre-Restore Backup',
  ];
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const rows = restores.map((r) => [
    r.restoreId, r.backupId, r.restoreDateTime, r.restoreType, r.restoreStatus,
    r.restoredBy, String(r.recordsRestored), r.reasonForRestore, r.approvedBy, r.preRestoreBackupId,
  ].map((c) => escape(String(c ?? ''))).join(','));
  return BOM + [headers.join(','), ...rows].join('\n');
}

export function buildBackupHistoryPdfHtml(backups: BackupHistory[], generatedBy: string): string {
  const rows = backups.map((b, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${b.backupNumber}</td>
      <td>${new Date(b.backupDateTime).toLocaleString()}</td>
      <td>${b.backupType}</td>
      <td>${b.backupScope}</td>
      <td>${b.backupStatus}</td>
      <td>${b.fileSize}</td>
      <td>${b.recordsCount}</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Backup History</title>
  <style>body{font-family:Arial;margin:24px}table{width:100%;border-collapse:collapse;font-size:11px}
  th,td{border:1px solid #cbd5e1;padding:6px}th{background:#f1f5f9}h1{color:#1e40af}</style></head>
  <body><h1>Pharma QMS — Backup History Report</h1>
  <p>Generated: ${new Date().toLocaleString()} by ${generatedBy}</p>
  <p>Total: ${backups.length}</p>
  <table><thead><tr><th>#</th><th>Number</th><th>Date</th><th>Type</th><th>Scope</th><th>Status</th><th>Size</th><th>Records</th></tr></thead>
  <tbody>${rows}</tbody></table>
  <button onclick="window.print()">Print / Save PDF</button></body></html>`;
}

export function buildRestoreHistoryPdfHtml(restores: RestoreHistory[], generatedBy: string): string {
  const rows = restores.map((r, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${r.restoreId}</td>
      <td>${r.backupId}</td>
      <td>${new Date(r.restoreDateTime).toLocaleString()}</td>
      <td>${r.restoreType}</td>
      <td>${r.restoreStatus}</td>
      <td>${r.recordsRestored}</td>
      <td>${r.reasonForRestore}</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Restore History</title>
  <style>body{font-family:Arial;margin:24px}table{width:100%;border-collapse:collapse;font-size:11px}
  th,td{border:1px solid #cbd5e1;padding:6px}th{background:#f1f5f9}h1{color:#1e40af}</style></head>
  <body><h1>Pharma QMS — Restore History Report</h1>
  <p>Generated: ${new Date().toLocaleString()} by ${generatedBy}</p>
  <table><thead><tr><th>#</th><th>Restore ID</th><th>Backup ID</th><th>Date</th><th>Type</th><th>Status</th><th>Records</th><th>Reason</th></tr></thead>
  <tbody>${rows}</tbody></table>
  <button onclick="window.print()">Print / Save PDF</button></body></html>`;
}

export async function logBackupExport(
  exportType: string,
  meta: BackupAuditMeta,
  count: number,
): Promise<void> {
  await logBackupAudit('export backup settings', exportType, meta, null, { count, type: exportType });
}

export async function seedDefaultBackupSettings(meta: BackupAuditMeta): Promise<void> {
  const existing = await fetchBackupSettings();
  if (existing) return;
  await updateBackupSettings({
    autoBackupEnabled: false,
    backupFrequency: 'Weekly',
    backupTime: '02:00',
    backupScope: 'Full System',
    retentionPeriodDays: 90,
    notifyAdminOnSuccess: true,
    notifyAdminOnFailure: true,
    nextBackupDate: '',
    status: 'Active',
  }, meta);
}
