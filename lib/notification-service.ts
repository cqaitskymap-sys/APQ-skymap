import {
  collection, doc, addDoc, updateDoc, query, where, orderBy, limit,
  onSnapshot, getDocs, type Unsubscribe,
} from 'firebase/firestore';
import { createAuditLog } from '@/lib/audit-trail';
import { getFirebaseFirestore, isFirebaseConfigured } from '@/lib/firebase';
import { ADMIN_COLLECTIONS } from '@/lib/admin/constants';

export const NOTIFICATIONS_COLLECTION = 'notifications';

export type NotificationType = 'info' | 'warning' | 'error' | 'success' | 'due_date' | 'approval';

export interface NotificationRecord {
  id?: string;
  notificationId?: string;
  userId: string;
  recipientUserId?: string;
  title: string;
  message: string;
  type: NotificationType;
  moduleName: string;
  eventName?: string;
  recordId: string;
  documentNumber?: string;
  recipientRole?: string;
  recipientDepartment?: string;
  priority?: string;
  notificationChannel?: string;
  readStatus?: 'Unread' | 'Read';
  sentStatus?: 'Pending' | 'Sent' | 'Failed';
  isRead: boolean;
  actionLink?: string;
  createdAt: string;
  readAt?: string | null;
}

export interface CreateNotificationInput {
  userId: string;
  moduleName: string;
  eventName: string;
  recordId: string;
  documentNumber?: string;
  title: string;
  message: string;
  type?: NotificationType;
  recipientRole?: string;
  recipientDepartment?: string;
  priority?: string;
  notificationChannel?: string;
  actionLink?: string;
  settingId?: string;
}

export interface TemplateVariables {
  documentNumber?: string;
  moduleName?: string;
  productName?: string;
  batchNumber?: string;
  assignedTo?: string;
  dueDate?: string;
  status?: string;
  createdBy?: string;
  siteName?: string;
}

function nowIso() {
  return new Date().toISOString();
}

function buildNotificationId() {
  return `NTF-${Date.now().toString(36).toUpperCase()}`;
}

export function applyTemplateVariables(template: string, vars: TemplateVariables): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const val = vars[key as keyof TemplateVariables];
    return val !== undefined && val !== null ? String(val) : '';
  });
}

export async function createNotification(
  input: CreateNotificationInput,
): Promise<NotificationRecord | null> {
  if (!isFirebaseConfigured()) return null;
  try {
    const db = getFirebaseFirestore();
    const notificationId = buildNotificationId();
    const payload: NotificationRecord = {
      notificationId,
      userId: input.userId,
      recipientUserId: input.userId,
      title: input.title,
      message: input.message,
      type: input.type || 'info',
      moduleName: input.moduleName,
      eventName: input.eventName,
      recordId: input.recordId,
      documentNumber: input.documentNumber || '',
      recipientRole: input.recipientRole || '',
      recipientDepartment: input.recipientDepartment || '',
      priority: input.priority || 'Medium',
      notificationChannel: input.notificationChannel || 'In-App',
      readStatus: 'Unread',
      sentStatus: 'Sent',
      isRead: false,
      actionLink: input.actionLink || '',
      createdAt: nowIso(),
      readAt: null,
    };
    const docRef = await addDoc(collection(db, NOTIFICATIONS_COLLECTION), payload);

    await createAuditLog({
      moduleName: input.moduleName,
      collectionName: NOTIFICATIONS_COLLECTION,
      recordId: input.recordId,
      documentNumber: input.documentNumber,
      actionType: 'Update',
      actionDescription: 'Notification sent',
      user: { id: input.userId, name: input.userId },
      status: 'Success',
      newValue: { title: input.title, channel: input.notificationChannel },
    });

    return { id: docRef.id, ...payload };
  } catch (error) {
    console.error('Failed to create notification:', error);
    return null;
  }
}

