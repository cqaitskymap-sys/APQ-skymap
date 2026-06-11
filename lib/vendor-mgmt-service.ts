import {
  addDoc, collection, doc, getDoc, getDocs, limit, orderBy, query, updateDoc, where,
  type QueryConstraint,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { firestore, storage } from '@/lib/firebase';
import { logAuditEvent } from '@/lib/admin/admin-service';
import { downloadCsv } from '@/lib/export-utils';
import {
  VENDOR_COLLECTIONS, calcPerformanceScore, isVendorUsable,
  type VendorRecord, type AvlRecord, type VendorQualification, type SupplierAuditRecord,
  type TechnicalAgreement, type VendorPerformance, type VendorAttachment,
  type VendorFilters, type VendorDashboardMetrics, type VendorActor,
} from './vendor-mgmt-types';
import type {
  VendorCreateInput, AvlInput, QualificationInput, SupplierAuditInput,
  AgreementInput, PerformanceInput,
} from './vendor-mgmt-schemas';

function now() { return new Date().toISOString(); }

async function audit(actor: VendorActor, action: string, recordId: string, oldValue: unknown, newValue: unknown, reason = '') {
  await logAuditEvent({
    userId: actor.id, userName: actor.name, module: 'Vendor', recordId, action,
    oldValue: oldValue ? JSON.stringify(oldValue) : '',
    newValue: newValue ? JSON.stringify(newValue) : '',
    reason, ipAddress: 'client', device: typeof navigator !== 'undefined' ? navigator.userAgent : 'server',
    status: 'Success',
  });
}

async function notify(title: string, message: string, recordId: string, roles: string[]) {
  try {
    for (const role of roles) {
      await addDoc(collection(firestore, VENDOR_COLLECTIONS.notifications), {
        title, message, module: 'Vendor', record_id: recordId, target_role: role,
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

// ─── Vendors ─────────────────────────────────────────────────────────────────

export async function createVendor(input: VendorCreateInput, actor: VendorActor): Promise<VendorRecord> {
  const vendorCode = await genNumber('VND', VENDOR_COLLECTIONS.vendors, 'vendor_code');
  const timestamp = now();
  const record: Omit<VendorRecord, 'id'> = {
    vendor_code: vendorCode,
    vendor_name: input.vendor_name,
    vendor_type: input.vendor_type,
    material_service_supplied: input.material_service_supplied,
    manufacturer_name: input.manufacturer_name,
    supplier_name: input.supplier_name,
    address: input.address,
    city: input.city,
    state: input.state,
    country: input.country,
    contact_person: input.contact_person,
    email: input.email,
    phone: input.phone,
    gst_tax_no: input.gst_tax_no,
    license_no: input.license_no,
    approval_status: input.approval_status,
    risk_category: input.risk_category,
    vendor_status: input.vendor_status,
    remarks: input.remarks,
    next_audit_due: input.next_audit_due || null,
    created_by: actor.id,
    created_by_name: actor.name,
    updated_by: actor.id,
    updated_by_name: actor.name,
    created_at: timestamp,
    updated_at: timestamp,
  };
  const refDoc = await addDoc(collection(firestore, VENDOR_COLLECTIONS.vendors), record);
  await audit(actor, 'CREATE', refDoc.id, null, record);
  return { id: refDoc.id, ...record };
}

export async function getVendorById(id: string): Promise<VendorRecord | null> {
  const snap = await getDoc(doc(firestore, VENDOR_COLLECTIONS.vendors, id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as VendorRecord;
}

export async function listVendors(filters?: VendorFilters): Promise<VendorRecord[]> {
  const constraints: QueryConstraint[] = [orderBy('updated_at', 'desc')];
  if (filters?.approval_status) constraints.unshift(where('approval_status', '==', filters.approval_status));
  if (filters?.vendor_type) constraints.unshift(where('vendor_type', '==', filters.vendor_type));
  if (filters?.risk_category) constraints.unshift(where('risk_category', '==', filters.risk_category));
  if (filters?.vendor_status) constraints.unshift(where('vendor_status', '==', filters.vendor_status));

  let records: VendorRecord[];
  try {
    const snap = await getDocs(query(collection(firestore, VENDOR_COLLECTIONS.vendors), ...constraints));
    records = snap.docs.map((d) => ({ id: d.id, ...d.data() } as VendorRecord));
  } catch {
    const snap = await getDocs(collection(firestore, VENDOR_COLLECTIONS.vendors));
    records = snap.docs.map((d) => ({ id: d.id, ...d.data() } as VendorRecord));
  }

  if (filters?.search) {
    const q = filters.search.toLowerCase();
    records = records.filter((r) =>
      r.vendor_code.toLowerCase().includes(q) || r.vendor_name.toLowerCase().includes(q) ||
      r.material_service_supplied.toLowerCase().includes(q),
    );
  }
  return records;
}

export async function updateVendor(id: string, input: Partial<VendorCreateInput>, actor: VendorActor): Promise<VendorRecord> {
  const existing = await getVendorById(id);
  if (!existing) throw new Error('Vendor not found');
  const updates = { ...input, updated_by: actor.id, updated_by_name: actor.name, updated_at: now() };
  await updateDoc(doc(firestore, VENDOR_COLLECTIONS.vendors, id), updates);
  await audit(actor, 'EDIT', id, existing, updates);
  return { ...existing, ...updates } as VendorRecord;
}

export async function blockVendor(id: string, actor: VendorActor, reason: string): Promise<VendorRecord> {
  const updates = { approval_status: 'Blocked', vendor_status: 'Blocked', updated_at: now() };
  await updateDoc(doc(firestore, VENDOR_COLLECTIONS.vendors, id), updates);
  await audit(actor, 'BLOCKING', id, null, updates, reason);
  await notify('Vendor Blocked', `Vendor blocked: ${reason}`, id, ['qa_manager', 'head_qa', 'purchase']);
  const v = await getVendorById(id);
  return v!;
}

export async function approveVendor(id: string, actor: VendorActor): Promise<VendorRecord> {
  const updates = { approval_status: 'Approved', updated_by: actor.id, updated_by_name: actor.name, updated_at: now() };
  await updateDoc(doc(firestore, VENDOR_COLLECTIONS.vendors, id), updates);
  await audit(actor, 'APPROVAL', id, null, updates);
  const v = await getVendorById(id);
  return v!;
}

/** For material/RM/PM modules — only approved, usable vendors */
export async function listSelectableVendors(materialService?: string): Promise<VendorRecord[]> {
  const all = await listVendors({});
  return all.filter((v) => {
    if (!isVendorUsable(v)) return false;
    if (!['Approved', 'Conditionally Approved'].includes(v.approval_status)) return false;
    if (materialService && !v.material_service_supplied.toLowerCase().includes(materialService.toLowerCase())) return false;
    return true;
  });
}

export async function isVendorSelectable(vendorId: string): Promise<boolean> {
  const v = await getVendorById(vendorId);
  return v ? isVendorUsable(v) && ['Approved', 'Conditionally Approved'].includes(v.approval_status) : false;
}

// ─── AVL ─────────────────────────────────────────────────────────────────────

export async function createAvl(input: AvlInput, actor: VendorActor): Promise<AvlRecord> {
  const avlNumber = await genNumber('AVL', VENDOR_COLLECTIONS.avl, 'avl_number');
  const record: Omit<AvlRecord, 'id'> = {
    avl_number: avlNumber,
    vendor_id: input.vendor_id,
    vendor_name: input.vendor_name,
    material_service: input.material_service,
    approval_date: input.approval_date,
    approval_expiry_date: input.approval_expiry_date,
    approved_by: actor.id,
    approved_by_name: actor.name,
    qualification_ref: input.qualification_ref,
    audit_required: input.audit_required,
    audit_frequency: input.audit_frequency,
    status: 'Active',
    created_at: now(),
    updated_at: now(),
  };
  const refDoc = await addDoc(collection(firestore, VENDOR_COLLECTIONS.avl), record);
  await audit(actor, 'AVL_UPDATE', refDoc.id, null, record);
  await updateVendor(input.vendor_id, { approval_status: 'Approved' }, actor);
  return { id: refDoc.id, ...record };
}

export async function listAvl(vendorId?: string): Promise<AvlRecord[]> {
  try {
    const constraints: QueryConstraint[] = [orderBy('approval_date', 'desc')];
    if (vendorId) constraints.unshift(where('vendor_id', '==', vendorId));
    const snap = await getDocs(query(collection(firestore, VENDOR_COLLECTIONS.avl), ...constraints));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as AvlRecord));
  } catch {
    const snap = vendorId
      ? await getDocs(query(collection(firestore, VENDOR_COLLECTIONS.avl), where('vendor_id', '==', vendorId)))
      : await getDocs(collection(firestore, VENDOR_COLLECTIONS.avl));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as AvlRecord));
  }
}

export async function syncExpiredAvl(): Promise<number> {
  const today = now().split('T')[0];
  const snap = await getDocs(collection(firestore, VENDOR_COLLECTIONS.avl));
  let count = 0;
  for (const d of snap.docs) {
    const data = d.data() as AvlRecord;
    if (data.status === 'Active' && data.approval_expiry_date < today) {
      await updateDoc(d.ref, { status: 'Expired', updated_at: now() });
      await updateDoc(doc(firestore, VENDOR_COLLECTIONS.vendors, data.vendor_id), {
        approval_status: 'Expired', updated_at: now(),
      });
      await notify('AVL Expired', `${data.avl_number} expired for ${data.vendor_name}`, d.id, ['qa_manager', 'head_qa']);
      count++;
    }
  }
  return count;
}

// ─── Qualification ───────────────────────────────────────────────────────────

export async function createQualification(input: QualificationInput, actor: VendorActor): Promise<VendorQualification> {
  const qualNumber = await genNumber('VQL', VENDOR_COLLECTIONS.qualifications, 'qualification_number');
  const record: Omit<VendorQualification, 'id'> = {
    qualification_number: qualNumber,
    vendor_id: input.vendor_id,
    vendor_name: input.vendor_name,
    vendor_type: input.vendor_type,
    qualification_type: input.qualification_type,
    material_service: input.material_service,
    questionnaire_sent_date: input.questionnaire_sent_date || null,
    questionnaire_received_date: input.questionnaire_received_date || null,
    document_review_status: input.document_review_status,
    sample_evaluation_required: input.sample_evaluation_required,
    sample_evaluation_status: input.sample_evaluation_status,
    audit_required: input.audit_required,
    audit_date: input.audit_date || null,
    audit_status: input.audit_status,
    risk_assessment_score: input.risk_assessment_score,
    qualification_decision: input.qualification_decision,
    approved_by: '',
    approved_by_name: '',
    approval_date: null,
    next_review_date: input.next_review_date || null,
    remarks: input.remarks,
    created_at: now(),
    updated_at: now(),
  };
  const refDoc = await addDoc(collection(firestore, VENDOR_COLLECTIONS.qualifications), record);
  await audit(actor, 'QUALIFICATION_UPDATE', refDoc.id, null, record);
  await updateVendor(input.vendor_id, { approval_status: 'Under Qualification' }, actor);
  return { id: refDoc.id, ...record };
}

export async function finalizeQualification(id: string, decision: string, actor: VendorActor): Promise<VendorQualification> {
  const snap = await getDoc(doc(firestore, VENDOR_COLLECTIONS.qualifications, id));
  if (!snap.exists()) throw new Error('Qualification not found');
  const existing = { id: snap.id, ...snap.data() } as VendorQualification;
  const updates = {
    qualification_decision: decision,
    approved_by: actor.id,
    approved_by_name: actor.name,
    approval_date: now().split('T')[0],
    updated_at: now(),
  };
  await updateDoc(snap.ref, updates);
  const statusMap: Record<string, string> = {
    Approved: 'Approved', 'Conditionally Approved': 'Conditionally Approved',
    Rejected: 'Rejected', 'More Information Required': 'Under Qualification',
  };
  await updateVendor(existing.vendor_id, { approval_status: statusMap[decision] || 'Under Qualification' }, actor);
  await audit(actor, decision === 'Rejected' ? 'REJECTION' : 'APPROVAL', id, existing, updates);
  return { ...existing, ...updates };
}

export async function listQualifications(vendorId?: string): Promise<VendorQualification[]> {
  try {
    const constraints: QueryConstraint[] = [orderBy('created_at', 'desc')];
    if (vendorId) constraints.unshift(where('vendor_id', '==', vendorId));
    const snap = await getDocs(query(collection(firestore, VENDOR_COLLECTIONS.qualifications), ...constraints));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as VendorQualification));
  } catch {
    const snap = vendorId
      ? await getDocs(query(collection(firestore, VENDOR_COLLECTIONS.qualifications), where('vendor_id', '==', vendorId)))
      : await getDocs(collection(firestore, VENDOR_COLLECTIONS.qualifications));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as VendorQualification));
  }
}

