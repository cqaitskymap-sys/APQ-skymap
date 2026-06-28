import {
  addDoc, collection, doc, getDoc, getDocs, limit, orderBy, query, updateDoc, where,
} from 'firebase/firestore';
import { getFirebaseFirestore } from '@/lib/firebase';
import { logAuditEvent } from '@/lib/admin/admin-service';
import { downloadCsv } from '@/lib/export-utils';
import { getDocumentById } from '@/lib/dms-service';
import type { PrintRequestRecord, PrintCopyRecord, PrintControlFilters, PrintControlActor } from './print-control-types';
import {
  mapPrintRequestRaw, mapPrintCopyRaw, computePrintKpis, computePrintCharts,
  filterPrintRequests, filterPrintCopies,
} from './print-control-records';
import type {
  CreatePrintRequestInput, ApprovePrintInput, IssueCopyInput, ReturnCopyInput,
  ReconcileCopyInput, DestroyCopyInput, BulkApproveInput,
} from './print-control-schemas';
import {
  PCM_COLLECTIONS, PCM_MODULE, DEFAULT_WATERMARK, RETURN_DUE_DAYS, isControlledPrintType,
} from './print-control-types';

function now() { return new Date().toISOString(); }

async function audit(actor: PrintControlActor, action: string, recordId: string, oldValue: unknown, newValue: unknown, reason = '') {
  await logAuditEvent({
    userId: actor.id, userName: actor.name, module: PCM_MODULE, recordId, action,
    oldValue: oldValue ? JSON.stringify(oldValue) : '',
    newValue: newValue ? JSON.stringify(newValue) : '',
    reason, ipAddress: 'client', device: typeof navigator !== 'undefined' ? navigator.userAgent : 'server',
    status: 'Success',
  });
}

async function notify(title: string, message: string, recordId: string, roles: string[] = []) {
  try {
    for (const role of roles) {
      await addDoc(collection(getFirebaseFirestore(), PCM_COLLECTIONS.notifications), {
        title, message, module: PCM_MODULE, record_id: recordId,
        target_role: role, read: false, created_at: now(),
      });
    }
  } catch (e) { console.error('PCM notification failed:', e); }
}

async function generatePrintNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `PRT-${year}-`;
  try {
    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), PCM_COLLECTIONS.requests),
      where('print_number', '>=', prefix),
      where('print_number', '<=', `${prefix}\uf8ff`),
      orderBy('print_number', 'desc'),
      limit(1),
    ));
    if (!snap.empty) {
      const last = snap.docs[0].data().print_number as string;
      return `${prefix}${String(parseInt(last.split('-').pop() || '0', 10) + 1).padStart(4, '0')}`;
    }
  } catch {
    const all = await getDocs(collection(getFirebaseFirestore(), PCM_COLLECTIONS.requests));
    return `${prefix}${String(all.size + 1).padStart(4, '0')}`;
  }
  return `${prefix}0001`;
}

async function generateControlledCopyNumber(documentNumber: string): Promise<string> {
  const prefix = `CC-${documentNumber.replace(/[^A-Z0-9]/gi, '')}-`;
  try {
    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), PCM_COLLECTIONS.copies),
      where('controlled_copy_number', '>=', prefix),
      where('controlled_copy_number', '<=', `${prefix}\uf8ff`),
      orderBy('controlled_copy_number', 'desc'),
      limit(1),
    ));
    if (!snap.empty) {
      const last = snap.docs[0].data().controlled_copy_number as string;
      return `${prefix}${String(parseInt(last.split('-').pop() || '0', 10) + 1).padStart(4, '0')}`;
    }
  } catch {
    const all = await getDocs(query(
      collection(getFirebaseFirestore(), PCM_COLLECTIONS.copies),
      where('document_number', '==', documentNumber),
      limit(100),
    ));
    return `${prefix}${String(all.size + 1).padStart(4, '0')}`;
  }
  return `${prefix}0001`;
}

