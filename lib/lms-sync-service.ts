import {
  addDoc, collection, doc, getDoc, getDocs, query, updateDoc, where,
} from 'firebase/firestore';
import { getFirebaseFirestore } from '@/lib/firebase';
import {
  LMS_COLLECTIONS, type LmsActor, type LmsSyncEntity, type ConflictRecord,
  calcNextSync,
} from './lms-types';
import {
  createSyncJob, updateSyncJob, getConnectionRaw, logIntegrationEvent,
  notifySyncFailure,
} from './lms-service';
import { createLmsAdapter, generateDemoData } from './lms-adapters/base-adapter';
import { generateTrainingRecordNumber, generateAssignmentNumber } from './training-service';

function now() { return new Date().toISOString(); }
function db() { return getFirebaseFirestore(); }

async function findDuplicate(
  collectionName: string,
  connectionId: string,
  externalId: string,
): Promise<string | null> {
  const snap = await getDocs(query(
    collection(db(), collectionName),
    where('connection_id', '==', connectionId),
    where('external_id', '==', externalId),
  ));
  return snap.empty ? null : snap.docs[0].id;
}

async function findEmployeeMatch(email: string, employeeId: string): Promise<{ id: string; name: string; department: string } | null> {
  if (email) {
    const byEmail = await getDocs(query(collection(db(), LMS_COLLECTIONS.profiles), where('email', '==', email)));
    if (!byEmail.empty) {
      const d = byEmail.docs[0].data();
      return { id: byEmail.docs[0].id, name: String(d.full_name ?? d.displayName ?? ''), department: String(d.department ?? '') };
    }
  }
  if (employeeId) {
    const byEmp = await getDocs(query(collection(db(), LMS_COLLECTIONS.eqmsUsers), where('employee_id', '==', employeeId)));
    if (!byEmp.empty) {
      const d = byEmp.docs[0].data();
      return { id: byEmp.docs[0].id, name: String(d.full_name ?? d.name ?? ''), department: String(d.department ?? '') };
    }
  }
  return null;
}

export async function runLmsSync(
  connectionId: string,
  actor: LmsActor,
  mode = 'Manual',
  useDemoFallback = true,
): Promise<{ jobDocId: string; status: string }> {
  const conn = await getConnectionRaw(connectionId);
  if (!conn) throw new Error('Connection not found');

  const jobDocId = await createSyncJob(connectionId, conn.connection_name, conn.sync_entities, actor, mode);
  const startTime = Date.now();

  await updateSyncJob(jobDocId, { status: 'Running' });

  let processed = 0;
  let imported = 0;
  let updated = 0;
  let skipped = 0;
  let failed = 0;
  const errors: string[] = [];

  try {
    const adapter = createLmsAdapter(conn);
    const entities = conn.sync_entities as LmsSyncEntity[];

    for (const entity of entities) {
      await logIntegrationEvent(connectionId, 'info', 'sync_entity_start', `Syncing ${entity}`, { syncJobId: jobDocId, entityType: entity });

      let result: { imported: number; updated: number; skipped: number; failed: number; processed: number };

      switch (entity) {
        case 'Users':
          result = await syncUsers(connectionId, adapter, useDemoFallback);
          break;
        case 'Training Courses':
          result = await syncCourses(connectionId, adapter, useDemoFallback);
          break;
        case 'Training Completion':
          result = await syncCompletions(connectionId, adapter, actor, useDemoFallback);
          break;
        case 'Certificates':
          result = await syncCertificates(connectionId, adapter, useDemoFallback);
          break;
        case 'Training Assignments':
          result = await syncAssignments(connectionId, adapter, actor, useDemoFallback);
          break;
        default:
          result = { imported: 0, updated: 0, skipped: 0, failed: 0, processed: 0 };
          await logIntegrationEvent(connectionId, 'warn', 'sync_skipped', `Entity ${entity} not yet implemented`, { syncJobId: jobDocId });
          break;
      }

      processed += result.processed;
      imported += result.imported;
      updated += result.updated;
      skipped += result.skipped;
      failed += result.failed;
    }

    const duration = Date.now() - startTime;
    const status = failed > 0 && imported === 0 ? 'Failed' : failed > 0 ? 'Partial Success' : 'Completed';

    await updateSyncJob(jobDocId, {
      status,
      completed_at: now(),
      duration_ms: duration,
      records_processed: processed,
      records_imported: imported,
      records_updated: updated,
      records_skipped: skipped,
      records_failed: failed,
      error_message: errors.length ? errors.join('; ') : null,
    });

    await updateDoc(doc(db(), LMS_COLLECTIONS.connections, connectionId), {
      last_sync: now(),
      next_sync: calcNextSync(conn.sync_frequency),
      status: status === 'Failed' ? 'Error' : 'Active',
      updated_at: now(),
    });

    await logIntegrationEvent(connectionId, status === 'Failed' ? 'error' : 'info', 'sync_completed', `Sync ${status}: ${imported} imported, ${skipped} skipped`, { syncJobId: jobDocId });

    if (status === 'Failed') await notifySyncFailure(jobDocId, conn.connection_name, `${failed} records failed`);

    return { jobDocId, status };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Sync failed';
    await updateSyncJob(jobDocId, {
      status: 'Failed',
      completed_at: now(),
      duration_ms: Date.now() - startTime,
      error_message: msg,
    });
    await notifySyncFailure(jobDocId, conn.connection_name, msg);
    await logIntegrationEvent(connectionId, 'error', 'sync_failed', msg, { syncJobId: jobDocId });
    throw e;
  }
}

