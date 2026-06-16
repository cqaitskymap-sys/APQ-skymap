import { writeAuditTrail, createAuditLog } from '@/lib/audit-trail';
import {
  getAdminRecords, createAdminRecord, updateAdminRecord,
  checkUniqueField, logAuditEvent,
} from './admin-service';
import { ADMIN_COLLECTIONS } from './constants';
import type { EsignSettings, EsignSettingFormData } from './schemas';

export interface EsignSettingAuditMeta {
  userId: string;
  userName: string;
}

async function logEsignSettingAudit(
  action: string,
  recordId: string,
  meta: EsignSettingAuditMeta,
  oldValue: unknown,
  newValue: unknown,
) {
  await logAuditEvent({
    userId: meta.userId,
    userName: meta.userName,
    module: 'E-Signature Settings',
    recordId,
    action,
    oldValue: typeof oldValue === 'string' ? oldValue : JSON.stringify(oldValue ?? ''),
    newValue: typeof newValue === 'string' ? newValue : JSON.stringify(newValue ?? ''),
    reason: '',
    ipAddress: 'client',
    device: typeof navigator !== 'undefined' ? navigator.userAgent : 'browser',
    status: 'Success',
  });

  await writeAuditTrail({
    collectionName: ADMIN_COLLECTIONS.esignSettings,
    documentId: recordId,
    action,
    oldValue,
    newValue,
    userId: meta.userId,
    userName: meta.userName,
    moduleName: 'E-Signature Settings',
  });

  await createAuditLog({
    moduleName: 'Admin',
    collectionName: ADMIN_COLLECTIONS.esignSettings,
    recordId,
    actionType: action.includes('ACTIVATE') ? 'Update' : action.includes('CREATE') ? 'Create' : 'Update',
    actionDescription: action,
    user: { id: meta.userId, name: meta.userName },
    status: 'Success',
    oldValue,
    newValue,
  });
}

export function buildEsignSettingId(code: string): string {
  return `ESIGN-${code.toUpperCase().replace(/\s+/g, '-')}`;
}

export function normalizeEsignSetting(s: EsignSettings): EsignSettings {
  const timeout = Number(s.sessionTimeoutMinutes ?? s.sessionTimeout ?? 15);
  return {
    ...s,
    esignSettingId: s.esignSettingId || buildEsignSettingId(s.settingCode || 'SETTING'),
    requirePasswordReAuthentication: s.requirePasswordReAuthentication ?? s.requirePasswordConfirmation ?? true,
    requirePasswordConfirmation: s.requirePasswordReAuthentication ?? s.requirePasswordConfirmation ?? true,
    requireCommentReason: s.requireCommentReason ?? s.requireReason ?? true,
    requireReason: s.requireCommentReason ?? s.requireReason ?? true,
    sessionTimeoutMinutes: timeout,
    sessionTimeout: timeout,
    maxFailedEsignAttempts: Number(s.maxFailedEsignAttempts ?? 3),
    lockAccountAfterFailedAttempts: s.lockAccountAfterFailedAttempts ?? true,
    allowDelegatedSignature: s.allowDelegatedSignature ?? false,
    requireFinalApprovalSignature: s.requireFinalApprovalSignature ?? false,
    showSignatureStatement: s.showSignatureStatement ?? true,
    signatureStatementText: s.signatureStatementText || defaultStatementText(s.signatureMeaning),
    requireDepartmentVerification: s.requireDepartmentVerification ?? false,
    requireActiveSession: s.requireActiveSession ?? true,
    requireRoleVerification: s.requireRoleVerification ?? true,
  };
}

function defaultStatementText(meaning?: string): string {
  if (!meaning) return 'By signing electronically, I confirm this action is accurate and attributable to me.';
  return `By signing electronically, I confirm: ${meaning}`;
}

export function isEsignSettingActive(s: EsignSettings): boolean {
  return s.status === 'Active' && !s.isDeleted;
}

