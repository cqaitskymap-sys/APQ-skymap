import {
  addDoc, collection, doc, getDoc, getDocs, limit, orderBy, query, updateDoc, where,
  type QueryConstraint,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { firestore, storage } from '@/lib/firebase';
import { logAuditEvent } from '@/lib/admin/admin-service';
import { createCapa } from '@/lib/capa-service';
import { downloadCsv } from '@/lib/export-utils';
import {
  AUDIT_COLLECTIONS, calculateRpn, rpnToLevel, isFindingOverdue,
  type AuditRecord, type AuditChecklistItem, type AuditFinding, type AuditCapaLink,
  type AuditApproval, type AuditAttachment, type AuditScheduleEntry,
  type AuditFilters, type AuditDashboardMetrics, type AuditActor,
} from './audit-mgmt-types';
import type {
  AuditCreateInput, ChecklistItemInput, FindingInput, ScheduleInput, ApprovalInput,
} from './audit-mgmt-schemas';

function now() { return new Date().toISOString(); }

async function audit(actor: AuditActor, action: string, recordId: string, oldValue: unknown, newValue: unknown, reason = '') {
  await logAuditEvent({
    userId: actor.id, userName: actor.name, module: 'Audit', recordId, action,
    oldValue: oldValue ? JSON.stringify(oldValue) : '',
    newValue: newValue ? JSON.stringify(newValue) : '',
    reason, ipAddress: 'client', device: typeof navigator !== 'undefined' ? navigator.userAgent : 'server',
    status: 'Success',
  });
}

async function notify(title: string, message: string, recordId: string, roles: string[]) {
  try {
    for (const role of roles) {
      await addDoc(collection(firestore, AUDIT_COLLECTIONS.notifications), {
        title, message, module: 'Audit', record_id: recordId, target_role: role,
        read: false, created_at: now(),
      });
    }
  } catch (e) { console.error('Notification failed:', e); }
}

export async function generateAuditNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `AUD-${year}-`;
  try {
    const snap = await getDocs(query(
      collection(firestore, AUDIT_COLLECTIONS.audits),
      where('audit_number', '>=', prefix),
      where('audit_number', '<=', `${prefix}\uf8ff`),
      orderBy('audit_number', 'desc'),
      limit(1),
    ));
    if (!snap.empty) {
      const last = snap.docs[0].data().audit_number as string;
      return `${prefix}${String(parseInt(last.split('-').pop() || '0', 10) + 1).padStart(4, '0')}`;
    }
  } catch {
    const all = await getDocs(collection(firestore, AUDIT_COLLECTIONS.audits));
    return `${prefix}${String(all.size + 1).padStart(4, '0')}`;
  }
  return `${prefix}0001`;
}

async function generateFindingNumber(auditNumber: string): Promise<string> {
  const prefix = `${auditNumber}-F`;
  const snap = await getDocs(query(
    collection(firestore, AUDIT_COLLECTIONS.findings),
    where('audit_number', '==', auditNumber),
  ));
  return `${prefix}${String(snap.size + 1).padStart(3, '0')}`;
}

async function generateChecklistNumber(auditId: string, auditNumber: string): Promise<string> {
  const snap = await getDocs(query(
    collection(firestore, AUDIT_COLLECTIONS.checklists),
    where('audit_id', '==', auditId),
  ));
  return `${auditNumber}-CL${String(snap.size + 1).padStart(3, '0')}`;
}

// ─── Audits CRUD ─────────────────────────────────────────────────────────────

