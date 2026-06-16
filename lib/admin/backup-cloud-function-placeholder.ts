/**
 * Cloud Function placeholder for server-side backup/restore operations.
 *
 * Client-side Firestore exports are limited by security rules and browser memory.
 * For production GMP disaster recovery, deploy Firebase Cloud Functions:
 *
 * 1. `scheduledBackup` — Pub/Sub scheduler (daily/weekly) reading `backup_settings`
 * 2. `onBackupRequest` — Firestore trigger on `backup_history` status = Pending
 * 3. `onRestoreApproved` — Firestore trigger on `restore_history` status = Approved
 *
 * Recommended path: `functions/src/backup/`
 *   - exportFirestoreCollections(projectId, collections[]) → GCS bucket
 *   - importFirestoreCollections(gcsPath, collections[], options) → Firestore Admin SDK
 *   - verifyBackupChecksum(gcsPath, expectedHash)
 *
 * The frontend calls `requestServerBackup()` / `requestServerRestore()` below,
 * which currently log a TODO and return a safe message without breaking the UI.
 */

export interface ServerBackupRequest {
  backupId: string;
  collections: string[];
  scope: string;
  requestedBy: string;
}

export interface ServerRestoreRequest {
  restoreId: string;
  backupId: string;
  storagePath: string;
  collections: string[];
  requestedBy: string;
}

export async function requestServerBackup(req: ServerBackupRequest): Promise<{
  success: boolean;
  message: string;
}> {
  console.warn(
    '[Backup] TODO: Implement Cloud Function scheduledBackup/onBackupRequest.',
    'Deploy Firebase Functions to run server-side Firestore export to GCS.',
    req,
  );
  return {
    success: false,
    message:
      'Server-side automated backup requires Firebase Cloud Functions. ' +
      'Use manual client export or deploy functions/src/backup/scheduledBackup.',
  };
}

export async function requestServerRestore(req: ServerRestoreRequest): Promise<{
  success: boolean;
  message: string;
}> {
  console.warn(
    '[Backup] TODO: Implement Cloud Function onRestoreApproved.',
    'Full restore requires Firebase Admin SDK — not available in browser.',
    req,
  );
  return {
    success: false,
    message:
      'Server-side restore requires Firebase Cloud Functions with Admin SDK. ' +
      'Client-side restore only supports non-audit collections with write permissions.',
  };
}
