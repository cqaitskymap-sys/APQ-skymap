import {
  addDoc, collection, doc, getDoc, getDocs, limit, orderBy, query, updateDoc, where,
} from 'firebase/firestore';
import { getFirebaseFirestore } from '@/lib/firebase';
import { logAuditEvent } from '@/lib/admin/admin-service';
import { downloadCsv } from '@/lib/export-utils';
import { getDocumentById } from '@/lib/dms-service';
import type {
  WatermarkTemplateRecord, WatermarkRuleRecord, WatermarkHistoryRecord,
  DocumentWatermarkRecord, WatermarkFilters, WatermarkActor,
} from './watermark-types';
import {
  mapTemplateRaw, mapRuleRaw, mapHistoryRaw, mapDocumentWatermarkRaw,
  computeWatermarkKpis, computeWatermarkCharts,
  filterTemplates, filterHistory, filterDocWatermarks, buildRenderedText,
} from './watermark-records';
import type {
  CreateWatermarkTemplateInput, UpdateWatermarkRuleInput, ApplyWatermarkInput,
  ApproveRuleInput, BulkAssignInput,
} from './watermark-schemas';
import { WM_COLLECTIONS, WM_MODULE, STATUS_WATERMARK_DEFAULTS } from './watermark-types';

function now() { return new Date().toISOString(); }

async function audit(actor: WatermarkActor, action: string, recordId: string, oldValue: unknown, newValue: unknown, reason = '') {
  await logAuditEvent({
    userId: actor.id, userName: actor.name, module: WM_MODULE, recordId, action,
    oldValue: oldValue ? JSON.stringify(oldValue) : '',
    newValue: newValue ? JSON.stringify(newValue) : '',
    reason, ipAddress: 'client', device: typeof navigator !== 'undefined' ? navigator.userAgent : 'server',
    status: 'Success',
  });
}

async function notify(title: string, message: string, recordId: string, roles: string[] = []) {
  try {
    for (const role of roles) {
      await addDoc(collection(getFirebaseFirestore(), WM_COLLECTIONS.notifications), {
        title, message, module: WM_MODULE, record_id: recordId,
        target_role: role, read: false, created_at: now(),
      });
    }
  } catch (e) { console.error('WM notification failed:', e); }
}

async function generateWatermarkId(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `WM-${year}-`;
  try {
    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), WM_COLLECTIONS.templates),
      where('watermark_id', '>=', prefix),
      where('watermark_id', '<=', `${prefix}\uf8ff`),
      orderBy('watermark_id', 'desc'),
      limit(1),
    ));
    if (!snap.empty) {
      const last = snap.docs[0].data().watermark_id as string;
      return `${prefix}${String(parseInt(last.split('-').pop() || '0', 10) + 1).padStart(4, '0')}`;
    }
  } catch {
    const all = await getDocs(collection(getFirebaseFirestore(), WM_COLLECTIONS.templates));
    return `${prefix}${String(all.size + 1).padStart(4, '0')}`;
  }
  return `${prefix}0001`;
}

function generateBarcode(docNumber: string, version: string, copyNumber = ''): string {
  const payload = `${docNumber}|${version}|${copyNumber}|${Date.now()}`;
  let hash = 0;
  for (let i = 0; i < payload.length; i++) hash = ((hash << 5) - hash + payload.charCodeAt(i)) | 0;
  return `WM${Math.abs(hash).toString(36).toUpperCase().padStart(8, '0')}`;
}

function generateQRMetadata(docNumber: string, version: string, copyNumber = '', userName = ''): string {
  return JSON.stringify({ doc: docNumber, ver: version, copy: copyNumber, user: userName, ts: Date.now() });
}

function generateFingerprint(docNumber: string, version: string): string {
  const raw = `${docNumber}:${version}:${Date.now()}`;
  let h = 0;
  for (let i = 0; i < raw.length; i++) h = ((h << 5) - h + raw.charCodeAt(i)) | 0;
  return Math.abs(h).toString(16).padStart(8, '0');
}

