import { writeAuditTrail, createAuditLog } from '@/lib/audit-trail';
import {
  applyTemplateVariables,
  sendInAppNotification,
  sendEmailNotificationPlaceholder,
  getAllNotifications,
  getNotificationStats,
} from '@/lib/notification-service';
import {
  getAdminRecords, createAdminRecord, updateAdminRecord,
  checkUniqueField, logAuditEvent,
} from './admin-service';
import { ADMIN_COLLECTIONS } from './constants';
import type { NotificationSetting, NotificationSettingFormData } from './schemas';

export interface NotificationSettingAuditMeta {
  userId: string;
  userName: string;
}

async function logNotificationSettingAudit(
  action: string,
  recordId: string,
  meta: NotificationSettingAuditMeta,
  oldValue: unknown,
  newValue: unknown,
) {
  await logAuditEvent({
    userId: meta.userId,
    userName: meta.userName,
    module: 'Notification Settings',
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
    collectionName: ADMIN_COLLECTIONS.notificationSettings,
    documentId: recordId,
    action,
    oldValue,
    newValue,
    userId: meta.userId,
    userName: meta.userName,
    moduleName: 'Notification Settings',
  });
}

export function buildNotificationSettingId(code: string): string {
  return `NTS-${code.toUpperCase().replace(/\s+/g, '-')}`;
}

export function normalizeNotificationSetting(s: NotificationSetting): NotificationSetting {
  const beforeDue = Number(s.notifyBeforeDueDays ?? s.beforeDueDays ?? 3);
  const escalation = Number(s.escalationAfterDays ?? s.escalationDays ?? 7);
  return {
    ...s,
    notificationSettingId: s.notificationSettingId || buildNotificationSettingId(s.notificationCode || 'NTS'),
    notifyBeforeDueDays: beforeDue,
    beforeDueDays: beforeDue,
    escalationAfterDays: escalation,
    escalationDays: escalation,
    enableInAppNotification: s.enableInAppNotification ?? s.inAppEnabled ?? true,
    inAppEnabled: s.enableInAppNotification ?? s.inAppEnabled ?? true,
    enableEmailNotification: s.enableEmailNotification ?? s.emailEnabled ?? true,
    emailEnabled: s.enableEmailNotification ?? s.emailEnabled ?? true,
    enableSmsNotification: s.enableSmsNotification ?? s.smsEnabled ?? false,
    smsEnabled: s.enableSmsNotification ?? s.smsEnabled ?? false,
    templateBody: s.templateBody || s.template || '',
    template: s.templateBody || s.template || '',
    repeatReminder: s.repeatReminder ?? false,
    reminderFrequency: (s.reminderFrequency as NotificationSetting['reminderFrequency']) || 'None',
    priority: (s.priority as NotificationSetting['priority']) || 'Medium',
  };
}

export function isNotificationSettingActive(s: NotificationSetting): boolean {
  return s.status === 'Active' && !s.isDeleted;
}

export async function fetchNotificationSettings(): Promise<NotificationSetting[]> {
  try {
    const records = await getAdminRecords<NotificationSetting>(ADMIN_COLLECTIONS.notificationSettings);
    return records.filter((s) => !s.isDeleted).map(normalizeNotificationSetting);
  } catch {
    return [];
  }
}

export async function fetchNotificationSettingById(id: string): Promise<NotificationSetting | null> {
  const all = await fetchNotificationSettings();
  return all.find((s) => s.id === id) ?? null;
}

export async function fetchActiveNotificationRules(
  moduleName: string,
  eventTrigger: string,
): Promise<NotificationSetting | null> {
  const settings = await fetchNotificationSettings();
  return settings.find((s) =>
    isNotificationSettingActive(s) &&
    s.moduleName === moduleName &&
    s.eventTrigger === eventTrigger,
  ) ?? null;
}

