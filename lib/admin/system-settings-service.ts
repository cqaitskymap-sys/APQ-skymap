import { ref, getMetadata } from 'firebase/storage';
import { writeAuditTrail, createAuditLog } from '@/lib/audit-trail';
import {
  getAdminRecords, createAdminRecord, updateAdminRecord, logAuditEvent,
  checkFirebaseConnection,
} from './admin-service';
import { ADMIN_COLLECTIONS } from './constants';
import type { SystemSettings } from './schemas';
import { getFirebaseStorage, isFirebaseConfigured, getFirebaseAuth } from '@/lib/firebase';
import { isDemoAuthEnabled } from '@/lib/demo-auth-config';

export interface SystemSettingsAuditMeta {
  userId: string;
  userName: string;
}

const SETTINGS_DOC_KEY = 'global';

async function logSettingsAudit(
  action: string,
  section: string,
  meta: SystemSettingsAuditMeta,
  oldValue: unknown,
  newValue: unknown,
) {
  await logAuditEvent({
    userId: meta.userId,
    userName: meta.userName,
    module: 'System Settings',
    recordId: SETTINGS_DOC_KEY,
    action,
    oldValue: typeof oldValue === 'string' ? oldValue : JSON.stringify(oldValue ?? ''),
    newValue: typeof newValue === 'string' ? newValue : JSON.stringify(newValue ?? ''),
    reason: section,
    ipAddress: typeof window !== 'undefined' ? 'client' : 'server',
    device: typeof navigator !== 'undefined' ? navigator.userAgent : 'browser',
    status: 'Success',
  });

  await writeAuditTrail({
    collectionName: ADMIN_COLLECTIONS.systemSettings,
    documentId: SETTINGS_DOC_KEY,
    action,
    oldValue,
    newValue,
    userId: meta.userId,
    userName: meta.userName,
    moduleName: 'System Settings',
  });

  await createAuditLog({
    moduleName: 'System Settings',
    collectionName: ADMIN_COLLECTIONS.systemSettings,
    recordId: SETTINGS_DOC_KEY,
    actionType: action,
    actionDescription: `${action} — ${section}`,
    oldValue,
    newValue,
    user: { id: meta.userId, name: meta.userName },
    status: 'Success',
  });
}

export function getDefaultSystemSettings(): Omit<SystemSettings, 'id'> {
  return {
    applicationName: 'Skymap PharmaQMS',
    applicationShortName: 'PharmaQMS',
    companyDefaultSite: '',
    defaultLanguage: 'en',
    timezone: 'Asia/Kolkata',
    dateFormat: 'DD/MM/YYYY',
    timeFormat: '24h',
    defaultCurrency: 'INR',
    financialYearStartMonth: 'April',
    supportEmail: 'support@pharmaqms.com',
    supportPhone: '',
    applicationVersion: '1.0.0',
    environment: 'Production',
    status: 'Active',
    enableRoleBasedAccess: true,
    enablePermissionGuard: true,
    enableAuditTrail: true,
    enableESignature: true,
    enableTwoFactorAuth: false,
    allowMultipleSessions: true,
    allowIpRestriction: false,
    allowedIpList: '',
    enableAccountLockout: true,
    maxFailedLoginAttempts: 5,
    accountLockDurationMinutes: 30,
    minPasswordLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireNumber: true,
    requireSpecialChar: true,
    passwordExpiryDays: 90,
    preventLastPasswordReuseCount: 5,
    forcePasswordChangeOnFirstLogin: true,
    sessionTimeoutMinutes: 30,
    idleTimeoutMinutes: 15,
    rememberMeEnabled: true,
    autoLogoutWarningMinutes: 2,
    allowedFileTypes: '.pdf,.doc,.docx,.xls,.xlsx,.jpg,.png',
    maxFileSizeMb: 10,
    enableVirusScanPlaceholder: false,
    storagePathFormat: '{module}/{year}/{recordId}',
    allowPdf: true,
    allowExcel: true,
    allowWord: true,
    allowImages: true,
    defaultTheme: 'light',
    enableDarkMode: true,
    primaryColor: '#2563eb',
    sidebarMode: 'Expanded',
    logoDisplayMode: 'Full Logo',
    compactMode: false,
    companyLogo: '',
    maintenanceModeEnabled: false,
    maintenanceMessage: 'System is under scheduled maintenance. Please try again later.',
    allowedAdminAccessDuringMaintenance: true,
    scheduledMaintenanceStart: '',
    scheduledMaintenanceEnd: '',
    enableSystemLogs: true,
    logRetentionDays: 90,
    enableErrorTracking: true,
    enablePerformanceLogs: false,
    passwordPolicy: '',
    createdBy: 'system',
    updatedBy: 'system',
  };
}

