import {
  addDoc, collection, doc, getDoc, getDocs, limit, orderBy, query, updateDoc, where,
  type QueryConstraint,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getFirebaseFirestore, getFirebaseStorage } from '@/lib/firebase';
import { logAuditEvent } from '@/lib/admin/admin-service';
import { createDeviation } from '@/lib/deviation-service';
import { downloadCsv } from '@/lib/export-utils';
import {
  MONITORING_COLLECTIONS, classifyMonitoringValue, isCriticalGrade,
  type AreaRecord, type EnvironmentalRecord, type UtilityRecord, type ExcursionRecord,
  type MonitoringAttachment, type AreaFilters, type MonitoringFilters,
  type MonitoringDashboardMetrics, type MonitoringActor,
} from './monitoring-mgmt-types';
import type { AreaCreateInput, EnvironmentalInput, UtilityInput } from './monitoring-mgmt-schemas';

function now() { return new Date().toISOString(); }
function today() { return now().split('T')[0]; }

async function auditLog(actor: MonitoringActor, action: string, recordId: string, oldValue: unknown, newValue: unknown, reason = '') {
  await logAuditEvent({
    userId: actor.id, userName: actor.name, module: 'Monitoring', recordId, action,
    oldValue: oldValue ? JSON.stringify(oldValue) : '',
    newValue: newValue ? JSON.stringify(newValue) : '',
    reason, ipAddress: 'client', device: typeof navigator !== 'undefined' ? navigator.userAgent : 'server',
    status: 'Success',
  });
}

async function notify(title: string, message: string, recordId: string, roles: string[]) {
  try {
    for (const role of roles) {
      await addDoc(collection(getFirebaseFirestore(), MONITORING_COLLECTIONS.notifications), {
        title, message, module: 'Monitoring', record_id: recordId, target_role: role,
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
      collection(getFirebaseFirestore(), collName),
      where(field, '>=', p), where(field, '<=', `${p}\uf8ff`),
      orderBy(field, 'desc'), limit(1),
    ));
    if (!snap.empty) {
      const last = snap.docs[0].data()[field] as string;
      return `${p}${String(parseInt(last.split('-').pop() || '0', 10) + 1).padStart(4, '0')}`;
    }
  } catch {
    const all = await getDocs(collection(getFirebaseFirestore(), collName));
    return `${p}${String(all.size + 1).padStart(4, '0')}`;
  }
  return `${p}0001`;
}

async function createDeviationFromExcursion(
  source: { area_name: string; parameter_name: string; observed_value: number; lower_limit: number; upper_limit: number; unit: string; cleanroom_grade: string; date: string },
  actor: MonitoringActor,
  category: 'Environmental' | 'Utility',
) {
  try {
    const dept = category === 'Utility' ? 'Engineering' : 'Microbiology';
    return await createDeviation({
      title: `${category} monitoring excursion — ${source.parameter_name}`,
      description: `${source.area_name}: ${source.parameter_name} = ${source.observed_value} ${source.unit} (limits ${source.lower_limit}–${source.upper_limit})`,
      department: dept,
      product_name: 'N/A',
      area: source.area_name,
      category,
      criticality: isCriticalGrade(source.cleanroom_grade) ? 'Critical' : 'Major',
      planned_type: 'Unplanned',
      immediate_action: 'Excursion detected — investigation required',
      reported_by_name: actor.name,
      detected_by_name: actor.name,
      deviation_date: source.date,
    }, { id: actor.id, name: actor.name, role: actor.role }, {
      status: 'draft', source: 'manual', source_reference: source.parameter_name,
    });
  } catch { return null; }
}

async function checkRepeatedExcursion(areaName: string, parameterName: string): Promise<boolean> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);
  const cutoffStr = cutoff.toISOString().split('T')[0];
  try {
    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), MONITORING_COLLECTIONS.excursions),
      where('area_name', '==', areaName),
      where('parameter_name', '==', parameterName),
      where('excursion_date', '>=', cutoffStr),
    ));
    return snap.size >= 2;
  } catch { return false; }
}