// ─── Supplier Audits ─────────────────────────────────────────────────────────

export async function createSupplierAudit(input: SupplierAuditInput, actor: VendorActor): Promise<SupplierAuditRecord> {
  const auditNumber = await genNumber('SVA', VENDOR_COLLECTIONS.supplierAudits, 'audit_number');
  const record: Omit<SupplierAuditRecord, 'id'> = {
    audit_number: auditNumber,
    vendor_id: input.vendor_id,
    vendor_name: input.vendor_name,
    audit_type: input.audit_type,
    audit_date: input.audit_date,
    audit_scope: input.audit_scope,
    lead_auditor: input.lead_auditor,
    audit_team: input.audit_team,
    audit_status: 'Completed',
    findings_count: input.findings_count,
    critical_findings: input.critical_findings,
    major_findings: input.major_findings,
    minor_findings: input.minor_findings,
    capa_required: input.capa_required,
    capa_status: input.capa_status,
    final_audit_rating: input.final_audit_rating,
    created_at: now(),
    updated_at: now(),
  };
  const refDoc = await addDoc(collection(firestore, VENDOR_COLLECTIONS.supplierAudits), record);
  await audit(actor, 'AUDIT_UPDATE', refDoc.id, null, record);
  return { id: refDoc.id, ...record };
}

