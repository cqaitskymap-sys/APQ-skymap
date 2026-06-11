import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc,
  query, where, orderBy, limit, writeBatch,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { firestore, storage } from '@/lib/firebase';
import { logAuditEvent } from '@/lib/admin/admin-service';
import { downloadCsv } from '@/lib/export-utils';
import {
  OOS_COLLECTIONS, type OosRecord, type OosPhase1, type OosPhase2,
  type OosImpactAssessment, type OosCapaLink, type OosApproval, type OosAttachment,
  type OosFilters, type OosDashboardMetrics, type OosActor,
  computeResultStatus, isOpenOosStatus, isCriticalTest, buildLegacySpecification,
} from './oos-types';

function now() { return new Date().toISOString(); }

async function audit(actor: OosActor, action: string, recordId: string, oldValue: unknown, newValue: unknown, reason = '') {
  await logAuditEvent({
    userId: actor.id, userName: actor.name, module: 'OOS', recordId, action,
    oldValue: oldValue ? JSON.stringify(oldValue) : '',
    newValue: newValue ? JSON.stringify(newValue) : '',
    reason,
    ipAddress: typeof window !== 'undefined' ? 'client' : 'server',
    device: typeof navigator !== 'undefined' ? navigator.userAgent : 'server',
    status: 'Success',
  });
}

async function notifyOos(title: string, message: string, oosId: string, roles: string[]) {
  try {
    for (const role of roles) {
      await addDoc(collection(firestore, OOS_COLLECTIONS.notifications), {
        title, message, module: 'OOS', record_id: oosId, target_role: role,
        read: false, created_at: now(),
      });
    }
  } catch (e) { console.error('Notification failed:', e); }
}

export async function generateOosNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `OOS-${year}-`;
  try {
    const snap = await getDocs(query(
      collection(firestore, OOS_COLLECTIONS.records),
      where('oos_number', '>=', prefix),
      where('oos_number', '<=', `${prefix}\uf8ff`),
      orderBy('oos_number', 'desc'),
      limit(1),
    ));
    if (!snap.empty) {
      const last = snap.docs[0].data().oos_number as string;
      const seq = parseInt(last.split('-').pop() || '0', 10) + 1;
      return `${prefix}${String(seq).padStart(4, '0')}`;
    }
  } catch {
    const all = await getDocs(collection(firestore, OOS_COLLECTIONS.records));
    return `${prefix}${String(all.size + 1).padStart(4, '0')}`;
  }
  return `${prefix}0001`;
}

async function linkBatch(batchNumber: string) {
  if (!batchNumber) return { batch_id: null, pqr_id: null };
  try {
    const snap = await getDocs(query(
      collection(firestore, OOS_COLLECTIONS.batches),
      where('batch_number', '==', batchNumber),
      limit(1),
    ));
    if (snap.empty) return { batch_id: null, pqr_id: null };
    const data = snap.docs[0].data();
    return { batch_id: snap.docs[0].id, pqr_id: (data.pqr_id as string) || null };
  } catch { return { batch_id: null, pqr_id: null }; }
}

async function blockBatchRelease(batchId: string | null, block: boolean) {
  if (!batchId) return;
  try {
    await updateDoc(doc(firestore, OOS_COLLECTIONS.batches, batchId), {
      release_blocked: block,
      release_block_reason: block ? 'Critical OOS — batch release blocked' : null,
      updated_at: now(),
    });
  } catch { /* batch may not exist */ }
}