export async function createAudit(input: AuditCreateInput, actor: AuditActor): Promise<AuditRecord> {
  const auditNumber = await generateAuditNumber();
  const timestamp = now();
  const record: Omit<AuditRecord, 'id'> = {
    audit_number: auditNumber,
    audit_type: input.audit_type,
    audit_title: input.audit_title,
    department: input.department,
    audit_scope: input.audit_scope,
    audit_criteria: input.audit_criteria,
    audit_date: input.audit_date,
    audit_start_time: input.audit_start_time,
    audit_end_time: input.audit_end_time,
    lead_auditor: actor.id,
    lead_auditor_name: input.lead_auditor_name,
    auditor_team: input.auditor_team,
    auditee: input.auditee,
    status: 'planned',
    remarks: input.remarks,
    total_findings: 0,
    critical_findings: 0,
    capa_required_count: 0,
    linked_pqr_id: input.linked_pqr_id || null,
    created_by: actor.id,
    created_by_name: actor.name,
    updated_by: actor.id,
    updated_by_name: actor.name,
    created_at: timestamp,
    updated_at: timestamp,
  };
  const refDoc = await addDoc(collection(firestore, AUDIT_COLLECTIONS.audits), record);
  await audit(actor, 'CREATE', refDoc.id, null, record);
  return { id: refDoc.id, ...record };
}

export async function getAuditById(id: string): Promise<AuditRecord | null> {
  const snap = await getDoc(doc(firestore, AUDIT_COLLECTIONS.audits, id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as AuditRecord;
}

export async function listAudits(filters?: AuditFilters): Promise<AuditRecord[]> {
  const constraints: QueryConstraint[] = [orderBy('updated_at', 'desc')];
  if (filters?.status) constraints.unshift(where('status', '==', filters.status));
  if (filters?.audit_type) constraints.unshift(where('audit_type', '==', filters.audit_type));
  if (filters?.department) constraints.unshift(where('department', '==', filters.department));

  let records: AuditRecord[];
  try {
    const snap = await getDocs(query(collection(firestore, AUDIT_COLLECTIONS.audits), ...constraints));
    records = snap.docs.map((d) => ({ id: d.id, ...d.data() } as AuditRecord));
  } catch {
    const snap = await getDocs(collection(firestore, AUDIT_COLLECTIONS.audits));
    records = snap.docs.map((d) => ({ id: d.id, ...d.data() } as AuditRecord));
  }

  if (filters?.search) {
    const q = filters.search.toLowerCase();
    records = records.filter((r) =>
      r.audit_number.toLowerCase().includes(q) || r.audit_title.toLowerCase().includes(q),
    );
  }
  return records;
}

export async function updateAudit(id: string, input: Partial<AuditCreateInput & { status?: string }>, actor: AuditActor): Promise<AuditRecord> {
  const existing = await getAuditById(id);
  if (!existing) throw new Error('Audit not found');
  const updates = { ...input, updated_by: actor.id, updated_by_name: actor.name, updated_at: now() };
  await updateDoc(doc(firestore, AUDIT_COLLECTIONS.audits, id), updates);
  await audit(actor, 'EDIT', id, existing, updates);
  return { ...existing, ...updates } as AuditRecord;
}

export async function scheduleAudit(id: string, actor: AuditActor): Promise<AuditRecord> {
  const existing = await getAuditById(id);
  if (!existing) throw new Error('Audit not found');
  const updates = { status: 'scheduled', updated_by: actor.id, updated_by_name: actor.name, updated_at: now() };
  await updateDoc(doc(firestore, AUDIT_COLLECTIONS.audits, id), updates);
  await audit(actor, 'SCHEDULE', id, existing, updates);
  await notify('Audit Scheduled', `${existing.audit_number} scheduled for ${existing.audit_date}`, id, ['qa_manager', 'head_qa']);
  return { ...existing, ...updates };
}

export async function startAudit(id: string, actor: AuditActor): Promise<AuditRecord> {
  return updateAudit(id, { status: 'in_progress' }, actor);
}

export async function closeAudit(id: string, actor: AuditActor, comments = ''): Promise<AuditRecord> {
  const existing = await getAuditById(id);
  if (!existing) throw new Error('Audit not found');
  const updates = { status: 'closed', updated_by: actor.id, updated_by_name: actor.name, updated_at: now() };
  await updateDoc(doc(firestore, AUDIT_COLLECTIONS.audits, id), updates);
  await audit(actor, 'CLOSURE', id, existing, updates, comments);
  return { ...existing, ...updates };
}

// ─── Schedule / Planner ────────────────────────────────────────────────────────

export async function createScheduleEntry(input: ScheduleInput, actor: AuditActor): Promise<AuditScheduleEntry> {
  const entry: Omit<AuditScheduleEntry, 'id'> = {
    audit_id: null,
    audit_number: '',
    audit_title: input.audit_title,
    audit_type: input.audit_type,
    department: input.department,
    planned_date: input.planned_date,
    lead_auditor_name: input.lead_auditor_name,
    status: 'planned',
    created_at: now(),
  };
  const refDoc = await addDoc(collection(firestore, AUDIT_COLLECTIONS.schedule), entry);
  await audit(actor, 'PLAN', refDoc.id, null, entry);
  return { id: refDoc.id, ...entry };
}

export async function listSchedule(): Promise<AuditScheduleEntry[]> {
  try {
    const snap = await getDocs(query(collection(firestore, AUDIT_COLLECTIONS.schedule), orderBy('planned_date', 'asc')));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as AuditScheduleEntry));
  } catch {
    const snap = await getDocs(collection(firestore, AUDIT_COLLECTIONS.schedule));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as AuditScheduleEntry));
  }
}