export function getNotificationSettingsSummary(settings: NotificationSetting[]) {
  return {
    total: settings.length,
    active: settings.filter((s) => s.status === 'Active').length,
    inactive: settings.filter((s) => s.status === 'Inactive').length,
    critical: settings.filter((s) => s.priority === 'Critical').length,
    emailEnabled: settings.filter((s) => s.enableEmailNotification).length,
    inAppEnabled: settings.filter((s) => s.enableInAppNotification).length,
  };
}

export async function getNotificationDeliveryStats() {
  const notifications = await getAllNotifications(500);
  const stats = getNotificationStats(notifications);
  return {
    unreadNotifications: stats.unread,
    failedNotifications: stats.failed,
  };
}

function formToPayload(data: NotificationSettingFormData, meta: NotificationSettingAuditMeta, status = 'Active') {
  const notificationSettingId = buildNotificationSettingId(data.notificationCode);
  return {
    notificationSettingId,
    notificationCode: data.notificationCode,
    eventName: data.eventName,
    moduleName: data.moduleName,
    eventTrigger: data.eventTrigger,
    notificationType: data.notificationType,
    recipientRole: data.recipientRole,
    recipientUserOptional: data.recipientUserOptional,
    recipientDepartmentOptional: data.recipientDepartmentOptional,
    ccRoleOptional: data.ccRoleOptional,
    escalationRole: data.escalationRole,
    notifyBeforeDueDays: data.notifyBeforeDueDays,
    beforeDueDays: data.notifyBeforeDueDays,
    escalationAfterDays: data.escalationAfterDays,
    escalationDays: data.escalationAfterDays,
    repeatReminder: data.repeatReminder,
    reminderFrequency: data.reminderFrequency,
    templateSubject: data.templateSubject,
    templateBody: data.templateBody,
    template: data.templateBody,
    priority: data.priority,
    enableInAppNotification: data.enableInAppNotification,
    inAppEnabled: data.enableInAppNotification,
    enableEmailNotification: data.enableEmailNotification,
    emailEnabled: data.enableEmailNotification,
    enableSmsNotification: data.enableSmsNotification,
    smsEnabled: data.enableSmsNotification,
    remarks: data.remarks,
    status,
    updatedBy: meta.userId,
  };
}

export async function createNotificationSetting(
  data: NotificationSettingFormData,
  meta: NotificationSettingAuditMeta,
): Promise<{ setting: NotificationSetting | null; error: string | null }> {
  try {
    const unique = await checkUniqueField(ADMIN_COLLECTIONS.notificationSettings, 'notificationCode', data.notificationCode);
    if (!unique) return { setting: null, error: 'Notification code already exists' };

    const payload = { ...formToPayload(data, meta), createdBy: meta.userId };
    const created = await createAdminRecord(
      ADMIN_COLLECTIONS.notificationSettings,
      payload as Omit<NotificationSetting, 'id'>,
      { userId: meta.userId, userName: meta.userName, module: 'Notification Settings', action: 'CREATE_NOTIFICATION_RULE' },
    );

    await logNotificationSettingAudit('CREATE_NOTIFICATION_RULE', created.id || payload.notificationSettingId, meta, null, payload);
    return { setting: normalizeNotificationSetting(created as NotificationSetting), error: null };
  } catch (e) {
    return { setting: null, error: (e as Error).message };
  }
}

export async function updateNotificationSetting(
  id: string,
  data: NotificationSettingFormData,
  existing: NotificationSetting,
  meta: NotificationSettingAuditMeta,
): Promise<{ setting: NotificationSetting | null; error: string | null }> {
  try {
    if (data.notificationCode !== existing.notificationCode) {
      const unique = await checkUniqueField(ADMIN_COLLECTIONS.notificationSettings, 'notificationCode', data.notificationCode, id);
      if (!unique) return { setting: null, error: 'Notification code already exists' };
    }

    const updates = formToPayload(data, meta, existing.status);
    delete (updates as { createdBy?: string }).createdBy;

    const updated = await updateAdminRecord(ADMIN_COLLECTIONS.notificationSettings, id, updates, {
      userId: meta.userId,
      userName: meta.userName,
      module: 'Notification Settings',
      oldValue: JSON.stringify(existing),
    });

    await logNotificationSettingAudit('EDIT_NOTIFICATION_RULE', id, meta, existing, updates);
    return { setting: normalizeNotificationSetting(updated as NotificationSetting), error: null };
  } catch (e) {
    return { setting: null, error: (e as Error).message };
  }
}