function normalizeDocStatus(status: string): string {
  const map: Record<string, string> = {
    draft: 'Draft', under_review: 'Pending Review', approved: 'Pending Approval',
    effective: 'Effective', obsolete: 'Obsolete', superseded: 'Superseded', archived: 'Archived',
  };
  return map[status.toLowerCase()] || status;
}

async function listTemplates(): Promise<WatermarkTemplateRecord[]> {
  try {
    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), WM_COLLECTIONS.templates),
      orderBy('updated_at', 'desc'),
    ));
    return snap.docs.map((d) => mapTemplateRaw({ id: d.id, ...d.data() }));
  } catch {
    const snap = await getDocs(collection(getFirebaseFirestore(), WM_COLLECTIONS.templates));
    return snap.docs.map((d) => mapTemplateRaw({ id: d.id, ...d.data() }))
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  }
}

async function listRules(): Promise<WatermarkRuleRecord[]> {
  try {
    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), WM_COLLECTIONS.rules),
      orderBy('updated_at', 'desc'),
    ));
    return snap.docs.map((d) => mapRuleRaw({ id: d.id, ...d.data() }));
  } catch {
    const snap = await getDocs(collection(getFirebaseFirestore(), WM_COLLECTIONS.rules));
    return snap.docs.map((d) => mapRuleRaw({ id: d.id, ...d.data() }))
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  }
}

async function listHistory(): Promise<WatermarkHistoryRecord[]> {
  try {
    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), WM_COLLECTIONS.history),
      orderBy('created_at', 'desc'),
      limit(500),
    ));
    return snap.docs.map((d) => mapHistoryRaw({ id: d.id, ...d.data() }));
  } catch {
    const snap = await getDocs(collection(getFirebaseFirestore(), WM_COLLECTIONS.history));
    return snap.docs.map((d) => mapHistoryRaw({ id: d.id, ...d.data() }))
      .sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 500);
  }
}

async function listDocumentWatermarks(): Promise<DocumentWatermarkRecord[]> {
  try {
    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), WM_COLLECTIONS.documentWatermarks),
      orderBy('updated_at', 'desc'),
    ));
    return snap.docs.map((d) => mapDocumentWatermarkRaw({ id: d.id, ...d.data() }));
  } catch {
    const snap = await getDocs(collection(getFirebaseFirestore(), WM_COLLECTIONS.documentWatermarks));
    return snap.docs.map((d) => mapDocumentWatermarkRaw({ id: d.id, ...d.data() }))
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  }
}

export function resolveWatermarkType(docStatus: string, overrideType?: string): string {
  if (overrideType) return overrideType;
  const normalized = normalizeDocStatus(docStatus);
  if (normalized === 'Obsolete') return 'Obsolete';
  if (normalized === 'Superseded') return 'Superseded';
  if (normalized === 'Archived') return 'Archived';
  if (normalized === 'Draft') return 'Draft';
  if (normalized === 'Pending Review') return 'Pending Review';
  if (normalized === 'Pending Approval') return 'Pending Approval';
  return 'Effective';
}

export function resolveRule(
  rules: WatermarkRuleRecord[],
  templates: WatermarkTemplateRecord[],
  docStatus: string,
  triggerEvent: string,
  docType = 'All',
  watermarkType?: string,
): WatermarkTemplateRecord | null {
  const normalized = normalizeDocStatus(docStatus);
  const activeRules = rules
    .filter((r) => r.status === 'Active')
    .filter((r) => r.document_status === normalized || r.document_status === 'All')
    .filter((r) => r.trigger_event === triggerEvent)
    .filter((r) => r.document_type === 'All' || r.document_type === docType)
    .filter((r) => !watermarkType || r.watermark_type === watermarkType || r.watermark_type === 'Custom')
    .sort((a, b) => a.priority - b.priority);

  if (activeRules.length) {
    const template = templates.find((t) => t.id === activeRules[0].template_id && t.status === 'Active');
    if (template) return template;
  }

  const typeKey = watermarkType || resolveWatermarkType(docStatus);
  const defaultText = STATUS_WATERMARK_DEFAULTS[typeKey] ?? STATUS_WATERMARK_DEFAULTS[normalized];
  if (!defaultText && normalized === 'Effective') return null;

  return templates.find((t) =>
    t.status === 'Active' &&
    t.watermark_type === typeKey &&
    (t.trigger_event === triggerEvent || t.trigger_event === 'All'),
  ) || templates.find((t) =>
    t.status === 'Active' && t.display_text === defaultText,
  ) || null;
}

