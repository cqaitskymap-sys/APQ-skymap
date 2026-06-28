import {
  addDoc, collection, doc, getDoc, getDocs, limit, orderBy, query, updateDoc, where,
} from 'firebase/firestore';
import { getFirebaseFirestore, isFirebaseConfigured } from '@/lib/firebase';
import { TMS_COLLECTIONS } from '@/lib/training-types';
import { listTrainingRecords } from '@/lib/training-service';
import { logTrainingAuditRecord } from '@/lib/training-audit-trail-service';
import { downloadCsv } from '@/lib/export-utils';
import {
  TRAINING_CERTIFICATE_MODULE, CERTIFICATE_COLLECTION,
  generateCertificateNumber, generateVerificationCode, generateQrPlaceholder,
  computeCertificateStatus,
  type TrainingCertificateRecord, type CertificateFilters, type CertificateActor,
  type CertificateDashboardData, type CertificateDashboardKpis, type CertificateDashboardCharts,
  type CertificateVerificationLog,
} from '@/lib/training-certificate-types';
import type { CreateCertificateInput, RenewCertificateInput, RevokeCertificateInput } from '@/lib/training-certificate-schemas';
import {
  filterCertificatesByRole, applyCertificateFilters, computeCertificateDashboard,
} from '@/lib/training-certificate-records';

export type {
  TrainingCertificateRecord, CertificateFilters, CertificateActor, CertificateDashboardData,
};

const VERIFY_LOG_KEY = 'training_certificate_verifications';

function now() { return new Date().toISOString(); }
function today() { return new Date().toISOString().slice(0, 10); }
function db() { return getFirebaseFirestore(); }

function mapCertificate(id: string, data: Record<string, unknown>): TrainingCertificateRecord {
  const issueDate = String(data.issue_date || data.issued_date || '');
  const expiryDate = String(data.expiry_date || '');
  const status = computeCertificateStatus(expiryDate, String(data.certificate_status || data.status || 'Active'));
  return {
    id,
    certificate_id: String(data.certificate_id || id),
    certificate_number: String(data.certificate_number || ''),
    employee_id: String(data.employee_id || ''),
    employee_name: String(data.employee_name || ''),
    department: String(data.department || ''),
    designation: String(data.designation || ''),
    training_record_id: String(data.training_record_id || data.reference_id || ''),
    training_topic: String(data.training_topic || data.course_title || ''),
    training_type: String(data.training_type || 'GMP Training'),
    document_number: String(data.document_number || ''),
    document_version: String(data.document_version || ''),
    sop_number: String(data.sop_number || data.document_number || ''),
    trainer: String(data.trainer || ''),
    assessment_score: data.assessment_score != null ? Number(data.assessment_score) : null,
    result: String(data.result || 'Pass'),
    competency_level: String(data.competency_level || ''),
    issue_date: issueDate,
    effective_date: String(data.effective_date || issueDate),
    expiry_date: expiryDate,
    renewal_required: Boolean(data.renewal_required ?? true),
    renewal_due_date: data.renewal_due_date ? String(data.renewal_due_date) : null,
    certificate_status: status,
    approval_status: String(data.approval_status || (data.approved_by ? 'Approved' : 'Pending')),
    approved_by: data.approved_by ? String(data.approved_by) : null,
    approved_date: data.approved_date ? String(data.approved_date) : null,
    digital_signature: data.digital_signature ? String(data.digital_signature) : null,
    certificate_version: String(data.certificate_version || '1.0'),
    certificate_pdf_url: data.certificate_pdf_url || data.file_url ? String(data.certificate_pdf_url || data.file_url) : null,
    verification_code: String(data.verification_code || ''),
    qr_code_data: data.qr_code_data ? String(data.qr_code_data) : null,
    remarks: String(data.remarks || ''),
    created_at: String(data.created_at || data.imported_at || ''),
    updated_at: String(data.updated_at || ''),
    created_by: String(data.created_by || ''),
    created_by_name: String(data.created_by_name || ''),
    updated_by: String(data.updated_by || ''),
    updated_by_name: String(data.updated_by_name || ''),
    connection_id: data.connection_id ? String(data.connection_id) : undefined,
    external_id: data.external_id ? String(data.external_id) : undefined,
    course_title: data.course_title ? String(data.course_title) : undefined,
    imported_at: data.imported_at ? String(data.imported_at) : undefined,
  };
}