export async function createOosRecord(
  input: {
    oos_date: string; department: string; product_name: string; batch_number: string;
    test_name: string; test_method: string; stp_number: string; specification_number: string;
    parameter_name: string; spec_lower_limit: number; spec_upper_limit: number;
    observed_result: number; unit: string; is_critical_test?: boolean;
    target_closure_date?: string | null;
  },
  actor: OosActor,
  options?: { status?: string; source?: string; source_reference?: string; cpv_record_id?: string },
): Promise<OosRecord> {
  const resultStatus = computeResultStatus(input.observed_result, input.spec_lower_limit, input.spec_upper_limit);
  const critical = input.is_critical_test ?? isCriticalTest(input.test_name);
  const batchLink = await linkBatch(input.batch_number);
  const oosNumber = await generateOosNumber();
  const timestamp = now();
  const spec = buildLegacySpecification(input.spec_lower_limit, input.spec_upper_limit, input.unit);

  const isOos = resultStatus === 'OOS';
  const record: Omit<OosRecord, 'id'> = {
    oos_number: oosNumber,
    oos_date: input.oos_date,
    department: input.department,
    product_name: input.product_name,
    product_id: null,
    batch_number: input.batch_number,
    batch_id: batchLink.batch_id,
    test_name: input.test_name,
    test_method: input.test_method,
    stp_number: input.stp_number,
    specification_number: input.specification_number,
    parameter_name: input.parameter_name,
    spec_lower_limit: input.spec_lower_limit,
    spec_upper_limit: input.spec_upper_limit,
    observed_result: input.observed_result,
    unit: input.unit,
    result_status: resultStatus,
    test_parameter: input.parameter_name,
    specification: spec,
    obtained_result: String(input.observed_result),
    is_critical_test: critical,
    batch_release_blocked: isOos && critical,
    status: options?.status || (isOos ? 'submitted' : 'draft'),
    phase: 'phase1',
    capa_required: false,
    linked_capa_number: null,
    linked_capa_id: null,
    target_closure_date: input.target_closure_date || null,
    actual_closure_date: null,
    root_cause: '',
    source: (options?.source as OosRecord['source']) || 'manual',
    source_reference: options?.source_reference || null,
    cpv_record_id: options?.cpv_record_id || null,
    pqr_id: batchLink.pqr_id,
    assigned_to: null,
    assigned_to_name: null,
    created_by: actor.id,
    created_by_name: actor.name,
    created_at: timestamp,
    updated_by: actor.id,
    updated_by_name: actor.name,
    updated_at: timestamp,
  };

  const refDoc = await addDoc(collection(firestore, OOS_COLLECTIONS.records), record);
  await audit(actor, 'CREATE', refDoc.id, null, record);

  if (isOos) {
    await createPhase1Placeholder(refDoc.id, actor);
    await notifyOos('OOS Detected', `${oosNumber} — ${input.test_name} failed for batch ${input.batch_number}`, refDoc.id, ['qa_manager', 'qc_manager', 'head_qa']);
    if (critical && batchLink.batch_id) {
      await blockBatchRelease(batchLink.batch_id, true);
    }
  }

  return { id: refDoc.id, ...record };
}

async function createPhase1Placeholder(oosId: string, actor: OosActor) {
  const timestamp = now();
  await addDoc(collection(firestore, OOS_COLLECTIONS.phase1), {
    oos_id: oosId,
    analyst_name: '', instrument_used: '', instrument_calibration_status: '',
    standard_used: '', reagent_used: '',
    calculation_verified: false, data_review_completed: false,
    chromatogram_attached: false, raw_data_attached: false,
    investigation_findings: '', root_cause_identified: '', phase1_conclusion: '',
    phase1_outcome: 'Inconclusive',
    investigator_id: actor.id, investigator_name: actor.name,
    started_at: timestamp, completed_at: null,
    created_at: timestamp, updated_at: timestamp,
  });
}