export async function listSupplierAudits(vendorId?: string): Promise<SupplierAuditRecord[]> {
  try {
    const constraints: QueryConstraint[] = [orderBy('audit_date', 'desc')];
    if (vendorId) constraints.unshift(where('vendor_id', '==', vendorId));
    const snap = await getDocs(query(collection(firestore, VENDOR_COLLECTIONS.supplierAudits), ...constraints));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as SupplierAuditRecord));
  } catch {
    const snap = vendorId
      ? await getDocs(query(collection(firestore, VENDOR_COLLECTIONS.supplierAudits), where('vendor_id', '==', vendorId)))
      : await getDocs(collection(firestore, VENDOR_COLLECTIONS.supplierAudits));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as SupplierAuditRecord));
  }
}

// ─── Technical Agreements ────────────────────────────────────────────────────

export async function createAgreement(input: AgreementInput, actor: VendorActor): Promise<TechnicalAgreement> {
  const agreementNumber = await genNumber('TA', VENDOR_COLLECTIONS.agreements, 'agreement_number');
  const record: Omit<TechnicalAgreement, 'id'> = {
    agreement_number: agreementNumber,
    vendor_id: input.vendor_id,
    vendor_name: input.vendor_name,
    agreement_type: input.agreement_type,
    material_service: input.material_service,
    effective_date: input.effective_date,
    expiry_date: input.expiry_date,
    agreement_status: input.agreement_status,
    responsible_department: input.responsible_department,
    uploaded_agreement_url: '',
    review_due_date: input.review_due_date || null,
    remarks: input.remarks,
    created_at: now(),
    updated_at: now(),
  };
  const refDoc = await addDoc(collection(firestore, VENDOR_COLLECTIONS.agreements), record);
  await audit(actor, 'AGREEMENT_UPLOAD', refDoc.id, null, record);
  return { id: refDoc.id, ...record };
}