async function createExcursionRecord(
  sourceType: 'environmental' | 'utility',
  sourceRecord: EnvironmentalRecord | UtilityRecord,
  actor: MonitoringActor,
  cleanroomGrade: string,
  areaName: string,
): Promise<ExcursionRecord | null> {
  const status = sourceRecord.status;
  if (status !== 'Excursion') return null;

  const excursionNo = await genNumber('EXC', MONITORING_COLLECTIONS.excursions, 'excursion_number');
  const isCritical = isCriticalGrade(cleanroomGrade);
  const isRepeated = await checkRepeatedExcursion(areaName, sourceRecord.parameter_name);

  let deviation: Awaited<ReturnType<typeof createDeviationFromExcursion>> = null;
  deviation = await createDeviationFromExcursion({
    area_name: areaName,
    parameter_name: sourceRecord.parameter_name,
    observed_value: sourceRecord.observed_value,
    lower_limit: sourceRecord.lower_limit,
    upper_limit: sourceRecord.upper_limit,
    unit: sourceRecord.unit,
    cleanroom_grade: cleanroomGrade,
    date: sourceRecord.monitoring_date,
  }, actor, sourceType === 'environmental' ? 'Environmental' : 'Utility');

  const record: Omit<ExcursionRecord, 'id'> = {
    excursion_number: excursionNo,
    source_type: sourceType,
    source_record_id: sourceRecord.id,
    source_record_no: sourceType === 'environmental'
      ? (sourceRecord as EnvironmentalRecord).monitoring_number
      : (sourceRecord as UtilityRecord).utility_record_no,
    area_name: areaName,
    parameter_name: sourceRecord.parameter_name,
    observed_value: sourceRecord.observed_value,
    lower_limit: sourceRecord.lower_limit,
    upper_limit: sourceRecord.upper_limit,
    unit: sourceRecord.unit,
    cleanroom_grade: cleanroomGrade,
    excursion_date: sourceRecord.monitoring_date,
    status: 'Open',
    is_critical_area: isCritical,
    is_repeated: isRepeated,
    linked_deviation_id: deviation?.id || null,
    linked_deviation_number: deviation?.deviation_number || null,
    capa_recommended: isRepeated,
    closed_by: '',
    closed_by_name: '',
    closed_at: null,
    remarks: '',
    created_at: now(),
    updated_at: now(),
  };

  const refDoc = await addDoc(collection(getFirebaseFirestore(), MONITORING_COLLECTIONS.excursions), record);
  await auditLog(actor, 'EXCURSION', refDoc.id, null, record);

  if (isCritical) {
    await notify('Critical Area Excursion', `${areaName}: ${sourceRecord.parameter_name} excursion — QA review required`, refDoc.id, ['qa_manager', 'head_qa']);
  } else {
    await notify('Monitoring Excursion', `${areaName}: ${sourceRecord.parameter_name} outside limits`, refDoc.id, ['qa_manager']);
  }
  if (isRepeated) {
    await notify('Repeated Excursion — CAPA Recommended', `${areaName}: ${sourceRecord.parameter_name} — 3rd excursion in 90 days`, refDoc.id, ['qa_manager', 'head_qa']);
  }

  return { id: refDoc.id, ...record };
}

// ─── Area Master ─────────────────────────────────────────────────────────────

export async function createArea(input: AreaCreateInput, actor: MonitoringActor): Promise<AreaRecord> {
  const areaCode = await genNumber('AREA', MONITORING_COLLECTIONS.areaMaster, 'area_code');
  const timestamp = now();
  const record: Omit<AreaRecord, 'id'> = {
    area_code: areaCode,
    area_name: input.area_name,
    department: input.department,
    room_number: input.room_number,
    cleanroom_grade: input.cleanroom_grade,
    process_area: input.process_area,
    monitoring_required: input.monitoring_required,
    temperature_limit_lower: input.temperature_limit_lower ?? null,
    temperature_limit_upper: input.temperature_limit_upper ?? null,
    rh_limit_lower: input.rh_limit_lower ?? null,
    rh_limit_upper: input.rh_limit_upper ?? null,
    dp_limit_lower: input.dp_limit_lower ?? null,
    dp_limit_upper: input.dp_limit_upper ?? null,
    area_status: input.area_status,
    remarks: input.remarks,
    created_by: actor.id,
    created_by_name: actor.name,
    updated_by: actor.id,
    updated_by_name: actor.name,
    created_at: timestamp,
    updated_at: timestamp,
  };
  const refDoc = await addDoc(collection(getFirebaseFirestore(), MONITORING_COLLECTIONS.areaMaster), record);
  await auditLog(actor, 'CREATE', refDoc.id, null, record);
  return { id: refDoc.id, ...record };
}