export async function createOosFromCpv(
  cpvData: { id: string; product: string; batchNumber: string; parameter: string; observedValue: number; lower: number; upper: number; unit: string; status: string },
  actor: OosActor,
): Promise<OosRecord | null> {
  if (cpvData.status !== 'OOS') return null;
  const existing = await getDocs(query(
    collection(firestore, OOS_COLLECTIONS.records),
    where('cpv_record_id', '==', cpvData.id),
    limit(1),
  ));
  if (!existing.empty) return { id: existing.docs[0].id, ...existing.docs[0].data() } as OosRecord;

  return createOosRecord({
    oos_date: now().split('T')[0],
    department: 'QC',
    product_name: cpvData.product,
    batch_number: cpvData.batchNumber,
    test_name: cpvData.parameter,
    test_method: 'CPV Monitoring',
    stp_number: 'CPV-AUTO',
    specification_number: 'CPV-SPEC',
    parameter_name: cpvData.parameter,
    spec_lower_limit: cpvData.lower,
    spec_upper_limit: cpvData.upper,
    observed_result: cpvData.observedValue,
    unit: cpvData.unit,
    is_critical_test: isCriticalTest(cpvData.parameter),
  }, actor, { source: 'cpv_cqa', source_reference: cpvData.id, cpv_record_id: cpvData.id, status: 'submitted' });
}

