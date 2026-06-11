import {
  collection, doc, addDoc, updateDoc, query, where, orderBy, limit,
  onSnapshot, getDocs, type Unsubscribe, type DocumentSnapshot,
} from 'firebase/firestore';
import { getFirebaseFirestore, isFirebaseConfigured } from './firebase';

export const NOTIFICATIONS_COLLECTION = 'notifications';

export type NotificationType = 'info' | 'warning' | 'error' | 'success' | 'due_date' | 'approval';

export interface AppNotification {
  id?: string;
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  moduleName: string;
  recordId: string;
  isRead: boolean;
  createdAt: string;
}

function nowIso() {
  return new Date().toISOString();
}

export async function createNotification(
  notification: Omit<AppNotification, 'id' | 'isRead' | 'createdAt'>,
): Promise<AppNotification | null> {
  if (!isFirebaseConfigured()) return null;
  try {
    const db = getFirebaseFirestore();
    const payload = {
      ...notification,
      isRead: false,
      createdAt: nowIso(),
    };
    const docRef = await addDoc(collection(db, NOTIFICATIONS_COLLECTION), payload);
    return { id: docRef.id, ...payload };
  } catch (error) {
    console.error('Failed to create notification:', error);
    return null;
  }
}

export async function markNotificationRead(notificationId: string): Promise<boolean> {
  if (!isFirebaseConfigured()) return false;
  try {
    const db = getFirebaseFirestore();
    await updateDoc(doc(db, NOTIFICATIONS_COLLECTION, notificationId), { isRead: true });
    return true;
  } catch (error) {
    console.error('Failed to mark notification read:', error);
    return false;
  }
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
      snap.docs.map((d) => updateDoc(d.ref, { isRead: true })),
    );
    return true;
  } catch (error) {
    console.error('Failed to mark all notifications read:', error);
    return false;
  }
}

export async function getUserNotifications(
  userId: string,
  max = 50,
): Promise<AppNotification[]> {
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
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as AppNotification));
  } catch (error) {
    console.error('Failed to fetch notifications:', error);
    return [];
  }
}

/** Real-time listener for dashboard / notification bell */
export function subscribeToNotifications(
  userId: string,
  onData: (notifications: AppNotification[]) => void,
  onError?: (error: Error) => void,
  max = 25,
): Unsubscribe {
  if (!isFirebaseConfigured()) {
    onData([]);
    return () => undefined;
  }
  try {
    const db = getFirebaseFirestore();
    const q = query(
      collection(db, NOTIFICATIONS_COLLECTION),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(max),
    );
    return onSnapshot(
      q,
      (snap) => {
        onData(snap.docs.map((d) => ({ id: d.id, ...d.data() } as AppNotification)));
      },
      (error) => {
        console.error('Notification listener error:', error);
        onError?.(error);
        onData([]);
      },
    );
  } catch (error) {
    console.error('Failed to subscribe to notifications:', error);
    onData([]);
    return () => undefined;
  }
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
    recordId,
  });
}