// ─── Checklist ───────────────────────────────────────────────────────────────

export async function addChecklistItem(auditId: string, input: ChecklistItemInput, actor: AuditActor): Promise<AuditChecklistItem> {
  const auditRecord = await getAuditById(auditId);
  if (!auditRecord) throw new Error('Audit not found');

  const checklistNumber = await generateChecklistNumber(auditId, auditRecord.audit_number);
  const timestamp = now();
  const item: Omit<AuditChecklistItem, 'id'> = {
    audit_id: auditId,
    checklist_number: checklistNumber,
    audit_area: input.audit_area,
    checklist_question: input.checklist_question,
    requirement_reference: input.requirement_reference,
    expected_evidence: input.expected_evidence,
    observation: input.observation,
    compliance_status: input.compliance_status,
    auditor_remarks: input.auditor_remarks,
    created_by: actor.id,
    created_by_name: actor.name,
    created_at: timestamp,
    updated_at: timestamp,
  };

  const refDoc = await addDoc(collection(firestore, AUDIT_COLLECTIONS.checklists), item);
  await audit(actor, 'CHECKLIST_UPDATE', auditId, null, item);

  if (input.compliance_status === 'Non-Compliant') {
    await createFindingFromChecklist(auditId, auditRecord, input, actor);
  }

  return { id: refDoc.id, ...item };
}

async function createFindingFromChecklist(
  auditId: string, auditRecord: AuditRecord, input: ChecklistItemInput, actor: AuditActor,
) {
  await createFinding(auditId, {
    finding_type: 'Minor',
    finding_category: 'GMP',
    department: auditRecord.department,
    observation: input.observation || input.checklist_question,
    requirement_reference: input.requirement_reference,
    evidence: input.expected_evidence,
    severity: 3, occurrence: 3, detectability: 3,
    root_cause: '', correction: '', capa_required: false,
    responsible_person_name: auditRecord.auditee,
    target_closure_date: null,
  }, actor);
}

export async function getChecklistItems(auditId: string): Promise<AuditChecklistItem[]> {
  try {
    const snap = await getDocs(query(
      collection(firestore, AUDIT_COLLECTIONS.checklists),
      where('audit_id', '==', auditId),
      orderBy('created_at', 'asc'),
    ));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as AuditChecklistItem));
  } catch {
    const snap = await getDocs(query(
      collection(firestore, AUDIT_COLLECTIONS.checklists),
      where('audit_id', '==', auditId),
    ));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as AuditChecklistItem));
  }
}

export async function updateChecklistItem(id: string, input: Partial<ChecklistItemInput>, actor: AuditActor): Promise<AuditChecklistItem> {
  const snap = await getDoc(doc(firestore, AUDIT_COLLECTIONS.checklists, id));
  if (!snap.exists()) throw new Error('Checklist item not found');
  const existing = { id: snap.id, ...snap.data() } as AuditChecklistItem;
  const updates = { ...input, updated_at: now() };
  await updateDoc(snap.ref, updates);
  await audit(actor, 'CHECKLIST_UPDATE', existing.audit_id, existing, updates);
  return { ...existing, ...updates };
}

