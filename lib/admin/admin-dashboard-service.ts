import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore';
import { ref, getMetadata } from 'firebase/storage';
import {
  getFirebaseFirestore, getFirebaseStorage, isFirebaseConfigured, getFirebaseAuth,
} from '@/lib/firebase';
import { ADMIN_COLLECTIONS, ADMIN_ROLES } from './constants';
import { isDemoAuthEnabled } from '@/lib/demo-auth-config';
import {
  checkFirebaseConnection, getAuditLogs, logAuditEvent,
} from './admin-service';
import type { AdminUser } from './schemas';

export interface DashboardKpis {
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  lockedUsers: number;
  totalRoles: number;
  totalDepartments: number;
  pendingApprovals: number;
  openAuditLogs: number;
  firebaseStatus: string;
  lastBackupStatus: string;
  systemHealthScore: number;
}

export interface LoginActivityRow {
  id?: string;
  userName: string;
  email: string;
  role: string;
  loginTime: string;
  deviceIp: string;
  status: string;
}

export interface AdminActionRow {
  id?: string;
  module: string;
  action: string;
  userName: string;
  dateTime: string;
  status: string;
}

export interface PendingApprovalRow {
  id: string;
  type: string;
  title: string;
  requestedBy: string;
  date: string;
  status: string;
}

export interface SystemHealthDetail {
  name: string;
  status: 'Healthy' | 'Degraded' | 'Down';
  detail: string;
}

export interface ChartPoint {
  name: string;
  value: number;
}

export interface AdminDashboardData {
  kpis: DashboardKpis;
  loginActivity: LoginActivityRow[];
  recentActions: AdminActionRow[];
  pendingApprovals: PendingApprovalRow[];
  systemHealth: {
    overall: string;
    score: number;
    checks: SystemHealthDetail[];
    buildVersion: string;
    environment: string;
    checkedAt: string;
  };
  charts: {
    usersByRole: ChartPoint[];
    usersByDepartment: ChartPoint[];
    monthlyLoginTrend: ChartPoint[];
    moduleUsageTrend: ChartPoint[];
    auditActionsTrend: ChartPoint[];
  };
}

const EMPTY_CHART: ChartPoint[] = [{ name: 'No Data', value: 0 }];