export async function listAgreements(vendorId?: string): Promise<TechnicalAgreement[]> {
  try {
    const constraints: QueryConstraint[] = [orderBy('effective_date', 'desc')];
    if (vendorId) constraints.unshift(where('vendor_id', '==', vendorId));
    const snap = await getDocs(query(collection(firestore, VENDOR_COLLECTIONS.agreements), ...constraints));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as TechnicalAgreement));
  } catch {
    const snap = vendorId
      ? await getDocs(query(collection(firestore, VENDOR_COLLECTIONS.agreements), where('vendor_id', '==', vendorId)))
      : await getDocs(collection(firestore, VENDOR_COLLECTIONS.agreements));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as TechnicalAgreement));
  }
}

export async function syncExpiredAgreements(): Promise<number> {
  const today = now().split('T')[0];
  const snap = await getDocs(collection(firestore, VENDOR_COLLECTIONS.agreements));
  let count = 0;
  for (const d of snap.docs) {
    const data = d.data() as TechnicalAgreement;
    if (['Approved', 'Effective'].includes(data.agreement_status) && data.expiry_date < today) {
      await updateDoc(d.ref, { agreement_status: 'Expired', updated_at: now() });
      await notify('Agreement Expired', `${data.agreement_number} expired for ${data.vendor_name}`, d.id, ['qa_manager', 'head_qa']);
      count++;
    }
  }
  return count;
}