export async function sendInAppNotification(
  input: CreateNotificationInput,
): Promise<NotificationRecord | null> {
  return createNotification({ ...input, notificationChannel: 'In-App' });
}

export async function sendEmailNotificationPlaceholder(
  input: CreateNotificationInput & { subject: string },
): Promise<{ success: boolean; message: string }> {
  console.info('[Email placeholder]', input.subject, input.message);
  const record = await createNotification({
    ...input,
    notificationChannel: 'Email',
    title: input.subject,
  });
  if (!record) {
    await createAuditLog({
      moduleName: input.moduleName,
      collectionName: NOTIFICATIONS_COLLECTION,
      recordId: input.recordId,
      actionType: 'Update',
      actionDescription: 'Email notification failed (placeholder)',
      user: { id: input.userId, name: input.userId },
      status: 'Failed',
    });
    return { success: false, message: 'Failed to queue email notification' };
  }
  return { success: true, message: 'Email notification queued (placeholder — integrate SMTP/API later)' };
}

export async function markNotificationAsRead(notificationId: string): Promise<boolean> {
  if (!isFirebaseConfigured()) return false;
  try {
    const db = getFirebaseFirestore();
    await updateDoc(doc(db, NOTIFICATIONS_COLLECTION, notificationId), {
      isRead: true,
      readStatus: 'Read',
      readAt: nowIso(),
    });
    await createAuditLog({
      moduleName: 'Admin',
      collectionName: NOTIFICATIONS_COLLECTION,
      recordId: notificationId,
      actionType: 'Update',
      actionDescription: 'Notification read',
      user: { id: 'system', name: 'User' },
      status: 'Success',
    });
    return true;
  } catch (error) {
    console.error('Failed to mark notification read:', error);
    return false;
  }
}

/** @deprecated use markNotificationAsRead */
export async function markNotificationRead(notificationId: string): Promise<boolean> {
  return markNotificationAsRead(notificationId);
}

export async function markAllNotificationsRead(userId: string): Promise<boolean> {
  if (!isFirebaseConfigured()) return false;
  try {
    const db = getFirebaseFirestore();
    const q = query(
      collection(db, NOTIFICATIONS_COLLECTION),
      where('userId', '==', userId),
      where('isRead', '==', false),
    );
    const snap = await getDocs(q);
    await Promise.all(
      snap.docs.map((d) => updateDoc(d.ref, { isRead: true, readStatus: 'Read', readAt: nowIso() })),
    );
    return true;
  } catch (error) {
    console.error('Failed to mark all notifications read:', error);
    return false;
  }
}

export async function getUserNotifications(userId: string, max = 50): Promise<NotificationRecord[]> {
  if (!isFirebaseConfigured()) return [];
  try {
    const db = getFirebaseFirestore();
    const q = query(
      collection(db, NOTIFICATIONS_COLLECTION),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(max),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => normalizeNotification({ id: d.id, ...d.data() }));
  } catch (error) {
    console.error('Failed to fetch notifications:', error);
    return [];
  }
}

export async function getNotificationById(id: string): Promise<NotificationRecord | null> {
  const all = await getAllNotifications(500);
  return all.find((n) => n.id === id) ?? null;
}

export async function getAllNotifications(max = 500): Promise<NotificationRecord[]> {
  if (!isFirebaseConfigured()) return [];
  try {
    const db = getFirebaseFirestore();
    const q = query(collection(db, NOTIFICATIONS_COLLECTION), orderBy('createdAt', 'desc'), limit(max));
    const snap = await getDocs(q);
    return snap.docs.map((d) => normalizeNotification({ id: d.id, ...d.data() }));
  } catch {
    return [];
  }
}

