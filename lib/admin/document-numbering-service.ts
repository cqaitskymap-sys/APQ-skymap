import {
  collection, doc, getDoc, getDocs, query, setDoc, updateDoc, where,
} from 'firebase/firestore';
import { writeAuditTrail } from '@/lib/audit-trail';
import { getFirebaseFirestore } from '@/lib/firebase';
import {
  getAdminRecords, createAdminRecord, updateAdminRecord,
  checkUniqueField, logAuditEvent,
} from './admin-service';
import { ADMIN_COLLECTIONS } from './constants';
import type { DocumentNumbering, DocumentNumberingFormData } from './schemas';

export interface DocumentNumberingAuditMeta {
  userId: string;
  userName: string;
}

export interface GenerateDocumentNumberOptions {
  siteCode?: string;
  departmentCode?: string;
  productCode?: string;
  revision?: string;
  manualNumber?: string;
  allowManualOverride?: boolean;
  increment?: boolean;
  date?: Date;
}

export interface GenerateDocumentNumberResult {
  number: string;
  formatId?: string;
  error?: string;
  preview?: boolean;
}

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

async function logNumberingAudit(
  action: string,
  recordId: string,
  meta: DocumentNumberingAuditMeta,
  oldValue: unknown,
  newValue: unknown,
) {
  await logAuditEvent({
    userId: meta.userId,
    userName: meta.userName,
    module: 'Document Numbering',
    recordId,
    action,
    oldValue: typeof oldValue === 'string' ? oldValue : JSON.stringify(oldValue ?? ''),
    newValue: typeof newValue === 'string' ? newValue : JSON.stringify(newValue ?? ''),
    reason: '',
    ipAddress: 'client',
    device: typeof navigator !== 'undefined' ? navigator.userAgent : 'browser',
    status: 'Success',
  });

  await writeAuditTrail({
    collectionName: ADMIN_COLLECTIONS.documentNumbering,
    documentId: recordId,
    action,
    oldValue,
    newValue,
    userId: meta.userId,
    userName: meta.userName,
    moduleName: 'Document Numbering',
  });
}

export function buildNumberingId(code: string): string {
  return `NUM-${code.toUpperCase().replace(/\s+/g, '-')}`;
}

export function parseFormatTokens(formatTokens: string): string[] {
  return formatTokens.split(',').map((t) => t.trim()).filter(Boolean);
}

export function formatYear(yearFormat: string, date: Date): string {
  if (yearFormat === 'None') return '';
  const y = date.getFullYear();
  return yearFormat === 'YY' ? String(y).slice(-2) : String(y);
}

export function formatMonth(monthFormat: string, date: Date): string {
  if (monthFormat === 'None') return '';
  const m = date.getMonth();
  if (monthFormat === 'MMM') return MONTH_ABBR[m];
  return String(m + 1).padStart(2, '0');
}

export function formatRevision(revisionFormat: string, revision?: string): string {
  if (revision) return revision;
  switch (revisionFormat) {
    case '01': return '01';
    case 'Rev-00': return 'Rev-00';
    case 'R00': return 'R00';
    case 'V1.0': return 'V1.0';
    case 'Custom': return '00';
    default: return '00';
  }
}

export function documentTypeToken(documentType: string): string {
  const map: Record<string, string> = {
    'CSV URS': 'URS', 'CSV IQ': 'IQ', 'CSV OQ': 'OQ', 'CSV PQ': 'PQ',
    'Validation Protocol': 'VAL', 'Validation Report': 'VAL',
  };
  if (map[documentType]) return map[documentType];
  const first = documentType.split(' ')[0] || documentType;
  return first.toUpperCase().slice(0, 6);
}

export function getSeparatorChar(separator: string): string {
  if (separator === 'None') return '';
  return separator;
}