export function normalizeSystemSettings(raw: SystemSettings): SystemSettings {
  const maintenanceEnabled = raw.maintenanceModeEnabled ?? raw.maintenanceMode ?? false;
  const sessionTimeout = Number(raw.sessionTimeoutMinutes ?? raw.sessionTimeout ?? 30);
  const maxAttempts = Number(raw.maxFailedLoginAttempts ?? raw.maxLoginAttempts ?? 5);
  const lockDuration = Number(raw.accountLockDurationMinutes ?? raw.accountLockDuration ?? 30);
  const maxSize = Number(raw.maxFileSizeMb ?? raw.maxUploadSize ?? 10);

  const passwordParts = [
    raw.minPasswordLength ? `Min ${raw.minPasswordLength} chars` : '',
    raw.requireUppercase ? 'uppercase' : '',
    raw.requireLowercase ? 'lowercase' : '',
    raw.requireNumber ? 'number' : '',
    raw.requireSpecialChar ? 'special char' : '',
  ].filter(Boolean);

  return {
    ...raw,
    maintenanceModeEnabled: maintenanceEnabled,
    maintenanceMode: maintenanceEnabled,
    sessionTimeoutMinutes: sessionTimeout,
    sessionTimeout,
    maxFailedLoginAttempts: maxAttempts,
    maxLoginAttempts: maxAttempts,
    accountLockDurationMinutes: lockDuration,
    accountLockDuration: lockDuration,
    maxFileSizeMb: maxSize,
    maxUploadSize: maxSize,
    passwordPolicy: raw.passwordPolicy || passwordParts.join(', ') || 'Min 8 chars, uppercase, number, special',
    dateFormat: (raw.dateFormat as SystemSettings['dateFormat']) || 'DD/MM/YYYY',
    timeFormat: (raw.timeFormat as SystemSettings['timeFormat']) || '24h',
  };
}

function getLocalSystemSettings(id = 'local'): SystemSettings {
  return normalizeSystemSettings({
    id,
    ...getDefaultSystemSettings(),
  } as SystemSettings);
}

export async function fetchSystemSettings(): Promise<SystemSettings | null> {
  if (isDemoAuthEnabled()) {
    const { demoGetSession } = await import('@/lib/demo-auth');
    if (demoGetSession()) return getLocalSystemSettings('demo');
    return null;
  }

  if (!isFirebaseConfigured()) return null;

  const auth = getFirebaseAuth();
  if (!auth.currentUser) return null;

  try {
    const records = await getAdminRecords<SystemSettings>(ADMIN_COLLECTIONS.systemSettings);
    if (!records.length) return getLocalSystemSettings('default');
    return normalizeSystemSettings(records[0]);
  } catch {
    return getLocalSystemSettings('local');
  }
}