export async function getAreaById(id: string): Promise<AreaRecord | null> {
  const snap = await getDoc(doc(getFirebaseFirestore(), MONITORING_COLLECTIONS.areaMaster, id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as AreaRecord;
}

export async function listAreas(filters?: AreaFilters): Promise<AreaRecord[]> {
  const constraints: QueryConstraint[] = [orderBy('updated_at', 'desc')];
  if (filters?.cleanroom_grade) constraints.unshift(where('cleanroom_grade', '==', filters.cleanroom_grade));
  if (filters?.area_status) constraints.unshift(where('area_status', '==', filters.area_status));
  if (filters?.department) constraints.unshift(where('department', '==', filters.department));
  const snap = await getDocs(query(collection(getFirebaseFirestore(), MONITORING_COLLECTIONS.areaMaster), ...constraints));
  let rows = snap.docs.map((d) => ({ id: d.id, ...d.data() } as AreaRecord));
  if (filters?.search) {
    const s = filters.search.toLowerCase();
    rows = rows.filter((a) =>
      a.area_code.toLowerCase().includes(s) || a.area_name.toLowerCase().includes(s) || a.room_number.toLowerCase().includes(s),
    );
  }
  return rows;
}

export async function updateArea(id: string, input: Partial<AreaCreateInput>, actor: MonitoringActor): Promise<AreaRecord> {
  const existing = await getAreaById(id);
  if (!existing) throw new Error('Area not found');
  const updates = { ...input, updated_by: actor.id, updated_by_name: actor.name, updated_at: now() };
  await updateDoc(doc(getFirebaseFirestore(), MONITORING_COLLECTIONS.areaMaster, id), updates);
  await auditLog(actor, 'UPDATE', id, existing, updates);
  return { ...(await getAreaById(id))! };
}

// ─── Environmental Monitoring ──────────────────────────────────────────────────

export async function createEnvironmental(input: EnvironmentalInput, actor: MonitoringActor): Promise<EnvironmentalRecord> {
  const monitoringNo = await genNumber('EM', MONITORING_COLLECTIONS.environmental, 'monitoring_number');
  const status = classifyMonitoringValue(input.observed_value, input.lower_limit, input.upper_limit);
  const timestamp = now();
  const record: Omit<EnvironmentalRecord, 'id'> = {
    monitoring_number: monitoringNo,
    monitoring_date: input.monitoring_date,
    monitoring_time: input.monitoring_time || new Date().toTimeString().slice(0, 5),
    area_doc_id: input.area_doc_id,
    area_name: input.area_name,
    room_number: input.room_number,
    cleanroom_grade: input.cleanroom_grade,
    product_name: input.product_name,
    batch_number: input.batch_number,
    monitoring_type: input.monitoring_type,
    parameter_name: input.parameter_name,
    observed_value: input.observed_value,
    lower_limit: input.lower_limit,
    upper_limit: input.upper_limit,
    unit: input.unit,
    status,
    recorded_by: actor.id,
    recorded_by_name: actor.name,
    reviewed_by: '',
    reviewed_by_name: '',
    remarks: input.remarks,
    linked_excursion_id: null,
    linked_deviation_id: null,
    linked_deviation_number: null,
    created_at: timestamp,
    updated_at: timestamp,
  };
  const refDoc = await addDoc(collection(getFirebaseFirestore(), MONITORING_COLLECTIONS.environmental), record);
  const full = { id: refDoc.id, ...record };
  await auditLog(actor, 'ENV_MONITORING', refDoc.id, null, record);

  if (status === 'Excursion') {
    const exc = await createExcursionRecord('environmental', full, actor, input.cleanroom_grade, input.area_name);
    if (exc) {
      await updateDoc(doc(getFirebaseFirestore(), MONITORING_COLLECTIONS.environmental, refDoc.id), {
        linked_excursion_id: exc.id,
        linked_deviation_id: exc.linked_deviation_id,
        linked_deviation_number: exc.linked_deviation_number,
        status: 'Under Review',
      });
      full.linked_excursion_id = exc.id;
      full.linked_deviation_id = exc.linked_deviation_id;
      full.linked_deviation_number = exc.linked_deviation_number;
      full.status = 'Under Review';
    }
  }
  return full;
}

export async function listEnvironmental(filters?: MonitoringFilters, areaDocId?: string): Promise<EnvironmentalRecord[]> {
  const constraints: QueryConstraint[] = [orderBy('monitoring_date', 'desc')];
  if (areaDocId) constraints.unshift(where('area_doc_id', '==', areaDocId));
  if (filters?.status) constraints.unshift(where('status', '==', filters.status));
  if (filters?.monitoring_type) constraints.unshift(where('monitoring_type', '==', filters.monitoring_type));
  const snap = await getDocs(query(collection(getFirebaseFirestore(), MONITORING_COLLECTIONS.environmental), ...constraints));
  let rows = snap.docs.map((d) => ({ id: d.id, ...d.data() } as EnvironmentalRecord));
  if (filters?.search) {
    const s = filters.search.toLowerCase();
    rows = rows.filter((r) => r.monitoring_number.toLowerCase().includes(s) || r.area_name.toLowerCase().includes(s) || r.batch_number.toLowerCase().includes(s));
  }
  if (filters?.date_from) rows = rows.filter((r) => r.monitoring_date >= filters.date_from!);
  if (filters?.date_to) rows = rows.filter((r) => r.monitoring_date <= filters.date_to!);
  return rows;
}

// ─── Utility Monitoring ──────────────────────────────────────────────────────

export async function createUtility(input: UtilityInput, actor: MonitoringActor): Promise<UtilityRecord> {
  const recordNo = await genNumber('UTL', MONITORING_COLLECTIONS.utility, 'utility_record_no');
  const status = classifyMonitoringValue(input.observed_value, input.lower_limit, input.upper_limit);
  const timestamp = now();
  const record: Omit<UtilityRecord, 'id'> = {
    utility_record_no: recordNo,
    monitoring_date: input.monitoring_date,
    monitoring_time: input.monitoring_time || new Date().toTimeString().slice(0, 5),
    utility_type: input.utility_type,
    sampling_point: input.sampling_point,
    parameter_name: input.parameter_name,
    observed_value: input.observed_value,
    lower_limit: input.lower_limit,
    upper_limit: input.upper_limit,
    unit: input.unit,
    status,
    recorded_by: actor.id,
    recorded_by_name: actor.name,
    reviewed_by: '',
    reviewed_by_name: '',
    remarks: input.remarks,
    linked_excursion_id: null,
    linked_deviation_id: null,
    linked_deviation_number: null,
    capa_recommended: false,
    created_at: timestamp,
    updated_at: timestamp,
  };
  const refDoc = await addDoc(collection(getFirebaseFirestore(), MONITORING_COLLECTIONS.utility), record);
  const full = { id: refDoc.id, ...record };
  await auditLog(actor, 'UTILITY_MONITORING', refDoc.id, null, record);

  if (status === 'Excursion') {
    const isRepeated = await checkRepeatedExcursion(input.sampling_point, input.parameter_name);
    const exc = await createExcursionRecord('utility', full, actor, 'Unclassified', input.sampling_point);
    if (exc) {
      const updates: Partial<UtilityRecord> = {
        linked_excursion_id: exc.id,
        linked_deviation_id: exc.linked_deviation_id,
        linked_deviation_number: exc.linked_deviation_number,
        capa_recommended: isRepeated,
        status: 'Under Review',
      };
      await updateDoc(doc(getFirebaseFirestore(), MONITORING_COLLECTIONS.utility, refDoc.id), updates);
      Object.assign(full, updates);
    }
  }
  return full;
}

export async function listUtility(filters?: MonitoringFilters): Promise<UtilityRecord[]> {
  const constraints: QueryConstraint[] = [orderBy('monitoring_date', 'desc')];
  if (filters?.status) constraints.unshift(where('status', '==', filters.status));
  if (filters?.utility_type) constraints.unshift(where('utility_type', '==', filters.utility_type));
  const snap = await getDocs(query(collection(getFirebaseFirestore(), MONITORING_COLLECTIONS.utility), ...constraints));
  let rows = snap.docs.map((d) => ({ id: d.id, ...d.data() } as UtilityRecord));
  if (filters?.search) {
    const s = filters.search.toLowerCase();
    rows = rows.filter((r) => r.utility_record_no.toLowerCase().includes(s) || r.sampling_point.toLowerCase().includes(s));
  }
  return rows;
}

// ─── Excursions ──────────────────────────────────────────────────────────────

export async function listExcursions(filters?: { status?: string }): Promise<ExcursionRecord[]> {
  const constraints: QueryConstraint[] = [orderBy('excursion_date', 'desc')];
  if (filters?.status) constraints.unshift(where('status', '==', filters.status));
  const snap = await getDocs(query(collection(getFirebaseFirestore(), MONITORING_COLLECTIONS.excursions), ...constraints));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as ExcursionRecord));
}