export async function getOosById(id: string): Promise<OosRecord | null> {
  const snap = await getDoc(doc(firestore, OOS_COLLECTIONS.records, id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as OosRecord;
}

export async function listOosRecords(filters?: OosFilters): Promise<OosRecord[]> {
  const snap = await getDocs(query(
    collection(firestore, OOS_COLLECTIONS.records),
    orderBy('created_at', 'desc'),
    limit(1000),
  ));
  let results = snap.docs.map((d) => ({ id: d.id, ...d.data() } as OosRecord));

  if (filters?.status) results = results.filter((r) => r.status === filters.status);
  if (filters?.department) results = results.filter((r) => r.department === filters.department);
  if (filters?.product_name) {
    const q = filters.product_name.toLowerCase();
    results = results.filter((r) => r.product_name.toLowerCase().includes(q));
  }
  if (filters?.batch_number) results = results.filter((r) => r.batch_number.includes(filters.batch_number!));
  if (filters?.oos_number) results = results.filter((r) => r.oos_number.includes(filters.oos_number!));
  if (filters?.test_name) results = results.filter((r) => r.test_name.toLowerCase().includes(filters.test_name!.toLowerCase()));
  if (filters?.capa_linked !== undefined) {
    results = results.filter((r) => Boolean(r.linked_capa_number) === filters.capa_linked);
  }
  if (filters?.date_from) results = results.filter((r) => r.oos_date >= filters.date_from!);
  if (filters?.date_to) results = results.filter((r) => r.oos_date <= filters.date_to!);
  if (filters?.search) {
    const q = filters.search.toLowerCase();
    results = results.filter((r) =>
      r.oos_number.toLowerCase().includes(q) ||
      r.product_name.toLowerCase().includes(q) ||
      r.batch_number.toLowerCase().includes(q) ||
      r.test_name.toLowerCase().includes(q),
    );
  }

  return results.map(applyOverdueCheck);
}

function applyOverdueCheck(record: OosRecord): OosRecord {
  if (!record.target_closure_date || ['closed', 'approved'].includes(record.status)) return record;
  const today = new Date().toISOString().split('T')[0];
  if (record.target_closure_date < today && isOpenOosStatus(record.status)) {
    return { ...record, status: 'overdue' };
  }
  return record;
}

export async function updateOosRecord(
  id: string, updates: Partial<OosRecord>, actor: OosActor, options?: { workflow?: boolean },
): Promise<OosRecord> {
  const existing = await getOosById(id);
  if (!existing) throw new Error('OOS record not found');

  const workflowFields = new Set([
    'status', 'phase', 'root_cause', 'capa_required', 'linked_capa_number', 'linked_capa_id',
    'batch_release_blocked', 'actual_closure_date', 'assigned_to', 'assigned_to_name',
    'updated_by', 'updated_by_name', 'updated_at',
  ]);
  if (!options?.workflow && existing.status !== 'draft') {
    const keys = Object.keys(updates).filter((k) => !workflowFields.has(k));
    if (keys.length > 0) throw new Error('Only draft OOS records can be fully edited');
  }

  const payload: Partial<OosRecord> = {
    ...updates,
    updated_by: actor.id,
    updated_by_name: actor.name,
    updated_at: now(),
  };

  if (updates.observed_result !== undefined && updates.spec_lower_limit !== undefined && updates.spec_upper_limit !== undefined) {
    payload.result_status = computeResultStatus(updates.observed_result, updates.spec_lower_limit, updates.spec_upper_limit);
    payload.obtained_result = String(updates.observed_result);
  }

  await updateDoc(doc(firestore, OOS_COLLECTIONS.records, id), payload);
  await audit(actor, 'UPDATE', id, existing, { ...existing, ...payload });
  return { ...existing, ...payload } as OosRecord;
}

export async function submitOos(id: string, actor: OosActor): Promise<OosRecord> {
  const existing = await getOosById(id);
  if (!existing) throw new Error('OOS not found');
  if (existing.result_status !== 'OOS') throw new Error('Only OOS results can be submitted for investigation');
  const updated = await updateOosRecord(id, { status: 'phase1_investigation', phase: 'phase1' }, actor, { workflow: true });
  await audit(actor, 'SUBMIT', id, existing, updated);
  await notifyOos('OOS Submitted', `${existing.oos_number} submitted for Phase-I investigation`, id, ['qa_manager', 'qc_manager']);
  return updated;
}

export async function savePhase1(
  oosId: string,
  data: Omit<OosPhase1, 'id' | 'oos_id' | 'created_at' | 'updated_at'>,
  actor: OosActor,
): Promise<OosPhase1> {
  const timestamp = now();
  const existing = await getPhase1(oosId);
  let result: OosPhase1;

  if (existing?.id) {
    await updateDoc(doc(firestore, OOS_COLLECTIONS.phase1, existing.id), { ...data, updated_at: timestamp, completed_at: timestamp });
    result = { ...existing, ...data, updated_at: timestamp, completed_at: timestamp };
  } else {
    const ref = await addDoc(collection(firestore, OOS_COLLECTIONS.phase1), {
      oos_id: oosId, ...data, created_at: timestamp, updated_at: timestamp, completed_at: timestamp,
    });
    result = { id: ref.id, oos_id: oosId, ...data, created_at: timestamp, updated_at: timestamp, completed_at: timestamp };
  }

  const nextStatus = data.phase1_outcome === 'Laboratory Error' ? 'qa_review'
    : data.phase1_outcome === 'No Laboratory Error' ? 'phase2_investigation' : 'qa_review';

  await updateOosRecord(oosId, {
    root_cause: data.root_cause_identified,
    status: nextStatus,
    phase: data.phase1_outcome === 'No Laboratory Error' ? 'phase2' : 'phase1',
  }, actor, { workflow: true });
  await audit(actor, 'PHASE1_UPDATE', oosId, existing, result);
  return result;
}

export async function getPhase1(oosId: string): Promise<OosPhase1 | null> {
  const snap = await getDocs(query(collection(firestore, OOS_COLLECTIONS.phase1), where('oos_id', '==', oosId), limit(1)));
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() } as OosPhase1;
}

export async function savePhase2(
  oosId: string,
  data: Omit<OosPhase2, 'id' | 'oos_id' | 'created_at' | 'updated_at'>,
  actor: OosActor,
): Promise<OosPhase2> {
  const timestamp = now();
  const existing = await getPhase2(oosId);
  let result: OosPhase2;

  if (existing?.id) {
    await updateDoc(doc(firestore, OOS_COLLECTIONS.phase2, existing.id), { ...data, updated_at: timestamp, completed_at: timestamp });
    result = { ...existing, ...data, updated_at: timestamp, completed_at: timestamp };
  } else {
    const ref = await addDoc(collection(firestore, OOS_COLLECTIONS.phase2), {
      oos_id: oosId, ...data, created_at: timestamp, updated_at: timestamp, completed_at: timestamp,
    });
    result = { id: ref.id, oos_id: oosId, ...data, created_at: timestamp, updated_at: timestamp, completed_at: timestamp };
  }

  await updateOosRecord(oosId, {
    root_cause: data.root_cause,
    status: 'final_qa_review',
    phase: 'phase2',
  }, actor, { workflow: true });
  await audit(actor, 'PHASE2_UPDATE', oosId, existing, result);
  return result;
}

export async function getPhase2(oosId: string): Promise<OosPhase2 | null> {
  const snap = await getDocs(query(collection(firestore, OOS_COLLECTIONS.phase2), where('oos_id', '==', oosId), limit(1)));
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() } as OosPhase2;
}