export async function updateSystemSettings(
  updates: Partial<SystemSettings>,
  meta: SystemSettingsAuditMeta,
  section: string,
): Promise<SystemSettings | null> {
  const existing = await fetchSystemSettings();
  const payload = { ...updates, updatedBy: meta.userId };

  if (existing?.id) {
    const updated = await updateAdminRecord<SystemSettings>(
      ADMIN_COLLECTIONS.systemSettings,
      existing.id,
      payload,
      { userId: meta.userId, userName: meta.userName, module: 'System Settings' },
    );
    if (updated) {
      await logSettingsAudit(`${section} setting change`, section, meta, existing, updated);
    }
    return updated ? normalizeSystemSettings(updated) : null;
  }

  const created = await createAdminRecord<SystemSettings>(
    ADMIN_COLLECTIONS.systemSettings,
    { ...getDefaultSystemSettings(), ...payload },
    { userId: meta.userId, userName: meta.userName, module: 'System Settings', action: 'CREATE' },
  );
  if (created) {
    await logSettingsAudit(`${section} setting change`, section, meta, null, created);
  }
  return created ? normalizeSystemSettings(created) : null;
}

export async function resetSystemSettingsToDefault(
  meta: SystemSettingsAuditMeta,
): Promise<SystemSettings | null> {
  const existing = await fetchSystemSettings();
  const defaults = getDefaultSystemSettings();
  if (existing?.id) {
    const updated = await updateAdminRecord<SystemSettings>(
      ADMIN_COLLECTIONS.systemSettings,
      existing.id,
      { ...defaults, updatedBy: meta.userId },
      { userId: meta.userId, userName: meta.userName, module: 'System Settings' },
    );
    await logSettingsAudit('reset to default', 'all', meta, existing, defaults);
    return updated ? normalizeSystemSettings(updated) : null;
  }
  const created = await createAdminRecord<SystemSettings>(
    ADMIN_COLLECTIONS.systemSettings,
    defaults,
    { userId: meta.userId, userName: meta.userName, module: 'System Settings' },
  );
  await logSettingsAudit('reset to default', 'all', meta, null, defaults);
  return created ? normalizeSystemSettings(created) : null;
}

export function exportSystemSettingsJson(settings: SystemSettings): string {
  const exportable = { ...settings };
  delete (exportable as { id?: string }).id;
  return JSON.stringify(exportable, null, 2);
}

export async function importSystemSettingsJson(
  json: string,
  meta: SystemSettingsAuditMeta,
): Promise<{ settings: SystemSettings | null; error?: string }> {
  try {
    const parsed = JSON.parse(json) as Partial<SystemSettings>;
    const forbidden = ['id', 'createdAt', 'createdBy'];
    forbidden.forEach((k) => delete (parsed as Record<string, unknown>)[k]);
    const updated = await updateSystemSettings(parsed, meta, 'import');
    await logSettingsAudit('settings import', 'import', meta, null, { keys: Object.keys(parsed) });
    return { settings: updated };
  } catch (e) {
    return { settings: null, error: (e as Error).message };
  }
}

export function buildPasswordPolicyPreview(settings: SystemSettings): string {
  const rules: string[] = [];
  rules.push(`At least ${settings.minPasswordLength} characters`);
  if (settings.requireUppercase) rules.push('One uppercase letter');
  if (settings.requireLowercase) rules.push('One lowercase letter');
  if (settings.requireNumber) rules.push('One number');
  if (settings.requireSpecialChar) rules.push('One special character');
  if (settings.passwordExpiryDays > 0) rules.push(`Expires every ${settings.passwordExpiryDays} days`);
  if (settings.preventLastPasswordReuseCount > 0) {
    rules.push(`Cannot reuse last ${settings.preventLastPasswordReuseCount} passwords`);
  }
  if (settings.forcePasswordChangeOnFirstLogin) rules.push('Force change on first login');
  return rules.join(' · ');
}

export interface FirebaseHealthStatus {
  configured: boolean;
  authStatus: 'Connected' | 'Degraded' | 'Not Configured';
  firestoreStatus: 'Connected' | 'Degraded' | 'Not Configured';
  storageStatus: 'Connected' | 'Degraded' | 'Not Configured';
  projectId: string;
  latencyMs: number;
  envVars: { key: string; configured: boolean }[];
  error?: string;
}

