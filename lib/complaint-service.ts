import {
  addDoc, collection, doc, getDoc, getDocs, limit, orderBy, query, updateDoc, where,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { firestore, storage } from '@/lib/firebase';
import { logAuditEvent } from '@/lib/admin/admin-service';
import { downloadCsv } from '@/lib/export-utils';
import { createCapa } from '@/lib/capa-service';
import type { CapaRecord } from '@/lib/capa-types';
import {
  COMPLAINT_COLLECTIONS, type ComplaintRecord, type ComplaintInvestigation,
  type ComplaintAttachment, type ComplaintFilters, type ComplaintDashboardMetrics,
  type ComplaintActor, isComplaintClosed, isSafetyCategory,
} from './complaint-types';
import type { ComplaintCreateInput, InvestigationInput } from './complaint-schemas';

function now() { return new Date().toISOString(); }

async function audit(actor: ComplaintActor, action: string, recordId: string, oldValue: unknown, newValue: unknown, reason = '') {
  await logAuditEvent({
    userId: actor.id, userName: actor.name, module: 'Complaint', recordId, action,
    oldValue: oldValue ? JSON.stringify(oldValue) : '',
    newValue: newValue ? JSON.stringify(newValue) : '',
    reason, ipAddress: 'client', device: typeof navigator !== 'undefined' ? navigator.userAgent : 'server',
    status: 'Success',
  });
}

async function notify(title: string, message: string, recordId: string, roles: string[]) {
  try {
    for (const role of roles) {
      await addDoc(collection(firestore, COMPLAINT_COLLECTIONS.notifications), {
        title, message, module: 'Complaint', record_id: recordId, target_role: role,
        read: false, created_at: now(),
      });
    }
  } catch (e) { console.error('Notification failed:', e); }
}

export async function generateComplaintNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `CMP-${year}-`;
  try {
    const snap = await getDocs(query(
      collection(firestore, COMPLAINT_COLLECTIONS.records),
      where('complaint_number', '>=', prefix),
      where('complaint_number', '<=', `${prefix}\uf8ff`),
      orderBy('complaint_number', 'desc'),
      limit(1),
    ));
    if (!snap.empty) {
      const last = snap.docs[0].data().complaint_number as string;
      return `${prefix}${String(parseInt(last.split('-').pop() || '0', 10) + 1).padStart(4, '0')}`;
    }
  } catch {
    const all = await getDocs(collection(firestore, COMPLAINT_COLLECTIONS.records));
    return `${prefix}${String(all.size + 1).padStart(4, '0')}`;
  }
  return `${prefix}0001`;
}

async function linkBatch(batchNumber: string) {
  if (!batchNumber) return { batch_id: null, pqr_id: null };
  try {
    const snap = await getDocs(query(
      collection(firestore, COMPLAINT_COLLECTIONS.batches),
      where('batch_number', '==', batchNumber),
      limit(1),
    ));
    if (snap.empty) return { batch_id: null, pqr_id: null };
    const data = snap.docs[0].data();
    return { batch_id: snap.docs[0].id, pqr_id: (data.pqr_id as string) || null };
  } catch {
    return { batch_id: null, pqr_id: null };
  }
}

export async function createComplaint(input: ComplaintCreateInput, actor: ComplaintActor): Promise<ComplaintRecord> {
  const complaintNumber = await generateComplaintNumber();
  const timestamp = now();
  const batchLink = await linkBatch(input.batch_number);
  const safetyImpact = input.product_safety_impact || isSafetyCategory(input.complaint_category);

  const record: Omit<ComplaintRecord, 'id'> = {
    complaint_number: complaintNumber,
    complaint_date: input.complaint_date,
    received_from: input.received_from,
    customer_name: input.customer_name,
    customer_contact: input.customer_contact || '',
    market_region: input.market_region,
    product_name: input.product_name,
    batch_number: input.batch_number,
    mfg_date: input.mfg_date || '',
    exp_date: input.exp_date || '',
    complaint_category: input.complaint_category,
    complaint_description: input.complaint_description,
    sample_received: input.sample_received,
    retain_sample_required: input.retain_sample_required,
    complaint_criticality: input.complaint_criticality,
    initial_assessment: input.initial_assessment || '',
    investigation_required: input.investigation_required,
    product_safety_impact: safetyImpact,
    root_cause: '',
    impact_assessment: '',
    capa_required: false,
    linked_capa_id: null,
    linked_capa_number: null,
    linked_recall_id: null,
    linked_recall_number: null,
    closure_date: null,
    status: 'draft',
    qa_remarks: input.qa_remarks || '',
    batch_id: batchLink.batch_id,
    pqr_id: batchLink.pqr_id,
    created_by: actor.id,
    created_by_name: actor.name,
    updated_by: actor.id,
    updated_by_name: actor.name,
    created_at: timestamp,
    updated_at: timestamp,
  };

  const refDoc = await addDoc(collection(firestore, COMPLAINT_COLLECTIONS.records), record);
  await audit(actor, 'CREATE', refDoc.id, null, record);

  if (input.complaint_criticality === 'Critical') {
    await notify('Critical Complaint', `Critical complaint ${complaintNumber} registered — immediate Head QA review required`, refDoc.id, ['head_qa', 'qa']);
  }

  return { id: refDoc.id, ...record };
}