function generateBarcode(copyNumber: string, docNumber: string, version: string): string {
  const payload = `${docNumber}|${version}|${copyNumber}|${Date.now()}`;
  let hash = 0;
  for (let i = 0; i < payload.length; i++) hash = ((hash << 5) - hash + payload.charCodeAt(i)) | 0;
  return `BC${Math.abs(hash).toString(36).toUpperCase().padStart(8, '0')}`;
}

function generateQRCode(copyNumber: string, docNumber: string, version: string): string {
  return JSON.stringify({ doc: docNumber, ver: version, copy: copyNumber, ts: Date.now() });
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

async function listPrintRequests(): Promise<PrintRequestRecord[]> {
  try {
    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), PCM_COLLECTIONS.requests),
      orderBy('updated_at', 'desc'),
    ));
    return snap.docs.map((d) => mapPrintRequestRaw({ id: d.id, ...d.data() }));
  } catch {
    const snap = await getDocs(collection(getFirebaseFirestore(), PCM_COLLECTIONS.requests));
    return snap.docs.map((d) => mapPrintRequestRaw({ id: d.id, ...d.data() }))
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  }
}

async function listPrintCopies(): Promise<PrintCopyRecord[]> {
  try {
    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), PCM_COLLECTIONS.copies),
      orderBy('updated_at', 'desc'),
    ));
    return snap.docs.map((d) => mapPrintCopyRaw({ id: d.id, ...d.data() }));
  } catch {
    const snap = await getDocs(collection(getFirebaseFirestore(), PCM_COLLECTIONS.copies));
    return snap.docs.map((d) => mapPrintCopyRaw({ id: d.id, ...d.data() }))
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  }
}

export async function createPrintRequest(input: CreatePrintRequestInput, actor: PrintControlActor): Promise<PrintRequestRecord> {
  const docRecord = await getDocumentById(input.document_id);
  if (!docRecord) throw new Error('Document not found');
  if (docRecord.status !== 'effective') {
    throw new Error('Only effective document versions may be printed');
  }

  const printNumber = await generatePrintNumber();
  const timestamp = now();
  const needsApproval = isControlledPrintType(input.print_type);
  const watermark = input.print_watermark || DEFAULT_WATERMARK;

  const payload = {
    print_request_id: printNumber,
    print_number: printNumber,
    module: PCM_MODULE,
    document_id: docRecord.id,
    document_number: docRecord.document_number,
    document_title: docRecord.document_title,
    document_type: docRecord.document_type,
    version: docRecord.version,
    print_reason: input.print_reason,
    print_type: input.print_type,
    print_status: needsApproval ? 'Pending Approval' : 'Approved',
    controlled_copy_number: '',
    total_copies: input.total_copies,
    issued_copies: 0,
    returned_copies: 0,
    destroyed_copies: 0,
    print_location: input.print_location,
    printer: input.printer,
    department: input.department,
    site: input.site,
    requestor_id: actor.id,
    requestor_name: actor.name,
    approver_id: input.approver_id,
    approver_name: input.approver_name,
    issued_to: '',
    issued_to_name: input.issued_to_name,
    issue_date: null,
    return_due_date: null,
    return_date: null,
    reconciliation_status: 'Pending',
    destruction_status: 'Pending',
    electronic_signature_required: input.electronic_signature_required || needsApproval,
    print_watermark: watermark,
    barcode: '',
    qr_code: '',
    created_by: actor.id,
    created_by_name: actor.name,
    updated_by: actor.id,
    updated_by_name: actor.name,
    created_at: timestamp,
    updated_at: timestamp,
  };

  const ref = await addDoc(collection(getFirebaseFirestore(), PCM_COLLECTIONS.requests), payload);
  await audit(actor, 'PRINT_REQUESTED', ref.id, null, payload);
  await notify('Print Request Submitted', `${docRecord.document_number} print request ${printNumber}`, ref.id,
    needsApproval ? ['head_qa'] : ['document_controller']);
  return mapPrintRequestRaw({ id: ref.id, ...payload });
}