const FIREBASE_ENV_KEYS = [
  'NEXT_PUBLIC_FIREBASE_API_KEY',
  'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
  'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  'NEXT_PUBLIC_FIREBASE_APP_ID',
] as const;

export async function checkFirebaseHealth(): Promise<FirebaseHealthStatus> {
  const envVars = FIREBASE_ENV_KEYS.map((key) => ({
    key,
    configured: Boolean(process.env[key]?.trim()),
  }));

  const configured = isFirebaseConfigured();
  if (!configured) {
    return {
      configured: false,
      authStatus: 'Not Configured',
      firestoreStatus: 'Not Configured',
      storageStatus: 'Not Configured',
      projectId: '',
      latencyMs: 0,
      envVars,
      error: 'Firebase environment variables missing',
    };
  }

  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '';
  const base = await checkFirebaseConnection();
  let authStatus: FirebaseHealthStatus['authStatus'] = 'Connected';
  try {
    const auth = getFirebaseAuth();
    authStatus = auth.currentUser || auth.app ? 'Connected' : 'Degraded';
  } catch {
    authStatus = 'Degraded';
  }

  let storageStatus: FirebaseHealthStatus['storageStatus'] = 'Connected';
  try {
    await getMetadata(ref(getFirebaseStorage(), '.healthcheck'));
  } catch {
    storageStatus = base.connected ? 'Degraded' : 'Not Configured';
  }

  return {
    configured: true,
    authStatus,
    firestoreStatus: base.connected ? 'Connected' : 'Degraded',
    storageStatus,
    projectId,
    latencyMs: base.latencyMs,
    envVars,
    error: base.error,
  };
}

export async function logFirebaseHealthCheck(meta: SystemSettingsAuditMeta): Promise<FirebaseHealthStatus> {
  const health = await checkFirebaseHealth();
  await logSettingsAudit('firebase health check', 'firebase', meta, null, health);
  return health;
}

export function isMaintenanceModeActive(settings: SystemSettings | null): boolean {
  if (!settings) return false;
  return Boolean(settings.maintenanceModeEnabled ?? settings.maintenanceMode);
}

export function canAccessDuringMaintenance(role?: string | null): boolean {
  const r = role?.toLowerCase() || '';
  return ['super_admin', 'admin'].includes(r);
}

export function getAllowedFileExtensions(settings: SystemSettings): string[] {
  const fromString = settings.allowedFileTypes
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const fromFlags: string[] = [];
  if (settings.allowPdf) fromFlags.push('.pdf');
  if (settings.allowExcel) fromFlags.push('.xls', '.xlsx', '.csv');
  if (settings.allowWord) fromFlags.push('.doc', '.docx');
  if (settings.allowImages) fromFlags.push('.jpg', '.jpeg', '.png', '.gif', '.webp');
  return Array.from(new Set([...fromString, ...fromFlags]));
}

export function validateFileAgainstSettings(
  file: File,
  settings: SystemSettings | null,
): { allowed: boolean; error?: string } {
  const s = settings ? normalizeSystemSettings(settings) : normalizeSystemSettings(getDefaultSystemSettings() as SystemSettings);
  const maxBytes = s.maxFileSizeMb * 1024 * 1024;
  if (file.size > maxBytes) {
    return {
      allowed: false,
      error: `File size exceeds maximum allowed size of ${s.maxFileSizeMb} MB.`,
    };
  }

  const ext = `.${file.name.split('.').pop()?.toLowerCase() || ''}`;
  const allowed = getAllowedFileExtensions(s);
  if (!allowed.some((a) => a === ext || a === ext.replace('.', ''))) {
    return {
      allowed: false,
      error: `File type "${ext}" is not allowed. Allowed types: ${allowed.join(', ')}`,
    };
  }

  return { allowed: true };
}