export function buildDocumentNumberPreview(
  format: Partial<DocumentNumbering>,
  options?: {
    siteCode?: string;
    departmentCode?: string;
    productCode?: string;
    revision?: string;
    runningNumber?: number;
    date?: Date;
  },
): string {
  const date = options?.date ?? new Date();
  const tokens = parseFormatTokens(format.formatTokens || 'PREFIX,DEPARTMENT_CODE,RUNNING_NUMBER,YEAR');
  const sep = getSeparatorChar(format.separator || '/');
  const runLen = Number(format.runningNumberLength ?? format.runningNumber ?? 4);
  const runVal = options?.runningNumber ?? Number(format.currentRunningNumber ?? format.currentNumber ?? 0);
  const paddedRun = String(runVal).padStart(runLen, '0');

  const parts = tokens.map((token) => {
    switch (token) {
      case 'PREFIX': return format.prefix || '';
      case 'SITE_CODE': return options?.siteCode || format.siteCode || '';
      case 'DEPARTMENT_CODE': return options?.departmentCode || format.departmentCode || '';
      case 'PRODUCT_CODE': return options?.productCode || format.productCodeOptional || '';
      case 'DOCUMENT_TYPE': return documentTypeToken(format.documentType || '');
      case 'RUNNING_NUMBER': return paddedRun;
      case 'MONTH': return formatMonth(format.monthFormat || 'None', date);
      case 'YEAR': return formatYear(format.yearFormat || 'YYYY', date);
      case 'REVISION': return formatRevision(format.revisionFormat || '00', options?.revision);
      default: return '';
    }
  }).filter((p) => p !== '');

  if (!sep) return parts.join('');
  return parts.join(sep);
}

export function getPeriodKey(resetFrequency: string, date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  switch (resetFrequency) {
    case 'Yearly': return `${y}`;
    case 'Monthly': return `${y}-${m}`;
    case 'Daily': return `${y}-${m}-${d}`;
    default: return 'all';
  }
}

function sequenceDocId(numberingId: string, periodKey: string): string {
  return `${numberingId}__${periodKey}`;
}

export function normalizeDocumentNumbering(n: DocumentNumbering): DocumentNumbering {
  const numberingId = n.numberingId || buildNumberingId(n.numberingCode || n.moduleName || 'NUM');
  const runLen = Number(n.runningNumberLength ?? n.runningNumber ?? 4);
  const currentRun = Number(n.currentRunningNumber ?? n.currentNumber ?? 0);
  const moduleName = n.moduleName || n.module || '';
  return {
    ...n,
    numberingId,
    numberingCode: n.numberingCode || numberingId.replace('NUM-', ''),
    moduleName,
    module: moduleName,
    runningNumberLength: runLen,
    runningNumber: runLen,
    currentRunningNumber: currentRun,
    currentNumber: currentRun,
    exampleNumberPreview: n.exampleNumberPreview || n.exampleFormat || buildDocumentNumberPreview(n),
    exampleFormat: n.exampleNumberPreview || n.exampleFormat || buildDocumentNumberPreview(n),
    autoGenerateEnabled: n.autoGenerateEnabled ?? true,
    manualOverrideAllowed: n.manualOverrideAllowed ?? false,
    formatTokens: n.formatTokens || 'PREFIX,DEPARTMENT_CODE,RUNNING_NUMBER,YEAR',
    monthFormat: (n.monthFormat as DocumentNumbering['monthFormat']) || 'None',
    revisionFormat: (n.revisionFormat as DocumentNumbering['revisionFormat']) || '00',
  };
}

export function isNumberingActive(n: DocumentNumbering): boolean {
  return n.status === 'Active' && !n.isDeleted;
}

export async function fetchDocumentNumberings(): Promise<DocumentNumbering[]> {
  try {
    const records = await getAdminRecords<DocumentNumbering>(ADMIN_COLLECTIONS.documentNumbering);
    return records.filter((n) => !n.isDeleted).map(normalizeDocumentNumbering);
  } catch {
    return [];
  }
}

export async function fetchDocumentNumberingById(id: string): Promise<DocumentNumbering | null> {
  const all = await fetchDocumentNumberings();
  return all.find((n) => n.id === id) ?? null;
}

export async function fetchActiveNumberingForModule(
  moduleName: string,
  documentType: string,
): Promise<DocumentNumbering | null> {
  const list = await fetchDocumentNumberings();
  return list.find((n) =>
    isNumberingActive(n) &&
    n.moduleName === moduleName &&
    n.documentType === documentType,
  ) ?? null;
}