// ─── Findings ────────────────────────────────────────────────────────────────

export async function createFinding(auditId: string, input: FindingInput, actor: AuditActor): Promise<AuditFinding> {
  const auditRecord = await getAuditById(auditId);
  if (!auditRecord) throw new Error('Audit not found');

  const findingNumber = await generateFindingNumber(auditRecord.audit_number);
  const rpn = calculateRpn(input.severity, input.occurrence, input.detectability);
  const riskLevel = rpnToLevel(rpn);
  const timestamp = now();

  const finding: Omit<AuditFinding, 'id'> = {
    finding_number: findingNumber,
    audit_id: auditId,
    audit_number: auditRecord.audit_number,
    finding_type: input.finding_type,
    finding_category: input.finding_category,
    department: input.department,
    observation: input.observation,
    requirement_reference: input.requirement_reference,
    evidence: input.evidence,
    severity: input.severity,
    occurrence: input.occurrence,
    detectability: input.detectability,
    rpn,
    risk_level: riskLevel,
    root_cause: input.root_cause,
    correction: input.correction,
    capa_required: input.capa_required,
    linked_capa_id: null,
    linked_capa_number: null,
    responsible_person: actor.id,
    responsible_person_name: input.responsible_person_name,
    target_closure_date: input.target_closure_date || null,
    actual_closure_date: null,
    finding_status: 'open',
    created_by: actor.id,
    created_by_name: actor.name,
    created_at: timestamp,
    updated_at: timestamp,
  };

  const refDoc = await addDoc(collection(firestore, AUDIT_COLLECTIONS.findings), finding);
  await audit(actor, 'FINDING_CREATE', refDoc.id, null, finding);

  const criticalCount = input.finding_type === 'Critical' ? auditRecord.critical_findings + 1 : auditRecord.critical_findings;
  const capaCount = input.capa_required ? auditRecord.capa_required_count + 1 : auditRecord.capa_required_count;
  await updateDoc(doc(firestore, AUDIT_COLLECTIONS.audits, auditId), {
    total_findings: auditRecord.total_findings + 1,
    critical_findings: criticalCount,
    capa_required_count: capaCount,
    status: input.capa_required ? 'capa_required' : auditRecord.status,
    updated_at: now(),
  });

  if (input.finding_type === 'Critical') {
    await notify('Critical Audit Finding', `${findingNumber} — immediate Head QA review required`, refDoc.id, ['head_qa', 'qa_manager']);
  }

  if (input.capa_required) {
    await createCapaFromFinding(refDoc.id, actor);
  }

  return { id: refDoc.id, ...finding };
}

export async function listFindings(auditId?: string): Promise<AuditFinding[]> {
  const constraints: QueryConstraint[] = [orderBy('created_at', 'desc')];
  if (auditId) constraints.unshift(where('audit_id', '==', auditId));

  try {
    const snap = await getDocs(query(collection(firestore, AUDIT_COLLECTIONS.findings), ...constraints));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as AuditFinding));
  } catch {
    const snap = auditId
      ? await getDocs(query(collection(firestore, AUDIT_COLLECTIONS.findings), where('audit_id', '==', auditId)))
      : await getDocs(collection(firestore, AUDIT_COLLECTIONS.findings));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as AuditFinding));
  }
}