export async function getComplaintById(id: string): Promise<ComplaintRecord | null> {
  const snap = await getDoc(doc(firestore, COMPLAINT_COLLECTIONS.records, id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as ComplaintRecord;
}

export async function listComplaints(filters?: ComplaintFilters): Promise<ComplaintRecord[]> {
  try {
    const snap = await getDocs(query(
      collection(firestore, COMPLAINT_COLLECTIONS.records),
      orderBy('updated_at', 'desc'),
      limit(1000),
    ));
    return applyFilters(snap.docs.map((d) => ({ id: d.id, ...d.data() } as ComplaintRecord)), filters);
  } catch {
    const snap = await getDocs(collection(firestore, COMPLAINT_COLLECTIONS.records));
    return applyFilters(snap.docs.map((d) => ({ id: d.id, ...d.data() } as ComplaintRecord)), filters);
  }
}

function applyFilters(records: ComplaintRecord[], filters?: ComplaintFilters): ComplaintRecord[] {
  let r = records;
  if (filters?.status && filters.status !== 'all') r = r.filter((x) => x.status === filters.status);
  if (filters?.complaint_category && filters.complaint_category !== 'all') r = r.filter((x) => x.complaint_category === filters.complaint_category);
  if (filters?.complaint_criticality && filters.complaint_criticality !== 'all') r = r.filter((x) => x.complaint_criticality === filters.complaint_criticality);
  if (filters?.product) r = r.filter((x) => x.product_name.toLowerCase().includes(filters.product!.toLowerCase()));
  if (filters?.batch_number) r = r.filter((x) => x.batch_number.includes(filters.batch_number!));
  if (filters?.market_region) r = r.filter((x) => x.market_region.toLowerCase().includes(filters.market_region!.toLowerCase()));
  if (filters?.date_from) r = r.filter((x) => x.complaint_date >= filters.date_from!);
  if (filters?.date_to) r = r.filter((x) => x.complaint_date <= filters.date_to!);
  if (filters?.search) {
    const s = filters.search.toLowerCase();
    r = r.filter((x) =>
      x.complaint_number.toLowerCase().includes(s)
      || x.product_name.toLowerCase().includes(s)
      || x.customer_name.toLowerCase().includes(s),
    );
  }
  return r;
}

export async function updateComplaint(
  id: string, patch: Partial<ComplaintRecord>, actor: ComplaintActor, workflow = false,
): Promise<ComplaintRecord> {
  const existing = await getComplaintById(id);
  if (!existing) throw new Error('Complaint not found');
  if (!workflow && existing.status !== 'draft') throw new Error('Only draft complaints can be edited');
  const payload = { ...patch, updated_by: actor.id, updated_by_name: actor.name, updated_at: now() };
  await updateDoc(doc(firestore, COMPLAINT_COLLECTIONS.records, id), payload);
  await audit(actor, 'UPDATE', id, existing, { ...existing, ...payload });
  return { ...existing, ...payload } as ComplaintRecord;
}

export async function submitComplaint(id: string, actor: ComplaintActor): Promise<ComplaintRecord> {
  const complaint = await getComplaintById(id);
  if (!complaint || complaint.status !== 'draft') throw new Error('Only draft complaints can be submitted');
  const updated = await updateComplaint(id, { status: 'received' }, actor, true);
  if (complaint.product_safety_impact) {
    await createRecallEvaluationTask(complaint, actor);
  }
  return updated;
}

async function createRecallEvaluationTask(complaint: ComplaintRecord, actor: ComplaintActor) {
  const { createRecall } = await import('./recall-service');
  const recall = await createRecall({
    recall_date: now().split('T')[0],
    recall_type: 'Voluntary',
    recall_classification: complaint.complaint_criticality === 'Critical' ? 'Class I' : 'Class II',
    product_name: complaint.product_name,
    batch_number: complaint.batch_number,
    market_region: complaint.market_region,
    reason_for_recall: `Recall evaluation from complaint ${complaint.complaint_number}: ${complaint.complaint_description.slice(0, 200)}`,
    recall_initiated_by_name: actor.name,
    regulatory_notification_required: complaint.complaint_criticality === 'Critical',
    stock_quantity: 0,
    distributed_quantity: 0,
    recovered_quantity: 0,
    impact_assessment: complaint.initial_assessment,
    risk_assessment: '',
    capa_required: false,
    linked_complaint_id: complaint.id,
    qa_remarks: 'Auto-generated recall evaluation task from product safety complaint',
  }, actor, { status: 'draft', fromComplaint: true });

  await updateDoc(doc(firestore, COMPLAINT_COLLECTIONS.records, complaint.id), {
    linked_recall_id: recall.id,
    linked_recall_number: recall.recall_number,
    updated_at: now(),
  });
  await notify('Recall Evaluation Required', `Recall evaluation ${recall.recall_number} created from complaint ${complaint.complaint_number}`, complaint.id, ['qa', 'head_qa', 'regulatory_affairs']);
}

export async function saveInvestigation(
  complaintId: string, data: InvestigationInput, actor: ComplaintActor,
): Promise<ComplaintInvestigation> {
  const timestamp = now();
  const existing = await getInvestigation(complaintId);
  const payload = {
    complaint_id: complaintId,
    ...data,
    investigated_by: actor.id,
    investigated_by_name: actor.name,
    investigated_at: timestamp,
    updated_at: timestamp,
  };

  let refId: string;
  if (existing) {
    await updateDoc(doc(firestore, COMPLAINT_COLLECTIONS.investigations, existing.id), payload);
    refId = existing.id;
  } else {
    const ref = await addDoc(collection(firestore, COMPLAINT_COLLECTIONS.investigations), { ...payload, created_at: timestamp });
    refId = ref.id;
  }

  const status = data.capa_required ? 'capa_required' : 'qa_review';
  await updateComplaint(complaintId, {
    status,
    root_cause: data.root_cause,
    impact_assessment: data.impact_assessment,
    capa_required: data.capa_required,
  }, actor, true);

  if (data.capa_required) {
    await createCapaFromComplaint(complaintId, actor);
  }

  await audit(actor, 'INVESTIGATION', complaintId, null, payload);
  return { id: refId, ...payload, created_at: existing?.created_at || timestamp } as ComplaintInvestigation;
}

export async function getInvestigation(complaintId: string): Promise<ComplaintInvestigation | null> {
  const snap = await getDocs(query(
    collection(firestore, COMPLAINT_COLLECTIONS.investigations),
    where('complaint_id', '==', complaintId),
    limit(1),
  ));
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() } as ComplaintInvestigation;
}

export async function createCapaFromComplaint(complaintId: string, actor: ComplaintActor): Promise<CapaRecord> {
  const complaint = await getComplaintById(complaintId);
  if (!complaint) throw new Error('Complaint not found');
  if (complaint.linked_capa_id) {
    const { getCapaById } = await import('@/lib/capa-service');
    const existing = await getCapaById(complaint.linked_capa_id);
    if (existing) return existing;
  }

  const capa = await createCapa({
    capa_date: now().split('T')[0],
    capa_source: 'Market Complaint',
    source_reference_number: complaint.complaint_number,
    department: 'QA',
    product_name: complaint.product_name,
    batch_number: complaint.batch_number,
    capa_title: `CAPA from Complaint ${complaint.complaint_number}`,
    problem_description: complaint.complaint_description,
    root_cause: complaint.root_cause,
    corrective_action: '',
    preventive_action: '',
    action_owner: actor.name,
    action_owner_name: actor.name,
    target_completion_date: new Date(Date.now() + 90 * 86400000).toISOString().split('T')[0],
    effectiveness_check_required: true,
    effectiveness_criteria: 'No repeat complaint for same root cause within 12 months',
    priority: complaint.complaint_criticality === 'Critical' ? 'critical' : complaint.complaint_criticality === 'Major' ? 'high' : 'medium',
    qa_remarks: complaint.qa_remarks,
  }, actor, { status: 'submitted' });

  await updateDoc(doc(firestore, COMPLAINT_COLLECTIONS.records, complaintId), {
    linked_capa_id: capa.id,
    linked_capa_number: capa.capa_number,
    capa_required: true,
    status: 'capa_required',
    updated_at: now(),
  });

  await audit(actor, 'CAPA_LINK', complaintId, null, { capa_number: capa.capa_number });
  return capa;
}

export async function closeComplaint(id: string, actor: ComplaintActor, qaRemarks?: string): Promise<ComplaintRecord> {
  const complaint = await getComplaintById(id);
  if (!complaint) throw new Error('Complaint not found');
  if (complaint.capa_required && !complaint.linked_capa_id) {
    throw new Error('CAPA must be linked before closure');
  }
  return updateComplaint(id, {
    status: 'closed',
    closure_date: now().split('T')[0],
    qa_remarks: qaRemarks || complaint.qa_remarks,
  }, actor, true);
}

export async function syncOverdueComplaints(): Promise<number> {
  const records = await listComplaints();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  const cutoffStr = cutoff.toISOString().split('T')[0];
  let count = 0;
  for (const r of records) {
    if (isComplaintClosed(r.status) || r.status === 'overdue') continue;
    if (r.complaint_date < cutoffStr && !['closed', 'qa_review'].includes(r.status)) {
      await updateDoc(doc(firestore, COMPLAINT_COLLECTIONS.records, r.id), { status: 'overdue', updated_at: now() });
      count++;
    }
  }
  return count;
}

export async function getAttachments(complaintId: string): Promise<ComplaintAttachment[]> {
  const snap = await getDocs(query(collection(firestore, COMPLAINT_COLLECTIONS.attachments), where('complaint_id', '==', complaintId)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as ComplaintAttachment));
}

export async function uploadAttachment(complaintId: string, file: File, actor: ComplaintActor): Promise<ComplaintAttachment> {
  const path = `complaints/${complaintId}/${Date.now()}_${file.name}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  const url = await getDownloadURL(storageRef);
  const timestamp = now();
  const attachment: Omit<ComplaintAttachment, 'id'> = {
    complaint_id: complaintId, file_name: file.name, file_url: url, file_type: file.type,
    uploaded_by: actor.id, uploaded_by_name: actor.name, uploaded_at: timestamp,
  };
  const refDoc = await addDoc(collection(firestore, COMPLAINT_COLLECTIONS.attachments), attachment);
  await audit(actor, 'ATTACHMENT_UPLOAD', complaintId, null, { file_name: file.name });
  return { id: refDoc.id, ...attachment };
}

export async function getAuditLogsForComplaint(complaintId: string) {
  const snap = await getDocs(query(collection(firestore, COMPLAINT_COLLECTIONS.auditLogs), where('recordId', '==', complaintId), limit(100)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export function computeDashboardMetrics(records: ComplaintRecord[]): ComplaintDashboardMetrics {
  return {
    total: records.length,
    open: records.filter((r) => !isComplaintClosed(r.status)).length,
    closed: records.filter((r) => r.status === 'closed').length,
    critical: records.filter((r) => r.complaint_criticality === 'Critical').length,
    capaLinked: records.filter((r) => r.linked_capa_id).length,
    overdue: records.filter((r) => r.status === 'overdue').length,
  };
}

export function complaintChartData(records: ComplaintRecord[]) {
  const byProduct = new Map<string, number>();
  const byCategory = new Map<string, number>();
  const byMonth = new Map<string, number>();
  const byMarket = new Map<string, number>();

  records.forEach((r) => {
    byProduct.set(r.product_name, (byProduct.get(r.product_name) || 0) + 1);
    byCategory.set(r.complaint_category, (byCategory.get(r.complaint_category) || 0) + 1);
    byMonth.set(r.complaint_date.slice(0, 7), (byMonth.get(r.complaint_date.slice(0, 7)) || 0) + 1);
    byMarket.set(r.market_region, (byMarket.get(r.market_region) || 0) + 1);
  });

  return {
    byProduct: Array.from(byProduct.entries()).map(([name, value]) => ({ name, value })),
    byCategory: Array.from(byCategory.entries()).map(([name, value]) => ({ name, value })),
    monthlyTrend: Array.from(byMonth.entries()).map(([month, count]) => ({ month, count })).sort((a, b) => a.month.localeCompare(b.month)),
    byMarket: Array.from(byMarket.entries()).map(([name, value]) => ({ name, value })),
  };
}

export function exportComplaintsCsv(records: ComplaintRecord[]) {
  downloadCsv('complaints.csv',
    ['Number', 'Date', 'Product', 'Batch', 'Category', 'Criticality', 'Status', 'Customer'],
    records.map((r) => [
      r.complaint_number, r.complaint_date, r.product_name, r.batch_number,
      r.complaint_category, r.complaint_criticality, r.status, r.customer_name,
    ]),
  );
}