export async function createWatermarkTemplate(input: CreateWatermarkTemplateInput, actor: WatermarkActor): Promise<WatermarkTemplateRecord> {
  const watermarkId = await generateWatermarkId();
  const timestamp = now();
  const payload = {
    watermark_id: watermarkId,
    module: WM_MODULE,
    template_name: input.template_name,
    watermark_type: input.watermark_type,
    display_text: input.display_text,
    description: input.description || '',
    document_status: input.document_status,
    applies_to: input.applies_to,
    trigger_event: input.trigger_event,
    visibility: input.visibility,
    position: input.position,
    rotation: input.rotation,
    opacity: input.opacity,
    font_family: input.font_family,
    font_size: input.font_size,
    color: input.color,
    repeat_pattern: input.repeat_pattern,
    background_image: '',
    qr_code_enabled: input.qr_code_enabled,
    barcode_enabled: input.barcode_enabled,
    include_document_number: input.include_document_number,
    include_version: input.include_version,
    include_copy_number: input.include_copy_number,
    include_print_date: input.include_print_date,
    include_user_name: input.include_user_name,
    include_department: input.include_department,
    include_timestamp: input.include_timestamp,
    include_confidentiality_level: input.include_confidentiality_level,
    include_digital_fingerprint: input.include_digital_fingerprint,
    status: 'Active',
    created_by: actor.id,
    created_by_name: actor.name,
    updated_by: actor.id,
    updated_by_name: actor.name,
    created_at: timestamp,
    updated_at: timestamp,
  };
  const ref = await addDoc(collection(getFirebaseFirestore(), WM_COLLECTIONS.templates), payload);
  await audit(actor, 'WATERMARK_TEMPLATE_CREATED', ref.id, null, payload);
  await notify('New Watermark Template', `${input.template_name} created`, ref.id, ['document_controller']);
  return mapTemplateRaw({ id: ref.id, ...payload });
}

export async function createWatermarkRule(input: UpdateWatermarkRuleInput, actor: WatermarkActor): Promise<WatermarkRuleRecord> {
  const template = await getTemplateById(input.template_id);
  if (!template) throw new Error('Watermark template not found');

  const timestamp = now();
  const ruleId = `WR-${Date.now()}`;
  const payload = {
    rule_id: ruleId,
    module: WM_MODULE,
    rule_name: input.rule_name,
    template_id: template.id,
    template_name: template.template_name,
    document_status: input.document_status,
    document_type: input.document_type,
    trigger_event: input.trigger_event,
    watermark_type: input.watermark_type,
    priority: input.priority,
    status: 'Pending Approval',
    approved_by: '',
    approved_by_name: '',
    approved_at: null,
    created_by: actor.id,
    created_by_name: actor.name,
    updated_by: actor.id,
    updated_by_name: actor.name,
    created_at: timestamp,
    updated_at: timestamp,
  };
  const ref = await addDoc(collection(getFirebaseFirestore(), WM_COLLECTIONS.rules), payload);
  await audit(actor, 'WATERMARK_RULE_UPDATED', ref.id, null, payload);
  await notify('Watermark Rule Updated', `${input.rule_name} pending QA approval`, ref.id, ['head_qa']);
  return mapRuleRaw({ id: ref.id, ...payload });
}