// ─── Performance ─────────────────────────────────────────────────────────────

export async function savePerformance(input: PerformanceInput, actor: VendorActor): Promise<VendorPerformance> {
  const calc = calcPerformanceScore(input);
  const record: Omit<VendorPerformance, 'id'> = {
    ...input,
    ...calc,
    risk_level: calc.performance_score < 60 ? 'High' : calc.performance_score < 75 ? 'Medium' : 'Low',
    created_at: now(),
  };
  const refDoc = await addDoc(collection(firestore, VENDOR_COLLECTIONS.performance), record);
  await audit(actor, 'PERFORMANCE_REVIEW', refDoc.id, null, record);

  if (calc.performance_score < 60) {
    await notify('Vendor Risk Alert', `${input.vendor_name} performance score ${calc.performance_score}% — review required`, refDoc.id, ['qa_manager', 'head_qa']);
  }
  if (input.rejected_lots >= 3) {
    await notify('CAPA Recommendation', `Repeated rejections for ${input.vendor_name} — CAPA recommended`, refDoc.id, ['qa_manager']);
  }
  return { id: refDoc.id, ...record };
}

export async function listPerformance(vendorId?: string): Promise<VendorPerformance[]> {
  try {
    const constraints: QueryConstraint[] = [orderBy('created_at', 'desc')];
    if (vendorId) constraints.unshift(where('vendor_id', '==', vendorId));
    const snap = await getDocs(query(collection(firestore, VENDOR_COLLECTIONS.performance), ...constraints));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as VendorPerformance));
  } catch {
    const snap = vendorId
      ? await getDocs(query(collection(firestore, VENDOR_COLLECTIONS.performance), where('vendor_id', '==', vendorId)))
      : await getDocs(collection(firestore, VENDOR_COLLECTIONS.performance));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as VendorPerformance));
  }
}

// ─── Attachments ─────────────────────────────────────────────────────────────