export async function approvePrintRequest(requestId: string, input: ApprovePrintInput, actor: PrintControlActor): Promise<void> {
  const rec = await getPrintRequestById(requestId);
  if (!rec) throw new Error('Print request not found');
  if (rec.print_status !== 'Pending Approval') throw new Error('Request is not pending approval');
  if (rec.electronic_signature_required && !input.signature_meaning?.trim()) {
    throw new Error('Electronic signature required for approval');
  }

  await updateDoc(doc(getFirebaseFirestore(), PCM_COLLECTIONS.requests, requestId), {
    print_status: 'Approved',
    approver_id: actor.id,
    approver_name: actor.name,
    updated_at: now(),
    updated_by: actor.id,
    updated_by_name: actor.name,
  });

  if (input.signature_meaning) {
    await audit(actor, 'ELECTRONIC_SIGNATURE_COMPLETED', requestId, null, { meaning: input.signature_meaning });
  }
  await audit(actor, 'PRINT_APPROVED', requestId, 'Pending Approval', 'Approved', input.comments);
  await notify('Print Approved', `${rec.print_number} approved for printing`, requestId, ['document_controller']);
}

export async function generatePrintCopies(requestId: string, actor: PrintControlActor): Promise<PrintCopyRecord[]> {
  const rec = await getPrintRequestById(requestId);
  if (!rec) throw new Error('Print request not found');
  if (!['Approved', 'Printed'].includes(rec.print_status)) {
    throw new Error('Print request must be approved before generating copies');
  }

  const timestamp = now();
  const copies: PrintCopyRecord[] = [];

  for (let i = 0; i < rec.total_copies; i++) {
    const copyNumber = isControlledPrintType(rec.print_type)
      ? await generateControlledCopyNumber(rec.document_number)
      : `UC-${rec.print_number}-${i + 1}`;
    const barcode = generateBarcode(copyNumber, rec.document_number, rec.version);
    const qrCode = generateQRCode(copyNumber, rec.document_number, rec.version);

    const copyPayload = {
      copy_id: copyNumber,
      controlled_copy_number: copyNumber,
      print_request_id: requestId,
      print_number: rec.print_number,
      module: PCM_MODULE,
      document_id: rec.document_id,
      document_number: rec.document_number,
      document_title: rec.document_title,
      version: rec.version,
      print_type: rec.print_type,
      copy_status: 'Printed',
      barcode,
      qr_code: qrCode,
      print_watermark: rec.print_watermark,
      issued_to: '',
      issued_to_name: '',
      issue_date: null,
      return_due_date: null,
      return_date: null,
      reconciliation_status: 'Pending',
      destruction_status: 'Pending',
      is_replacement: false,
      replaced_copy_id: null,
      department: rec.department,
      site: rec.site,
      print_location: rec.print_location,
      printer: rec.printer,
      created_at: timestamp,
      updated_at: timestamp,
    };

    const ref = await addDoc(collection(getFirebaseFirestore(), PCM_COLLECTIONS.copies), copyPayload);
    await audit(actor, 'COPY_GENERATED', ref.id, null, { copy_number: copyNumber });
    await audit(actor, 'BARCODE_CREATED', ref.id, null, { barcode });
    await audit(actor, 'QR_CODE_GENERATED', ref.id, null, { qr_code: qrCode });
    copies.push(mapPrintCopyRaw({ id: ref.id, ...copyPayload }));
  }

  await updateDoc(doc(getFirebaseFirestore(), PCM_COLLECTIONS.requests, requestId), {
    print_status: 'Printed',
    controlled_copy_number: copies[0]?.controlled_copy_number || '',
    barcode: copies[0]?.barcode || '',
    qr_code: copies[0]?.qr_code || '',
    updated_at: timestamp,
    updated_by: actor.id,
    updated_by_name: actor.name,
  });

  await addDoc(collection(getFirebaseFirestore(), PCM_COLLECTIONS.printedDocuments), {
    print_request_id: requestId,
    document_id: rec.document_id,
    document_number: rec.document_number,
    version: rec.version,
    copies_generated: copies.length,
    watermark: rec.print_watermark,
    created_at: timestamp,
  });

  return copies;
}