async function audit(actor: CertificateActor, action: string, certId: string, detail?: unknown) {
  await logTrainingAuditRecord(
    actor, action, certId, CERTIFICATE_COLLECTION, null, detail,
    { moduleName: TRAINING_CERTIFICATE_MODULE },
  );
}

async function notify(title: string, message: string, recordId: string, roles: string[]) {
  for (const role of roles) {
    try {
      await addDoc(collection(db(), TMS_COLLECTIONS.notifications), {
        title, message, module: TRAINING_CERTIFICATE_MODULE, record_id: recordId,
        target_role: role, read: false, created_at: now(),
      });
    } catch { /* optional */ }
  }
}

export async function listCertificates(max = 500): Promise<TrainingCertificateRecord[]> {
  if (!isFirebaseConfigured()) return [];
  try {
    const snap = await getDocs(query(
      collection(db(), CERTIFICATE_COLLECTION),
      orderBy('created_at', 'desc'),
      limit(max),
    ));
    return snap.docs.map((d) => mapCertificate(d.id, d.data()));
  } catch {
    try {
      const snap = await getDocs(query(
        collection(db(), CERTIFICATE_COLLECTION),
        orderBy('issue_date', 'desc'),
        limit(max),
      ));
      return snap.docs.map((d) => mapCertificate(d.id, d.data()));
    } catch {
      const snap = await getDocs(query(collection(db(), CERTIFICATE_COLLECTION), limit(max)));
      return snap.docs.map((d) => mapCertificate(d.id, d.data()))
        .sort((a, b) => b.created_at.localeCompare(a.created_at));
    }
  }
}

export async function getCertificateById(id: string): Promise<TrainingCertificateRecord | null> {
  if (!isFirebaseConfigured()) return null;
  const snap = await getDoc(doc(db(), CERTIFICATE_COLLECTION, id));
  if (!snap.exists()) return null;
  return mapCertificate(snap.id, snap.data());
}

export async function fetchCertificateDashboard(input: {
  role?: string | null;
  userId?: string;
  userDepartment?: string;
  filters?: CertificateFilters;
}): Promise<CertificateDashboardData> {
  await processCertificateExpiryReminders();
  const all = await listCertificates();
  const scoped = filterCertificatesByRole(all, input.role, input.userId, input.userDepartment);
  const filtered = applyCertificateFilters(scoped, input.filters || {});
  return computeCertificateDashboard(filtered, getVerificationLog());
}

export async function createCertificate(
  input: CreateCertificateInput,
  actor: CertificateActor,
  autoIssue = false,
): Promise<TrainingCertificateRecord> {
  const certNumber = generateCertificateNumber();
  const verifyCode = generateVerificationCode(certNumber);
  const ts = now();
  const payload = {
    certificate_id: certNumber,
    certificate_number: certNumber,
    employee_id: input.employee_id,
    employee_name: input.employee_name,
    department: input.department,
    designation: input.designation,
    training_record_id: input.training_record_id,
    training_topic: input.training_topic,
    training_type: input.training_type,
    document_number: input.document_number,
    document_version: input.document_version,
    sop_number: input.sop_number,
    trainer: input.trainer,
    assessment_score: input.assessment_score ?? null,
    result: input.result,
    competency_level: input.competency_level,
    issue_date: input.issue_date,
    effective_date: input.effective_date || input.issue_date,
    expiry_date: input.expiry_date,
    renewal_required: input.renewal_required,
    renewal_due_date: input.renewal_required ? input.expiry_date : null,
    certificate_status: autoIssue ? 'Issued' : 'Draft',
    approval_status: autoIssue ? 'Approved' : 'Pending',
    approved_by: autoIssue ? actor.name : null,
    approved_date: autoIssue ? ts : null,
    digital_signature: null,
    certificate_version: '1.0',
    certificate_pdf_url: `/api/training/certificates/pdf/${certNumber}`,
    verification_code: verifyCode,
    qr_code_data: generateQrPlaceholder(certNumber, verifyCode),
    remarks: input.remarks,
    created_at: ts,
    updated_at: ts,
    created_by: actor.id,
    created_by_name: actor.name,
    updated_by: actor.id,
    updated_by_name: actor.name,
  };

  const ref = await addDoc(collection(db(), CERTIFICATE_COLLECTION), payload);
  await audit(actor, 'certificate created', ref.id, payload);

  if (autoIssue) {
    await issueCertificate(ref.id, actor);
  }

  return mapCertificate(ref.id, payload);
}