export async function closeExcursion(id: string, remarks: string, actor: MonitoringActor): Promise<ExcursionRecord> {
  const existing = await getDoc(doc(getFirebaseFirestore(), MONITORING_COLLECTIONS.excursions, id));
  if (!existing.exists()) throw new Error('Excursion not found');
  const updates = {
    status: 'Closed', remarks, closed_by: actor.id, closed_by_name: actor.name,
    closed_at: now(), updated_at: now(),
  };
  await updateDoc(doc(getFirebaseFirestore(), MONITORING_COLLECTIONS.excursions, id), updates);
  await auditLog(actor, 'CLOSE_EXCURSION', id, existing.data(), updates);
  return { id, ...existing.data(), ...updates } as ExcursionRecord;
}

// ─── Attachments & Audit ─────────────────────────────────────────────────────

export async function uploadMonitoringAttachment(
  areaDocId: string, file: File, category: string, actor: MonitoringActor,
): Promise<MonitoringAttachment> {
  const path = `monitoring/${areaDocId}/${Date.now()}_${file.name}`;
  const storageRef = ref(getFirebaseStorage(), path);
  await uploadBytes(storageRef, file);
  const downloadUrl = await getDownloadURL(storageRef);
  const att: Omit<MonitoringAttachment, 'id'> = {
    area_doc_id: areaDocId, file_name: file.name, file_type: file.type, file_size: file.size,
    category, storage_path: path, download_url: downloadUrl,
    uploaded_by: actor.id, uploaded_by_name: actor.name, uploaded_at: now(),
  };
  const refDoc = await addDoc(collection(getFirebaseFirestore(), MONITORING_COLLECTIONS.attachments), att);
  return { id: refDoc.id, ...att };
}