export async function issueCopy(input: IssueCopyInput, actor: PrintControlActor): Promise<void> {
  const snap = await getDoc(doc(getFirebaseFirestore(), PCM_COLLECTIONS.copies, input.copy_id));
  if (!snap.exists()) throw new Error('Copy not found');
  const copy = mapPrintCopyRaw({ id: snap.id, ...snap.data() });
  if (copy.copy_status !== 'Printed') throw new Error('Copy must be printed before issuance');

  const timestamp = now();
  const today = timestamp.split('T')[0];

  await updateDoc(doc(getFirebaseFirestore(), PCM_COLLECTIONS.copies, input.copy_id), {
    copy_status: 'Issued',
    issued_to: input.issued_to,
    issued_to_name: input.issued_to_name,
    issue_date: today,
    return_due_date: addDays(today, RETURN_DUE_DAYS),
    updated_at: timestamp,
  });

  const req = await getPrintRequestById(copy.print_request_id);
  if (req) {
    await updateDoc(doc(getFirebaseFirestore(), PCM_COLLECTIONS.requests, copy.print_request_id), {
      print_status: 'Issued',
      issued_copies: req.issued_copies + 1,
      issued_to: input.issued_to,
      issued_to_name: input.issued_to_name,
      issue_date: today,
      return_due_date: addDays(today, RETURN_DUE_DAYS),
      updated_at: timestamp,
    });
  }

  await addDoc(collection(getFirebaseFirestore(), PCM_COLLECTIONS.distribution), {
    copy_id: input.copy_id,
    issued_to: input.issued_to,
    issued_to_name: input.issued_to_name,
    issue_date: today,
    created_at: timestamp,
  });

  await audit(actor, 'COPY_ISSUED', input.copy_id, 'Printed', 'Issued');
  await notify('Copies Issued', `${copy.controlled_copy_number} issued to ${input.issued_to_name}`, input.copy_id, ['document_controller']);
}

export async function returnCopy(input: ReturnCopyInput, actor: PrintControlActor): Promise<void> {
  const snap = await getDoc(doc(getFirebaseFirestore(), PCM_COLLECTIONS.copies, input.copy_id));
  if (!snap.exists()) throw new Error('Copy not found');
  const copy = mapPrintCopyRaw({ id: snap.id, ...snap.data() });
  if (copy.copy_status !== 'Issued') throw new Error('Only issued copies can be returned');

  const timestamp = now();
  const today = timestamp.split('T')[0];

  await updateDoc(doc(getFirebaseFirestore(), PCM_COLLECTIONS.copies, input.copy_id), {
    copy_status: 'Returned',
    return_date: today,
    updated_at: timestamp,
  });

  await addDoc(collection(getFirebaseFirestore(), PCM_COLLECTIONS.returns), {
    copy_id: input.copy_id,
    return_date: today,
    return_notes: input.return_notes,
    returned_by: actor.id,
    returned_by_name: actor.name,
    created_at: timestamp,
  });

  const req = await getPrintRequestById(copy.print_request_id);
  if (req) {
    await updateDoc(doc(getFirebaseFirestore(), PCM_COLLECTIONS.requests, copy.print_request_id), {
      print_status: 'Returned',
      returned_copies: req.returned_copies + 1,
      return_date: today,
      updated_at: timestamp,
    });
  }

  await audit(actor, 'COPY_RETURNED', input.copy_id, 'Issued', 'Returned', input.return_notes);
}

