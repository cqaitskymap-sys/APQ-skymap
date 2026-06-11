export {
  createDocument,
  getDocument,
  getDocuments,
  updateDocument,
  deleteDocument,
  queryDocuments,
  documentExists,
  createRecord,
  getRecord,
  getRecords,
  updateRecord,
  deleteRecord,
  recordExists,
  getRecordsPaginated,
  timestampNow,
} from '@/lib/firestore';

export { uploadFile, deleteFile, isAllowedFileType, type FileMetadata } from '@/lib/storage';

export { writeAuditTrail, auditCreate, auditUpdate, auditDelete } from '@/lib/audit-trail';

export {
  createNotification,
  getUserNotifications,
  subscribeToNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from '@/lib/notifications';

export {
  signIn,
  signOut,
  signUp,
  getUserProfile,
  updateUserProfile,
  subscribeToAuthState,
  formatAuthError,
  isAuthNetworkError,
} from '@/lib/auth';

export {
  listCpvRecords,
  createCpp,
  createCqa,
  createYield,
  loadIntegrationSnapshot,
} from '@/lib/cpv-service';

export {
  getAdminRecords,
  createAdminRecord,
  updateAdminRecord,
  deleteAdminRecord,
} from '@/lib/admin/admin-service';