async function syncUsers(connectionId: string, adapter: ReturnType<typeof createLmsAdapter>, useDemo: boolean) {
  let users = (await adapter.fetchUsers()).data;
  if (!users.length && useDemo) users = generateDemoData(connectionId).users;

  let imported = 0, updated = 0, skipped = 0, failed = 0;
  for (const u of users) {
    try {
      const existingId = await findDuplicate(LMS_COLLECTIONS.users, connectionId, u.external_id);
      const payload = { ...u, connection_id: connectionId, imported_at: now(), last_synced: now() };
      if (existingId) {
        await updateDoc(doc(db(), LMS_COLLECTIONS.users, existingId), payload);
        updated++;
      } else {
        await addDoc(collection(db(), LMS_COLLECTIONS.users), payload);
        imported++;
      }
    } catch { failed++; }
  }
  return { processed: users.length, imported, updated, skipped, failed };
}

async function syncCourses(connectionId: string, adapter: ReturnType<typeof createLmsAdapter>, useDemo: boolean) {
  let courses = (await adapter.fetchCourses()).data;
  if (!courses.length && useDemo) courses = generateDemoData(connectionId).courses;

  let imported = 0, updated = 0, skipped = 0, failed = 0;
  for (const c of courses) {
    try {
      const existingId = await findDuplicate(LMS_COLLECTIONS.courses, connectionId, c.external_id);
      const payload = { ...c, connection_id: connectionId, imported_at: now(), last_synced: now() };
      if (existingId) {
        await updateDoc(doc(db(), LMS_COLLECTIONS.courses, existingId), payload);
        updated++;
      } else {
        await addDoc(collection(db(), LMS_COLLECTIONS.courses), payload);
        imported++;
      }
    } catch { failed++; }
  }
  return { processed: courses.length, imported, updated, skipped, failed };
}

async function syncCompletions(connectionId: string, adapter: ReturnType<typeof createLmsAdapter>, actor: LmsActor, useDemo: boolean) {
  let completions = (await adapter.fetchCompletions()).data;
  if (!completions.length && useDemo) completions = generateDemoData(connectionId).completions;

  let imported = 0, updated = 0, skipped = 0, failed = 0;
  for (const c of completions) {
    try {
      const existingId = await findDuplicate(LMS_COLLECTIONS.trainingRecords, connectionId, c.external_id);
      if (existingId) { skipped++; continue; }

      const employee = await findEmployeeMatch(c.employee_email, c.employee_id);
      const lmsRecord = {
        ...c,
        connection_id: connectionId,
        certificate_id: null,
        imported_at: now(),
        eqms_record_id: null as string | null,
      };
      const lmsRef = await addDoc(collection(db(), LMS_COLLECTIONS.trainingRecords), lmsRecord);

      if (employee && c.status === 'Completed') {
        const recordNumber = await generateTrainingRecordNumber();
        const eqmsRef = await addDoc(collection(db(), LMS_COLLECTIONS.eqmsRecords), {
          training_record_id: recordNumber,
          employee_id: employee.id,
          employee_name: employee.name,
          department: employee.department,
          training_title: c.course_title,
          training_type: 'GMP Training',
          completion_date: c.completion_date,
          training_mode: 'Online',
          trainer_name: 'LMS Integration',
          assessment_score: c.score,
          result: c.score != null && c.score >= 70 ? 'Pass' : 'Not Applicable',
          completion_status: 'Completed',
          source: 'LMS Integration',
          lms_connection_id: connectionId,
          lms_external_id: c.external_id,
          created_by: actor.id,
          created_by_name: actor.name,
          created_at: now(),
          updated_at: now(),
        });
        await updateDoc(lmsRef, { eqms_record_id: eqmsRef.id });
        await logIntegrationEvent(connectionId, 'info', 'record imported', `Training completion imported for ${employee.name}`, { entityType: 'Training Completion', entityId: eqmsRef.id });
      }

      imported++;
    } catch { failed++; }
  }
  return { processed: completions.length, imported, updated, skipped, failed };
}

async function syncCertificates(connectionId: string, adapter: ReturnType<typeof createLmsAdapter>, useDemo: boolean) {
  let certs = (await adapter.fetchCertificates()).data;
  if (!certs.length && useDemo) certs = generateDemoData(connectionId).certificates;

  let imported = 0, updated = 0, skipped = 0, failed = 0;
  for (const c of certs) {
    try {
      const existingId = await findDuplicate(LMS_COLLECTIONS.certificates, connectionId, c.external_id);
      const payload = { ...c, connection_id: connectionId, imported_at: now() };
      if (existingId) {
        await updateDoc(doc(db(), LMS_COLLECTIONS.certificates, existingId), payload);
        updated++;
      } else {
        await addDoc(collection(db(), LMS_COLLECTIONS.certificates), payload);
        imported++;
      }
    } catch { failed++; }
  }
  return { processed: certs.length, imported, updated, skipped, failed };
}