export async function fetchEsignSettings(): Promise<EsignSettings[]> {
  try {
    const records = await getAdminRecords<EsignSettings>(ADMIN_COLLECTIONS.esignSettings);
    return records.filter((s) => !s.isDeleted).map(normalizeEsignSetting);
  } catch {
    return [];
  }
}

export async function fetchEsignSettingById(id: string): Promise<EsignSettings | null> {
  const all = await fetchEsignSettings();
  return all.find((s) => s.id === id) ?? null;
}

export async function fetchActiveEsignSetting(
  moduleName: string,
  actionType: string,
): Promise<EsignSettings | null> {
  const settings = await fetchEsignSettings();
  return settings.find((s) =>
    isEsignSettingActive(s) &&
    s.moduleName === moduleName &&
    s.actionType === actionType,
  ) ?? null;
}

export async function hasDuplicateActiveEsignSetting(
  moduleName: string,
  actionType: string,
  excludeId?: string,
): Promise<boolean> {
  const settings = await fetchEsignSettings();
  return settings.some((s) =>
    isEsignSettingActive(s) &&
    s.moduleName === moduleName &&
    s.actionType === actionType &&
    s.id !== excludeId,
  );
}

export function getEsignSettingsSummary(settings: EsignSettings[]) {
  return {
    total: settings.length,
    active: settings.filter((s) => s.status === 'Active').length,
    inactive: settings.filter((s) => s.status === 'Inactive').length,
    passwordRequired: settings.filter((s) => s.requirePasswordReAuthentication).length,
    commentRequired: settings.filter((s) => s.requireCommentReason).length,
  };
}

function formToPayload(data: EsignSettingFormData, meta: EsignSettingAuditMeta, status = 'Active') {
  const esignSettingId = buildEsignSettingId(data.settingCode);
  const statement = data.signatureStatementText || defaultStatementText(data.signatureMeaning);
  return {
    esignSettingId,
    settingCode: data.settingCode,
    moduleName: data.moduleName,
    actionType: data.actionType,
    signatureMeaning: data.signatureMeaning,
    requirePasswordReAuthentication: data.requirePasswordReAuthentication,
    requirePasswordConfirmation: data.requirePasswordReAuthentication,
    requireCommentReason: data.requireCommentReason,
    requireReason: data.requireCommentReason,
    requireRoleVerification: data.requireRoleVerification,
    requireDepartmentVerification: data.requireDepartmentVerification,
    requireActiveSession: data.requireActiveSession,
    sessionTimeoutMinutes: data.sessionTimeoutMinutes,
    sessionTimeout: data.sessionTimeoutMinutes,
    maxFailedEsignAttempts: data.maxFailedEsignAttempts,
    lockAccountAfterFailedAttempts: data.lockAccountAfterFailedAttempts,
    allowDelegatedSignature: data.allowDelegatedSignature,
    requireFinalApprovalSignature: data.requireFinalApprovalSignature,
    showSignatureStatement: data.showSignatureStatement,
    signatureStatementText: statement,
    remarks: data.remarks,
    status,
    updatedBy: meta.userId,
  };
}

export async function createEsignSetting(
  data: EsignSettingFormData,
  meta: EsignSettingAuditMeta,
): Promise<{ setting: EsignSettings | null; error: string | null }> {
  try {
    const unique = await checkUniqueField(ADMIN_COLLECTIONS.esignSettings, 'settingCode', data.settingCode);
    if (!unique) return { setting: null, error: 'Setting code already exists' };

    if (await hasDuplicateActiveEsignSetting(data.moduleName, data.actionType)) {
      return { setting: null, error: 'An active setting already exists for this module and action' };
    }

    const payload = { ...formToPayload(data, meta), createdBy: meta.userId };
    const created = await createAdminRecord(
      ADMIN_COLLECTIONS.esignSettings,
      payload as Omit<EsignSettings, 'id'>,
      { userId: meta.userId, userName: meta.userName, module: 'E-Signature Settings', action: 'CREATE_ESIGN_SETTING' },
    );

    await logEsignSettingAudit('CREATE_ESIGN_SETTING', created.id || payload.esignSettingId, meta, null, payload);
    return { setting: normalizeEsignSetting(created as EsignSettings), error: null };
  } catch (e) {
    return { setting: null, error: (e as Error).message };
  }
}