export async function hasDuplicateActiveNumbering(
  moduleName: string,
  documentType: string,
  excludeId?: string,
): Promise<boolean> {
  const list = await fetchDocumentNumberings();
  return list.some((n) =>
    isNumberingActive(n) &&
    n.moduleName === moduleName &&
    n.documentType === documentType &&
    n.id !== excludeId,
  );
}

export function getDocumentNumberingSummaryCounts(formats: DocumentNumbering[]) {
  return {
    total: formats.length,
    active: formats.filter((n) => n.status === 'Active').length,
    inactive: formats.filter((n) => n.status === 'Inactive').length,
    autoGenerateEnabled: formats.filter((n) => n.autoGenerateEnabled).length,
    manualOverrideEnabled: formats.filter((n) => n.manualOverrideAllowed).length,
    yearlyReset: formats.filter((n) => n.resetFrequency === 'Yearly').length,
    monthlyReset: formats.filter((n) => n.resetFrequency === 'Monthly').length,
  };
}

function formToPayload(
  data: DocumentNumberingFormData,
  meta: DocumentNumberingAuditMeta,
  status = 'Active',
) {
  const numberingId = buildNumberingId(data.numberingCode);
  const preview = buildDocumentNumberPreview({
    ...data,
    numberingCode: data.numberingCode,
    documentType: data.documentType,
  });
  return {
    numberingId,
    numberingCode: data.numberingCode,
    moduleName: data.moduleName,
    module: data.moduleName,
    documentType: data.documentType,
    prefix: data.prefix,
    siteCode: data.siteCode,
    departmentCode: data.departmentCode,
    productCodeOptional: data.productCodeOptional,
    yearFormat: data.yearFormat,
    monthFormat: data.monthFormat,
    separator: data.separator,
    runningNumberLength: data.runningNumberLength,
    runningNumber: data.runningNumberLength,
    currentRunningNumber: data.currentRunningNumber,
    currentNumber: data.currentRunningNumber,
    resetFrequency: data.resetFrequency,
    revisionFormat: data.revisionFormat,
    formatTokens: data.formatTokens,
    exampleNumberPreview: preview,
    exampleFormat: preview,
    autoGenerateEnabled: data.autoGenerateEnabled,
    manualOverrideAllowed: data.manualOverrideAllowed,
    remarks: data.remarks,
    status,
    updatedBy: meta.userId,
  };
}

export async function createDocumentNumbering(
  data: DocumentNumberingFormData,
  meta: DocumentNumberingAuditMeta,
): Promise<{ format: DocumentNumbering | null; error: string | null }> {
  try {
    const unique = await checkUniqueField(ADMIN_COLLECTIONS.documentNumbering, 'numberingCode', data.numberingCode);
    if (!unique) return { format: null, error: 'Numbering code already exists' };

    if (await hasDuplicateActiveNumbering(data.moduleName, data.documentType)) {
      return { format: null, error: 'An active numbering format already exists for this module and document type' };
    }

    const payload = { ...formToPayload(data, meta), createdBy: meta.userId };
    const created = await createAdminRecord(
      ADMIN_COLLECTIONS.documentNumbering,
      payload as Omit<DocumentNumbering, 'id'>,
      { userId: meta.userId, userName: meta.userName, module: 'Document Numbering', action: 'CREATE_NUMBERING_FORMAT' },
    );

    await logNumberingAudit('CREATE_NUMBERING_FORMAT', created.id || payload.numberingId, meta, null, payload);
    return { format: normalizeDocumentNumbering(created as DocumentNumbering), error: null };
  } catch (e) {
    return { format: null, error: (e as Error).message };
  }
}