export async function approveWatermarkRule(ruleId: string, input: ApproveRuleInput, actor: WatermarkActor): Promise<void> {
  const rec = await getRuleById(ruleId);
  if (!rec) throw new Error('Rule not found');
  const timestamp = now();
  await updateDoc(doc(getFirebaseFirestore(), WM_COLLECTIONS.rules, ruleId), {
    status: 'Active',
    approved_by: actor.id,
    approved_by_name: actor.name,
    approved_at: timestamp,
    updated_at: timestamp,
    updated_by: actor.id,
    updated_by_name: actor.name,
  });
  if (input.signature_meaning) {
    await audit(actor, 'ELECTRONIC_SIGNATURE_COMPLETED', ruleId, null, { meaning: input.signature_meaning });
  }
  await audit(actor, 'WATERMARK_RULE_UPDATED', ruleId, rec.status, 'Active', input.comments);
}

export async function applyWatermark(input: ApplyWatermarkInput, actor: WatermarkActor): Promise<DocumentWatermarkRecord> {
  const docRecord = await getDocumentById(input.document_id);
  if (!docRecord) throw new Error('Document not found');

  const [templates, rules] = await Promise.all([listTemplates(), listRules()]);
  const docStatus = normalizeDocStatus(docRecord.status);
  const watermarkType = input.watermark_type || resolveWatermarkType(docRecord.status);
  const template = resolveRule(rules, templates, docStatus, input.trigger_event, docRecord.document_type, watermarkType);

  const timestamp = now();
  const today = timestamp.split('T')[0];
  const ctx: Record<string, string | undefined> = {
    document_number: docRecord.document_number,
    version: docRecord.version,
    copy_number: input.copy_number,
    user_name: actor.name,
    department: actor.department || docRecord.department,
    print_date: today,
    confidentiality_level: 'Internal',
    document_status: docStatus,
  };

  if (!template) {
    const failureReason = `No active watermark template for ${docStatus} / ${input.trigger_event}`;
    await recordHistoryEvent({
      document_id: docRecord.id, document_number: docRecord.document_number,
      document_title: docRecord.document_title, version: docRecord.version,
      template_id: '', template_name: '', watermark_type: watermarkType,
      trigger_event: input.trigger_event, display_text: '', rendered_text: '',
      barcode: '', qr_code: '', metadata: ctx as Record<string, string>,
      department: ctx.department || '', user_id: actor.id, user_name: actor.name,
      event_status: 'Failed', failure_reason: failureReason,
    }, actor);
    await notify('Watermark Failed', failureReason, docRecord.id, ['document_controller']);
    throw new Error(failureReason);
  }

  const renderedText = buildRenderedText(template, ctx);
  const barcode = template.barcode_enabled ? generateBarcode(docRecord.document_number, docRecord.version, input.copy_number) : '';
  const qrCode = template.qr_code_enabled ? generateQRMetadata(docRecord.document_number, docRecord.version, input.copy_number, actor.name) : '';
  const fingerprint = template.include_digital_fingerprint ? generateFingerprint(docRecord.document_number, docRecord.version) : '';

  const payload = {
    document_id: docRecord.id,
    document_number: docRecord.document_number,
    document_title: docRecord.document_title,
    version: docRecord.version,
    document_status: docStatus,
    watermark_type: template.watermark_type,
    template_id: template.id,
    display_text: template.display_text,
    rendered_text: fingerprint ? `${renderedText} [${fingerprint}]` : renderedText,
    trigger_event: input.trigger_event,
    copy_number: input.copy_number || '',
    barcode,
    qr_code: qrCode,
    department: ctx.department || '',
    applied_by: actor.id,
    applied_by_name: actor.name,
    applied_at: timestamp,
    updated_at: timestamp,
    module: WM_MODULE,
  };

  const existing = await getDocs(query(
    collection(getFirebaseFirestore(), WM_COLLECTIONS.documentWatermarks),
    where('document_id', '==', docRecord.id),
    where('trigger_event', '==', input.trigger_event),
    limit(1),
  ));

  let recordId: string;
  if (!existing.empty) {
    recordId = existing.docs[0].id;
    await updateDoc(doc(getFirebaseFirestore(), WM_COLLECTIONS.documentWatermarks, recordId), payload);
  } else {
    const ref = await addDoc(collection(getFirebaseFirestore(), WM_COLLECTIONS.documentWatermarks), payload);
    recordId = ref.id;
  }

  await recordHistoryEvent({
    document_id: docRecord.id, document_number: docRecord.document_number,
    document_title: docRecord.document_title, version: docRecord.version,
    template_id: template.id, template_name: template.template_name,
    watermark_type: template.watermark_type, trigger_event: input.trigger_event,
    display_text: template.display_text, rendered_text: payload.rendered_text,
    barcode, qr_code: qrCode, metadata: { ...ctx as Record<string, string>, fingerprint },
    department: ctx.department || '', user_id: actor.id, user_name: actor.name,
    event_status: 'Applied', failure_reason: '',
  }, actor);

  const auditAction = input.trigger_event === 'Print' ? 'WATERMARK_PRINTED'
    : input.trigger_event.startsWith('Export') ? 'WATERMARK_EXPORTED'
    : input.trigger_event === 'View' ? 'WATERMARK_VIEWED'
    : 'WATERMARK_APPLIED';

  await audit(actor, auditAction, recordId, null, payload);
  if (barcode) await audit(actor, 'BARCODE_EMBEDDED', recordId, null, { barcode });
  if (qrCode) await audit(actor, 'QR_CODE_EMBEDDED', recordId, null, { qr_code: qrCode });
  if (watermarkType === 'Controlled Copy') {
    await notify('Controlled Copy Generated', `${docRecord.document_number} watermarked`, recordId, ['document_controller']);
  } else {
    await notify('Watermark Applied', `${docRecord.document_number} — ${template.display_text}`, recordId, ['document_controller']);
  }

  return mapDocumentWatermarkRaw({ id: recordId, ...payload });
}