async function syncAssignments(connectionId: string, adapter: ReturnType<typeof createLmsAdapter>, actor: LmsActor, useDemo: boolean) {
  let assignments = (await adapter.fetchAssignments()).data;
  if (!assignments.length && useDemo) assignments = generateDemoData(connectionId).assignments;

  let imported = 0, updated = 0, skipped = 0, failed = 0;
  for (const a of assignments) {
    try {
      const dupQuery = await getDocs(query(
        collection(db(), LMS_COLLECTIONS.eqmsAssignments),
        where('lms_external_id', '==', a.external_id),
        where('lms_connection_id', '==', connectionId),
      ));
      if (!dupQuery.empty) { skipped++; continue; }

      const employee = await findEmployeeMatch(a.employee_email, a.employee_id);
      if (!employee) { skipped++; continue; }

      const assignmentNumber = await generateAssignmentNumber();
      await addDoc(collection(db(), LMS_COLLECTIONS.eqmsAssignments), {
        training_number: assignmentNumber,
        training_master_id: '',
        training_title: a.course_title,
        training_type: 'GMP Training',
        employee_id: employee.id,
        employee_name: employee.name,
        department: employee.department,
        designation: '',
        assigned_date: a.assigned_date,
        due_date: a.due_date,
        completion_date: null,
        status: a.status === 'Completed' ? 'completed' : 'pending',
        training_status: a.status,
        training_mode: 'Online',
        source: 'LMS Integration',
        lms_connection_id: connectionId,
        lms_external_id: a.external_id,
        created_by: actor.id,
        created_by_name: actor.name,
        created_at: now(),
        updated_at: now(),
      });
      imported++;
    } catch { failed++; }
  }
  return { processed: assignments.length, imported, updated, skipped, failed };
}

export async function retryFailedSync(jobDocId: string, actor: LmsActor): Promise<{ jobDocId: string; status: string }> {
  const snap = await getDoc(doc(db(), LMS_COLLECTIONS.syncJobs, jobDocId));
  if (!snap.exists()) throw new Error('Sync job not found');
  const job = snap.data();
  await updateSyncJob(jobDocId, { retry_count: (job.retry_count ?? 0) + 1 });
  return runLmsSync(String(job.connection_id), actor, 'Manual');
}

export async function detectConflicts(connectionId: string): Promise<ConflictRecord[]> {
  const conflicts: ConflictRecord[] = [];
  const lmsRecords = await getDocs(query(
    collection(db(), LMS_COLLECTIONS.trainingRecords),
    where('connection_id', '==', connectionId),
  ));

  for (const docSnap of lmsRecords.docs) {
    const data = docSnap.data();
    if (!data.eqms_record_id) continue;
    const eqmsSnap = await getDocs(query(
      collection(db(), LMS_COLLECTIONS.eqmsRecords),
      where('lms_external_id', '==', data.external_id),
    ));
    if (!eqmsSnap.empty) {
      const eqms = eqmsSnap.docs[0].data();
      if (eqms.completion_date !== data.completion_date) {
        conflicts.push({
          id: docSnap.id,
          entityType: 'Training Completion',
          externalId: String(data.external_id),
          matchKey: String(data.employee_email || data.employee_id),
          existingData: eqms as Record<string, unknown>,
          incomingData: data as Record<string, unknown>,
        });
      }
    }
  }
  return conflicts;
}

export async function resolveConflict(
  conflict: ConflictRecord,
  resolution: 'keep_existing' | 'use_incoming',
  actor: LmsActor,
): Promise<void> {
  if (resolution === 'use_incoming') {
    const eqmsQuery = await getDocs(query(
      collection(db(), LMS_COLLECTIONS.eqmsRecords),
      where('lms_external_id', '==', conflict.externalId),
    ));
    if (!eqmsQuery.empty) {
      await updateDoc(eqmsQuery.docs[0].ref, {
        completion_date: conflict.incomingData.completion_date,
        updated_at: now(),
        updated_by: actor.id,
      });
      await logIntegrationEvent(
        String(conflict.incomingData.connection_id ?? ''),
        'info',
        'record updated',
        `Conflict resolved: used incoming data for ${conflict.externalId}`,
        { entityType: conflict.entityType, entityId: conflict.externalId },
      );
    }
  } else {
    await logIntegrationEvent(
      String(conflict.incomingData.connection_id ?? ''),
      'info',
      'record skipped',
      `Conflict resolved: kept existing data for ${conflict.externalId}`,
      { entityType: conflict.entityType, entityId: conflict.externalId },
    );
  }
}

export async function handleWebhookSync(connectionId: string, payload: Record<string, unknown>, actor: LmsActor): Promise<void> {
  await logIntegrationEvent(connectionId, 'info', 'webhook_received', 'Webhook payload received', { details: payload });
  await runLmsSync(connectionId, actor, 'Real-time Webhook', false);
}