export async function reconcileCopy(input: ReconcileCopyInput, actor: PrintControlActor): Promise<void> {
  const snap = await getDoc(doc(getFirebaseFirestore(), PCM_COLLECTIONS.copies, input.copy_id));
  if (!snap.exists()) throw new Error('Copy not found');
  const copy = mapPrintCopyRaw({ id: snap.id, ...snap.data() });
  if (copy.copy_status !== 'Returned') throw new Error('Copy must be returned before reconciliation');

  const timestamp = now();
  await updateDoc(doc(getFirebaseFirestore(), PCM_COLLECTIONS.copies, input.copy_id), {
    copy_status: 'Reconciled',
    reconciliation_status: 'Completed',
    updated_at: timestamp,
  });

  await addDoc(collection(getFirebaseFirestore(), PCM_COLLECTIONS.reconciliation), {
    copy_id: input.copy_id,
    reconciled_by: actor.id,
    reconciled_by_name: actor.name,
    notes: input.notes,
    status: 'Completed',
    created_at: timestamp,
  });

  const req = await getPrintRequestById(copy.print_request_id);
  if (req) {
    await updateDoc(doc(getFirebaseFirestore(), PCM_COLLECTIONS.requests, copy.print_request_id), {
      print_status: 'Reconciled',
      reconciliation_status: 'Completed',
      updated_at: timestamp,
    });
  }

  await audit(actor, 'RECONCILIATION_COMPLETED', input.copy_id, 'Returned', 'Reconciled', input.notes);
  await notify('Reconciliation Due', `${copy.controlled_copy_number} reconciled`, input.copy_id, ['document_controller']);
}

export async function destroyCopy(input: DestroyCopyInput, actor: PrintControlActor): Promise<void> {
  const snap = await getDoc(doc(getFirebaseFirestore(), PCM_COLLECTIONS.copies, input.copy_id));
  if (!snap.exists()) throw new Error('Copy not found');
  const copy = mapPrintCopyRaw({ id: snap.id, ...snap.data() });

  const timestamp = now();
  await updateDoc(doc(getFirebaseFirestore(), PCM_COLLECTIONS.copies, input.copy_id), {
    copy_status: 'Destroyed',
    destruction_status: 'Completed',
    updated_at: timestamp,
  });

  await addDoc(collection(getFirebaseFirestore(), PCM_COLLECTIONS.destruction), {
    copy_id: input.copy_id,
    controlled_copy_number: copy.controlled_copy_number,
    reason: input.reason,
    destroyed_by: actor.id,
    destroyed_by_name: actor.name,
    destruction_date: timestamp.split('T')[0],
    created_at: timestamp,
  });

  const req = await getPrintRequestById(copy.print_request_id);
  if (req) {
    await updateDoc(doc(getFirebaseFirestore(), PCM_COLLECTIONS.requests, copy.print_request_id), {
      destroyed_copies: req.destroyed_copies + 1,
      destruction_status: 'Completed',
      updated_at: timestamp,
    });
  }

  await audit(actor, 'COPY_DESTROYED', input.copy_id, copy.copy_status, 'Destroyed', input.reason);
  await notify('Copy Destroyed', `${copy.controlled_copy_number} destroyed`, input.copy_id, ['head_qa']);
}

export async function issueReplacementCopy(originalCopyId: string, actor: PrintControlActor): Promise<PrintCopyRecord> {
  const origSnap = await getDoc(doc(getFirebaseFirestore(), PCM_COLLECTIONS.copies, originalCopyId));
  if (!origSnap.exists()) throw new Error('Original copy not found');
  const orig = mapPrintCopyRaw({ id: origSnap.id, ...origSnap.data() });

  const copyNumber = await generateControlledCopyNumber(orig.document_number);
  const barcode = generateBarcode(copyNumber, orig.document_number, orig.version);
  const qrCode = generateQRCode(copyNumber, orig.document_number, orig.version);
  const timestamp = now();

  const payload = {
    copy_id: copyNumber,
    controlled_copy_number: copyNumber,
    print_request_id: orig.print_request_id,
    print_number: orig.print_number,
    module: PCM_MODULE,
    document_id: orig.document_id,
    document_number: orig.document_number,
    document_title: orig.document_title,
    version: orig.version,
    print_type: orig.print_type,
    copy_status: 'Printed',
    barcode,
    qr_code: qrCode,
    print_watermark: orig.print_watermark,
    issued_to: '',
    issued_to_name: '',
    issue_date: null,
    return_due_date: null,
    return_date: null,
    reconciliation_status: 'Pending',
    destruction_status: 'Pending',
    is_replacement: true,
    replaced_copy_id: originalCopyId,
    department: orig.department,
    site: orig.site,
    print_location: orig.print_location,
    printer: orig.printer,
    created_at: timestamp,
    updated_at: timestamp,
  };

  const ref = await addDoc(collection(getFirebaseFirestore(), PCM_COLLECTIONS.copies), payload);
  await audit(actor, 'REPLACEMENT_ISSUED', ref.id, null, { replaced: originalCopyId });
  return mapPrintCopyRaw({ id: ref.id, ...payload });
}

