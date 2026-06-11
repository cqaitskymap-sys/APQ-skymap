import {
  addDoc, collection, doc, getDoc, getDocs, limit, orderBy, query, updateDoc, where,
  type QueryConstraint,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { firestore, storage } from '@/lib/firebase';
import { logAuditEvent } from '@/lib/admin/admin-service';
import { createDeviation } from '@/lib/deviation-service';
import { downloadCsv } from '@/lib/export-utils';
import {
  CSV_COLLECTIONS, calcRpn, calcTraceabilityCoverage,
  type CsvSystem, type GxpAssessment, type CsvRiskAssessment, type UrsRecord,
  type FrsRecord, type DesignSpecRecord, type TestScript, type TraceabilityRow,
  type Part11Assessment, type CsvValidationReport, type PeriodicReview,
  type CsvAttachment, type CsvFilters, type CsvDashboardMetrics, type CsvActor,
} from './csv-mgmt-types';
import type {
  SystemCreateInput, GxpAssessmentInput, RiskAssessmentInput, UrsInput, FrsInput,
  DesignSpecInput, TestScriptInput, TraceabilityInput, Part11Input,
  ValidationReportInput, PeriodicReviewInput,
} from './csv-mgmt-schemas';

function now() { return new Date().toISOString(); }

async function audit(actor: CsvActor, action: string, recordId: string, oldValue: unknown, newValue: unknown, reason = '') {
  await logAuditEvent({
    userId: actor.id, userName: actor.name, module: 'CSV', recordId, action,
    oldValue: oldValue ? JSON.stringify(oldValue) : '',
    newValue: newValue ? JSON.stringify(newValue) : '',
    reason, ipAddress: 'client', device: typeof navigator !== 'undefined' ? navigator.userAgent : 'server',
    status: 'Success',
  });
}

async function notify(title: string, message: string, recordId: string, roles: string[]) {
  try {
    for (const role of roles) {
      await addDoc(collection(firestore, CSV_COLLECTIONS.notifications), {
        title, message, module: 'CSV', record_id: recordId, target_role: role,
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

async function applySystemAutoRules(systemId: string, system: Partial<CsvSystem>) {
  const updates: Partial<CsvSystem> = {
    validation_package_required: system.gxp_impact === true,
    part11_required: system.audit_trail_required === true || system.e_signature_required === true,
    updated_at: now(),
  };
  await updateDoc(doc(firestore, CSV_COLLECTIONS.systems, systemId), updates);
  if (system.gxp_impact) {
    await notify('CSV Validation Package Required', `GxP impact system requires full validation package`, systemId, ['qa_manager', 'it_csv']);
  }
  if (system.audit_trail_required || system.e_signature_required) {
    await notify('Part 11 Assessment Required', `System requires 21 CFR Part 11 assessment`, systemId, ['qa_manager', 'it_csv']);
  }
}

// ─── Systems ─────────────────────────────────────────────────────────────────

export async function createSystem(input: SystemCreateInput, actor: CsvActor): Promise<CsvSystem> {
  const systemId = await genNumber('SYS', CSV_COLLECTIONS.systems, 'system_id');
  const timestamp = now();
  const record: Omit<CsvSystem, 'id'> = {
    system_id: systemId,
    system_name: input.system_name,
    system_owner: input.system_owner,
    department: input.department,
    vendor: input.vendor,
    system_type: input.system_type,
    business_process: input.business_process,
    gxp_impact: input.gxp_impact,
    data_criticality: input.data_criticality,
    regulatory_impact: input.regulatory_impact,
    hosting_type: input.hosting_type,
    authentication_type: input.authentication_type,
    backup_required: input.backup_required,
    audit_trail_required: input.audit_trail_required,
    e_signature_required: input.e_signature_required,
    validation_status: input.validation_status,
    go_live_date: input.go_live_date || null,
    retirement_date: input.retirement_date || null,
    next_review_due: input.next_review_due || null,
    remarks: input.remarks,
    validation_package_required: input.gxp_impact,
    part11_required: input.audit_trail_required || input.e_signature_required,
    created_by: actor.id,
    created_by_name: actor.name,
    updated_by: actor.id,
    updated_by_name: actor.name,
    created_at: timestamp,
    updated_at: timestamp,
  };
  const refDoc = await addDoc(collection(firestore, CSV_COLLECTIONS.systems), record);
  await audit(actor, 'CREATE', refDoc.id, null, record);
  await applySystemAutoRules(refDoc.id, record);
  return { id: refDoc.id, ...record };
}

export async function getSystemById(id: string): Promise<CsvSystem | null> {
  const snap = await getDoc(doc(firestore, CSV_COLLECTIONS.systems, id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as CsvSystem;
}

export async function listSystems(filters?: CsvFilters): Promise<CsvSystem[]> {
  const constraints: QueryConstraint[] = [orderBy('updated_at', 'desc')];
  if (filters?.system_type) constraints.unshift(where('system_type', '==', filters.system_type));
  if (filters?.validation_status) constraints.unshift(where('validation_status', '==', filters.validation_status));
  if (filters?.department) constraints.unshift(where('department', '==', filters.department));

  let records: CsvSystem[];
  try {
    const snap = await getDocs(query(collection(firestore, CSV_COLLECTIONS.systems), ...constraints));
    records = snap.docs.map((d) => ({ id: d.id, ...d.data() } as CsvSystem));
  } catch {
    const snap = await getDocs(collection(firestore, CSV_COLLECTIONS.systems));
    records = snap.docs.map((d) => ({ id: d.id, ...d.data() } as CsvSystem));
  }

  if (filters?.gxp_impact !== undefined) records = records.filter((r) => r.gxp_impact === filters.gxp_impact);
  if (filters?.search) {
    const q = filters.search.toLowerCase();
    records = records.filter((r) =>
      r.system_id.toLowerCase().includes(q) || r.system_name.toLowerCase().includes(q) ||
      r.system_owner.toLowerCase().includes(q),
    );
  }
  return records;
}

export async function updateSystem(id: string, input: Partial<SystemCreateInput>, actor: CsvActor): Promise<CsvSystem> {
  const existing = await getSystemById(id);
  if (!existing) throw new Error('System not found');
  const updates = {
    ...input,
    validation_package_required: input.gxp_impact ?? existing.gxp_impact,
    part11_required: (input.audit_trail_required ?? existing.audit_trail_required) ||
      (input.e_signature_required ?? existing.e_signature_required),
    updated_by: actor.id,
    updated_by_name: actor.name,
    updated_at: now(),
  };
  await updateDoc(doc(firestore, CSV_COLLECTIONS.systems, id), updates);
  await audit(actor, 'EDIT', id, existing, updates);
  await applySystemAutoRules(id, { ...existing, ...updates });
  return { ...existing, ...updates } as CsvSystem;
}

// ─── Generic list helper ───────────────────────────────────────────────────────

async function listBySystem<T>(coll: string, systemId?: string, orderField = 'created_at'): Promise<T[]> {
  try {
    const constraints: QueryConstraint[] = [orderBy(orderField, 'desc')];
    if (systemId) constraints.unshift(where('system_id', '==', systemId));
    const snap = await getDocs(query(collection(firestore, coll), ...constraints));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as T));
  } catch {
    const snap = systemId
      ? await getDocs(query(collection(firestore, coll), where('system_id', '==', systemId)))
      : await getDocs(collection(firestore, coll));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as T));
  }
}

// ─── GxP Assessment ──────────────────────────────────────────────────────────

export async function saveGxpAssessment(input: GxpAssessmentInput, actor: CsvActor): Promise<GxpAssessment> {
  const existing = (await listBySystem<GxpAssessment>(CSV_COLLECTIONS.gxpAssessment, input.system_id))[0];
  const data: Omit<GxpAssessment, 'id'> = {
    ...input,
    assessed_by: actor.id,
    assessed_by_name: actor.name,
    status: 'Approved',
    created_at: existing?.created_at || now(),
    updated_at: now(),
  };
  if (existing) {
    await updateDoc(doc(firestore, CSV_COLLECTIONS.gxpAssessment, existing.id), data);
    await audit(actor, 'GXP_ASSESSMENT', input.system_id, existing, data);
    return { id: existing.id, ...data };
  }
  const refDoc = await addDoc(collection(firestore, CSV_COLLECTIONS.gxpAssessment), data);
  await audit(actor, 'GXP_ASSESSMENT', input.system_id, null, data);
  if (input.gxp_classification === 'GxP Critical') {
    await updateDoc(doc(firestore, CSV_COLLECTIONS.systems, input.system_id), { gxp_impact: true, validation_package_required: true, updated_at: now() });
  }
  return { id: refDoc.id, ...data };
}

export async function listGxpAssessments(systemId?: string) {
  return listBySystem<GxpAssessment>(CSV_COLLECTIONS.gxpAssessment, systemId);
}

// ─── Risk Assessment ─────────────────────────────────────────────────────────

export async function createRiskAssessment(input: RiskAssessmentInput, actor: CsvActor): Promise<CsvRiskAssessment> {
  const { rpn, risk_level } = calcRpn(input.severity, input.occurrence, input.detectability);
  const record: Omit<CsvRiskAssessment, 'id'> = {
    ...input, rpn, risk_level,
    created_at: now(), updated_at: now(),
  };
  const refDoc = await addDoc(collection(firestore, CSV_COLLECTIONS.riskAssessment), record);
  await audit(actor, 'RISK_ASSESSMENT', input.system_id, null, record);
  return { id: refDoc.id, ...record };
}

export async function listRiskAssessments(systemId?: string) {
  return listBySystem<CsvRiskAssessment>(CSV_COLLECTIONS.riskAssessment, systemId);
}

// ─── URS ─────────────────────────────────────────────────────────────────────

export async function createUrs(input: UrsInput, actor: CsvActor): Promise<UrsRecord> {
  const ursId = await genNumber('URS', CSV_COLLECTIONS.urs, 'urs_id');
  const record: Omit<UrsRecord, 'id'> = { ...input, urs_id: ursId, created_at: now(), updated_at: now() };
  const refDoc = await addDoc(collection(firestore, CSV_COLLECTIONS.urs), record);
  await audit(actor, 'URS_CREATE', input.system_id, null, record);
  return { id: refDoc.id, ...record };
}

export async function listUrs(systemId?: string) {
  return listBySystem<UrsRecord>(CSV_COLLECTIONS.urs, systemId, 'requirement_no');
}

// ─── FRS ─────────────────────────────────────────────────────────────────────

export async function createFrs(input: FrsInput, actor: CsvActor): Promise<FrsRecord> {
  const frsId = await genNumber('FRS', CSV_COLLECTIONS.frs, 'frs_id');
  const record: Omit<FrsRecord, 'id'> = { ...input, frs_id: frsId, created_at: now(), updated_at: now() };
  const refDoc = await addDoc(collection(firestore, CSV_COLLECTIONS.frs), record);
  await audit(actor, 'FRS_CREATE', input.system_id, null, record);
  return { id: refDoc.id, ...record };
}

export async function listFrs(systemId?: string) {
  return listBySystem<FrsRecord>(CSV_COLLECTIONS.frs, systemId);
}

// ─── Design Spec ─────────────────────────────────────────────────────────────

export async function createDesignSpec(input: DesignSpecInput, actor: CsvActor): Promise<DesignSpecRecord> {
  const dsId = await genNumber('DS', CSV_COLLECTIONS.designSpec, 'ds_id');
  const record: Omit<DesignSpecRecord, 'id'> = { ...input, ds_id: dsId, created_at: now(), updated_at: now() };
  const refDoc = await addDoc(collection(firestore, CSV_COLLECTIONS.designSpec), record);
  await audit(actor, 'DS_CREATE', input.system_id, null, record);
  return { id: refDoc.id, ...record };
}

export async function listDesignSpecs(systemId?: string) {
  return listBySystem<DesignSpecRecord>(CSV_COLLECTIONS.designSpec, systemId);
}

// ─── Test Scripts ────────────────────────────────────────────────────────────

async function createDeviationFromTest(system: CsvSystem, test: TestScriptInput, actor: CsvActor): Promise<string | null> {
  try {
    const dev = await createDeviation({
      title: `CSV test failure — ${system.system_name} ${test.test_phase}`,
      description: `Failed ${test.test_phase} test ${test.test_script_no}: ${test.test_objective || test.test_steps}`,
      department: system.department === 'IT / CSV' ? 'QA' : system.department,
      product_name: 'N/A',
      area: system.system_name,
      category: 'Software / CSV',
      criticality: 'Major',
      planned_type: 'Unplanned',
      immediate_action: 'Investigation initiated from CSV test execution',
      reported_by_name: actor.name,
      detected_by_name: actor.name,
      deviation_date: now().split('T')[0],
    }, { id: actor.id, name: actor.name, role: actor.role }, {
      status: 'draft', source: 'manual', source_reference: `${system.system_id}-${test.test_script_no}`,
    });
    await updateDoc(doc(firestore, CSV_COLLECTIONS.systems, system.id), {
      validation_status: 'Deviation Observed', updated_at: now(),
    });
    await notify('CSV Test Failure', `${test.test_phase} test failed for ${system.system_name}`, system.id, ['qa_manager', 'it_csv']);
    return dev.deviation_number;
  } catch (e) {
    console.error('Deviation creation failed:', e);
    return null;
  }
}

export async function createTestScript(input: TestScriptInput, actor: CsvActor): Promise<TestScript> {
  const system = await getSystemById(input.system_id);
  if (!system) throw new Error('System not found');

  let deviationNumber: string | null = null;
  if (input.pass_fail === 'Fail') {
    deviationNumber = await createDeviationFromTest(system, input, actor);
  }

  const record: Omit<TestScript, 'id'> = {
    ...input,
    deviation_number: deviationNumber,
    executed_by: actor.id,
    executed_by_name: actor.name,
    execution_date: input.execution_date || now().split('T')[0],
    evidence_url: '',
    status: input.pass_fail === 'Fail' ? 'Deviation Observed' : input.pass_fail === 'Pass' ? 'Completed' : 'Draft',
    created_at: now(),
    updated_at: now(),
  };
  const refDoc = await addDoc(collection(firestore, CSV_COLLECTIONS.testScripts), record);
  await audit(actor, 'TEST_EXECUTION', input.system_id, null, record);
  return { id: refDoc.id, ...record };
}

export async function listTestScripts(systemId?: string, phase?: string) {
  let scripts = await listBySystem<TestScript>(CSV_COLLECTIONS.testScripts, systemId, 'test_script_no');
  if (phase) scripts = scripts.filter((s) => s.test_phase === phase);
  return scripts;
}

export async function uploadTestEvidence(
  systemId: string, testId: string, file: File, actor: CsvActor,
): Promise<string> {
  const path = `csv/${systemId}/tests/${testId}_${Date.now()}_${file.name}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  const url = await getDownloadURL(storageRef);
  await updateDoc(doc(firestore, CSV_COLLECTIONS.testScripts, testId), { evidence_url: url, updated_at: now() });
  await audit(actor, 'ATTACHMENT_UPLOAD', systemId, null, { testId, file: file.name });
  return url;
}

// ─── Traceability ────────────────────────────────────────────────────────────

export async function saveTraceabilityRow(input: TraceabilityInput, actor: CsvActor): Promise<TraceabilityRow> {
  const record: Omit<TraceabilityRow, 'id'> = {
    ...input,
    gap_identified: input.gap_identified || !input.frs_no || !input.ds_no,
    created_at: now(), updated_at: now(),
  };
  const refDoc = await addDoc(collection(firestore, CSV_COLLECTIONS.traceability), record);
  await audit(actor, 'TRACEABILITY_UPDATE', input.system_id, null, record);
  return { id: refDoc.id, ...record };
}

export async function listTraceability(systemId?: string) {
  return listBySystem<TraceabilityRow>(CSV_COLLECTIONS.traceability, systemId, 'urs_no');
}

export async function getTraceabilityCoverage(systemId: string): Promise<number> {
  const rows = await listTraceability(systemId);
  return calcTraceabilityCoverage(rows);
}

// ─── Part 11 ─────────────────────────────────────────────────────────────────

export async function savePart11Assessment(input: Part11Input, actor: CsvActor): Promise<Part11Assessment> {
  const checks = [
    input.audit_trail_available, input.audit_trail_secure, input.audit_trail_reviewable,
    input.password_policy_available, input.user_access_control, input.data_backup,
    input.record_retention, input.time_stamped_records, input.system_security,
  ];
  if (input.e_signature_available !== undefined) checks.push(input.e_signature_available);
  const passed = checks.filter(Boolean).length;
  const assessment_result = passed >= checks.length * 0.8 ? 'Compliant' : passed >= checks.length * 0.5 ? 'Partial' : 'Non-Compliant';
  const gap_action = assessment_result !== 'Compliant' ? 'Remediation required per gap analysis' : '';

  const existing = (await listBySystem<Part11Assessment>(CSV_COLLECTIONS.part11, input.system_id))[0];
  const data: Omit<Part11Assessment, 'id'> = {
    ...input, assessment_result, gap_action, status: 'Approved',
    created_at: existing?.created_at || now(), updated_at: now(),
  };
  if (existing) {
    await updateDoc(doc(firestore, CSV_COLLECTIONS.part11, existing.id), data);
    return { id: existing.id, ...data };
  }
  const refDoc = await addDoc(collection(firestore, CSV_COLLECTIONS.part11), data);
  await audit(actor, 'PART11_ASSESSMENT', input.system_id, null, data);
  if (assessment_result !== 'Compliant') {
    await notify('Part 11 Gap Identified', `Part 11 assessment gaps for ${input.system_name}`, input.system_id, ['qa_manager', 'it_csv']);
  }
  return { id: refDoc.id, ...data };
}

export async function listPart11Assessments(systemId?: string) {
  return listBySystem<Part11Assessment>(CSV_COLLECTIONS.part11, systemId);
}

// ─── Validation Report ─────────────────────────────────────────────────────────

export async function saveValidationReport(input: ValidationReportInput, actor: CsvActor): Promise<CsvValidationReport> {
  const coverage = await getTraceabilityCoverage(input.system_id);
  const existing = (await listBySystem<CsvValidationReport>(CSV_COLLECTIONS.validationReports, input.system_id))[0];
  const data: Omit<CsvValidationReport, 'id'> = {
    ...input,
    requirement_coverage_percent: input.requirement_coverage_percent || coverage,
    approved_by: actor.id,
    approved_by_name: actor.name,
    status: 'Approved',
    created_at: existing?.created_at || now(),
    updated_at: now(),
  };
  if (existing) {
    await updateDoc(doc(firestore, CSV_COLLECTIONS.validationReports, existing.id), data);
    return { id: existing.id, ...data };
  }
  const refDoc = await addDoc(collection(firestore, CSV_COLLECTIONS.validationReports), data);
  await audit(actor, 'VALIDATION_REPORT', input.system_id, null, data);
  if (input.recommended_status === 'Validated') {
    await updateDoc(doc(firestore, CSV_COLLECTIONS.systems, input.system_id), {
      validation_status: 'Validated', updated_at: now(),
    });
  }
  return { id: refDoc.id, ...data };
}

export async function listValidationReports(systemId?: string) {
  return listBySystem<CsvValidationReport>(CSV_COLLECTIONS.validationReports, systemId);
}

// ─── Periodic Review ─────────────────────────────────────────────────────────

export async function savePeriodicReview(input: PeriodicReviewInput, actor: CsvActor): Promise<PeriodicReview> {
  const record: Omit<PeriodicReview, 'id'> = {
    ...input, status: 'Completed', created_at: now(), updated_at: now(),
  };
  const refDoc = await addDoc(collection(firestore, CSV_COLLECTIONS.periodicReviews), record);
  await updateDoc(doc(firestore, CSV_COLLECTIONS.systems, input.system_id), {
    next_review_due: input.next_review_due, updated_at: now(),
  });
  await audit(actor, 'PERIODIC_REVIEW', input.system_id, null, record);
  return { id: refDoc.id, ...record };
}

export async function listPeriodicReviews(systemId?: string) {
  return listBySystem<PeriodicReview>(CSV_COLLECTIONS.periodicReviews, systemId);
}

export async function syncPeriodicReviewDue(): Promise<number> {
  const today = now().split('T')[0];
  const snap = await getDocs(collection(firestore, CSV_COLLECTIONS.systems));
  let count = 0;
  for (const d of snap.docs) {
    const data = d.data() as CsvSystem;
    if (data.next_review_due && data.next_review_due <= today && data.validation_status !== 'Retired') {
      await notify('CSV Periodic Review Due', `${data.system_name} periodic review overdue`, d.id, ['qa_manager', 'it_csv', 'head_qa']);
      count++;
    }
  }
  return count;
}

// ─── Attachments ─────────────────────────────────────────────────────────────

export async function uploadCsvAttachment(
  systemId: string, file: File, category: string, actor: CsvActor,
): Promise<CsvAttachment> {
  const path = `csv/${systemId}/${Date.now()}_${file.name}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  const downloadUrl = await getDownloadURL(storageRef);
  const attachment: Omit<CsvAttachment, 'id'> = {
    system_id: systemId, file_name: file.name, file_type: file.type, file_size: file.size,
    category, storage_path: path, download_url: downloadUrl,
    uploaded_by: actor.id, uploaded_by_name: actor.name, uploaded_at: now(),
  };
  const refDoc = await addDoc(collection(firestore, CSV_COLLECTIONS.attachments), attachment);
  await audit(actor, 'ATTACHMENT_UPLOAD', systemId, null, { file_name: file.name, category });
  return { id: refDoc.id, ...attachment };
}

export async function getCsvAttachments(systemId: string): Promise<CsvAttachment[]> {
  return listBySystem<CsvAttachment>(CSV_COLLECTIONS.attachments, systemId, 'uploaded_at');
}

export async function getAuditLogsForSystem(systemId: string): Promise<Record<string, unknown>[]> {
  try {
    const snap = await getDocs(query(
      collection(firestore, CSV_COLLECTIONS.auditLogs),
      where('recordId', '==', systemId), where('module', '==', 'CSV'),
      orderBy('dateTime', 'desc'), limit(100),
    ));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch {
    return [];
  }
}

// ─── Dashboard ───────────────────────────────────────────────────────────────

export function computeDashboardMetrics(
  systems: CsvSystem[], tests: TestScript[], part11: Part11Assessment[],
): CsvDashboardMetrics {
  const today = now().split('T')[0];
  return {
    total: systems.length,
    gxpCritical: systems.filter((s) => s.gxp_impact).length,
    validated: systems.filter((s) => s.validation_status === 'Validated').length,
    validationPending: systems.filter((s) => !['Validated', 'Retired', 'Rejected'].includes(s.validation_status)).length,
    periodicReviewDue: systems.filter((s) => s.next_review_due && s.next_review_due <= today).length,
    openDeviations: tests.filter((t) => t.pass_fail === 'Fail' && t.deviation_number).length,
    part11Gaps: part11.filter((p) => p.assessment_result !== 'Compliant').length,
    retired: systems.filter((s) => s.validation_status === 'Retired').length,
  };
}

export function csvChartData(systems: CsvSystem[], risks: CsvRiskAssessment[]) {
  const byType: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  const byGxp: Record<string, number> = { 'GxP Critical': 0, 'GxP Non-Critical': 0, 'Non-GxP': 0 };
  const reviewTrend: Record<string, number> = {};
  const riskDist: Record<string, number> = {};

  for (const s of systems) {
    byType[s.system_type] = (byType[s.system_type] || 0) + 1;
    byStatus[s.validation_status] = (byStatus[s.validation_status] || 0) + 1;
    if (s.gxp_impact) byGxp['GxP Critical']++;
    else byGxp['Non-GxP']++;
    if (s.next_review_due) {
      const month = s.next_review_due.slice(0, 7);
      reviewTrend[month] = (reviewTrend[month] || 0) + 1;
    }
  }
  for (const r of risks) {
    riskDist[r.risk_level] = (riskDist[r.risk_level] || 0) + 1;
  }

  const toChart = (obj: Record<string, number>) =>
    Object.entries(obj).map(([name, value]) => ({ name, value }));

  return {
    byType: toChart(byType),
    byStatus: toChart(byStatus),
    byGxp: toChart(byGxp),
    reviewTrend: Object.entries(reviewTrend).sort().map(([month, value]) => ({ month, value })),
    riskDist: toChart(riskDist),
  };
}

export async function listValidatedSystemsForPqr(): Promise<CsvSystem[]> {
  return (await listSystems({})).filter((s) => s.validation_status === 'Validated');
}

export async function exportSystemsCsv(systems: CsvSystem[]) {
  downloadCsv(
    `csv-systems-${now().split('T')[0]}.csv`,
    ['System ID', 'Name', 'Type', 'Owner', 'Department', 'GxP', 'Status'],
    systems.map((s) => [s.system_id, s.system_name, s.system_type, s.system_owner, s.department, s.gxp_impact ? 'Yes' : 'No', s.validation_status]),
  );
}