export async function getFindingById(id: string): Promise<AuditFinding | null> {
  const snap = await getDoc(doc(firestore, AUDIT_COLLECTIONS.findings, id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as AuditFinding;
}

export async function updateFinding(id: string, input: Partial<FindingInput & { finding_status?: string; actual_closure_date?: string }>, actor: AuditActor): Promise<AuditFinding> {
  const existing = await getFindingById(id);
  if (!existing) throw new Error('Finding not found');

  let updates: Partial<AuditFinding> = { ...input, updated_at: now() };
  if (input.severity != null && input.occurrence != null && input.detectability != null) {
    const rpn = calculateRpn(input.severity, input.occurrence, input.detectability);
    updates = { ...updates, rpn, risk_level: rpnToLevel(rpn) };
  }

  await updateDoc(doc(firestore, AUDIT_COLLECTIONS.findings, id), updates);
  await audit(actor, 'RISK_UPDATE', id, existing, updates);
  return { ...existing, ...updates } as AuditFinding;
}

export async function syncOverdueFindings(): Promise<number> {
  const snap = await getDocs(query(
    collection(firestore, AUDIT_COLLECTIONS.findings),
    where('finding_status', '==', 'open'),
  ));
  let count = 0;
  for (const d of snap.docs) {
    const data = d.data() as AuditFinding;
    if (isFindingOverdue(data.target_closure_date, data.finding_status)) {
      await updateDoc(d.ref, { finding_status: 'overdue', updated_at: now() });
      await notify('Finding Overdue', `${data.finding_number} past target closure date`, d.id, ['qa_manager', 'head_qa']);
      count++;
    }
  }
  return count;
}

// ─── CAPA Integration ────────────────────────────────────────────────────────

export async function createCapaFromFinding(findingId: string, actor: AuditActor): Promise<AuditFinding> {
  const finding = await getFindingById(findingId);
  if (!finding) throw new Error('Finding not found');
  if (finding.linked_capa_id) return finding;

  const auditRecord = await getAuditById(finding.audit_id);
  const targetDate = finding.target_closure_date || new Date(Date.now() + 90 * 86400000).toISOString().split('T')[0];

  const capa = await createCapa({
    capa_date: now().split('T')[0],
    capa_source: 'Audit',
    source_reference_number: finding.finding_number,
    department: finding.department as 'QA',
    product_name: 'N/A',
    batch_number: '',
    capa_title: `CAPA for Audit Finding ${finding.finding_number}`,
    problem_description: finding.observation,
    root_cause: finding.root_cause,
    corrective_action: finding.correction,
    preventive_action: '',
    action_owner: actor.id,
    action_owner_name: finding.responsible_person_name || actor.name,
    target_completion_date: targetDate,
    effectiveness_check_required: true,
    effectiveness_criteria: 'Verify audit finding corrected and no recurrence in next audit cycle',
    priority: finding.finding_type === 'Critical' ? 'critical' : finding.finding_type === 'Major' ? 'high' : 'medium',
    qa_remarks: '',
  }, actor, { status: 'draft' });

  await updateDoc(doc(firestore, AUDIT_COLLECTIONS.findings, findingId), {
    linked_capa_id: capa.id,
    linked_capa_number: capa.capa_number,
    capa_required: true,
    finding_status: 'capa_in_progress',
    updated_at: now(),
  });

  await addDoc(collection(firestore, AUDIT_COLLECTIONS.capaLinks), {
    audit_id: finding.audit_id,
    finding_id: findingId,
    capa_id: capa.id,
    capa_number: capa.capa_number,
    linked_at: now(),
    linked_by: actor.id,
    linked_by_name: actor.name,
  });

  await updateDoc(doc(firestore, AUDIT_COLLECTIONS.capa, capa.id), { audit_id: finding.audit_id });
  await audit(actor, 'CAPA_LINK', findingId, finding, { capa_id: capa.id, capa_number: capa.capa_number });

  return { ...finding, linked_capa_id: capa.id, linked_capa_number: capa.capa_number, capa_required: true, finding_status: 'capa_in_progress' };
}

export async function listCapaLinks(auditId?: string): Promise<AuditCapaLink[]> {
  try {
    const constraints: QueryConstraint[] = [orderBy('linked_at', 'desc')];
    if (auditId) constraints.unshift(where('audit_id', '==', auditId));
    const snap = await getDocs(query(collection(firestore, AUDIT_COLLECTIONS.capaLinks), ...constraints));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as AuditCapaLink));
  } catch {
    const snap = auditId
      ? await getDocs(query(collection(firestore, AUDIT_COLLECTIONS.capaLinks), where('audit_id', '==', auditId)))
      : await getDocs(collection(firestore, AUDIT_COLLECTIONS.capaLinks));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as AuditCapaLink));
  }
}