export async function bulkApprovePrintRequests(input: BulkApproveInput, actor: PrintControlActor): Promise<number> {
  let count = 0;
  for (const id of input.request_ids) {
    try {
      await approvePrintRequest(id, { comments: 'Bulk approved' }, actor);
      count++;
    } catch { /* skip */ }
  }
  return count;
}

export async function monitorPendingReturns(actor: PrintControlActor): Promise<number> {
  const copies = await listPrintCopies();
  const today = now().split('T')[0];
  let notified = 0;

  for (const c of copies.filter((x) => x.copy_status === 'Issued' && x.return_due_date)) {
    if (c.return_due_date! <= today) {
      await notify('Return Reminder', `${c.controlled_copy_number} return overdue`, c.id, ['document_controller']);
      notified++;
    } else {
      const days = Math.ceil((new Date(`${c.return_due_date}T12:00:00`).getTime() - Date.now()) / 86400000);
      if (days <= 7) {
        await notify('Return Reminder', `${c.controlled_copy_number} due ${c.return_due_date}`, c.id, ['document_controller']);
        notified++;
      }
    }
  }
  return notified;
}

export async function processScheduledPrintJobs(actor: PrintControlActor) {
  const reminders = await monitorPendingReturns(actor);
  return { reminders };
}

export async function fetchPrintControlDashboardData(filters?: PrintControlFilters) {
  await processScheduledPrintJobs({ id: 'system', name: 'System', role: 'system' });
  let requests = await listPrintRequests();
  let copies = await listPrintCopies();
  if (filters) {
    requests = filterPrintRequests(requests, filters);
    copies = filterPrintCopies(copies, filters);
  }
  return {
    requests,
    copies,
    metrics: computePrintKpis(requests, copies),
    charts: computePrintCharts(requests, copies),
  };
}

export async function getPrintRequestById(id: string): Promise<PrintRequestRecord | null> {
  const snap = await getDoc(doc(getFirebaseFirestore(), PCM_COLLECTIONS.requests, id));
  if (!snap.exists()) return null;
  return mapPrintRequestRaw({ id: snap.id, ...snap.data() });
}

export async function getPrintCopyById(id: string): Promise<PrintCopyRecord | null> {
  const snap = await getDoc(doc(getFirebaseFirestore(), PCM_COLLECTIONS.copies, id));
  if (!snap.exists()) return null;
  return mapPrintCopyRaw({ id: snap.id, ...snap.data() });
}

export function exportPrintControlCsv(requests: PrintRequestRecord[]) {
  downloadCsv('print-requests.csv',
    ['Print #', 'Document', 'Version', 'Type', 'Status', 'Copies', 'Department'],
    requests.map((r) => [
      r.print_number, r.document_number, r.version, r.print_type, r.print_status, r.total_copies, r.department,
    ]),
  );
}

export function exportPrintControlExcel(requests: PrintRequestRecord[]) {
  exportPrintControlCsv(requests);
}

export async function logPrintDashboardViewed(actor: PrintControlActor) {
  await audit(actor, 'DASHBOARD_VIEWED', 'print-control-dashboard', null, null);
}

export async function logPrintExported(actor: PrintControlActor, format: string, count: number) {
  await audit(actor, 'EXPORT', 'print-control-dashboard', null, { format, count });
}

export async function runScheduledPrintControlJobs() {
  return processScheduledPrintJobs({ id: 'scheduler', name: 'Scheduled Job', role: 'system' });
}