export async function saveImpactAssessment(
  oosId: string,
  data: Omit<OosImpactAssessment, 'id' | 'oos_id' | 'created_at' | 'updated_at'>,
  actor: OosActor,
): Promise<OosImpactAssessment> {
  const timestamp = now();
  const existing = await getImpactAssessment(oosId);
  let result: OosImpactAssessment;

  if (existing?.id) {
    await updateDoc(doc(firestore, OOS_COLLECTIONS.impactAssessments, existing.id), { ...data, updated_at: timestamp });
    result = { ...existing, ...data, updated_at: timestamp };
  } else {
    const ref = await addDoc(collection(firestore, OOS_COLLECTIONS.impactAssessments), {
      oos_id: oosId, ...data, created_at: timestamp, updated_at: timestamp,
    });
    result = { id: ref.id, oos_id: oosId, ...data, created_at: timestamp, updated_at: timestamp };
  }
  await audit(actor, 'IMPACT_ASSESSMENT', oosId, existing, result);
  return result;
}

export async function getImpactAssessment(oosId: string): Promise<OosImpactAssessment | null> {
  const snap = await getDocs(query(collection(firestore, OOS_COLLECTIONS.impactAssessments), where('oos_id', '==', oosId), limit(1)));
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() } as OosImpactAssessment;
}

export async function linkCapa(
  oosId: string, capaNumber: string, capaId: string | null, capaStatus: string,
  targetDate: string | null, effectivenessCheck: string, actor: OosActor,
): Promise<OosCapaLink> {
  const timestamp = now();
  const link: Omit<OosCapaLink, 'id'> = {
    oos_id: oosId, capa_required: true, capa_number: capaNumber, capa_id: capaId,
    capa_status: capaStatus, target_date: targetDate, effectiveness_check: effectivenessCheck,
    linked_by: actor.id, linked_by_name: actor.name, linked_at: timestamp, created_at: timestamp,
  };
  const ref = await addDoc(collection(firestore, OOS_COLLECTIONS.capaLinks), link);
  await updateOosRecord(oosId, {
    linked_capa_number: capaNumber, linked_capa_id: capaId, capa_required: true, status: 'capa_required',
  }, actor, { workflow: true });
  await audit(actor, 'CAPA_LINK', oosId, null, link);
  return { id: ref.id, ...link };
}

export async function createCapaFromOos(oosId: string, actor: OosActor): Promise<{ capaNumber: string; capaId: string }> {
  const { createCapaFromOos: createFromOos } = await import('./capa-service');
  const record = await createFromOos(oosId, {
    id: actor.id,
    name: actor.name,
    role: actor.role,
  });
  await linkCapa(oosId, record.capa_number, record.id, record.capa_status, record.target_completion_date, record.effectiveness_criteria, actor);
  return { capaNumber: record.capa_number, capaId: record.id };
}

export async function getCapaLink(oosId: string): Promise<OosCapaLink | null> {
  const snap = await getDocs(query(collection(firestore, OOS_COLLECTIONS.capaLinks), where('oos_id', '==', oosId), limit(1)));
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() } as OosCapaLink;
}