export async function getMonitoringAttachments(areaDocId: string): Promise<MonitoringAttachment[]> {
  const snap = await getDocs(query(
    collection(getFirebaseFirestore(), MONITORING_COLLECTIONS.attachments),
    where('area_doc_id', '==', areaDocId), orderBy('uploaded_at', 'desc'),
  ));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as MonitoringAttachment));
}

export async function getAuditLogsForArea(areaDocId: string): Promise<Record<string, unknown>[]> {
  try {
    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), MONITORING_COLLECTIONS.auditLogs),
      where('recordId', '==', areaDocId), orderBy('timestamp', 'desc'), limit(50),
    ));
    return snap.docs.map((d) => d.data());
  } catch {
    const snap = await getDocs(query(collection(getFirebaseFirestore(), 'audit_logs'), where('recordId', '==', areaDocId), limit(50)));
    return snap.docs.map((d) => d.data());
  }
}

// ─── Dashboard & Charts ──────────────────────────────────────────────────────

export function computeDashboardMetrics(
  environmental: EnvironmentalRecord[],
  utility: UtilityRecord[],
  excursions: ExcursionRecord[],
): MonitoringDashboardMetrics {
  const all = [...environmental, ...utility];
  const compliant = all.filter((r) => r.status === 'Complies').length;
  const alert = all.filter((r) => r.status === 'Alert').length;
  const action = all.filter((r) => r.status === 'Action').length;
  const excursionRecords = all.filter((r) => ['Excursion', 'Under Review'].includes(r.status)).length;
  const openExcursions = excursions.filter((e) => e.status === 'Open' || e.status === 'Under Review').length;
  const closedExcursions = excursions.filter((e) => e.status === 'Closed').length;
  const repeatedExcursions = excursions.filter((e) => e.is_repeated).length;
  return {
    totalRecords: all.length,
    compliant, alert, action,
    excursions: excursionRecords,
    openExcursions, closedExcursions, repeatedExcursions,
  };
}