async function recordHistoryEvent(
  data: Omit<WatermarkHistoryRecord, 'id' | 'event_id' | 'created_at'>,
  actor: WatermarkActor,
): Promise<void> {
  const timestamp = now();
  const eventId = `WHE-${Date.now()}`;
  await addDoc(collection(getFirebaseFirestore(), WM_COLLECTIONS.history), {
    event_id: eventId,
    module: WM_MODULE,
    ...data,
    created_at: timestamp,
  });
  if (data.event_status === 'Failed') {
    await audit(actor, 'WATERMARK_FAILED', eventId, null, data);
  }
}

export async function bulkAssignWatermarks(input: BulkAssignInput, actor: WatermarkActor): Promise<number> {
  let count = 0;
  for (const documentId of input.document_ids) {
    try {
      await applyWatermark({ document_id: documentId, trigger_event: input.trigger_event }, actor);
      count++;
    } catch { /* continue */ }
  }
  await audit(actor, 'WATERMARK_APPLIED', 'bulk', null, { count, template_id: input.template_id });
  return count;
}

export async function syncDocumentStatusWatermarks(actor: WatermarkActor): Promise<number> {
  const docWatermarks = await listDocumentWatermarks();
  let updated = 0;
  for (const dw of docWatermarks) {
    const docRecord = await getDocumentById(dw.document_id);
    if (!docRecord) continue;
    const newStatus = normalizeDocStatus(docRecord.status);
    if (newStatus !== dw.document_status) {
      try {
        await applyWatermark({ document_id: dw.document_id, trigger_event: dw.trigger_event as ApplyWatermarkInput['trigger_event'] }, actor);
        updated++;
      } catch { /* skip failed */ }
    }
  }
  return updated;
}

export async function monitorFailedWatermarks(actor: WatermarkActor): Promise<number> {
  const history = await listHistory();
  const recentFailed = history.filter((h) => h.event_status === 'Failed').slice(0, 10);
  for (const evt of recentFailed) {
    await notify('Watermark Failed', `${evt.document_number}: ${evt.failure_reason}`, evt.id, ['document_controller', 'head_qa']);
  }
  return recentFailed.length;
}