export async function submitApproval(
  oosId: string,
  data: { decision: 'approved' | 'rejected'; comments: string; e_signature: string },
  actor: OosActor,
): Promise<OosApproval> {
  const oos = await getOosById(oosId);
  if (!oos) throw new Error('OOS not found');

  const isHeadQa = ['head_qa', 'super_admin'].includes(actor.role);
  const approvalLevel = isHeadQa ? 'final' : 'qa_review';
  const timestamp = now();

  const approval: Omit<OosApproval, 'id'> = {
    oos_id: oosId, approval_level: approvalLevel,
    approver_id: actor.id, approver_name: actor.name, approver_role: actor.role,
    decision: data.decision, comments: data.comments, e_signature: data.e_signature,
    signed_at: timestamp, created_at: timestamp,
  };
  const ref = await addDoc(collection(firestore, OOS_COLLECTIONS.approvals), approval);

  let newStatus = data.decision === 'rejected' ? 'rejected'
    : isHeadQa ? 'approved' : 'final_qa_review';

  await updateOosRecord(oosId, {
    status: newStatus,
    actual_closure_date: data.decision === 'approved' && isHeadQa ? timestamp.split('T')[0] : null,
    batch_release_blocked: data.decision === 'approved' && isHeadQa ? false : oos.batch_release_blocked,
  }, actor, { workflow: true });

  if (data.decision === 'approved' && isHeadQa && oos.batch_id) {
    await blockBatchRelease(oos.batch_id, false);
  }

  await audit(actor, data.decision === 'approved' ? 'APPROVE' : 'REJECT', oosId, null, approval);
  return { id: ref.id, ...approval };
}

export async function closeOos(id: string, actor: OosActor): Promise<OosRecord> {
  const updated = await updateOosRecord(id, { status: 'closed', actual_closure_date: now().split('T')[0] }, actor, { workflow: true });
  await audit(actor, 'CLOSE', id, null, updated);
  return updated;
}

export async function getApprovals(oosId: string): Promise<OosApproval[]> {
  try {
    const snap = await getDocs(query(collection(firestore, OOS_COLLECTIONS.approvals), where('oos_id', '==', oosId), orderBy('created_at', 'desc')));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as OosApproval));
  } catch {
    const snap = await getDocs(query(collection(firestore, OOS_COLLECTIONS.approvals), where('oos_id', '==', oosId)));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as OosApproval));
  }
}