export async function updateEsignSetting(
  id: string,
  data: EsignSettingFormData,
  existing: EsignSettings,
  meta: EsignSettingAuditMeta,
): Promise<{ setting: EsignSettings | null; error: string | null }> {
  try {
    if (data.settingCode !== existing.settingCode) {
      const unique = await checkUniqueField(ADMIN_COLLECTIONS.esignSettings, 'settingCode', data.settingCode, id);
      if (!unique) return { setting: null, error: 'Setting code already exists' };
    }

    if (existing.status === 'Active' && await hasDuplicateActiveEsignSetting(data.moduleName, data.actionType, id)) {
      return { setting: null, error: 'An active setting already exists for this module and action' };
    }

    const updates = formToPayload(data, meta, existing.status);
    delete (updates as { createdBy?: string }).createdBy;

    const updated = await updateAdminRecord(ADMIN_COLLECTIONS.esignSettings, id, updates, {
      userId: meta.userId,
      userName: meta.userName,
      module: 'E-Signature Settings',
      oldValue: JSON.stringify(existing),
    });

    await logEsignSettingAudit('EDIT_ESIGN_SETTING', id, meta, existing, updates);
    return { setting: normalizeEsignSetting(updated as EsignSettings), error: null };
  } catch (e) {
    return { setting: null, error: (e as Error).message };
  }
}