export async function processScheduledWatermarkJobs(actor: WatermarkActor) {
  const statusUpdates = await syncDocumentStatusWatermarks(actor);
  const failedAlerts = await monitorFailedWatermarks(actor);
  return { statusUpdates, failedAlerts };
}

export async function fetchWatermarkDashboardData(filters?: WatermarkFilters) {
  const [templates, rules, history, docWatermarks] = await Promise.all([
    listTemplates(), listRules(), listHistory(), listDocumentWatermarks(),
  ]);
  const filteredTemplates = filterTemplates(templates, filters || {});
  const filteredHistory = filterHistory(history, filters || {});
  const filteredDocs = filterDocWatermarks(docWatermarks, filters || {});
  return {
    templates: filteredTemplates.length ? filteredTemplates : templates,
    rules,
    history: filteredHistory.length ? filteredHistory : history,
    docWatermarks: filteredDocs.length ? filteredDocs : docWatermarks,
    metrics: computeWatermarkKpis(templates, docWatermarks, history),
    charts: computeWatermarkCharts(history, docWatermarks),
  };
}

export async function getTemplateById(id: string): Promise<WatermarkTemplateRecord | null> {
  const snap = await getDoc(doc(getFirebaseFirestore(), WM_COLLECTIONS.templates, id));
  return snap.exists() ? mapTemplateRaw({ id: snap.id, ...snap.data() }) : null;
}

export async function getRuleById(id: string): Promise<WatermarkRuleRecord | null> {
  const snap = await getDoc(doc(getFirebaseFirestore(), WM_COLLECTIONS.rules, id));
  return snap.exists() ? mapRuleRaw({ id: snap.id, ...snap.data() }) : null;
}

export function exportWatermarksCsv(templates: WatermarkTemplateRecord[]) {
  downloadCsv('watermark-templates.csv',
    ['ID', 'Name', 'Type', 'Text', 'Doc Status', 'Trigger', 'Visibility', 'Active'],
    templates.map((t) => [
      t.watermark_id, t.template_name, t.watermark_type, t.display_text,
      t.document_status, t.trigger_event, t.visibility, t.status,
    ]),
  );
}

export function exportWatermarksExcel(templates: WatermarkTemplateRecord[]) {
  exportWatermarksCsv(templates);
}

export async function logWatermarkDashboardViewed(actor: WatermarkActor) {
  await audit(actor, 'WATERMARK_DASHBOARD_VIEWED', 'dashboard', null, { at: now() });
}

export async function logWatermarkExported(actor: WatermarkActor, format: string, count: number) {
  await audit(actor, 'WATERMARK_EXPORTED', 'export', null, { format, count });
}

export async function runScheduledWatermarkJobs() {
  return processScheduledWatermarkJobs({
    id: 'system', name: 'Watermark Scheduler', role: 'super_admin',
  });
}

