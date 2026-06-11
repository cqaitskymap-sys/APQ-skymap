import {
  addDoc, collection, doc, getDoc, getDocs, limit, orderBy, query, updateDoc, where,
  type QueryConstraint,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { firestore, storage } from '@/lib/firebase';
import { logAuditEvent } from '@/lib/admin/admin-service';
import { createDeviation } from '@/lib/deviation-service';
import { createCapa } from '@/lib/capa-service';
import { downloadCsv } from '@/lib/export-utils';
import {
  VALIDATION_COLLECTIONS, isValidationOpen,
  type ValidationRecord, type ValidationProtocol, type ValidationExecutionStep,
  type ValidationApproval, type ValidationAttachment, type ProcessValidationData,
  type CleaningValidationData, type CsvValidationData, type ValidationFilters,
  type ValidationDashboardMetrics, type ValidationActor,
} from './validation-mgmt-types';
import type {
  ValidationCreateInput, ProtocolInput, ExecutionStepInput, ApprovalInput,
  ProcessValidationInput, CleaningValidationInput, CsvValidationInput,
} from './validation-mgmt-schemas';

function now() { return new Date().toISOString(); }

async function auditLog(actor: ValidationActor, action: string, recordId: string, oldValue: unknown, newValue: unknown, reason = '') {
  await logAuditEvent({
    userId: actor.id, userName: actor.name, module: 'Validation', recordId, action,
    oldValue: oldValue ? JSON.stringify(oldValue) : '',
    newValue: newValue ? JSON.stringify(newValue) : '',
    reason, ipAddress: 'client', device: typeof navigator !== 'undefined' ? navigator.userAgent : 'server',
    status: 'Success',
  });
}

async function notify(title: string, message: string, recordId: string, roles: string[]) {
  try {
    for (const role of roles) {
      await addDoc(collection(firestore, VALIDATION_COLLECTIONS.notifications), {
        title, message, module: 'Validation', record_id: recordId, target_role: role,
        read: false, created_at: now(),
      });
    }
  } catch (e) { console.error('Notification failed:', e); }
}

async function genNumber(prefix: string, collName: string, field: string): Promise<string> {
  const year = new Date().getFullYear();
  const p = `${prefix}-${year}-`;
  try {
    const snap = await getDocs(query(
      collection(firestore, collName),
      where(field, '>=', p), where(field, '<=', `${p}\uf8ff`),
      orderBy(field, 'desc'), limit(1),
    ));
    if (!snap.empty) {
      const last = snap.docs[0].data()[field] as string;
      return `${p}${String(parseInt(last.split('-').pop() || '0', 10) + 1).padStart(4, '0')}`;
    }
  } catch {
    const all = await getDocs(collection(firestore, collName));
    return `${p}${String(all.size + 1).padStart(4, '0')}`;
  }
  return `${p}0001`;
}

// ─── Validation Records CRUD ─────────────────────────────────────────────────

export async function createValidation(input: ValidationCreateInput, actor: ValidationActor): Promise<ValidationRecord> {
  const validationNumber = await genNumber('VAL', VALIDATION_COLLECTIONS.records, 'validation_number');
  const timestamp = now();
  const record: Omit<ValidationRecord, 'id'> = {
    validation_number: validationNumber,
    validation_type: input.validation_type,
    validation_title: input.validation_title,
    department: input.department,
    product_name: input.product_name,
    batch_number: input.batch_number,
    equipment_name: input.equipment_name,
    equipment_id: input.equipment_id,
    system_name: input.system_name,
    protocol_number: input.protocol_number || validationNumber,
    protocol_version: input.protocol_version,
    report_number: input.report_number,
    validation_start_date: input.validation_start_date,
    validation_end_date: input.validation_end_date,
    revalidation_due_date: input.revalidation_due_date || null,
    validation_status: input.validation_status,
    deviation_observed: input.deviation_observed,
    capa_required: input.capa_required,
    change_control_linked: input.change_control_linked,
    change_control_id: input.change_control_id || null,
    change_control_number: input.change_control_number,
    linked_deviation_id: null,
    linked_deviation_number: null,
    linked_capa_id: null,
    linked_capa_number: null,
    prepared_by: actor.id,
    prepared_by_name: actor.name,
    reviewed_by: '',
    reviewed_by_name: '',
    approved_by: '',
    approved_by_name: '',
    remarks: input.remarks,
    is_vmp: input.is_vmp,
    vmp_year: input.vmp_year || null,
    created_by: actor.id,
    created_by_name: actor.name,
    updated_by: actor.id,
    updated_by_name: actor.name,
    created_at: timestamp,
    updated_at: timestamp,
  };
  const refDoc = await addDoc(collection(firestore, VALIDATION_COLLECTIONS.records), record);
  await auditLog(actor, 'CREATE', refDoc.id, null, record);
  return { id: refDoc.id, ...record };
}

export async function getValidationById(id: string): Promise<ValidationRecord | null> {
  const snap = await getDoc(doc(firestore, VALIDATION_COLLECTIONS.records, id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as ValidationRecord;
}

export async function listValidations(filters?: ValidationFilters): Promise<ValidationRecord[]> {
  const constraints: QueryConstraint[] = [orderBy('updated_at', 'desc')];
  if (filters?.validation_type) constraints.unshift(where('validation_type', '==', filters.validation_type));
  if (filters?.validation_status) constraints.unshift(where('validation_status', '==', filters.validation_status));
  if (filters?.department) constraints.unshift(where('department', '==', filters.department));
  if (filters?.is_vmp) constraints.unshift(where('is_vmp', '==', true));

  let records: ValidationRecord[];
  try {
    const snap = await getDocs(query(collection(firestore, VALIDATION_COLLECTIONS.records), ...constraints));
    records = snap.docs.map((d) => ({ id: d.id, ...d.data() } as ValidationRecord));
  } catch {
    const snap = await getDocs(collection(firestore, VALIDATION_COLLECTIONS.records));
    records = snap.docs.map((d) => ({ id: d.id, ...d.data() } as ValidationRecord));
    if (filters?.validation_type) records = records.filter((r) => r.validation_type === filters.validation_type);
    if (filters?.validation_status) records = records.filter((r) => r.validation_status === filters.validation_status);
    if (filters?.department) records = records.filter((r) => r.department === filters.department);
    if (filters?.is_vmp) records = records.filter((r) => r.is_vmp);
  }

  if (filters?.search) {
    const q = filters.search.toLowerCase();
    records = records.filter((r) =>
      r.validation_number.toLowerCase().includes(q) || r.validation_title.toLowerCase().includes(q) ||
      r.equipment_name.toLowerCase().includes(q) || r.product_name.toLowerCase().includes(q),
    );
  }
  return records;
}

export async function updateValidation(id: string, input: Partial<ValidationCreateInput>, actor: ValidationActor): Promise<ValidationRecord> {
  const existing = await getValidationById(id);
  if (!existing) throw new Error('Validation not found');
  const updates = { ...input, updated_by: actor.id, updated_by_name: actor.name, updated_at: now() };
  await updateDoc(doc(firestore, VALIDATION_COLLECTIONS.records, id), updates);
  await auditLog(actor, 'EDIT', id, existing, updates);
  return { ...existing, ...updates } as ValidationRecord;
}

export async function submitValidationApproval(input: ApprovalInput, actor: ValidationActor): Promise<ValidationRecord> {
  const existing = await getValidationById(input.validation_id);
  if (!existing) throw new Error('Validation not found');

  const approval: Omit<ValidationApproval, 'id'> = {
    validation_id: input.validation_id,
    approval_level: input.approval_level,
    approver_id: actor.id,
    approver_name: actor.name,
    decision: input.decision,
    comments: input.comments,
    approved_at: now(),
  };
  await addDoc(collection(firestore, VALIDATION_COLLECTIONS.approvals), approval);

  const statusMap: Record<string, string> = {
    approved: input.approval_level === 'Protocol' ? 'Protocol Approved' : 'Approved',
    rejected: 'Rejected',
  };
  const newStatus = statusMap[input.decision] || existing.validation_status;
  const updates: Partial<ValidationRecord> = {
    validation_status: newStatus,
    updated_at: now(),
    updated_by: actor.id,
    updated_by_name: actor.name,
  };
  if (input.decision === 'approved') {
    if (input.approval_level === 'Review') {
      updates.reviewed_by = actor.id;
      updates.reviewed_by_name = actor.name;
    } else {
      updates.approved_by = actor.id;
      updates.approved_by_name = actor.name;
    }
  }
  await updateDoc(doc(firestore, VALIDATION_COLLECTIONS.records, input.validation_id), updates);
  await auditLog(actor, input.decision === 'approved' ? 'APPROVAL' : 'REJECTION', input.validation_id, existing, updates);

  if (input.decision === 'approved' && newStatus === 'Approved') {
    await notify('Validation Approved', `${existing.validation_number} approved`, input.validation_id, ['qa_manager', 'head_qa', 'pqr']);
  }
  return { ...existing, ...updates } as ValidationRecord;
}

// ─── Protocol ────────────────────────────────────────────────────────────────

export async function saveProtocol(input: ProtocolInput, actor: ValidationActor): Promise<ValidationProtocol> {
  const existing = await getProtocol(input.validation_id);
  const data = { ...input, updated_at: now() };
  if (existing) {
    await updateDoc(doc(firestore, VALIDATION_COLLECTIONS.protocols, existing.id), data);
    await updateValidation(input.validation_id, { validation_status: 'Protocol Under Review' }, actor);
    await auditLog(actor, 'PROTOCOL_UPDATE', input.validation_id, existing, data);
    return { ...existing, ...data };
  }
  const record: Omit<ValidationProtocol, 'id'> = { ...input, created_at: now(), updated_at: now() };
  const refDoc = await addDoc(collection(firestore, VALIDATION_COLLECTIONS.protocols), record);
  await updateValidation(input.validation_id, { validation_status: 'Protocol Under Review' }, actor);
  await auditLog(actor, 'PROTOCOL_UPDATE', input.validation_id, null, record);
  return { id: refDoc.id, ...record };
}

export async function getProtocol(validationId: string): Promise<ValidationProtocol | null> {
  try {
    const snap = await getDocs(query(
      collection(firestore, VALIDATION_COLLECTIONS.protocols),
      where('validation_id', '==', validationId), limit(1),
    ));
    if (snap.empty) return null;
    return { id: snap.docs[0].id, ...snap.docs[0].data() } as ValidationProtocol;
  } catch {
    return null;
  }
}

// ─── Execution ───────────────────────────────────────────────────────────────

async function createDeviationFromValidation(record: ValidationRecord, actor: ValidationActor, stepDesc: string) {
  if (record.linked_deviation_id) return record.linked_deviation_id;
  try {
    const dev = await createDeviation({
      title: `Validation deviation — ${record.validation_number}`,
      description: `Failed test step during ${record.validation_type}: ${stepDesc}`,
      department: record.department,
      product_name: record.product_name || 'N/A',
      area: record.equipment_name || record.system_name || 'Validation',
      category: 'Equipment',
      criticality: 'Major',
      planned_type: 'Unplanned',
      immediate_action: 'Investigation initiated from validation execution',
      reported_by_name: actor.name,
      detected_by_name: actor.name,
      deviation_date: now().split('T')[0],
      batch_number: record.batch_number,
    }, { id: actor.id, name: actor.name, role: actor.role }, {
      status: 'draft',
      source: 'manual',
      source_reference: record.validation_number,
    });
    await updateDoc(doc(firestore, VALIDATION_COLLECTIONS.records, record.id), {
      linked_deviation_id: dev.id,
      linked_deviation_number: dev.deviation_number,
      deviation_observed: true,
      validation_status: 'Deviation Observed',
      updated_at: now(),
    });
    await notify('Validation Deviation', `${record.validation_number} — test failure observed`, record.id, ['qa_manager', 'head_qa']);
    return dev.id;
  } catch (e) {
    console.error('Deviation creation failed:', e);
    return null;
  }
}

export async function addExecutionStep(input: ExecutionStepInput, actor: ValidationActor): Promise<ValidationExecutionStep> {
  const record = await getValidationById(input.validation_id);
  if (!record) throw new Error('Validation not found');

  const step: Omit<ValidationExecutionStep, 'id'> = {
    validation_id: input.validation_id,
    test_step_no: input.test_step_no,
    test_description: input.test_description,
    expected_result: input.expected_result,
    actual_result: input.actual_result,
    pass_fail: input.pass_fail,
    executed_by: actor.id,
    executed_by_name: actor.name,
    execution_date: input.execution_date || now().split('T')[0],
    evidence_url: '',
    remarks: input.remarks,
    created_at: now(),
    updated_at: now(),
  };
  const refDoc = await addDoc(collection(firestore, VALIDATION_COLLECTIONS.execution), step);
  await auditLog(actor, 'EXECUTION_UPDATE', input.validation_id, null, step);

  const updates: Partial<ValidationRecord> = { validation_status: 'Execution In Progress', updated_at: now() };

  if (input.pass_fail === 'Fail') {
    updates.deviation_observed = true;
    updates.validation_status = 'Deviation Observed';
    await createDeviationFromValidation(record, actor, input.test_description);
  }
  await updateDoc(doc(firestore, VALIDATION_COLLECTIONS.records, input.validation_id), updates);

  return { id: refDoc.id, ...step };
}

export async function listExecutionSteps(validationId: string): Promise<ValidationExecutionStep[]> {
  try {
    const snap = await getDocs(query(
      collection(firestore, VALIDATION_COLLECTIONS.execution),
      where('validation_id', '==', validationId),
      orderBy('test_step_no', 'asc'),
    ));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as ValidationExecutionStep));
  } catch {
    const snap = await getDocs(query(
      collection(firestore, VALIDATION_COLLECTIONS.execution),
      where('validation_id', '==', validationId),
    ));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as ValidationExecutionStep))
      .sort((a, b) => a.test_step_no - b.test_step_no);
  }
}