export function normalizeNotification(raw: Record<string, unknown>): NotificationRecord {
  const isRead = Boolean(raw.isRead);
  return {
    id: raw.id as string | undefined,
    notificationId: String(raw.notificationId || raw.id || ''),
    userId: String(raw.userId || raw.recipientUserId || ''),
    recipientUserId: String(raw.recipientUserId || raw.userId || ''),
    title: String(raw.title || ''),
    message: String(raw.message || ''),
    type: (raw.type as NotificationType) || 'info',
    moduleName: String(raw.moduleName || ''),
    eventName: String(raw.eventName || ''),
    recordId: String(raw.recordId || ''),
    documentNumber: String(raw.documentNumber || ''),
    recipientRole: String(raw.recipientRole || ''),
    recipientDepartment: String(raw.recipientDepartment || ''),
    priority: String(raw.priority || 'Medium'),
    notificationChannel: String(raw.notificationChannel || 'In-App'),
    readStatus: (raw.readStatus as NotificationRecord['readStatus']) || (isRead ? 'Read' : 'Unread'),
    sentStatus: (raw.sentStatus as NotificationRecord['sentStatus']) || 'Sent',
    isRead,
    actionLink: String(raw.actionLink || ''),
    createdAt: String(raw.createdAt || ''),
    readAt: raw.readAt ? String(raw.readAt) : null,
  };
}

export function subscribeToNotifications(
  userId: string,
  onData: (notifications: NotificationRecord[]) => void,
  onError?: (error: Error) => void,
  max = 25,
): Unsubscribe {
  if (!isFirebaseConfigured()) {
    onData([]);
    return () => undefined;
  }

  let active = true;
  let unsubscribe: Unsubscribe | undefined;
  let pollTimer: ReturnType<typeof setInterval> | undefined;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let retryAttempt = 0;

  const notificationQuery = () => {
    const db = getFirebaseFirestore();
    return query(
      collection(db, NOTIFICATIONS_COLLECTION),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(max),
    );
  };

  const fetchOnce = async () => {
    try {
      const snap = await getDocs(notificationQuery());
      if (!active) return;
      onData(snap.docs.map((d) => normalizeNotification({ id: d.id, ...d.data() })));
    } catch (error) {
      console.error('Notification poll error:', error);
      onError?.(error as Error);
    }
  };

  const startPolling = () => {
    if (pollTimer) return;
    void fetchOnce();
    pollTimer = setInterval(() => {
      void fetchOnce();
    }, 30_000);
  };

  const stopPolling = () => {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = undefined;
    }
  };

  const attachListener = () => {
    if (!active) return;
    try {
      unsubscribe?.();
      unsubscribe = onSnapshot(
        notificationQuery(),
        (snap) => {
          retryAttempt = 0;
          stopPolling();
          onData(snap.docs.map((d) => normalizeNotification({ id: d.id, ...d.data() })));
        },
        (error) => {
          console.warn('Notification listener error (will retry):', error);
          onError?.(error);
          unsubscribe?.();
          unsubscribe = undefined;

          // Fall back to polling while the realtime channel recovers.
          startPolling();

          if (!active) return;
          const delay = Math.min(30_000, 2_000 * 2 ** retryAttempt);
          retryAttempt += 1;
          retryTimer = setTimeout(() => {
            if (active) attachListener();
          }, delay);
        },
      );
    } catch (error) {
      console.error('Failed to subscribe to notifications:', error);
      onError?.(error as Error);
      startPolling();
    }
  };

  attachListener();

  return () => {
    active = false;
    unsubscribe?.();
    stopPolling();
    if (retryTimer) clearTimeout(retryTimer);
  };
}

export async function notifyApprovalPending(
  userId: string,
  moduleName: string,
  recordId: string,
  title: string,
  message: string,
) {
  return createNotification({
    userId,
    title,
    message,
    type: 'approval',
    moduleName,
    eventName: 'Approval Pending',
    recordId,
  });
}

export function getNotificationStats(notifications: NotificationRecord[]) {
  return {
    unread: notifications.filter((n) => !n.isRead || n.readStatus === 'Unread').length,
    failed: notifications.filter((n) => n.sentStatus === 'Failed').length,
    critical: notifications.filter((n) => n.priority === 'Critical').length,
  };
}