export async function uploadAttachment(
  oosId: string, file: File, category: OosAttachment['category'], actor: OosActor,
): Promise<OosAttachment> {
  const path = `oos/${oosId}/${Date.now()}_${file.name}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  const fileUrl = await getDownloadURL(storageRef);
  const timestamp = now();
  const attachment: Omit<OosAttachment, 'id'> = {
    oos_id: oosId, file_name: file.name, file_url: fileUrl, file_type: file.type,
    file_size: file.size, category, uploaded_by: actor.id, uploaded_by_name: actor.name, uploaded_at: timestamp,
  };
  const ref2 = await addDoc(collection(firestore, OOS_COLLECTIONS.attachments), attachment);
  await audit(actor, 'ATTACHMENT_UPLOAD', oosId, null, { file_name: file.name, category });
  return { id: ref2.id, ...attachment };
}

export async function getAttachments(oosId: string): Promise<OosAttachment[]> {
  const snap = await getDocs(query(collection(firestore, OOS_COLLECTIONS.attachments), where('oos_id', '==', oosId)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as OosAttachment));
}

export async function deleteAttachment(attachmentId: string, actor: OosActor): Promise<void> {
  const snap = await getDoc(doc(firestore, OOS_COLLECTIONS.attachments, attachmentId));
  if (!snap.exists()) return;
  const data = snap.data() as OosAttachment;
  await deleteDoc(doc(firestore, OOS_COLLECTIONS.attachments, attachmentId));
  await audit(actor, 'ATTACHMENT_DELETE', data.oos_id, data, null);
}

export async function getAuditLogsForOos(oosId: string) {
  try {
    const snap = await getDocs(query(
      collection(firestore, OOS_COLLECTIONS.auditLogs),
      where('recordId', '==', oosId), where('module', '==', 'OOS'),
      orderBy('dateTime', 'desc'), limit(100),
    ));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch {
    const snap = await getDocs(query(collection(firestore, OOS_COLLECTIONS.auditLogs), where('recordId', '==', oosId)));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }
}

export function computeOosDashboardMetrics(records: OosRecord[], phase1Records: OosPhase1[]): OosDashboardMetrics {
  const checked = records.map(applyOverdueCheck);
  const deptMap = new Map<string, number>();
  const prodMap = new Map<string, number>();
  const rcMap = new Map<string, number>();
  const monthMap = new Map<string, number>();
  const closureMap = new Map<string, { open: number; closed: number }>();

  const phase1ByOos = new Map(phase1Records.map((p) => [p.oos_id, p]));

  for (const r of checked) {
    deptMap.set(r.department, (deptMap.get(r.department) || 0) + 1);
    prodMap.set(r.product_name, (prodMap.get(r.product_name) || 0) + 1);
    const p1 = phase1ByOos.get(r.id);
    if (p1?.phase1_outcome) rcMap.set(p1.phase1_outcome, (rcMap.get(p1.phase1_outcome) || 0) + 1);
    const month = r.oos_date?.slice(0, 7) || '';
    monthMap.set(month, (monthMap.get(month) || 0) + 1);
    const ct = closureMap.get(month) || { open: 0, closed: 0 };
    if (isOpenOosStatus(r.status)) ct.open++; else if (['closed', 'approved'].includes(r.status)) ct.closed++;
    closureMap.set(month, ct);
  }

  const toSorted = (m: Map<string, number>) =>
    Array.from(m.entries()).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);

  return {
    total: checked.length,
    open: checked.filter((r) => isOpenOosStatus(r.status)).length,
    closed: checked.filter((r) => ['closed', 'approved'].includes(r.status)).length,
    critical: checked.filter((r) => r.is_critical_test && r.result_status === 'OOS').length,
    capaLinked: checked.filter((r) => Boolean(r.linked_capa_number)).length,
    overdue: checked.filter((r) => r.status === 'overdue').length,
    monthlyTrend: Array.from(monthMap.entries()).map(([month, count]) => ({ month, count })).sort((a, b) => a.month.localeCompare(b.month)),
    byDepartment: toSorted(deptMap),
    byProduct: toSorted(prodMap).slice(0, 10),
    rootCauseTrend: toSorted(rcMap),
    closureTrend: Array.from(closureMap.entries()).map(([month, v]) => ({ month, ...v })).sort((a, b) => a.month.localeCompare(b.month)),
  };
}

export async function syncOverdueOos(): Promise<number> {
  const records = await listOosRecords();
  const today = new Date().toISOString().split('T')[0];
  let count = 0;
  const batch = writeBatch(firestore);
  for (const r of records) {
    if (r.target_closure_date && r.target_closure_date < today && isOpenOosStatus(r.status) && r.status !== 'overdue') {
      batch.update(doc(firestore, OOS_COLLECTIONS.records, r.id), { status: 'overdue', updated_at: now() });
      count++;
    }
  }
  if (count > 0) await batch.commit();
  return count;
}

export function exportOosCsv(records: OosRecord[]) {
  downloadCsv(
    `oos_${new Date().toISOString().split('T')[0]}.csv`,
    ['OOS No.', 'Date', 'Department', 'Product', 'Batch', 'Test', 'Result', 'Status', 'CAPA', 'Critical'],
    records.map((r) => [
      r.oos_number, r.oos_date, r.department, r.product_name, r.batch_number,
      r.test_name, r.obtained_result, r.status, r.linked_capa_number || '—', r.is_critical_test ? 'Yes' : 'No',
    ]),
  );
}

export function canUserAccessOos(
  action: 'view' | 'create' | 'phase1' | 'phase2' | 'approve' | 'close',
  role: string,
): boolean {
  const r = role.toLowerCase();
  if (['super_admin', 'admin'].includes(r)) return true;
  if (r === 'auditor' || r === 'viewer') return action === 'view';
  if (['head_qa', 'qa_manager', 'qa'].includes(r)) return ['view', 'approve', 'close'].includes(action);
  if (['qc_manager', 'qc'].includes(r)) return ['view', 'create', 'phase1'].includes(action);
  if (['production_manager', 'production'].includes(r)) return ['view', 'phase2'].includes(action);
  return action === 'view';
}