export async function uploadExecutionEvidence(
  validationId: string, stepId: string, file: File, actor: ValidationActor,
): Promise<string> {
  const path = `validation/${validationId}/execution/${stepId}_${Date.now()}_${file.name}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  const url = await getDownloadURL(storageRef);
  await updateDoc(doc(firestore, VALIDATION_COLLECTIONS.execution, stepId), {
    evidence_url: url, updated_at: now(),
  });
  await auditLog(actor, 'ATTACHMENT_UPLOAD', validationId, null, { stepId, file: file.name });
  return url;
}

// ─── CAPA Link ───────────────────────────────────────────────────────────────

export async function linkCapaFromValidation(validationId: string, actor: ValidationActor): Promise<ValidationRecord> {
  const record = await getValidationById(validationId);
  if (!record) throw new Error('Validation not found');
  if (record.linked_capa_id) return record;

  const capaDepts = ['Production', 'QC', 'QA', 'Engineering', 'Warehouse', 'Regulatory', 'Microbiology', 'Packaging', 'Maintenance'] as const;
  const dept = capaDepts.includes(record.department as typeof capaDepts[number]) ? record.department : 'QA';
  const capa = await createCapa({
    capa_date: now().split('T')[0],
    capa_source: 'Other',
    source_reference_number: record.validation_number,
    department: dept as typeof capaDepts[number],
    product_name: record.product_name || 'N/A',
    batch_number: record.batch_number,
    capa_title: `CAPA from validation ${record.validation_number}`,
    problem_description: `CAPA required for validation deviation: ${record.validation_title}`,
    root_cause: '',
    corrective_action: '',
    preventive_action: '',
    action_owner: actor.name,
    target_completion_date: new Date(Date.now() + 90 * 86400000).toISOString().split('T')[0],
    effectiveness_check_required: true,
    effectiveness_criteria: 'Validation CAPA effectiveness verified through re-execution',
    qa_remarks: '',
    priority: 'high',
  }, { id: actor.id, name: actor.name, role: actor.role });

  await updateDoc(doc(firestore, VALIDATION_COLLECTIONS.records, validationId), {
    linked_capa_id: capa.id,
    linked_capa_number: capa.capa_number,
    capa_required: true,
    updated_at: now(),
  });
  await auditLog(actor, 'CAPA_LINK', validationId, null, { capa_id: capa.id });
  const updated = await getValidationById(validationId);
  return updated!;
}

// ─── Type-specific data ──────────────────────────────────────────────────────

export async function saveProcessValidation(input: ProcessValidationInput, actor: ValidationActor): Promise<ProcessValidationData> {
  const existing = await getProcessValidation(input.validation_id);
  const data = { ...input, created_at: existing?.created_at || now() };
  if (existing) {
    await updateDoc(doc(firestore, VALIDATION_COLLECTIONS.processValidation, existing.id), data);
    return { id: existing.id, ...data };
  }
  const refDoc = await addDoc(collection(firestore, VALIDATION_COLLECTIONS.processValidation), data);
  await auditLog(actor, 'RESULTS_UPDATE', input.validation_id, null, data);
  return { id: refDoc.id, ...data };
}

export async function getProcessValidation(validationId: string): Promise<ProcessValidationData | null> {
  const snap = await getDocs(query(
    collection(firestore, VALIDATION_COLLECTIONS.processValidation),
    where('validation_id', '==', validationId), limit(1),
  ));
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() } as ProcessValidationData;
}

export async function saveCleaningValidation(input: CleaningValidationInput, actor: ValidationActor): Promise<CleaningValidationData> {
  const existing = await getCleaningValidation(input.validation_id);
  const data = { ...input, created_at: existing?.created_at || now() };
  if (existing) {
    await updateDoc(doc(firestore, VALIDATION_COLLECTIONS.cleaningValidation, existing.id), data);
    return { id: existing.id, ...data };
  }
  const refDoc = await addDoc(collection(firestore, VALIDATION_COLLECTIONS.cleaningValidation), data);
  await auditLog(actor, 'RESULTS_UPDATE', input.validation_id, null, data);
  return { id: refDoc.id, ...data };
}

export async function getCleaningValidation(validationId: string): Promise<CleaningValidationData | null> {
  const snap = await getDocs(query(
    collection(firestore, VALIDATION_COLLECTIONS.cleaningValidation),
    where('validation_id', '==', validationId), limit(1),
  ));
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() } as CleaningValidationData;
}

export async function saveCsvValidation(input: CsvValidationInput, actor: ValidationActor): Promise<CsvValidationData> {
  const existing = await getCsvValidation(input.validation_id);
  const data = { ...input, created_at: existing?.created_at || now() };
  if (existing) {
    await updateDoc(doc(firestore, VALIDATION_COLLECTIONS.csvValidation, existing.id), data);
    return { id: existing.id, ...data };
  }
  const refDoc = await addDoc(collection(firestore, VALIDATION_COLLECTIONS.csvValidation), data);
  await auditLog(actor, 'RESULTS_UPDATE', input.validation_id, null, data);
  return { id: refDoc.id, ...data };
}

export async function getCsvValidation(validationId: string): Promise<CsvValidationData | null> {
  const snap = await getDocs(query(
    collection(firestore, VALIDATION_COLLECTIONS.csvValidation),
    where('validation_id', '==', validationId), limit(1),
  ));
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() } as CsvValidationData;
}

// ─── Attachments & Approvals ─────────────────────────────────────────────────

export async function uploadValidationAttachment(
  validationId: string, file: File, category: string, actor: ValidationActor,
): Promise<ValidationAttachment> {
  const path = `validation/${validationId}/${Date.now()}_${file.name}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  const downloadUrl = await getDownloadURL(storageRef);
  const attachment: Omit<ValidationAttachment, 'id'> = {
    validation_id: validationId, file_name: file.name, file_type: file.type, file_size: file.size,
    category, storage_path: path, download_url: downloadUrl,
    uploaded_by: actor.id, uploaded_by_name: actor.name, uploaded_at: now(),
  };
  const refDoc = await addDoc(collection(firestore, VALIDATION_COLLECTIONS.attachments), attachment);
  await auditLog(actor, 'ATTACHMENT_UPLOAD', validationId, null, { file_name: file.name, category });
  return { id: refDoc.id, ...attachment };
}