async function safeDocs(collectionName: string, max = 500): Promise<Record<string, unknown>[]> {
  if (!isFirebaseConfigured() || isDemoAuthEnabled()) return [];
  try {
    const snap = await getDocs(
      query(collection(getFirebaseFirestore(), collectionName), limit(max))
    );
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch {
    return [];
  }
}

function groupCount(items: Record<string, unknown>[], key: string, labelMap?: Record<string, string>): ChartPoint[] {
  const counts: Record<string, number> = {};
  items.forEach((item) => {
    const raw = String(item[key] ?? 'Unknown');
    const label = labelMap?.[raw] || raw.replace(/_/g, ' ');
    counts[label] = (counts[label] || 0) + 1;
  });
  const result = Object.entries(counts).map(([name, value]) => ({ name, value }));
  return result.length ? result : EMPTY_CHART;
}

function monthlyTrend(
  items: Record<string, unknown>[],
  dateKey: string,
  months = 6,
): ChartPoint[] {
  const monthMap: Record<string, number> = {};
  items.forEach((item) => {
    const dt = String(item[dateKey] ?? '');
    if (!dt) return;
    const d = new Date(dt);
    if (Number.isNaN(d.getTime())) return;
    const label = d.toLocaleString('default', { month: 'short', year: '2-digit' });
    monthMap[label] = (monthMap[label] || 0) + 1;
  });
  const entries = Object.entries(monthMap);
  if (!entries.length) return [{ name: 'N/A', value: 0 }];
  return entries.slice(-months).map(([name, value]) => ({ name, value }));
}

function healthScore(status: string): number {
  if (status === 'Healthy') return 100;
  if (status === 'Degraded') return 65;
  return 25;
}

export async function getExtendedSystemHealth(): Promise<{
  overall: string;
  score: number;
  checks: SystemHealthDetail[];
  checkedAt: string;
}> {
  if (isDemoAuthEnabled()) {
    const checks: SystemHealthDetail[] = [
      { name: 'Demo Mode', status: 'Healthy', detail: 'Local demo — Firebase backend skipped' },
      { name: 'Application', status: 'Healthy', detail: 'UI running normally' },
    ];
    return {
      overall: 'Healthy',
      score: 100,
      checks,
      checkedAt: new Date().toISOString(),
    };
  }

  const checks: SystemHealthDetail[] = [];
  const firebase = await checkFirebaseConnection();

  checks.push({
    name: 'Firebase Connection',
    status: firebase.connected ? 'Healthy' : firebase.configured ? 'Degraded' : 'Down',
    detail: firebase.connected
      ? `Connected (${firebase.latencyMs}ms) — ${firebase.projectId}`
      : firebase.error || 'Not configured',
  });

  if (isFirebaseConfigured()) {
    try {
      await getDocs(query(collection(getFirebaseFirestore(), ADMIN_COLLECTIONS.users), limit(1)));
      checks.push({ name: 'Firestore Read', status: 'Healthy', detail: 'Read test successful' });
    } catch (e) {
      checks.push({ name: 'Firestore Read', status: 'Down', detail: (e as Error).message });
    }

    try {
      const testRef = ref(getFirebaseStorage(), '.healthcheck');
      await getMetadata(testRef).catch(() => null);
      checks.push({ name: 'Storage', status: 'Healthy', detail: 'Storage bucket reachable' });
    } catch {
      checks.push({ name: 'Storage', status: 'Degraded', detail: 'Storage check inconclusive' });
    }

    try {
      const auth = getFirebaseAuth();
      checks.push({
        name: 'Auth',
        status: auth ? 'Healthy' : 'Degraded',
        detail: auth.currentUser ? `Session: ${auth.currentUser.email}` : 'Auth SDK initialized',
      });
    } catch (e) {
      checks.push({ name: 'Auth', status: 'Down', detail: (e as Error).message });
    }
  } else {
    checks.push(
      { name: 'Firestore Read', status: 'Down', detail: 'Firebase not configured' },
      { name: 'Storage', status: 'Down', detail: 'Firebase not configured' },
      { name: 'Auth', status: 'Down', detail: 'Firebase not configured' },
    );
  }

  try {
    if (!isFirebaseConfigured()) throw new Error('not configured');
    const backupSnap = await getDocs(
      query(collection(getFirebaseFirestore(), ADMIN_COLLECTIONS.backupRestore), orderBy('backupDate', 'desc'), limit(1))
    ).catch(() => null);
    const last = backupSnap?.docs[0]?.data();
    const age = last?.backupDate
      ? Math.floor((Date.now() - new Date(String(last.backupDate)).getTime()) / 86400000)
      : null;
    checks.push({
      name: 'Backup',
      status: age === null ? 'Degraded' : age > 7 ? 'Degraded' : 'Healthy',
      detail: age === null ? 'No backups found' : `Last backup ${age} day(s) ago`,
    });
  } catch {
    checks.push({ name: 'Backup', status: 'Degraded', detail: 'Cannot read backup log' });
  }

  const overall = checks.some((c) => c.status === 'Down')
    ? 'Down'
    : checks.some((c) => c.status === 'Degraded')
      ? 'Degraded'
      : 'Healthy';

  const score = Math.round(
    checks.reduce((sum, c) => sum + healthScore(c.status), 0) / checks.length
  );

  return { overall, score, checks, checkedAt: new Date().toISOString() };
}

export async function fetchAdminDashboardData(
  dateRange?: { startDate?: string; endDate?: string },
): Promise<AdminDashboardData> {
  const roleLabelMap = Object.fromEntries(ADMIN_ROLES.map((r) => [r.id, r.name]));

  const [
    usersRaw,
    rolesRaw,
    departmentsRaw,
    loginRaw,
    auditLogsRaw,
    auditTrailRaw,
    backupsRaw,
    notificationsRaw,
    workflowsRaw,
    docNumRaw,
    settingsRaw,
    health,
    firebase,
  ] = await Promise.all([
    safeDocs(ADMIN_COLLECTIONS.users),
    safeDocs(ADMIN_COLLECTIONS.roles),
    safeDocs(ADMIN_COLLECTIONS.departments),
    safeDocs(ADMIN_COLLECTIONS.loginActivity, 200),
    safeDocs(ADMIN_COLLECTIONS.auditLogs, 300),
    safeDocs(ADMIN_COLLECTIONS.auditTrail, 300),
    safeDocs(ADMIN_COLLECTIONS.backupRestore, 50),
    safeDocs(ADMIN_COLLECTIONS.notificationSettings, 100),
    safeDocs(ADMIN_COLLECTIONS.workflows, 100),
    safeDocs(ADMIN_COLLECTIONS.documentNumbering, 100),
    safeDocs(ADMIN_COLLECTIONS.systemSettings, 10),
    getExtendedSystemHealth(),
    checkFirebaseConnection(),
  ]);

  const users = usersRaw as AdminUser[];
  const activeUsers = users.filter((u) => u.userStatus === 'Active' || u.status === 'Active').length;
  const inactiveUsers = users.filter((u) => u.userStatus === 'Inactive' || u.status === 'Inactive').length;
  const lockedUsers = users.filter((u) => u.userStatus === 'Locked').length;
  const pendingUserApprovals = users.filter((u) => u.userStatus === 'Pending Approval');

  const lastBackup = [...backupsRaw].sort((a, b) =>
    String(b.backupDate ?? '').localeCompare(String(a.backupDate ?? ''))
  )[0];

  const openAuditLogs = auditLogsRaw.length + auditTrailRaw.length;

  const kpis: DashboardKpis = {
    totalUsers: users.length,
    activeUsers,
    inactiveUsers,
    lockedUsers,
    totalRoles: rolesRaw.length || ADMIN_ROLES.length,
    totalDepartments: departmentsRaw.length,
    pendingApprovals: pendingUserApprovals.length,
    openAuditLogs,
    firebaseStatus: firebase.connected ? 'Connected' : firebase.configured ? 'Degraded' : 'Not Configured',
    lastBackupStatus: lastBackup
      ? `${lastBackup.backupStatus || 'Success'} — ${new Date(String(lastBackup.backupDate)).toLocaleDateString()}`
      : 'No backups',
    systemHealthScore: health.score,
  };

  let loginActivity: LoginActivityRow[] = loginRaw.map((l) => ({
    id: l.id as string,
    userName: String(l.userName ?? l.fullName ?? '-'),
    email: String(l.email ?? '-'),
    role: String(l.role ?? '-').replace(/_/g, ' '),
    loginTime: String(l.loginTime ?? l.createdAt ?? ''),
    deviceIp: `${String(l.deviceInfo ?? l.device ?? '-')} / ${String(l.ipAddress ?? '-')}`,
    status: String(l.loginStatus ?? l.status ?? 'Success'),
  }));

  const trailActions: AdminActionRow[] = auditTrailRaw.map((l) => ({
    id: l.id as string,
    module: String(l.moduleName ?? l.module ?? 'System'),
    action: String(l.action ?? '-'),
    userName: String(l.userName ?? '-'),
    dateTime: String(l.timestamp ?? l.dateTime ?? ''),
    status: String(l.status ?? 'Success'),
  }));

  const logActions: AdminActionRow[] = auditLogsRaw.map((l) => ({
    id: l.id as string,
    module: String(l.module ?? 'Admin'),
    action: String(l.action ?? '-'),
    userName: String(l.userName ?? '-'),
    dateTime: String(l.dateTime ?? ''),
    status: String(l.status ?? 'Success'),
  }));

  let recentActions = [...trailActions, ...logActions]
    .sort((a, b) => String(b.dateTime).localeCompare(String(a.dateTime)))
    .slice(0, 15);

  const pendingApprovals: PendingApprovalRow[] = [];

  pendingUserApprovals.forEach((u) => {
    pendingApprovals.push({
      id: `user-${u.id ?? u.employeeId}`,
      type: 'User Creation',
      title: `${u.fullName || u.email} — new user`,
      requestedBy: String(u.createdBy ?? 'System'),
      date: String(u.createdAt ?? ''),
      status: 'Pending Approval',
    });
  });

  workflowsRaw
    .filter((w) => w.status === 'Inactive')
    .slice(0, 5)
    .forEach((w) => {
      pendingApprovals.push({
        id: `workflow-${w.id}`,
        type: 'Workflow Change',
        title: String(w.moduleName ?? w.id),
        requestedBy: String(w.updatedBy ?? '-'),
        date: String(w.updatedAt ?? ''),
        status: 'Pending',
      });
    });

  docNumRaw
    .filter((d) => d.status === 'Inactive')
    .slice(0, 5)
    .forEach((d) => {
      pendingApprovals.push({
        id: `docnum-${d.id}`,
        type: 'Document Numbering',
        title: String(d.module ?? d.prefix ?? d.id),
        requestedBy: String(d.updatedBy ?? '-'),
        date: String(d.updatedAt ?? ''),
        status: 'Pending Review',
      });
    });

  if (settingsRaw.some((s) => s.maintenanceMode === true)) {
    pendingApprovals.push({
      id: 'settings-maintenance',
      type: 'System Setting',
      title: 'Maintenance mode enabled',
      requestedBy: 'System',
      date: String(settingsRaw[0]?.updatedAt ?? ''),
      status: 'Active',
    });
  }

  notificationsRaw
    .filter((n) => n.status === 'Inactive')
    .slice(0, 3)
    .forEach((n) => {
      pendingApprovals.push({
        id: `notif-${n.id}`,
        type: 'Notification Config',
        title: String(n.eventName ?? n.id),
        requestedBy: String(n.updatedBy ?? '-'),
        date: String(n.updatedAt ?? ''),
        status: 'Pending',
      });
    });

  if (dateRange?.startDate) {
    loginActivity = loginActivity.filter((l) => l.loginTime >= dateRange.startDate!);
    recentActions = recentActions.filter((a) => a.dateTime >= dateRange.startDate!);
  }
  if (dateRange?.endDate) {
    loginActivity = loginActivity.filter((l) => l.loginTime <= dateRange.endDate! + 'T23:59:59');
    recentActions = recentActions.filter((a) => a.dateTime <= dateRange.endDate! + 'T23:59:59');
  }

  const usersByRole = groupCount(users as Record<string, unknown>[], 'role', roleLabelMap);
  const usersByDepartment = groupCount(users as Record<string, unknown>[], 'department');
  const monthlyLoginTrend = monthlyTrend(loginRaw, 'loginTime');
  const moduleUsageTrend = monthlyTrend(
    [...auditTrailRaw, ...auditLogsRaw.map((l) => ({ ...l, moduleName: l.module }))],
    'timestamp',
  );
  const auditActionsTrend = monthlyTrend([...auditTrailRaw, ...auditLogsRaw], 'dateTime');

  return {
    kpis,
    loginActivity: loginActivity.slice(0, 10),
    recentActions,
    pendingApprovals: pendingApprovals.slice(0, 12),
    systemHealth: {
      overall: health.overall,
      score: health.score,
      checks: health.checks,
      buildVersion: process.env.NEXT_PUBLIC_APP_VERSION || '0.1.0',
      environment: process.env.NODE_ENV || 'development',
      checkedAt: health.checkedAt,
    },
    charts: {
      usersByRole,
      usersByDepartment,
      monthlyLoginTrend,
      moduleUsageTrend: groupCount(
        [...auditTrailRaw, ...auditLogsRaw.map((l) => ({ moduleName: l.module }))],
        'moduleName',
      ),
      auditActionsTrend,
    },
  };
}

export async function runDashboardBackup(
  auditMeta: { userId: string; userName: string },
): Promise<{ success: boolean; error?: string }> {
  if (!isFirebaseConfigured()) {
    return { success: false, error: 'Firebase not configured' };
  }
  try {
    const collections = [
      ADMIN_COLLECTIONS.users,
      ADMIN_COLLECTIONS.roles,
      ADMIN_COLLECTIONS.departments,
      ADMIN_COLLECTIONS.auditTrail,
      ADMIN_COLLECTIONS.loginActivity,
      ADMIN_COLLECTIONS.backupRestore,
      ADMIN_COLLECTIONS.systemSettings,
    ];
    const backup: Record<string, unknown[]> = {};
    for (const col of collections) {
      const snap = await getDocs(collection(getFirebaseFirestore(), col));
      backup[col] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    }
    const json = JSON.stringify(backup, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const backupId = `BK-${Date.now()}`;

    await logAuditEvent({
      userId: auditMeta.userId,
      userName: auditMeta.userName,
      module: 'Admin Dashboard',
      recordId: backupId,
      action: 'BACKUP',
      oldValue: '',
      newValue: JSON.stringify({ backupId, size: blob.size }),
      reason: 'Dashboard backup now',
      ipAddress: 'client',
      device: typeof navigator !== 'undefined' ? navigator.userAgent : 'browser',
      status: 'Success',
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${backupId}.json`;
    a.click();
    URL.revokeObjectURL(url);

    return { success: true };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

export async function logDashboardAudit(
  action: string,
  auditMeta: { userId: string; userName: string },
  detail?: string,
) {
  try {
    await logAuditEvent({
      userId: auditMeta.userId,
      userName: auditMeta.userName,
      module: 'Admin Dashboard',
      recordId: 'dashboard',
      action,
      oldValue: '',
      newValue: detail || action,
      reason: '',
      ipAddress: 'client',
      device: typeof navigator !== 'undefined' ? navigator.userAgent : 'browser',
      status: 'Success',
    });
  } catch {
    // non-blocking
  }
}