export async function setEsignSettingStatus(
  id: string,
  setting: EsignSettings,
  status: 'Active' | 'Inactive',
  meta: EsignSettingAuditMeta,
): Promise<{ success: boolean; error?: string }> {
  try {
    if (status === 'Active' && await hasDuplicateActiveEsignSetting(setting.moduleName, setting.actionType, id)) {
      return { success: false, error: 'Another active setting exists for this module and action' };
    }

    await updateAdminRecord(ADMIN_COLLECTIONS.esignSettings, id, { status }, {
      userId: meta.userId,
      userName: meta.userName,
      module: 'E-Signature Settings',
      oldValue: JSON.stringify(setting),
    });

    const action = status === 'Active' ? 'ACTIVATE_ESIGN_SETTING' : 'DEACTIVATE_ESIGN_SETTING';
    await logEsignSettingAudit(action, id, meta, setting.status, status);
    return { success: true };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

export function exportEsignSettingsCsv(settings: EsignSettings[]): string {
  const headers = [
    'Setting Code', 'Module', 'Action', 'Signature Meaning', 'Password Required',
    'Comment Required', 'Role Verification', 'Session Timeout', 'Max Failed Attempts',
    'Lock After Failures', 'Status',
  ];
  const rows = settings.map((s) => [
    s.settingCode, s.moduleName, s.actionType, s.signatureMeaning,
    s.requirePasswordReAuthentication ? 'Yes' : 'No',
    s.requireCommentReason ? 'Yes' : 'No',
    s.requireRoleVerification ? 'Yes' : 'No',
    String(s.sessionTimeoutMinutes),
    String(s.maxFailedEsignAttempts),
    s.lockAccountAfterFailedAttempts ? 'Yes' : 'No',
    s.status,
  ].map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','));
  return [headers.join(','), ...rows].join('\n');
}

export async function logEsignSettingsExport(meta: EsignSettingAuditMeta, count: number): Promise<void> {
  await logEsignSettingAudit('EXPORT_ESIGN_SETTINGS', 'export', meta, null, { count });
  await createAuditLog({
    moduleName: 'Admin',
    collectionName: ADMIN_COLLECTIONS.esignSettings,
    recordId: 'export',
    actionType: 'Export',
    actionDescription: `Exported ${count} e-signature settings`,
    user: { id: meta.userId, name: meta.userName },
    status: 'Success',
  });
}

const DEFAULT_ESIGN_SETTINGS: Array<EsignSettingFormData & { settingCode: string }> = [
  {
    settingCode: 'PQR-APPROVE',
    moduleName: 'PQR',
    actionType: 'Approved By',
    signatureMeaning: 'I approve this record',
    requirePasswordReAuthentication: true,
    requireCommentReason: true,
    requireRoleVerification: true,
    requireDepartmentVerification: false,
    requireActiveSession: true,
    sessionTimeoutMinutes: 15,
    maxFailedEsignAttempts: 3,
    lockAccountAfterFailedAttempts: true,
    allowDelegatedSignature: false,
    requireFinalApprovalSignature: true,
    showSignatureStatement: true,
    signatureStatementText: '',
    remarks: 'Default PQR approval e-signature',
  },
  {
    settingCode: 'DEV-APPROVE',
    moduleName: 'Deviation',
    actionType: 'Approved By',
    signatureMeaning: 'I approve this record',
    requirePasswordReAuthentication: true,
    requireCommentReason: true,
    requireRoleVerification: true,
    requireDepartmentVerification: false,
    requireActiveSession: true,
    sessionTimeoutMinutes: 15,
    maxFailedEsignAttempts: 3,
    lockAccountAfterFailedAttempts: true,
    allowDelegatedSignature: false,
    requireFinalApprovalSignature: false,
    showSignatureStatement: true,
    signatureStatementText: '',
    remarks: '',
  },
  {
    settingCode: 'OOS-CLOSE',
    moduleName: 'OOS',
    actionType: 'Closed By',
    signatureMeaning: 'I close this record',
    requirePasswordReAuthentication: true,
    requireCommentReason: true,
    requireRoleVerification: true,
    requireDepartmentVerification: false,
    requireActiveSession: true,
    sessionTimeoutMinutes: 15,
    maxFailedEsignAttempts: 3,
    lockAccountAfterFailedAttempts: true,
    allowDelegatedSignature: false,
    requireFinalApprovalSignature: false,
    showSignatureStatement: true,
    signatureStatementText: '',
    remarks: '',
  },
  {
    settingCode: 'CAPA-APPROVE',
    moduleName: 'CAPA',
    actionType: 'Approved By',
    signatureMeaning: 'I approve this record',
    requirePasswordReAuthentication: true,
    requireCommentReason: true,
    requireRoleVerification: true,
    requireDepartmentVerification: false,
    requireActiveSession: true,
    sessionTimeoutMinutes: 15,
    maxFailedEsignAttempts: 3,
    lockAccountAfterFailedAttempts: true,
    allowDelegatedSignature: false,
    requireFinalApprovalSignature: false,
    showSignatureStatement: true,
    signatureStatementText: '',
    remarks: '',
  },
  {
    settingCode: 'EBMR-RELEASE',
    moduleName: 'eBMR',
    actionType: 'Batch Released By',
    signatureMeaning: 'I release this batch',
    requirePasswordReAuthentication: true,
    requireCommentReason: true,
    requireRoleVerification: true,
    requireDepartmentVerification: true,
    requireActiveSession: true,
    sessionTimeoutMinutes: 10,
    maxFailedEsignAttempts: 3,
    lockAccountAfterFailedAttempts: true,
    allowDelegatedSignature: false,
    requireFinalApprovalSignature: true,
    showSignatureStatement: true,
    signatureStatementText: '',
    remarks: '',
  },
];

export async function seedDefaultEsignSettings(
  meta: EsignSettingAuditMeta,
): Promise<{ created: number; skipped: number }> {
  let created = 0;
  let skipped = 0;
  for (const def of DEFAULT_ESIGN_SETTINGS) {
    const exists = await checkUniqueField(ADMIN_COLLECTIONS.esignSettings, 'settingCode', def.settingCode);
    if (!exists) {
      skipped += 1;
      continue;
    }
    const result = await createEsignSetting(def, meta);
    if (result.setting) created += 1;
    else skipped += 1;
  }
  return { created, skipped };
}