// ─── Approvals ───────────────────────────────────────────────────────────────

export async function submitApproval(auditId: string, input: ApprovalInput, actor: AuditActor): Promise<AuditApproval> {
  const entry: Omit<AuditApproval, 'id'> = {
    audit_id: auditId,
    approver_id: actor.id,
    approver_name: actor.name,
    decision: input.decision,
    comments: input.comments,
    signed_at: now(),
    created_at: now(),
  };
  const refDoc = await addDoc(collection(firestore, AUDIT_COLLECTIONS.approvals), entry);
  await audit(actor, input.decision === 'approved' ? 'APPROVAL' : 'REJECTION', auditId, null, entry, input.comments);

  if (input.decision === 'approved') {
    await updateDoc(doc(firestore, AUDIT_COLLECTIONS.audits, auditId), {
      status: 'closed', updated_by: actor.id, updated_by_name: actor.name, updated_at: now(),
    });
  }
  return { id: refDoc.id, ...entry };
}

export async function getApprovals(auditId: string): Promise<AuditApproval[]> {
  try {
    const snap = await getDocs(query(
      collection(firestore, AUDIT_COLLECTIONS.approvals),
      where('audit_id', '==', auditId),
      orderBy('created_at', 'asc'),
    ));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as AuditApproval));
  } catch {
    const snap = await getDocs(query(
      collection(firestore, AUDIT_COLLECTIONS.approvals),
      where('audit_id', '==', auditId),
    ));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as AuditApproval));
  }
}

// ─── Attachments ─────────────────────────────────────────────────────────────