export async function issueCertificate(certId: string, actor: CertificateActor): Promise<void> {
  const cert = await getCertificateById(certId);
  if (!cert) throw new Error('Certificate not found');
  const ts = now();
  const status = computeCertificateStatus(cert.expiry_date, 'Issued');

  await updateDoc(doc(db(), CERTIFICATE_COLLECTION, certId), {
    certificate_status: status,
    approval_status: 'Approved',
    approved_by: actor.name,
    approved_date: ts,
    updated_at: ts,
    updated_by: actor.id,
    updated_by_name: actor.name,
  });

  await audit(actor, 'certificate issued', certId, { certificate_number: cert.certificate_number });
  await notify('Certificate Issued', `${cert.training_topic} certificate issued for ${cert.employee_name}`, certId, ['employee']);
  await notify('Certificate Issued', `New certificate ${cert.certificate_number} for ${cert.employee_name}`, certId, ['department_head', 'training_coordinator']);
}

export async function approveCertificate(certId: string, actor: CertificateActor): Promise<void> {
  const ts = now();
  await updateDoc(doc(db(), CERTIFICATE_COLLECTION, certId), {
    approval_status: 'Approved',
    approved_by: actor.name,
    approved_date: ts,
    updated_at: ts,
    updated_by: actor.id,
    updated_by_name: actor.name,
  });
  await audit(actor, 'certificate approved', certId, null);
  await issueCertificate(certId, actor);
}

export async function rejectCertificate(certId: string, actor: CertificateActor, reason: string): Promise<void> {
  await updateDoc(doc(db(), CERTIFICATE_COLLECTION, certId), {
    approval_status: 'Rejected',
    certificate_status: 'Cancelled',
    remarks: reason,
    updated_at: now(),
    updated_by: actor.id,
    updated_by_name: actor.name,
  });
  await audit(actor, 'certificate rejected', certId, { reason });
}

export async function renewCertificate(
  input: RenewCertificateInput,
  actor: CertificateActor,
): Promise<void> {
  const cert = await getCertificateById(input.certificate_id);
  if (!cert) throw new Error('Certificate not found');
  const ts = now();
  const newVersion = `${(parseFloat(cert.certificate_version) || 1) + 0.1}`.slice(0, 3);

  await updateDoc(doc(db(), CERTIFICATE_COLLECTION, input.certificate_id), {
    expiry_date: input.new_expiry_date,
    renewal_due_date: input.new_expiry_date,
    certificate_status: computeCertificateStatus(input.new_expiry_date, 'Renewed'),
    certificate_version: newVersion,
    remarks: input.remarks,
    updated_at: ts,
    updated_by: actor.id,
    updated_by_name: actor.name,
  });

  await audit(actor, 'certificate renewed', input.certificate_id, { new_expiry: input.new_expiry_date });
  await notify('Certificate Renewed', `${cert.certificate_number} renewed until ${input.new_expiry_date}`, input.certificate_id, ['employee', 'training_coordinator']);
}

export async function revokeCertificate(
  input: RevokeCertificateInput,
  actor: CertificateActor,
): Promise<void> {
  await updateDoc(doc(db(), CERTIFICATE_COLLECTION, input.certificate_id), {
    certificate_status: 'Revoked',
    remarks: input.reason,
    updated_at: now(),
    updated_by: actor.id,
    updated_by_name: actor.name,
  });
  await audit(actor, 'certificate revoked', input.certificate_id, { reason: input.reason });
  await notify('Certificate Revoked', `Certificate revoked: ${input.reason}`, input.certificate_id, ['employee', 'qa_manager', 'head_qa']);
}

export async function bulkIssueCertificates(ids: string[], actor: CertificateActor): Promise<number> {
  let count = 0;
  for (const id of ids) {
    try {
      await approveCertificate(id, actor);
      count++;
    } catch { /* skip */ }
  }
  return count;
}

export async function bulkRenewCertificates(
  ids: string[],
  newExpiryDate: string,
  actor: CertificateActor,
): Promise<number> {
  let count = 0;
  for (const id of ids) {
    try {
      await renewCertificate({ certificate_id: id, new_expiry_date: newExpiryDate, remarks: 'Bulk renewal' }, actor);
      count++;
    } catch { /* skip */ }
  }
  return count;
}

