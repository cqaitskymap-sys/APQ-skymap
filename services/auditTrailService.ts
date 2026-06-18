/**
 * Audit trail service — immutable compliance logging.
 */
export {
  writeAuditTrail,
  createAuditLog,
  auditCreate,
  auditUpdate,
  auditDelete,
  AUDIT_TRAIL_COLLECTION,
  type AuditTrailEntry,
  type AuditActor,
  type AuditAction,
  type CreateAuditLogInput,
} from '@/lib/audit-trail';

import { createAuditLog, type AuditActor } from '@/lib/audit-trail';

export type SecurityAuditAction =
  | 'USER_CREATED'
  | 'USER_UPDATED'
  | 'ROLE_ASSIGNED'
  | 'PERMISSION_CHANGED'
  | 'USER_ACTIVATED'
  | 'USER_DEACTIVATED'
  | 'LOGIN'
  | 'LOGOUT'
  | 'ACCESS_DENIED'
  | 'RECORD_CREATE'
  | 'RECORD_UPDATE'
  | 'RECORD_DELETE'
  | 'RECORD_APPROVE'
  | 'RECORD_EXPORT';

export async function logSecurityEvent(params: {
  moduleName: string;
  actionType: SecurityAuditAction | string;
  recordId: string;
  collectionName?: string;
  oldValue?: unknown;
  newValue?: unknown;
  user: AuditActor;
  status?: 'Success' | 'Failed';
  reason?: string;
}) {
  return createAuditLog({
    moduleName: params.moduleName,
    collectionName: params.collectionName || 'audit_trail',
    recordId: params.recordId,
    actionType: params.actionType,
    oldValue: params.oldValue,
    newValue: params.newValue,
    user: params.user,
    status: params.status || 'Success',
    reason: params.reason,
  });
}