export async function uploadAttachment(
  auditId: string, file: File, actor: AuditActor, findingId?: string,
): Promise<AuditAttachment> {
  const path = `audits/${auditId}/${Date.now()}_${file.name}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  const downloadUrl = await getDownloadURL(storageRef);

  const attachment: Omit<AuditAttachment, 'id'> = {
    audit_id: auditId,
    finding_id: findingId || null,
    file_name: file.name,
    file_type: file.type,
    file_size: file.size,
    storage_path: path,
    download_url: downloadUrl,
    uploaded_by: actor.id,
    uploaded_by_name: actor.name,
    uploaded_at: now(),
  };

  const refDoc = await addDoc(collection(firestore, AUDIT_COLLECTIONS.attachments), attachment);
  await audit(actor, 'ATTACHMENT_UPLOAD', auditId, null, { file_name: file.name });
  return { id: refDoc.id, ...attachment };
}

export async function getAttachments(auditId: string): Promise<AuditAttachment[]> {
  try {
    const snap = await getDocs(query(
      collection(firestore, AUDIT_COLLECTIONS.attachments),
      where('audit_id', '==', auditId),
      orderBy('uploaded_at', 'desc'),
    ));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as AuditAttachment));
  } catch {
    const snap = await getDocs(query(
      collection(firestore, AUDIT_COLLECTIONS.attachments),
      where('audit_id', '==', auditId),
    ));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as AuditAttachment));
  }
}

export async function getAuditLogsForRecord(recordId: string): Promise<Record<string, unknown>[]> {
  try {
    const snap = await getDocs(query(
      collection(firestore, AUDIT_COLLECTIONS.auditLogs),
      where('recordId', '==', recordId),
      where('module', '==', 'Audit'),
      orderBy('dateTime', 'desc'),
      limit(100),
    ));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch {
    const snap = await getDocs(query(
      collection(firestore, AUDIT_COLLECTIONS.auditLogs),
      where('recordId', '==', recordId),
      limit(100),
    ));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }
}

// ─── Dashboard & Charts ──────────────────────────────────────────────────────

export function computeDashboardMetrics(audits: AuditRecord[], findings: AuditFinding[]): AuditDashboardMetrics {
  return {
    total: audits.length,
    planned: audits.filter((a) => ['planned', 'scheduled'].includes(a.status)).length,
    completed: audits.filter((a) => ['completed', 'closed', 'report_drafted'].includes(a.status)).length,
    openFindings: findings.filter((f) => ['open', 'under_review', 'capa_in_progress', 'overdue'].includes(f.finding_status)).length,
    closedFindings: findings.filter((f) => f.finding_status === 'closed').length,
    criticalFindings: findings.filter((f) => f.finding_type === 'Critical').length,
    capaRequired: findings.filter((f) => f.capa_required).length,
    overdueFindings: findings.filter((f) => f.finding_status === 'overdue' || isFindingOverdue(f.target_closure_date, f.finding_status)).length,
  };
}

export function auditChartData(audits: AuditRecord[], findings: AuditFinding[]) {
  const byType: Record<string, number> = {};
  const byDept: Record<string, number> = {};
  const byCategory: Record<string, number> = {};
  const byCriticality: Record<string, number> = {};
  const monthlyAudit: Record<string, number> = {};
  let openCount = 0;
  let closedCount = 0;
  const capaClosure: Record<string, number> = {};

  for (const a of audits) {
    byType[a.audit_type] = (byType[a.audit_type] || 0) + 1;
    byDept[a.department] = (byDept[a.department] || 0) + 1;
    const month = a.audit_date?.slice(0, 7) || a.created_at.slice(0, 7);
    monthlyAudit[month] = (monthlyAudit[month] || 0) + 1;
  }

  for (const f of findings) {
    byCategory[f.finding_category] = (byCategory[f.finding_category] || 0) + 1;
    byCriticality[f.finding_type] = (byCriticality[f.finding_type] || 0) + 1;
    if (['open', 'under_review', 'capa_in_progress', 'overdue'].includes(f.finding_status)) openCount++;
    else closedCount++;
    if (f.actual_closure_date) {
      const m = f.actual_closure_date.slice(0, 7);
      capaClosure[m] = (capaClosure[m] || 0) + 1;
    }
  }

  const toChart = (obj: Record<string, number>) =>
    Object.entries(obj).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

  return {
    byType: toChart(byType),
    byDepartment: toChart(byDept),
    byCategory: toChart(byCategory),
    byCriticality: toChart(byCriticality),
    monthlyAudit: Object.entries(monthlyAudit).sort().map(([month, count]) => ({ month, count })),
    openVsClosed: [{ name: 'Open', value: openCount }, { name: 'Closed', value: closedCount }],
    capaClosure: Object.entries(capaClosure).sort().map(([month, count]) => ({ month, count })),
  };
}

export async function exportAuditsCsv(records: AuditRecord[]) {
  downloadCsv(
    `audits-${now().split('T')[0]}.csv`,
    ['Number', 'Title', 'Type', 'Department', 'Date', 'Lead Auditor', 'Status', 'Findings'],
    records.map((r) => [
      r.audit_number, r.audit_title, r.audit_type, r.department, r.audit_date,
      r.lead_auditor_name, r.status, r.total_findings,
    ]),
  );
}

export async function exportFindingsCsv(findings: AuditFinding[]) {
  downloadCsv(
    `audit-findings-${now().split('T')[0]}.csv`,
    ['Number', 'Audit', 'Type', 'Category', 'Department', 'RPN', 'Risk', 'CAPA', 'Status'],
    findings.map((f) => [
      f.finding_number, f.audit_number, f.finding_type, f.finding_category, f.department,
      f.rpn, f.risk_level, f.linked_capa_number || '', f.finding_status,
    ]),
  );
}

export async function syncOverdueAudits(): Promise<number> {
  const today = now().split('T')[0];
  let count = 0;
  try {
    const snap = await getDocs(collection(firestore, AUDIT_COLLECTIONS.audits));
    for (const d of snap.docs) {
      const data = d.data() as AuditRecord;
      if (['planned', 'scheduled'].includes(data.status) && data.audit_date < today) {
        await updateDoc(d.ref, { status: 'overdue', updated_at: now() });
        count++;
      }
    }
  } catch { /* ignore */ }
  return count;
}