export async function seedDefaultTemplates(actor: WatermarkActor): Promise<number> {
  const existing = await listTemplates();
  if (existing.length > 0) return 0;

  const defaults: CreateWatermarkTemplateInput[] = [
    { template_name: 'Controlled Copy Default', watermark_type: 'Controlled Copy', display_text: 'CONTROLLED COPY — DO NOT DUPLICATE', document_status: 'Effective', applies_to: 'All Documents', trigger_event: 'Print', visibility: 'Both', include_copy_number: true, include_document_number: true, include_version: true, include_print_date: true, include_timestamp: true, qr_code_enabled: true, barcode_enabled: true, include_user_name: false, include_department: false, include_confidentiality_level: false, include_digital_fingerprint: true, position: 'Diagonal', rotation: -45, opacity: 0.25, font_family: 'Arial', font_size: 48, color: '#CC0000', repeat_pattern: 'Single' },
    { template_name: 'Uncontrolled Copy', watermark_type: 'Uncontrolled Copy', display_text: 'UNCONTROLLED COPY', document_status: 'Effective', applies_to: 'All Documents', trigger_event: 'Print', visibility: 'Visible', include_document_number: true, include_version: true, include_copy_number: false, include_print_date: true, include_timestamp: true, qr_code_enabled: false, barcode_enabled: false, include_user_name: false, include_department: false, include_confidentiality_level: false, include_digital_fingerprint: false, position: 'Diagonal', rotation: -45, opacity: 0.3, font_family: 'Arial', font_size: 42, color: '#666666', repeat_pattern: 'Single' },
    { template_name: 'Draft Watermark', watermark_type: 'Draft', display_text: 'DRAFT — NOT FOR USE', document_status: 'Draft', applies_to: 'All Documents', trigger_event: 'View', visibility: 'Visible', include_document_number: true, include_version: true, include_copy_number: false, include_print_date: false, include_timestamp: true, qr_code_enabled: false, barcode_enabled: false, include_user_name: false, include_department: false, include_confidentiality_level: false, include_digital_fingerprint: false, position: 'Diagonal', rotation: -45, opacity: 0.35, font_family: 'Arial', font_size: 52, color: '#999999', repeat_pattern: 'Single' },
    { template_name: 'For Training', watermark_type: 'For Training', display_text: 'FOR TRAINING ONLY', document_status: 'Effective', applies_to: 'All Documents', trigger_event: 'Print', visibility: 'Visible', include_document_number: true, include_version: true, include_copy_number: false, include_print_date: true, include_timestamp: true, qr_code_enabled: false, barcode_enabled: false, include_user_name: false, include_department: false, include_confidentiality_level: false, include_digital_fingerprint: false, position: 'Diagonal', rotation: -45, opacity: 0.3, font_family: 'Arial', font_size: 44, color: '#0066CC', repeat_pattern: 'Single' },
    { template_name: 'Inspection Copy', watermark_type: 'Inspection Copy', display_text: 'INSPECTION COPY', document_status: 'Effective', applies_to: 'All Documents', trigger_event: 'Export PDF', visibility: 'Both', include_document_number: true, include_version: true, include_copy_number: false, include_print_date: true, include_timestamp: true, qr_code_enabled: true, barcode_enabled: false, include_user_name: true, include_department: true, include_confidentiality_level: false, include_digital_fingerprint: false, position: 'Diagonal', rotation: -45, opacity: 0.28, font_family: 'Arial', font_size: 46, color: '#CC6600', repeat_pattern: 'Single' },
    { template_name: 'Obsolete Status', watermark_type: 'Obsolete', display_text: 'OBSOLETE — DO NOT USE', document_status: 'Obsolete', applies_to: 'All Documents', trigger_event: 'View', visibility: 'Visible', include_document_number: true, include_version: true, include_copy_number: false, include_print_date: false, include_timestamp: true, qr_code_enabled: false, barcode_enabled: false, include_user_name: false, include_department: false, include_confidentiality_level: false, include_digital_fingerprint: false, position: 'Diagonal', rotation: -45, opacity: 0.4, font_family: 'Arial', font_size: 50, color: '#CC0000', repeat_pattern: 'Single' },
    { template_name: 'Superseded Status', watermark_type: 'Superseded', display_text: 'SUPERSEDED', document_status: 'Superseded', applies_to: 'All Documents', trigger_event: 'View', visibility: 'Visible', include_document_number: true, include_version: true, include_copy_number: false, include_print_date: false, include_timestamp: true, qr_code_enabled: false, barcode_enabled: false, include_user_name: false, include_department: false, include_confidentiality_level: false, include_digital_fingerprint: false, position: 'Diagonal', rotation: -45, opacity: 0.35, font_family: 'Arial', font_size: 48, color: '#888888', repeat_pattern: 'Single' },
  ];

  for (const d of defaults) await createWatermarkTemplate(d, actor);
  return defaults.length;
}