export async function updateDocumentNumbering(
  id: string,
  data: DocumentNumberingFormData,
  existing: DocumentNumbering,
  meta: DocumentNumberingAuditMeta,
): Promise<{ format: DocumentNumbering | null; error: string | null }> {
  try {
    if (data.numberingCode !== existing.numberingCode) {
      const unique = await checkUniqueField(ADMIN_COLLECTIONS.documentNumbering, 'numberingCode', data.numberingCode, id);
      if (!unique) return { format: null, error: 'Numbering code already exists' };
    }

    const willBeActive = existing.status === 'Active';
    if (willBeActive && await hasDuplicateActiveNumbering(data.moduleName, data.documentType, id)) {
      return { format: null, error: 'An active numbering format already exists for this module and document type' };
    }

    const updates = formToPayload(data, meta, existing.status);
    delete (updates as { createdBy?: string }).createdBy;

    if (existing.manualOverrideAllowed !== data.manualOverrideAllowed) {
      await logNumberingAudit(
        'MANUAL_OVERRIDE_TOGGLE',
        id,
        meta,
        existing.manualOverrideAllowed,
        data.manualOverrideAllowed,
      );
    }

    const updated = await updateAdminRecord(ADMIN_COLLECTIONS.documentNumbering, id, updates, {
      userId: meta.userId,
      userName: meta.userName,
      module: 'Document Numbering',
      oldValue: JSON.stringify(existing),
    });

    await logNumberingAudit('EDIT_NUMBERING_FORMAT', id, meta, existing, updates);
    return { format: normalizeDocumentNumbering(updated as DocumentNumbering), error: null };
  } catch (e) {
    return { format: null, error: (e as Error).message };
  }
}