export function monitoringChartData(
  environmental: EnvironmentalRecord[],
  utility: UtilityRecord[],
  excursions: ExcursionRecord[],
  areas: AreaRecord[],
) {
  const tempTrend: Record<string, number[]> = {};
  const rhTrend: Record<string, number[]> = {};
  const dpTrend: Record<string, number[]> = {};
  const microbialTrend: Record<string, number[]> = {};
  const utilityTrend: Record<string, number[]> = {};
  const excursionTrend: Record<string, number> = {};
  const areaCompliance: Record<string, { total: number; compliant: number }> = {};

  for (const e of environmental) {
    const m = e.monitoring_date.slice(0, 7);
    if (e.monitoring_type === 'Temperature') {
      if (!tempTrend[m]) tempTrend[m] = [];
      tempTrend[m].push(e.observed_value);
    }
    if (e.monitoring_type === 'Relative Humidity') {
      if (!rhTrend[m]) rhTrend[m] = [];
      rhTrend[m].push(e.observed_value);
    }
    if (e.monitoring_type === 'Differential Pressure') {
      if (!dpTrend[m]) dpTrend[m] = [];
      dpTrend[m].push(e.observed_value);
    }
    if (['Viable Particle', 'Surface Monitoring', 'Settle Plate', 'Active Air Sampling'].includes(e.monitoring_type)) {
      if (!microbialTrend[m]) microbialTrend[m] = [];
      microbialTrend[m].push(e.observed_value);
    }
    if (!areaCompliance[e.area_name]) areaCompliance[e.area_name] = { total: 0, compliant: 0 };
    areaCompliance[e.area_name].total++;
    if (e.status === 'Complies') areaCompliance[e.area_name].compliant++;
  }
  for (const u of utility) {
    const m = u.monitoring_date.slice(0, 7);
    if (!utilityTrend[m]) utilityTrend[m] = [];
    utilityTrend[m].push(u.observed_value);
  }
  for (const ex of excursions) {
    const m = ex.excursion_date.slice(0, 7);
    excursionTrend[m] = (excursionTrend[m] || 0) + 1;
  }

  const avgChart = (obj: Record<string, number[]>) =>
    Object.entries(obj).sort().map(([name, vals]) => ({ name, value: Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 }));

  const complianceChart = Object.entries(areaCompliance).map(([name, v]) => ({
    name, value: v.total ? Math.round((v.compliant / v.total) * 100) : 0,
  }));

  return {
    tempTrend: avgChart(tempTrend),
    rhTrend: avgChart(rhTrend),
    dpTrend: avgChart(dpTrend),
    microbialTrend: avgChart(microbialTrend),
    utilityTrend: avgChart(utilityTrend),
    excursionTrend: Object.entries(excursionTrend).sort().map(([name, value]) => ({ name, value })),
    areaCompliance: complianceChart,
    byGrade: areas.reduce((acc, a) => { acc[a.cleanroom_grade] = (acc[a.cleanroom_grade] || 0) + 1; return acc; }, {} as Record<string, number>),
  };
}

// ─── PQR / CPV Integration ───────────────────────────────────────────────────

export async function listMonitoringForPqr() {
  const [environmental, utility, excursions] = await Promise.all([
    listEnvironmental(), listUtility(), listExcursions(),
  ]);
  return { environmental, utility, excursions };
}

export async function listMonitoringTrendData() {
  const [environmental, utility] = await Promise.all([listEnvironmental(), listUtility()]);
  return { environmental, utility };
}

export async function exportAreasCsv(areas: AreaRecord[]) {
  downloadCsv(
    `areas-${today()}.csv`,
    ['Area Code', 'Name', 'Department', 'Grade', 'Room', 'Status'],
    areas.map((a) => [a.area_code, a.area_name, a.department, a.cleanroom_grade, a.room_number, a.area_status]),
  );
}

export async function exportEnvironmentalCsv(records: EnvironmentalRecord[]) {
  downloadCsv(
    `environmental-${today()}.csv`,
    ['No', 'Date', 'Area', 'Type', 'Parameter', 'Value', 'Status'],
    records.map((r) => [r.monitoring_number, r.monitoring_date, r.area_name, r.monitoring_type, r.parameter_name, r.observed_value, r.status]),
  );
}

export async function exportUtilityCsv(records: UtilityRecord[]) {
  downloadCsv(
    `utility-${today()}.csv`,
    ['No', 'Date', 'Type', 'Point', 'Parameter', 'Value', 'Status'],
    records.map((r) => [r.utility_record_no, r.monitoring_date, r.utility_type, r.sampling_point, r.parameter_name, r.observed_value, r.status]),
  );
}

export async function exportExcursionsCsv(records: ExcursionRecord[]) {
  downloadCsv(
    `excursions-${today()}.csv`,
    ['No', 'Date', 'Area', 'Parameter', 'Value', 'Status', 'Critical', 'Repeated'],
    records.map((r) => [r.excursion_number, r.excursion_date, r.area_name, r.parameter_name, r.observed_value, r.status, r.is_critical_area ? 'Yes' : 'No', r.is_repeated ? 'Yes' : 'No']),
  );
}