export async function uploadVendorAttachment(
  vendorId: string, file: File, category: string, actor: VendorActor,
): Promise<VendorAttachment> {
  const path = `vendors/${vendorId}/${Date.now()}_${file.name}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  const downloadUrl = await getDownloadURL(storageRef);
  const attachment: Omit<VendorAttachment, 'id'> = {
    vendor_id: vendorId, file_name: file.name, file_type: file.type, file_size: file.size,
    category, storage_path: path, download_url: downloadUrl,
    uploaded_by: actor.id, uploaded_by_name: actor.name, uploaded_at: now(),
  };
  const refDoc = await addDoc(collection(firestore, VENDOR_COLLECTIONS.attachments), attachment);
  await audit(actor, 'ATTACHMENT_UPLOAD', vendorId, null, { file_name: file.name, category });
  return { id: refDoc.id, ...attachment };
}

export async function getVendorAttachments(vendorId: string): Promise<VendorAttachment[]> {
  try {
    const snap = await getDocs(query(
      collection(firestore, VENDOR_COLLECTIONS.attachments),
      where('vendor_id', '==', vendorId), orderBy('uploaded_at', 'desc'),
    ));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as VendorAttachment));
  } catch {
    const snap = await getDocs(query(
      collection(firestore, VENDOR_COLLECTIONS.attachments), where('vendor_id', '==', vendorId),
    ));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as VendorAttachment));
  }
}

export async function getAuditLogsForVendor(vendorId: string): Promise<Record<string, unknown>[]> {
  try {
    const snap = await getDocs(query(
      collection(firestore, VENDOR_COLLECTIONS.auditLogs),
      where('recordId', '==', vendorId), where('module', '==', 'Vendor'),
      orderBy('dateTime', 'desc'), limit(100),
    ));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch {
    return [];
  }
}

// ─── Sync & Dashboard ────────────────────────────────────────────────────────

export async function syncVendorStatuses(): Promise<void> {
  await Promise.all([syncExpiredAvl(), syncExpiredAgreements()]);
  const today = now().split('T')[0];
  const vendors = await listVendors({});
  for (const v of vendors) {
    if (v.next_audit_due && v.next_audit_due < today && v.approval_status === 'Approved') {
      await notify('Audit Due', `${v.vendor_name} supplier audit overdue`, v.id, ['qa_manager']);
    }
  }
}

export function computeDashboardMetrics(
  vendors: VendorRecord[], avl: AvlRecord[], agreements: TechnicalAgreement[],
): VendorDashboardMetrics {
  const today = now().split('T')[0];
  return {
    total: vendors.length,
    approved: vendors.filter((v) => v.approval_status === 'Approved').length,
    underQualification: vendors.filter((v) => v.approval_status === 'Under Qualification').length,
    blocked: vendors.filter((v) => ['Blocked', 'Rejected'].includes(v.approval_status)).length,
    expired: vendors.filter((v) => v.approval_status === 'Expired').length,
    highRisk: vendors.filter((v) => ['High', 'Critical'].includes(v.risk_category)).length,
    auditDue: vendors.filter((v) => v.next_audit_due && v.next_audit_due < today).length,
    agreementExpired: agreements.filter((a) => a.agreement_status === 'Expired').length,
    conditional: vendors.filter((v) => v.approval_status === 'Conditionally Approved').length,
  };
}

export function vendorChartData(vendors: VendorRecord[], performance: VendorPerformance[]) {
  const byType: Record<string, number> = {};
  const byRisk: Record<string, number> = {};
  const perfTrend: Record<string, number> = {};
  const approvedVsRejected: Record<string, number> = { Approved: 0, Rejected: 0, Other: 0 };

  for (const v of vendors) {
    byType[v.vendor_type] = (byType[v.vendor_type] || 0) + 1;
    byRisk[v.risk_category] = (byRisk[v.risk_category] || 0) + 1;
    if (v.approval_status === 'Approved') approvedVsRejected.Approved++;
    else if (v.approval_status === 'Rejected') approvedVsRejected.Rejected++;
    else approvedVsRejected.Other++;
  }

  for (const p of performance) {
    const month = p.review_period.slice(0, 7);
    perfTrend[month] = (perfTrend[month] || 0) + p.performance_score;
  }

  const toChart = (obj: Record<string, number>) =>
    Object.entries(obj).map(([name, value]) => ({ name, value }));

  return {
    byType: toChart(byType),
    byRisk: toChart(byRisk),
    perfTrend: Object.entries(perfTrend).sort().map(([month, score]) => ({ month, score: Math.round(score) })),
    approvedVsRejected: toChart(approvedVsRejected),
    rejectionTrend: performance.map((p) => ({ name: p.vendor_name.slice(0, 12), value: p.rejection_percent })).slice(0, 8),
    complaintTrend: performance.map((p) => ({ name: p.vendor_name.slice(0, 12), value: p.complaints })).slice(0, 8),
  };
}

export async function exportVendorsCsv(vendors: VendorRecord[]) {
  downloadCsv(
    `vendors-${now().split('T')[0]}.csv`,
    ['Code', 'Name', 'Type', 'Material/Service', 'Approval', 'Risk', 'Status'],
    vendors.map((v) => [v.vendor_code, v.vendor_name, v.vendor_type, v.material_service_supplied, v.approval_status, v.risk_category, v.vendor_status]),
  );
}

export async function exportAvlCsv(avl: AvlRecord[]) {
  downloadCsv(
    `avl-${now().split('T')[0]}.csv`,
    ['AVL Number', 'Vendor', 'Material', 'Approval Date', 'Expiry', 'Status'],
    avl.map((a) => [a.avl_number, a.vendor_name, a.material_service, a.approval_date, a.approval_expiry_date, a.status]),
  );
}