export async function autoIssueFromTrainingRecord(
  recordId: string,
  actor: CertificateActor,
): Promise<TrainingCertificateRecord | null> {
  const records = await listTrainingRecords();
  const record = records.find((r) => r.id === recordId || r.training_record_id === recordId);
  if (!record) return null;
  if (record.training_result === 'Fail') return null;

  const existing = (await listCertificates()).find((c) => c.training_record_id === record.id);
  if (existing) return existing;

  const issueDate = record.training_date || today();
  const expiry = new Date(issueDate);
  expiry.setFullYear(expiry.getFullYear() + 1);

  return createCertificate({
    employee_id: record.employee_id,
    employee_name: record.employee_name,
    department: record.department,
    designation: record.designation,
    training_record_id: record.id,
    training_topic: record.training_topic,
    training_type: record.training_type,
    document_number: record.document_number,
    document_version: record.sop_version,
    sop_number: record.document_number,
    trainer: record.trainer,
    assessment_score: record.assessment_score,
    result: record.training_result,
    competency_level: 'Competent',
    issue_date: issueDate,
    expiry_date: expiry.toISOString().slice(0, 10),
    renewal_required: true,
    remarks: 'Auto-issued on training completion',
  }, actor, true);
}

export async function processCertificateExpiryReminders(): Promise<number> {
  const certs = await listCertificates();
  const todayStr = today();
  const thirtyDays = new Date();
  thirtyDays.setDate(thirtyDays.getDate() + 30);
  const threshold = thirtyDays.toISOString().slice(0, 10);
  let count = 0;

  for (const cert of certs) {
    if (!cert.expiry_date || cert.certificate_status === 'Revoked') continue;

    if (cert.expiry_date <= threshold && cert.expiry_date >= todayStr) {
      if (cert.certificate_status !== 'Expiring Soon') {
        try {
          await updateDoc(doc(db(), CERTIFICATE_COLLECTION, cert.id), {
            certificate_status: 'Expiring Soon',
            updated_at: now(),
          });
          await notify('Certificate Expiring Soon', `${cert.certificate_number} expires ${cert.expiry_date}`, cert.id,
            ['employee', 'training_coordinator', 'qa_manager', 'head_qa']);
          count++;
        } catch { /* skip */ }
      }
    }

    if (cert.expiry_date < todayStr && cert.certificate_status !== 'Expired') {
      try {
        await updateDoc(doc(db(), CERTIFICATE_COLLECTION, cert.id), {
          certificate_status: 'Expired',
          updated_at: now(),
        });
        await notify('Certificate Expired', `${cert.certificate_number} has expired — retraining may be required`, cert.id,
          ['employee', 'training_coordinator', 'qa_manager', 'department_head']);
        try {
          const { autoCreateFromExpiredCertificate } = await import('./training-retraining-service');
          await autoCreateFromExpiredCertificate({
            employee_id: cert.employee_id,
            employee_name: cert.employee_name,
            department: cert.department,
            designation: cert.designation,
            training_topic: cert.training_topic,
            training_type: cert.training_type,
            original_training_id: cert.training_record_id,
            certificate_number: cert.certificate_number,
            trainer: cert.trainer,
          }, { id: 'system', name: 'System', role: 'training_coordinator' });
        } catch { /* optional */ }
        count++;
      } catch { /* skip */ }
    }
  }
  return count;
}

function getVerificationLog(): CertificateVerificationLog[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(VERIFY_LOG_KEY) || '[]');
  } catch { return []; }
}

function saveVerificationLog(entry: CertificateVerificationLog) {
  if (typeof window === 'undefined') return;
  const logs = getVerificationLog();
  localStorage.setItem(VERIFY_LOG_KEY, JSON.stringify([entry, ...logs].slice(0, 100)));
}

