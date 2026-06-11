/**
 * @deprecated Import from @/lib/firestore instead.
 * Kept for backward compatibility with existing module services.
 */
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
  type BaseRecord,
  type DocumentActor,
  type DocumentAuditContext,
  type PaginatedResult,
} from './firestore';

export { writeAuditTrail, auditCreate, auditUpdate, auditDelete, type AuditActor } from './audit-trail';

/** @deprecated Use DocumentActor from @/lib/firestore */
export type FirestoreActor = import('./audit-trail').AuditActor;