export async function getValidationAttachments(validationId: string): Promise<ValidationAttachment[]> {
  try {
    const snap = await getDocs(query(
      collection(firestore, VALIDATION_COLLECTIONS.attachments),
      where('validation_id', '==', validationId), orderBy('uploaded_at', 'desc'),
    ));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as ValidationAttachment));
  } catch {
    const snap = await getDocs(query(
      collection(firestore, VALIDATION_COLLECTIONS.attachments),
      where('validation_id', '==', validationId),
    ));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as ValidationAttachment));
  }
}

export async function getValidationApprovals(validationId: string): Promise<ValidationApproval[]> {
  const snap = await getDocs(query(
    collection(firestore, VALIDATION_COLLECTIONS.approvals),
    where('validation_id', '==', validationId),
  ));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as ValidationApproval));
}

export async function getAuditLogsForValidation(validationId: string): Promise<Record<string, unknown>[]> {
  try {
    const snap = await getDocs(query(
      collection(firestore, VALIDATION_COLLECTIONS.auditLogs),
      where('recordId', '==', validationId), where('module', '==', 'Validation'),
      orderBy('dateTime', 'desc'), limit(100),
    ));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch {
    return [];
  }
}

// ─── Sync & Dashboard ────────────────────────────────────────────────────────

export async function syncRevalidationDue(): Promise<number> {
  const today = now().split('T')[0];
  const snap = await getDocs(collection(firestore, VALIDATION_COLLECTIONS.records));
  let count = 0;
  for (const d of snap.docs) {
    const data = d.data() as ValidationRecord;
    if (data.revalidation_due_date && data.revalidation_due_date <= today &&
        !['Revalidation Due', 'Closed', 'Rejected'].includes(data.validation_status)) {
      await updateDoc(d.ref, { validation_status: 'Revalidation Due', updated_at: now() });
      await notify('Revalidation Due', `${data.validation_number} revalidation overdue`, d.id, ['qa_manager', 'head_qa', 'validation']);
      count++;
    }
  }
  return count;
}

export function computeDashboardMetrics(records: ValidationRecord[]): ValidationDashboardMetrics {
  const today = now().split('T')[0];
  return {
    total: records.length,
    open: records.filter((r) => isValidationOpen(r.validation_status)).length,
    approved: records.filter((r) => r.validation_status === 'Approved' || r.validation_status === 'Closed').length,
    rejected: records.filter((r) => r.validation_status === 'Rejected').length,
    deviationObserved: records.filter((r) => r.deviation_observed).length,
    capaLinked: records.filter((r) => r.linked_capa_id).length,
    revalidationDue: records.filter((r) => r.validation_status === 'Revalidation Due').length,
    overdue: records.filter((r) => r.validation_end_date && r.validation_end_date < today && isValidationOpen(r.validation_status)).length,
  };
}

export function validationChartData(records: ValidationRecord[]) {
  const byType: Record<string, number> = {};
  const byDept: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  const deviationTrend: Record<string, number> = {};
  const revalTrend: Record<string, number> = {};

  for (const r of records) {
    byType[r.validation_type] = (byType[r.validation_type] || 0) + 1;
    byDept[r.department] = (byDept[r.department] || 0) + 1;
    byStatus[r.validation_status] = (byStatus[r.validation_status] || 0) + 1;
    if (r.deviation_observed) {
      const month = r.updated_at.slice(0, 7);
      deviationTrend[month] = (deviationTrend[month] || 0) + 1;
    }
    if (r.validation_status === 'Revalidation Due' || r.revalidation_due_date) {
      const month = (r.revalidation_due_date || r.updated_at).slice(0, 7);
      revalTrend[month] = (revalTrend[month] || 0) + 1;
    }
  }

  const toChart = (obj: Record<string, number>) =>
    Object.entries(obj).map(([name, value]) => ({ name, value }));

  return {
    byType: toChart(byType),
    byDept: toChart(byDept),
    statusTrend: toChart(byStatus),
    deviationTrend: Object.entries(deviationTrend).sort().map(([month, value]) => ({ month, value })),
    revalTrend: Object.entries(revalTrend).sort().map(([month, value]) => ({ month, value })),
  };
}

/** Approved validations for PQR Validation Review integration */
export async function listApprovedValidationsForPqr(productName?: string): Promise<ValidationRecord[]> {
  const all = await listValidations({});
  return all.filter((r) => {
    if (!['Approved', 'Closed'].includes(r.validation_status)) return false;
    if (productName && r.product_name && !r.product_name.toLowerCase().includes(productName.toLowerCase())) return false;
    return true;
  });
}

export async function exportValidationsCsv(records: ValidationRecord[]) {
  downloadCsv(
    `validations-${now().split('T')[0]}.csv`,
    ['Number', 'Type', 'Title', 'Department', 'Equipment', 'Status', 'Deviation', 'CAPA'],
    records.map((r) => [
      r.validation_number, r.validation_type, r.validation_title, r.department,
      r.equipment_name || r.system_name, r.validation_status,
      r.deviation_observed ? 'Yes' : 'No', r.linked_capa_number || '—',
    ]),
  );
}