export async function setNotificationSettingStatus(
  id: string,
  setting: NotificationSetting,
  status: 'Active' | 'Inactive',
  meta: NotificationSettingAuditMeta,
): Promise<{ success: boolean; error?: string }> {
  try {
    await updateAdminRecord(ADMIN_COLLECTIONS.notificationSettings, id, { status }, {
      userId: meta.userId,
      userName: meta.userName,
      module: 'Notification Settings',
      oldValue: JSON.stringify(setting),
    });
    const action = status === 'Active' ? 'ACTIVATE_NOTIFICATION_RULE' : 'DEACTIVATE_NOTIFICATION_RULE';
    await logNotificationSettingAudit(action, id, meta, setting.status, status);
    return { success: true };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

export function previewNotificationTemplate(
  setting: Partial<NotificationSetting>,
  vars?: Record<string, string>,
): { subject: string; body: string } {
  const sample: Record<string, string> = {
    documentNumber: 'DOC-2026-0001',
    moduleName: setting.moduleName || 'PQR',
    productName: 'Amoxicillin 500mg',
    batchNumber: 'BTH-2026-0042',
    assignedTo: 'QA Executive',
    dueDate: '2026-03-15',
    status: 'Pending Approval',
    createdBy: 'Admin User',
    siteName: 'HMF Plant',
    ...vars,
  };
  const subject = applyTemplateVariables(setting.templateSubject || '[{{moduleName}}] {{eventName}}', sample);
  const body = applyTemplateVariables(setting.templateBody || setting.template || '', sample);
  return { subject, body };
}

export async function sendTestNotification(
  setting: NotificationSetting,
  meta: NotificationSettingAuditMeta,
): Promise<{ success: boolean; error?: string }> {
  const { subject, body } = previewNotificationTemplate(setting);
  const input = {
    userId: meta.userId,
    moduleName: setting.moduleName,
    eventName: setting.eventName,
    recordId: setting.id || 'test',
    documentNumber: 'TEST-0001',
    title: subject || `Test: ${setting.eventName}`,
    message: body,
    type: 'info' as const,
    priority: setting.priority,
    recipientRole: setting.recipientRole,
    actionLink: '/notifications',
  };

  if (setting.enableInAppNotification) {
    await sendInAppNotification(input);
  }
  if (setting.enableEmailNotification) {
    await sendEmailNotificationPlaceholder({ ...input, subject: subject || input.title });
  }

  await logNotificationSettingAudit('SEND_TEST_NOTIFICATION', setting.id || setting.notificationSettingId, meta, null, { subject, body });
  await createAuditLog({
    moduleName: 'Admin',
    collectionName: ADMIN_COLLECTIONS.notificationSettings,
    recordId: setting.id || setting.notificationSettingId,
    actionType: 'Update',
    actionDescription: 'Test notification sent',
    user: { id: meta.userId, name: meta.userName },
    status: 'Success',
  });

  return { success: true };
}

export function exportNotificationSettingsCsv(settings: NotificationSetting[]): string {
  const headers = [
    'Code', 'Event', 'Module', 'Trigger', 'Type', 'Recipient Role', 'Priority',
    'In-App', 'Email', 'SMS', 'Before Due Days', 'Escalation Days', 'Status',
  ];
  const rows = settings.map((s) => [
    s.notificationCode, s.eventName, s.moduleName, s.eventTrigger, s.notificationType,
    s.recipientRole, s.priority,
    s.enableInAppNotification ? 'Yes' : 'No',
    s.enableEmailNotification ? 'Yes' : 'No',
    s.enableSmsNotification ? 'Yes' : 'No',
    String(s.notifyBeforeDueDays), String(s.escalationAfterDays), s.status,
  ].map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','));
  return [headers.join(','), ...rows].join('\n');
}

export async function logNotificationSettingsExport(meta: NotificationSettingAuditMeta, count: number): Promise<void> {
  await logNotificationSettingAudit('EXPORT_NOTIFICATION_SETTINGS', 'export', meta, null, { count });
  await createAuditLog({
    moduleName: 'Admin',
    collectionName: ADMIN_COLLECTIONS.notificationSettings,
    recordId: 'export',
    actionType: 'Export',
    actionDescription: `Exported ${count} notification settings`,
    user: { id: meta.userId, name: meta.userName },
    status: 'Success',
  });
}

const DEFAULT_RULES: Array<NotificationSettingFormData & { notificationCode: string }> = [
  {
    notificationCode: 'PQR-APPROVAL',
    eventName: 'PQR Approval Pending',
    moduleName: 'PQR',
    eventTrigger: 'Approval Pending',
    notificationType: 'In-App + Email',
    recipientRole: 'head_qa',
    recipientUserOptional: '',
    recipientDepartmentOptional: 'QA',
    ccRoleOptional: '',
    escalationRole: 'admin',
    notifyBeforeDueDays: 3,
    escalationAfterDays: 7,
    repeatReminder: true,
    reminderFrequency: 'Daily',
    templateSubject: '[{{moduleName}}] Approval pending — {{documentNumber}}',
    templateBody: 'Record {{documentNumber}} in {{moduleName}} requires your approval. Status: {{status}}. Due: {{dueDate}}.',
    priority: 'High',
    enableInAppNotification: true,
    enableEmailNotification: true,
    enableSmsNotification: false,
    remarks: 'Default PQR approval notification',
  },
  {
    notificationCode: 'OOS-DETECTED',
    eventName: 'OOS Detected',
    moduleName: 'OOS',
    eventTrigger: 'OOS Detected',
    notificationType: 'In-App + Email',
    recipientRole: 'head_qa',
    recipientUserOptional: '',
    recipientDepartmentOptional: 'QC',
    ccRoleOptional: 'qc_manager',
    escalationRole: 'head_qa',
    notifyBeforeDueDays: 0,
    escalationAfterDays: 1,
    repeatReminder: false,
    reminderFrequency: 'None',
    templateSubject: 'OOS Detected — {{documentNumber}}',
    templateBody: 'OOS {{documentNumber}} detected for batch {{batchNumber}}. Immediate review required.',
    priority: 'Critical',
    enableInAppNotification: true,
    enableEmailNotification: true,
    enableSmsNotification: false,
    remarks: '',
  },
  {
    notificationCode: 'CAPA-OVERDUE',
    eventName: 'CAPA Overdue',
    moduleName: 'CAPA',
    eventTrigger: 'CAPA Overdue',
    notificationType: 'In-App + Email',
    recipientRole: 'qa_manager',
    recipientUserOptional: '',
    recipientDepartmentOptional: 'QA',
    ccRoleOptional: 'head_qa',
    escalationRole: 'head_qa',
    notifyBeforeDueDays: 3,
    escalationAfterDays: 5,
    repeatReminder: true,
    reminderFrequency: 'Daily',
    templateSubject: 'CAPA Overdue — {{documentNumber}}',
    templateBody: 'CAPA {{documentNumber}} is overdue. Assigned to {{assignedTo}}.',
    priority: 'High',
    enableInAppNotification: true,
    enableEmailNotification: true,
    enableSmsNotification: false,
    remarks: '',
  },
];

export async function seedDefaultNotificationSettings(
  meta: NotificationSettingAuditMeta,
): Promise<{ created: number; skipped: number }> {
  let created = 0;
  let skipped = 0;
  for (const def of DEFAULT_RULES) {
    const exists = await checkUniqueField(ADMIN_COLLECTIONS.notificationSettings, 'notificationCode', def.notificationCode);
    if (!exists) {
      skipped += 1;
      continue;
    }
    const result = await createNotificationSetting(def, meta);
    if (result.setting) created += 1;
    else skipped += 1;
  }
  return { created, skipped };
}
