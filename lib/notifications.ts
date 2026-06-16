/**
 * @deprecated Import from @/lib/notification-service instead.
 */
export {
  NOTIFICATIONS_COLLECTION,
  createNotification,
  sendInAppNotification,
  sendEmailNotificationPlaceholder,
  markNotificationAsRead,
  markNotificationRead,
  markAllNotificationsRead,
  getUserNotifications,
  getNotificationById,
  subscribeToNotifications,
  notifyApprovalPending,
  applyTemplateVariables,
  type NotificationRecord,
  type NotificationType,
  type CreateNotificationInput,
  type TemplateVariables,
} from './notification-service';

/** @deprecated use NotificationRecord */
export type AppNotification = import('./notification-service').NotificationRecord;