export async function verifyCertificate(
  verificationCode: string,
  certificateNumber?: string,
  actor?: CertificateActor,
): Promise<{ valid: boolean; certificate: TrainingCertificateRecord | null; message: string }> {
  const certs = await listCertificates();
  const cert = certs.find((c) =>
    c.verification_code === verificationCode
    && (!certificateNumber || c.certificate_number === certificateNumber),
  );

  const logEntry: CertificateVerificationLog = {
    id: `v-${Date.now()}`,
    certificate_id: cert?.id || '',
    certificate_number: cert?.certificate_number || certificateNumber || '',
    verification_code: verificationCode,
    verified_at: now(),
    verified_by: actor?.name || 'Public',
    result: 'Invalid',
  };

  if (!cert) {
    saveVerificationLog(logEntry);
    return { valid: false, certificate: null, message: 'Certificate not found or invalid verification code.' };
  }

  const todayStr = today();
  if (cert.expiry_date && cert.expiry_date < todayStr) {
    logEntry.result = 'Expired';
    saveVerificationLog(logEntry);
    if (actor) await audit(actor, 'certificate verified', cert.id, { result: 'Expired' });
    return { valid: false, certificate: cert, message: 'Certificate has expired.' };
  }

  if (cert.certificate_status === 'Revoked' || cert.certificate_status === 'Cancelled') {
    logEntry.result = 'Invalid';
    saveVerificationLog(logEntry);
    return { valid: false, certificate: cert, message: `Certificate is ${cert.certificate_status}.` };
  }

  logEntry.result = 'Valid';
  saveVerificationLog(logEntry);
  if (actor) await audit(actor, 'certificate verified', cert.id, { result: 'Valid' });
  return { valid: true, certificate: cert, message: 'Certificate is valid and active.' };
}

export async function logCertificateDownload(certId: string, actor: CertificateActor): Promise<void> {
  await audit(actor, 'certificate downloaded', certId, null);
}

export function exportCertificatesCsv(certs: TrainingCertificateRecord[]): void {
  const headers = [
    'Certificate #', 'Employee', 'Department', 'Training', 'Type', 'Status', 'Approval',
    'Issue Date', 'Expiry Date', 'Verification Code', 'Trainer', 'Score', 'Result',
  ];
  const rows = certs.map((c) => [
    c.certificate_number, c.employee_name, c.department, c.training_topic, c.training_type,
    c.certificate_status, c.approval_status, c.issue_date, c.expiry_date,
    c.verification_code, c.trainer, c.assessment_score ?? '', c.result,
  ]);
  downloadCsv('training-certificates.csv', headers, rows);
}

export function buildCertificatePrintHtml(cert: TrainingCertificateRecord): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Certificate ${cert.certificate_number}</title>
<style>
body{font-family:Georgia,serif;margin:40px;text-align:center;border:8px double #1e3a5f;padding:40px}
h1{color:#1e3a5f;margin-bottom:8px}.sub{color:#64748b;font-size:14px}
.details{margin:30px auto;max-width:500px;text-align:left;font-size:13px;line-height:1.8}
.qr{border:1px solid #ccc;padding:16px;margin:20px auto;width:120px;font-size:10px;font-family:monospace}
.sig{margin-top:40px;border-top:1px solid #ccc;padding-top:20px;font-size:12px}
</style></head><body>
<h1>Certificate of Training</h1>
<p class="sub">GMP Training Certificate — ${cert.certificate_number}</p>
<div class="details">
<p><strong>${cert.employee_name}</strong></p>
<p>${cert.department} · ${cert.designation}</p>
<p>has successfully completed</p>
<p><strong>${cert.training_topic}</strong></p>
<p>Training Type: ${cert.training_type}</p>
<p>Document: ${cert.document_number} ${cert.document_version}</p>
<p>Trainer: ${cert.trainer} · Result: ${cert.result}</p>
<p>Issue Date: ${cert.issue_date} · Expiry: ${cert.expiry_date}</p>
</div>
<div class="qr">QR: ${cert.qr_code_data || cert.verification_code}</div>
<p style="font-size:11px">Verification: ${cert.verification_code}</p>
<div class="sig">
<p>Approved By: ${cert.approved_by || 'Pending'} · ${cert.approved_date?.slice(0, 10) || ''}</p>
<p>21 CFR Part 11 · EU GMP Annex 11 · ALCOA+</p>
</div>
<script>window.onload=function(){window.print()}</script></body></html>`;
}

export function openCertificatePrint(cert: TrainingCertificateRecord): void {
  const html = buildCertificatePrintHtml(cert);
  const w = window.open('', '_blank');
  if (w) { w.document.write(html); w.document.close(); }
}