export async function setDocumentNumberingStatus(
  id: string,
  format: DocumentNumbering,
  status: 'Active' | 'Inactive',
  meta: DocumentNumberingAuditMeta,
): Promise<{ success: boolean; error?: string }> {
  try {
    if (status === 'Active' && await hasDuplicateActiveNumbering(format.moduleName, format.documentType, id)) {
      return { success: false, error: 'Another active format exists for this module and document type' };
    }

    await updateAdminRecord(ADMIN_COLLECTIONS.documentNumbering, id, { status }, {
      userId: meta.userId,
      userName: meta.userName,
      module: 'Document Numbering',
      oldValue: JSON.stringify(format),
    });

    const action = status === 'Active' ? 'ACTIVATE_NUMBERING_FORMAT' : 'DEACTIVATE_NUMBERING_FORMAT';
    await logNumberingAudit(action, id, meta, format.status, status);
    return { success: true };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

async function getSequenceValue(numberingId: string, periodKey: string): Promise<number | null> {
  const ref = doc(getFirebaseFirestore(), ADMIN_COLLECTIONS.documentNumberSequences, sequenceDocId(numberingId, periodKey));
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return Number(snap.data().currentValue ?? 0);
}

async function setSequenceValue(numberingId: string, periodKey: string, value: number, formatId: string): Promise<void> {
  const ref = doc(getFirebaseFirestore(), ADMIN_COLLECTIONS.documentNumberSequences, sequenceDocId(numberingId, periodKey));
  await setDoc(ref, {
    numberingId,
    periodKey,
    currentValue: value,
    formatId,
    updatedAt: new Date().toISOString(),
  }, { merge: true });
}

export async function resetRunningNumber(
  id: string,
  format: DocumentNumbering,
  meta: DocumentNumberingAuditMeta,
  resetTo = 0,
): Promise<{ success: boolean; error?: string }> {
  try {
    const periodKey = getPeriodKey(format.resetFrequency, new Date());
    await setSequenceValue(format.numberingId, periodKey, resetTo, id);
    await updateAdminRecord(ADMIN_COLLECTIONS.documentNumbering, id, {
      currentRunningNumber: resetTo,
      currentNumber: resetTo,
    }, {
      userId: meta.userId,
      userName: meta.userName,
      module: 'Document Numbering',
      oldValue: JSON.stringify(format),
    });
    await logNumberingAudit('RESET_RUNNING_NUMBER', id, meta, format.currentRunningNumber, resetTo);
    return { success: true };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

export async function testGenerateNumber(
  format: DocumentNumbering,
  meta: DocumentNumberingAuditMeta,
): Promise<GenerateDocumentNumberResult> {
  const number = buildDocumentNumberPreview(format, {
    runningNumber: Number(format.currentRunningNumber ?? 0) + 1,
  });
  await logNumberingAudit('TEST_GENERATE_NUMBER', format.id || format.numberingId, meta, null, { preview: number });
  return { number, formatId: format.id, preview: true };
}

async function isNumberAlreadyUsed(number: string, moduleName: string): Promise<boolean> {
  const q = query(
    collection(getFirebaseFirestore(), ADMIN_COLLECTIONS.documentNumberSequences),
    where('lastGeneratedNumber', '==', number),
    where('moduleName', '==', moduleName),
  );
  const snap = await getDocs(q);
  return !snap.empty;
}

export async function generateDocumentNumber(
  moduleName: string,
  documentType: string,
  options: GenerateDocumentNumberOptions = {},
): Promise<GenerateDocumentNumberResult> {
  const format = await fetchActiveNumberingForModule(moduleName, documentType);
  if (!format) {
    return { number: '', error: `No active numbering format for ${moduleName} / ${documentType}` };
  }

  if (!format.autoGenerateEnabled && !options.manualNumber) {
    return { number: '', error: 'Auto generate is disabled for this format' };
  }

  if (options.manualNumber) {
    if (!format.manualOverrideAllowed && !options.allowManualOverride) {
      return { number: '', error: 'Manual override is not allowed for this format' };
    }
    if (await isNumberAlreadyUsed(options.manualNumber, moduleName)) {
      return { number: '', error: 'Document number already exists' };
    }
    return { number: options.manualNumber, formatId: format.id };
  }

  const date = options.date ?? new Date();
  const periodKey = getPeriodKey(format.resetFrequency, date);
  let sequence = await getSequenceValue(format.numberingId, periodKey);

  if (sequence === null) {
    sequence = Number(format.currentRunningNumber ?? 0);
    if (format.resetFrequency !== 'Never') {
      sequence = 0;
    }
  }

  const nextNumber = sequence + 1;
  const built = buildDocumentNumberPreview(format, {
    siteCode: options.siteCode,
    departmentCode: options.departmentCode,
    productCode: options.productCode,
    revision: options.revision,
    runningNumber: nextNumber,
    date,
  });

  if (await isNumberAlreadyUsed(built, moduleName)) {
    return { number: '', error: 'Generated number would duplicate an existing document number' };
  }

  if (options.increment) {
    await setSequenceValue(format.numberingId, periodKey, nextNumber, format.id || '');
    const seqRef = doc(getFirebaseFirestore(), ADMIN_COLLECTIONS.documentNumberSequences, sequenceDocId(format.numberingId, periodKey));
    await setDoc(seqRef, {
      lastGeneratedNumber: built,
      moduleName,
      documentType,
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    if (format.id) {
      await updateDoc(doc(getFirebaseFirestore(), ADMIN_COLLECTIONS.documentNumbering, format.id), {
        currentRunningNumber: nextNumber,
        currentNumber: nextNumber,
        updatedAt: new Date().toISOString(),
      });
    }
  }

  return { number: built, formatId: format.id, preview: !options.increment };
}

export function exportDocumentNumberingsCsv(formats: DocumentNumbering[]): string {
  const headers = [
    'Numbering Code', 'Module', 'Document Type', 'Prefix', 'Site Code', 'Department Code',
    'Year Format', 'Month Format', 'Separator', 'Running Length', 'Current Number',
    'Reset Frequency', 'Revision Format', 'Format Tokens', 'Example Preview',
    'Auto Generate', 'Manual Override', 'Status',
  ];
  const rows = formats.map((n) => [
    n.numberingCode,
    n.moduleName,
    n.documentType,
    n.prefix,
    n.siteCode,
    n.departmentCode,
    n.yearFormat,
    n.monthFormat,
    n.separator,
    String(n.runningNumberLength),
    String(n.currentRunningNumber),
    n.resetFrequency,
    n.revisionFormat,
    n.formatTokens,
    n.exampleNumberPreview,
    n.autoGenerateEnabled ? 'Yes' : 'No',
    n.manualOverrideAllowed ? 'Yes' : 'No',
    n.status,
  ].map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','));
  return [headers.join(','), ...rows].join('\n');
}

export async function logDocumentNumberingExport(
  meta: DocumentNumberingAuditMeta,
  count: number,
): Promise<void> {
  await logNumberingAudit('EXPORT_NUMBERING_LIST', 'export', meta, null, { count });
}

const DEFAULT_FORMATS: Array<DocumentNumberingFormData & { numberingCode: string }> = [
  {
    numberingCode: 'PQR-REPORT',
    moduleName: 'PQR',
    documentType: 'PQR Report',
    prefix: 'PQR',
    siteCode: 'HMF',
    departmentCode: '0041',
    productCodeOptional: '',
    yearFormat: 'YYYY',
    monthFormat: 'None',
    separator: '/',
    runningNumberLength: 3,
    currentRunningNumber: 40,
    resetFrequency: 'Yearly',
    revisionFormat: '00',
    formatTokens: 'PREFIX,SITE_CODE,DEPARTMENT_CODE,RUNNING_NUMBER,YEAR',
    autoGenerateEnabled: true,
    manualOverrideAllowed: false,
    remarks: 'Default PQR numbering',
  },
  {
    numberingCode: 'DEV-REPORT',
    moduleName: 'Deviation',
    documentType: 'Deviation Report',
    prefix: 'DEV',
    siteCode: '',
    departmentCode: 'QA',
    productCodeOptional: '',
    yearFormat: 'YYYY',
    monthFormat: 'None',
    separator: '/',
    runningNumberLength: 4,
    currentRunningNumber: 0,
    resetFrequency: 'Yearly',
    revisionFormat: '00',
    formatTokens: 'PREFIX,DEPARTMENT_CODE,RUNNING_NUMBER,YEAR',
    autoGenerateEnabled: true,
    manualOverrideAllowed: false,
    remarks: 'Default deviation numbering',
  },
  {
    numberingCode: 'OOS-INV',
    moduleName: 'OOS',
    documentType: 'OOS Investigation',
    prefix: 'OOS',
    siteCode: '',
    departmentCode: 'QC',
    productCodeOptional: '',
    yearFormat: 'YYYY',
    monthFormat: 'None',
    separator: '/',
    runningNumberLength: 4,
    currentRunningNumber: 0,
    resetFrequency: 'Yearly',
    revisionFormat: '00',
    formatTokens: 'PREFIX,DEPARTMENT_CODE,RUNNING_NUMBER,YEAR',
    autoGenerateEnabled: true,
    manualOverrideAllowed: false,
    remarks: '',
  },
  {
    numberingCode: 'CAPA-REPORT',
    moduleName: 'CAPA',
    documentType: 'CAPA Report',
    prefix: 'CAPA',
    siteCode: '',
    departmentCode: 'QA',
    productCodeOptional: '',
    yearFormat: 'YYYY',
    monthFormat: 'None',
    separator: '/',
    runningNumberLength: 4,
    currentRunningNumber: 0,
    resetFrequency: 'Yearly',
    revisionFormat: '00',
    formatTokens: 'PREFIX,DEPARTMENT_CODE,RUNNING_NUMBER,YEAR',
    autoGenerateEnabled: true,
    manualOverrideAllowed: false,
    remarks: '',
  },
  {
    numberingCode: 'CC-CTRL',
    moduleName: 'Change Control',
    documentType: 'Change Control',
    prefix: 'CC',
    siteCode: '',
    departmentCode: 'QA',
    productCodeOptional: '',
    yearFormat: 'YYYY',
    monthFormat: 'None',
    separator: '/',
    runningNumberLength: 4,
    currentRunningNumber: 0,
    resetFrequency: 'Yearly',
    revisionFormat: '00',
    formatTokens: 'PREFIX,DEPARTMENT_CODE,RUNNING_NUMBER,YEAR',
    autoGenerateEnabled: true,
    manualOverrideAllowed: false,
    remarks: '',
  },
  {
    numberingCode: 'CPV-REVIEW',
    moduleName: 'CPV',
    documentType: 'CPV Review',
    prefix: 'CPV',
    siteCode: '',
    departmentCode: 'QA',
    productCodeOptional: '',
    yearFormat: 'YYYY',
    monthFormat: 'None',
    separator: '/',
    runningNumberLength: 4,
    currentRunningNumber: 0,
    resetFrequency: 'Yearly',
    revisionFormat: '00',
    formatTokens: 'PREFIX,DEPARTMENT_CODE,RUNNING_NUMBER,YEAR',
    autoGenerateEnabled: true,
    manualOverrideAllowed: false,
    remarks: '',
  },
  {
    numberingCode: 'SOP-DOC',
    moduleName: 'DMS',
    documentType: 'SOP',
    prefix: 'SOP',
    siteCode: '',
    departmentCode: 'QA',
    productCodeOptional: '',
    yearFormat: 'None',
    monthFormat: 'None',
    separator: '/',
    runningNumberLength: 3,
    currentRunningNumber: 0,
    resetFrequency: 'Never',
    revisionFormat: '00',
    formatTokens: 'PREFIX,DEPARTMENT_CODE,RUNNING_NUMBER,REVISION',
    autoGenerateEnabled: true,
    manualOverrideAllowed: true,
    remarks: '',
  },
  {
    numberingCode: 'STP-DOC',
    moduleName: 'DMS',
    documentType: 'STP',
    prefix: 'STP',
    siteCode: '',
    departmentCode: 'QC',
    productCodeOptional: '',
    yearFormat: 'None',
    monthFormat: 'None',
    separator: '/',
    runningNumberLength: 3,
    currentRunningNumber: 0,
    resetFrequency: 'Never',
    revisionFormat: '00',
    formatTokens: 'PREFIX,DEPARTMENT_CODE,RUNNING_NUMBER,REVISION',
    autoGenerateEnabled: true,
    manualOverrideAllowed: true,
    remarks: '',
  },
  {
    numberingCode: 'VAL-IQ',
    moduleName: 'Validation',
    documentType: 'Validation Protocol',
    prefix: 'VAL',
    siteCode: '',
    departmentCode: 'IQ',
    productCodeOptional: '',
    yearFormat: 'YYYY',
    monthFormat: 'None',
    separator: '/',
    runningNumberLength: 4,
    currentRunningNumber: 0,
    resetFrequency: 'Yearly',
    revisionFormat: '00',
    formatTokens: 'PREFIX,DEPARTMENT_CODE,RUNNING_NUMBER,YEAR',
    autoGenerateEnabled: true,
    manualOverrideAllowed: false,
    remarks: '',
  },
  {
    numberingCode: 'CSV-URS',
    moduleName: 'CSV',
    documentType: 'CSV URS',
    prefix: 'CSV',
    siteCode: '',
    departmentCode: 'URS',
    productCodeOptional: '',
    yearFormat: 'YYYY',
    monthFormat: 'None',
    separator: '/',
    runningNumberLength: 4,
    currentRunningNumber: 0,
    resetFrequency: 'Yearly',
    revisionFormat: '00',
    formatTokens: 'PREFIX,DEPARTMENT_CODE,RUNNING_NUMBER,YEAR',
    autoGenerateEnabled: true,
    manualOverrideAllowed: false,
    remarks: '',
  },
  {
    numberingCode: 'BMR-PROD',
    moduleName: 'Warehouse',
    documentType: 'BMR',
    prefix: 'BMR',
    siteCode: '',
    departmentCode: 'PROD',
    productCodeOptional: '',
    yearFormat: 'YYYY',
    monthFormat: 'None',
    separator: '/',
    runningNumberLength: 4,
    currentRunningNumber: 0,
    resetFrequency: 'Yearly',
    revisionFormat: '00',
    formatTokens: 'PREFIX,DEPARTMENT_CODE,RUNNING_NUMBER,YEAR',
    autoGenerateEnabled: true,
    manualOverrideAllowed: false,
    remarks: '',
  },
  {
    numberingCode: 'EBMR-PROD',
    moduleName: 'eBMR',
    documentType: 'BMR',
    prefix: 'EBMR',
    siteCode: '',
    departmentCode: 'PROD',
    productCodeOptional: '',
    yearFormat: 'YYYY',
    monthFormat: 'None',
    separator: '/',
    runningNumberLength: 4,
    currentRunningNumber: 0,
    resetFrequency: 'Yearly',
    revisionFormat: '00',
    formatTokens: 'PREFIX,DEPARTMENT_CODE,RUNNING_NUMBER,YEAR',
    autoGenerateEnabled: true,
    manualOverrideAllowed: false,
    remarks: '',
  },
];

export async function seedDefaultDocumentNumberings(
  meta: DocumentNumberingAuditMeta,
): Promise<{ created: number; skipped: number }> {
  let created = 0;
  let skipped = 0;
  for (const def of DEFAULT_FORMATS) {
    const exists = await checkUniqueField(ADMIN_COLLECTIONS.documentNumbering, 'numberingCode', def.numberingCode);
    if (!exists) {
      skipped += 1;
      continue;
    }
    const result = await createDocumentNumbering(def, meta);
    if (result.format) created += 1;
    else skipped += 1;
  }
  return { created, skipped };
}
